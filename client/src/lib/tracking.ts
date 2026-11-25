import {
  getFacebookPixelIds,
  getTikTokPixelIds,
  normalizePixelIdList,
  normalizePublicPixelConfig,
  sitePixelConfig,
  type PublicPixelConfig,
} from "@shared/site-pixels";
import { trackSiteVisit } from "./visit-tracker";

export type PixelConfig = PublicPixelConfig;
type PixelEvent = "ViewContent" | "InitiateCheckout" | "Purchase" | "AddToCart";
type MetaQueue = ((...args: unknown[]) => void) & {
  queue?: unknown[]; loaded?: boolean; version?: string; callMethod?: (...args: unknown[]) => void;
  push?: MetaQueue;
  getState?: () => { pixels?: Array<{ id?: string | number }> };
};
type TikTokInstance = unknown[] & { _u?: string; info?: { pixelCode?: string }; page?: () => void };
type TikTokQueue = unknown[] & {
  methods?: string[];
  _i?: Record<string, TikTokInstance>;
  _t?: Record<string, number>;
  _o?: Record<string, unknown>;
  page?: () => void;
  track?: (name: string, data?: Record<string, unknown>) => void;
  identify?: (data: Record<string, unknown>) => void;
  load?: (id: string, options?: Record<string, unknown>) => void;
  instance?: (id: string) => TikTokInstance;
  setAndDefer?: (target: unknown[], method: string) => void;
};
type SDKStage = "loading" | "loaded" | "error" | "not-loaded";
type SDKStatus = { pixelId: string; stage: "loading" | "loaded" | "error"; src: string; error: string };
export type PixelDiagnosticItem = {
  pixelId: string;
  stage: SDKStage;
  error: string;
  registered: boolean;
};
type TrackingWindow = Window & {
  fbq?: MetaQueue;
  _fbq?: MetaQueue;
  ttq?: TikTokQueue;
  TiktokAnalyticsObject?: string;
  __MISS_SITE_PIXEL_CONFIG?: PixelConfig;
  __missMetaIds?: Set<string>;
  __missTikTokIds?: Set<string>;
  __missMetaPageViewSent?: boolean;
  __missTikTokPageSent?: boolean;
  __missMetaStatus?: SDKStatus;
  __missMetaStatuses?: Record<string, SDKStatus>;
  __missTikTokStatus?: SDKStatus;
  __missTikTokStatuses?: Record<string, SDKStatus>;
  __missPixelEvents?: Array<{ name: PixelEvent; at: string }>;
};

const PIXEL_KEY = "miss-sensuelle-pixels";

function getSiteConfig(): PixelConfig {
  return typeof window === "undefined"
    ? sitePixelConfig
    : (window as TrackingWindow).__MISS_SITE_PIXEL_CONFIG ?? sitePixelConfig;
}

export function getPixelConfig(): PixelConfig {
  if (typeof window === "undefined") return normalizePublicPixelConfig(sitePixelConfig);
  const global = getSiteConfig();
  let saved: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PIXEL_KEY) || "{}");
    if (parsed && typeof parsed === "object") saved = parsed as Record<string, unknown>;
  } catch { /* Les pixels du site ne dépendent pas du stockage du navigateur. */ }
  const str = (value: unknown) => typeof value === "string" ? value.trim() : "";
  const strArr = (value: unknown) =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : undefined;

  const globalFbIds = getFacebookPixelIds(global);
  const globalTtIds = getTikTokPixelIds(global);
  const hasGlobalFb = globalFbIds.length > 0;
  const hasGlobalTt = globalTtIds.length > 0 || Boolean(global.tiktokCode);

  const fbIds = hasGlobalFb
    ? globalFbIds
    : normalizePixelIdList(strArr(saved.facebookPixelIds), str(saved.facebookPixelId));
  const ttIds = hasGlobalTt
    ? globalTtIds
    : normalizePixelIdList(strArr(saved.tiktokPixelIds), str(saved.tiktokPixelId));
  const tiktokCode = hasGlobalTt ? (global.tiktokCode || "") : str(saved.tiktokCode);

  return {
    facebookPixelId: fbIds[0] || "",
    facebookPixelIds: fbIds,
    tiktokPixelId: ttIds[0] || "",
    tiktokPixelIds: ttIds,
    tiktokCode,
  };
}

export function hasGlobalTikTokPixel(): boolean {
  const global = getSiteConfig();
  return getTikTokPixelIds(global).length > 0 || Boolean(global.tiktokCode);
}

export function hasGlobalFacebookPixel(): boolean {
  return getFacebookPixelIds(getSiteConfig()).length > 0;
}

export function savePixelConfig(config: PixelConfig) {
  if (typeof window === "undefined") return;
  const global = getSiteConfig();
  const emptyFallback: PixelConfig = {
    facebookPixelId: "",
    facebookPixelIds: [],
    tiktokPixelId: "",
    tiktokPixelIds: [],
    tiktokCode: "",
  };
  const normalized = normalizePublicPixelConfig(config, emptyFallback);
  const globalFbIds = getFacebookPixelIds(global);
  const globalTtIds = getTikTokPixelIds(global);
  const nextFbIds = normalized.facebookPixelIds ?? [];
  const nextTtIds = normalized.tiktokPixelIds ?? [];

  if (hasGlobalFacebookPixel() && nextFbIds.join(",") !== globalFbIds.join(",")) {
    throw new Error("Le pixel Meta global doit être modifié dans la configuration du site, pas dans le stockage local.");
  }
  if (
    hasGlobalTikTokPixel() &&
    (nextTtIds.join(",") !== globalTtIds.join(",") || normalized.tiktokCode !== (global.tiktokCode || ""))
  ) {
    throw new Error("Le pixel TikTok global doit être modifié dans la configuration du site, pas dans le stockage local.");
  }
  localStorage.setItem(PIXEL_KEY, JSON.stringify(normalized));
  initializePixels();
}

export function applyServerPixelConfig(config: Partial<PixelConfig>): PixelConfig {
  const normalized = normalizePublicPixelConfig(config, {
    facebookPixelId: "",
    facebookPixelIds: [],
    tiktokPixelId: "",
    tiktokPixelIds: [],
    tiktokCode: "",
  });
  if (typeof window === "undefined") return normalized;
  const win = window as TrackingWindow;
  const prev = win.__MISS_SITE_PIXEL_CONFIG;
  const prevFb = getFacebookPixelIds(prev).join(",");
  const nextFb = getFacebookPixelIds(normalized).join(",");
  const prevTt = getTikTokPixelIds(prev).join(",");
  const nextTt = getTikTokPixelIds(normalized).join(",");
  win.__MISS_SITE_PIXEL_CONFIG = normalized;
  if (prevFb !== nextFb) {
    win.__missMetaStatus = undefined;
  }
  if (prevTt !== nextTt) {
    win.__missTikTokStatus = undefined;
  }
  try {
    localStorage.setItem(PIXEL_KEY, JSON.stringify(normalized));
  } catch { /* ignore storage restrictions */ }
  initializePixels();
  win.dispatchEvent?.(new Event("miss-pixel-status"));
  return normalized;
}

function reportMetaStatus(win: TrackingWindow, allIds: string[], status: SDKStatus) {
  win.__missMetaStatus = status;
  const map = (win.__missMetaStatuses ??= {});
  for (const pid of allIds) {
    map[pid] = { ...status, pixelId: pid };
  }
  win.dispatchEvent?.(new Event("miss-pixel-status"));
}

function installFacebook(ids: string[], win: TrackingWindow) {
  if (ids.length === 0 || typeof document === "undefined") return;
  const initialized = win.__missMetaIds ??= new Set();
  const newlyAdded: string[] = [];

  for (const id of ids) {
    if (!id || initialized.has(id)) continue;
    if (!win.fbq) {
      const fbq: MetaQueue = (...args: unknown[]) => {
        if (fbq.callMethod) fbq.callMethod.apply(fbq, args);
        else (fbq.queue ??= []).push(args);
      };
      fbq.loaded = true; fbq.version = "2.0"; fbq.queue = []; fbq.push = fbq;
      win.fbq = fbq; win._fbq ??= fbq;
    }
    if (!document.querySelector("script[data-miss-facebook-pixel]")) {
      const script = document.createElement("script");
      script.async = true; script.src = "https://connect.facebook.net/en_US/fbevents.js";
      script.dataset.missFacebookPixel = id;
      script.onload = () => reportMetaStatus(win, ids, { pixelId: id, stage: "loaded", src: script.src, error: "" });
      script.onerror = () => reportMetaStatus(win, ids, { pixelId: id, stage: "error", src: script.src, error: "Le script Meta a été bloqué ou n'est pas accessible." });
      reportMetaStatus(win, ids, { pixelId: id, stage: "loading", src: script.src, error: "" });
      document.head.appendChild(script);
    } else if (win.__missMetaStatus && !(win.__missMetaStatuses?.[id])) {
      (win.__missMetaStatuses ??= {})[id] = { ...win.__missMetaStatus, pixelId: id };
    }
    win.fbq("init", id);
    initialized.add(id);
    newlyAdded.push(id);
  }

  if (newlyAdded.length > 0 && win.fbq) {
    if (!win.__missMetaPageViewSent) {
      win.fbq("track", "PageView");
      win.__missMetaPageViewSent = true;
    } else {
      for (const id of newlyAdded) {
        win.fbq("trackSingle", id, "PageView");
      }
    }
  }
}

function reportTikTokStatus(win: TrackingWindow, status: SDKStatus) {
  win.__missTikTokStatus = status;
  (win.__missTikTokStatuses ??= {})[status.pixelId] = status;
  win.dispatchEvent?.(new Event("miss-pixel-status"));
}

function installTikTok(ids: string[], customCode: string, win: TrackingWindow) {
  if (typeof document === "undefined" || (ids.length === 0 && !customCode)) return;
  if (customCode) {
    if (!document.querySelector("script[data-miss-tiktok-custom]")) {
      const script = document.createElement("script");
      script.textContent = customCode.replace(/<\/?script[^>]*>/gi, "");
      script.dataset.missTiktokCustom = "true"; document.head.appendChild(script);
    }
  }
  if (ids.length === 0) return;

  const initialized = win.__missTikTokIds ??= new Set();
  const newlyAdded: string[] = [];

  for (const id of ids) {
    if (!id || initialized.has(id)) continue;
    win.TiktokAnalyticsObject = "ttq";
    const ttq = win.ttq ??= [] as unknown as TikTokQueue;
    const methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent"];
    ttq.methods ??= methods;
    ttq.setAndDefer ??= (target, method) => {
      const obj = target as unknown as Record<string, unknown>;
      if (typeof obj[method] !== "function") obj[method] = (...args: unknown[]) => target.push([method, ...args]);
    };
    methods.forEach(method => ttq.setAndDefer!(ttq, method));
    ttq.instance ??= instanceId => {
      const instance = (ttq._i ??= {})[instanceId] ??= [];
      methods.forEach(method => ttq.setAndDefer!(instance, method));
      return instance;
    };
    ttq.load ??= (pixelId, options = {}) => {
      const sdk = "https://analytics.tiktok.com/i18n/pixel/events.js";
      const instance = (ttq._i ??= {})[pixelId] ??= [];
      instance._u = sdk; (ttq._t ??= {})[pixelId] = Date.now(); (ttq._o ??= {})[pixelId] = options;
      const script = document.createElement("script"); script.async = true;
      script.src = `${sdk}?sdkid=${encodeURIComponent(pixelId)}&lib=ttq`;
      script.dataset.missTiktokPixel = pixelId;
      script.onload = () => reportTikTokStatus(win, { pixelId, stage: "loaded", src: script.src, error: "" });
      script.onerror = () => reportTikTokStatus(win, { pixelId, stage: "error", src: script.src, error: "Le script TikTok a été bloqué ou n'est pas accessible." });
      reportTikTokStatus(win, { pixelId, stage: "loading", src: script.src, error: "" });
      document.head.appendChild(script);
    };
    ttq.load(id);
    initialized.add(id);
    newlyAdded.push(id);
  }

  if (newlyAdded.length > 0 && win.ttq) {
    if (!win.__missTikTokPageSent) {
      win.ttq.page?.();
      win.__missTikTokPageSent = true;
    } else {
      for (const id of newlyAdded) {
        const inst = win.ttq.instance?.(id);
        inst?.page?.();
      }
    }
  }
}

export function initializePixels() {
  if (typeof window === "undefined") return;
  const config = getPixelConfig();
  const win = window as TrackingWindow;
  installFacebook(getFacebookPixelIds(config), win);
  installTikTok(getTikTokPixelIds(config), config.tiktokCode, win);
}

export function getPixelDiagnostics() {
  const config = getPixelConfig();
  const pixelIds = getTikTokPixelIds(config);
  const win = typeof window === "undefined" ? undefined : window as TrackingWindow;
  const status = win?.__missTikTokStatus;
  const statuses = win?.__missTikTokStatuses ?? {};
  const items: PixelDiagnosticItem[] = pixelIds.map(pid => {
    const st = statuses[pid] ?? (status?.pixelId === pid ? status : undefined);
    const registered = Boolean(win?.ttq?._i?.[pid]?.info?.pixelCode === pid);
    return {
      pixelId: pid,
      stage: st?.stage ?? "not-loaded",
      error: st?.error ?? "",
      registered,
    };
  });
  return {
    pixelId: config.tiktokPixelId,
    pixelIds,
    items,
    global: hasGlobalTikTokPixel(),
    stage: (items[0]?.stage ?? status?.stage ?? "not-loaded") as SDKStage,
    error: items.find(i => i.error)?.error ?? status?.error ?? "",
    registered: pixelIds.length > 0 && items.every(i => i.registered),
    events: win?.__missPixelEvents ?? [],
  };
}

export function getMetaPixelDiagnostics() {
  const config = getPixelConfig();
  const pixelIds = getFacebookPixelIds(config);
  const win = typeof window === "undefined" ? undefined : window as TrackingWindow;
  const status = win?.__missMetaStatus;
  const statuses = win?.__missMetaStatuses ?? {};
  let sdkPixels: Array<{ id?: string | number }> = [];
  try {
    sdkPixels = win?.fbq?.getState?.().pixels ?? [];
  } catch { /* L'enregistrement n'est pas encore confirmé par le SDK. */ }
  const items: PixelDiagnosticItem[] = pixelIds.map(pid => {
    const st = statuses[pid] ?? status;
    const registered = sdkPixels.some(pixel => String(pixel.id) === pid);
    return {
      pixelId: pid,
      stage: st?.stage ?? "not-loaded",
      error: st?.error ?? "",
      registered,
    };
  });
  return {
    pixelId: config.facebookPixelId,
    pixelIds,
    items,
    global: hasGlobalFacebookPixel(),
    stage: (items[0]?.stage ?? status?.stage ?? "not-loaded") as SDKStage,
    error: items.find(i => i.error)?.error ?? status?.error ?? "",
    registered: pixelIds.length > 0 && items.every(i => i.registered),
    events: win?.__missPixelEvents ?? [],
  };
}

export function identifyTikTokUser(phone: string, name?: string) {
  if (typeof window === "undefined") return;
  const config = getPixelConfig();
  if (getTikTokPixelIds(config).length === 0 && !config.tiktokCode) return;
  const win = window as TrackingWindow;
  const cleanPhone = phone.replace(/[\s\-\.]/g, "");
  if (!cleanPhone) return;
  const e164 = cleanPhone.startsWith("0")
    ? `+213${cleanPhone.slice(1)}`
    : cleanPhone.startsWith("+")
    ? cleanPhone
    : `+213${cleanPhone}`;
  try {
    win.ttq?.identify?.({
      phone_number: e164,
      name: name?.trim() || undefined,
    });
  } catch {}
}

function buildTikTokPayload(data: Record<string, unknown>) {
  const contentIds = Array.isArray(data.content_ids) ? data.content_ids : [];
  const firstId = String(data.content_id ?? contentIds[0] ?? "product");
  const contentName = String(data.content_name ?? firstId);
  const numericValue = typeof data.value === "number" ? data.value : Number(data.value) || 0;
  const qty = typeof data.quantity === "number" ? data.quantity : 1;
  return {
    content_type: "product",
    content_id: firstId,
    content_name: contentName,
    contents: [
      {
        content_id: firstId,
        content_type: "product",
        content_name: contentName,
        quantity: qty,
        price: numericValue,
      },
    ],
    value: numericValue,
    currency: String(data.currency ?? "DZD"),
    ...data,
  };
}

export function trackPixelEvent(name: PixelEvent, data: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const config = getPixelConfig(); initializePixels(); const win = window as TrackingWindow;

  const rawPhone = String(data.phone ?? data.phone_number ?? "");
  if (rawPhone) {
    identifyTikTokUser(rawPhone, String(data.customer ?? data.name ?? ""));
  }

  if (getFacebookPixelIds(config).length > 0) win.fbq?.("track", name, data);
  if (getTikTokPixelIds(config).length > 0 || config.tiktokCode) {
    const tiktokPayload = buildTikTokPayload(data);
    win.ttq?.track?.(name, tiktokPayload);
    if (name === "Purchase") {
      win.ttq?.track?.("CompletePayment", tiktokPayload);
      win.ttq?.track?.("PlaceAnOrder", tiktokPayload);
      win.ttq?.track?.("SubmitForm", tiktokPayload);
    }
  }
  if (name === "ViewContent") {
    const contentIds = Array.isArray(data.content_ids) ? data.content_ids : [];
    const prodId = String(data.content_id ?? contentIds[0] ?? "").trim();
    const prodName = String(data.content_name ?? "").trim();
    if (prodId) {
      trackSiteVisit({
        productId: prodId,
        productName: prodName || prodId,
      });
    }
  }
  win.__missPixelEvents = [...(win.__missPixelEvents ?? []), { name, at: new Date().toISOString() }].slice(-10);
  win.dispatchEvent?.(new Event("miss-pixel-status"));
}
