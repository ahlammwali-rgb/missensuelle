import { z } from "zod";
import {
  isCarrierTrackingDelivered,
  isCarrierTrackingReturned,
  type CarrierTrackingSummary,
} from "./carrierStatus";
import { parseCarrierTimestamp } from "./carrierHistory";
import type { CheckoutOrder, OrderCarrier, StaffMember } from "./checkout";
import { wilayaIdFromName, type ShippingRate } from "./shipping";

export const financeExpenseCategorySchema = z.enum([
  "packaging",
  "rent",
  "salary",
  "transport",
  "ugc_shooting",
  "software",
  "bank_fees",
  "marketing_other",
  "other",
]);
export type FinanceExpenseCategory = z.infer<typeof financeExpenseCategorySchema>;

export const FINANCE_EXPENSE_CATEGORY_LABELS: Record<FinanceExpenseCategory, string> = {
  packaging: "Emballage & Boîtes",
  rent: "Loyer & Local",
  salary: "Salaires Fixes",
  transport: "Transport & Coursier Stock",
  ugc_shooting: "Shooting / Créateurs UGC",
  software: "Logiciels & Hébergement",
  bank_fees: "Frais Banque / Devise",
  marketing_other: "Marketing / Boost Hors API",
  other: "Autres Charges",
};

export const financeLotInputSchema = z.object({
  id: z.string().trim().max(80).optional(),
  productId: z.string().trim().min(1).max(120),
  productName: z.string().trim().min(1).max(200),
  variantKey: z.string().trim().max(160).optional().default(""),
  purchasedAt: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  quantityInitial: z.number().int().min(1).max(100000),
  unitCostDzd: z.number().min(0).max(5000000),
  supplier: z.string().trim().max(160).optional().default(""),
  note: z.string().trim().max(400).optional().default(""),
});
export type FinancePurchaseLotInput = z.infer<typeof financeLotInputSchema>;

export type FinancePurchaseLot = FinancePurchaseLotInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export const financeExpenseInputSchema = z.object({
  id: z.string().trim().max(80).optional(),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().min(1).max(200),
  category: financeExpenseCategorySchema,
  frequency: z.enum(["daily", "monthly_fixed"]),
  amount: z.number().min(0).max(100000000),
  currency: z.enum(["DZD", "USD", "EUR"]).default("DZD"),
  note: z.string().trim().max(400).optional().default(""),
});
export type FinanceExpenseInput = z.infer<typeof financeExpenseInputSchema>;

export type FinanceExpense = FinanceExpenseInput & {
  id: string;
  createdAt: string;
};

export const financeExchangeRateInputSchema = z.object({
  id: z.string().trim().max(80).optional(),
  effectiveDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  usdToDzd: z.number().min(1).max(10000),
  eurToDzd: z.number().min(1).max(10000).optional(),
  note: z.string().trim().max(200).optional().default(""),
});
export type FinanceExchangeRateInput = z.infer<typeof financeExchangeRateInputSchema>;

export type FinanceExchangeRateEntry = {
  id: string;
  effectiveDate: string;
  usdToDzd: number;
  eurToDzd?: number;
  note?: string;
};

export type FinanceAdPlatform = "meta" | "tiktok";
export type FinanceAdCurrency = "USD" | "EUR" | "DZD";

export const financeAdSpendManualSchema = z.object({
  id: z.string().trim().max(120).optional(),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  platform: z.enum(["meta", "tiktok"]),
  campaignId: z.string().trim().max(140).optional(),
  campaignName: z.string().trim().min(1).max(200),
  productId: z.string().trim().max(120).optional().default(""),
  variantKey: z.string().trim().max(160).optional().default(""),
  spendAmount: z.number().min(0).max(1000000),
  currency: z.enum(["USD", "EUR", "DZD"]).default("USD"),
  impressions: z.number().int().min(0).optional().default(0),
  clicks: z.number().int().min(0).optional().default(0),
  conversions: z.number().int().min(0).optional().default(0),
});
export type FinanceAdSpendManualInput = z.infer<typeof financeAdSpendManualSchema>;

export type FinanceAdSpendEntry = {
  id: string;
  date: string;
  platform: FinanceAdPlatform;
  campaignId: string;
  campaignName: string;
  productId?: string;
  variantKey?: string;
  spendAmount: number;
  currency: FinanceAdCurrency;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  source: "meta_api" | "tiktok_api" | "csv" | "manual";
  updatedAt: string;
};

export const financeCampaignMappingSchema = z.object({
  campaignId: z.string().trim().min(1).max(160),
  campaignName: z.string().trim().min(1).max(220),
  platform: z.enum(["meta", "tiktok"]),
  productId: z.string().trim().max(120),
  variantKey: z.string().trim().max(160).optional().default(""),
  confidence: z.number().min(0).max(1).optional(),
  mappedBy: z.enum(["manual", "auto_keyword", "ai"]).optional().default("manual"),
});
export type FinanceCampaignMappingInput = z.infer<typeof financeCampaignMappingSchema>;

export type FinanceCampaignMapping = FinanceCampaignMappingInput & {
  updatedAt: string;
};

export const financeSettingsPatchSchema = z.object({
  defaultUsdToDzd: z.number().min(1).max(10000).optional(),
  defaultEurToDzd: z.number().min(1).max(10000).optional(),
  packagingPerParcelDzd: z.number().min(0).max(50000).optional(),
  ecomReturnFeeDzd: z.number().min(0).max(50000).optional(),
  dhdReturnFeeDzd: z.number().min(0).max(50000).optional(),
  chargeOutboundShippingOnReturn: z.boolean().optional(),
  includeStaffBaseSalary: z.boolean().optional(),
  autoSyncAdsEnabled: z.boolean().optional(),
});
export type FinanceSettingsPatch = z.infer<typeof financeSettingsPatchSchema>;

export type FinanceSettings = {
  defaultUsdToDzd: number;
  defaultEurToDzd: number;
  packagingPerParcelDzd: number;
  ecomReturnFeeDzd: number;
  dhdReturnFeeDzd: number;
  chargeOutboundShippingOnReturn: boolean;
  includeStaffBaseSalary: boolean;
  autoSyncAdsEnabled: boolean;
};

export const DEFAULT_FINANCE_SETTINGS: FinanceSettings = {
  defaultUsdToDzd: 250,
  defaultEurToDzd: 270,
  packagingPerParcelDzd: 0,
  ecomReturnFeeDzd: 0,
  dhdReturnFeeDzd: 50,
  chargeOutboundShippingOnReturn: false,
  includeStaffBaseSalary: true,
  autoSyncAdsEnabled: true,
};

export type FinanceOrderCostOverride = {
  orderId: string;
  unitCostDzd?: number;
  lotId?: string;
  carrierFeeDzd?: number;
  packagingDzd?: number;
  updatedAt: string;
};

export type FinanceAdDiscoveredAccount = {
  id: string;
  name: string;
  currency: FinanceAdCurrency;
  status?: string;
};

export type FinanceAdOAuthStatusFields = {
  authMode?: "oauth" | "manual";
  oauthAppConfigured?: boolean;
  oauthAppId?: string;
  oauthAppSecretPreview?: string;
  oauthFromEnv?: boolean;
  userName?: string;
  tokenExpiresAt?: string;
  discoveredAccounts?: FinanceAdDiscoveredAccount[];
  selectedAccountIds?: string[];
};

export type FinanceAdPlatformCreds = {
  meta?: {
    adAccountId: string;
    accessToken: string;
    authMode?: "oauth" | "manual";
    userName?: string;
    tokenExpiresAt?: string;
    discoveredAccounts?: FinanceAdDiscoveredAccount[];
    selectedAccountIds?: string[];
    oauthAppId?: string;
    oauthAppSecret?: string;
    lastSyncAt?: string;
    lastError?: string;
  };
  tiktok?: {
    advertiserId: string;
    accessToken: string;
    authMode?: "oauth" | "manual";
    userName?: string;
    tokenExpiresAt?: string;
    discoveredAccounts?: FinanceAdDiscoveredAccount[];
    selectedAccountIds?: string[];
    oauthAppId?: string;
    oauthAppSecret?: string;
    lastSyncAt?: string;
    lastError?: string;
  };
};

export type FinanceAdConnectionStatus = {
  meta: {
    configured: boolean;
    adAccountId: string;
    tokenPreview: string;
    lastSyncAt?: string;
    lastError?: string;
  } & FinanceAdOAuthStatusFields;
  tiktok: {
    configured: boolean;
    advertiserId: string;
    tokenPreview: string;
    lastSyncAt?: string;
    lastError?: string;
  } & FinanceAdOAuthStatusFields;
};

export type PersistedFinanceState = {
  lots: FinancePurchaseLot[];
  expenses: FinanceExpense[];
  adSpends: FinanceAdSpendEntry[];
  campaignMappings: Record<string, FinanceCampaignMapping>;
  exchangeRates: FinanceExchangeRateEntry[];
  orderOverrides: Record<string, FinanceOrderCostOverride>;
  settings: FinanceSettings;
  adCredentials: FinanceAdPlatformCreds;
};

export function createDefaultPersistedFinanceState(): PersistedFinanceState {
  return {
    lots: [],
    expenses: [],
    adSpends: [],
    campaignMappings: {},
    exchangeRates: [],
    orderOverrides: {},
    settings: { ...DEFAULT_FINANCE_SETTINGS },
    adCredentials: {},
  };
}

export type FinanceCatalogProductRef = {
  id: string;
  name: string;
  slug?: string;
  price?: number;
  colors?: string[];
  stock?: number;
};

export type FinanceViewMode = "cohort" | "cashflow";

export type FinanceLotHealth = {
  lot: FinancePurchaseLot;
  consumedDelivered: number;
  reservedInTransit: number;
  remainingQty: number;
  pctRemaining: number;
  status: "healthy" | "low" | "empty";
};

export type FinanceProductSummary = {
  productId: string;
  productName: string;
  totalOrders: number;
  confirmedOrders: number;
  deliveredOrders: number;
  returnedOrders: number;
  inTransitOrders: number;
  unitsDelivered: number;
  confirmationRatePct: number;
  deliveryRatePct: number;
  returnRatePct: number;
  grossRevenueDzd: number;
  cogsDzd: number;
  shippingFeeDzd: number;
  returnFeeDzd: number;
  packagingDzd: number;
  commissionDzd: number;
  adSpendUsd: number;
  adSpendDzd: number;
  netProfitDzd: number;
  netMarginPct: number;
  actualCpaDeliveredDzd: number | null;
  breakevenCpaDeliveredDzd: number | null;
  breakevenCpaLeadDzd: number | null;
  roasGross: number | null;
  minRoas: number | null;
  avgLotUnitCostDzd: number;
  missingLotOrders: number;
  verdict: "winner" | "fragile" | "loser" | "pending";
};

export type FinanceVariantSummary = FinanceProductSummary & {
  variantKey: string;
  color: string;
  size: string;
};

export type FinanceWilayaSummary = {
  wilaya: string;
  totalOrders: number;
  deliveredOrders: number;
  returnedOrders: number;
  inTransitOrders: number;
  deliveryRatePct: number;
  returnRatePct: number;
  grossRevenueDzd: number;
  shippingAndReturnDzd: number;
  netProfitBeforeFixedDzd: number;
};

export type FinanceCarrierSummary = {
  carrier: "ecom" | "ecotrack";
  label: string;
  transferredCount: number;
  deliveredCount: number;
  returnedCount: number;
  inTransitCount: number;
  deliveryRatePct: number;
  returnRatePct: number;
  grossDeliveredDzd: number;
  shippingFeeDzd: number;
  returnFeeDzd: number;
  cashCollectedUnpaidDzd: number;
  cashRecoveredDzd: number;
  cashDeliveredUnknownDzd: number;
  netContributionDzd: number;
};

export type FinanceDailyPoint = {
  date: string;
  label: string;
  ordersCount: number;
  deliveredCount: number;
  returnedCount: number;
  grossRevenueDzd: number;
  cogsDzd: number;
  shippingAndReturnDzd: number;
  commissionDzd: number;
  packagingDzd: number;
  adSpendDzd: number;
  adSpendUsd: number;
  fixedAndDailyChargesDzd: number;
  netProfitDzd: number;
  cumulativeProfitDzd: number;
};

export type FinanceAnomaly = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  actionTab?: "lots" | "ads" | "charges" | "products" | "overview";
};

export type FinanceOrderBreakdown = {
  orderId: string;
  orderDate: string;
  cashflowDate: string;
  productId: string;
  productName: string;
  variantKey: string;
  customer: string;
  wilaya: string;
  carrier: OrderCarrier | null;
  deliveryMode: "home" | "office";
  state: "delivered" | "returned" | "in_transit" | "not_shipped";
  quantity: number;
  grossRevenueDzd: number;
  cogsDzd: number;
  unitCostDzd: number;
  lotId: string | null;
  hasMissingLot: boolean;
  shippingFeeDzd: number;
  returnFeeDzd: number;
  packagingDzd: number;
  commissionDzd: number;
  allocatedAdSpendDzd: number;
  netProfitDzd: number;
  encaisser: boolean;
  recouvert: boolean;
};

export type FinanceOverviewResponse = {
  viewMode: FinanceViewMode;
  startDate: string;
  endDate: string;
  effectiveUsdToDzd: number;
  kpis: {
    status: "profitable" | "breakeven" | "deficit";
    netProfitDzd: number;
    netMarginPct: number;
    grossRevenueDzd: number;
    cogsDzd: number;
    shippingFeeDzd: number;
    returnFeeDzd: number;
    packagingPerParcelDzd: number;
    commissionDzd: number;
    adSpendUsd: number;
    adSpendDzd: number;
    metaSpendUsd: number;
    metaSpendDzd: number;
    tiktokSpendUsd: number;
    tiktokSpendDzd: number;
    unmappedAdSpendDzd: number;
    dailyChargesDzd: number;
    fixedChargesProratedDzd: number;
    staffSalaryProratedDzd: number;
    totalCostsDzd: number;
    roasGross: number | null;
    totalOrders: number;
    deliveredOrders: number;
    returnedOrders: number;
    inTransitOrders: number;
    confirmationRatePct: number;
    deliveryRatePct: number;
    returnRatePct: number;
    avgProfitPerDeliveredDzd: number;
    cashDeliveredUnrecoveredDzd: number;
    cashDeliveredRecoveredDzd: number;
    cashInTransitDzd: number;
    missingLotOrdersCount: number;
  };
  waterfall: Array<{
    key: string;
    label: string;
    amountDzd: number;
    pctOfRevenue: number;
    tone: "revenue" | "cost" | "profit" | "loss";
  }>;
  dailySeries: FinanceDailyPoint[];
  products: FinanceProductSummary[];
  variants: FinanceVariantSummary[];
  wilayas: FinanceWilayaSummary[];
  carriers: FinanceCarrierSummary[];
  lotHealth: FinanceLotHealth[];
  unmappedCampaigns: Array<{
    campaignId: string;
    campaignName: string;
    platform: FinanceAdPlatform;
    spendUsd: number;
    spendDzd: number;
  }>;
  anomalies: FinanceAnomaly[];
  recentOrderSample: FinanceOrderBreakdown[];
  settings: FinanceSettings;
  adConnections: FinanceAdConnectionStatus;
  lots: FinancePurchaseLot[];
  expenses: FinanceExpense[];
  adSpends: FinanceAdSpendEntry[];
  campaignMappings: FinanceCampaignMapping[];
  exchangeRates: FinanceExchangeRateEntry[];
};

const ALGIERS_TZ = "Africa/Algiers";
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ALGIERS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Converts any timestamp/date into `YYYY-MM-DD` in Algeria timezone (`Africa/Algiers`). */
export function algiersDateKey(input?: string | Date | number | null): string {
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    return input.trim();
  }
  const d =
    input instanceof Date
      ? input
      : typeof input === "number"
        ? new Date(input)
        : input
          ? new Date(input)
          : new Date();
  if (Number.isNaN(d.getTime())) {
    return dateFormatter.format(new Date());
  }
  return dateFormatter.format(d);
}

function normStr(raw?: string | null): string {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeFinanceVariantKey(color?: string | null, size?: string | null): string {
  const c = String(color || "").trim();
  const s = String(size || "").trim();
  if (c && s) return `${c} · ${s}`;
  return c || s || "";
}

function variantMatches(orderColor: string, orderSize: string, lotVariantRaw?: string | null): boolean {
  const lotNorm = normStr(lotVariantRaw);
  if (!lotNorm) return false;
  const full = normStr(normalizeFinanceVariantKey(orderColor, orderSize));
  const cNorm = normStr(orderColor);
  const sNorm = normStr(orderSize);
  if (full && lotNorm === full) return true;
  if (cNorm && lotNorm === cNorm) return true;
  if (sNorm && lotNorm === sNorm) return true;
  // Also match if lot specifies `"Color / Size"` or `"Color - Size"`
  const normalizedLotSlash = lotNorm.replace(/\s*[-/|·]\s*/g, " · ");
  const normalizedOrderSlash = full.replace(/\s*[-/|·]\s*/g, " · ");
  return Boolean(normalizedOrderSlash && normalizedLotSlash === normalizedOrderSlash);
}

export function getEffectiveExchangeRate(
  dateKey: string,
  currency: FinanceAdCurrency,
  rateHistory: FinanceExchangeRateEntry[],
  settings: FinanceSettings
): number {
  if (currency === "DZD") return 1;
  const sorted = [...rateHistory].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  let matched: FinanceExchangeRateEntry | undefined;
  for (const entry of sorted) {
    if (entry.effectiveDate <= dateKey) {
      matched = entry;
    } else {
      break;
    }
  }
  if (!matched && sorted.length > 0 && dateKey < sorted[0].effectiveDate) {
    // Keep default unless explicitly covered by an earlier effectiveDate
    return currency === "EUR" ? settings.defaultEurToDzd : settings.defaultUsdToDzd;
  }
  if (matched) {
    if (currency === "EUR") {
      return matched.eurToDzd && matched.eurToDzd > 0 ? matched.eurToDzd : settings.defaultEurToDzd;
    }
    return matched.usdToDzd > 0 ? matched.usdToDzd : settings.defaultUsdToDzd;
  }
  return currency === "EUR" ? settings.defaultEurToDzd : settings.defaultUsdToDzd;
}

export function resolveOrderProductInfo(
  order: CheckoutOrder,
  catalog: FinanceCatalogProductRef[]
): { productId: string; productName: string } {
  const cleanId = String(order.productId || "").trim();
  const cleanOrderName = String(order.product || "")
    .replace(/\s*[×x]\s*\d+\s*$/i, "")
    .trim();
  const normOrderName = normStr(cleanOrderName);

  if (cleanId) {
    const byId = catalog.find(p => p.id === cleanId);
    if (byId) return { productId: byId.id, productName: byId.name };
  }

  if (normOrderName) {
    const exactName = catalog.find(p => normStr(p.name) === normOrderName);
    if (exactName) return { productId: exactName.id, productName: exactName.name };
    const partialName = catalog.find(p => {
      const pn = normStr(p.name);
      return pn.length >= 4 && (normOrderName.includes(pn) || pn.includes(normOrderName));
    });
    if (partialName) return { productId: partialName.id, productName: partialName.name };
  }

  return {
    productId: cleanId || `name:${normOrderName || "inconnu"}`,
    productName: cleanOrderName || "Produit non référencé",
  };
}

function daysInclusive(startDate: string, endDate: string): string[] {
  const s = new Date(`${startDate}T12:00:00Z`);
  const e = new Date(`${endDate}T12:00:00Z`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || s > e) return [];
  const out: string[] = [];
  const cursor = new Date(s);
  let guard = 0;
  while (cursor <= e && guard < 1100) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard++;
  }
  return out;
}

function daysInMonthOfDateKey(dateKey: string): number {
  const [y, m] = dateKey.split("-").map(Number);
  if (!y || !m) return 30;
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function findTrackingSummary(
  trackingMap: Record<string, CarrierTrackingSummary>,
  tracking?: string | null
): CarrierTrackingSummary | undefined {
  const clean = String(tracking || "").trim();
  if (!clean) return undefined;
  if (trackingMap[clean]) return trackingMap[clean];
  const lower = clean.toLowerCase();
  for (const [k, v] of Object.entries(trackingMap)) {
    if (k.trim().toLowerCase() === lower) return v;
  }
  return undefined;
}

function resolveDeliveredOrReturnedDateKey(
  order: CheckoutOrder,
  trk?: CarrierTrackingSummary
): string {
  const hist = Array.isArray(trk?.historique) ? trk!.historique! : [];
  let bestMs = 0;
  for (let i = hist.length - 1; i >= 0; i--) {
    const ms = parseCarrierTimestamp(hist[i]?.date);
    if (ms) {
      bestMs = ms;
      break;
    }
  }
  if (bestMs > 0) return algiersDateKey(bestMs);
  if (order.deliveredAt) return algiersDateKey(order.deliveredAt);
  if (order.returnReceivedAt) return algiersDateKey(order.returnReceivedAt);
  return algiersDateKey(order.createdAt);
}

export type ComputeFinanceDashboardParams = {
  orders: CheckoutOrder[];
  catalog: FinanceCatalogProductRef[];
  staffMembers: StaffMember[];
  ecomShipments: Record<string, { tracking?: string; at?: string }>;
  ecoShipments: Record<string, { tracking?: string; at?: string }>;
  trackingMap: Record<string, CarrierTrackingSummary>;
  ecomRates: Record<string, ShippingRate>;
  ecoRates: Record<string, ShippingRate>;
  financeState: PersistedFinanceState;
  adConnectionsPublic: FinanceAdConnectionStatus;
  viewMode: FinanceViewMode;
  startDate: string;
  endDate: string;
};

function computeStaffCommissionForOrder(
  order: CheckoutOrder,
  resolvedProductId: string,
  staffById: Map<string, StaffMember>
): number {
  const confId = String(order.confirmedById || "").trim();
  if (!confId || confId === "owner" || confId === "system") return 0;
  const member = staffById.get(confId);
  if (!member) return 0;

  let total =
    member.productCommissions && typeof member.productCommissions[resolvedProductId] === "number"
      ? member.productCommissions[resolvedProductId]
      : member.commissionPerDelivered;

  const isUpsell =
    Boolean(order.upsellById) ||
    (typeof order.initialQuantity === "number" && order.quantity > order.initialQuantity) ||
    (order.history ?? []).some(h => Boolean(h.meta?.upsellPack));

  if (isUpsell) {
    const upsellActor = order.upsellById ? staffById.get(order.upsellById) : member;
    if (upsellActor) {
      total += upsellActor.upsellBonusPerDelivered || 0;
    }
  }
  return Math.max(0, Math.round(total));
}

function getCarrierShippingRate(
  carrier: OrderCarrier | null,
  wilaya: string,
  commune: string,
  deliveryMode: "home" | "office",
  ecomRates: Record<string, ShippingRate>,
  ecoRates: Record<string, ShippingRate>
): number {
  if (!carrier) return 0;
  const wid = wilayaIdFromName(wilaya, commune);
  if (!wid) return 0;
  const table = carrier === "ecotrack" ? ecoRates : ecomRates;
  const rate = table[String(wid)];
  if (!rate) return 0;
  return deliveryMode === "office" ? Number(rate.stopdesk || 0) : Number(rate.domicile || 0);
}

/**
 * Computes the complete, deterministic Finance IA overview across FIFO purchase lots,
 * variant costs, carrier fees & returns, commissions, Meta/TikTok ad spend, daily & fixed charges.
 */
export function computeFinanceDashboard(params: ComputeFinanceDashboardParams): FinanceOverviewResponse {
  const {
    orders,
    catalog,
    staffMembers,
    ecomShipments,
    ecoShipments,
    trackingMap,
    ecomRates,
    ecoRates,
    financeState,
    adConnectionsPublic,
    viewMode,
    startDate,
    endDate,
  } = params;

  const settings: FinanceSettings = { ...DEFAULT_FINANCE_SETTINGS, ...(financeState.settings || {}) };
  const staffById = new Map(staffMembers.map(s => [s.id, s]));

  // Sort ALL orders chronologically ascending first so FIFO lot consumption is invariant regardless of date filter!
  const chronologicalOrders = [...orders].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Clone lot remaining counters for chronological FIFO assignment
  const lotEntries = [...(financeState.lots || [])]
    .sort((a, b) => {
      if (a.purchasedAt !== b.purchasedAt) return a.purchasedAt.localeCompare(b.purchasedAt);
      return a.createdAt.localeCompare(b.createdAt);
    })
    .map(lot => ({
      lot,
      consumedDelivered: 0,
      reservedInTransit: 0,
      remaining: Math.max(0, lot.quantityInitial),
    }));

  const resolveOrderState = (order: CheckoutOrder) => {
    const ecoSh = ecoShipments[order.id];
    const ecomSh = ecomShipments[order.id];
    const carrier: OrderCarrier | null = ecoSh
      ? "ecotrack"
      : ecomSh
        ? "ecom"
        : order.carrier || null;
    const sh = carrier === "ecotrack" ? (ecoSh || ecomSh) : (ecomSh || ecoSh);
    const tracking = sh?.tracking?.trim();
    const trk = findTrackingSummary(trackingMap, tracking);

    const isReturned = Boolean(order.returnReceived || isCarrierTrackingReturned(trk));
    const isDelivered = !isReturned && Boolean(order.isDelivered || isCarrierTrackingDelivered(trk));
    const hasShipment = Boolean(tracking || order.status === "transferee");

    const state: FinanceOrderBreakdown["state"] = isReturned
      ? "returned"
      : isDelivered
        ? "delivered"
        : hasShipment
          ? "in_transit"
          : "not_shipped";

    return { carrier, sh, trk, state };
  };

  const assignFifoLot = (
    productId: string,
    productName: string,
    color: string,
    size: string,
    orderDateKey: string,
    qty: number,
    consumeMode: "delivered" | "reserve"
  ): { unitCostDzd: number; lotId: string | null; missing: boolean } => {
    const normPid = normStr(productId);
    const normPname = normStr(productName);

    const matchesProduct = (l: FinancePurchaseLot) =>
      normStr(l.productId) === normPid || normStr(l.productName) === normPname;

    const variantMatchesOrdered = lotEntries.filter(
      e => matchesProduct(e.lot) && variantMatches(color, size, e.lot.variantKey)
    );
    const genericMatchesOrdered = lotEntries.filter(
      e => matchesProduct(e.lot) && !String(e.lot.variantKey || "").trim()
    );

    const consumeAcrossPool = (pool: typeof lotEntries, neededQty: number) => {
      if (pool.length === 0 || neededQty <= 0) return { consumed: 0, totalCost: 0, primaryLotId: null as string | null };
      let remainingNeed = neededQty;
      let totalCost = 0;
      let consumed = 0;
      let primaryLotId: string | null = null;

      const datedOpen = pool.filter(e => e.lot.purchasedAt <= orderDateKey && e.remaining > 0);
      const anyOpen = pool.filter(e => e.remaining > 0);
      const candidates = datedOpen.length > 0 ? [...datedOpen, ...anyOpen.filter(e => !datedOpen.includes(e))] : anyOpen;

      for (const entry of candidates) {
        if (remainingNeed <= 0) break;
        const take = Math.min(remainingNeed, entry.remaining);
        if (take <= 0) continue;
        if (!primaryLotId) primaryLotId = entry.lot.id;
        if (consumeMode === "delivered") entry.consumedDelivered += take;
        else entry.reservedInTransit += take;
        entry.remaining = Math.max(0, entry.remaining - take);
        totalCost += take * Number(entry.lot.unitCostDzd || 0);
        consumed += take;
        remainingNeed -= take;
      }

      return { consumed, totalCost, primaryLotId };
    };

    let qtyNeeded = qty;
    let totalCost = 0;
    let primaryLotId: string | null = null;

    // Priority 1: Variant-specific open lots
    const vRes = consumeAcrossPool(variantMatchesOrdered, qtyNeeded);
    qtyNeeded -= vRes.consumed;
    totalCost += vRes.totalCost;
    if (vRes.primaryLotId) primaryLotId = vRes.primaryLotId;

    // Priority 2: Generic product open lots for any remaining qty
    if (qtyNeeded > 0) {
      const gRes = consumeAcrossPool(genericMatchesOrdered, qtyNeeded);
      qtyNeeded -= gRes.consumed;
      totalCost += gRes.totalCost;
      if (!primaryLotId && gRes.primaryLotId) primaryLotId = gRes.primaryLotId;
    }

    // Priority 3: If matching lots exist but stock reached 0, price leftover qty using latest matching lot
    if (qtyNeeded > 0) {
      const fallbackPool = variantMatchesOrdered.length > 0 ? variantMatchesOrdered : genericMatchesOrdered;
      const datedFallback = [...fallbackPool].reverse().find(e => e.lot.purchasedAt <= orderDateKey);
      const fallbackLot = datedFallback || fallbackPool[fallbackPool.length - 1];
      if (!fallbackLot) {
        if (qtyNeeded === qty) {
          return { unitCostDzd: 0, lotId: null, missing: true };
        }
      } else {
        if (!primaryLotId) primaryLotId = fallbackLot.lot.id;
        if (consumeMode === "delivered") fallbackLot.consumedDelivered += qtyNeeded;
        else fallbackLot.reservedInTransit += qtyNeeded;
        totalCost += qtyNeeded * Number(fallbackLot.lot.unitCostDzd || 0);
        qtyNeeded = 0;
      }
    }

    return {
      unitCostDzd: qty > 0 ? totalCost / qty : 0,
      lotId: primaryLotId,
      missing: qtyNeeded === qty,
    };
  };

  // Build full chronological order financials BEFORE filtering by view date range
  const allBreakdowns: Array<FinanceOrderBreakdown & { isConfirmed: boolean; rawOrder: CheckoutOrder }> = [];
  for (const order of chronologicalOrders) {
    const qty = Math.max(1, Number(order.quantity || 1));
    const orderDate = algiersDateKey(order.createdAt);
    const { productId, productName } = resolveOrderProductInfo(order, catalog);
    const { carrier, trk, state } = resolveOrderState(order);
    const deliveryMode: "home" | "office" = order.delivery === "office" ? "office" : "home";
    const variantKey = normalizeFinanceVariantKey(order.color, order.size);
    const override = financeState.orderOverrides?.[order.id];

    let unitCostDzd = 0;
    let lotId: string | null = null;
    let hasMissingLot = false;

    if (override && typeof override.unitCostDzd === "number") {
      unitCostDzd = Math.max(0, override.unitCostDzd);
      lotId = override.lotId ?? null;
    } else if (state === "delivered" || state === "in_transit") {
      const assigned = assignFifoLot(
        productId,
        productName,
        order.color || "",
        order.size || "",
        orderDate,
        qty,
        state === "delivered" ? "delivered" : "reserve"
      );
      unitCostDzd = assigned.unitCostDzd;
      lotId = assigned.lotId;
      hasMissingLot = assigned.missing;
    }

    const isDelivered = state === "delivered";
    const isReturned = state === "returned";
    const isShipped = isDelivered || isReturned || state === "in_transit";
    const isConfirmed = order.status === "confirmee" || order.status === "transferee" || isShipped;

    const grossRevenueDzd = isDelivered ? Math.max(0, Number(order.total || 0)) : 0;
    const cogsDzd = isDelivered ? Math.round(unitCostDzd * qty) : 0;

    const baseRate = getCarrierShippingRate(
      carrier,
      order.wilaya || "",
      order.commune || "",
      deliveryMode,
      ecomRates,
      ecoRates
    );

    let shippingFeeDzd = 0;
    let returnFeeDzd = 0;
    if (isDelivered) {
      shippingFeeDzd =
        override && typeof override.carrierFeeDzd === "number" ? Math.max(0, override.carrierFeeDzd) : baseRate;
    } else if (isReturned) {
      const configuredReturnFee =
        carrier === "ecotrack"
          ? settings.dhdReturnFeeDzd
          : carrier === "ecom"
            ? settings.ecomReturnFeeDzd
            : settings.dhdReturnFeeDzd;
      returnFeeDzd =
        (override && typeof override.carrierFeeDzd === "number"
          ? Math.max(0, override.carrierFeeDzd)
          : configuredReturnFee) + (settings.chargeOutboundShippingOnReturn ? baseRate : 0);
    }

    const packagingDzd =
      isDelivered || isReturned
        ? override && typeof override.packagingDzd === "number"
          ? Math.max(0, override.packagingDzd)
          : Math.round(settings.packagingPerParcelDzd || 0)
        : 0;

    const commissionDzd = isDelivered
      ? computeStaffCommissionForOrder(order, productId, staffById)
      : 0;

    const cashflowDate =
      isDelivered || isReturned ? resolveDeliveredOrReturnedDateKey(order, trk) : orderDate;

    const encaisser = Boolean(trk?.encaisser || trk?.recouvert);
    const recouvert = Boolean(trk?.recouvert);

    const netBeforeAdsDzd =
      grossRevenueDzd - cogsDzd - shippingFeeDzd - returnFeeDzd - packagingDzd - commissionDzd;

    allBreakdowns.push({
      rawOrder: order,
      isConfirmed,
      orderId: order.id,
      orderDate,
      cashflowDate,
      productId,
      productName,
      variantKey,
      customer: order.customer || "Cliente",
      wilaya: order.wilaya || "Non précisée",
      carrier,
      deliveryMode,
      state,
      quantity: qty,
      grossRevenueDzd,
      cogsDzd,
      unitCostDzd,
      lotId,
      hasMissingLot,
      shippingFeeDzd,
      returnFeeDzd,
      packagingDzd,
      commissionDzd,
      allocatedAdSpendDzd: 0,
      netProfitDzd: netBeforeAdsDzd,
      encaisser,
      recouvert,
    });
  }

  // Filter breakdowns for requested viewMode & date range
  const inRange = (d: string) => d >= startDate && d <= endDate;
  const scopedOrders = allBreakdowns.filter(b =>
    inRange(viewMode === "cashflow" ? b.cashflowDate : b.orderDate)
  );

  // Process Ad Spends in [startDate, endDate]
  const resolveCampaignProduct = (entry: FinanceAdSpendEntry): { productId: string; variantKey: string } => {
    if (entry.productId) {
      return { productId: entry.productId, variantKey: entry.variantKey || "" };
    }
    const mapped = financeState.campaignMappings?.[entry.campaignId];
    if (mapped && mapped.productId) {
      return { productId: mapped.productId, variantKey: mapped.variantKey || "" };
    }
    // Automatic lightweight keyword matching against catalog product names
    const normCamp = normStr(entry.campaignName);
    for (const prod of catalog) {
      const normProd = normStr(prod.name);
      const slugNorm = normStr((prod.slug || "").replace(/-/g, " "));
      const firstWord = normProd.split(" ").find(w => w.length >= 4) || "";
      if (
        (normProd && normCamp.includes(normProd)) ||
        (slugNorm && slugNorm.length >= 4 && normCamp.includes(slugNorm)) ||
        (firstWord && normCamp.includes(firstWord))
      ) {
        return { productId: prod.id, variantKey: "" };
      }
    }
    return { productId: "", variantKey: "" };
  };

  let totalAdSpendUsd = 0;
  let totalAdSpendDzd = 0;
  let metaSpendUsd = 0;
  let metaSpendDzd = 0;
  let tiktokSpendUsd = 0;
  let tiktokSpendDzd = 0;
  let unmappedAdSpendDzd = 0;

  const productAdSpend = new Map<string, { usd: number; dzd: number }>();
  const variantDirectAdSpend = new Map<string, { usd: number; dzd: number }>();
  const dailyAdSpend = new Map<string, { usd: number; dzd: number }>();
  const unmappedMap = new Map<
    string,
    { campaignId: string; campaignName: string; platform: FinanceAdPlatform; spendUsd: number; spendDzd: number }
  >();

  for (const ad of financeState.adSpends || []) {
    if (!inRange(ad.date)) continue;
    const rate = getEffectiveExchangeRate(ad.date, ad.currency, financeState.exchangeRates || [], settings);
    const spendDzd = Math.round(ad.spendAmount * rate);
    const usdEq = ad.currency === "USD" ? ad.spendAmount : spendDzd / Math.max(1, settings.defaultUsdToDzd);

    totalAdSpendUsd += usdEq;
    totalAdSpendDzd += spendDzd;
    if (ad.platform === "meta") {
      metaSpendUsd += usdEq;
      metaSpendDzd += spendDzd;
    } else {
      tiktokSpendUsd += usdEq;
      tiktokSpendDzd += spendDzd;
    }

    const dayAcc = dailyAdSpend.get(ad.date) || { usd: 0, dzd: 0 };
    dayAcc.usd += usdEq;
    dayAcc.dzd += spendDzd;
    dailyAdSpend.set(ad.date, dayAcc);

    const { productId, variantKey } = resolveCampaignProduct(ad);
    if (!productId) {
      unmappedAdSpendDzd += spendDzd;
      const existing = unmappedMap.get(ad.campaignId) || {
        campaignId: ad.campaignId,
        campaignName: ad.campaignName,
        platform: ad.platform,
        spendUsd: 0,
        spendDzd: 0,
      };
      existing.spendUsd += usdEq;
      existing.spendDzd += spendDzd;
      unmappedMap.set(ad.campaignId, existing);
    } else {
      const pAcc = productAdSpend.get(productId) || { usd: 0, dzd: 0 };
      pAcc.usd += usdEq;
      pAcc.dzd += spendDzd;
      productAdSpend.set(productId, pAcc);

      if (variantKey) {
        const vKey = `${productId}::${variantKey}`;
        const vAcc = variantDirectAdSpend.get(vKey) || { usd: 0, dzd: 0 };
        vAcc.usd += usdEq;
        vAcc.dzd += spendDzd;
        variantDirectAdSpend.set(vKey, vAcc);
      }
    }
  }

  // Prorate product ad spend proportionally across each product's orders in scope (so each order & variant shows realistic ad cost)
  const ordersByProduct = new Map<string, typeof scopedOrders>();
  for (const b of scopedOrders) {
    const arr = ordersByProduct.get(b.productId) || [];
    arr.push(b);
    ordersByProduct.set(b.productId, arr);
  }
  for (const [pid, list] of ordersByProduct.entries()) {
    const pAd = productAdSpend.get(pid);
    if (!pAd || list.length === 0) continue;
    const perOrderDzd = pAd.dzd / list.length;
    for (const item of list) {
      item.allocatedAdSpendDzd = Math.round(perOrderDzd);
      item.netProfitDzd -= item.allocatedAdSpendDzd;
    }
  }

  // Daily charges + monthly fixed charges prorated over days in [startDate, endDate]
  const allDays = daysInclusive(startDate, endDate);
  let dailyChargesDzd = 0;
  let fixedChargesProratedDzd = 0;
  const dailyExpenseTotals = new Map<string, number>();

  for (const exp of financeState.expenses || []) {
    const rate = getEffectiveExchangeRate(exp.date, exp.currency, financeState.exchangeRates || [], settings);
    const amountDzd = exp.amount * rate;
    if (exp.frequency === "daily") {
      if (inRange(exp.date)) {
        const rounded = Math.round(amountDzd);
        dailyChargesDzd += rounded;
        dailyExpenseTotals.set(exp.date, (dailyExpenseTotals.get(exp.date) || 0) + rounded);
      }
    } else {
      // monthly_fixed: distribute per day starting from its effective month or date
      const activeDays = allDays.filter(dk => dk >= exp.date);
      if (activeDays.length > 0) {
        const daysPerMonth = daysInMonthOfDateKey(exp.date);
        const dailySlice = amountDzd / Math.max(1, daysPerMonth);
        for (const dk of activeDays) {
          dailyExpenseTotals.set(dk, (dailyExpenseTotals.get(dk) || 0) + dailySlice);
        }
        fixedChargesProratedDzd += Math.round(dailySlice * activeDays.length);
      }
    }
  }

  // Staff base salary proration (optional)
  let staffSalaryProratedDzd = 0;
  if (settings.includeStaffBaseSalary && allDays.length > 0) {
    const totalMonthlySalary = staffMembers
      .filter(s => s.active)
      .reduce((acc, s) => acc + Math.max(0, Number(s.baseSalary || 0)), 0);
    if (totalMonthlySalary > 0) {
      const avgDailySalary = totalMonthlySalary / 30;
      staffSalaryProratedDzd = Math.round(avgDailySalary * allDays.length);
      for (const dk of allDays) {
        dailyExpenseTotals.set(dk, (dailyExpenseTotals.get(dk) || 0) + avgDailySalary);
      }
    }
  }

  // Global KPI aggregation
  let grossRevenueDzd = 0;
  let cogsDzd = 0;
  let shippingFeeDzd = 0;
  let returnFeeDzd = 0;
  let packagingPerParcelDzd = 0;
  let commissionDzd = 0;
  let deliveredOrders = 0;
  let returnedOrders = 0;
  let inTransitOrders = 0;
  let confirmedOrders = 0;
  let missingLotOrdersCount = 0;
  let cashDeliveredUnrecoveredDzd = 0;
  let cashDeliveredRecoveredDzd = 0;
  let cashInTransitDzd = 0;

  for (const b of scopedOrders) {
    if (b.isConfirmed) confirmedOrders++;
    if (b.hasMissingLot && b.state === "delivered") missingLotOrdersCount++;

    if (b.state === "delivered") {
      deliveredOrders++;
      grossRevenueDzd += b.grossRevenueDzd;
      cogsDzd += b.cogsDzd;
      shippingFeeDzd += b.shippingFeeDzd;
      commissionDzd += b.commissionDzd;
      if (b.recouvert) cashDeliveredRecoveredDzd += b.grossRevenueDzd;
      else cashDeliveredUnrecoveredDzd += b.grossRevenueDzd;
    } else if (b.state === "returned") {
      returnedOrders++;
      returnFeeDzd += b.returnFeeDzd;
    } else if (b.state === "in_transit") {
      inTransitOrders++;
      cashInTransitDzd += Math.max(0, Number(b.rawOrder.total || 0));
    }
    packagingPerParcelDzd += b.packagingDzd;
  }

  const totalCostsDzd =
    cogsDzd +
    shippingFeeDzd +
    returnFeeDzd +
    packagingPerParcelDzd +
    commissionDzd +
    totalAdSpendDzd +
    dailyChargesDzd +
    fixedChargesProratedDzd +
    staffSalaryProratedDzd;

  const netProfitDzd = grossRevenueDzd - totalCostsDzd;
  const netMarginPct = grossRevenueDzd > 0 ? Math.round((netProfitDzd / grossRevenueDzd) * 1000) / 10 : 0;
  const totalOrders = scopedOrders.length;
  const confirmationRatePct = totalOrders > 0 ? Math.round((confirmedOrders / totalOrders) * 1000) / 10 : 0;
  const completedCarrier = deliveredOrders + returnedOrders;
  const deliveryRatePct = completedCarrier > 0 ? Math.round((deliveredOrders / completedCarrier) * 1000) / 10 : 0;
  const returnRatePct = completedCarrier > 0 ? Math.round((returnedOrders / completedCarrier) * 1000) / 10 : 0;
  const roasGross = totalAdSpendDzd > 0 ? Math.round((grossRevenueDzd / totalAdSpendDzd) * 100) / 100 : null;
  const avgProfitPerDeliveredDzd = deliveredOrders > 0 ? Math.round(netProfitDzd / deliveredOrders) : 0;

  // Daily series (only days with activity or within range)
  const dayBuckets = new Map<
    string,
    {
      ordersCount: number;
      deliveredCount: number;
      returnedCount: number;
      grossRevenueDzd: number;
      cogsDzd: number;
      shippingAndReturnDzd: number;
      commissionDzd: number;
      packagingDzd: number;
    }
  >();

  for (const b of scopedOrders) {
    const dk = viewMode === "cashflow" ? b.cashflowDate : b.orderDate;
    const cur = dayBuckets.get(dk) || {
      ordersCount: 0,
      deliveredCount: 0,
      returnedCount: 0,
      grossRevenueDzd: 0,
      cogsDzd: 0,
      shippingAndReturnDzd: 0,
      commissionDzd: 0,
      packagingDzd: 0,
    };
    cur.ordersCount++;
    if (b.state === "delivered") {
      cur.deliveredCount++;
      cur.grossRevenueDzd += b.grossRevenueDzd;
      cur.cogsDzd += b.cogsDzd;
      cur.shippingAndReturnDzd += b.shippingFeeDzd;
      cur.commissionDzd += b.commissionDzd;
    } else if (b.state === "returned") {
      cur.returnedCount++;
      cur.shippingAndReturnDzd += b.returnFeeDzd;
    }
    cur.packagingDzd += b.packagingDzd;
    dayBuckets.set(dk, cur);
  }

  const allSeriesDateKeys = Array.from(
    new Set([
      ...dayBuckets.keys(),
      ...dailyAdSpend.keys(),
      ...(allDays.length <= 45 ? allDays : []),
    ])
  )
    .filter(dk => inRange(dk))
    .sort();

  let runningCumulative = 0;
  const dailySeries: FinanceDailyPoint[] = allSeriesDateKeys.map(dk => {
    const b = dayBuckets.get(dk) || {
      ordersCount: 0,
      deliveredCount: 0,
      returnedCount: 0,
      grossRevenueDzd: 0,
      cogsDzd: 0,
      shippingAndReturnDzd: 0,
      commissionDzd: 0,
      packagingDzd: 0,
    };
    const ad = dailyAdSpend.get(dk) || { usd: 0, dzd: 0 };
    const charges = Math.round(dailyExpenseTotals.get(dk) || 0);
    const dayNet =
      b.grossRevenueDzd -
      b.cogsDzd -
      b.shippingAndReturnDzd -
      b.commissionDzd -
      b.packagingDzd -
      ad.dzd -
      charges;
    runningCumulative += dayNet;
    const [, m, d] = dk.split("-");
    return {
      date: dk,
      label: `${d}/${m}`,
      ordersCount: b.ordersCount,
      deliveredCount: b.deliveredCount,
      returnedCount: b.returnedCount,
      grossRevenueDzd: b.grossRevenueDzd,
      cogsDzd: b.cogsDzd,
      shippingAndReturnDzd: b.shippingAndReturnDzd,
      commissionDzd: b.commissionDzd,
      packagingDzd: b.packagingDzd,
      adSpendDzd: ad.dzd,
      adSpendUsd: Math.round(ad.usd * 100) / 100,
      fixedAndDailyChargesDzd: charges,
      netProfitDzd: dayNet,
      cumulativeProfitDzd: runningCumulative,
    };
  });

  // Helper to build Product & Variant Summaries cleanly
  const buildGroupSummary = (
    items: typeof scopedOrders,
    productId: string,
    productName: string,
    adUsd: number,
    adDzd: number
  ): FinanceProductSummary => {
    let tOrd = 0;
    let confOrd = 0;
    let delOrd = 0;
    let retOrd = 0;
    let transitOrd = 0;
    let unitsDel = 0;
    let rev = 0;
    let cogs = 0;
    let ship = 0;
    let ret = 0;
    let pkg = 0;
    let comm = 0;
    let missingLots = 0;

    for (const item of items) {
      tOrd++;
      if (item.isConfirmed) confOrd++;
      if (item.hasMissingLot && item.state === "delivered") missingLots++;
      if (item.state === "delivered") {
        delOrd++;
        unitsDel += item.quantity;
        rev += item.grossRevenueDzd;
        cogs += item.cogsDzd;
        ship += item.shippingFeeDzd;
        comm += item.commissionDzd;
      } else if (item.state === "returned") {
        retOrd++;
        ret += item.returnFeeDzd;
      } else if (item.state === "in_transit") {
        transitOrd++;
      }
      pkg += item.packagingDzd;
    }

    const netBeforeAds = rev - cogs - ship - ret - pkg - comm;
    const netProfit = netBeforeAds - Math.round(adDzd);
    const doneCarrier = delOrd + retOrd;
    const delRate = doneCarrier > 0 ? Math.round((delOrd / doneCarrier) * 1000) / 10 : 0;
    const retRate = doneCarrier > 0 ? Math.round((retOrd / doneCarrier) * 1000) / 10 : 0;
    const confRate = tOrd > 0 ? Math.round((confOrd / tOrd) * 1000) / 10 : 0;
    const netMargin = rev > 0 ? Math.round((netProfit / rev) * 1000) / 10 : 0;

    const actualCpaDel = delOrd > 0 && adDzd > 0 ? Math.round(adDzd / delOrd) : null;
    const breakevenCpaDel = delOrd > 0 ? Math.max(0, Math.round(netBeforeAds / delOrd)) : null;
    const breakevenCpaLead = tOrd > 0 ? Math.max(0, Math.round(netBeforeAds / tOrd)) : null;
    const roasG = adDzd > 0 ? Math.round((rev / adDzd) * 100) / 100 : null;
    const minRoas = netBeforeAds > 0 ? Math.round((rev / netBeforeAds) * 100) / 100 : null;
    const avgLotUnit = unitsDel > 0 ? Math.round(cogs / unitsDel) : 0;

    const verdict: FinanceProductSummary["verdict"] =
      delOrd === 0 && retOrd === 0
        ? "pending"
        : netProfit > 0 && netMargin >= 12
          ? "winner"
          : netProfit >= 0
            ? "fragile"
            : "loser";

    return {
      productId,
      productName,
      totalOrders: tOrd,
      confirmedOrders: confOrd,
      deliveredOrders: delOrd,
      returnedOrders: retOrd,
      inTransitOrders: transitOrd,
      unitsDelivered: unitsDel,
      confirmationRatePct: confRate,
      deliveryRatePct: delRate,
      returnRatePct: retRate,
      grossRevenueDzd: rev,
      cogsDzd: cogs,
      shippingFeeDzd: ship,
      returnFeeDzd: ret,
      packagingDzd: pkg,
      commissionDzd: comm,
      adSpendUsd: Math.round(adUsd * 100) / 100,
      adSpendDzd: Math.round(adDzd),
      netProfitDzd: netProfit,
      netMarginPct: netMargin,
      actualCpaDeliveredDzd: actualCpaDel,
      breakevenCpaDeliveredDzd: breakevenCpaDel,
      breakevenCpaLeadDzd: breakevenCpaLead,
      roasGross: roasG,
      minRoas,
      avgLotUnitCostDzd: avgLotUnit,
      missingLotOrders: missingLots,
      verdict,
    };
  };

  // Group Products (include products with ad spend even if 0 orders!)
  const allProductIds = Array.from(new Set([...ordersByProduct.keys(), ...productAdSpend.keys()]));
  const productsSummary: FinanceProductSummary[] = allProductIds
    .map(pid => {
      const items = ordersByProduct.get(pid) || [];
      const catProd = catalog.find(c => c.id === pid);
      const pName = items[0]?.productName || catProd?.name || pid;
      const pAd = productAdSpend.get(pid) || { usd: 0, dzd: 0 };
      return buildGroupSummary(items, pid, pName, pAd.usd, pAd.dzd);
    })
    .sort((a, b) => b.netProfitDzd - a.netProfitDzd);

  // Group Variants (per productId + variantKey, splitting any non-variant-specific product ad spend cleanly across product's variants by order volume)
  const variantGroups = new Map<string, { items: typeof scopedOrders; pid: string; pName: string; color: string; size: string; vKey: string }>();
  for (const item of scopedOrders) {
    const vKey = item.variantKey || "Standard";
    const mapKey = `${item.productId}::${vKey}`;
    const existing = variantGroups.get(mapKey);
    if (existing) {
      existing.items.push(item);
    } else {
      variantGroups.set(mapKey, {
        items: [item],
        pid: item.productId,
        pName: item.productName,
        color: item.rawOrder.color || "",
        size: item.rawOrder.size || "",
        vKey,
      });
    }
  }

  // Compute remaining unallocated product ad spend per product (total product ad spend minus variant-direct ad spends)
  const directByProduct = new Map<string, { usd: number; dzd: number }>();
  for (const [vk, val] of variantDirectAdSpend.entries()) {
    const pid = vk.split("::")[0];
    const cur = directByProduct.get(pid) || { usd: 0, dzd: 0 };
    cur.usd += val.usd;
    cur.dzd += val.dzd;
    directByProduct.set(pid, cur);
  }

  const variantsSummary: FinanceVariantSummary[] = Array.from(variantGroups.entries())
    .map(([mapKey, grp]) => {
      const direct = variantDirectAdSpend.get(mapKey) || { usd: 0, dzd: 0 };
      const prodTotalAd = productAdSpend.get(grp.pid) || { usd: 0, dzd: 0 };
      const prodDirectAd = directByProduct.get(grp.pid) || { usd: 0, dzd: 0 };
      const prodOrderCount = Math.max(1, (ordersByProduct.get(grp.pid) || []).length);
      const sharedUsd = Math.max(0, prodTotalAd.usd - prodDirectAd.usd) * (grp.items.length / prodOrderCount);
      const sharedDzd = Math.max(0, prodTotalAd.dzd - prodDirectAd.dzd) * (grp.items.length / prodOrderCount);

      const summary = buildGroupSummary(
        grp.items,
        grp.pid,
        grp.pName,
        direct.usd + sharedUsd,
        direct.dzd + sharedDzd
      );
      return {
        ...summary,
        variantKey: grp.vKey,
        color: grp.color,
        size: grp.size,
      };
    })
    .sort((a, b) => b.netProfitDzd - a.netProfitDzd);

  // Wilayas summary
  const wilayaMap = new Map<string, typeof scopedOrders>();
  for (const b of scopedOrders) {
    const key = b.wilaya || "Inconnue";
    const arr = wilayaMap.get(key) || [];
    arr.push(b);
    wilayaMap.set(key, arr);
  }
  const wilayasSummary: FinanceWilayaSummary[] = Array.from(wilayaMap.entries())
    .map(([wilaya, list]) => {
      let del = 0;
      let ret = 0;
      let tr = 0;
      let rev = 0;
      let shipRet = 0;
      let net = 0;
      for (const item of list) {
        if (item.state === "delivered") {
          del++;
          rev += item.grossRevenueDzd;
          shipRet += item.shippingFeeDzd;
        } else if (item.state === "returned") {
          ret++;
          shipRet += item.returnFeeDzd;
        } else if (item.state === "in_transit") {
          tr++;
        }
        net += item.netProfitDzd;
      }
      const done = del + ret;
      return {
        wilaya,
        totalOrders: list.length,
        deliveredOrders: del,
        returnedOrders: ret,
        inTransitOrders: tr,
        deliveryRatePct: done > 0 ? Math.round((del / done) * 1000) / 10 : 0,
        returnRatePct: done > 0 ? Math.round((ret / done) * 1000) / 10 : 0,
        grossRevenueDzd: rev,
        shippingAndReturnDzd: shipRet,
        netProfitBeforeFixedDzd: net,
      };
    })
    .sort((a, b) => b.netProfitBeforeFixedDzd - a.netProfitBeforeFixedDzd);

  // Carrier comparison
  const carriersSummary: FinanceCarrierSummary[] = (["ecotrack", "ecom"] as const).map(cId => {
    const list = scopedOrders.filter(b => b.carrier === cId);
    let del = 0;
    let ret = 0;
    let tr = 0;
    let rev = 0;
    let ship = 0;
    let rFee = 0;
    let unpaid = 0;
    let recov = 0;
    let unknownCash = 0;
    let net = 0;

    for (const item of list) {
      if (item.state === "delivered") {
        del++;
        rev += item.grossRevenueDzd;
        ship += item.shippingFeeDzd;
        if (item.recouvert) recov += item.grossRevenueDzd;
        else if (item.encaisser) unpaid += item.grossRevenueDzd;
        else unknownCash += item.grossRevenueDzd;
      } else if (item.state === "returned") {
        ret++;
        rFee += item.returnFeeDzd;
      } else if (item.state === "in_transit") {
        tr++;
      }
      net += item.netProfitDzd;
    }
    const done = del + ret;
    return {
      carrier: cId,
      label: cId === "ecotrack" ? "DHD (EcoTrack)" : "E-com Delivery",
      transferredCount: del + ret + tr,
      deliveredCount: del,
      returnedCount: ret,
      inTransitCount: tr,
      deliveryRatePct: done > 0 ? Math.round((del / done) * 1000) / 10 : 0,
      returnRatePct: done > 0 ? Math.round((ret / done) * 1000) / 10 : 0,
      grossDeliveredDzd: rev,
      shippingFeeDzd: ship,
      returnFeeDzd: rFee,
      cashCollectedUnpaidDzd: unpaid,
      cashRecoveredDzd: recov,
      cashDeliveredUnknownDzd: unknownCash,
      netContributionDzd: net,
    };
  });

  // Lot stock health
  const lotHealth: FinanceLotHealth[] = lotEntries.map(e => {
    const pct =
      e.lot.quantityInitial > 0
        ? Math.round((e.remaining / e.lot.quantityInitial) * 100)
        : 0;
    return {
      lot: e.lot,
      consumedDelivered: e.consumedDelivered,
      reservedInTransit: e.reservedInTransit,
      remainingQty: e.remaining,
      pctRemaining: pct,
      status: e.remaining <= 0 ? "empty" : pct <= 15 || e.remaining <= 5 ? "low" : "healthy",
    };
  });

  // Waterfall breakdown
  const pctRev = (v: number) => (grossRevenueDzd > 0 ? Math.round((v / grossRevenueDzd) * 1000) / 10 : 0);
  const totalChargesAll = dailyChargesDzd + fixedChargesProratedDzd + staffSalaryProratedDzd;
  const waterfall: FinanceOverviewResponse["waterfall"] = [
    { key: "revenue", label: "CA Livré Encaissé", amountDzd: grossRevenueDzd, pctOfRevenue: 100, tone: "revenue" },
    { key: "cogs", label: "Achat Stock (Lots)", amountDzd: cogsDzd, pctOfRevenue: pctRev(cogsDzd), tone: "cost" },
    { key: "shipping", label: "Livraison + Retours", amountDzd: shippingFeeDzd + returnFeeDzd, pctOfRevenue: pctRev(shippingFeeDzd + returnFeeDzd), tone: "cost" },
    { key: "ads", label: "Pub Meta & TikTok", amountDzd: totalAdSpendDzd, pctOfRevenue: pctRev(totalAdSpendDzd), tone: "cost" },
    { key: "commissions", label: "Commissions Confirmateurs", amountDzd: commissionDzd, pctOfRevenue: pctRev(commissionDzd), tone: "cost" },
    { key: "charges", label: "Emballage & Charges", amountDzd: packagingPerParcelDzd + totalChargesAll, pctOfRevenue: pctRev(packagingPerParcelDzd + totalChargesAll), tone: "cost" },
    { key: "net", label: "Bénéfice Net Réel", amountDzd: netProfitDzd, pctOfRevenue: pctRev(netProfitDzd), tone: netProfitDzd >= 0 ? "profit" : "loss" },
  ];

  // Smart rule-based anomaly & warning detection (deterministic CFO checks!)
  const anomalies: FinanceAnomaly[] = [];
  if (missingLotOrdersCount > 0) {
    anomalies.push({
      id: "missing-lots",
      severity: "warning",
      title: `${missingLotOrdersCount} commande(s) livrée(s) sans coût d'achat (lot)`,
      detail: "Ajoute un lot d'achat initial daté pour que le bénéfice net reflète ton vrai coût de stock.",
      actionTab: "lots",
    });
  }
  if (unmappedMap.size > 0) {
    anomalies.push({
      id: "unmapped-ads",
      severity: "warning",
      title: `${unmappedMap.size} campagne(s) pub non liée(s) à un produit (${unmappedAdSpendDzd.toLocaleString("fr-DZ")} DA)`,
      detail: "Associe ces campagnes dans l'onglet Pub API pour que le bénéfice par produit & le CPA soient exacts.",
      actionTab: "ads",
    });
  }
  for (const v of variantsSummary) {
    if (v.deliveredOrders + v.returnedOrders >= 4 && v.netProfitDzd < 0) {
      anomalies.push({
        id: `loss-variant-${v.productId}-${v.variantKey}`,
        severity: "critical",
        title: `Déficitaire : ${v.productName} (${v.variantKey})`,
        detail: `Perte nette de ${Math.abs(v.netProfitDzd).toLocaleString("fr-DZ")} DA (${v.returnRatePct}% retours, lot moy. ${v.avgLotUnitCostDzd} DA).`,
        actionTab: "products",
      });
    }
  }
  for (const lh of lotHealth) {
    if (lh.status === "low" || (lh.status === "empty" && lh.consumedDelivered > 0)) {
      anomalies.push({
        id: `lot-stock-${lh.lot.id}`,
        severity: lh.status === "empty" ? "warning" : "info",
        title: `Lot ${lh.status === "empty" ? "épuisé" : "presque vide"} : ${lh.lot.productName}${lh.lot.variantKey ? ` · ${lh.lot.variantKey}` : ""}`,
        detail: `Reste ${lh.remainingQty}/${lh.lot.quantityInitial} unités (coût ${lh.lot.unitCostDzd} DA). Prévois le prochain lot.`,
        actionTab: "lots",
      });
    }
  }
  if (cashDeliveredUnrecoveredDzd > 0) {
    anomalies.push({
      id: "cash-unrecovered",
      severity: "info",
      title: `${cashDeliveredUnrecoveredDzd.toLocaleString("fr-DZ")} DA encaissés en attente de reversement`,
      detail: "Colis livrés mais pas encore marqués « recouvrés » par DHD / E-com Delivery.",
      actionTab: "overview",
    });
  }

  const todayKey = algiersDateKey();
  const effectiveUsdToDzd = getEffectiveExchangeRate(todayKey, "USD", financeState.exchangeRates || [], settings);

  return {
    viewMode,
    startDate,
    endDate,
    effectiveUsdToDzd,
    kpis: {
      status: netProfitDzd > 500 ? "profitable" : netProfitDzd < -500 ? "deficit" : "breakeven",
      netProfitDzd,
      netMarginPct,
      grossRevenueDzd,
      cogsDzd,
      shippingFeeDzd,
      returnFeeDzd,
      packagingPerParcelDzd,
      commissionDzd,
      adSpendUsd: Math.round(totalAdSpendUsd * 100) / 100,
      adSpendDzd: totalAdSpendDzd,
      metaSpendUsd: Math.round(metaSpendUsd * 100) / 100,
      metaSpendDzd,
      tiktokSpendUsd: Math.round(tiktokSpendUsd * 100) / 100,
      tiktokSpendDzd,
      unmappedAdSpendDzd,
      dailyChargesDzd,
      fixedChargesProratedDzd,
      staffSalaryProratedDzd,
      totalCostsDzd,
      roasGross,
      totalOrders,
      deliveredOrders,
      returnedOrders,
      inTransitOrders,
      confirmationRatePct,
      deliveryRatePct,
      returnRatePct,
      avgProfitPerDeliveredDzd,
      cashDeliveredUnrecoveredDzd,
      cashDeliveredRecoveredDzd,
      cashInTransitDzd,
      missingLotOrdersCount,
    },
    waterfall,
    dailySeries,
    products: productsSummary,
    variants: variantsSummary,
    wilayas: wilayasSummary,
    carriers: carriersSummary,
    lotHealth,
    unmappedCampaigns: Array.from(unmappedMap.values()).sort((a, b) => b.spendDzd - a.spendDzd),
    anomalies: anomalies.slice(0, 12),
    recentOrderSample: [...scopedOrders].reverse().slice(0, 60),
    settings,
    adConnections: adConnectionsPublic,
    lots: [...(financeState.lots || [])].sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt)),
    expenses: [...(financeState.expenses || [])].sort((a, b) => b.date.localeCompare(a.date)),
    adSpends: [...(financeState.adSpends || [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 300),
    campaignMappings: Object.values(financeState.campaignMappings || {}),
    exchangeRates: [...(financeState.exchangeRates || [])].sort((a, b) =>
      b.effectiveDate.localeCompare(a.effectiveDate)
    ),
  };
}
