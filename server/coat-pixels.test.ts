import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CoatLanding from "../client/src/pages/CoatLanding";
import { coatImages } from "../client/src/lib/coat-images";
import { products } from "../client/src/lib/store-data";
import { trackPixelEvent, type PixelConfig } from "../client/src/lib/tracking";

afterEach(() => vi.unstubAllGlobals());

function pixelEnvironment(config: PixelConfig) {
  const win: Record<string, any> = { __MISS_SITE_PIXEL_CONFIG: config };
  const scripts: Array<{ dataset: Record<string, string>; src: string; textContent: string; async: boolean }> = [];
  vi.stubGlobal("window", win);
  vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(config) });
  vi.stubGlobal("document", {
    createElement: () => ({ dataset: {}, src: "", textContent: "", async: false }),
    querySelector: (selector: string) => selector.includes("facebook") ? scripts.find(script => script.dataset.missFacebookPixel) : scripts.find(script => script.dataset.missTiktokCustom),
    head: { appendChild: (script: typeof scripts[number]) => scripts.push(script) },
  });
  return { win, scripts };
}

describe("Browser pixels queueing", () => {
  it("queues TikTok events before SDK load and installs it only once", () => {
    const { win, scripts } = pixelEnvironment({ facebookPixelId: "", tiktokPixelId: "TEST_PIXEL", tiktokCode: "" });
    trackPixelEvent("ViewContent", { content_ids: ["p-001"] });
    trackPixelEvent("InitiateCheckout");
    trackPixelEvent("Purchase", { value: 9700, currency: "DZD" });
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toContain("sdkid=TEST_PIXEL");
    expect(win.ttq).toContainEqual(["page"]);
    expect(win.ttq).toContainEqual(["track", "Purchase", { value: 9700, currency: "DZD" }]);
    expect(win.ttq._i.TEST_PIXEL._u).toContain("analytics.tiktok.com");
  });

  it("does not reinitialize Meta or duplicate PageView on every conversion", () => {
    const { win, scripts } = pixelEnvironment({ facebookPixelId: "123456789", tiktokPixelId: "", tiktokCode: "" });
    trackPixelEvent("ViewContent");
    trackPixelEvent("InitiateCheckout");
    trackPixelEvent("Purchase", { value: 9700, currency: "DZD" });
    expect(scripts).toHaveLength(1);
    expect(win.fbq.queue.filter((item: unknown[]) => item[0] === "init")).toHaveLength(1);
    expect(win.fbq.queue.filter((item: unknown[]) => item[1] === "PageView")).toHaveLength(1);
    expect(win.fbq.queue).toContainEqual(["track", "Purchase", { value: 9700, currency: "DZD" }]);
  });

  it("does nothing without configured pixels", () => {
    const { scripts } = pixelEnvironment({ facebookPixelId: "", tiktokPixelId: "", tiktokCode: "" });
    trackPixelEvent("Purchase");
    expect(scripts).toHaveLength(0);
  });
});

describe("Coat HTML landing", () => {
  it("uses supplied hero, four detail photos and mannequin instead of an approximate gallery", () => {
    vi.stubGlobal("location", { pathname: "/produit/blazer-lilac-dream", search: "" });
    const html = renderToStaticMarkup(createElement(CoatLanding, { product: products[0] }));
    expect(html).toContain(coatImages.black.hero);
    expect(html).toContain(coatImages.black.collar);
    expect(html).toContain(coatImages.black.buttons);
    expect(html).toContain(coatImages.black.cuffs);
    expect(html).toContain(coatImages.black.back);
    expect(html).toContain(coatImages.black.mannequin);
    expect(html).toContain('name="commune"');
    expect(html).toContain('name="size"');
    expect(html).not.toContain("SHEIN");
    expect(html).not.toContain("claude.ai");
    expect(html).not.toContain("نسخة معاينة");
  });
});
