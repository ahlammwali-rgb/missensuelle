import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  getAlgiersDateKey,
  getAlgiersHour,
  normalizeVisitProductKey,
  type DailyVisitBucket,
  type VisitAnalyticsData,
  type VisitSource,
} from "../shared/siteVisits";
import { getCloudToken } from "./persistentStore";

type PersistedVisitsState = {
  updatedAt: string;
  days: Record<string, DailyVisitBucket>;
  productNames: Record<string, { name: string; slug?: string }>;
};

const CLOUD_VISITS_URL =
  "https://api.github.com/repos/ahlammwali-rgb/missensuelle-db/contents/visits-state.json";
const LOCAL_DATA_DIR = path.resolve(process.cwd(), ".data");
const LOCAL_VISITS_FILE = path.join(LOCAL_DATA_DIR, "visits-state.json");

const MAX_DAYS_RETAINED = 180;
const MAX_HOURLY_BY_PRODUCT_DAYS = 35;

const BOT_UA_REGEX =
  /bot|crawler|spider|slurp|facebookexternalhit|bingpreview|whatsapp|telegrambot|uptimerobot|pingdom|headless|lighthouse|gtmetrix|render-health|^curl\/|^wget\//i;

function isTestEnv(): boolean {
  return Boolean(process.env.VITEST || process.env.NODE_ENV === "test");
}

let visitDays = new Map<string, DailyVisitBucket>();
let productNames: Record<string, { name: string; slug?: string }> = {};

// Bounded per-day visitor deduplication in RAM (only retains last 2 dates, zero PII stored on disk)
const dailyUniqueSiteSet = new Map<string, Set<string>>();
const dailyUniqueProductSet = new Map<string, Set<string>>();

let loadPromise: Promise<void> | null = null;
let cloudVisitsLoaded = false;
let dirty = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let saveQueue: Promise<void> = Promise.resolve();

function createEmptyDailyBucket(dateKey: string): DailyVisitBucket {
  return {
    date: dateKey,
    totalViews: 0,
    uniqueVisitors: 0,
    hourly: new Array<number>(24).fill(0),
    byProduct: {},
    hourlyByProduct: {},
    bySource: {},
  };
}

function normalizeHourlyArray(raw?: unknown): number[] {
  const arr = new Array<number>(24).fill(0);
  if (!Array.isArray(raw)) return arr;
  for (let i = 0; i < 24; i++) {
    const val = Number(raw[i]);
    if (Number.isFinite(val) && val >= 0) arr[i] = Math.round(val);
  }
  return arr;
}

function pruneOldBuckets() {
  const sortedDates = Array.from(visitDays.keys()).sort();
  if (sortedDates.length > MAX_DAYS_RETAINED) {
    const toRemove = sortedDates.slice(0, sortedDates.length - MAX_DAYS_RETAINED);
    for (const d of toRemove) visitDays.delete(d);
  }
  const latestKeepHourlyIdx = Math.max(0, sortedDates.length - MAX_HOURLY_BY_PRODUCT_DAYS);
  for (let i = 0; i < latestKeepHourlyIdx; i++) {
    const b = visitDays.get(sortedDates[i]);
    if (b?.hourlyByProduct) {
      delete b.hourlyByProduct;
    }
  }
  // Prune in-memory unique visitor sets older than last 2 days
  const keepDates = new Set(sortedDates.slice(-2));
  for (const d of Array.from(dailyUniqueSiteSet.keys())) {
    if (!keepDates.has(d)) dailyUniqueSiteSet.delete(d);
  }
  for (const d of Array.from(dailyUniqueProductSet.keys())) {
    if (!keepDates.has(d)) dailyUniqueProductSet.delete(d);
  }
}

function mergeVisitsStateIntoMemory(raw: PersistedVisitsState | null | undefined) {
  if (!raw || typeof raw !== "object") return;
  if (raw.productNames && typeof raw.productNames === "object") {
    for (const [k, info] of Object.entries(raw.productNames)) {
      if (k && info?.name && !productNames[k]) {
        productNames[k] = { name: info.name, slug: info.slug };
      }
    }
  }
  if (!raw.days || typeof raw.days !== "object") return;
  for (const [dateKey, srcBucket] of Object.entries(raw.days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !srcBucket) continue;
    const localBucket = visitDays.get(dateKey);
    if (!localBucket) {
      const normalizedHourlyByProduct: Record<string, number[]> = {};
      if (srcBucket.hourlyByProduct && typeof srcBucket.hourlyByProduct === "object") {
        for (const [pk, arr] of Object.entries(srcBucket.hourlyByProduct)) {
          normalizedHourlyByProduct[pk] = normalizeHourlyArray(arr);
        }
      }
      visitDays.set(dateKey, {
        date: dateKey,
        totalViews: Math.max(0, Math.round(Number(srcBucket.totalViews) || 0)),
        uniqueVisitors: Math.max(0, Math.round(Number(srcBucket.uniqueVisitors) || 0)),
        hourly: normalizeHourlyArray(srcBucket.hourly),
        byProduct: { ...(srcBucket.byProduct || {}) },
        hourlyByProduct: Object.keys(normalizedHourlyByProduct).length ? normalizedHourlyByProduct : undefined,
        bySource: { ...(srcBucket.bySource || {}) },
      });
    } else {
      // Take max safely to prevent losing local increments on cold cloud merge
      localBucket.totalViews = Math.max(localBucket.totalViews, Number(srcBucket.totalViews) || 0);
      localBucket.uniqueVisitors = Math.max(localBucket.uniqueVisitors, Number(srcBucket.uniqueVisitors) || 0);
      const srcHourly = normalizeHourlyArray(srcBucket.hourly);
      for (let h = 0; h < 24; h++) {
        localBucket.hourly[h] = Math.max(localBucket.hourly[h] ?? 0, srcHourly[h] ?? 0);
      }
      for (const [pk, pVal] of Object.entries(srcBucket.byProduct || {})) {
        const cur = localBucket.byProduct[pk];
        if (!cur) {
          localBucket.byProduct[pk] = { ...pVal };
        } else {
          cur.views = Math.max(cur.views, pVal.views || 0);
          cur.uniqueVisitors = Math.max(cur.uniqueVisitors, pVal.uniqueVisitors || 0);
        }
      }
      if (srcBucket.bySource) {
        localBucket.bySource = localBucket.bySource || {};
        for (const [sKey, sCount] of Object.entries(srcBucket.bySource) as Array<[VisitSource, number]>) {
          localBucket.bySource[sKey] = Math.max(localBucket.bySource[sKey] ?? 0, sCount || 0);
        }
      }
    }
  }
  pruneOldBuckets();
}

function readLocalVisits(): PersistedVisitsState | null {
  if (isTestEnv()) return null;
  try {
    if (!fs.existsSync(LOCAL_VISITS_FILE)) return null;
    return JSON.parse(fs.readFileSync(LOCAL_VISITS_FILE, "utf8")) as PersistedVisitsState;
  } catch {
    return null;
  }
}

function writeLocalVisits(snapshot: PersistedVisitsState) {
  if (isTestEnv()) return;
  try {
    if (!fs.existsSync(LOCAL_DATA_DIR)) {
      fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_VISITS_FILE, JSON.stringify(snapshot, null, 2), "utf8");
  } catch {
    // Ignore local FS write error
  }
}

async function fetchCloudVisits(): Promise<{ state: PersistedVisitsState | null; sha: string | null }> {
  if (isTestEnv()) return { state: null, sha: null };
  try {
    const res = await fetch(CLOUD_VISITS_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getCloudToken()}`,
        "User-Agent": "missensuelle-visits",
        Accept: "application/vnd.github+json",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 404 || !res.ok) return { state: null, sha: null };
    const json = (await res.json()) as { content?: string; sha?: string };
    let base64 = json.content;
    if (!base64 && json.sha) {
      const blobRes = await fetch(
        `https://api.github.com/repos/ahlammwali-rgb/missensuelle-db/git/blobs/${json.sha}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${getCloudToken()}`,
            "User-Agent": "missensuelle-visits",
            Accept: "application/vnd.github+json",
          },
          signal: AbortSignal.timeout(10000),
        },
      );
      if (blobRes.ok) {
        base64 = ((await blobRes.json()) as { content?: string }).content;
      }
    }
    if (!base64) return { state: null, sha: json.sha ?? null };
    const parsed = JSON.parse(Buffer.from(base64.replace(/\n/g, ""), "base64").toString("utf8")) as PersistedVisitsState;
    return { state: parsed, sha: json.sha ?? null };
  } catch {
    return { state: null, sha: null };
  }
}

function buildSnapshot(): PersistedVisitsState {
  pruneOldBuckets();
  const daysObj: Record<string, DailyVisitBucket> = {};
  for (const [k, v] of visitDays.entries()) {
    daysObj[k] = v;
  }
  return {
    updatedAt: new Date().toISOString(),
    days: daysObj,
    productNames: { ...productNames },
  };
}

async function pushCloudVisits(): Promise<void> {
  if (isTestEnv() || !dirty) return;
  dirty = false;
  try {
    const existing = await fetchCloudVisits();
    if (existing.state && !cloudVisitsLoaded && Object.keys(existing.state.days || {}).length > 0) {
      mergeVisitsStateIntoMemory(existing.state);
    }
    const snapshot = buildSnapshot();
    writeLocalVisits(snapshot);
    const contentBase64 = Buffer.from(JSON.stringify(snapshot, null, 2), "utf8").toString("base64");
    const body: Record<string, unknown> = {
      message: `Sync site visits (${Object.keys(snapshot.days).length} days)`,
      content: contentBase64,
    };
    if (existing.sha) body.sha = existing.sha;
    await fetch(CLOUD_VISITS_URL, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${getCloudToken()}`,
        "User-Agent": "missensuelle-visits",
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    dirty = true;
  }
}

function scheduleVisitsSave() {
  if (isTestEnv()) return;
  dirty = true;
  writeLocalVisits(buildSnapshot());
  if (debounceTimer) return;
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    saveQueue = saveQueue.then(() => pushCloudVisits()).catch(() => {});
  }, 3000);
  if (typeof debounceTimer.unref === "function") {
    debounceTimer.unref();
  }
}

export async function ensureVisitStoreReady(): Promise<void> {
  if (isTestEnv()) return;
  if (!loadPromise) {
    loadPromise = (async () => {
      const local = readLocalVisits();
      if (local) mergeVisitsStateIntoMemory(local);
      const cloud = await fetchCloudVisits();
      if (cloud.state) {
        cloudVisitsLoaded = true;
        mergeVisitsStateIntoMemory(cloud.state);
        writeLocalVisits(buildSnapshot());
      }
    })();
  }
  await loadPromise;
}

export function isBotUserAgent(userAgent?: string): boolean {
  if (!userAgent) return false;
  return BOT_UA_REGEX.test(userAgent);
}

export function hashVisitorFingerprint(input: {
  visitorId?: string;
  ip?: string;
  userAgent?: string;
  dateKey: string;
}): string {
  const seed = input.visitorId?.trim() || `${input.ip || "unknown"}|${input.userAgent || "ua"}`;
  return crypto.createHash("sha256").update(`${input.dateKey}|${seed}`).digest("hex").slice(0, 16);
}

export function resetVisitStoreForTest() {
  visitDays = new Map();
  productNames = {};
  dailyUniqueSiteSet.clear();
  dailyUniqueProductSet.clear();
  loadPromise = null;
  dirty = false;
}

export async function recordSiteVisit(input: {
  productId?: string;
  productName?: string;
  slug?: string;
  path?: string;
  source?: VisitSource;
  visitorId?: string;
  ip?: string;
  userAgent?: string;
  at?: Date;
}): Promise<{ recorded: boolean; dateKey: string }> {
  if (isBotUserAgent(input.userAgent)) {
    return { recorded: false, dateKey: getAlgiersDateKey(input.at) };
  }
  const cleanPath = (input.path || "/").trim();
  if (cleanPath.startsWith("/admin")) {
    return { recorded: false, dateKey: getAlgiersDateKey(input.at) };
  }

  await ensureVisitStoreReady().catch(() => {});

  const now = input.at ?? new Date();
  const dateKey = getAlgiersDateKey(now);
  const hour = getAlgiersHour(now);

  const productKey = normalizeVisitProductKey(input.productId);
  const displayName = (input.productName || "").trim() || (
    productKey === "__home__" ? "Accueil Boutique"
    : productKey === "__catalogue__" ? "Catalogue"
    : productKey === "__checkout__" ? "Page Commande"
    : productKey
  );

  productNames[productKey] = {
    name: displayName,
    slug: input.slug?.trim() || productNames[productKey]?.slug,
  };

  let bucket = visitDays.get(dateKey);
  if (!bucket) {
    bucket = createEmptyDailyBucket(dateKey);
    visitDays.set(dateKey, bucket);
  }

  bucket.totalViews += 1;
  bucket.hourly[hour] = (bucket.hourly[hour] ?? 0) + 1;

  const visitorHash = hashVisitorFingerprint({
    visitorId: input.visitorId,
    ip: input.ip,
    userAgent: input.userAgent,
    dateKey,
  });

  let siteUnique = dailyUniqueSiteSet.get(dateKey);
  if (!siteUnique) {
    siteUnique = new Set();
    dailyUniqueSiteSet.set(dateKey, siteUnique);
  }
  if (!siteUnique.has(visitorHash)) {
    siteUnique.add(visitorHash);
    bucket.uniqueVisitors += 1;
  }

  let prodBucket = bucket.byProduct[productKey];
  if (!prodBucket) {
    prodBucket = { name: displayName, slug: input.slug?.trim(), views: 0, uniqueVisitors: 0 };
    bucket.byProduct[productKey] = prodBucket;
  } else {
    prodBucket.name = displayName;
    if (input.slug?.trim()) prodBucket.slug = input.slug.trim();
  }
  prodBucket.views += 1;

  const prodUniqueKey = `${productKey}|${visitorHash}`;
  let prodUnique = dailyUniqueProductSet.get(dateKey);
  if (!prodUnique) {
    prodUnique = new Set();
    dailyUniqueProductSet.set(dateKey, prodUnique);
  }
  if (!prodUnique.has(prodUniqueKey)) {
    prodUnique.add(prodUniqueKey);
    prodBucket.uniqueVisitors += 1;
  }

  if (!bucket.hourlyByProduct) bucket.hourlyByProduct = {};
  if (!Array.isArray(bucket.hourlyByProduct[productKey])) {
    bucket.hourlyByProduct[productKey] = new Array<number>(24).fill(0);
  }
  bucket.hourlyByProduct[productKey][hour] = (bucket.hourlyByProduct[productKey][hour] ?? 0) + 1;

  const source: VisitSource = input.source || "direct";
  bucket.bySource = bucket.bySource || {};
  bucket.bySource[source] = (bucket.bySource[source] ?? 0) + 1;

  scheduleVisitsSave();
  return { recorded: true, dateKey };
}

export async function getSiteVisitAnalytics(): Promise<VisitAnalyticsData> {
  await ensureVisitStoreReady().catch(() => {});
  const now = new Date();
  const days = Array.from(visitDays.values()).sort((a, b) => a.date.localeCompare(b.date));
  return {
    days,
    todayDateKey: getAlgiersDateKey(now),
    serverNowIso: now.toISOString(),
    productNames: { ...productNames },
  };
}
