import { describe, expect, it } from "vitest";
import { abayaCommunesByWilaya } from "../client/src/lib/abaya-communes";
import { CATALOG_STORAGE_KEY, getCatalogProducts, products } from "../client/src/lib/store-data";
import { shippingFeeFor } from "../shared/shipping";
import { validateFullCheckoutPayload } from "./checkout";

describe("Petit Mèche product & checkout integration", () => {
  it("registers Petit Mèche (p-012) with 2500 DA price, 5 colors and 6 gallery images", () => {
    const pm = products.find(p => p.id === "p-012");
    expect(pm).toBeDefined();
    expect(pm?.slug).toBe("petit-meche");
    expect(pm?.name).toBe("Petit Mèche");
    expect(pm?.price).toBe(2500);
    expect(pm?.oldPrice).toBe(3500);
    expect(pm?.landingTemplate).toBe("petit-meche");
    expect(pm?.colors).toEqual([
      "أسود",
      "شاتان فونسي",
      "شاتان فاتح",
      "بلوند ذهبي",
      "بلوند بلاتيني",
    ]);
    expect(pm?.gallery).toHaveLength(6);
  });

  it("injects p-012 into legacy saved localStorage catalogs via getCatalogProducts", () => {
    const oldOnly = products.filter(p => p.id !== "p-012");
    let storageValue = JSON.stringify(oldOnly);
    const fakeStorage = {
      getItem: (key: string) => (key === CATALOG_STORAGE_KEY ? storageValue : null),
      setItem: (key: string, value: string) => {
        if (key === CATALOG_STORAGE_KEY) storageValue = value;
      },
    };
    const origWindow = (globalThis as { window?: unknown }).window;
    const origLocalStorage = (globalThis as { localStorage?: unknown }).localStorage;
    Object.assign(globalThis, {
      window: { localStorage: fakeStorage, addEventListener: () => {}, dispatchEvent: () => true },
      localStorage: fakeStorage,
    });
    try {
      const migrated = getCatalogProducts();
      expect(migrated.some(p => p.id === "p-012")).toBe(true);
    } finally {
      Object.assign(globalThis, { window: origWindow, localStorage: origLocalStorage });
    }
  });

  it("validates Petit Mèche COD checkout payload and communes mapping", () => {
    expect(abayaCommunesByWilaya["الجزائر"]).toContain("حيدرة");
    expect(abayaCommunesByWilaya["توقرت"].length).toBeGreaterThan(0);

    const validated = validateFullCheckoutPayload({
      source: "product",
      customer: "سارة بن علي",
      phone: "0550 12 34 56",
      wilaya: "الجزائر",
      commune: "حيدرة",
      address: "حيدرة",
      delivery: "home",
      items: [
        {
          productId: "p-012",
          quantity: 1,
          color: "أسود + بلوند ذهبي",
          size: "Standard",
        },
      ],
    });
    expect(validated.phone).toBe("0550123456");
    expect(validated.items[0]?.productId).toBe("p-012");

    const intlValidated = validateFullCheckoutPayload({
      source: "product",
      customer: "سارة بن علي",
      phone: "+213 550 12 34 56",
      wilaya: "الجزائر",
      commune: "حيدرة",
      address: "حيدرة",
      delivery: "home",
      items: [{ productId: "p-012", quantity: 1, color: "أسود", size: "Standard" }],
    });
    expect(intlValidated.phone).toBe("+213550123456");

    const fee = shippingFeeFor(undefined, "الجزائر", "home", ["p-012"]);
    expect(fee).toBe(0);
  });
});
