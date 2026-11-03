import { describe, expect, it } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { checkoutPayloadSchema, saveDraftSchema, submitOrderSchema } from "../shared/checkout";
import { hashOwnerCode, ownerCodeMatches } from "./adminSetup";

const payload = { source: "abaya", customer: "A", phone: "05", items: [{ productId: "p-007", quantity: 1 }] };

describe("contrats de commande et protection propriétaire", () => {
  it("accepte les contacts incomplets seulement comme payload de brouillon", () => {
    const parsed = checkoutPayloadSchema.parse(payload);
    expect(parsed.customer).toBe("A");
    expect(parsed.phone).toBe("05");
    expect(parsed.address).toBe("");
    expect(parsed.items[0].size).toBe("");
  });
  it("exige un accord positif explicite pour enregistrer un brouillon", () => {
    const token = "0363f66f-398a-4b75-9a5c-8ead7e77c5c5";
    expect(saveDraftSchema.safeParse({ token, revision: 1, payload }).success).toBe(false);
    expect(saveDraftSchema.safeParse({ token, revision: 1, consent: false, payload }).success).toBe(false);
    expect(saveDraftSchema.safeParse({ token, revision: 1, consent: true, payload }).success).toBe(true);
  });
  it("retire les montants, mots de passe et données inconnues du navigateur", () => {
    const parsed = submitOrderSchema.parse({ token: "0363f66f-398a-4b75-9a5c-8ead7e77c5c5", payload: { ...payload, total: 1, password: "not-a-real-password", email: "not-a-real-email", items: [{ productId: "p-007", quantity: 1, price: 1 }] } });
    expect(parsed.payload).not.toHaveProperty("total");
    expect(parsed.payload).not.toHaveProperty("password");
    expect(parsed.payload).not.toHaveProperty("email");
    expect(parsed.payload.items[0]).not.toHaveProperty("price");
  });
  it("rejette jetons non privés, volumes excessifs et quantités invalides", () => {
    expect(submitOrderSchema.safeParse({ token: "1", payload }).success).toBe(false);
    expect(checkoutPayloadSchema.safeParse({ ...payload, note: "x".repeat(1001) }).success).toBe(false);
    expect(checkoutPayloadSchema.safeParse({ ...payload, items: [{ productId: "p-007", quantity: 0 }] }).success).toBe(false);
  });
  it("ne stocke pas la clé propriétaire en clair et ne valide pas une autre clé", () => {
    const code = randomBytes(32).toString("base64url");
    const expected = createHash("sha256").update(code).digest("hex");
    expect(hashOwnerCode(code)).toBe(expected);
    expect(expected).not.toBe(code);
    expect(ownerCodeMatches(code, expected)).toBe(true);
    expect(ownerCodeMatches(` ${code}\n`, expected)).toBe(true);
    expect(ownerCodeMatches(randomBytes(32).toString("base64url"), expected)).toBe(false);
    expect(ownerCodeMatches("guess", expected)).toBe(false);
    expect(ownerCodeMatches(code, null)).toBe(false);
  });
});
