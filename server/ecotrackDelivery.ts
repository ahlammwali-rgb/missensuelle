import fs from "node:fs";
import path from "node:path";
import type { CheckoutOrder } from "../shared/checkout";
import {
  WILAYA_FRENCH_NAMES,
  matchEcomCommune,
  normalizeLatin,
  wilayaIdFromName,
  type ShippingRate,
} from "../shared/shipping";
import { getCloudToken } from "./persistentStore";
import type { EcomTrackingInfo } from "./ecomDelivery";

const CLOUD_URL =
  "https://api.github.com/repos/ahlammwali-rgb/missensuelle-db/contents/ecotrack-state.json";
const LOCAL_DIR = path.resolve(process.cwd(), ".data");
const LOCAL_FILE = path.join(LOCAL_DIR, "ecotrack-state.json");
const CACHE_TTL = 10 * 60 * 1000;

export type EcoTrackShipment = {
  tracking: string;
  at: string;
  readyToShip?: boolean;
};

type EcoTrackState = {
  baseUrl: string;
  token: string;
  label?: string;
  shipments: Record<string, EcoTrackShipment>;
};

export class EcoTrackError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "EcoTrackError";
  }
}

let state: EcoTrackState = { baseUrl: "", token: "", label: "", shipments: {} };
let loadPromise: Promise<void> | null = null;

type RawEcoCommune = {
  nom?: string;
  name?: string;
  wilaya_id?: number | string;
  code_postal?: string;
  has_stop_desk?: number | boolean;
  is_active?: number | boolean;
};

type RawEcoDesk = {
  hub_id?: number;
  hub_name?: string;
  name?: string;
  nom?: string;
  code_wilaya?: number | string;
  wilaya_id?: number | string;
  wilaya?: string;
  commune?: string;
  adresse?: string;
  phone?: string | null;
  location?: {
    wilaya?: string;
    commune?: string;
    adresse?: string;
    phone?: string;
  };
};

export type EcoTrackDeskOption = {
  code: string;
  commune: string;
  label: string;
};

let wilayasCache: { at: number; items: Array<{ wilaya_id: number; wilaya_name: string }> } | null = null;
let feesCache: { at: number; rates: Record<string, ShippingRate> } | null = null;
let allCommunesCache: { at: number; items: RawEcoCommune[] } | null = null;
let allDesksCache: { at: number; myDesk?: RawEcoDesk | null; otherDesks: RawEcoDesk[] } | null = null;

const isTestEnv = () => Boolean(process.env.VITEST || process.env.NODE_ENV === "test");
const githubHeaders = () => ({
  Authorization: `Bearer ${getCloudToken()}`,
  "User-Agent": "missensuelle-store",
  Accept: "application/vnd.github+json",
});

export function normalizeEcoTrackBaseUrl(raw: string): string {
  let cleaned = (raw || "").trim();
  if (!cleaned) return "";
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }
  cleaned = cleaned.replace(/\/+$/, "");
  cleaned = cleaned.replace(/\/api\/v1$/i, "");
  return cleaned.replace(/\/+$/, "");
}

async function fetchCloud(): Promise<{ state: Partial<EcoTrackState> | null; sha: string | null }> {
  try {
    const res = await fetch(CLOUD_URL, { headers: githubHeaders(), signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { state: null, sha: null };
    const json = (await res.json()) as { content?: string; sha?: string };
    let base64 = json.content;
    if (!base64 && json.sha) {
      const blobRes = await fetch(
        `https://api.github.com/repos/ahlammwali-rgb/missensuelle-db/git/blobs/${json.sha}`,
        { headers: githubHeaders(), signal: AbortSignal.timeout(12000) }
      );
      if (blobRes.ok) {
        const blobJson = (await blobRes.json()) as { content?: string };
        base64 = blobJson.content;
      }
    }
    if (!base64) return { state: null, sha: json.sha ?? null };
    const decoded = Buffer.from(base64.replace(/\n/g, ""), "base64").toString("utf8");
    return { state: JSON.parse(decoded) as Partial<EcoTrackState>, sha: json.sha ?? null };
  } catch {
    return { state: null, sha: null };
  }
}

function readLocal(): Partial<EcoTrackState> | null {
  try {
    return fs.existsSync(LOCAL_FILE)
      ? (JSON.parse(fs.readFileSync(LOCAL_FILE, "utf8")) as Partial<EcoTrackState>)
      : null;
  } catch {
    return null;
  }
}

function mergeInto(source: Partial<EcoTrackState> | null) {
  if (!source) return;
  if (source.baseUrl && !state.baseUrl) state.baseUrl = source.baseUrl;
  if (source.token && !state.token) state.token = source.token;
  if (source.label && !state.label) state.label = source.label;
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
    // Ignore local FS errors
  }
  try {
    const existing = await fetchCloud();
    const merged: EcoTrackState = {
      baseUrl: state.baseUrl,
      token: state.token,
      label: state.label,
      shipments: { ...(existing.state?.shipments ?? {}), ...state.shipments },
    };
    const body: Record<string, unknown> = {
      message: "Sync EcoTrack state",
      content: Buffer.from(JSON.stringify(merged, null, 2), "utf8").toString("base64"),
    };
    if (existing.sha) body.sha = existing.sha;
    await fetch(CLOUD_URL, {
      method: "PUT",
      headers: { ...githubHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // Local copy already saved
  }
}

function clearCaches() {
  wilayasCache = null;
  feesCache = null;
  allCommunesCache = null;
  allDesksCache = null;
}

async function credentials() {
  await loadState();
  const baseUrl = normalizeEcoTrackBaseUrl(process.env.ECOTRACK_BASE_URL?.trim() || state.baseUrl);
  const token = process.env.ECOTRACK_API_TOKEN?.trim() || state.token;
  return baseUrl && token ? { baseUrl, token } : null;
}

async function ecoRequest<T>(
  endpoint: string,
  options: {
    method?: string;
    body?: unknown;
    query?: Record<string, string | number>;
    creds?: { baseUrl: string; token: string };
  } = {}
): Promise<T> {
  const creds = options.creds ?? (await credentials());
  if (!creds) throw new EcoTrackError("Identifiants EcoTrack non configurés", 400);
  const url = new URL(`${creds.baseUrl}${endpoint}`);
  for (const [k, v] of Object.entries(options.query ?? {})) {
    url.searchParams.set(k, String(v));
  }
  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${creds.token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new EcoTrackError("Plateforme EcoTrack injoignable, vérifiez l'URL ou réessayez.", 502);
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const obj = (json && typeof json === "object" ? json : null) as {
      message?: string;
      errors?: Record<string, string[]>;
    } | null;
    const firstValidationErr = obj?.errors
      ? Object.values(obj.errors).flat().find(Boolean)
      : undefined;
    const msg =
      res.status === 401
        ? "Token EcoTrack invalide ou expiré"
        : res.status === 429
          ? "Quota EcoTrack dépassé, patientez un instant"
          : firstValidationErr || obj?.message || `Erreur EcoTrack (${res.status})`;
    throw new EcoTrackError(msg, res.status);
  }
  return json as T;
}

async function validateToken(creds: { baseUrl: string; token: string }) {
  try {
    const resp = await ecoRequest<{ success?: boolean; message?: string }>(
      "/api/v1/validate/token",
      { creds, query: { api_token: creds.token } }
    );
    if (resp && (resp.success === true || String(resp.message || "").includes("VALID"))) {
      return true;
    }
  } catch (err) {
    if (err instanceof EcoTrackError && err.status === 401) {
      throw err;
    }
  }
  // Fallback test: try /api/v1/get/wilayas with Bearer token if validate/token shape differs
  const w = await ecoRequest<unknown>("/api/v1/get/wilayas", { creds });
  if (Array.isArray(w) || (w && typeof w === "object")) return true;
  throw new EcoTrackError("Token EcoTrack refusé par la plateforme.", 401);
}

export async function getEcoTrackStatus() {
  await loadState();
  const creds = await credentials();
  if (!creds) {
    return { configured: false as const, shipments: state.shipments };
  }
  const tokenPreview = `${creds.token.slice(0, 4)}…${creds.token.slice(-4)}`;
  try {
    await validateToken(creds);
    return {
      configured: true as const,
      connected: true as const,
      baseUrl: creds.baseUrl,
      label: state.label || creds.baseUrl.replace(/^https?:\/\//, ""),
      tokenPreview,
      error: null,
      shipments: state.shipments,
    };
  } catch (error) {
    return {
      configured: true as const,
      connected: false as const,
      baseUrl: creds.baseUrl,
      label: state.label || creds.baseUrl.replace(/^https?:\/\//, ""),
      tokenPreview,
      error: error instanceof Error ? error.message : "Erreur de connexion EcoTrack",
      shipments: state.shipments,
    };
  }
}

export async function saveEcoTrackCredentials(baseUrlRaw: string, tokenRaw: string, labelRaw?: string) {
  const baseUrl = normalizeEcoTrackBaseUrl(baseUrlRaw);
  const token = (tokenRaw || "").trim();
  if (!baseUrl || !token) {
    throw new EcoTrackError("L'URL EcoTrack et le Token Bearer sont obligatoires.");
  }
  await validateToken({ baseUrl, token });
  await loadState();
  state.baseUrl = baseUrl;
  state.token = token;
  state.label = (labelRaw || "").trim() || baseUrl.replace(/^https?:\/\//, "");
  clearCaches();
  await saveState();
  return {
    ok: true,
    baseUrl: state.baseUrl,
    label: state.label,
  };
}

export async function clearEcoTrackCredentials() {
  await loadState();
  state.baseUrl = "";
  state.token = "";
  state.label = "";
  clearCaches();
  await saveState();
  return { cleared: true };
}

export async function getEcoTrackFees(): Promise<{
  configured: boolean;
  rates: Record<string, ShippingRate>;
}> {
  if (isTestEnv()) return { configured: false, rates: {} };
  if (feesCache && Date.now() - feesCache.at < CACHE_TTL) {
    return { configured: true, rates: feesCache.rates };
  }
  const creds = await credentials();
  if (!creds) return { configured: false, rates: {} };
  try {
    const data = await ecoRequest<{
      livraison?: Array<{ wilaya_id: number | string; tarif: number | string; tarif_stopdesk: number | string }>;
    }>("/api/v1/get/fees", { creds });
    const rates: Record<string, ShippingRate> = {};
    for (const row of data.livraison ?? []) {
      const wid = Number(row.wilaya_id);
      if (wid > 0) {
        rates[String(wid)] = {
          domicile: Number(row.tarif) || 0,
          stopdesk: Number(row.tarif_stopdesk) || 0,
        };
      }
    }
    feesCache = { at: Date.now(), rates };
    return { configured: true, rates };
  } catch {
    return { configured: true, rates: feesCache?.rates ?? {} };
  }
}

async function getActiveWilayas(): Promise<Array<{ wilaya_id: number; wilaya_name: string }>> {
  if (wilayasCache && Date.now() - wilayasCache.at < CACHE_TTL) {
    return wilayasCache.items;
  }
  const data = await ecoRequest<Array<{ wilaya_id: number; wilaya_name: string }> | Record<string, { wilaya_id: number; wilaya_name: string }>>(
    "/api/v1/get/wilayas"
  ).catch(() => []);
  const arr = Array.isArray(data) ? data : Object.values(data || {});
  wilayasCache = { at: Date.now(), items: arr };
  return arr;
}

async function getAllCommunes(): Promise<RawEcoCommune[]> {
  if (allCommunesCache && Date.now() - allCommunesCache.at < CACHE_TTL) {
    return allCommunesCache.items;
  }
  const raw = await ecoRequest<RawEcoCommune[] | Record<string, RawEcoCommune>>("/api/v1/get/communes").catch(() => []);
  const arr = Array.isArray(raw) ? raw : Object.values(raw || {});
  allCommunesCache = { at: Date.now(), items: arr };
  return arr;
}

async function getAllDesks() {
  if (allDesksCache && Date.now() - allDesksCache.at < CACHE_TTL) {
    return allDesksCache;
  }
  const raw = await ecoRequest<{
    my_desk?: RawEcoDesk | null;
    other_desks?: RawEcoDesk[] | Record<string, RawEcoDesk>;
  } | RawEcoDesk[]>("/api/v1/get/desks").catch(() => ({ my_desk: null, other_desks: [] }));
  const myDesk = !Array.isArray(raw) ? raw?.my_desk ?? null : null;
  const rawOther = Array.isArray(raw) ? raw : raw?.other_desks ?? [];
  const otherDesks = Array.isArray(rawOther) ? rawOther : Object.values(rawOther || {});
  allDesksCache = { at: Date.now(), myDesk, otherDesks };
  return allDesksCache;
}

export async function getEcoTrackLocations(wilayaId: number): Promise<{
  communes: string[];
  desks: EcoTrackDeskOption[];
  activeWilaya: boolean;
}> {
  const [wilayas, allCommunes, desksData] = await Promise.all([
    getActiveWilayas(),
    getAllCommunes(),
    getAllDesks(),
  ]);

  let filteredCommunes = allCommunes.filter(
    c => Number(c.wilaya_id) === wilayaId && (c.is_active === undefined || Number(c.is_active) === 1)
  );
  if (filteredCommunes.length === 0) {
    // Retry per-wilaya query in case platform doesn't return full list on bare /get/communes
    const perWilaya = await ecoRequest<RawEcoCommune[] | Record<string, RawEcoCommune>>(
      "/api/v1/get/communes",
      { query: { wilaya_id: wilayaId } }
    ).catch(() => []);
    const arr = Array.isArray(perWilaya) ? perWilaya : Object.values(perWilaya || {});
    filteredCommunes = arr.filter(
      c => (c.wilaya_id === undefined || Number(c.wilaya_id) === wilayaId) &&
        (c.is_active === undefined || Number(c.is_active) === 1)
    );
  }

  const communes = Array.from(
    new Set(
      filteredCommunes
        .map(c => String(c.nom || c.name || "").trim())
        .filter(Boolean)
    )
  );

  // Collect Stop Desk bureaux from /get/desks AND from communes with has_stop_desk === 1
  const desks: EcoTrackDeskOption[] = [];
  const seenDeskCommunes = new Set<string>();
  const targetWilayaNorm = normalizeLatin(WILAYA_FRENCH_NAMES[wilayaId] || "");

  if (desksData.myDesk?.location) {
    const locWilayaNorm = normalizeLatin(desksData.myDesk.location.wilaya || "");
    if (locWilayaNorm && targetWilayaNorm && locWilayaNorm === targetWilayaNorm) {
      const c = String(desksData.myDesk.location.commune || WILAYA_FRENCH_NAMES[wilayaId] || "").trim();
      if (c && !seenDeskCommunes.has(normalizeLatin(c))) {
        seenDeskCommunes.add(normalizeLatin(c));
        desks.push({
          code: c,
          commune: c,
          label: `${desksData.myDesk.hub_name || "Station"} — ${c}`,
        });
      }
    }
  }

  for (const d of desksData.otherDesks) {
    const wid = Number(d.code_wilaya ?? d.wilaya_id ?? 0);
    const matchesWid = wid > 0 ? wid === wilayaId : normalizeLatin(d.wilaya || "") === targetWilayaNorm;
    if (!matchesWid) continue;
    const c = String(d.commune || d.wilaya || WILAYA_FRENCH_NAMES[wilayaId] || "").trim();
    if (!c || seenDeskCommunes.has(normalizeLatin(c))) continue;
    seenDeskCommunes.add(normalizeLatin(c));
    desks.push({
      code: c,
      commune: c,
      label: `${d.name || d.nom || "Station"} — ${c}${d.adresse ? ` (${d.adresse})` : ""}`,
    });
  }

  for (const c of filteredCommunes) {
    if (Number(c.has_stop_desk) === 1) {
      const nom = String(c.nom || c.name || "").trim();
      if (nom && !seenDeskCommunes.has(normalizeLatin(nom))) {
        seenDeskCommunes.add(normalizeLatin(nom));
        desks.push({
          code: nom,
          commune: nom,
          label: `Stop Desk — ${nom}`,
        });
      }
    }
  }

  const activeWilaya =
    wilayas.length === 0 || wilayas.some(w => Number(w.wilaya_id) === wilayaId);

  return { communes, desks, activeWilaya };
}

export async function getEcoTrackProducts() {
  const data = await ecoRequest<{
    products?: Array<{
      reference?: string;
      title?: string;
      is_active?: number;
      stock_disponible?: number;
    }>;
  }>("/api/v1/get/products/list").catch(() => ({ products: [] }));
  return (data.products ?? []).filter(p => p && (p.is_active === undefined || Number(p.is_active) === 1));
}

export type EcoTrackShipInput = {
  orderId: string;
  wilayaId?: number;
  stopdesk: boolean;
  commune?: string;
  deskCommune?: string;
  refArticle?: string;
};

export type EcoTrackShipResult = {
  orderId: string;
  ok: boolean;
  tracking?: string;
  error?: string;
  readyToShip?: boolean;
};

function normalizeAlgerianPhone(raw: string): string {
  let digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("00213")) digits = digits.slice(5);
  else if (digits.startsWith("213") && digits.length >= 11) digits = digits.slice(3);
  if (/^[567]\d{8}$/.test(digits)) digits = `0${digits}`;
  return digits.slice(0, 15) || raw.trim().slice(0, 20);
}

export async function shipEcoTrackOrders(
  orders: CheckoutOrder[],
  inputs: EcoTrackShipInput[],
  validateImmediately: boolean
): Promise<EcoTrackShipResult[]> {
  await loadState();
  const results: EcoTrackShipResult[] = [];
  const byId = new Map(orders.map(o => [o.id, o]));
  const feesData = await getEcoTrackFees().catch(() => ({ configured: false, rates: {} as Record<string, ShippingRate> }));

  for (const input of inputs) {
    const order = byId.get(input.orderId);
    if (!order) {
      results.push({ orderId: input.orderId, ok: false, error: "Commande introuvable" });
      continue;
    }

    const existing = state.shipments[order.id];
    if (existing) {
      if (validateImmediately && !existing.readyToShip) {
        try {
          await validateEcoTrackOrder(existing.tracking);
          existing.readyToShip = true;
          await saveState();
          results.push({
            orderId: order.id,
            ok: true,
            tracking: existing.tracking,
            readyToShip: true,
          });
          continue;
        } catch (err) {
          results.push({
            orderId: order.id,
            ok: false,
            error: err instanceof Error ? err.message : "Validation échouée",
          });
          continue;
        }
      }
      results.push({
        orderId: order.id,
        ok: false,
        error: `Déjà envoyée sur EcoTrack (${existing.tracking})`,
      });
      continue;
    }

    const wilayaId = input.wilayaId || wilayaIdFromName(order.wilaya, order.commune);
    if (!wilayaId) {
      results.push({
        orderId: order.id,
        ok: false,
        error: `Wilaya non reconnue : ${order.wilaya || "Vide"} (Sélectionnez une wilaya)`,
      });
      continue;
    }

    let loc: Awaited<ReturnType<typeof getEcoTrackLocations>>;
    try {
      loc = await getEcoTrackLocations(wilayaId);
    } catch {
      loc = { communes: [], desks: [], activeWilaya: true };
    }

    if (!loc.activeWilaya) {
      results.push({
        orderId: order.id,
        ok: false,
        error: `La wilaya ${wilayaId} (${WILAYA_FRENCH_NAMES[wilayaId]}) n'est pas activée sur votre compte EcoTrack`,
      });
      continue;
    }

    const wilayaFee = feesData.rates[String(wilayaId)];
    if (input.stopdesk && wilayaFee && wilayaFee.stopdesk === 0 && loc.desks.length === 0) {
      results.push({
        orderId: order.id,
        ok: false,
        error: `Aucun bureau Stop Desk actif dans la wilaya ${wilayaId} (${WILAYA_FRENCH_NAMES[wilayaId]}). Passez en mode Domicile.`,
      });
      continue;
    }

    // Resolve Commune cleanly so EcoTrack NEVER blocks on invalid commune / Stop Desk
    let resolvedCommune = "";
    if (input.stopdesk) {
      const explicitDesk = (input.deskCommune || "").trim();
      if (explicitDesk) {
        resolvedCommune = explicitDesk;
      } else if (loc.desks.length > 0) {
        const deskNames = loc.desks.map(d => d.commune);
        resolvedCommune =
          matchEcomCommune(wilayaId, order.commune, deskNames) || loc.desks[0].commune;
      } else if (loc.communes.length > 0) {
        resolvedCommune =
          matchEcomCommune(wilayaId, order.commune, loc.communes) || loc.communes[0];
      } else {
        resolvedCommune = WILAYA_FRENCH_NAMES[wilayaId] || order.commune || order.wilaya;
      }
    } else {
      const candidate = (input.commune || order.commune || "").trim();
      if (loc.communes.length > 0) {
        resolvedCommune = matchEcomCommune(wilayaId, candidate, loc.communes) || loc.communes[0];
      } else {
        resolvedCommune = candidate || WILAYA_FRENCH_NAMES[wilayaId] || order.wilaya;
      }
    }

    // Ensure commune matches exact casing of /get/communes if available
    if (loc.communes.length > 0) {
      const exactNorm = normalizeLatin(resolvedCommune);
      const canonical = loc.communes.find(c => normalizeLatin(c) === exactNorm);
      if (canonical) resolvedCommune = canonical;
    }

    const baseName = order.product.replace(/\s*×\s*\d+$/, "").trim();
    const articleText = [baseName, order.color, order.size]
      .filter(Boolean)
      .join(" - ")
      .slice(0, 255);
    const hasRef = Boolean(input.refArticle?.trim());

    const payload: Record<string, unknown> = {
      reference: order.id.slice(0, 40),
      nom_client: (order.customer || "Cliente").slice(0, 60),
      telephone: normalizeAlgerianPhone(order.phone),
      adresse: (order.address || resolvedCommune || WILAYA_FRENCH_NAMES[wilayaId] || "Algérie").slice(0, 180),
      code_postal: "",
      commune: resolvedCommune,
      code_wilaya: String(wilayaId),
      montant: String(Math.max(0, Math.round(order.total))),
      remarque: [order.note, `${order.color || ""} ${order.size || ""}`.trim()]
        .filter(Boolean)
        .join(" | ")
        .slice(0, 255),
      produit: hasRef ? input.refArticle!.trim() : articleText || "Produit",
      stock: hasRef ? 1 : 0,
      quantite: String(Math.max(1, order.quantity || 1)),
      type: "1",
      stop_desk: input.stopdesk ? 1 : 0,
    };

    try {
      const resp = await ecoRequest<{
        success?: boolean;
        tracking?: string;
        message?: string;
      }>("/api/v1/create/order", {
        method: "POST",
        body: payload,
      });

      if (resp && resp.success === false) {
        results.push({
          orderId: order.id,
          ok: false,
          error: resp.message || "Refusé par EcoTrack",
        });
        continue;
      }

      const tracking = String(resp?.tracking || "").trim();
      if (!tracking) {
        results.push({
          orderId: order.id,
          ok: false,
          error: resp?.message || "Aucun code tracking retourné par EcoTrack",
        });
        continue;
      }

      let ready = false;
      if (validateImmediately) {
        try {
          await validateEcoTrackOrder(tracking);
          ready = true;
        } catch {
          ready = false;
        }
      }

      state.shipments[order.id] = {
        tracking,
        at: new Date().toISOString(),
        readyToShip: ready,
      };
      results.push({ orderId: order.id, ok: true, tracking, readyToShip: ready });
    } catch (err) {
      results.push({
        orderId: order.id,
        ok: false,
        error: err instanceof Error ? err.message : "Erreur d'envoi EcoTrack",
      });
    }
  }

  if (results.some(r => r.ok)) {
    await saveState();
  }
  return results;
}

export async function validateEcoTrackOrder(tracking: string) {
  await loadState();
  const creds = await credentials();
  if (!creds) throw new EcoTrackError("EcoTrack non configuré");
  const resp = await ecoRequest<{ success?: boolean; message?: string }>(
    "/api/v1/valid/order",
    {
      method: "POST",
      creds,
      query: { tracking },
      body: { tracking },
    }
  );
  for (const [orderId, sh] of Object.entries(state.shipments)) {
    if (sh.tracking === tracking) {
      state.shipments[orderId] = { ...sh, readyToShip: true };
    }
  }
  await saveState();
  return resp;
}

const ECOTRACK_STATUS_LABELS: Record<string, string> = {
  prete_a_expedier: "Prêt à expédier",
  en_preparation: "En préparation",
  vers_hub: "En transit vers Hub",
  en_hub: "Au Hub",
  vers_wilaya: "En transit vers Wilaya",
  en_livraison: "En cours de livraison",
  suspendu: "Suspendu",
  livree: "Livrée",
  livree_non_encaissee: "Livrée (Non encaissée)",
  livree_encaissee: "Livrée & Encaissée",
  encaissee: "Encaissée",
  paye: "Payé",
  retour_en_cours: "Retour en cours",
  retourne: "Retourné",
  annulee: "Annulée",
};

function formatEcoStatusLabel(raw?: string): string {
  const key = (raw || "").trim().toLowerCase();
  return ECOTRACK_STATUS_LABELS[key] || raw || "En suivi";
}

export async function getEcoTrackTrackingBatch(
  trackings: string[]
): Promise<Record<string, EcomTrackingInfo>> {
  const result: Record<string, EcomTrackingInfo> = {};
  const unique = Array.from(new Set(trackings.filter(Boolean)));
  if (!unique.length) return result;
  const creds = await credentials();
  if (!creds) return result;

  // Query in chunks of 40 via /api/v1/get/orders/status
  for (let i = 0; i < unique.length; i += 40) {
    const chunk = unique.slice(i, i + 40);
    try {
      const resp = await ecoRequest<{
        data?: Record<
          string,
          {
            status?: string;
            order_id?: string;
            activity?: Array<{
              reason?: string;
              details?: string;
              station?: string;
              driver?: string;
              date?: string;
              time?: string;
            }>;
          }
        >;
      }>("/api/v1/get/orders/status", {
        creds,
        query: {
          api_token: creds.token,
          trackings: chunk.join(","),
        },
      });
      for (const [trk, info] of Object.entries(resp.data ?? {})) {
        const sit = formatEcoStatusLabel(info.status);
        const low = `${info.status || ""} ${sit}`.toLowerCase();
        result[trk] = {
          tracking: trk,
          situation: sit,
          etat_logistique: info.status,
          encaisser: low.includes("encaiss") || low.includes("paye") || low.includes("livree"),
          recouvert: low.includes("encaiss") || low.includes("paye"),
          historique: (info.activity ?? []).map(a => ({
            date: [a.date, a.time].filter(Boolean).join(" "),
            ville: a.station || "",
            situation: a.reason || sit,
            commentaire: a.details || (a.driver ? `Livreur : ${a.driver}` : undefined),
          })),
        };
      }
    } catch {
      // Ignore transient tracking error
    }
  }
  return result;
}
