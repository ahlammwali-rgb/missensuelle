import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EmeraldOrder } from "../client/src/components/AbayaOrder";
import { CATALOG_STORAGE_KEY, getCatalogProducts, products } from "../client/src/lib/store-data";
import { abayaCommunesByWilaya, abayaWilayas } from "../client/src/lib/abaya-communes";

const abaya = products.find(product => product.id === "p-007")!;
afterEach(() => { vi.unstubAllGlobals(); });

describe("Abaya mobile form", () => {
  it("removes Bordeaux from previously saved catalogs while retaining other edits", () => {
    const savedAbaya = { ...abaya, price: 12345, colors: ["Emerald", "Noir", " Bordeaux "] };
    const other = { ...products[0], name: "Nom personnalisé" };
    let storage = JSON.stringify([savedAbaya, other]);
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => key === CATALOG_STORAGE_KEY ? storage : null,
      setItem: (_key: string, value: string) => { storage = value; },
    });
    const migrated = getCatalogProducts();
    expect(migrated[0].colors).toEqual(["Emerald", "Noir"]);
    expect(migrated[0].price).toBe(12345);
    expect(migrated[1]).toEqual(other);
    expect(JSON.parse(storage)[0].colors).toEqual(["Emerald", "Noir"]);
    expect(getCatalogProducts()).toEqual(migrated);
  });

  it("shows labeled required location dropdowns, and no address, note or Bordeaux", () => {
    const html = renderToStaticMarkup(createElement(EmeraldOrder, {
      product: { ...abaya, colors: ["Emerald", "Noir", "Bordeaux"] },
      selectedColor: "Bordeaux", setSelectedColor: () => {}, quantity: 1, lang: "ar",
    }));
    expect(html).toContain('name="emerald-commune"');
    expect(html).toMatch(/<select[^>]*name="emerald-commune"[^>]*disabled/);
    expect(html).toContain('for="abaya-customer"');
    expect(html).toContain('for="abaya-phone"');
    expect(html).not.toContain('name="emerald-address"');
    expect(html).not.toContain('name="emerald-note"');
    expect(html).not.toContain("Bordeaux");
    expect(html).toContain('aria-pressed="true"');
  });

  it("reuses all wilayas and commune lists supplied in the HTML reference", () => {
    expect(abayaWilayas).toHaveLength(58);
    expect(abayaCommunesByWilaya["الجزائر"]).toContain("حيدرة");
    expect(abayaCommunesByWilaya["وهران"]).toContain("بئر الجير");
    expect(abayaCommunesByWilaya["الجزائر"]).not.toContain("بئر الجير");
    expect(abayaWilayas.every(wilaya => abayaCommunesByWilaya[wilaya].length > 0)).toBe(true);
  });
});
