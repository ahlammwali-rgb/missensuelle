import { describe, expect, it } from "vitest";
import { matchEcomCommune, normalizeOrderLocation, shippingFeeFor, wilayaIdFromName } from "../shared/shipping";

const rates = { "16": { domicile: 450, stopdesk: 200 }, "42": { domicile: 600, stopdesk: 350 } };

describe("frais de livraison E-com Delivery", () => {
  it("fait correspondre les wilayas arabes, françaises et composites aux codes officiels", () => {
    expect(wilayaIdFromName("الجزائر")).toBe(16);
    expect(wilayaIdFromName("تيبازة")).toBe(42);
    expect(wilayaIdFromName("Alger")).toBe(16);
    expect(wilayaIdFromName("الذرعان ولاية الطارف")).toBe(36);
    expect(wilayaIdFromName("ولاية المنيعة بلدية حاسي لفحل")).toBe(58);
    expect(wilayaIdFromName("هراوة (الجزائر العاصمة)")).toBe(16);
    expect(wilayaIdFromName("ام البواقي")).toBe(4);
    expect(wilayaIdFromName("نعامة")).toBe(45);
    expect(wilayaIdFromName("taref")).toBe(36);
    expect(wilayaIdFromName("تمراست")).toBe(11);
    expect(wilayaIdFromName("كنستال", "كنستال وهران")).toBe(31);
    expect(wilayaIdFromName("inconnue")).toBeNull();
  });

  it("normalise les wilayas et communes composites et fait correspondre les communes E-com", () => {
    const loc1 = normalizeOrderLocation("الذرعان ولاية الطارف", "قرية عين اعلام");
    expect(loc1.wilaya).toBe("الطارف");
    expect(loc1.commune).toBe("الذرعان");
    expect(loc1.address).toContain("قرية عين اعلام");

    const loc2 = normalizeOrderLocation("ولاية المنيعة بلدية حاسي لفحل", "قرب حماية المدينة");
    expect(loc2.wilaya).toBe("المنيعة");
    expect(loc2.commune).toBe("حاسي الفحل");

    const ecomAlger = ["Alger Centre", "Staoueli", "Cheraga", "Bordj El Kiffan", "Baraki", "Souidania"];
    expect(matchEcomCommune(16, "سطاوالي", ecomAlger)).toBe("Staoueli");
    expect(matchEcomCommune(16, "الشراقة", ecomAlger)).toBe("Cheraga");
    expect(matchEcomCommune(16, "براقي", ecomAlger)).toBe("Baraki");
    expect(matchEcomCommune(16, "سويدانية", ecomAlger)).toBe("Souidania");
  });

  it("applique le tarif domicile ou stopdesk", () => {
    expect(shippingFeeFor(rates, "الجزائر", "home", ["p-008"])).toBe(450);
    expect(shippingFeeFor(rates, "الجزائر", "office", ["p-008"])).toBe(200);
  });

  it("ne facture rien pour les produits en livraison gratuite", () => {
    expect(shippingFeeFor(rates, "تيبازة", "home", ["p-007"])).toBe(0);
    expect(shippingFeeFor(rates, "تيبازة", "home", ["p-007", "p-008"])).toBe(600);
  });

  it("retourne 0 si le tarif est inconnu", () => {
    expect(shippingFeeFor(undefined, "الجزائر", "home", ["p-008"])).toBe(0);
    expect(shippingFeeFor({}, "الجزائر", "home", ["p-008"])).toBe(0);
  });
});
