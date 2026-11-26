import { beforeEach, describe, expect, it } from "vitest";
import { computeBillingPrice, GCOME_PLANS } from "../shared/billing";
import {
  createBillingCheckoutSession,
  createBillingSignupLead,
  getAdminBillingOverview,
  getBillingInvoiceSummary,
  getPublicBillingCatalog,
  requestOwnerPlanUpgrade,
  resetBillingStateToDefault,
  updateBillingSignupLeadStatus,
} from "./billingStore";
import { isGcomePrimaryRequest, publicPlatformScript } from "./_core/publicConfig";

describe("GCOME billing & multi-domain routing", () => {
  beforeEach(() => {
    resetBillingStateToDefault();
  });

  it("computes monthly and yearly -20% prices cleanly in DZD", () => {
    expect(GCOME_PLANS.map(p => p.monthlyPriceDzd)).toEqual([2900, 6900, 14900]);

    const proMonthly = computeBillingPrice("pro", "monthly");
    expect(proMonthly.monthlyEquivalentDzd).toBe(6900);
    expect(proMonthly.totalChargedDzd).toBe(6900);
    expect(proMonthly.savingsPerYearDzd).toBe(0);

    const proYearly = computeBillingPrice("pro", "yearly");
    expect(proYearly.monthlyEquivalentDzd).toBe(5520);
    expect(proYearly.totalChargedDzd).toBe(5520 * 12);
    expect(proYearly.savingsPerYearDzd).toBe(6900 * 12 - 5520 * 12);
  });

  it("records SaaS signup leads and checkout invoices without leaking PII on public status lookup", async () => {
    const catalog = getPublicBillingCatalog();
    expect(catalog.plans).toHaveLength(3);
    expect(catalog.annualDiscountPct).toBe(20);

    const signup = await createBillingSignupLead({
      fullName: "Nadia Test",
      phone: "0550112233",
      email: "nadia@example.com",
      storeName: "Maison Nadia",
      subdomain: "maison-nadia",
      wilaya: "Alger",
      monthlyVolume: "100-500",
      planId: "pro",
      cycle: "yearly",
      lang: "ar",
    });
    expect(signup.ok).toBe(true);
    expect(signup.lead.status).toBe("new");

    const checkout = await createBillingCheckoutSession({
      planId: "pro",
      cycle: "yearly",
      paymentMethod: "ccp",
      customerName: "Nadia Test",
      storeName: "Maison Nadia",
      phone: "0550112233",
      ccpReference: "BARIDI-889900",
      ccpReceiptNote: "Private internal note 0550112233",
      signupId: signup.signupId,
    });
    expect(checkout.ok).toBe(true);
    expect(checkout.invoice.status).toBe("pending_verification");
    expect(checkout.invoice.amountDzd).toBe(5520 * 12);

    const publicSummary = await getBillingInvoiceSummary(checkout.invoice.id);
    expect(publicSummary.found).toBe(true);
    expect(publicSummary.invoice?.reference).toBe("BARIDI-889900");
    // Privacy check: phone and internal receipt note stay stripped from public summary
    expect((publicSummary.invoice as Record<string, unknown>)?.phone).toBeUndefined();
    expect((publicSummary.invoice as Record<string, unknown>)?.ccpReceiptNote).toBeUndefined();

    const updatedLead = await updateBillingSignupLeadStatus(signup.signupId, "activated");
    expect(updatedLead.ok).toBe(true);
    expect(updatedLead.lead?.status).toBe("activated");
  });

  it("keeps Miss Sensuelle owner unlimited protection while logging upgrade requests", async () => {
    const initial = await getAdminBillingOverview();
    expect(initial.subscription.isOwnerUnlimited).toBe(true);
    expect(initial.usage.orderLimit).toBeNull();
    expect(initial.usage.staffLimit).toBeNull();

    const upg = await requestOwnerPlanUpgrade({
      planId: "business",
      cycle: "monthly",
      paymentMethod: "chargily",
    });
    expect(upg.ok).toBe(true);
    expect(upg.subscription.isOwnerUnlimited).toBe(true);
    expect(upg.invoice.amountDzd).toBe(14900);
  });

  it("detects separate free Render GCOME domain without impacting Miss Sensuelle storefront", () => {
    expect(isGcomePrimaryRequest("missensuelle.onrender.com", {})).toBe(false);
    expect(isGcomePrimaryRequest("gcome-dz.onrender.com", {})).toBe(true);
    expect(isGcomePrimaryRequest("missensuelle.onrender.com", { GCOME_PRIMARY_SITE: "true" })).toBe(true);

    expect(publicPlatformScript({}, "gcome.onrender.com")).toContain('"gcome"');
    expect(publicPlatformScript({}, "missensuelle.onrender.com")).toContain('"storefront"');
  });
});
