import type { VisitSource } from "@shared/siteVisits";

const VISITOR_STORAGE_KEY = "ms_anon_visitor_id";
let lastTrackedSignature = "";
let lastTrackedAt = 0;

function getAnonVisitorId(): string {
  try {
    let existing = localStorage.getItem(VISITOR_STORAGE_KEY);
    if (!existing) {
      existing =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? `v-${crypto.randomUUID().slice(0, 12)}`
          : `v-${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(VISITOR_STORAGE_KEY, existing);
    }
    return existing;
  } catch {
    return "";
  }
}

function detectTrafficSource(): VisitSource {
  if (typeof window === "undefined") return "direct";
  try {
    const params = new URLSearchParams(window.location.search);
    const utm = (params.get("utm_source") || "").toLowerCase();
    if (params.has("fbclid") || /facebook|fb|instagram|ig|meta/.test(utm)) return "facebook";
    if (params.has("ttclid") || /tiktok|tt/.test(utm)) return "tiktok";
    if (params.has("gclid") || /google/.test(utm)) return "google";
    const ref = (document.referrer || "").toLowerCase();
    if (/facebook\.com|fb\.com|l\.instagram\.com|instagram\.com/.test(ref)) return "facebook";
    if (/tiktok\.com/.test(ref)) return "tiktok";
    if (/google\./.test(ref)) return "google";
    if (ref && !ref.includes(window.location.host)) return "other";
    return "direct";
  } catch {
    return "direct";
  }
}

export function trackSiteVisit(params: {
  productId: string;
  productName: string;
  slug?: string;
  path?: string;
}) {
  if (typeof window === "undefined" || typeof fetch !== "function") return;
  const currentPath = params.path || window.location?.pathname || "/";
  if (currentPath.startsWith("/admin")) return;
  if (params.productName === "Vérification du pixel") return;

  const signature = `${currentPath}|${params.productId}`;
  const now = Date.now();
  if (signature === lastTrackedSignature && now - lastTrackedAt < 4000) {
    return;
  }
  lastTrackedSignature = signature;
  lastTrackedAt = now;

  try {
    const body = JSON.stringify({
      productId: params.productId,
      productName: params.productName,
      slug: params.slug || "",
      path: currentPath,
      source: detectTrafficSource(),
      visitorId: getAnonVisitorId(),
    });
    void fetch("/api/analytics/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Silent fallback when running in restricted tests or offline
  }
}
