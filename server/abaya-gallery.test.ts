import { afterEach, describe, expect, it, vi } from "vitest";
import { abayaPhotoReplacements, getAbayaPhotoLabel, replaceAnnotatedAbayaPhotos } from "../client/src/lib/abaya-gallery";
import { CATALOG_STORAGE_KEY, getCatalogProducts, maquetteAbayaHero, maquetteAbayaT1, maquetteAbayaT2, maquetteAbayaT3, maquetteAbayaT4, maquetteAbayaT5, products } from "../client/src/lib/store-data";
import { readFileSync } from "node:fs";

const oldGallery = [maquetteAbayaHero, maquetteAbayaT1, maquetteAbayaT2, maquetteAbayaT3, maquetteAbayaT4, maquetteAbayaT5];
afterEach(() => vi.unstubAllGlobals());

describe("Annotated Abaya gallery edits", () => {
  it("replaces positions 1, 2 and 4 while preserving every other gallery entry", () => {
    const updated = replaceAnnotatedAbayaPhotos(oldGallery);
    expect(updated).toHaveLength(oldGallery.length);
    abayaPhotoReplacements.forEach(item => expect(updated[item.index]).toBe(item.after));
    [2, 4, 5].forEach(index => expect(updated[index]).toBe(oldGallery[index]));
    expect(replaceAnnotatedAbayaPhotos(updated)).toEqual(updated);
  });

  it("does not overwrite custom or reordered photos", () => {
    const custom = ["/custom/front.jpg", maquetteAbayaT3, "/custom/back.jpg", maquetteAbayaHero, maquetteAbayaT4];
    expect(replaceAnnotatedAbayaPhotos(custom)).toEqual(custom);
  });

  it("migrates a saved catalog without changing product price, stock, colors or thumbnail", () => {
    const abaya = { ...products.find(product => product.id === "p-007")!, price: 11200, stock: 6, image: "/custom/thumbnail.jpg", colors: ["Noir"], gallery: oldGallery };
    let saved = JSON.stringify([abaya]);
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => key === CATALOG_STORAGE_KEY ? saved : null,
      setItem: (_key: string, value: string) => { saved = value; },
    });
    const migrated = getCatalogProducts()[0];
    expect(migrated).toEqual({ ...abaya, gallery: replaceAnnotatedAbayaPhotos(oldGallery) });
    expect(JSON.parse(saved)[0]).toEqual(migrated);
    expect(getCatalogProducts()[0]).toEqual(migrated);
  });

  it("provides accurate captions for the new photos and preserves hero and form source", () => {
    expect(getAbayaPhotoLabel(abayaPhotoReplacements[0].after, 0, "fr")).toContain("noire");
    expect(getAbayaPhotoLabel(abayaPhotoReplacements[1].after, 1, "fr")).toContain("broderies");
    expect(getAbayaPhotoLabel(abayaPhotoReplacements[2].after, 3, "fr")).toContain("verte");
    expect(getAbayaPhotoLabel(maquetteAbayaT2, 2, "fr")).toBe("الجمبسوت - أمام");
    expect(getAbayaPhotoLabel(maquetteAbayaT4, 4, "fr")).toBe("تفاصيل القماش");
    const source = readFileSync(new URL("../client/src/pages/Storefront.tsx", import.meta.url), "utf8");
    expect(source).toContain('src="/manus-storage/1000013293_30889d5d.jpg"');
    expect(source).toContain("<EmeraldOrder product={product}");
    expect(source).toContain("thumbs.map((image, index)");
  });
});
