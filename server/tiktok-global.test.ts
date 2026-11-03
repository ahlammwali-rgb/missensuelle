import { afterEach, describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import { publicTrackingScript } from "./_core/siteTracking";
import { sitePixelConfig } from "../shared/site-pixels";
import { getPixelConfig, getPixelDiagnostics, initializePixels, trackPixelEvent } from "../client/src/lib/tracking";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

afterEach(() => vi.unstubAllGlobals());

function createPage(saved: string | null = null, blocked = false) {
  const scripts: Array<Record<string, any>> = [];
  const win: Record<string, any> = { dispatchEvent: vi.fn() };
  const document = {
    createElement: () => ({ dataset: {}, src: "", async: false, type: "" }),
    head: { appendChild: (script: Record<string, any>) => scripts.push(script) },
    querySelector: () => null,
  };
  runInNewContext(publicTrackingScript(), { window: win, document, Event, console });
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
    expect(win.ttq).toContainEqual(["track", "Purchase", { value: 9600, currency: "DZD", order_id: "UNIT_TEST_ONLY" }]);
    expect(win.ttq.filter((call: string[]) => call[0] === "page")).toHaveLength(1);
  });

  it("still installs and tracks when localStorage is unavailable", () => {
    const { win, scripts } = createPage(null, true);
    trackPixelEvent("ViewContent");
    expect(scripts.filter(script => script.dataset.missTiktokPixel)).toHaveLength(1);
    expect(getPixelConfig().tiktokPixelId).toBe(sitePixelConfig.tiktokPixelId);
    expect(win.ttq).toContainEqual(["track", "ViewContent", {}]);
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
});
