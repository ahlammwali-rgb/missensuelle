import { beforeEach, describe, expect, it } from "vitest";
import {
  buildMetaAuthorizeUrl,
  buildTikTokAuthorizeUrl,
  createAdOAuthState,
  exchangeMetaOAuthCode,
  exchangeTikTokOAuthCode,
  verifyAdOAuthState,
} from "./adOAuth";
import {
  buildPublicAdConnectionStatus,
  clearFinanceAdCredentials,
  getActiveAccountIdsForPlatform,
  getEffectiveAdOAuthAppConfig,
  saveFinanceAdOAuthAppConfig,
  saveFinanceAdOAuthConnection,
  setFinanceAdSelectedAccounts,
} from "./financeStore";
import { setServerFinanceState } from "./persistentStore";
import { createDefaultPersistedFinanceState } from "../shared/finance";
import { appRouter } from "./routers";

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Meta & TikTok OAuth integration", () => {
  beforeEach(() => {
    setServerFinanceState(createDefaultPersistedFinanceState());
  });

  it("creates and verifies HMAC-signed OAuth state against CSRF, expiry, and platform mismatch", () => {
    const { state, nonce } = createAdOAuthState("meta", "fixed-nonce-123");
    expect(verifyAdOAuthState(state, "meta", nonce).valid).toBe(true);
    expect(verifyAdOAuthState(state, "tiktok", nonce).valid).toBe(false);
    expect(verifyAdOAuthState(state, "meta", "wrong-nonce").valid).toBe(false);
    expect(verifyAdOAuthState(state, "meta", undefined).valid).toBe(false);
    expect(verifyAdOAuthState(`${state}tamper`, "meta", nonce).valid).toBe(false);
    // Expired (> 15 minutes)
    expect(verifyAdOAuthState(state, "meta", nonce, Date.now() + 20 * 60 * 1000).valid).toBe(false);
  });

  it("builds official Meta and TikTok OAuth authorization URLs", () => {
    const metaUrl = new URL(
      buildMetaAuthorizeUrl({
        appId: "meta-app-99",
        redirectUri: "https://missensuelle.onrender.com/api/ad-oauth/meta/callback",
        state: "st-1",
      })
    );
    expect(metaUrl.hostname).toBe("www.facebook.com");
    expect(metaUrl.searchParams.get("client_id")).toBe("meta-app-99");
    expect(metaUrl.searchParams.get("scope")).toBe("ads_read");
    expect(metaUrl.searchParams.get("state")).toBe("st-1");

    const ttUrl = new URL(
      buildTikTokAuthorizeUrl({
        appId: "tt-app-77",
        redirectUri: "https://missensuelle.onrender.com/api/ad-oauth/tiktok/callback",
        state: "st-2",
      })
    );
    expect(ttUrl.hostname).toBe("business-api.tiktok.com");
    expect(ttUrl.searchParams.get("app_id")).toBe("tt-app-77");
    expect(ttUrl.searchParams.get("state")).toBe("st-2");
  });

  it("exchanges Meta code for long-lived token and discovers multiple Ad Accounts", async () => {
    const fakeFetch: typeof fetch = async input => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("fb_exchange_token=")) {
        return makeJsonResponse({ access_token: "LONG_LIVED_META_TOKEN", expires_in: 5184000 });
      }
      if (url.includes("/oauth/access_token")) {
        return makeJsonResponse({ access_token: "SHORT_META_TOKEN", expires_in: 3600 });
      }
      if (url.includes("/v21.0/me?")) {
        return makeJsonResponse({ id: "1001", name: "Ahlam Boutique" });
      }
      if (url.includes("/v21.0/me/adaccounts")) {
        return makeJsonResponse({
          data: [
            { id: "act_111222", account_id: "111222", name: "Miss Sensuelle DZ", currency: "USD", account_status: 1 },
            { id: "333444", account_id: "333444", name: "Backup Abaya", currency: "EUR", account_status: 1 },
          ],
        });
      }
      return makeJsonResponse({ error: "unexpected url" }, 404);
    };

    const res = await exchangeMetaOAuthCode({
      appId: "app1",
      appSecret: "sec1",
      code: "code-abc",
      redirectUri: "https://missensuelle.onrender.com/api/ad-oauth/meta/callback",
      fetchImpl: fakeFetch,
    });

    expect(res.accessToken).toBe("LONG_LIVED_META_TOKEN");
    expect(res.userName).toBe("Ahlam Boutique");
    expect(res.tokenExpiresAt).toBeTruthy();
    expect(res.discoveredAccounts).toEqual([
      { id: "act_111222", name: "Miss Sensuelle DZ", currency: "USD", status: "ACTIVE" },
      { id: "act_333444", name: "Backup Abaya", currency: "EUR", status: "ACTIVE" },
    ]);
  });

  it("exchanges TikTok auth_code and enriches advertiser names and currencies", async () => {
    const fakeFetch: typeof fetch = async input => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/oauth2/access_token/")) {
        return makeJsonResponse({
          code: 0,
          data: {
            access_token: "TT_OAUTH_TOKEN_XYZ",
            advertiser_ids: ["700111", "700222"],
          },
        });
      }
      if (url.includes("/advertiser/info/")) {
        return makeJsonResponse({
          code: 0,
          data: {
            list: [{ advertiser_id: "700111", name: "TikTok Mode Main", currency: "USD", status: "STATUS_ENABLE" }],
          },
        });
      }
      return makeJsonResponse({ code: 404 }, 404);
    };

    const res = await exchangeTikTokOAuthCode({
      appId: "tt-app",
      appSecret: "tt-secret",
      authCode: "auth-code-99",
      fetchImpl: fakeFetch,
    });

    expect(res.accessToken).toBe("TT_OAUTH_TOKEN_XYZ");
    expect(res.discoveredAccounts).toEqual([
      { id: "700111", name: "TikTok Mode Main", currency: "USD", status: "STATUS_ENABLE" },
      { id: "700222", name: "TikTok 700222", currency: "USD", status: "ENABLE" },
    ]);
  });

  it("persists one-time OAuth App secrets safely across disconnect and lets owner toggle multi-accounts", async () => {
    await saveFinanceAdOAuthAppConfig({
      platform: "meta",
      appId: "99887766",
      appSecret: "SUPER_SECRET_KEY_1234",
    });

    const appCfg = getEffectiveAdOAuthAppConfig("meta");
    expect(appCfg.configured).toBe(true);
    expect(appCfg.appId).toBe("99887766");

    await saveFinanceAdOAuthConnection({
      platform: "meta",
      accessToken: "META_OAUTH_TOK_9999",
      userName: "Owner Name",
      discoveredAccounts: [
        { id: "act_100", name: "Main", currency: "USD" },
        { id: "act_200", name: "Scale", currency: "EUR" },
      ],
    });

    expect(getActiveAccountIdsForPlatform("meta")).toEqual(["act_100", "act_200"]);

    await setFinanceAdSelectedAccounts({ platform: "meta", accountIds: ["200"] });
    expect(getActiveAccountIdsForPlatform("meta")).toEqual(["act_200"]);

    // Public status must mask secrets
    const pub = buildPublicAdConnectionStatus();
    expect(pub.meta.configured).toBe(true);
    expect(pub.meta.authMode).toBe("oauth");
    expect(pub.meta.oauthAppConfigured).toBe(true);
    expect(JSON.stringify(pub)).not.toContain("SUPER_SECRET_KEY_1234");
    expect(JSON.stringify(pub)).not.toContain("META_OAUTH_TOK_9999");

    // Disconnecting account keeps 1-time OAuth app setup intact
    const afterDisconnect = await clearFinanceAdCredentials("meta");
    expect(afterDisconnect.meta.configured).toBe(false);
    expect(afterDisconnect.meta.oauthAppConfigured).toBe(true);
    expect(afterDisconnect.meta.oauthAppId).toBe("99887766");
  });

  it("blocks staff confirmateurs from configuring ad OAuth apps or accounts", async () => {
    const staffCaller = appRouter.createCaller({
      req: {} as never,
      res: {} as never,
      user: {
        id: 2,
        openId: "staff:s1",
        name: "Yasmine",
        email: "s1",
        loginMethod: "staff_code",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
    });

    await expect(
      staffCaller.finance.saveAdOAuthAppConfig({ platform: "meta", appId: "123", appSecret: "abc" })
    ).rejects.toThrow(/propriétaire/i);
    await expect(
      staffCaller.finance.setAdSelectedAccounts({ platform: "tiktok", accountIds: ["700"] })
    ).rejects.toThrow(/propriétaire/i);
  });
});
