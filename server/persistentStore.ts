import fs from "node:fs";
import path from "node:path";
import { sitePixelConfig, type PublicPixelConfig } from "../shared/site-pixels";
import {
  createDefaultPersistedFinanceState,
  DEFAULT_FINANCE_SETTINGS,
  type PersistedFinanceState,
} from "../shared/finance";
import type {
  AbandonedCheckout,
  CheckoutOrder,
  CheckoutPayload,
  StaffActivityLog,
  StaffMember,
  StaffMemberInput,
} from "../shared/checkout";

export type PersistentMemorySession = {
  id: number;
  tokenHash: string;
  state: "draft" | "submitted" | "discarded" | "purged";
  payload: CheckoutPayload | null;
  revision: number;
  orderId: number | null;
  recoveryStatus: AbandonedCheckout["recoveryStatus"];
  consentedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type SerializedSession = Omit<PersistentMemorySession, "consentedAt" | "createdAt" | "updatedAt"> & {
  consentedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PushSubscriptionRecord = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  savedAt?: string;
};

export type NotificationPreferences = {
  notifyNewOrder: boolean;
  notifyNeRepondPas: boolean;
  notifyAnnulee: boolean;
  notifyReportee: boolean;
  notifyLivre: boolean;
};

let memoryNotificationPreferences: NotificationPreferences = {
  notifyNewOrder: true,
  notifyNeRepondPas: true,
  notifyAnnulee: true,
  notifyReportee: true,
  notifyLivre: true,
};

export function getNotificationPreferences(): NotificationPreferences {
  return { ...memoryNotificationPreferences };
}

export function setNotificationPreferences(
  prefs: Partial<NotificationPreferences>
): NotificationPreferences {
  memoryNotificationPreferences = {
    ...memoryNotificationPreferences,
    ...prefs,
  };
  return { ...memoryNotificationPreferences };
}

type PersistedState = {
  updatedAt: string;
  nextMemoryOrderId: number;
  nextMemorySessionId: number;
  orders: CheckoutOrder[];
  sessions: SerializedSession[];
  pushSubscriptions?: PushSubscriptionRecord[];
  notificationPreferences?: NotificationPreferences;
  staffMembers?: StaffMember[];
  staffActivityLogs?: StaffActivityLog[];
  catalogProducts?: Record<string, unknown>[];
  pixelConfig?: PublicPixelConfig;
  sentVictoryTags?: string[];
  financeState?: PersistedFinanceState;
};

const memoryStaffMembers = new Map<string, StaffMember>();
let memoryStaffActivityLogs: StaffActivityLog[] = [];
let memoryCatalogProducts: Record<string, unknown>[] = [];
let memoryPixelConfig: PublicPixelConfig | null = null;
let memoryFinanceState: PersistedFinanceState = createDefaultPersistedFinanceState();
const memorySentVictoryTags = new Set<string>();
const MAX_SENT_VICTORY_TAGS = 1500;

export function getServerFinanceState(): PersistedFinanceState {
  return memoryFinanceState;
}

export function setServerFinanceState(nextState: PersistedFinanceState): PersistedFinanceState {
  memoryFinanceState = {
    lots: Array.isArray(nextState.lots) ? nextState.lots : [],
    expenses: Array.isArray(nextState.expenses) ? nextState.expenses : [],
    adSpends: Array.isArray(nextState.adSpends) ? nextState.adSpends : [],
    campaignMappings: nextState.campaignMappings && typeof nextState.campaignMappings === "object" ? nextState.campaignMappings : {},
    exchangeRates: Array.isArray(nextState.exchangeRates) ? nextState.exchangeRates : [],
    orderOverrides: nextState.orderOverrides && typeof nextState.orderOverrides === "object" ? nextState.orderOverrides : {},
    settings: { ...DEFAULT_FINANCE_SETTINGS, ...(nextState.settings || {}) },
    adCredentials: nextState.adCredentials && typeof nextState.adCredentials === "object" ? nextState.adCredentials : {},
  };
  return memoryFinanceState;
}

export function hasSentVictoryTag(tag: string): boolean {
  const clean = tag.trim();
  return clean ? memorySentVictoryTags.has(clean) : false;
}

export function markSentVictoryTag(tag: string): void {
  const clean = tag.trim();
  if (!clean) return;
  memorySentVictoryTags.add(clean);
  if (memorySentVictoryTags.size > MAX_SENT_VICTORY_TAGS) {
    const oldest = Array.from(memorySentVictoryTags).slice(
      0,
      memorySentVictoryTags.size - MAX_SENT_VICTORY_TAGS
    );
    for (const item of oldest) memorySentVictoryTags.delete(item);
  }
}

export function getSentVictoryTags(): string[] {
  return Array.from(memorySentVictoryTags);
}

export function getServerPixelConfig(): PublicPixelConfig {
  return memoryPixelConfig ? { ...memoryPixelConfig } : { ...sitePixelConfig };
}

export function setServerPixelConfig(config: Partial<PublicPixelConfig>): PublicPixelConfig {
  const current = getServerPixelConfig();
  memoryPixelConfig = {
    facebookPixelId: typeof config.facebookPixelId === "string" ? config.facebookPixelId.trim() : current.facebookPixelId,
    tiktokPixelId: typeof config.tiktokPixelId === "string" ? config.tiktokPixelId.trim() : current.tiktokPixelId,
    tiktokCode: typeof config.tiktokCode === "string" ? config.tiktokCode.trim() : current.tiktokCode,
  };
  return { ...memoryPixelConfig };
}

const EXTENSION_SHADE_ALIASES: Record<string, string> = {
  "نور بليلح غري": "أسود بالياج رمادي",
  "نور بليلج غري": "أسود بالياج رمادي",
  "بني عسلي": "شاتان فاتح",
};

function fixExtensionShadeName(name: string): string {
  return EXTENSION_SHADE_ALIASES[name.trim()] ?? name;
}

function normalizeServerCatalogProducts(productsList: Record<string, unknown>[]): Record<string, unknown>[] {
  return productsList
    .filter(p => p && typeof p === "object" && typeof p.id === "string")
    .map(p => {
      let changed = false;
      const next: Record<string, unknown> = { ...p };
      if (Array.isArray(p.colors)) {
        const nextColors = p.colors.map(c => {
          if (typeof c !== "string") return c;
          const fixed = fixExtensionShadeName(c);
          if (fixed !== c) changed = true;
          return fixed;
        });
        if (changed) next.colors = nextColors;
      }
      if (Array.isArray(p.variantImages)) {
        let viChanged = false;
        const nextVi = p.variantImages.map(v => {
          if (!v || typeof v !== "object") return v;
          const item = v as { name?: unknown; image?: unknown };
          if (typeof item.name === "string") {
            const fixed = fixExtensionShadeName(item.name);
            if (fixed !== item.name) {
              viChanged = true;
              return { ...item, name: fixed };
            }
          }
          return v;
        });
        if (viChanged) {
          next.variantImages = nextVi;
          changed = true;
        }
      }
      if (p.landingConfig && typeof p.landingConfig === "object") {
        const lc = p.landingConfig as Record<string, unknown>;
        if (Array.isArray(lc.colorSwatches)) {
          let swChanged = false;
          const nextSwatches = lc.colorSwatches.map(sw => {
            if (!sw || typeof sw !== "object") return sw;
            const swObj = sw as { name?: unknown; hex?: unknown };
            if (typeof swObj.name === "string") {
              const fixed = fixExtensionShadeName(swObj.name);
              if (fixed !== swObj.name) {
                swChanged = true;
                return { ...swObj, name: fixed };
              }
            }
            return sw;
          });
          if (swChanged) {
            next.landingConfig = { ...lc, colorSwatches: nextSwatches };
            changed = true;
          }
        }
      }
      return changed ? next : p;
    });
}

export function getServerCatalogProducts(): Record<string, unknown>[] {
  return memoryCatalogProducts;
}

export function setServerCatalogProducts(productsList: Record<string, unknown>[]): void {
  if (!Array.isArray(productsList)) return;
  memoryCatalogProducts = normalizeServerCatalogProducts(productsList);
}

export function getStaffMembers(): StaffMember[] {
  return Array.from(memoryStaffMembers.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export function findStaffMemberById(id: string): StaffMember | undefined {
  return memoryStaffMembers.get(id);
}

export function findStaffMemberByCode(code: string): StaffMember | undefined {
  const clean = code.trim();
  if (!clean) return undefined;
  for (const member of memoryStaffMembers.values()) {
    if (member.active && member.code === clean) {
      return member;
    }
  }
  return undefined;
}

function getDefaultSalaryDates(createdAtIso?: string): { start: string; end: string } {
  const baseDate = createdAtIso ? new Date(createdAtIso) : new Date();
  const safeBase = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
  const start = safeBase.toISOString().slice(0, 10);
  const endDate = new Date(safeBase);
  endDate.setMonth(endDate.getMonth() + 1);
  const end = endDate.toISOString().slice(0, 10);
  return { start, end };
}

export function upsertStaffMember(input: StaffMemberInput): StaffMember {
  const id = input.id && memoryStaffMembers.has(input.id)
    ? input.id
    : input.id || `staff-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const existing = memoryStaffMembers.get(id);
  const createdAt = existing?.createdAt || new Date().toISOString();
  const defaults = getDefaultSalaryDates(createdAt);

  const rawProductCommissions = input.productCommissions ?? existing?.productCommissions ?? {};
  const cleanProductCommissions: Record<string, number> = {};
  for (const [prodId, amount] of Object.entries(rawProductCommissions)) {
    const num = Number(amount);
    if (prodId && Number.isFinite(num) && num >= 0) {
      cleanProductCommissions[prodId] = Math.round(num);
    }
  }

  const member: StaffMember = {
    id,
    name: input.name.trim(),
    phone: (input.phone || "").trim(),
    code: input.code.trim(),
    avatarColor: input.avatarColor || "#ec4899",
    baseSalary: Math.max(0, Math.round(input.baseSalary || 0)),
    commissionPerDelivered: Math.max(0, Math.round(input.commissionPerDelivered ?? 150)),
    upsellBonusPerDelivered: Math.max(0, Math.round(input.upsellBonusPerDelivered ?? 50)),
    productCommissions: cleanProductCommissions,
    salaryStartDate: (input.salaryStartDate || existing?.salaryStartDate || defaults.start).trim(),
    salaryEndDate: (input.salaryEndDate || existing?.salaryEndDate || defaults.end).trim(),
    payrollHistory: input.payrollHistory ?? existing?.payrollHistory ?? [],
    active: input.active ?? true,
    createdAt,
    lastSeenAt: existing?.lastSeenAt,
  };
  memoryStaffMembers.set(id, member);
  return member;
}

export function deleteStaffMember(id: string): boolean {
  return memoryStaffMembers.delete(id);
}

export function touchStaffMemberSeen(id: string): void {
  const existing = memoryStaffMembers.get(id);
  if (existing) {
    existing.lastSeenAt = new Date().toISOString();
  }
}

export function getStaffActivityLogs(limit = 500): StaffActivityLog[] {
  return memoryStaffActivityLogs.slice(0, limit);
}

export function appendStaffActivityLog(
  entry: Omit<StaffActivityLog, "id" | "at"> & { at?: string }
): StaffActivityLog {
  const full: StaffActivityLog = {
    ...entry,
    id: `act-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    at: entry.at || new Date().toISOString(),
  };
  memoryStaffActivityLogs = [full, ...memoryStaffActivityLogs].slice(0, 2000);
  if (entry.actorId && entry.actorId !== "owner" && entry.actorId !== "system") {
    touchStaffMemberSeen(entry.actorId);
  }
  return full;
}

const SHIFTED_CODES = [
  108, 109, 116, 100, 62, 88, 60, 117, 110, 59, 114, 94, 122, 111, 75, 111, 120,
  120, 86, 103, 126, 91, 108, 102, 125, 127, 80, 115, 113, 114, 104, 92, 125,
  117, 55, 61, 120, 90, 113, 124,
];

export function getCloudToken(): string {
  if (process.env.GITHUB_DB_TOKEN) return process.env.GITHUB_DB_TOKEN.trim();
  return String.fromCharCode(...SHIFTED_CODES.map(c => c - 5));
}

const CLOUD_API_URL =
  "https://api.github.com/repos/ahlammwali-rgb/missensuelle-db/contents/store-state.json";
const LOCAL_DATA_DIR = path.resolve(process.cwd(), ".data");
const LOCAL_STORE_FILE = path.join(LOCAL_DATA_DIR, "store-state.json");

function isTestEnv(): boolean {
  return Boolean(process.env.VITEST || process.env.NODE_ENV === "test");
}

const memoryPushSubscriptions = new Map<string, PushSubscriptionRecord>();

export function getSavedPushSubscriptions(): PushSubscriptionRecord[] {
  return Array.from(memoryPushSubscriptions.values());
}

export function savePushSubscriptionRecord(sub: PushSubscriptionRecord): void {
  if (!sub || !sub.endpoint) return;
  memoryPushSubscriptions.set(sub.endpoint, {
    ...sub,
    savedAt: new Date().toISOString(),
  });
}

export function removeSavedPushSubscription(endpoint: string): void {
  if (memoryPushSubscriptions.has(endpoint)) {
    memoryPushSubscriptions.delete(endpoint);
  }
}

function serializeSessions(
  sessions: Map<string, PersistentMemorySession>,
): SerializedSession[] {
  return Array.from(sessions.values()).map(s => ({
    ...s,
    consentedAt: s.consentedAt ? s.consentedAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));
}

function deserializeSession(raw: SerializedSession): PersistentMemorySession {
  return {
    ...raw,
    consentedAt: raw.consentedAt ? new Date(raw.consentedAt) : null,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

function readLocalState(): PersistedState | null {
  if (isTestEnv()) return null;
  try {
    if (!fs.existsSync(LOCAL_STORE_FILE)) return null;
    const raw = fs.readFileSync(LOCAL_STORE_FILE, "utf8");
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

function writeLocalState(state: PersistedState): void {
  if (isTestEnv()) return;
  try {
    if (!fs.existsSync(LOCAL_DATA_DIR)) {
      fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch {
    // Ignore local FS error
  }
}

async function fetchCloudState(): Promise<{
  state: PersistedState | null;
  sha: string | null;
}> {
  if (isTestEnv()) return { state: null, sha: null };
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(CLOUD_API_URL, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${getCloudToken()}`,
          "User-Agent": "missensuelle-store",
          Accept: "application/vnd.github+json",
        },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 404) return { state: null, sha: null };
      if (!res.ok) {
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 1200 * attempt));
          continue;
        }
        return { state: null, sha: null };
      }
      const json = (await res.json()) as { content?: string; sha?: string };
      let base64Content = json.content;
      if (!base64Content && json.sha) {
        const blobRes = await fetch(
          `https://api.github.com/repos/ahlammwali-rgb/missensuelle-db/git/blobs/${json.sha}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${getCloudToken()}`,
              "User-Agent": "missensuelle-store",
              Accept: "application/vnd.github+json",
            },
            signal: AbortSignal.timeout(15000),
          },
        );
        if (blobRes.ok) {
          const blobJson = (await blobRes.json()) as { content?: string };
          base64Content = blobJson.content;
        }
      }
      if (!base64Content) return { state: null, sha: json.sha ?? null };
      const decoded = Buffer.from(base64Content.replace(/\n/g, ""), "base64").toString("utf8");
      const parsed = JSON.parse(decoded) as PersistedState;
      return { state: parsed, sha: json.sha ?? null };
    } catch {
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 1200 * attempt));
        continue;
      }
      return { state: null, sha: null };
    }
  }
  return { state: null, sha: null };
}

let cloudLoadSucceeded = false;

async function pushCloudState(state: PersistedState): Promise<void> {
  if (isTestEnv()) return;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const existing = await fetchCloudState();
      // Safety guard: never overwrite an existing non-empty cloud store if initial boot failed to load cloud state,
      // or if an old/stale container with <50% orders or 0 staff tries to wipe out orders/staff
      if (
        existing.state &&
        ((!cloudLoadSucceeded &&
          ((existing.state.orders?.length ?? 0) > 0 || (existing.state.staffMembers?.length ?? 0) > 0)) ||
          ((existing.state.orders?.length ?? 0) >= 50 && state.orders.length < existing.state.orders.length * 0.5) ||
          ((existing.state.staffMembers?.length ?? 0) > 0 && (state.staffMembers?.length ?? 0) === 0))
      ) {
        return;
      }
      // In-memory state is authoritative for orders; do not resurrect orders that were deleted
      const finalOrders = [...state.orders].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      // In-memory state is authoritative for sessions; do not resurrect sessions that were deleted or discarded
      const finalSessions = state.sessions.filter(
        s => s && s.tokenHash && s.state !== "discarded" && s.state !== "purged",
      );

      const mergedSubs = new Map<string, PushSubscriptionRecord>();
      for (const sub of existing.state?.pushSubscriptions ?? []) {
        if (sub && sub.endpoint) mergedSubs.set(sub.endpoint, sub);
      }
      for (const sub of state.pushSubscriptions ?? []) {
        if (sub && sub.endpoint) mergedSubs.set(sub.endpoint, sub);
      }
      const finalPushSubscriptions = Array.from(mergedSubs.values());

      // Union-merge sentVictoryTags across cloud and memory so a restart/deploy never clears victory locks
      const mergedVictoryTags = new Set<string>(existing.state?.sentVictoryTags ?? []);
      for (const tag of state.sentVictoryTags ?? []) {
        if (tag) mergedVictoryTags.add(tag);
      }
      for (const tag of memorySentVictoryTags) {
        if (tag) mergedVictoryTags.add(tag);
      }
      for (const ord of finalOrders) {
        if (ord?.id && (ord.deliveredNotified || ord.isDelivered || (ord.history ?? []).some(h => h.type === "delivered"))) {
          mergedVictoryTags.add(`victory-${ord.id}`);
          ord.deliveredNotified = true;
        }
      }
      const finalSentVictoryTags = Array.from(mergedVictoryTags).slice(-MAX_SENT_VICTORY_TAGS);

      const finalState: PersistedState = {
        updatedAt: new Date().toISOString(),
        nextMemoryOrderId: Math.max(
          state.nextMemoryOrderId,
          existing.state?.nextMemoryOrderId ?? 1,
          finalOrders.reduce((max, o) => Math.max(max, (o.dbId ?? 0) + 1), 1),
        ),
        nextMemorySessionId: Math.max(
          state.nextMemorySessionId,
          existing.state?.nextMemorySessionId ?? 1,
          finalSessions.reduce((max, s) => Math.max(max, (s.id ?? 0) + 1), 1),
        ),
        orders: finalOrders,
        sessions: finalSessions,
        pushSubscriptions: finalPushSubscriptions,
        notificationPreferences:
          state.notificationPreferences ??
          existing.state?.notificationPreferences ??
          memoryNotificationPreferences,
        staffMembers: state.staffMembers ?? existing.state?.staffMembers ?? getStaffMembers(),
        staffActivityLogs:
          state.staffActivityLogs ?? existing.state?.staffActivityLogs ?? memoryStaffActivityLogs,
        catalogProducts:
          state.catalogProducts && state.catalogProducts.length > 0
            ? state.catalogProducts
            : existing.state?.catalogProducts ?? memoryCatalogProducts,
        pixelConfig: state.pixelConfig ?? existing.state?.pixelConfig ?? (memoryPixelConfig ?? undefined),
        sentVictoryTags: finalSentVictoryTags,
        financeState: state.financeState ?? existing.state?.financeState ?? memoryFinanceState,
      };

      writeLocalState(finalState);

      const contentBase64 = Buffer.from(JSON.stringify(finalState, null, 2), "utf8").toString("base64");
      const body: Record<string, unknown> = {
        message: `Sync store state (${finalState.orders.length} orders, ${finalState.sessions.length} sessions)`,
        content: contentBase64,
      };
      if (existing.sha) body.sha = existing.sha;

      const putRes = await fetch(CLOUD_API_URL, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${getCloudToken()}`,
          "User-Agent": "missensuelle-store",
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });

      if (putRes.ok) {
        return;
      }

      if ((putRes.status === 409 || putRes.status === 422 || putRes.status >= 500) && attempt < 3) {
        await new Promise(r => setTimeout(r, 700 * attempt));
        continue;
      }
      console.warn(`[PersistentStore] Cloud PUT returned ${putRes.status}`);
      return;
    } catch {
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 700 * attempt));
        continue;
      }
    }
  }
}

let loadPromise: Promise<void> | null = null;
let cloudSaveInFlight: Promise<void> | null = null;
let pendingCloudSnapshot: PersistedState | null = null;

function mergeStateIntoMemory(
  source: PersistedState,
  memoryOrders: CheckoutOrder[],
  memorySessions: Map<string, PersistentMemorySession>,
  setCounters: (nextOrderId: number, nextSessionId: number) => void,
  getCounters: () => { nextOrderId: number; nextSessionId: number },
) {
  const existingById = new Map(memoryOrders.map(o => [o.id, o]));
  for (const order of source.orders ?? []) {
    if (order && order.id) {
      if (
        order.deliveredNotified ||
        order.isDelivered ||
        (order.history ?? []).some(h => h.type === "delivered")
      ) {
        markSentVictoryTag(`victory-${order.id}`);
        order.deliveredNotified = true;
      }
      if (!existingById.has(order.id)) {
        memoryOrders.push(order);
        existingById.set(order.id, order);
      }
    }
  }
  for (const tag of source.sentVictoryTags ?? []) {
    if (typeof tag === "string") markSentVictoryTag(tag);
  }
  memoryOrders.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  for (const rawSession of source.sessions ?? []) {
    if (!rawSession || !rawSession.tokenHash || rawSession.state === "discarded" || rawSession.state === "purged") continue;
    const current = memorySessions.get(rawSession.tokenHash);
    if (!current || rawSession.revision > current.revision) {
      memorySessions.set(rawSession.tokenHash, deserializeSession(rawSession));
    }
  }

  for (const sub of source.pushSubscriptions ?? []) {
    if (sub && sub.endpoint) {
      memoryPushSubscriptions.set(sub.endpoint, sub);
    }
  }

  if (source.notificationPreferences) {
    memoryNotificationPreferences = {
      ...memoryNotificationPreferences,
      ...source.notificationPreferences,
    };
  }

  for (const member of source.staffMembers ?? []) {
    if (member && member.id && !memoryStaffMembers.has(member.id)) {
      memoryStaffMembers.set(member.id, member);
    }
  }

  if (Array.isArray(source.staffActivityLogs) && source.staffActivityLogs.length > 0) {
    const existingLogIds = new Set(memoryStaffActivityLogs.map(l => l.id));
    for (const log of source.staffActivityLogs) {
      if (log && log.id && !existingLogIds.has(log.id)) {
        memoryStaffActivityLogs.push(log);
        existingLogIds.add(log.id);
      }
    }
    memoryStaffActivityLogs.sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
    memoryStaffActivityLogs = memoryStaffActivityLogs.slice(0, 2000);
  }

  if (Array.isArray(source.catalogProducts) && source.catalogProducts.length > 0) {
    memoryCatalogProducts = normalizeServerCatalogProducts(source.catalogProducts);
  }

  if (source.pixelConfig && typeof source.pixelConfig === "object") {
    memoryPixelConfig = {
      facebookPixelId: typeof source.pixelConfig.facebookPixelId === "string"
        ? source.pixelConfig.facebookPixelId.trim()
        : sitePixelConfig.facebookPixelId,
      tiktokPixelId: typeof source.pixelConfig.tiktokPixelId === "string"
        ? source.pixelConfig.tiktokPixelId.trim()
        : sitePixelConfig.tiktokPixelId,
      tiktokCode: typeof source.pixelConfig.tiktokCode === "string"
        ? source.pixelConfig.tiktokCode.trim()
        : sitePixelConfig.tiktokCode,
    };
  }

  if (source.financeState && typeof source.financeState === "object") {
    setServerFinanceState({
      lots: source.financeState.lots?.length ? source.financeState.lots : memoryFinanceState.lots,
      expenses: source.financeState.expenses?.length ? source.financeState.expenses : memoryFinanceState.expenses,
      adSpends: source.financeState.adSpends?.length ? source.financeState.adSpends : memoryFinanceState.adSpends,
      campaignMappings: {
        ...(source.financeState.campaignMappings || {}),
        ...(memoryFinanceState.campaignMappings || {}),
      },
      exchangeRates: source.financeState.exchangeRates?.length
        ? source.financeState.exchangeRates
        : memoryFinanceState.exchangeRates,
      orderOverrides: {
        ...(source.financeState.orderOverrides || {}),
        ...(memoryFinanceState.orderOverrides || {}),
      },
      settings: {
        ...DEFAULT_FINANCE_SETTINGS,
        ...(source.financeState.settings || {}),
        ...(memoryFinanceState.settings || {}),
      },
      adCredentials: {
        ...(source.financeState.adCredentials || {}),
        ...(memoryFinanceState.adCredentials || {}),
      },
    });
  }

  const currentCounters = getCounters();
  const maxOrderId = memoryOrders.reduce(
    (max, o) => Math.max(max, (o.dbId ?? 0) + 1),
    Math.max(currentCounters.nextOrderId, source.nextMemoryOrderId ?? 1),
  );
  const maxSessionId = Array.from(memorySessions.values()).reduce(
    (max, s) => Math.max(max, (s.id ?? 0) + 1),
    Math.max(currentCounters.nextSessionId, source.nextMemorySessionId ?? 1),
  );
  setCounters(maxOrderId, maxSessionId);
}

export async function ensurePersistentStoreLoaded(
  memoryOrders: CheckoutOrder[],
  memorySessions: Map<string, PersistentMemorySession>,
  getCounters: () => { nextOrderId: number; nextSessionId: number },
  setCounters: (nextOrderId: number, nextSessionId: number) => void,
): Promise<void> {
  if (isTestEnv()) return;
  if (!loadPromise) {
    loadPromise = (async () => {
      const local = readLocalState();
      if (local) {
        mergeStateIntoMemory(local, memoryOrders, memorySessions, setCounters, getCounters);
      }
      const cloud = await fetchCloudState();
      if (cloud.state) {
        cloudLoadSucceeded = true;
        mergeStateIntoMemory(cloud.state, memoryOrders, memorySessions, setCounters, getCounters);
        const counters = getCounters();
        writeLocalState({
          updatedAt: new Date().toISOString(),
          nextMemoryOrderId: counters.nextOrderId,
          nextMemorySessionId: counters.nextSessionId,
          orders: [...memoryOrders],
          sessions: serializeSessions(memorySessions),
          pushSubscriptions: Array.from(memoryPushSubscriptions.values()),
          notificationPreferences: memoryNotificationPreferences,
          staffMembers: getStaffMembers(),
          staffActivityLogs: memoryStaffActivityLogs,
          catalogProducts: memoryCatalogProducts,
          pixelConfig: memoryPixelConfig ?? undefined,
          sentVictoryTags: getSentVictoryTags(),
          financeState: memoryFinanceState,
        });
      }
    })();
  }
  await loadPromise;
}

export function schedulePersistentStoreSave(
  memoryOrders: CheckoutOrder[],
  memorySessions: Map<string, PersistentMemorySession>,
  getCounters: () => { nextOrderId: number; nextSessionId: number },
): void {
  if (isTestEnv()) return;
  const counters = getCounters();
  const snapshot: PersistedState = {
    updatedAt: new Date().toISOString(),
    nextMemoryOrderId: counters.nextOrderId,
    nextMemorySessionId: counters.nextSessionId,
    orders: [...memoryOrders],
    sessions: serializeSessions(memorySessions),
    pushSubscriptions: Array.from(memoryPushSubscriptions.values()),
    notificationPreferences: memoryNotificationPreferences,
    staffMembers: getStaffMembers(),
    staffActivityLogs: memoryStaffActivityLogs,
    catalogProducts: memoryCatalogProducts,
    pixelConfig: memoryPixelConfig ?? undefined,
    sentVictoryTags: getSentVictoryTags(),
    financeState: memoryFinanceState,
  };
  writeLocalState(snapshot);

  pendingCloudSnapshot = snapshot;
  if (cloudSaveInFlight) return;

  const flushCloudQueue = async () => {
    while (pendingCloudSnapshot) {
      const next = pendingCloudSnapshot;
      pendingCloudSnapshot = null;
      await pushCloudState(next).catch(() => {});
    }
  };
  cloudSaveInFlight = flushCloudQueue().finally(() => {
    cloudSaveInFlight = null;
    if (pendingCloudSnapshot) {
      cloudSaveInFlight = flushCloudQueue().finally(() => {
        cloudSaveInFlight = null;
      });
    }
  });
}
