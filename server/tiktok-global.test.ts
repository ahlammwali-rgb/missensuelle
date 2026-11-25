import { afterEach, describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import { publicTrackingScript } from "./_core/siteTracking";
import { sitePixelConfig, type PublicPixelConfig } from "../shared/site-pixels";
import { getServerPixelConfig, setServerPixelConfig } from "./persistentStore";
import { getPixelConfig, getPixelDiagnostics, initializePixels, trackPixelEvent } from "../client/src/lib/tracking";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

afterEach(() => vi.unstubAllGlobals());

function createPage(
  saved: string | null = null,
  blocked = false,
  config: PublicPixelConfig = sitePixelConfig,
) {
  const scripts: Array<Record<string, any>> = [];
  const win: Record<string, any> = { dispatchEvent: vi.fn() };
  const document = {
    createElement: () => ({ dataset: {}, src: "", async: false, type: "" }),
    head: { appendChild: (script: Record<string, any>) => scripts.push(script) },
    querySelector: () => null,
  };
  runInNewContext(publicTrackingScript(config), { window: win, document, Event, console });
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", document);
  vi.stubGlobal("localStorage", { getItem: () => { if (blocked) throw new Error("storage blocked"); return saved; } });
  return { win, scripts };
}

describe("Globally installed TikTok pixel", () => {
  it("installs the configured site pixel without local settings and only queues one initial page", () => {
    const { win, scripts } = createPage();
    initializePixels(); initializePixels();
    expect(scripts.filter(script => script.dataset.missTiktokPixel)).toHaveLength(1);
    expect(scripts.find(script => script.dataset.missTiktokPixel)?.src).toContain(`sdkid=${sitePixelConfig.tiktokPixelId}`);
    expect(win.__MISS_SITE_PIXEL_CONFIG.tiktokPixelId).toBe("CUD92NJC77U74NKABJI0");
    expect(win.ttq.filter((call: string[]) => call[0] === "page")).toHaveLength(1);
    expect(getPixelDiagnostics().stage).toBe("loading");
  });

  it("ignores conflicting old local TikTok ID/code and queues product and COD events for the global pixel", () => {
    const { win, scripts } = createPage(JSON.stringify({ tiktokPixelId: "OLD_OTHER_PIXEL", tiktokCode: "wrong snippet" }));
    expect(getPixelConfig().tiktokPixelId).toBe(sitePixelConfig.tiktokPixelId);
    expect(getPixelConfig().tiktokCode).toBe("");
    trackPixelEvent("ViewContent", { content_ids: ["p-007"] });
    trackPixelEvent("InitiateCheckout", { value: 9600, currency: "DZD" });
    trackPixelEvent("Purchase", { value: 9600, currency: "DZD", order_id: "UNIT_TEST_ONLY" });
    expect(scripts.filter(script => script.dataset.missTiktokPixel)).toHaveLength(1);
    expect(win.ttq).toContainEqual([
      "track",
      "Purchase",
      expect.objectContaining({ value: 9600, currency: "DZD", order_id: "UNIT_TEST_ONLY" }),
    ]);
    expect(win.ttq.filter((call: string[]) => call[0] === "page")).toHaveLength(1);
  });

  it("still installs and tracks when localStorage is unavailable", () => {
    const { win, scripts } = createPage(null, true);
    trackPixelEvent("ViewContent");
    expect(scripts.filter(script => script.dataset.missTiktokPixel)).toHaveLength(1);
    expect(getPixelConfig().tiktokPixelId).toBe(sitePixelConfig.tiktokPixelId);
    expect(win.ttq).toContainEqual(["track", "ViewContent", expect.objectContaining({ currency: "DZD" })]);
  });

  it("reports load failures instead of displaying a false connected status", () => {
    const { scripts } = createPage();
    scripts.find(script => script.dataset.missTiktokPixel)?.onerror();
    const status = getPixelDiagnostics();
    expect(status.stage).toBe("error");
    expect(status.registered).toBe(false);
    expect(status.error).toContain("bloqué");
  });

  it("distinguishes loaded SDK from registered pixel and never claims Ads Manager receipt", () => {
    const { win, scripts } = createPage();
    scripts.find(script => script.dataset.missTiktokPixel)?.onload();
    expect(getPixelDiagnostics().stage).toBe("loaded");
    expect(getPixelDiagnostics().registered).toBe(false);
    win.ttq._i[sitePixelConfig.tiktokPixelId].info = { pixelCode: sitePixelConfig.tiktokPixelId };
    expect(getPixelDiagnostics().registered).toBe(true);
  });

  it("loads the public bootstrap in the head before the React entry point", () => {
    const html = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");
    const script = publicTrackingScript();
    const hash = createHash("sha256").update(script).digest("hex").slice(0, 16);
    const path = `/tracking/bootstrap.${hash}.js`;
    expect(html).toContain(`src="${path}"`);
    expect(html.indexOf(path)).toBeLessThan(html.indexOf('</head>'));
    expect(html.indexOf(path)).toBeLessThan(html.indexOf('/src/main.tsx'));
    expect(readFileSync(new URL(`../client/public${path}`, import.meta.url), "utf8")).toBe(script);
  });

  it("loads and tracks multiple TikTok pixel IDs concurrently and persists multi-pixel server config", () => {
    const multiConfig: PublicPixelConfig = {
      facebookPixelId: "916933364742371",
      facebookPixelIds: ["916933364742371", "11223344556677"],
      tiktokPixelId: "CUD92NJC77U74NKABJI0",
      tiktokPixelIds: ["CUD92NJC77U74NKABJI0", "TTPIXEL2_XYZ99"],
      tiktokCode: "",
    };
    const { win, scripts } = createPage(null, false, multiConfig);
    initializePixels();
    const ttScripts = scripts.filter(s => s.dataset.missTiktokPixel);
    expect(ttScripts).toHaveLength(2);
    expect(ttScripts[0]?.src).toContain("sdkid=CUD92NJC77U74NKABJI0");
    expect(ttScripts[1]?.src).toContain("sdkid=TTPIXEL2_XYZ99");
    expect(win.ttq.filter((call: string[]) => call[0] === "page")).toHaveLength(1);
    expect(getPixelConfig().tiktokPixelIds).toEqual(["CUD92NJC77U74NKABJI0", "TTPIXEL2_XYZ99"]);

    win.ttq._i["CUD92NJC77U74NKABJI0"].info = { pixelCode: "CUD92NJC77U74NKABJI0" };
    expect(getPixelDiagnostics().registered).toBe(false);
    win.ttq._i["TTPIXEL2_XYZ99"].info = { pixelCode: "TTPIXEL2_XYZ99" };
    expect(getPixelDiagnostics().registered).toBe(true);
    expect(getPixelDiagnostics().pixelIds).toEqual(["CUD92NJC77U74NKABJI0", "TTPIXEL2_XYZ99"]);

    const saved = setServerPixelConfig(multiConfig);
    expect(saved.facebookPixelIds).toEqual(["916933364742371", "11223344556677"]);
    expect(saved.tiktokPixelIds).toEqual(["CUD92NJC77U74NKABJI0", "TTPIXEL2_XYZ99"]);
    expect(getServerPixelConfig().facebookPixelIds).toEqual(["916933364742371", "11223344556677"]);
    expect(getServerPixelConfig().tiktokPixelIds).toEqual(["CUD92NJC77U74NKABJI0", "TTPIXEL2_XYZ99"]);
    // Restore default
    setServerPixelConfig(sitePixelConfig);
  });
});
