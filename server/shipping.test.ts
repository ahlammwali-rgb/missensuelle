import { describe, expect, it } from "vitest";
import { shippingFeeFor, wilayaIdFromName } from "../shared/shipping";

const rates = { "16": { domicile: 450, stopdesk: 200 }, "42": { domicile: 600, stopdesk: 350 } };

describe("frais de livraison E-com Delivery", () => {
  it("fait correspondre les wilayas arabes aux codes officiels", () => {
    expect(wilayaIdFromName("الجزائر")).toBe(16);
    expect(wilayaIdFromName("تيبازة")).toBe(42);
    expect(wilayaIdFromName("inconnue")).toBeNull();
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
