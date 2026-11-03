import { afterEach, describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import { publicTrackingScript } from "./_core/siteTracking";
import { sitePixelConfig, type PublicPixelConfig } from "../shared/site-pixels";
import { getMetaPixelDiagnostics, getPixelConfig, initializePixels, savePixelConfig, trackPixelEvent } from "../client/src/lib/tracking";

afterEach(() => vi.unstubAllGlobals());

function page(config: PublicPixelConfig = sitePixelConfig, saved: string | null = null, blocked = false) {
  const scripts: Array<Record<string, any>> = [];
  const win: Record<string, any> = { dispatchEvent: vi.fn() };
  const document = {
    createElement: () => ({ dataset: {}, src: "", async: false, type: "" }),
    head: { appendChild: (script: Record<string, any>) => scripts.push(script) },
    querySelector: (selector: string) => selector.includes("facebook") ? scripts.find(script => script.dataset.missFacebookPixel) : null,
  };
  runInNewContext(publicTrackingScript(config), { window: win, document, Event, console });
  const localStorage = { getItem: () => { if (blocked) throw new Error("blocked"); return saved; }, setItem: vi.fn() };
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", document);
  vi.stubGlobal("localStorage", localStorage);
  return { win, scripts, document, localStorage };
}

describe("Global Facebook pixel", () => {
  it("installs Facebook and TikTok independently of local preferences and without duplicate React initialization", () => {
    const { win, scripts } = page();
    initializePixels(); initializePixels();
    expect(getPixelConfig().facebookPixelId).toBe("3938968343072960");
    expect(scripts.filter(script => script.dataset.missFacebookPixel)).toHaveLength(1);
    expect(scripts.find(script => script.dataset.missFacebookPixel)?.src).toBe("https://connect.facebook.net/en_US/fbevents.js");
    expect(win.fbq.queue.filter((call: unknown[]) => call[0] === "init")).toEqual([["init", "3938968343072960"]]);
    expect(win.fbq.queue.filter((call: unknown[]) => call[1] === "PageView")).toHaveLength(1);
    expect(scripts.filter(script => script.dataset.missTiktokPixel)).toHaveLength(1);
    expect(win.ttq.filter((call: unknown[]) => call[0] === "page")).toHaveLength(1);
  });

  it("does not let stale local Facebook preferences change the site pixel", () => {
    const { win, localStorage } = page(sitePixelConfig, JSON.stringify({ facebookPixelId: "OTHER_LOCAL_ID" }));
    expect(getPixelConfig().facebookPixelId).toBe(sitePixelConfig.facebookPixelId);
    trackPixelEvent("ViewContent", { content_ids: ["p-007"] });
    expect(win.fbq.queue).toContainEqual(["track", "ViewContent", { content_ids: ["p-007"] }]);
    expect(() => savePixelConfig({ ...sitePixelConfig, facebookPixelId: "OTHER_LOCAL_ID" })).toThrow("Meta global");
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it("queues the standard events for both pixels in an isolated VM, not a real browser", () => {
    const { win, scripts } = page();
    const events = ["ViewContent", "InitiateCheckout", "AddToCart", "Purchase"] as const;
    const data = { content_ids: ["p-007"], value: 9600, currency: "DZD", order_id: "UNIT_TEST_ONLY" };
    for (const event of events) {
      trackPixelEvent(event, data);
      expect(win.fbq.queue).toContainEqual(["track", event, data]);
      expect(win.ttq).toContainEqual(["track", event, data]);
    }
    expect(scripts).toHaveLength(2);
  });

  it("still loads Facebook when browser storage is unavailable", () => {
    const { win, scripts } = page(sitePixelConfig, null, true);
    trackPixelEvent("ViewContent");
    expect(getPixelConfig().facebookPixelId).toBe(sitePixelConfig.facebookPixelId);
    expect(scripts.filter(script => script.dataset.missFacebookPixel)).toHaveLength(1);
    expect(win.fbq.queue).toContainEqual(["track", "ViewContent", {}]);
  });

  it("reports SDK errors rather than falsely claiming a connection", () => {
    const { scripts } = page();
    scripts.find(script => script.dataset.missFacebookPixel)?.onerror();
    expect(getMetaPixelDiagnostics()).toMatchObject({ stage: "error", registered: false, pixelId: "3938968343072960" });
    expect(getMetaPixelDiagnostics().error).toContain("bloqué");
  });

  it("distinguishes script load from SDK registration without claiming server receipt", () => {
    const { win, scripts } = page();
    scripts.find(script => script.dataset.missFacebookPixel)?.onload();
    expect(getMetaPixelDiagnostics()).toMatchObject({ stage: "loaded", registered: false });
    win.fbq.getState = () => ({ pixels: [{ id: "3938968343072960" }] });
    expect(getMetaPixelDiagnostics().registered).toBe(true);
  });

  it("installs Facebook even when no TikTok pixel is configured", () => {
    const { win, scripts } = page({ ...sitePixelConfig, tiktokPixelId: "" });
    expect(scripts).toHaveLength(1);
    expect(win.fbq.queue).toContainEqual(["init", "3938968343072960"]);
    expect(win.ttq).toBeUndefined();
  });
});
