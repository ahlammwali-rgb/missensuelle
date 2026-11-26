import { createHash } from "node:crypto";
import type { CheckoutTrackingInput, OrderAttribution, OrderAttributionChannel } from "../shared/checkout";
import { getFacebookPixelIds } from "../shared/site-pixels";
import { getServerPixelConfig, getServerPixelSecrets } from "./persistentStore";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function normalizePhoneForMetaCapi(rawPhone: string): string {
  const clean = rawPhone.replace(/[\s\-\.\(\)]/g, "");
  if (!clean) return "";
  if (clean.startsWith("00")) return clean.slice(2).replace(/\D/g, "");
  if (clean.startsWith("+")) return clean.slice(1).replace(/\D/g, "");
  if (clean.startsWith("0")) return `213${clean.slice(1).replace(/\D/g, "")}`;
  return clean.replace(/\D/g, "");
}

function normalizeTextToken(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .trim();
}

export function buildMetaUserData(input: {
  phone?: string;
  customer?: string;
  wilaya?: string;
  commune?: string;
  externalId?: string;
  clientIp?: string;
  userAgent?: string;
  fbc?: string;
  fbp?: string;
}): Record<string, unknown> {
  const userData: Record<string, unknown> = {
    country: [sha256Hex("dz")],
  };

  const phDigits = input.phone ? normalizePhoneForMetaCapi(input.phone) : "";
  if (phDigits) {
    userData.ph = [sha256Hex(phDigits)];
  }

  const normalizedName = input.customer ? normalizeTextToken(input.customer) : "";
  if (normalizedName) {
    const parts = normalizedName.split(/\s+/).filter(Boolean);
    if (parts[0]) userData.fn = [sha256Hex(parts[0])];
    if (parts.length > 1) userData.ln = [sha256Hex(parts.slice(1).join(" "))];
  }

  const cityRaw = (input.commune || input.wilaya || "").trim().toLowerCase().replace(/[\s-]+/g, "");
  if (cityRaw) {
    userData.ct = [sha256Hex(cityRaw)];
  }

  if (input.externalId?.trim()) {
    userData.external_id = [sha256Hex(input.externalId.trim())];
  }
  if (input.clientIp?.trim()) {
    userData.client_ip_address = input.clientIp.trim();
  }
  if (input.userAgent?.trim()) {
    userData.client_user_agent = input.userAgent.trim().slice(0, 500);
  }
  if (input.fbc?.trim()) {
    userData.fbc = input.fbc.trim();
  }
  if (input.fbp?.trim()) {
    userData.fbp = input.fbp.trim();
  }

  return userData;
}

export function resolveOrderAttribution(
  tracking?: Partial<CheckoutTrackingInput> | null,
  referer?: string
): OrderAttribution {
  const fbclid = (tracking?.fbclid || "").trim();
  const ttclid = (tracking?.ttclid || "").trim();
  const utm = (tracking?.utmSource || "").trim().toLowerCase();
  const sourceUrl = (tracking?.sourceUrl || referer || "").trim();

  let fbc = (tracking?.fbc || "").trim();
  if (!fbc && fbclid) {
    fbc = `fb.1.${Date.now()}.${fbclid}`;
  }
  const fbp = (tracking?.fbp || "").trim();

  let channel: OrderAttributionChannel = "direct";
  if (
    fbc ||
    fbclid ||
    /(^|[\W_])(fb|facebook|ig|instagram|meta)([\W_]|$)/.test(utm) ||
    /facebook\.com|instagram\.com|fb\.me/i.test(sourceUrl)
  ) {
    channel = "facebook";
  } else if (
    ttclid ||
    /(^|[\W_])(tt|tiktok)([\W_]|$)/.test(utm) ||
    /tiktok\.com/i.test(sourceUrl)
  ) {
    channel = "tiktok";
  } else if (
    utm.includes("google") ||
    /gclid=/i.test(sourceUrl)
  ) {
    channel = "google";
  }

  return {
    channel,
    ...(fbc ? { fbc } : {}),
    ...(fbp ? { fbp } : {}),
    ...(fbclid ? { fbclid } : {}),
    ...(ttclid ? { ttclid } : {}),
    ...(utm ? { utmSource: utm } : {}),
    ...(tracking?.eventId?.trim() ? { eventId: tracking.eventId.trim() } : {}),
  };
}

export function resolveCapiTokenForPixel(pixelId: string): string {
  const secrets = getServerPixelSecrets();
  const specific = String(secrets.facebookCapiTokens?.[pixelId] || "").trim();
  if (specific) return specific;
  const def = String(secrets.facebookDefaultCapiToken || "").trim();
  if (def) return def;
  return String(process.env.META_CAPI_ACCESS_TOKEN || "").trim();
}

export type MetaCapiSendResult = {
  pixelId: string;
  ok: boolean;
  eventsReceived?: number;
  fbtraceId?: string;
  error?: string;
};

export async function sendMetaCapiPurchaseEvent(opts: {
  orderNumber: string;
  totalDzd: number;
  productIds: string[];
  numItems: number;
  phone?: string;
  customer?: string;
  wilaya?: string;
  commune?: string;
  attribution?: OrderAttribution;
  sourceUrl?: string;
  clientIp?: string;
  userAgent?: string;
  eventName?: "Purchase" | "ViewContent";
  testEventCode?: string;
  fetchImpl?: typeof fetch;
}): Promise<{
  attempted: number;
  sentCount: number;
  skippedNoToken: number;
  results: MetaCapiSendResult[];
}> {
  const pixelConfig = getServerPixelConfig();
  const pixelIds = getFacebookPixelIds(pixelConfig);
  const secrets = getServerPixelSecrets();
  const testCode = (opts.testEventCode ?? secrets.facebookTestEventCode ?? process.env.META_TEST_EVENT_CODE ?? "").trim();
  const fx = opts.fetchImpl || fetch;

  const eventId = opts.attribution?.eventId || `purchase_${opts.orderNumber}`;
  const eventTime = Math.floor(Date.now() / 1000);
  const userData = buildMetaUserData({
    phone: opts.phone,
    customer: opts.customer,
    wilaya: opts.wilaya,
    commune: opts.commune,
    externalId: opts.orderNumber,
    clientIp: opts.clientIp,
    userAgent: opts.userAgent,
    fbc: opts.attribution?.fbc,
    fbp: opts.attribution?.fbp,
  });

  const payloadBase: Record<string, unknown> = {
    data: [
      {
        event_name: opts.eventName || "Purchase",
        event_time: eventTime,
        action_source: "website",
        event_id: eventId,
        ...(opts.sourceUrl ? { event_source_url: opts.sourceUrl.slice(0, 1000) } : {}),
        user_data: userData,
        custom_data: {
          currency: "DZD",
          value: Math.max(0, Number(opts.totalDzd) || 0),
          content_type: "product",
          content_ids: opts.productIds.length > 0 ? opts.productIds : ["store-product"],
          num_items: Math.max(1, opts.numItems || 1),
          order_id: opts.orderNumber,
        },
      },
    ],
    ...(testCode ? { test_event_code: testCode } : {}),
  };

  let attempted = 0;
  let sentCount = 0;
  let skippedNoToken = 0;
  const results: MetaCapiSendResult[] = [];

  for (const pixelId of pixelIds) {
    const token = resolveCapiTokenForPixel(pixelId);
    if (!token) {
      skippedNoToken++;
      continue;
    }
    attempted++;
    try {
      const endpoint = `https://graph.facebook.com/v21.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(token)}`;
      const res = await fx(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadBase),
        signal: AbortSignal.timeout(10_000),
      });
      const json = (await res.json()) as {
        events_received?: number;
        fbtrace_id?: string;
        error?: { message?: string };
      };
      if (!res.ok || json.error) {
        results.push({
          pixelId,
          ok: false,
          fbtraceId: json.fbtrace_id,
          error: json.error?.message || `Meta CAPI HTTP ${res.status}`,
        });
      } else {
        sentCount++;
        results.push({
          pixelId,
          ok: true,
          eventsReceived: json.events_received ?? 1,
          fbtraceId: json.fbtrace_id,
        });
      }
    } catch (err) {
      results.push({
        pixelId,
        ok: false,
        error: err instanceof Error ? err.message : "Erreur réseau Meta CAPI",
      });
    }
  }

  return { attempted, sentCount, skippedNoToken, results };
}
