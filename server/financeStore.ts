import {
  DEFAULT_FINANCE_SETTINGS,
  financeAdSpendManualSchema,
  financeCampaignMappingSchema,
  financeExchangeRateInputSchema,
  financeExpenseInputSchema,
  financeLotInputSchema,
  financeSettingsPatchSchema,
  type FinanceAdConnectionStatus,
  type FinanceAdCurrency,
  type FinanceAdPlatform,
  type FinanceAdPlatformCreds,
  type FinanceAdSpendEntry,
  type FinanceAdSpendManualInput,
  type FinanceCampaignMapping,
  type FinanceCampaignMappingInput,
  type FinanceCatalogProductRef,
  type FinanceExchangeRateEntry,
  type FinanceExchangeRateInput,
  type FinanceExpense,
  type FinanceExpenseInput,
  type FinanceOrderCostOverride,
  type FinancePurchaseLot,
  type FinancePurchaseLotInput,
  type FinanceSettings,
  type FinanceSettingsPatch,
  type PersistedFinanceState,
} from "../shared/finance";
import { products as defaultCatalogProducts } from "../client/src/lib/store-data";
import { ensureCheckoutStoreReady, triggerStoreSave } from "./checkout";
import {
  getServerCatalogProducts,
  getServerFinanceState,
  setServerFinanceState,
} from "./persistentStore";

function maskSecret(secret?: string): string {
  const clean = String(secret || "").trim();
  if (!clean) return "";
  if (clean.length <= 8) return `${clean.slice(0, 2)}•••${clean.slice(-2)}`;
  return `${clean.slice(0, 5)}••••${clean.slice(-4)}`;
}

export function getMergedCatalogRefs(): FinanceCatalogProductRef[] {
  const stored = getServerCatalogProducts();
  const merged = new Map<string, FinanceCatalogProductRef>();

  for (const p of defaultCatalogProducts) {
    merged.set(p.id, {
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      colors: Array.isArray(p.colors) ? p.colors : [],
      stock: p.stock,
    });
  }

  for (const raw of stored) {
    const id = typeof raw.id === "string" ? raw.id.trim() : "";
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!id || !name) continue;
    merged.set(id, {
      id,
      name,
      slug: typeof raw.slug === "string" ? raw.slug : undefined,
      price: typeof raw.price === "number" ? raw.price : undefined,
      colors: Array.isArray(raw.colors) ? raw.colors.filter((c): c is string => typeof c === "string") : [],
      stock: typeof raw.stock === "number" ? raw.stock : undefined,
    });
  }

  return Array.from(merged.values());
}

function mutateFinanceState<T>(mutator: (state: PersistedFinanceState) => T): T {
  const cur = getServerFinanceState();
  const next: PersistedFinanceState = {
    lots: [...(cur.lots || [])],
    expenses: [...(cur.expenses || [])],
    adSpends: [...(cur.adSpends || [])],
    campaignMappings: { ...(cur.campaignMappings || {}) },
    exchangeRates: [...(cur.exchangeRates || [])],
    orderOverrides: { ...(cur.orderOverrides || {}) },
    settings: { ...DEFAULT_FINANCE_SETTINGS, ...(cur.settings || {}) },
    adCredentials: {
      meta: cur.adCredentials?.meta ? { ...cur.adCredentials.meta } : undefined,
      tiktok: cur.adCredentials?.tiktok ? { ...cur.adCredentials.tiktok } : undefined,
    },
  };
  const result = mutator(next);
  setServerFinanceState(next);
  triggerStoreSave();
  return result;
}

export async function getFinanceStateSnapshot(): Promise<PersistedFinanceState> {
  await ensureCheckoutStoreReady();
  return getServerFinanceState();
}

export function getFinanceAdCredentialsServerOnly(): FinanceAdPlatformCreds {
  const state = getServerFinanceState();
  const envMetaAccount = (process.env.META_AD_ACCOUNT_ID || "").trim();
  const envMetaToken = (process.env.META_ACCESS_TOKEN || "").trim();
  const envTtAdvertiser = (process.env.TIKTOK_ADVERTISER_ID || "").trim();
  const envTtToken = (process.env.TIKTOK_ACCESS_TOKEN || "").trim();

  const savedMeta = state.adCredentials?.meta;
  const savedTt = state.adCredentials?.tiktok;

  return {
    meta:
      savedMeta?.accessToken && savedMeta?.adAccountId
        ? savedMeta
        : envMetaToken && envMetaAccount
          ? {
              adAccountId: envMetaAccount,
              accessToken: envMetaToken,
              lastSyncAt: savedMeta?.lastSyncAt,
              lastError: savedMeta?.lastError,
            }
          : savedMeta,
    tiktok:
      savedTt?.accessToken && savedTt?.advertiserId
        ? savedTt
        : envTtToken && envTtAdvertiser
          ? {
              advertiserId: envTtAdvertiser,
              accessToken: envTtToken,
              lastSyncAt: savedTt?.lastSyncAt,
              lastError: savedTt?.lastError,
            }
          : savedTt,
  };
}

export function buildPublicAdConnectionStatus(): FinanceAdConnectionStatus {
  const creds = getFinanceAdCredentialsServerOnly();
  return {
    meta: {
      configured: Boolean(creds.meta?.adAccountId && creds.meta?.accessToken),
      adAccountId: creds.meta?.adAccountId || "",
      tokenPreview: maskSecret(creds.meta?.accessToken),
      lastSyncAt: creds.meta?.lastSyncAt,
      lastError: creds.meta?.lastError,
    },
    tiktok: {
      configured: Boolean(creds.tiktok?.advertiserId && creds.tiktok?.accessToken),
      advertiserId: creds.tiktok?.advertiserId || "",
      tokenPreview: maskSecret(creds.tiktok?.accessToken),
      lastSyncAt: creds.tiktok?.lastSyncAt,
      lastError: creds.tiktok?.lastError,
    },
  };
}

export async function upsertFinanceLot(raw: FinancePurchaseLotInput): Promise<FinancePurchaseLot> {
  await ensureCheckoutStoreReady();
  const parsed = financeLotInputSchema.parse(raw);
  const now = new Date().toISOString();
  return mutateFinanceState(state => {
    const id = parsed.id?.trim() || `lot-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const idx = state.lots.findIndex(l => l.id === id);
    const created: FinancePurchaseLot = {
      id,
      productId: parsed.productId,
      productName: parsed.productName,
      variantKey: parsed.variantKey || "",
      purchasedAt: parsed.purchasedAt,
      quantityInitial: parsed.quantityInitial,
      unitCostDzd: Math.round(parsed.unitCostDzd),
      supplier: parsed.supplier || "",
      note: parsed.note || "",
      createdAt: idx >= 0 ? state.lots[idx].createdAt : now,
      updatedAt: now,
    };
    if (idx >= 0) state.lots[idx] = created;
    else state.lots.push(created);
    return created;
  });
}

export async function deleteFinanceLot(id: string): Promise<{ deleted: boolean }> {
  await ensureCheckoutStoreReady();
  return mutateFinanceState(state => {
    const before = state.lots.length;
    state.lots = state.lots.filter(l => l.id !== id);
    return { deleted: state.lots.length < before };
  });
}

export async function upsertFinanceExpense(raw: FinanceExpenseInput): Promise<FinanceExpense> {
  await ensureCheckoutStoreReady();
  const parsed = financeExpenseInputSchema.parse(raw);
  const now = new Date().toISOString();
  return mutateFinanceState(state => {
    const id = parsed.id?.trim() || `exp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const idx = state.expenses.findIndex(e => e.id === id);
    const entry: FinanceExpense = {
      ...parsed,
      id,
      amount: Math.round(parsed.amount * 100) / 100,
      note: parsed.note || "",
      createdAt: idx >= 0 ? state.expenses[idx].createdAt : now,
    };
    if (idx >= 0) state.expenses[idx] = entry;
    else state.expenses.push(entry);
    return entry;
  });
}

export async function deleteFinanceExpense(id: string): Promise<{ deleted: boolean }> {
  await ensureCheckoutStoreReady();
  return mutateFinanceState(state => {
    const before = state.expenses.length;
    state.expenses = state.expenses.filter(e => e.id !== id);
    return { deleted: state.expenses.length < before };
  });
}

export async function upsertFinanceExchangeRate(
  raw: FinanceExchangeRateInput
): Promise<FinanceExchangeRateEntry> {
  await ensureCheckoutStoreReady();
  const parsed = financeExchangeRateInputSchema.parse(raw);
  return mutateFinanceState(state => {
    const id = parsed.id?.trim() || `fx-${parsed.effectiveDate}`;
    const idx = state.exchangeRates.findIndex(
      r => r.id === id || r.effectiveDate === parsed.effectiveDate
    );
    const entry: FinanceExchangeRateEntry = {
      id: idx >= 0 ? state.exchangeRates[idx].id : id,
      effectiveDate: parsed.effectiveDate,
      usdToDzd: Math.round(parsed.usdToDzd * 100) / 100,
      eurToDzd: parsed.eurToDzd ? Math.round(parsed.eurToDzd * 100) / 100 : undefined,
      note: parsed.note || "",
    };
    if (idx >= 0) state.exchangeRates[idx] = entry;
    else state.exchangeRates.push(entry);
    state.exchangeRates.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
    return entry;
  });
}

export async function deleteFinanceExchangeRate(id: string): Promise<{ deleted: boolean }> {
  await ensureCheckoutStoreReady();
  return mutateFinanceState(state => {
    const before = state.exchangeRates.length;
    state.exchangeRates = state.exchangeRates.filter(r => r.id !== id);
    return { deleted: state.exchangeRates.length < before };
  });
}

export async function upsertFinanceAdSpendManual(
  raw: FinanceAdSpendManualInput,
  source: FinanceAdSpendEntry["source"] = "manual"
): Promise<FinanceAdSpendEntry> {
  await ensureCheckoutStoreReady();
  const parsed = financeAdSpendManualSchema.parse(raw);
  const now = new Date().toISOString();
  return mutateFinanceState(state => {
    const campSlug = parsed.campaignName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48);
    const campaignId =
      parsed.campaignId?.trim() || `${parsed.platform}:${campSlug || Date.now()}`;
    const id = parsed.id?.trim() || `${parsed.platform}:${campaignId}:${parsed.date}`;
    const idx = state.adSpends.findIndex(
      a => a.id === id || (a.platform === parsed.platform && a.campaignId === campaignId && a.date === parsed.date)
    );
    const entry: FinanceAdSpendEntry = {
      id: idx >= 0 ? state.adSpends[idx].id : id,
      date: parsed.date,
      platform: parsed.platform,
      campaignId,
      campaignName: parsed.campaignName,
      productId: parsed.productId || state.campaignMappings[campaignId]?.productId || "",
      variantKey: parsed.variantKey || state.campaignMappings[campaignId]?.variantKey || "",
      spendAmount: Math.round(parsed.spendAmount * 1000) / 1000,
      currency: parsed.currency,
      impressions: parsed.impressions || 0,
      clicks: parsed.clicks || 0,
      conversions: parsed.conversions || 0,
      source,
      updatedAt: now,
    };
    if (idx >= 0) state.adSpends[idx] = entry;
    else state.adSpends.push(entry);

    if (entry.productId && !state.campaignMappings[campaignId]) {
      state.campaignMappings[campaignId] = {
        campaignId,
        campaignName: entry.campaignName,
        platform: entry.platform,
        productId: entry.productId,
        variantKey: entry.variantKey || "",
        mappedBy: "manual",
        confidence: 1,
        updatedAt: now,
      };
    }

    return entry;
  });
}

export async function bulkUpsertAdSpendEntries(
  entries: Array<{
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
    source: FinanceAdSpendEntry["source"];
  }>
): Promise<{ upserted: number }> {
  await ensureCheckoutStoreReady();
  const now = new Date().toISOString();
  return mutateFinanceState(state => {
    const byKey = new Map<string, number>();
    state.adSpends.forEach((item, index) => {
      byKey.set(`${item.platform}::${item.campaignId}::${item.date}`, index);
    });

    let upserted = 0;
    for (const raw of entries) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.date) || !raw.campaignId) continue;
      const k = `${raw.platform}::${raw.campaignId}::${raw.date}`;
      const existingIdx = byKey.get(k);
      const mapped = state.campaignMappings[raw.campaignId];
      const next: FinanceAdSpendEntry = {
        id: existingIdx !== undefined ? state.adSpends[existingIdx].id : `${raw.platform}:${raw.campaignId}:${raw.date}`,
        date: raw.date,
        platform: raw.platform,
        campaignId: raw.campaignId,
        campaignName: raw.campaignName,
        productId: raw.productId || mapped?.productId || (existingIdx !== undefined ? state.adSpends[existingIdx].productId : "") || "",
        variantKey: raw.variantKey || mapped?.variantKey || (existingIdx !== undefined ? state.adSpends[existingIdx].variantKey : "") || "",
        spendAmount: Math.round(Math.max(0, raw.spendAmount) * 1000) / 1000,
        currency: raw.currency,
        impressions: raw.impressions ?? 0,
        clicks: raw.clicks ?? 0,
        conversions: raw.conversions ?? 0,
        source: raw.source,
        updatedAt: now,
      };
      if (existingIdx !== undefined) {
        state.adSpends[existingIdx] = next;
      } else {
        byKey.set(k, state.adSpends.length);
        state.adSpends.push(next);
      }
      upserted++;
    }
    // Keep most recent 4000 daily campaign entries cleanly bounded
    if (state.adSpends.length > 4000) {
      state.adSpends.sort((a, b) => b.date.localeCompare(a.date));
      state.adSpends = state.adSpends.slice(0, 4000);
    }
    return { upserted };
  });
}

export async function deleteFinanceAdSpend(id: string): Promise<{ deleted: boolean }> {
  await ensureCheckoutStoreReady();
  return mutateFinanceState(state => {
    const before = state.adSpends.length;
    state.adSpends = state.adSpends.filter(a => a.id !== id);
    return { deleted: state.adSpends.length < before };
  });
}

export async function saveFinanceCampaignMapping(
  raw: FinanceCampaignMappingInput
): Promise<FinanceCampaignMapping> {
  await ensureCheckoutStoreReady();
  const parsed = financeCampaignMappingSchema.parse(raw);
  const now = new Date().toISOString();
  return mutateFinanceState(state => {
    const mapping: FinanceCampaignMapping = {
      ...parsed,
      variantKey: parsed.variantKey || "",
      updatedAt: now,
    };
    state.campaignMappings[parsed.campaignId] = mapping;
    for (const spend of state.adSpends) {
      if (spend.campaignId === parsed.campaignId) {
        spend.productId = parsed.productId;
        spend.variantKey = parsed.variantKey || "";
      }
    }
    return mapping;
  });
}

export async function updateFinanceSettings(patch: FinanceSettingsPatch): Promise<FinanceSettings> {
  await ensureCheckoutStoreReady();
  const parsed = financeSettingsPatchSchema.parse(patch);
  return mutateFinanceState(state => {
    state.settings = {
      ...DEFAULT_FINANCE_SETTINGS,
      ...state.settings,
      ...parsed,
    };
    return state.settings;
  });
}

export async function saveFinanceAdCredentials(input: {
  platform: FinanceAdPlatform;
  accountId: string;
  accessToken?: string;
}): Promise<FinanceAdConnectionStatus> {
  await ensureCheckoutStoreReady();
  const accountId = input.accountId.trim();
  const token = String(input.accessToken || "").trim();
  mutateFinanceState(state => {
    if (input.platform === "meta") {
      const normalizedAccount = accountId
        ? accountId.startsWith("act_")
          ? accountId
          : `act_${accountId}`
        : "";
      const prevToken = state.adCredentials?.meta?.accessToken || "";
      const finalToken = token || prevToken;
      if (!normalizedAccount || !finalToken) {
        throw new Error("Ad Account ID Meta et Access Token requis.");
      }
      state.adCredentials.meta = {
        adAccountId: normalizedAccount,
        accessToken: finalToken,
        lastSyncAt: state.adCredentials?.meta?.lastSyncAt,
        lastError: undefined,
      };
    } else {
      const prevToken = state.adCredentials?.tiktok?.accessToken || "";
      const finalToken = token || prevToken;
      if (!accountId || !finalToken) {
        throw new Error("Advertiser ID TikTok et Access Token requis.");
      }
      state.adCredentials.tiktok = {
        advertiserId: accountId,
        accessToken: finalToken,
        lastSyncAt: state.adCredentials?.tiktok?.lastSyncAt,
        lastError: undefined,
      };
    }
  });
  return buildPublicAdConnectionStatus();
}

export async function clearFinanceAdCredentials(
  platform: FinanceAdPlatform
): Promise<FinanceAdConnectionStatus> {
  await ensureCheckoutStoreReady();
  mutateFinanceState(state => {
    if (platform === "meta") delete state.adCredentials.meta;
    else delete state.adCredentials.tiktok;
  });
  return buildPublicAdConnectionStatus();
}

export async function recordFinanceAdSyncResult(
  platform: FinanceAdPlatform,
  result: { ok: boolean; error?: string }
): Promise<void> {
  await ensureCheckoutStoreReady();
  mutateFinanceState(state => {
    if (platform === "meta" && state.adCredentials.meta) {
      state.adCredentials.meta.lastSyncAt = new Date().toISOString();
      state.adCredentials.meta.lastError = result.ok ? undefined : result.error || "Erreur sync Meta";
    } else if (platform === "tiktok" && state.adCredentials.tiktok) {
      state.adCredentials.tiktok.lastSyncAt = new Date().toISOString();
      state.adCredentials.tiktok.lastError = result.ok ? undefined : result.error || "Erreur sync TikTok";
    }
  });
}

export async function setOrderFinanceOverride(input: {
  orderId: string;
  unitCostDzd?: number | null;
  lotId?: string | null;
  carrierFeeDzd?: number | null;
  packagingDzd?: number | null;
}): Promise<FinanceOrderCostOverride | null> {
  await ensureCheckoutStoreReady();
  const oid = input.orderId.trim();
  if (!oid) throw new Error("orderId requis");
  return mutateFinanceState(state => {
    if (
      input.unitCostDzd == null &&
      input.lotId == null &&
      input.carrierFeeDzd == null &&
      input.packagingDzd == null
    ) {
      delete state.orderOverrides[oid];
      return null;
    }
    const prev = state.orderOverrides[oid];
    const next: FinanceOrderCostOverride = {
      orderId: oid,
      unitCostDzd: input.unitCostDzd === null ? undefined : input.unitCostDzd ?? prev?.unitCostDzd,
      lotId: input.lotId === null ? undefined : input.lotId ?? prev?.lotId,
      carrierFeeDzd: input.carrierFeeDzd === null ? undefined : input.carrierFeeDzd ?? prev?.carrierFeeDzd,
      packagingDzd: input.packagingDzd === null ? undefined : input.packagingDzd ?? prev?.packagingDzd,
      updatedAt: new Date().toISOString(),
    };
    state.orderOverrides[oid] = next;
    return next;
  });
}
