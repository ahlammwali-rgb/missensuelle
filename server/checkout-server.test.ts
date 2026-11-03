import { describe, expect, it } from "vitest";
import { checkoutPayloadSchema, saveDraftSchema } from "../shared/checkout";
import { validateFullCheckoutPayload } from "./checkout";

const validPayload = {
  source: "abaya" as const,
  customer: "Nour",
  phone: "0550 24 18 62",
  wilaya: "Alger",
  commune: "Centre",
  address: "Rue 1",
  note: "Après 16h",
  delivery: "home" as const,
  items: [{ productId: "p-007", quantity: 1, color: "Emerald", size: "M" }],
};

describe("checkout server contract", () => {
  it("normalizes a valid Algerian phone and preserves server-side payload fields", () => {
    expect(validateFullCheckoutPayload(validPayload)).toMatchObject({
      ...validPayload,
      phone: "0550241862",
    });
  });

  it("rejects incomplete customer data before any DB operation", () => {
    expect(() => validateFullCheckoutPayload({ ...validPayload, phone: "0612" })).toThrow(/téléphone/i);
    expect(() => validateFullCheckoutPayload({ ...validPayload, commune: "" })).toThrow(/commune/i);
  });

  it("requires size and color for abaya and coat sources", () => {
    expect(() => validateFullCheckoutPayload({ ...validPayload, items: [{ ...validPayload.items[0], size: "" }] }))
      .toThrow(/taille.*couleur|obligatoires/i);
    expect(() => validateFullCheckoutPayload({ ...validPayload, source: "product", items: [{ productId: "p-007", quantity: 1 }] }))
      .not.toThrow();
  });

  it("requires literal consent for draft persistence", () => {
    const parsed = saveDraftSchema.safeParse({
      token: "550e8400-e29b-41d4-a716-446655440000",
      revision: 1,
      consent: false,
      payload: validPayload,
    });
    expect(parsed.success).toBe(false);
    expect(checkoutPayloadSchema.safeParse({ ...validPayload, items: [] }).success).toBe(false);
  });

  it("does not create an empty partial capture", async () => {
    const { saveCheckoutDraft } = await import("./checkout");
    const result = await saveCheckoutDraft({
      token: "550e8400-e29b-41d4-a716-446655440000",
      revision: 1,
      consent: true,
      payload: { ...validPayload, customer: "", phone: "", wilaya: "", commune: "", address: "", note: "", items: [{ productId: "p-007", quantity: 1, color: "", size: "" }] },
    });
    expect(result).toEqual({ sessionId: 0, accepted: false });
  });
});
