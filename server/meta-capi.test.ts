import { afterEach, describe, expect, it, vi } from "vitest";
import { trackPixelEvent, readBrowserTrackingContext } from "../client/src/lib/tracking";
import {
  buildMetaUserData,
  normalizePhoneForMetaCapi,
  resolveOrderAttribution,
  sendMetaCapiPurchaseEvent,
  sha256Hex,
} from "./metaCapi";
import {
  getPublicPixelSecretsStatus,
  setServerPixelConfig,
  setServerPixelSecrets,
} from "./persistentStore";
import { submitCheckoutOrder } from "./checkout";
import { appRouter } from "./routers";

afterEach(() => {
  vi.unstubAllGlobals();
  setServerPixelSecrets({
    facebookDefaultCapiToken: "",
    clearDefaultCapiToken: true,
    facebookCapiTokens: { "916933364742371": "", "1704139624720433": "" },
    facebookTestEventCode: "",
  });
});

describe("Meta Pixel sanitization, Advanced Matching & Conversions API (CAPI)", () => {
  it("strips plaintext PII from fbq custom_data, sets Advanced Matching and passes eventID", () => {
    const fbQueue: unknown[][] = [];
    const fbqFn = (...args: unknown[]) => fbQueue.push(args);
    Object.assign(fbqFn, { queue: fbQueue, loaded: true, version: "2.0" });

    let rawCookies = "_fbp=fb.1.1700000000000.123456";
    const doc: Record<string, unknown> = {
      get cookie() {
        return rawCookies;
      },
      set cookie(pair: string) {
        const kv = String(pair).split(";")[0]?.trim();
        if (kv) rawCookies = `${rawCookies}; ${kv}`;
      },
      createElement: () => ({ dataset: {}, src: "", async: false, type: "" }),
      querySelector: () => null,
      head: { appendChild: vi.fn() },
    };
    const storeMap = new Map<string, string>();
    const fakeStorage = {
      getItem: (k: string) => storeMap.get(k) ?? null,
      setItem: (k: string, v: string) => {
        storeMap.set(k, v);
      },
    };
    const win: Record<string, unknown> = {
      __MISS_SITE_PIXEL_CONFIG: {
        facebookPixelId: "916933364742371",
        facebookPixelIds: ["916933364742371", "1704139624720433"],
        tiktokPixelId: "",
        tiktokPixelIds: [],
        tiktokCode: "",
      },
      fbq: fbqFn,
      __missMetaIds: new Set(["916933364742371", "1704139624720433"]),
      location: { search: "?fbclid=IwAR_SAMPLE_999", href: "https://missensuelle.onrender.com/petit-meche?fbclid=IwAR_SAMPLE_999" },
      sessionStorage: fakeStorage,
      localStorage: fakeStorage,
      dispatchEvent: vi.fn(),
    };

    vi.stubGlobal("window", win);
    vi.stubGlobal("document", doc);
    vi.stubGlobal("localStorage", fakeStorage);

    trackPixelEvent("Purchase", {
      content_type: "product",
      content_ids: ["p-012"],
      value: 2500,
      currency: "DZD",
      order_id: "MS-9001",
      event_id: "purchase_MS-9001",
      phone: "0550 12 34 56",
      customer: "Sara Benali",
      wilaya: "الجزائر",
      commune: "حيدرة",
    });

    // Advanced Matching init calls include normalized Algerian phone + names + city + country
    expect(fbQueue).toContainEqual([
      "init",
      "916933364742371",
      { country: "dz", ph: "213550123456", fn: "sara", ln: "benali", ct: "حيدرة" },
    ]);

    const purchaseCall = fbQueue.find(call => call[0] === "track" && call[1] === "Purchase") as
      | [string, string, Record<string, unknown>, { eventID?: string }]
      | undefined;
    expect(purchaseCall).toBeDefined();
    expect(purchaseCall?.[2]).toEqual({
      content_type: "product",
      content_ids: ["p-012"],
      value: 2500,
      currency: "DZD",
      order_id: "MS-9001",
    });
    expect(purchaseCall?.[2]).not.toHaveProperty("phone");
    expect(purchaseCall?.[2]).not.toHaveProperty("customer");
    expect(purchaseCall?.[2]).not.toHaveProperty("wilaya");
    expect(purchaseCall?.[3]).toEqual({ eventID: "purchase_MS-9001" });

    // Browser context captures _fbc synthesized from fbclid and _fbp cookie
    const ctx = readBrowserTrackingContext();
    expect(ctx.fbclid).toBe("IwAR_SAMPLE_999");
    expect(ctx.fbc).toMatch(/^fb\.1\.\d+\.IwAR_SAMPLE_999$/);
    expect(ctx.fbp).toBe("fb.1.1700000000000.123456");
  });

  it("hashes Meta CAPI user_data with SHA-256 and dispatches events across all pixels", async () => {
    expect(normalizePhoneForMetaCapi("0550 12 34 56")).toBe("213550123456");
    const ud = buildMetaUserData({
      phone: "+213 661-90-42-11",
      customer: "Imane Benali",
      commune: "Hydra",
      externalId: "MS-5001",
      clientIp: "105.100.10.20",
      userAgent: "Mozilla/5.0",
      fbc: "fb.1.1700000000000.abc",
      fbp: "fb.1.1700000000000.999",
    });
    expect(ud.ph).toEqual([sha256Hex("213661904211")]);
    expect(ud.fn).toEqual([sha256Hex("imane")]);
    expect(ud.ln).toEqual([sha256Hex("benali")]);
    expect(ud.ct).toEqual([sha256Hex("hydra")]);
    expect(ud.country).toEqual([sha256Hex("dz")]);
    expect(ud.fbc).toBe("fb.1.1700000000000.abc");
    expect(ud.fbp).toBe("fb.1.1700000000000.999");

    setServerPixelConfig({
      facebookPixelId: "916933364742371",
      facebookPixelIds: ["916933364742371", "1704139624720433"],
      tiktokPixelId: "",
      tiktokCode: "",
    });
    setServerPixelSecrets({
      facebookDefaultCapiToken: "EAA_DEFAULT_SECRET_TOKEN_XYZ",
      facebookCapiTokens: { "1704139624720433": "EAA_SECOND_PIXEL_TOKEN_999" },
      facebookTestEventCode: "TEST777",
    });

    // Public status masks secrets
    const pub = getPublicPixelSecretsStatus();
    expect(pub.hasDefaultCapiToken).toBe(true);
    expect(pub.testEventCode).toBe("TEST777");
    expect(JSON.stringify(pub)).not.toContain("EAA_DEFAULT_SECRET_TOKEN_XYZ");
    expect(JSON.stringify(pub)).not.toContain("EAA_SECOND_PIXEL_TOKEN_999");

    const requests: Array<{ url: string; body: Record<string, any> }> = [];
    const fakeFetch: typeof fetch = async (input, init) => {
      requests.push({
        url: typeof input === "string" ? input : input.toString(),
        body: JSON.parse(String(init?.body || "{}")),
      });
      return new Response(JSON.stringify({ events_received: 1, fbtrace_id: "trace_1" }), { status: 200 });
    };

    const res = await sendMetaCapiPurchaseEvent({
      orderNumber: "MS-7070",
      totalDzd: 2500,
      productIds: ["p-012"],
      numItems: 1,
      phone: "0550123456",
      customer: "Meriem",
      attribution: resolveOrderAttribution({ fbclid: "FB_CLICK_XYZ", fbp: "fb.1.1.2" }),
      clientIp: "105.1.2.3",
      userAgent: "TestAgent",
      fetchImpl: fakeFetch,
    });

    expect(res.attempted).toBe(2);
    expect(res.sentCount).toBe(2);
    expect(requests[0].url).toContain("916933364742371/events");
    expect(requests[0].url).toContain("EAA_DEFAULT_SECRET_TOKEN_XYZ");
    expect(requests[1].url).toContain("1704139624720433/events");
    expect(requests[1].url).toContain("EAA_SECOND_PIXEL_TOKEN_999");
    expect(requests[0].body.test_event_code).toBe("TEST777");
    expect(requests[0].body.data[0].event_id).toBe("purchase_MS-7070");
    expect(requests[0].body.data[0].custom_data.currency).toBe("DZD");
  });

  it("records attribution on checkout submission and restricts CAPI secrets to Owner only", async () => {
    const attrFb = resolveOrderAttribution({ fbclid: "CLID_1" });
    expect(attrFb.channel).toBe("facebook");
    expect(attrFb.fbc).toContain("CLID_1");

    const attrTt = resolveOrderAttribution({ ttclid: "TT_1" });
    expect(attrTt.channel).toBe("tiktok");

    const attrDirect = resolveOrderAttribution({});
    expect(attrDirect.channel).toBe("direct");

    const submitted = await submitCheckoutOrder(
      {
        token: "11111111-1111-4111-8111-111111111199",
        payload: {
          source: "product",
          customer: "Nour",
          phone: "0770123456",
          wilaya: "الجزائر",
          commune: "حيدرة",
          address: "حيدرة",
          note: "",
          delivery: "home",
          items: [{ productId: "p-012", quantity: 1, color: "أسود", size: "Standard" }],
          tracking: { fbclid: "FB_TEST_ORDER_ID", utmSource: "facebook" },
        },
      },
      { clientIp: "105.2.3.4", userAgent: "MobileUA" }
    );
    expect(submitted.created).toBe(true);

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
      staffCaller.admin.setPixelSecrets({ facebookDefaultCapiToken: "SECRET" })
    ).rejects.toThrow(/propriétaire/i);
    await expect(staffCaller.admin.testMetaCapi()).rejects.toThrow(/propriétaire/i);
  });
});
