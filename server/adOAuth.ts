import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { FinanceAdCurrency, FinanceAdDiscoveredAccount, FinanceAdPlatform } from "../shared/finance";
import { createContext } from "./_core/context";
import { syncMetaAdInsights, syncTikTokAdInsights } from "./adPlatforms";
import { ensureCheckoutStoreReady } from "./checkout";
import { getEffectiveAdOAuthAppConfig, saveFinanceAdOAuthConnection } from "./financeStore";

export const AD_OAUTH_NONCE_COOKIE = "miss_ad_oauth_nonce";
const STATE_TTL_MS = 15 * 60 * 1000;

type OAuthStatePayload = {
  p: FinanceAdPlatform;
  n: string;
  t: number;
};

function getStateSecret(): string {
  const adminPwd = process.env.ADMIN_PASSWORD?.trim() || "DBZ1995";
  const jwt = process.env.MANUS_JWT_SECRET?.trim() || "miss-sensuelle-ad-oauth";
  return `ad-oauth-v1:${adminPwd}:${jwt}`;
}

function normalizeCurrency(raw?: string | null): FinanceAdCurrency {
  const c = String(raw || "USD").trim().toUpperCase();
  if (c === "DZD") return "DZD";
  if (c === "EUR") return "EUR";
  return "USD";
}

function isOwnerContextUser(
  user: { role?: string | null; openId?: string | null; loginMethod?: string | null } | null | undefined
): boolean {
  if (!user || user.role !== "admin") return false;
  return user.loginMethod !== "staff_code" && !String(user.openId || "").startsWith("staff:");
}

function isHttpsRequest(req: Request): boolean {
  if (req.protocol === "https") return true;
  const xfProto = req.headers["x-forwarded-proto"];
  const raw = typeof xfProto === "string" ? xfProto : Array.isArray(xfProto) ? xfProto[0] : "";
  return raw.split(",").some(v => v.trim().toLowerCase() === "https");
}

export function resolvePublicOrigin(req: Request): string {
  const xfProto = req.headers["x-forwarded-proto"];
  const proto =
    (typeof xfProto === "string" ? xfProto.split(",")[0]?.trim() : undefined) ||
    req.protocol ||
    "https";
  const xfHost = req.headers["x-forwarded-host"];
  const host =
    (typeof xfHost === "string" ? xfHost.split(",")[0]?.trim() : undefined) ||
    req.headers.host ||
    "";
  if (host) {
    return `${proto}://${host}`.replace(/\/$/, "");
  }
  return (process.env.RENDER_EXTERNAL_URL || "https://missensuelle.onrender.com").replace(/\/$/, "");
}

export function getAdOAuthCallbackUrl(origin: string, platform: FinanceAdPlatform): string {
  return `${origin.replace(/\/$/, "")}/api/ad-oauth/${platform}/callback`;
}

export function createAdOAuthState(platform: FinanceAdPlatform, nonce = randomBytes(16).toString("hex")): {
  state: string;
  nonce: string;
} {
  const payload: OAuthStatePayload = {
    p: platform,
    n: nonce,
    t: Date.now(),
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", getStateSecret()).update(encoded).digest("base64url");
  return { state: `${encoded}.${sig}`, nonce };
}

export function verifyAdOAuthState(
  rawState: string,
  expectedPlatform: FinanceAdPlatform,
  cookieNonce?: string,
  nowMs: number = Date.now()
): { valid: boolean; reason?: string } {
  const parts = rawState.split(".");
  if (parts.length !== 2) return { valid: false, reason: "Format state OAuth invalide" };
  const [encoded, sig] = parts;
  if (!encoded || !sig) return { valid: false, reason: "State OAuth incomplet" };

  const expectedSig = createHmac("sha256", getStateSecret()).update(encoded).digest("base64url");
  if (sig.length !== expectedSig.length) return { valid: false, reason: "Signature state invalide" };
  try {
    if (!timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expectedSig, "utf8"))) {
      return { valid: false, reason: "Signature state OAuth invalide" };
    }
  } catch {
    return { valid: false, reason: "Signature state OAuth illisible" };
  }

  let parsed: Partial<OAuthStatePayload>;
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<OAuthStatePayload>;
  } catch {
    return { valid: false, reason: "Payload state OAuth corrompu" };
  }

  if (parsed.p !== expectedPlatform) return { valid: false, reason: "Plateforme OAuth incompatible" };
  if (typeof parsed.n !== "string" || !parsed.n || parsed.n !== cookieNonce) {
    return { valid: false, reason: "Session OAuth expirée (cookie CSRF manquant), réessaie." };
  }
  if (typeof parsed.t !== "number" || nowMs - parsed.t > STATE_TTL_MS || nowMs + 60_000 < parsed.t) {
    return { valid: false, reason: "Lien OAuth expiré (15 min max), réessaie." };
  }

  return { valid: true };
}

export function buildMetaAuthorizeUrl(params: {
  appId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", params.appId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  url.searchParams.set("scope", "ads_read");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("auth_type", "rerequest");
  return url.toString();
}

export function buildTikTokAuthorizeUrl(params: {
  appId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL("https://business-api.tiktok.com/portal/auth");
  url.searchParams.set("app_id", params.appId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  return url.toString();
}

function mapMetaStatusLabel(statusCode?: number): string {
  if (statusCode === 1) return "ACTIVE";
  if (statusCode === 2) return "DISABLED";
  if (statusCode === 3) return "UNSETTLED";
  if (statusCode === 7) return "PENDING_RISK_REVIEW";
  if (statusCode === 9) return "IN_GRACE_PERIOD";
  if (statusCode === 101) return "CLOSED";
  return statusCode ? `STATUS_${statusCode}` : "ACTIVE";
}

export async function exchangeMetaOAuthCode(params: {
  appId: string;
  appSecret: string;
  code: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<{
  accessToken: string;
  tokenExpiresAt?: string;
  userName?: string;
  discoveredAccounts: FinanceAdDiscoveredAccount[];
}> {
  const fx = params.fetchImpl || fetch;

  const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", params.appId);
  tokenUrl.searchParams.set("redirect_uri", params.redirectUri);
  tokenUrl.searchParams.set("client_secret", params.appSecret);
  tokenUrl.searchParams.set("code", params.code);

  const tokenRes = await fx(tokenUrl.toString(), {
    method: "GET",
    signal: AbortSignal.timeout(15_000),
  });
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(tokenJson.error?.message || `Échec échange code Meta (HTTP ${tokenRes.status})`);
  }

  let accessToken = tokenJson.access_token;
  let expiresInSec = typeof tokenJson.expires_in === "number" ? tokenJson.expires_in : undefined;

  // Attempt exchange for 60-day long-lived token
  try {
    const llUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    llUrl.searchParams.set("grant_type", "fb_exchange_token");
    llUrl.searchParams.set("client_id", params.appId);
    llUrl.searchParams.set("client_secret", params.appSecret);
    llUrl.searchParams.set("fb_exchange_token", accessToken);

    const llRes = await fx(llUrl.toString(), {
      method: "GET",
      signal: AbortSignal.timeout(12_000),
    });
    const llJson = (await llRes.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (llRes.ok && llJson.access_token) {
      accessToken = llJson.access_token;
      if (typeof llJson.expires_in === "number") {
        expiresInSec = llJson.expires_in;
      }
    }
  } catch {
    // Keep initial access token if long-lived exchange isn't applicable
  }

  const tokenExpiresAt =
    typeof expiresInSec === "number" && Number.isFinite(expiresInSec) && expiresInSec > 0
      ? new Date(Date.now() + expiresInSec * 1000).toISOString()
      : undefined;

  let userName: string | undefined;
  try {
    const meUrl = new URL("https://graph.facebook.com/v21.0/me");
    meUrl.searchParams.set("fields", "id,name");
    meUrl.searchParams.set("access_token", accessToken);
    const meRes = await fx(meUrl.toString(), { method: "GET", signal: AbortSignal.timeout(10_000) });
    if (meRes.ok) {
      const meJson = (await meRes.json()) as { name?: string };
      if (meJson.name) userName = meJson.name.trim();
    }
  } catch {
    // Non-blocking
  }

  const accounts: FinanceAdDiscoveredAccount[] = [];
  let nextUrl: string | null = (() => {
    const u = new URL("https://graph.facebook.com/v21.0/me/adaccounts");
    u.searchParams.set("fields", "id,account_id,name,currency,account_status");
    u.searchParams.set("limit", "50");
    u.searchParams.set("access_token", accessToken);
    return u.toString();
  })();

  let pages = 0;
  while (nextUrl && pages < 5) {
    pages++;
    const accRes = await fx(nextUrl, { method: "GET", signal: AbortSignal.timeout(15_000) });
    const accJson = (await accRes.json()) as {
      data?: Array<{
        id?: string;
        account_id?: string;
        name?: string;
        currency?: string;
        account_status?: number;
      }>;
      paging?: { next?: string };
      error?: { message?: string };
    };
    if (!accRes.ok || accJson.error) {
      throw new Error(
        accJson.error?.message || `Impossible de lister les comptes pub Meta (HTTP ${accRes.status})`
      );
    }
    for (const raw of accJson.data || []) {
      const id = String(raw.id || (raw.account_id ? `act_${raw.account_id}` : "")).trim();
      if (!id) continue;
      accounts.push({
        id: id.startsWith("act_") ? id : `act_${id}`,
        name: String(raw.name || id).trim(),
        currency: normalizeCurrency(raw.currency),
        status: mapMetaStatusLabel(raw.account_status),
      });
    }
    nextUrl = accJson.paging?.next || null;
  }

  return {
    accessToken,
    tokenExpiresAt,
    userName,
    discoveredAccounts: accounts,
  };
}

export async function exchangeTikTokOAuthCode(params: {
  appId: string;
  appSecret: string;
  authCode: string;
  fetchImpl?: typeof fetch;
}): Promise<{
  accessToken: string;
  discoveredAccounts: FinanceAdDiscoveredAccount[];
}> {
  const fx = params.fetchImpl || fetch;

  const tokenRes = await fx("https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: params.appId,
      secret: params.appSecret,
      auth_code: params.authCode,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const tokenJson = (await tokenRes.json()) as {
    code?: number;
    message?: string;
    data?: {
      access_token?: string;
      advertiser_ids?: Array<string | number>;
    };
  };

  const accessToken = String(tokenJson.data?.access_token || "").trim();
  if (!tokenRes.ok || (typeof tokenJson.code === "number" && tokenJson.code !== 0) || !accessToken) {
    throw new Error(tokenJson.message || `Échec échange OAuth TikTok (HTTP ${tokenRes.status})`);
  }

  const advIds = Array.isArray(tokenJson.data?.advertiser_ids)
    ? Array.from(new Set(tokenJson.data.advertiser_ids.map(id => String(id).trim()).filter(Boolean)))
    : [];

  const detailsById = new Map<string, FinanceAdDiscoveredAccount>();
  for (let i = 0; i < advIds.length; i += 100) {
    const chunk = advIds.slice(i, i + 100);
    try {
      const infoUrl = new URL("https://business-api.tiktok.com/open_api/v1.3/advertiser/info/");
      infoUrl.searchParams.set("advertiser_ids", JSON.stringify(chunk));
      infoUrl.searchParams.set("fields", JSON.stringify(["advertiser_id", "name", "currency", "status"]));
      const infoRes = await fx(infoUrl.toString(), {
        method: "GET",
        headers: { "Access-Token": accessToken },
        signal: AbortSignal.timeout(12_000),
      });
      if (infoRes.ok) {
        const infoJson = (await infoRes.json()) as {
          code?: number;
          data?: {
            list?: Array<{
              advertiser_id?: string | number;
              name?: string;
              currency?: string;
              status?: string;
            }>;
          };
        };
        if (infoJson.code === undefined || infoJson.code === 0) {
          for (const item of infoJson.data?.list || []) {
            const id = String(item.advertiser_id || "").trim();
            if (!id) continue;
            detailsById.set(id, {
              id,
              name: String(item.name || `TikTok ${id}`).trim(),
              currency: normalizeCurrency(item.currency),
              status: String(item.status || "STATUS_ENABLE").trim(),
            });
          }
        }
      }
    } catch {
      // Non-blocking; fall back to raw advertiser_ids below
    }
  }

  const discoveredAccounts = advIds.map(
    id =>
      detailsById.get(id) || {
        id,
        name: `TikTok ${id}`,
        currency: "USD" as FinanceAdCurrency,
        status: "ENABLE",
      }
  );

  return { accessToken, discoveredAccounts };
}

function redirectToFinance(
  res: Response,
  params: Record<string, string>
) {
  const url = new URL("/admin", "https://placeholder.local");
  url.searchParams.set("section", "finance");
  url.searchParams.set("finTab", "ads");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  res.redirect(302, `${url.pathname}${url.search}`);
}

export function registerAdOAuthRoutes(app: Express) {
  app.get("/api/ad-oauth/:platform/start", async (req: Request, res: Response) => {
    const rawPlat = req.params.platform;
    if (rawPlat !== "meta" && rawPlat !== "tiktok") {
      res.status(400).json({ error: "Plateforme OAuth invalide" });
      return;
    }
    const platform: FinanceAdPlatform = rawPlat;

    await ensureCheckoutStoreReady().catch(() => {});
    const ctx = await createContext({ req, res } as CreateExpressContextOptions);
    if (!isOwnerContextUser(ctx.user)) {
      redirectToFinance(res, {
        oauth: "error",
        platform,
        oauthMsg: "Connecte-toi en tant que Propriétaire pour relier un compte pub.",
      });
      return;
    }

    const cfg = getEffectiveAdOAuthAppConfig(platform);
    if (!cfg.configured) {
      redirectToFinance(res, {
        oauth: "error",
        platform,
        oauthMsg: `Configure d’abord l’App ID et l’App Secret ${platform === "meta" ? "Meta" : "TikTok"} ci-dessous (1 seule fois).`,
      });
      return;
    }

    const origin = resolvePublicOrigin(req);
    const redirectUri = getAdOAuthCallbackUrl(origin, platform);
    const { state, nonce } = createAdOAuthState(platform);

    res.cookie(AD_OAUTH_NONCE_COOKIE, nonce, {
      httpOnly: true,
      sameSite: "lax",
      secure: isHttpsRequest(req),
      path: "/api/ad-oauth",
      maxAge: STATE_TTL_MS,
    });

    const targetUrl =
      platform === "meta"
        ? buildMetaAuthorizeUrl({ appId: cfg.appId, redirectUri, state })
        : buildTikTokAuthorizeUrl({ appId: cfg.appId, redirectUri, state });

    res.redirect(302, targetUrl);
  });

  app.get("/api/ad-oauth/:platform/callback", async (req: Request, res: Response) => {
    const rawPlat = req.params.platform;
    if (rawPlat !== "meta" && rawPlat !== "tiktok") {
      res.status(400).json({ error: "Plateforme OAuth invalide" });
      return;
    }
    const platform: FinanceAdPlatform = rawPlat;

    const oauthError =
      typeof req.query.error_description === "string"
        ? req.query.error_description
        : typeof req.query.error_message === "string"
          ? req.query.error_message
          : typeof req.query.error === "string"
            ? req.query.error
            : "";

    if (oauthError) {
      redirectToFinance(res, {
        oauth: "error",
        platform,
        oauthMsg: oauthError.slice(0, 180),
      });
      return;
    }

    await ensureCheckoutStoreReady().catch(() => {});
    const ctx = await createContext({ req, res } as CreateExpressContextOptions);
    if (!isOwnerContextUser(ctx.user)) {
      redirectToFinance(res, {
        oauth: "error",
        platform,
        oauthMsg: "Session Propriétaire requise pour finaliser la connexion pub.",
      });
      return;
    }

    const stateParam = typeof req.query.state === "string" ? req.query.state : "";
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    const nonceCookie = cookies[AD_OAUTH_NONCE_COOKIE];
    res.clearCookie(AD_OAUTH_NONCE_COOKIE, { path: "/api/ad-oauth" });

    const stateCheck = verifyAdOAuthState(stateParam, platform, nonceCookie);
    if (!stateCheck.valid) {
      redirectToFinance(res, {
        oauth: "error",
        platform,
        oauthMsg: stateCheck.reason || "Vérification OAuth échouée.",
      });
      return;
    }

    const cfg = getEffectiveAdOAuthAppConfig(platform);
    if (!cfg.configured) {
      redirectToFinance(res, {
        oauth: "error",
        platform,
        oauthMsg: "Configuration App OAuth introuvable.",
      });
      return;
    }

    const origin = resolvePublicOrigin(req);
    const redirectUri = getAdOAuthCallbackUrl(origin, platform);

    try {
      if (platform === "meta") {
        const code = typeof req.query.code === "string" ? req.query.code : "";
        if (!code) throw new Error("Code d’autorisation Meta manquant.");

        const result = await exchangeMetaOAuthCode({
          appId: cfg.appId,
          appSecret: cfg.appSecret,
          code,
          redirectUri,
        });

        await saveFinanceAdOAuthConnection({
          platform: "meta",
          accessToken: result.accessToken,
          userName: result.userName,
          tokenExpiresAt: result.tokenExpiresAt,
          discoveredAccounts: result.discoveredAccounts,
        });

        const syncRes =
          result.discoveredAccounts.length > 0 ? await syncMetaAdInsights().catch(() => null) : null;

        redirectToFinance(res, {
          oauth: "success",
          platform: "meta",
          accounts: String(result.discoveredAccounts.length),
          synced: String(syncRes?.synced ?? 0),
        });
      } else {
        const authCode =
          typeof req.query.auth_code === "string"
            ? req.query.auth_code
            : typeof req.query.code === "string"
              ? req.query.code
              : "";
        if (!authCode) throw new Error("Code d’autorisation TikTok manquant.");

        const result = await exchangeTikTokOAuthCode({
          appId: cfg.appId,
          appSecret: cfg.appSecret,
          authCode,
        });

        await saveFinanceAdOAuthConnection({
          platform: "tiktok",
          accessToken: result.accessToken,
          discoveredAccounts: result.discoveredAccounts,
        });

        const syncRes =
          result.discoveredAccounts.length > 0 ? await syncTikTokAdInsights().catch(() => null) : null;

        redirectToFinance(res, {
          oauth: "success",
          platform: "tiktok",
          accounts: String(result.discoveredAccounts.length),
          synced: String(syncRes?.synced ?? 0),
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la connexion OAuth.";
      redirectToFinance(res, {
        oauth: "error",
        platform,
        oauthMsg: msg.slice(0, 180),
      });
    }
  });
}
