import { sitePixelConfig, type PublicPixelConfig } from "@shared/site-pixels";

export type PixelConfig = PublicPixelConfig;
type PixelEvent = "ViewContent" | "InitiateCheckout" | "Purchase" | "AddToCart";
type MetaQueue = ((...args: unknown[]) => void) & {
  queue?: unknown[]; loaded?: boolean; version?: string; callMethod?: (...args: unknown[]) => void;
  push?: MetaQueue;
  getState?: () => { pixels?: Array<{ id?: string | number }> };
};
type TikTokInstance = unknown[] & { _u?: string; info?: { pixelCode?: string } };
type TikTokQueue = unknown[] & {
  methods?: string[];
  _i?: Record<string, TikTokInstance>;
  _t?: Record<string, number>;
  _o?: Record<string, unknown>;
  page?: () => void;
  track?: (name: string, data?: Record<string, unknown>) => void;
  load?: (id: string, options?: Record<string, unknown>) => void;
  instance?: (id: string) => TikTokInstance;
  setAndDefer?: (target: unknown[], method: string) => void;
};
type SDKStatus = { pixelId: string; stage: "loading" | "loaded" | "error"; src: string; error: string };
type TrackingWindow = Window & {
  fbq?: MetaQueue;
  _fbq?: MetaQueue;
  ttq?: TikTokQueue;
  TiktokAnalyticsObject?: string;
  __MISS_SITE_PIXEL_CONFIG?: PixelConfig;
  __missMetaIds?: Set<string>;
  __missTikTokIds?: Set<string>;
  __missMetaStatus?: SDKStatus;
  __missTikTokStatus?: SDKStatus;
  __missPixelEvents?: Array<{ name: PixelEvent; at: string }>;
};

const PIXEL_KEY = "miss-sensuelle-pixels";

function getSiteConfig(): PixelConfig {
  return typeof window === "undefined" ? sitePixelConfig : (window as TrackingWindow).__MISS_SITE_PIXEL_CONFIG ?? sitePixelConfig;
}

export function getPixelConfig(): PixelConfig {
  if (typeof window === "undefined") return { ...sitePixelConfig };
  const global = getSiteConfig();
  let saved: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PIXEL_KEY) || "{}");
    if (parsed && typeof parsed === "object") saved = parsed as Record<string, unknown>;
  } catch { /* Les pixels du site ne dépendent pas du stockage du navigateur. */ }
  const string = (value: unknown) => typeof value === "string" ? value.trim() : "";
  const globalTikTok = Boolean(global.tiktokPixelId || global.tiktokCode);
  return {
    facebookPixelId: global.facebookPixelId || string(saved.facebookPixelId),
    tiktokPixelId: globalTikTok ? global.tiktokPixelId : string(saved.tiktokPixelId),
    tiktokCode: globalTikTok ? global.tiktokCode : string(saved.tiktokCode),
  };
}

export function hasGlobalTikTokPixel(): boolean {
  const global = getSiteConfig();
  return Boolean(global.tiktokPixelId || global.tiktokCode);
}

export function hasGlobalFacebookPixel(): boolean {
  return Boolean(getSiteConfig().facebookPixelId);
}

export function savePixelConfig(config: PixelConfig) {
  if (typeof window === "undefined") return;
  const global = getSiteConfig();
  if (hasGlobalFacebookPixel() && config.facebookPixelId.trim() !== global.facebookPixelId) {
    throw new Error("Le pixel Meta global doit être modifié dans la configuration du site, pas dans le stockage local.");
  }
  if (hasGlobalTikTokPixel() && (config.tiktokPixelId.trim() !== global.tiktokPixelId || config.tiktokCode.trim() !== global.tiktokCode)) {
    throw new Error("Le pixel TikTok global doit être modifié dans la configuration du site, pas dans le stockage local.");
  }
  const normalized = { facebookPixelId: config.facebookPixelId.trim(), tiktokPixelId: config.tiktokPixelId.trim(), tiktokCode: config.tiktokCode.trim() };
  localStorage.setItem(PIXEL_KEY, JSON.stringify(normalized));
  initializePixels();
}

function reportMetaStatus(win: TrackingWindow, status: SDKStatus) {
  win.__missMetaStatus = status;
  win.dispatchEvent?.(new Event("miss-pixel-status"));
}

function installFacebook(id: string, win: TrackingWindow) {
  if (!id || typeof document === "undefined") return;
  const initialized = win.__missMetaIds ??= new Set();
  if (initialized.has(id)) return;
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
    script.onload = () => reportMetaStatus(win, { pixelId: id, stage: "loaded", src: script.src, error: "" });
    script.onerror = () => reportMetaStatus(win, { pixelId: id, stage: "error", src: script.src, error: "Le script Meta a été bloqué ou n'est pas accessible." });
    reportMetaStatus(win, { pixelId: id, stage: "loading", src: script.src, error: "" });
    document.head.appendChild(script);
  }
  win.fbq("init", id); win.fbq("track", "PageView"); initialized.add(id);
}

function reportStatus(win: TrackingWindow, status: SDKStatus) {
  win.__missTikTokStatus = status;
  win.dispatchEvent?.(new Event("miss-pixel-status"));
}

function installTikTok(id: string, customCode: string, win: TrackingWindow) {
  if (typeof document === "undefined" || (!id && !customCode)) return;
  if (customCode) {
    if (!document.querySelector("script[data-miss-tiktok-custom]")) {
      const script = document.createElement("script");
      script.textContent = customCode.replace(/<\/?script[^>]*>/gi, "");
      script.dataset.missTiktokCustom = "true"; document.head.appendChild(script);
    }
    return;
  }
  const initialized = win.__missTikTokIds ??= new Set();
  if (initialized.has(id)) return;
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
    script.onload = () => reportStatus(win, { pixelId, stage: "loaded", src: script.src, error: "" });
    script.onerror = () => reportStatus(win, { pixelId, stage: "error", src: script.src, error: "Le script TikTok a été bloqué ou n'est pas accessible." });
    reportStatus(win, { pixelId, stage: "loading", src: script.src, error: "" });
    document.head.appendChild(script);
  };
  ttq.load(id); ttq.page?.(); initialized.add(id);
}

export function initializePixels() {
  if (typeof window === "undefined") return;
  const config = getPixelConfig(); const win = window as TrackingWindow;
  installFacebook(config.facebookPixelId, win);
  installTikTok(config.tiktokPixelId, config.tiktokCode, win);
}

export function getPixelDiagnostics() {
  const config = getPixelConfig();
  const win = typeof window === "undefined" ? undefined : window as TrackingWindow;
  const status = win?.__missTikTokStatus;
  return {
    pixelId: config.tiktokPixelId,
    global: hasGlobalTikTokPixel(),
    stage: status?.stage ?? "not-loaded" as "loading" | "loaded" | "error" | "not-loaded",
    error: status?.error ?? "",
    registered: Boolean(config.tiktokPixelId && win?.ttq?._i?.[config.tiktokPixelId]?.info?.pixelCode === config.tiktokPixelId),
    events: win?.__missPixelEvents ?? [],
  };
}

export function getMetaPixelDiagnostics() {
  const config = getPixelConfig();
  const win = typeof window === "undefined" ? undefined : window as TrackingWindow;
  const status = win?.__missMetaStatus;
  let registered = false;
  try {
    registered = Boolean(config.facebookPixelId && win?.fbq?.getState?.().pixels?.some(pixel => String(pixel.id) === config.facebookPixelId));
  } catch { /* L'enregistrement n'est pas encore confirmé par le SDK. */ }
  return {
    pixelId: config.facebookPixelId,
    global: hasGlobalFacebookPixel(),
    stage: status?.stage ?? "not-loaded" as "loading" | "loaded" | "error" | "not-loaded",
    error: status?.error ?? "",
    registered,
    events: win?.__missPixelEvents ?? [],
  };
}

export function trackPixelEvent(name: PixelEvent, data: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const config = getPixelConfig(); initializePixels(); const win = window as TrackingWindow;
  if (config.facebookPixelId) win.fbq?.("track", name, data);
  if (config.tiktokPixelId || config.tiktokCode) {
    win.ttq?.track?.(name, data);
    if (name === "Purchase") {
      const contentIds = Array.isArray(data.content_ids) ? data.content_ids : [];
      const firstId = String(data.content_id ?? contentIds[0] ?? "product");
      const contentName = String(data.content_name ?? firstId);
      const numericValue = typeof data.value === "number" ? data.value : Number(data.value) || 0;
      const tiktokPayload: Record<string, unknown> = {
        content_type: "product",
        content_id: firstId,
        content_name: contentName,
        contents: [
          {
            content_id: firstId,
            content_type: "product",
            content_name: contentName,
            quantity: 1,
            price: numericValue,
          },
        ],
        value: numericValue,
        currency: String(data.currency ?? "DZD"),
        ...data,
      };
      win.ttq?.track?.("CompletePayment", tiktokPayload);
      win.ttq?.track?.("PlaceAnOrder", tiktokPayload);
      win.ttq?.track?.("SubmitForm", tiktokPayload);
    }
  }
  win.__missPixelEvents = [...(win.__missPixelEvents ?? []), { name, at: new Date().toISOString() }].slice(-10);
  win.dispatchEvent?.(new Event("miss-pixel-status"));
}
