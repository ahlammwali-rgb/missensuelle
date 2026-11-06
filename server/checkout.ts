import { createHash, randomBytes } from "node:crypto";
import type { Express, Request, Response } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { products } from "../client/src/lib/store-data";
import {
  storeCheckoutSessions,
  storeOrderItems,
  storeOrders,
  storeProducts,
  type StoreProduct,
} from "../drizzle/schema";
import {
  checkoutPayloadSchema,
  discardDraftSchema,
  recoveryStatusSchema,
  saveDraftSchema,
  submitOrderSchema,
  updateOrderDetailsSchema,
  type AbandonedCheckout,
  type CheckoutOrder,
  type CheckoutPayload,
  type DiscardDraftInput,
  type SaveDraftInput,
  type SubmitOrderInput,
  type SubmitOrderResult,
  type UpdateOrderDetailsInput,
} from "../shared/checkout";
import { getDb } from "./db";
import { computeShippingFee } from "./ecomDelivery";
import { importGoogleSheetToOrders, pushOrderToGoogleSheet } from "./googleSheet";
import {
  ensurePersistentStoreLoaded,
  schedulePersistentStoreSave,
} from "./persistentStore";

const APPROVED_BASELINE_IDS = new Set(products.map(product => product.id));
const canonicalProducts = new Map(products.map(product => [product.id, product]));
const canonicalSlugs = new Map(products.map(product => [product.slug, product]));
const TEN_MINUTES = 10 * 60 * 1000;

type MemorySession = {
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
const memorySessions = new Map<string, MemorySession>();
const memoryOrders: CheckoutOrder[] = [];
let nextMemorySessionId = 1;
let nextMemoryOrderId = 1;

const getCounters = () => ({
  nextOrderId: nextMemoryOrderId,
  nextSessionId: nextMemorySessionId,
});
const setCounters = (nextOrderId: number, nextSessionId: number) => {
  nextMemoryOrderId = nextOrderId;
  nextMemorySessionId = nextSessionId;
};
const loadStore = async () => {
  await ensurePersistentStoreLoaded(memoryOrders, memorySessions, getCounters, setCounters);
  for (const o of memoryOrders) {
    if (o.size === "L" && (o.product.includes("EXTENTION") || o.id.startsWith("MS-GS-") || o.id.startsWith("MS-TT-"))) {
      o.size = "";
    }
    if (o.total === 7500 && (o.id.startsWith("MS-GS-") || o.id.startsWith("MS-TT-") || o.product.includes("EXTENTION"))) {
      o.total = 0;
    }
  }
};
const saveStore = () =>
  schedulePersistentStoreSave(memoryOrders, memorySessions, getCounters);
void loadStore();

export function updateMemoryOrderStatus(id: number, status: CheckoutOrder["status"]) {
  const found = memoryOrders.find(order => order.dbId === id);
  if (found) {
    found.status = status;
    saveStore();
  }
  return found ? [found] : [];
}

export function markMemoryOrderReturn(id: number, returnReceived: boolean = true) {
  const found = memoryOrders.find(order => order.dbId === id);
  if (found) {
    found.returnReceived = returnReceived;
    found.returnReceivedAt = returnReceived ? new Date().toISOString() : undefined;
    saveStore();
  }
  return found ? [found] : [];
}

export async function restoreClientBackupOrders(orders: Array<Partial<CheckoutOrder>>) {
  await loadStore();
  let added = 0;
  const existingIds = new Set(memoryOrders.map(o => o.id));
  for (const raw of orders) {
    if (!raw || !raw.id || raw.id === "MS-MW14EHHP-B39BD62352" || existingIds.has(raw.id)) continue;
    const dbId = nextMemoryOrderId++;
    memoryOrders.push({
      dbId,
      id: String(raw.id),
      createdAt: String(raw.createdAt || new Date().toISOString()),
      customer: String(raw.customer || "Cliente Miss Sensuelle"),
      phone: String(raw.phone || ""),
      productId: String(raw.productId || "p-007"),
      product: String(raw.product || "Abaya Royal Emerald × 1"),
      quantity: Number(raw.quantity || 1),
      total: Number(raw.total || 9600),
      color: String(raw.color || ""),
      size: String(raw.size || ""),
      delivery: raw.delivery === "office" ? "office" : "home",
      wilaya: String(raw.wilaya || ""),
      commune: String(raw.commune || ""),
      address: String(raw.address || ""),
      note: String(raw.note || ""),
      status: raw.status || "nouvelle",
    });
    existingIds.add(raw.id);
    added++;
  }
  if (added > 0) {
    memoryOrders.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    saveStore();
  }
  return { restored: added, total: memoryOrders.length };
}

export async function syncGoogleSheetOrders(sheetUrl?: string) {
  await loadStore();
  const result = await importGoogleSheetToOrders(
    memoryOrders,
    saveStore,
    () => nextMemoryOrderId++,
    sheetUrl
  );
  return result;
}

let sheetAutoSyncTimer: NodeJS.Timeout | null = null;

export function startGoogleSheetAutoSync(intervalMs = 45000) {
  if (sheetAutoSyncTimer) return;
  console.log(`[GoogleSheet] Background auto-sync started (every ${intervalMs / 1000}s)`);
  setTimeout(() => {
    syncGoogleSheetOrders()
      .then(res => {
        if (res.added > 0) {
          console.log(`[GoogleSheet] Auto-sync imported ${res.added} orders`);
        }
      })
      .catch(() => {});
  }, 4000);

  sheetAutoSyncTimer = setInterval(() => {
    syncGoogleSheetOrders()
      .then(res => {
        if (res.added > 0) {
          console.log(`[GoogleSheet] Auto-sync imported ${res.added} orders`);
        }
      })
      .catch(() => {});
  }, intervalMs);
}

export async function updateCheckoutOrderDetails(input: UpdateOrderDetailsInput) {
  const parsed = updateOrderDetailsSchema.parse(input);
  const db = await getDb();
  if (!db) {
    await loadStore();
    const found = memoryOrders.find(order => order.dbId === parsed.id);
    if (!found) throw new CheckoutValidationError("Commande introuvable");
    found.customer = parsed.customer;
    found.phone = parsed.phone;
    if (parsed.productId) found.productId = parsed.productId;
    found.product = parsed.product;
    found.quantity = parsed.quantity;
    found.total = parsed.total;
    found.color = parsed.color;
    found.size = parsed.size;
    found.delivery = parsed.delivery;
    found.wilaya = parsed.wilaya;
    found.commune = parsed.commune;
    found.address = parsed.address;
    found.note = parsed.note;
    saveStore();
    return found;
  }
  await db.transaction(async tx => {
    await tx.update(storeOrders).set({
      customerName: parsed.customer,
      phone: parsed.phone,
      wilaya: parsed.wilaya,
      commune: parsed.commune,
      address: parsed.address,
      note: parsed.note || null,
      total: parsed.total,
    }).where(eq(storeOrders.id, parsed.id));

    const existingItems = await tx.select().from(storeOrderItems).where(eq(storeOrderItems.orderId, parsed.id));
    if (existingItems.length > 0) {
      const unitPrice = Math.round(parsed.total / Math.max(1, parsed.quantity));
      await tx.update(storeOrderItems).set({
        productName: parsed.product.replace(/\s*×\s*\d+$/, ""),
        quantity: parsed.quantity,
        unitPrice,
      }).where(eq(storeOrderItems.id, existingItems[0].id));
    }

    const sessions = await tx.select().from(storeCheckoutSessions).where(eq(storeCheckoutSessions.orderId, parsed.id));
    if (sessions[0]?.payload) {
      const oldPayload = checkoutPayloadSchema.safeParse(sessions[0].payload);
      if (oldPayload.success) {
        const nextPayload: CheckoutPayload = {
          ...oldPayload.data,
          customer: parsed.customer,
          phone: parsed.phone,
          wilaya: parsed.wilaya,
          commune: parsed.commune,
          address: parsed.address,
          note: parsed.note,
          delivery: parsed.delivery,
          items: oldPayload.data.items.map((item, idx) => idx === 0 ? {
            ...item,
            productId: parsed.productId || item.productId,
            quantity: parsed.quantity,
            color: parsed.color,
            size: parsed.size,
          } : item),
        };
        await tx.update(storeCheckoutSessions).set({ payload: nextPayload, updatedAt: new Date() })
          .where(eq(storeCheckoutSessions.id, sessions[0].id));
      }
    }
  });
  const all = await listCheckoutOrders();
  return all.find(o => o.dbId === parsed.id) ?? null;
}

export class CheckoutValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "CheckoutValidationError";
  }
}

function validationMessage(error: unknown) {
  if (error && typeof error === "object" && "issues" in error) {
    const issue = (error as { issues?: Array<{ message?: string }> }).issues?.[0];
    if (issue?.message) return issue.message;
  }
  return "Données de commande invalides";
}

function parsePayload(input: unknown): CheckoutPayload {
  const result = checkoutPayloadSchema.safeParse(input);
  if (!result.success) throw new CheckoutValidationError(validationMessage(result.error));
  return result.data;
}

function normalizePhone(phone: string) {
  return phone.replace(/[ .()\-]/g, "");
}

/** Shared payload validation used by both tRPC and the three HTTP handlers. */
export function validateFullCheckoutPayload(input: unknown): CheckoutPayload {
  const payload = parsePayload(input);
  const phone = normalizePhone(payload.phone);
  if (!payload.customer) throw new CheckoutValidationError("Le nom est obligatoire");
  if (!phone || !/^(?:\+213|0)[567]\d{8}$/.test(phone)) {
    throw new CheckoutValidationError("Numéro de téléphone algérien invalide");
  }
  if (!payload.wilaya) throw new CheckoutValidationError("La wilaya est obligatoire");
  if (!payload.commune) throw new CheckoutValidationError("La commune est obligatoire");
  for (const item of payload.items) {
    if ((payload.source === "abaya" || payload.source === "coat") && (!item.size || !item.color)) {
      throw new CheckoutValidationError("La taille et la couleur sont obligatoires");
    }
  }
  return { ...payload, phone };
}

function hasMeaningfulPartialInput(payload: CheckoutPayload) {
  return [payload.customer, payload.phone, payload.wilaya, payload.commune, payload.address, payload.note]
    .some(value => value.trim().length > 0)
    || payload.items.some(item => item.color.trim().length > 0 || item.size.trim().length > 0);
}

function tokenHash(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function requireDatabase() {
  return getDb().then(db => {
    if (!db) throw new Error("Database is not available");
    return db;
  });
}

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Transaction = Database extends { transaction: (fn: infer F) => unknown }
  ? F extends (tx: infer T) => unknown ? T : never
  : never;

function getCanonicalProduct(productId: string) {
  return canonicalProducts.get(productId) ?? canonicalSlugs.get(productId);
}

async function ensureApprovedBaseline(tx: Transaction, productId: string) {
  const canonical = getCanonicalProduct(productId);
  if (!canonical || !APPROVED_BASELINE_IDS.has(canonical.id)) return;
  const existing = await tx.select().from(storeProducts).where(eq(storeProducts.slug, canonical.slug)).limit(1);
  if (existing.length > 0) return;
  await tx.insert(storeProducts).values({
    slug: canonical.slug,
    name: canonical.name,
    category: canonical.category,
    categoryLabel: canonical.categoryLabel,
    description: canonical.description,
    image: canonical.image,
    price: canonical.price,
    oldPrice: canonical.oldPrice ?? null,
    stock: canonical.stock,
    isActive: 1,
  });
}

async function resolveProducts(tx: Transaction, payload: CheckoutPayload) {
  const resolved: Array<{ item: CheckoutPayload["items"][number]; product: StoreProduct }> = [];
  for (const item of payload.items) {
    const canonical = getCanonicalProduct(item.productId);
    if (canonical && APPROVED_BASELINE_IDS.has(canonical.id)) await ensureApprovedBaseline(tx, canonical.id);
    const slug = canonical?.slug ?? item.productId;
    const rows = await tx.select().from(storeProducts).where(and(eq(storeProducts.slug, slug), eq(storeProducts.isActive, 1))).limit(1);
    const product = rows[0];
    if (!product) throw new CheckoutValidationError("Produit indisponible ou inconnu");
    resolved.push({ item, product });
  }
  return resolved;
}

function orderNumber() {
  return `MS-${Date.now().toString(36).toUpperCase()}-${randomBytes(5).toString("hex").toUpperCase()}`;
}

function sessionOrderResult(order: { id: number; orderNumber: string; total: number }): SubmitOrderResult {
  return { orderId: order.id, orderNumber: order.orderNumber, total: order.total, created: false };
}

export async function saveCheckoutDraft(input: SaveDraftInput): Promise<{ sessionId: number; accepted: boolean }> {
  const parsed = saveDraftSchema.safeParse(input);
  if (!parsed.success) throw new CheckoutValidationError(validationMessage(parsed.error));
  const { token, revision, consent, payload } = parsed.data;
  if (!consent) throw new CheckoutValidationError("Le consentement est obligatoire");
  if (!hasMeaningfulPartialInput(payload)) return { sessionId: 0, accepted: false };
  const hash = tokenHash(token);
  const db = await getDb();
  if (!db) {
    await loadStore();
    const current = memorySessions.get(hash);
    const now = new Date();
    if (current) {
      // A draft purged for lacking a phone number comes back to life as soon as the visitor keeps typing.
      if (current.state === "purged" && revision > current.revision) {
        current.state = "draft";
        current.consentedAt = null;
      }
      if (current.state !== "draft" || revision <= current.revision) return { sessionId: current.id, accepted: false };
      current.payload = payload;
      current.revision = revision;
      current.consentedAt = current.consentedAt ?? now;
      current.updatedAt = now;
      saveStore();
      return { sessionId: current.id, accepted: true };
    }
    const created: MemorySession = {
      id: nextMemorySessionId++,
      tokenHash: hash,
      state: "draft",
      payload,
      revision,
      orderId: null,
      recoveryStatus: "new",
      consentedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    memorySessions.set(hash, created);
    saveStore();
    return { sessionId: created.id, accepted: true };
  }
  return db.transaction(async tx => {
    const locked = await tx.select().from(storeCheckoutSessions).where(eq(storeCheckoutSessions.tokenHash, hash)).for("update");
    const current = locked[0];
    if (current) {
      if (current.state !== "draft" || revision <= current.revision) return { sessionId: current.id, accepted: false };
      await tx.update(storeCheckoutSessions).set({
        payload,
        revision,
        consentedAt: current.consentedAt ?? new Date(),
        updatedAt: new Date(),
      }).where(eq(storeCheckoutSessions.id, current.id));
      return { sessionId: current.id, accepted: true };
    }
    const result = await tx.insert(storeCheckoutSessions).values({
      tokenHash: hash,
      state: "draft",
      payload,
      revision,
      consentedAt: new Date(),
    });
    return { sessionId: Number(result[0].insertId), accepted: true };
  });
}

function computeLineTotal(slugOrId: string, unitPrice: number, quantity: number) {
  if ((slugOrId === "p-008" || slugOrId === "doudoune-hiver-luxe") && quantity === 2) {
    return 12900;
  }
  return unitPrice * quantity;
}

export async function submitCheckoutOrder(input: SubmitOrderInput): Promise<SubmitOrderResult> {
  const parsed = submitOrderSchema.safeParse(input);
  if (!parsed.success) throw new CheckoutValidationError(validationMessage(parsed.error));
  const payload = validateFullCheckoutPayload(parsed.data.payload);
  const hash = tokenHash(parsed.data.token);
  const db = await getDb();
  if (!db) {
    await loadStore();
    const current = memorySessions.get(hash);
    if (current?.state === "discarded") throw new CheckoutValidationError("Cette session a été annulée");
    if (current?.state === "submitted" && current.orderId) {
      const existing = memoryOrders.find(o => o.dbId === current.orderId);
      if (existing) return sessionOrderResult({ id: existing.dbId, orderNumber: existing.id, total: existing.total });
    }
    // Deduplication guard: block rapid duplicate submissions for the same customer/phone within 60s
    const cleanPhone = payload.phone.replace(/[\s\-\.]/g, "").replace(/^(\+213|00213)/, "0");
    const recentCutoff = Date.now() - 60 * 1000;
    const targetProductId = payload.items[0]?.productId;
    const existingRecent = memoryOrders.find(o => {
      const orderTime = new Date(o.createdAt).getTime();
      if (orderTime < recentCutoff) return false;
      const oPhone = o.phone.replace(/[\s\-\.]/g, "").replace(/^(\+213|00213)/, "0");
      return oPhone === cleanPhone && (!targetProductId || o.productId === targetProductId);
    });
    if (existingRecent) {
      return sessionOrderResult({ id: existingRecent.dbId, orderNumber: existingRecent.id, total: existingRecent.total });
    }
    const resolved = payload.items.map(item => {
      const product = getCanonicalProduct(item.productId);
      if (!product) throw new CheckoutValidationError("Produit indisponible ou inconnu");
      return { item, product };
    });
    const shippingFee = await computeShippingFee(payload);
    const total = shippingFee + resolved.reduce((sum, row) => sum + computeLineTotal(row.product.id, row.product.price, row.item.quantity), 0);
    const number = orderNumber();
    const orderId = nextMemoryOrderId++;
    const now = new Date();
    memoryOrders.unshift({
      dbId: orderId,
      id: number,
      createdAt: now.toISOString(),
      customer: payload.customer,
      phone: payload.phone,
      productId: resolved[0]?.product.id ?? payload.items[0]?.productId ?? "p-007",
      product: resolved.map(({ item, product }) => `${product.name} × ${item.quantity}`).join(", "),
      quantity: resolved.reduce((sum, { item }) => sum + item.quantity, 0),
      total,
      color: payload.items.map(item => item.color).filter(Boolean).join(", "),
      size: payload.items.map(item => item.size).filter(Boolean).join(", "),
      delivery: payload.delivery,
      wilaya: payload.wilaya,
      commune: payload.commune,
      address: payload.address,
      note: payload.note ?? "",
      status: "nouvelle",
    });
    if (current) {
      current.state = "submitted";
      current.payload = payload;
      current.orderId = orderId;
      current.updatedAt = now;
    } else {
      memorySessions.set(hash, {
        id: nextMemorySessionId++,
        tokenHash: hash,
        state: "submitted",
        payload,
        revision: 0,
        orderId,
        recoveryStatus: "new",
        consentedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
    saveStore();
    return { orderId, orderNumber: number, total, created: true };
  }
  return db.transaction(async tx => {
    const locked = await tx.select().from(storeCheckoutSessions).where(eq(storeCheckoutSessions.tokenHash, hash)).for("update");
    const current = locked[0];
    if (current?.state === "discarded") throw new CheckoutValidationError("Cette session a été annulée");
    if (current?.state === "submitted" && current.orderId) {
      const existing = await tx.select({ id: storeOrders.id, orderNumber: storeOrders.orderNumber, total: storeOrders.total })
        .from(storeOrders).where(eq(storeOrders.id, current.orderId)).limit(1);
      if (existing[0]) return sessionOrderResult(existing[0]);
    }

    const resolved = await resolveProducts(tx, payload);
    const shippingFee = await computeShippingFee(payload);
    const total = shippingFee + resolved.reduce((sum, row) => sum + computeLineTotal(row.product.slug, row.product.price, row.item.quantity), 0);
    const number = orderNumber();
    const orderInsert = await tx.insert(storeOrders).values({
      orderNumber: number,
      customerName: payload.customer,
      phone: payload.phone,
      wilaya: payload.wilaya,
      commune: payload.commune,
      address: payload.address,
      note: payload.note || null,
      total,
      status: "nouvelle",
    });
    const orderId = Number(orderInsert[0].insertId);
    await tx.insert(storeOrderItems).values(resolved.map(({ item, product }) => ({
      orderId,
      productId: product.id,
      productName: product.name,
      unitPrice: product.price,
      quantity: item.quantity,
    })));

    if (current) {
      await tx.update(storeCheckoutSessions).set({
        state: "submitted",
        payload,
        orderId,
        updatedAt: new Date(),
      }).where(eq(storeCheckoutSessions.id, current.id));
    } else {
      await tx.insert(storeCheckoutSessions).values({
        tokenHash: hash,
        state: "submitted",
        payload,
        revision: 0,
        orderId,
        consentedAt: new Date(),
      });
    }
    return { orderId, orderNumber: number, total, created: true };
  });
}

export async function discardCheckoutDraft(input: DiscardDraftInput): Promise<{ discarded: boolean }> {
  const parsed = discardDraftSchema.safeParse(input);
  if (!parsed.success) throw new CheckoutValidationError(validationMessage(parsed.error));
  const hash = tokenHash(parsed.data.token);
  const db = await getDb();
  if (!db) {
    await loadStore();
    const current = memorySessions.get(hash);
    if (!current || current.state !== "draft" || parsed.data.revision < current.revision) return { discarded: false };
    current.state = "discarded";
    current.payload = null;
    current.consentedAt = null;
    current.updatedAt = new Date();
    saveStore();
    return { discarded: true };
  }
  return db.transaction(async tx => {
    const locked = await tx.select().from(storeCheckoutSessions).where(eq(storeCheckoutSessions.tokenHash, hash)).for("update");
    const current = locked[0];
    if (!current || current.state !== "draft" || parsed.data.revision < current.revision) return { discarded: false };
    await tx.update(storeCheckoutSessions).set({ state: "discarded", payload: null, consentedAt: null, updatedAt: new Date() })
      .where(eq(storeCheckoutSessions.id, current.id));
    return { discarded: true };
  });
}

function iso(value: Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function listCheckoutOrders(): Promise<CheckoutOrder[]> {
  const db = await getDb();
  if (!db) {
    await loadStore();
    return [...memoryOrders];
  }
  const orders = await db.select().from(storeOrders).orderBy(desc(storeOrders.createdAt));
  if (!orders.length) return [];
  const orderIds = orders.map(order => order.id);
  const items = await db.select().from(storeOrderItems).where(inArray(storeOrderItems.orderId, orderIds));
  const sessions = await db.select().from(storeCheckoutSessions).where(inArray(storeCheckoutSessions.orderId, orderIds));
  const byOrder = new Map<number, typeof items>();
  for (const item of items) byOrder.set(item.orderId, [...(byOrder.get(item.orderId) ?? []), item]);
  const sessionByOrder = new Map<number, CheckoutPayload>();
  for (const s of sessions) {
    if (s.orderId && s.payload) {
      const parsed = checkoutPayloadSchema.safeParse(s.payload);
      if (parsed.success) sessionByOrder.set(s.orderId, parsed.data);
    }
  }
  return orders.map(order => {
    const orderItems = byOrder.get(order.id) ?? [];
    const payload = sessionByOrder.get(order.id);
    return {
      dbId: order.id,
      id: order.orderNumber,
      createdAt: iso(order.createdAt),
      customer: order.customerName,
      phone: order.phone,
      productId: payload?.items[0]?.productId ?? "p-007",
      product: orderItems.map(item => `${item.productName} × ${item.quantity}`).join(", "),
      quantity: orderItems.reduce((sum, item) => sum + item.quantity, 0),
      total: order.total,
      color: payload?.items.map(i => i.color).filter(Boolean).join(", ") ?? "",
      size: payload?.items.map(i => i.size).filter(Boolean).join(", ") ?? "",
      delivery: payload?.delivery ?? "home",
      wilaya: order.wilaya,
      commune: order.commune,
      address: order.address,
      note: order.note ?? "",
      status: order.status,
    };
  });
}

const hasPhone = (phone: string | undefined | null) => /\d/.test(phone ?? "");

/** Drafts that never received a phone number are useless for recovery: purge them (and hide fresh ones). */
export async function purgeAbandonedWithoutPhone(maxAgeMs = TEN_MINUTES) {
  const db = await getDb();
  const now = Date.now();
  if (!db) {
    await loadStore();
    let purged = 0;
    for (const session of memorySessions.values()) {
      if (session.state !== "draft" || (session.payload && hasPhone(session.payload.phone))) continue;
      if (now - session.updatedAt.getTime() < maxAgeMs) continue;
      session.state = "purged";
      session.payload = null;
      session.consentedAt = null;
      purged++;
    }
    if (purged) saveStore();
    return { purged };
  }
  const drafts = await db.select().from(storeCheckoutSessions).where(eq(storeCheckoutSessions.state, "draft"));
  let purged = 0;
  for (const session of drafts) {
    const parsed = session.payload ? checkoutPayloadSchema.safeParse(session.payload) : null;
    if (parsed?.success && hasPhone(parsed.data.phone)) continue;
    if (now - new Date(session.updatedAt).getTime() < maxAgeMs) continue;
    await db.update(storeCheckoutSessions).set({ state: "discarded", payload: null, consentedAt: null, updatedAt: new Date() })
      .where(eq(storeCheckoutSessions.id, session.id));
    purged++;
  }
  return { purged };
}

/** Turn an abandoned draft into a real order (lenient: missing optional fields stay empty). */
export async function convertAbandonedToOrder(id: number): Promise<{ orderNumber: string; total: number }> {
  const db = await getDb();
  if (!db) {
    await loadStore();
    const session = Array.from(memorySessions.values()).find(s => s.id === id && s.state === "draft" && s.payload);
    if (!session || !session.payload) throw new CheckoutValidationError("Brouillon introuvable ou déjà transféré");
    const payload = session.payload;
    if (!hasPhone(payload.phone)) throw new CheckoutValidationError("Impossible : aucun numéro de téléphone");
    const shippingFee = await computeShippingFee(payload);
    const rows = payload.items.map(item => ({ item, product: getCanonicalProduct(item.productId) }));
    const total = shippingFee + rows.reduce((sum, { item, product }) => sum + (product ? computeLineTotal(product.id, product.price, item.quantity) : 0), 0);
    const number = orderNumber();
    const orderId = nextMemoryOrderId++;
    const now = new Date();
    memoryOrders.unshift({
      dbId: orderId,
      id: number,
      createdAt: now.toISOString(),
      customer: payload.customer || "Cliente",
      phone: normalizePhone(payload.phone),
      productId: rows[0]?.product?.id ?? payload.items[0]?.productId ?? "p-007",
      product: rows.map(({ item, product }) => `${product?.name ?? item.productId} × ${item.quantity}`).join(", "),
      quantity: rows.reduce((sum, { item }) => sum + item.quantity, 0),
      total,
      color: payload.items.map(item => item.color).filter(Boolean).join(", "),
      size: payload.items.map(item => item.size).filter(Boolean).join(", "),
      delivery: payload.delivery,
      wilaya: payload.wilaya,
      commune: payload.commune,
      address: payload.address,
      note: [payload.note, "(transférée depuis commande abandonnée)"].filter(Boolean).join(" "),
      status: "nouvelle",
    });
    session.state = "submitted";
    session.orderId = orderId;
    session.updatedAt = now;
    saveStore();
    return { orderNumber: number, total };
  }
  return db.transaction(async tx => {
    const locked = await tx.select().from(storeCheckoutSessions).where(eq(storeCheckoutSessions.id, id)).for("update");
    const session = locked[0];
    const parsed = session?.state === "draft" && session.payload ? checkoutPayloadSchema.safeParse(session.payload) : null;
    if (!session || !parsed?.success) throw new CheckoutValidationError("Brouillon introuvable ou déjà transféré");
    const payload = parsed.data;
    if (!hasPhone(payload.phone)) throw new CheckoutValidationError("Impossible : aucun numéro de téléphone");
    const resolved = await resolveProducts(tx, payload);
    const shippingFee = await computeShippingFee(payload);
    const total = shippingFee + resolved.reduce((sum, row) => sum + computeLineTotal(row.product.slug, row.product.price, row.item.quantity), 0);
    const number = orderNumber();
    const orderInsert = await tx.insert(storeOrders).values({
      orderNumber: number,
      customerName: payload.customer || "Cliente",
      phone: normalizePhone(payload.phone),
      wilaya: payload.wilaya,
      commune: payload.commune,
      address: payload.address,
      note: [payload.note, "(transférée depuis commande abandonnée)"].filter(Boolean).join(" "),
      total,
      status: "nouvelle",
    });
    const orderId = Number(orderInsert[0].insertId);
    await tx.insert(storeOrderItems).values(resolved.map(({ item, product }) => ({
      orderId,
      productId: product.id,
      productName: product.name,
      unitPrice: product.price,
      quantity: item.quantity,
    })));
    await tx.update(storeCheckoutSessions).set({ state: "submitted", orderId, updatedAt: new Date() })
      .where(eq(storeCheckoutSessions.id, session.id));
    return { orderNumber: number, total };
  });
}

export async function listAbandonedCheckouts(): Promise<AbandonedCheckout[]> {
  await purgeAbandonedWithoutPhone().catch(() => undefined);
  const db = await getDb();
  if (!db) {
    await loadStore();
    const now = Date.now();
    return Array.from(memorySessions.values())
      .filter(session => session.state === "draft" && session.payload && hasPhone(session.payload.phone))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map(session => {
        const payload = session.payload!;
        const rows = payload.items.map(item => ({ item, product: getCanonicalProduct(item.productId) }));
        return {
          id: session.id,
          createdAt: iso(session.createdAt),
          updatedAt: iso(session.updatedAt),
          customer: payload.customer,
          phone: payload.phone,
          product: rows.map(row => row.product?.name ?? row.item.productId).join(", "),
          quantity: rows.reduce((sum, row) => sum + row.item.quantity, 0),
          total: rows.reduce((sum, row) => sum + (row.product?.price ?? 0) * row.item.quantity, 0),
          wilaya: payload.wilaya,
          commune: payload.commune,
          address: payload.address,
          note: payload.note,
          color: payload.items.map(item => item.color).filter(Boolean).join(", "),
          size: payload.items.map(item => item.size).filter(Boolean).join(", "),
          delivery: payload.delivery,
          activity: now - session.updatedAt.getTime() >= TEN_MINUTES ? "abandoned" : "in_progress",
          recoveryStatus: session.recoveryStatus,
        } satisfies AbandonedCheckout;
      });
  }
  const sessions = await db.select().from(storeCheckoutSessions)
    .where(eq(storeCheckoutSessions.state, "draft")).orderBy(desc(storeCheckoutSessions.updatedAt));
  if (!sessions.length) return [];
  const catalog = await db.select().from(storeProducts).where(eq(storeProducts.isActive, 1));
  const bySlug = new Map(catalog.map(product => [product.slug, product]));
  const now = Date.now();
  return sessions.flatMap(session => {
    const parsed = session.payload ? checkoutPayloadSchema.safeParse(session.payload) : null;
    if (!parsed?.success || !hasPhone(parsed.data.phone)) return [];
    const payload = parsed.data;
    const rows = payload.items.map(item => {
      const canonical = getCanonicalProduct(item.productId);
      const product = bySlug.get(canonical?.slug ?? item.productId);
      return { item, product };
    });
    const product = rows.map(row => row.product?.name ?? row.item.productId).join(", ");
    const quantity = rows.reduce((sum, row) => sum + row.item.quantity, 0);
    const total = rows.reduce((sum, row) => sum + (row.product?.price ?? 0) * row.item.quantity, 0);
    return [{
      id: session.id,
      createdAt: iso(session.createdAt),
      updatedAt: iso(session.updatedAt),
      customer: payload.customer,
      phone: payload.phone,
      product,
      quantity,
      total,
      wilaya: payload.wilaya,
      commune: payload.commune,
      address: payload.address,
      note: payload.note,
      color: payload.items.map(item => item.color).filter(Boolean).join(", "),
      size: payload.items.map(item => item.size).filter(Boolean).join(", "),
      delivery: payload.delivery,
      activity: now - new Date(session.updatedAt).getTime() >= TEN_MINUTES ? "abandoned" : "in_progress",
      recoveryStatus: session.recoveryStatus,
    } satisfies AbandonedCheckout];
  });
}

export async function updateAbandonedCheckout(id: number, recoveryStatus: AbandonedCheckout["recoveryStatus"]) {
  const parsed = recoveryStatusSchema.safeParse(recoveryStatus);
  if (!Number.isInteger(id) || id <= 0 || !parsed.success) throw new CheckoutValidationError("Statut d'abandon invalide");
  const db = await getDb();
  if (!db) {
    await loadStore();
    for (const session of memorySessions.values()) {
      if (session.id === id && session.state === "draft") {
        session.recoveryStatus = parsed.data;
        session.updatedAt = new Date();
      }
    }
    saveStore();
    return { updated: true };
  }
  await db.update(storeCheckoutSessions).set({ recoveryStatus: parsed.data, updatedAt: new Date() })
    .where(and(eq(storeCheckoutSessions.id, id), eq(storeCheckoutSessions.state, "draft")));
  return { updated: true };
}

export async function deleteAbandonedCheckout(id: number) {
  if (!Number.isInteger(id) || id <= 0) throw new CheckoutValidationError("ID d'abandon invalide");
  const db = await getDb();
  if (!db) {
    await loadStore();
    for (const [hash, session] of memorySessions.entries()) {
      if (session.id === id) {
        session.state = "discarded";
        memorySessions.delete(hash);
      }
    }
    saveStore();
    return { deleted: true };
  }
  await db.update(storeCheckoutSessions).set({ state: "discarded", updatedAt: new Date() })
    .where(and(eq(storeCheckoutSessions.id, id), eq(storeCheckoutSessions.state, "draft")));
  return { deleted: true };
}

export async function deleteAllAbandonedCheckouts() {
  const db = await getDb();
  if (!db) {
    await loadStore();
    let count = 0;
    for (const [hash, session] of memorySessions.entries()) {
      if (session.state === "draft") {
        session.state = "discarded";
        memorySessions.delete(hash);
        count++;
      }
    }
    saveStore();
    return { deleted: count };
  }
  await db.update(storeCheckoutSessions).set({ state: "discarded", updatedAt: new Date() })
    .where(eq(storeCheckoutSessions.state, "draft"));
  return { deleted: true };
}

function requestIp(req: Request) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function crossSiteRequest(req: Request) {
  const value = req.get("Sec-Fetch-Site");
  return !!value && !["same-origin", "same-site", "none"].includes(value.toLowerCase());
}

function httpError(error: unknown) {
  if (error instanceof CheckoutValidationError) return { status: error.status, message: error.message };
  return { status: 500, message: "Une erreur serveur est survenue" };
}

/** Register only the three public, consent-aware checkout endpoints. */
export function registerCheckoutHttpRoutes(app: Express) {
  const buckets = new Map<string, { start: number; count: number }>();
  const limited = (req: Request) => {
    const key = requestIp(req);
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || now - bucket.start >= 60_000) {
      buckets.set(key, { start: now, count: 1 });
      return false;
    }
    bucket.count += 1;
    return bucket.count > 60;
  };
  const route = (handler: (req: Request) => Promise<unknown>) => async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    if (crossSiteRequest(req)) return res.status(403).json({ error: "Requête cross-site refusée" });
    if (limited(req)) return res.status(429).json({ error: "Trop de requêtes, réessayez plus tard" });
    try {
      return res.json(await handler(req));
    } catch (error) {
      const result = httpError(error);
      return res.status(result.status).json({ error: result.message });
    }
  };
  app.post("/api/checkout/draft", route(req => {
    const parsed = saveDraftSchema.parse(req.body);
    return saveCheckoutDraft(parsed);
  }));
  app.post("/api/checkout/order", route(req => {
    const parsed = submitOrderSchema.parse(req.body);
    return submitCheckoutOrder(parsed);
  }));
  app.post("/api/checkout/discard", route(req => {
    const parsed = discardDraftSchema.parse(req.body);
    return discardCheckoutDraft(parsed);
  }));
}
