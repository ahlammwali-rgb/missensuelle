import fs from "node:fs";
import path from "node:path";
import type { CheckoutOrder, CheckoutPayload } from "../shared/checkout";
import { shippingFeeFor, wilayaIdFromName, type ShippingRate, type ShippingRates } from "../shared/shipping";
import { getCloudToken } from "./persistentStore";

const BASE_URL = "https://ecom-dz.com/api_v2";
const CLOUD_URL = "https://api.github.com/repos/ahlammwali-rgb/missensuelle-db/contents/ecom-state.json";
const LOCAL_DIR = path.resolve(process.cwd(), ".data");
const LOCAL_FILE = path.join(LOCAL_DIR, "ecom-state.json");
const RATES_TTL = 10 * 60 * 1000;

export type EcomShipment = { tracking: string; at: string; idColis: number | null };
type EcomState = { key: string; token: string; shipments: Record<string, EcomShipment> };

export class EcomError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "EcomError";
  }
}

let state: EcomState = { key: "", token: "", shipments: {} };
let loadPromise: Promise<void> | null = null;
let ratesCache: { at: number; value: ShippingRates } | null = null;

const isTestEnv = () => Boolean(process.env.VITEST || process.env.NODE_ENV === "test");
const githubHeaders = () => ({
  Authorization: `Bearer ${getCloudToken()}`,
  "User-Agent": "missensuelle-store",
  Accept: "application/vnd.github+json",
});

async function fetchCloud(): Promise<{ state: Partial<EcomState> | null; sha: string | null }> {
  try {
    const res = await fetch(CLOUD_URL, { headers: githubHeaders() });
    if (!res.ok) return { state: null, sha: null };
    const json = (await res.json()) as { content?: string; sha?: string };
    if (!json.content) return { state: null, sha: json.sha ?? null };
    const decoded = Buffer.from(json.content.replace(/\n/g, ""), "base64").toString("utf8");
    return { state: JSON.parse(decoded) as Partial<EcomState>, sha: json.sha ?? null };
  } catch {
    return { state: null, sha: null };
  }
}

function readLocal(): Partial<EcomState> | null {
  try {
    return fs.existsSync(LOCAL_FILE) ? (JSON.parse(fs.readFileSync(LOCAL_FILE, "utf8")) as Partial<EcomState>) : null;
  } catch {
    return null;
  }
}

function mergeInto(source: Partial<EcomState> | null) {
  if (!source) return;
  if (source.key && !state.key) state.key = source.key;
  if (source.token && !state.token) state.token = source.token;
  state.shipments = { ...(source.shipments ?? {}), ...state.shipments };
}

async function loadState() {
  if (isTestEnv()) return;
  loadPromise ??= (async () => {
    mergeInto(readLocal());
    mergeInto((await fetchCloud()).state);
  })();
  await loadPromise;
}

async function saveState() {
  if (isTestEnv()) return;
  try {
    fs.mkdirSync(LOCAL_DIR, { recursive: true });
    fs.writeFileSync(LOCAL_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch {
    // ignore local FS error
  }
  try {
    const existing = await fetchCloud();
    const merged: EcomState = {
      key: state.key,
      token: state.token,
      shipments: { ...(existing.state?.shipments ?? {}), ...state.shipments },
    };
    const body: Record<string, unknown> = {
      message: "Sync E-com Delivery state",
      content: Buffer.from(JSON.stringify(merged, null, 2), "utf8").toString("base64"),
    };
    if (existing.sha) body.sha = existing.sha;
    await fetch(CLOUD_URL, {
      method: "PUT",
      headers: { ...githubHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // local state already written
  }
}

async function credentials() {
  await loadState();
  const key = process.env.ECOM_API_KEY?.trim() || state.key;
  const token = process.env.ECOM_API_TOKEN?.trim() || state.token;
  return key && token ? { key, token } : null;
}

async function ecomRequest<T>(
  endpoint: string,
  options: { method?: string; body?: unknown; query?: Record<string, string | number>; creds?: { key: string; token: string } } = {},
): Promise<T> {
  const creds = options.creds ?? (await credentials());
  if (!creds) throw new EcomError("Identifiants E-com Delivery non configurés", 400);
  const url = new URL(`${BASE_URL}${endpoint}`);
  for (const [k, v] of Object.entries(options.query ?? {})) url.searchParams.set(k, String(v));
  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? "GET",
      headers: { "X-API-Key": creds.key, "X-API-Token": creds.token, "Content-Type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new EcomError("E-com Delivery est injoignable, réessayez.", 502);
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const err = (json as { error?: { message?: string; code?: string } } | null)?.error;
    const message =
      res.status === 401 ? "Identifiants API invalides ou accès désactivé" :
      res.status === 429 ? "Quota E-com Delivery dépassé, patientez une minute" :
      err?.message || `Erreur E-com Delivery (${res.status})`;
    throw new EcomError(message, res.status);
  }
  return json as T;
}

export type EcomAccount = { id_fournisseur: number; nom_fournisseur: string; stock: boolean; colis_0da: boolean };

export async function getEcomStatus() {
  await loadState();
  const creds = await credentials();
  if (!creds) return { configured: false as const, shipments: state.shipments };
  const keyPreview = `${creds.key.slice(0, 4)}…${creds.key.slice(-3)}`;
  try {
    const account = await ecomRequest<EcomAccount>("/test", { creds });
    return { configured: true as const, keyPreview, account, error: null, shipments: state.shipments };
  } catch (error) {
    return {
      configured: true as const,
      keyPreview,
      account: null,
      error: error instanceof Error ? error.message : "Erreur inconnue",
      shipments: state.shipments,
    };
  }
}

export async function saveEcomCredentials(key: string, token: string) {
  const creds = { key: key.trim(), token: token.trim() };
  if (!creds.key || !creds.token) throw new EcomError("KEY et Token sont obligatoires");
  const account = await ecomRequest<EcomAccount>("/test", { creds }); // refuse les identifiants invalides
  await loadState();
  state.key = creds.key;
  state.token = creds.token;
  ratesCache = null;
  await saveState();
  return account;
}

export async function clearEcomCredentials() {
  await loadState();
  state.key = "";
  state.token = "";
  ratesCache = null;
  await saveState();
  return { cleared: true };
}

/** Tarifs publics (par wilaya) : mis en cache, jamais bloquants pour le formulaire client. */
export async function getShippingRates(): Promise<ShippingRates> {
  if (isTestEnv()) return { configured: false, rates: {} };
  if (ratesCache && Date.now() - ratesCache.at < RATES_TTL) return ratesCache.value;
  const creds = await credentials();
  if (!creds) return { configured: false, rates: {} };
  try {
    const data = await ecomRequest<{ wilayas: Array<{ wilaya: number; domicile: number; stopdesk: number }> }>("/tarifs", { creds });
    const rates: Record<string, ShippingRate> = {};
    for (const row of data.wilayas ?? []) rates[String(row.wilaya)] = { domicile: row.domicile, stopdesk: row.stopdesk };
    ratesCache = { at: Date.now(), value: { configured: true, rates } };
    return ratesCache.value;
  } catch {
    return ratesCache?.value ?? { configured: false, rates: {} };
  }
}

export async function computeShippingFee(payload: CheckoutPayload) {
  const { rates } = await getShippingRates();
  return shippingFeeFor(rates, payload.wilaya, payload.delivery, payload.items.map(item => item.productId));
}

export type EcomCommune = { id: number; commune: string; livrable: boolean };
export type EcomStopdesk = { code_stopdesk: string; nom_bureau: string; commune: string; adresse: string };

export async function getEcomLocations(wilayaId: number) {
  const [communes, stopdesks] = await Promise.all([
    ecomRequest<EcomCommune[]>("/communes", { query: { id_wilaya: wilayaId } }),
    ecomRequest<EcomStopdesk[]>("/stopdesks", { query: { id_wilaya: wilayaId } }).catch(() => [] as EcomStopdesk[]),
  ]);
  return {
    communes: communes.filter(c => c.livrable).map(c => c.commune),
    stopdesks: stopdesks.map(s => ({
      code: s.code_stopdesk,
      label: `${s.nom_bureau} — ${s.commune}`,
    })),
  };
}

export type ShipInput = {
  orderId: string;
  stopdesk: boolean;
  commune?: string;
  codeStopdesk?: string;
  refArticle?: string;
};
export type ShipResult = { orderId: string; ok: boolean; tracking?: string; error?: string };

type ColisRow = { index: number; ok: boolean; tracking?: string | null; id_colis?: number | null; erreur?: string | null };

export async function shipOrders(orders: CheckoutOrder[], inputs: ShipInput[], confirmee: boolean): Promise<ShipResult[]> {
  await loadState();
  const results = new Map<string, ShipResult>();
  const colis: Array<Record<string, unknown>> = [];
  const pending: string[] = [];
  const byId = new Map(orders.map(order => [order.id, order]));
  const account = await ecomRequest<EcomAccount>("/test");

  for (const input of inputs) {
    const fail = (error: string) => results.set(input.orderId, { orderId: input.orderId, ok: false, error });
    const order = byId.get(input.orderId);
    if (!order) { fail("Commande introuvable"); continue; }
    if (state.shipments[order.id]) { fail(`Déjà expédiée (${state.shipments[order.id].tracking})`); continue; }
    const wilayaId = wilayaIdFromName(order.wilaya);
    if (!wilayaId) { fail(`Wilaya non reconnue : ${order.wilaya}`); continue; }
    if (input.stopdesk ? !input.codeStopdesk : !input.commune) {
      fail(input.stopdesk ? "Choisissez le bureau stopdesk" : "Choisissez la commune E-com Delivery");
      continue;
    }
    if (account.stock && !input.refArticle?.trim()) { fail("Référence article requise (compte avec stock)"); continue; }
    const baseName = order.product.replace(/\s*×\s*\d+$/, "").trim();
    const article = [baseName, order.color, order.size].filter(Boolean).join(" - ").slice(0, 255);
    const row: Record<string, unknown> = {
      nom_complet: order.customer.slice(0, 60) || "Cliente",
      mobile_1: order.phone.replace(/[\s().\-/]/g, "").slice(0, 25),
      id_wilaya: wilayaId,
      adresse: (order.address || "").slice(0, 100),
      quantite: Math.max(1, order.quantity || 1),
      total: Math.max(0, Math.round(order.total)),
      stopdesk: input.stopdesk ? 1 : 0,
      note_fournisseur: [order.note, order.id].filter(Boolean).join(" | ").slice(0, 255),
      id_externe: order.id.replace(/^MS-/, "").slice(0, 20),
      confirmee: confirmee ? 1 : 0,
    };
    if (input.stopdesk) row.code_stopdesk = input.codeStopdesk;
    else row.commune = input.commune;
    if (account.stock) row.ref_article = input.refArticle!.trim();
    else row.article = article;
    colis.push(row);
    pending.push(order.id);
  }

  for (let start = 0; start < colis.length; start += 100) {
    const batch = colis.slice(start, start + 100);
    const ids = pending.slice(start, start + 100);
    try {
      const response = await ecomRequest<{ resultats: ColisRow[] }>("/colis", { method: "POST", body: batch });
      for (const r of response.resultats ?? []) {
        const orderId = ids[r.index];
        if (!orderId) continue;
        if (r.ok && r.tracking) {
          state.shipments[orderId] = { tracking: r.tracking, at: new Date().toISOString(), idColis: r.id_colis ?? null };
          results.set(orderId, { orderId, ok: true, tracking: r.tracking });
        } else {
          results.set(orderId, { orderId, ok: false, error: r.erreur || "Refusé par E-com Delivery" });
        }
      }
    } catch (error) {
      for (const orderId of ids) {
        results.set(orderId, { orderId, ok: false, error: error instanceof Error ? error.message : "Erreur d'envoi" });
      }
    }
  }
  if (Array.from(results.values()).some(r => r.ok)) await saveState();
  return inputs.map(input => results.get(input.orderId) ?? { orderId: input.orderId, ok: false, error: "Aucun résultat" });
}

export type EcomTrackingHistory = {
  date: string;
  ville: number | string;
  situation: string;
  commentaire?: string | null;
};

export type EcomTrackingInfo = {
  tracking: string;
  date_creation?: string;
  situation?: string;
  id_situation?: number;
  etat_logistique?: string;
  id_etat_logistique?: number;
  nom_complet?: string;
  mobile?: string;
  commune?: string;
  id_wilaya?: number;
  article?: string;
  quantite?: number;
  total?: number;
  encaisser?: boolean;
  recouvert?: boolean;
  historique?: EcomTrackingHistory[];
};

export async function getEcomTracking(tracking: string): Promise<EcomTrackingInfo | null> {
  if (!tracking) return null;
  try {
    const creds = await credentials();
    if (!creds) return null;
    return await ecomRequest<EcomTrackingInfo>(`/colis/${encodeURIComponent(tracking.trim())}`, { creds });
  } catch {
    return null;
  }
}

export async function getEcomTrackingBatch(trackings: string[]): Promise<Record<string, EcomTrackingInfo>> {
  const result: Record<string, EcomTrackingInfo> = {};
  const unique = Array.from(new Set(trackings.filter(Boolean)));
  await Promise.all(
    unique.map(async trk => {
      const data = await getEcomTracking(trk);
      if (data) result[trk] = data;
    })
  );
  return result;
}

