import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { storeAdminSetup, users, type User } from "../drizzle/schema";
import { getDb } from "./db";
import { findStaffMemberById } from "./persistentStore";

export const ADMIN_PASSWORD_COOKIE = "miss_admin_pass_session";

function getConfiguredAdminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() || "DBZ1995";
}

function getSigningSecret(): string {
  return `${getConfiguredAdminPassword()}:${process.env.MANUS_JWT_SECRET || "miss-sensuelle-admin"}`;
}

export function verifyAdminPassword(input: string): boolean {
  const expected = createHash("sha256").update(getConfiguredAdminPassword()).digest();
  const actual = createHash("sha256").update(input.trim()).digest();
  return timingSafeEqual(expected, actual);
}

export function createAdminPasswordToken(): string {
  return createHmac("sha256", getSigningSecret()).update("miss-sensuelle-admin-v1").digest("hex");
}

export function createStaffSessionToken(staffId: string): string {
  const sig = createHmac("sha256", getSigningSecret())
    .update(`miss-sensuelle-staff-v1:${staffId}`)
    .digest("hex");
  return `staff:${staffId}:${sig}`;
}

export function verifyAdminPasswordToken(cookieHeader: string | undefined): User | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(`${ADMIN_PASSWORD_COOKIE}=`));
  if (!match) return null;
  const token = decodeURIComponent(match.slice(ADMIN_PASSWORD_COOKIE.length + 1));

  if (token.startsWith("staff:")) {
    const parts = token.split(":");
    if (parts.length !== 3) return null;
    const [, staffId, sig] = parts;
    if (!staffId || !sig) return null;
    const expectedSig = createHmac("sha256", getSigningSecret())
      .update(`miss-sensuelle-staff-v1:${staffId}`)
      .digest("hex");
    if (sig.length !== expectedSig.length) return null;
    try {
      if (!timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expectedSig, "utf8"))) {
        return null;
      }
    } catch {
      return null;
    }
    const staff = findStaffMemberById(staffId);
    if (staff && !staff.active) return null;
    const now = new Date();
    return {
      id: 2,
      openId: `staff:${staffId}`,
      name: staff?.name || "Confirmateur",
      email: staffId,
      loginMethod: "staff_code",
      role: "admin",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    };
  }

  const expected = createAdminPasswordToken();
  if (token.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(token, "utf8"), Buffer.from(expected, "utf8"))) {
      return null;
    }
  } catch {
    return null;
  }
  const now = new Date();
  return {
    id: 1,
    openId: "admin-password-owner",
    name: "Miss Sensuelle",
    email: null,
    loginMethod: "password",
    role: "admin",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

const attempts = new Map<number, { count: number; until: number }>();
const WINDOW_MS = 15 * 60 * 1000;

export function hashOwnerCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function ownerCodeMatches(code: string, expected: string | null) {
  if (!expected || !/^[a-f0-9]{64}$/i.test(expected)) return false;
  const normalized = code.replace(/\s/g, "");
  if (!/^[A-Za-z0-9_-]{43}$/.test(normalized)) return false;
  return timingSafeEqual(Buffer.from(hashOwnerCode(normalized), "hex"), Buffer.from(expected, "hex"));
}

function guardAttempts(userId: number) {
  const now = Date.now();
  for (const [id, entry] of attempts) if (entry.until < now) attempts.delete(id);
  const entry = attempts.get(userId);
  if (entry && entry.count >= 5) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Trop de tentatives. Réessaie dans 15 minutes." });
  }
  if (attempts.size >= 2000 && !entry) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Réessaie plus tard." });
  }
  attempts.set(userId, { count: (entry?.count ?? 0) + 1, until: entry?.until ?? now + WINDOW_MS });
}

async function requireDb() {
  const database = await getDb();
  if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "La base de données n’est pas disponible." });
  return database;
}

export async function getAdminSetupStatus() {
  const database = await requireDb();
  const existing = await database.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
  if (existing.length) return { configured: true, setupAvailable: false };
  const [setup] = await database.select().from(storeAdminSetup).where(eq(storeAdminSetup.id, 1)).limit(1);
  return {
    configured: false,
    setupAvailable: Boolean(setup?.codeHash && !setup.claimedBy && setup.expiresAt.getTime() > Date.now()),
  };
}

export async function claimAdmin(user: User, code: string): Promise<{ success: true }> {
  if (user.role === "admin") return { success: true };
  if (!Number.isInteger(user.id) || user.id <= 0) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Une connexion personnelle Manus est nécessaire." });
  }
  guardAttempts(user.id);
  const database = await requireDb();
  await database.transaction(async transaction => {
    const [setup] = await transaction.select().from(storeAdminSetup)
      .where(eq(storeAdminSetup.id, 1)).for("update");
    const valid = setup && !setup.claimedBy && setup.expiresAt.getTime() > Date.now()
      && ownerCodeMatches(code, setup.codeHash);
    const existing = await transaction.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
    if (!valid || existing.length) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Clé invalide, expirée ou déjà utilisée. Aucun accès n’a été accordé." });
    }
    const [account] = await transaction.select({ id: users.id }).from(users).where(eq(users.id, user.id)).limit(1);
    if (!account) throw new TRPCError({ code: "FORBIDDEN", message: "Compte connecté introuvable." });
    await transaction.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
    await transaction.update(storeAdminSetup).set({ codeHash: null, claimedBy: user.id, claimedAt: new Date() })
      .where(and(eq(storeAdminSetup.id, 1), isNull(storeAdminSetup.claimedBy)));
  });
  attempts.delete(user.id);
  return { success: true };
}
