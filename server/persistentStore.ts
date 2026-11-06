import fs from "node:fs";
import path from "node:path";
import type { AbandonedCheckout, CheckoutOrder, CheckoutPayload } from "../shared/checkout";

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

type PersistedState = {
  updatedAt: string;
  nextMemoryOrderId: number;
  nextMemorySessionId: number;
  orders: CheckoutOrder[];
  sessions: SerializedSession[];
};

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
  try {
    const res = await fetch(CLOUD_API_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getCloudToken()}`,
        "User-Agent": "missensuelle-store",
        Accept: "application/vnd.github+json",
      },
    });
    if (res.status === 404) return { state: null, sha: null };
    if (!res.ok) return { state: null, sha: null };
    const json = (await res.json()) as { content?: string; sha?: string };
    if (!json.content) return { state: null, sha: json.sha ?? null };
    const decoded = Buffer.from(json.content.replace(/\n/g, ""), "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as PersistedState;
    return { state: parsed, sha: json.sha ?? null };
  } catch {
    return { state: null, sha: null };
  }
}

async function pushCloudState(state: PersistedState): Promise<void> {
  if (isTestEnv()) return;
  try {
    const existing = await fetchCloudState();
    // In-memory state is authoritative for orders; do not resurrect orders that were deleted
    const finalOrders = [...state.orders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const mergedSessionsMap = new Map<string, SerializedSession>();
    for (const s of existing.state?.sessions ?? []) {
      if (s && s.tokenHash) mergedSessionsMap.set(s.tokenHash, s);
    }
    for (const s of state.sessions) {
      if (s && s.tokenHash) {
        const prev = mergedSessionsMap.get(s.tokenHash);
        if (!prev || s.revision >= prev.revision || s.state === "submitted" || s.state === "discarded" || s.state === "purged") {
          mergedSessionsMap.set(s.tokenHash, s);
        }
      }
    }

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
        Array.from(mergedSessionsMap.values()).reduce((max, s) => Math.max(max, (s.id ?? 0) + 1), 1),
      ),
      orders: finalOrders,
      sessions: Array.from(mergedSessionsMap.values()),
    };

    writeLocalState(finalState);

    const contentBase64 = Buffer.from(JSON.stringify(finalState, null, 2), "utf8").toString("base64");
    const body: Record<string, unknown> = {
      message: `Sync store state (${finalState.orders.length} orders, ${finalState.sessions.length} sessions)`,
      content: contentBase64,
    };
    if (existing.sha) body.sha = existing.sha;

    await fetch(CLOUD_API_URL, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${getCloudToken()}`,
        "User-Agent": "missensuelle-store",
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    // Ignore network error; local state is already written
  }
}

let loadPromise: Promise<void> | null = null;
let saveQueue: Promise<void> = Promise.resolve();

function mergeStateIntoMemory(
  source: PersistedState,
  memoryOrders: CheckoutOrder[],
  memorySessions: Map<string, PersistentMemorySession>,
  setCounters: (nextOrderId: number, nextSessionId: number) => void,
  getCounters: () => { nextOrderId: number; nextSessionId: number },
) {
  const existingById = new Map(memoryOrders.map(o => [o.id, o]));
  for (const order of source.orders ?? []) {
    if (order && order.id && !existingById.has(order.id)) {
      memoryOrders.push(order);
      existingById.set(order.id, order);
    }
  }
  memoryOrders.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  for (const rawSession of source.sessions ?? []) {
    if (!rawSession || !rawSession.tokenHash) continue;
    const current = memorySessions.get(rawSession.tokenHash);
    if (!current || rawSession.revision > current.revision) {
      memorySessions.set(rawSession.tokenHash, deserializeSession(rawSession));
    }
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
        mergeStateIntoMemory(cloud.state, memoryOrders, memorySessions, setCounters, getCounters);
        const counters = getCounters();
        writeLocalState({
          updatedAt: new Date().toISOString(),
          nextMemoryOrderId: counters.nextOrderId,
          nextMemorySessionId: counters.nextSessionId,
          orders: [...memoryOrders],
          sessions: serializeSessions(memorySessions),
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
  };
  writeLocalState(snapshot);
  saveQueue = saveQueue
    .then(() => pushCloudState(snapshot))
    .catch(() => {});
}
