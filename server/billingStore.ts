import {
  computeBillingPrice,
  createDefaultBillingState,
  GCOME_ANNUAL_DISCOUNT_PCT,
  GCOME_COMPARISON_MATRIX,
  GCOME_PLANS,
  type GcomeInvoiceRecord,
  type GcomePaidPlanId,
  type GcomeSignupLead,
  type PersistedBillingState,
} from "../shared/billing";
import type { z } from "zod";
import type {
  billingCheckoutSchema,
  billingRequestUpgradeSchema,
  billingSignupSchema,
} from "../shared/billing";
import { listCheckoutOrders, triggerStoreSave } from "./checkout";
import {
  getServerBillingState,
  getStaffMembers,
  setServerBillingState,
} from "./persistentStore";

function monthKeyAlgiers(isoDate?: string): string {
  const d = isoDate ? new Date(isoDate) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Algiers",
      year: "numeric",
      month: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 7);
  }
}

export function getPublicBillingCatalog() {
  return {
    plans: GCOME_PLANS,
    comparison: GCOME_COMPARISON_MATRIX,
    annualDiscountPct: GCOME_ANNUAL_DISCOUNT_PCT,
  };
}

export async function getAdminBillingOverview() {
  const orders = await listCheckoutOrders();
  const billing = getServerBillingState();
  const currentMonth = monthKeyAlgiers();
  const ordersThisMonth = orders.filter(
    o => monthKeyAlgiers(o.createdAt) === currentMonth
  ).length;
  const staffCount = getStaffMembers().length;

  const planDef = GCOME_PLANS.find(p => p.id === billing.subscription.planId);
  const isUnlimited = billing.subscription.isOwnerUnlimited;

  return {
    subscription: billing.subscription,
    usage: {
      ordersThisMonth,
      orderLimit: isUnlimited ? null : (planDef?.limits.ordersPerMonth ?? null),
      staffCount,
      staffLimit: isUnlimited ? null : (planDef?.limits.staffMembers ?? null),
      storesCount: 1,
      storeLimit: isUnlimited ? null : (planDef?.limits.stores ?? 1),
      currentMonth,
    },
    invoices: billing.invoices,
    signupLeads: billing.signupLeads,
    plans: GCOME_PLANS,
  };
}

function mutateBilling(updater: (current: PersistedBillingState) => PersistedBillingState): PersistedBillingState {
  const cur = getServerBillingState();
  const next = updater({
    subscription: { ...cur.subscription },
    invoices: [...cur.invoices],
    signupLeads: [...cur.signupLeads],
  });
  const saved = setServerBillingState(next);
  triggerStoreSave();
  return saved;
}

export async function createBillingSignupLead(
  input: z.infer<typeof billingSignupSchema>
): Promise<{
  ok: true;
  signupId: string;
  lead: GcomeSignupLead;
}> {
  await listCheckoutOrders();
  const signupId = `SIGN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const lead: GcomeSignupLead = {
    id: signupId,
    createdAt: new Date().toISOString(),
    fullName: input.fullName,
    phone: input.phone,
    email: input.email,
    storeName: input.storeName,
    subdomain: input.subdomain.toLowerCase(),
    wilaya: input.wilaya,
    monthlyVolume: input.monthlyVolume,
    planId: input.planId,
    cycle: input.cycle,
    lang: input.lang,
    status: "new",
  };

  mutateBilling(state => ({
    ...state,
    signupLeads: [lead, ...state.signupLeads].slice(0, 500),
  }));

  return { ok: true, signupId, lead };
}

export async function createBillingCheckoutSession(
  input: z.infer<typeof billingCheckoutSchema>
): Promise<{
  ok: true;
  invoice: GcomeInvoiceRecord;
  mode: "preparation";
}> {
  await listCheckoutOrders();
  const price = computeBillingPrice(input.planId, input.cycle);
  const invoiceId = `INV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const status: GcomeInvoiceRecord["status"] =
    input.paymentMethod === "ccp" ? "pending_verification" : "preparation_mode";

  const invoice: GcomeInvoiceRecord = {
    id: invoiceId,
    createdAt: new Date().toISOString(),
    planId: input.planId,
    cycle: input.cycle,
    amountDzd: price.totalChargedDzd,
    paymentMethod: input.paymentMethod,
    status,
    reference:
      input.ccpReference?.trim() ||
      (input.paymentMethod === "chargily"
        ? `CHRG-PREP-${invoiceId.slice(-6)}`
        : `REF-${invoiceId.slice(-6)}`),
    customerName: input.customerName?.trim(),
    storeName: input.storeName?.trim(),
    phone: input.phone?.trim(),
    ccpReceiptNote: input.ccpReceiptNote?.trim(),
    note:
      input.paymentMethod === "chargily"
        ? "Mode préparation Chargily Pay (CIB / Edahabia / BaridiMob prêt à brancher)"
        : input.paymentMethod === "ccp"
          ? "Virement CCP / BaridiMob enregistré — vérification sous 2h"
          : "Carte internationale — activation prochaine",
  };

  mutateBilling(state => ({
    ...state,
    invoices: [invoice, ...state.invoices].slice(0, 500),
  }));

  return { ok: true, invoice, mode: "preparation" };
}

export async function getBillingInvoiceSummary(invoiceId: string): Promise<{
  found: boolean;
  invoice: Pick<
    GcomeInvoiceRecord,
    "id" | "createdAt" | "planId" | "cycle" | "amountDzd" | "paymentMethod" | "status" | "reference" | "storeName"
  > | null;
}> {
  await listCheckoutOrders();
  const clean = invoiceId.trim();
  if (!clean) return { found: false, invoice: null };
  const billing = getServerBillingState();
  const found = billing.invoices.find(inv => inv.id === clean);
  if (!found) return { found: false, invoice: null };
  return {
    found: true,
    invoice: {
      id: found.id,
      createdAt: found.createdAt,
      planId: found.planId,
      cycle: found.cycle,
      amountDzd: found.amountDzd,
      paymentMethod: found.paymentMethod,
      status: found.status,
      reference: found.reference,
      storeName: found.storeName,
    },
  };
}

export async function requestOwnerPlanUpgrade(
  input: z.infer<typeof billingRequestUpgradeSchema>
) {
  await listCheckoutOrders();
  const price = computeBillingPrice(input.planId as GcomePaidPlanId, input.cycle);
  const invoiceId = `UPG-${Date.now().toString(36).toUpperCase()}`;

  const invoice: GcomeInvoiceRecord = {
    id: invoiceId,
    createdAt: new Date().toISOString(),
    planId: input.planId,
    cycle: input.cycle,
    amountDzd: price.totalChargedDzd,
    paymentMethod: input.paymentMethod,
    status: input.paymentMethod === "ccp" ? "pending_verification" : "preparation_mode",
    storeName: getServerBillingState().subscription.storeName,
    note:
      input.note ||
      `Demande de passage vers l'offre ${input.planId.toUpperCase()} (${input.cycle})`,
  };

  const saved = mutateBilling(state => ({
    ...state,
    subscription: {
      ...state.subscription,
      cycle: input.cycle,
      lastPaymentMethod: input.paymentMethod,
    },
    invoices: [invoice, ...state.invoices].slice(0, 500),
  }));

  return {
    ok: true,
    invoice,
    subscription: saved.subscription,
  };
}

export async function updateBillingSignupLeadStatus(
  leadId: string,
  status: GcomeSignupLead["status"]
) {
  await listCheckoutOrders();
  let updated: GcomeSignupLead | null = null;
  mutateBilling(state => ({
    ...state,
    signupLeads: state.signupLeads.map(l => {
      if (l.id !== leadId) return l;
      updated = { ...l, status };
      return updated;
    }),
  }));
  return { ok: Boolean(updated), lead: updated };
}

export function resetBillingStateToDefault() {
  setServerBillingState(createDefaultBillingState());
}
