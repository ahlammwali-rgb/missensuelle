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
  type FinanceAdDiscoveredAccount,
  type FinanceAdOAuthStatusFields,
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

function normalizePlatformAccountId(platform: FinanceAdPlatform, rawId: string): string {
  const clean = rawId.trim();
  if (!clean) return "";
  if (platform === "meta") {
    return clean.startsWith("act_") ? clean : `act_${clean}`;
  }
  return clean;
}

export function getEffectiveAdOAuthAppConfig(platform: FinanceAdPlatform): {
  appId: string;
  appSecret: string;
  configured: boolean;
  fromEnv: boolean;
} {
  const state = getServerFinanceState();
  const saved = platform === "meta" ? state.adCredentials?.meta : state.adCredentials?.tiktok;
  const savedAppId = String(saved?.oauthAppId || "").trim();
  const savedSecret = String(saved?.oauthAppSecret || "").trim();

  const envAppId = String(
    platform === "meta" ? process.env.META_APP_ID || "" : process.env.TIKTOK_APP_ID || ""
  ).trim();
  const envSecret = String(
    platform === "meta" ? process.env.META_APP_SECRET || "" : process.env.TIKTOK_APP_SECRET || ""
  ).trim();

  if (savedAppId && savedSecret) {
    return { appId: savedAppId, appSecret: savedSecret, configured: true, fromEnv: false };
  }
  if (envAppId && envSecret) {
    return { appId: envAppId, appSecret: envSecret, configured: true, fromEnv: true };
  }
  return {
    appId: savedAppId || envAppId,
    appSecret: savedSecret || envSecret,
    configured: false,
    fromEnv: Boolean(!savedSecret && envSecret),
  };
}

export function getActiveAccountIdsForPlatform(
  platform: FinanceAdPlatform,
  creds: FinanceAdPlatformCreds = getFinanceAdCredentialsServerOnly()
): string[] {
  const entry = platform === "meta" ? creds.meta : creds.tiktok;
  if (!entry?.accessToken) return [];
  const selected = Array.isArray(entry.selectedAccountIds)
    ? entry.selectedAccountIds.map(id => normalizePlatformAccountId(platform, id)).filter(Boolean)
    : [];
  if (selected.length > 0) return Array.from(new Set(selected));

  const primary = normalizePlatformAccountId(
    platform,
    platform === "meta" ? creds.meta?.adAccountId || "" : creds.tiktok?.advertiserId || ""
  );
  return primary ? [primary] : [];
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
      savedMeta?.accessToken && (savedMeta?.adAccountId || (savedMeta?.selectedAccountIds?.length ?? 0) > 0 || (savedMeta?.discoveredAccounts?.length ?? 0) > 0)
        ? savedMeta
        : envMetaToken && envMetaAccount
          ? {
              ...(savedMeta || {}),
              adAccountId: envMetaAccount,
              accessToken: envMetaToken,
              lastSyncAt: savedMeta?.lastSyncAt,
              lastError: savedMeta?.lastError,
            }
          : savedMeta,
    tiktok:
      savedTt?.accessToken && (savedTt?.advertiserId || (savedTt?.selectedAccountIds?.length ?? 0) > 0 || (savedTt?.discoveredAccounts?.length ?? 0) > 0)
        ? savedTt
        : envTtToken && envTtAdvertiser
          ? {
              ...(savedTt || {}),
              advertiserId: envTtAdvertiser,
              accessToken: envTtToken,
              lastSyncAt: savedTt?.lastSyncAt,
              lastError: savedTt?.lastError,
            }
          : savedTt,
  };
}

function buildOAuthFields(
  platform: FinanceAdPlatform,
  entry:
    | FinanceAdPlatformCreds["meta"]
    | FinanceAdPlatformCreds["tiktok"]
    | undefined
): FinanceAdOAuthStatusFields {
  const oauthCfg = getEffectiveAdOAuthAppConfig(platform);
  return {
    authMode: entry?.authMode || (entry?.accessToken ? "manual" : undefined),
    oauthAppConfigured: oauthCfg.configured,
    oauthAppId: oauthCfg.appId || undefined,
    oauthAppSecretPreview: maskSecret(oauthCfg.appSecret) || undefined,
    oauthFromEnv: oauthCfg.fromEnv,
    userName: entry?.userName || undefined,
    tokenExpiresAt: entry?.tokenExpiresAt || undefined,
    discoveredAccounts: entry?.discoveredAccounts ? [...entry.discoveredAccounts] : undefined,
    selectedAccountIds: entry?.selectedAccountIds ? [...entry.selectedAccountIds] : undefined,
  };
}

export function buildPublicAdConnectionStatus(): FinanceAdConnectionStatus {
  const creds = getFinanceAdCredentialsServerOnly();
  const metaPrimary = getActiveAccountIdsForPlatform("meta", creds)[0] || creds.meta?.adAccountId || "";
  const ttPrimary = getActiveAccountIdsForPlatform("tiktok", creds)[0] || creds.tiktok?.advertiserId || "";
  return {
    meta: {
      configured: Boolean(creds.meta?.accessToken && (metaPrimary || (creds.meta?.discoveredAccounts?.length ?? 0) > 0)),
      adAccountId: metaPrimary,
      tokenPreview: maskSecret(creds.meta?.accessToken),
      lastSyncAt: creds.meta?.lastSyncAt,
      lastError: creds.meta?.lastError,
      ...buildOAuthFields("meta", creds.meta),
    },
    tiktok: {
      configured: Boolean(creds.tiktok?.accessToken && (ttPrimary || (creds.tiktok?.discoveredAccounts?.length ?? 0) > 0)),
      advertiserId: ttPrimary,
      tokenPreview: maskSecret(creds.tiktok?.accessToken),
      lastSyncAt: creds.tiktok?.lastSyncAt,
      lastError: creds.tiktok?.lastError,
      ...buildOAuthFields("tiktok", creds.tiktok),
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
      const prev = state.adCredentials?.meta;
      const normalizedAccount = normalizePlatformAccountId("meta", accountId);
      const finalToken = token || prev?.accessToken || "";
      if (!normalizedAccount || !finalToken) {
        throw new Error("Ad Account ID Meta et Access Token requis.");
      }
      state.adCredentials.meta = {
        oauthAppId: prev?.oauthAppId,
        oauthAppSecret: prev?.oauthAppSecret,
        adAccountId: normalizedAccount,
        accessToken: finalToken,
        authMode: "manual",
        selectedAccountIds: [normalizedAccount],
        lastSyncAt: prev?.lastSyncAt,
        lastError: undefined,
      };
    } else {
      const prev = state.adCredentials?.tiktok;
      const normalizedAccount = normalizePlatformAccountId("tiktok", accountId);
      const finalToken = token || prev?.accessToken || "";
      if (!normalizedAccount || !finalToken) {
        throw new Error("Advertiser ID TikTok et Access Token requis.");
      }
      state.adCredentials.tiktok = {
        oauthAppId: prev?.oauthAppId,
        oauthAppSecret: prev?.oauthAppSecret,
        advertiserId: normalizedAccount,
        accessToken: finalToken,
        authMode: "manual",
        selectedAccountIds: [normalizedAccount],
        lastSyncAt: prev?.lastSyncAt,
        lastError: undefined,
      };
    }
  });
  return buildPublicAdConnectionStatus();
}

export async function saveFinanceAdOAuthAppConfig(input: {
  platform: FinanceAdPlatform;
  appId: string;
  appSecret?: string;
}): Promise<FinanceAdConnectionStatus> {
  await ensureCheckoutStoreReady();
  const appId = input.appId.trim();
  const appSecret = String(input.appSecret || "").trim();
  mutateFinanceState(state => {
    if (input.platform === "meta") {
      const prev = state.adCredentials?.meta;
      const finalSecret = appSecret || prev?.oauthAppSecret || "";
      if (!appId || !finalSecret) {
        throw new Error("App ID et App Secret Meta requis.");
      }
      state.adCredentials.meta = {
        ...(prev || {}),
        adAccountId: prev?.adAccountId || "",
        accessToken: prev?.accessToken || "",
        oauthAppId: appId,
        oauthAppSecret: finalSecret,
      };
    } else {
      const prev = state.adCredentials?.tiktok;
      const finalSecret = appSecret || prev?.oauthAppSecret || "";
      if (!appId || !finalSecret) {
        throw new Error("App ID et App Secret TikTok requis.");
      }
      state.adCredentials.tiktok = {
        ...(prev || {}),
        advertiserId: prev?.advertiserId || "",
        accessToken: prev?.accessToken || "",
        oauthAppId: appId,
        oauthAppSecret: finalSecret,
      };
    }
  });
  return buildPublicAdConnectionStatus();
}

export async function clearFinanceAdOAuthAppConfig(
  platform: FinanceAdPlatform
): Promise<FinanceAdConnectionStatus> {
  await ensureCheckoutStoreReady();
  mutateFinanceState(state => {
    const prev = platform === "meta" ? state.adCredentials?.meta : state.adCredentials?.tiktok;
    if (!prev) return;
    delete prev.oauthAppId;
    delete prev.oauthAppSecret;
  });
  return buildPublicAdConnectionStatus();
}

export async function saveFinanceAdOAuthConnection(input: {
  platform: FinanceAdPlatform;
  accessToken: string;
  userName?: string;
  tokenExpiresAt?: string;
  discoveredAccounts: FinanceAdDiscoveredAccount[];
}): Promise<FinanceAdConnectionStatus> {
  await ensureCheckoutStoreReady();
  const token = input.accessToken.trim();
  if (!token) {
    throw new Error("Token OAuth vide reçu.");
  }
  const normalizedAccounts = input.discoveredAccounts
    .map(acc => ({
      ...acc,
      id: normalizePlatformAccountId(input.platform, acc.id),
    }))
    .filter(acc => Boolean(acc.id));

  mutateFinanceState(state => {
    const prev = input.platform === "meta" ? state.adCredentials?.meta : state.adCredentials?.tiktok;
    const availableSet = new Set(normalizedAccounts.map(a => a.id));
    const prevSelected = (prev?.selectedAccountIds || []).filter(id => availableSet.has(id));
    const defaultSelected =
      prevSelected.length > 0 ? prevSelected : normalizedAccounts.map(a => a.id);
    const primaryId = defaultSelected[0] || "";

    if (input.platform === "meta") {
      state.adCredentials.meta = {
        oauthAppId: prev?.oauthAppId,
        oauthAppSecret: prev?.oauthAppSecret,
        lastSyncAt: prev?.lastSyncAt,
        adAccountId: primaryId,
        accessToken: token,
        authMode: "oauth",
        userName: input.userName?.trim() || undefined,
        tokenExpiresAt: input.tokenExpiresAt || undefined,
        discoveredAccounts: normalizedAccounts,
        selectedAccountIds: defaultSelected,
        lastError: undefined,
      };
    } else {
      state.adCredentials.tiktok = {
        oauthAppId: prev?.oauthAppId,
        oauthAppSecret: prev?.oauthAppSecret,
        lastSyncAt: prev?.lastSyncAt,
        advertiserId: primaryId,
        accessToken: token,
        authMode: "oauth",
        userName: input.userName?.trim() || undefined,
        tokenExpiresAt: input.tokenExpiresAt || undefined,
        discoveredAccounts: normalizedAccounts,
        selectedAccountIds: defaultSelected,
        lastError: undefined,
      };
    }
  });
  return buildPublicAdConnectionStatus();
}

export async function setFinanceAdSelectedAccounts(input: {
  platform: FinanceAdPlatform;
  accountIds: string[];
}): Promise<FinanceAdConnectionStatus> {
  await ensureCheckoutStoreReady();
  const uniqueIds = Array.from(
    new Set(input.accountIds.map(id => normalizePlatformAccountId(input.platform, id)).filter(Boolean))
  );
  mutateFinanceState(state => {
    const entry = input.platform === "meta" ? state.adCredentials?.meta : state.adCredentials?.tiktok;
    if (!entry || !entry.accessToken) {
      throw new Error(`Connecte d’abord ${input.platform === "meta" ? "Meta Ads" : "TikTok Ads"}.`);
    }
    entry.selectedAccountIds = uniqueIds;
    if (input.platform === "meta") {
      state.adCredentials.meta!.adAccountId = uniqueIds[0] || "";
    } else {
      state.adCredentials.tiktok!.advertiserId = uniqueIds[0] || "";
    }
    entry.lastError = undefined;
  });
  return buildPublicAdConnectionStatus();
}

export async function clearFinanceAdCredentials(
  platform: FinanceAdPlatform
): Promise<FinanceAdConnectionStatus> {
  await ensureCheckoutStoreReady();
  mutateFinanceState(state => {
    const prev = platform === "meta" ? state.adCredentials?.meta : state.adCredentials?.tiktok;
    if (prev?.oauthAppId && prev?.oauthAppSecret) {
      // Preserve one-time OAuth App setup so user can reconnect in 1 click.
      if (platform === "meta") {
        state.adCredentials.meta = {
          adAccountId: "",
          accessToken: "",
          oauthAppId: prev.oauthAppId,
          oauthAppSecret: prev.oauthAppSecret,
        };
      } else {
        state.adCredentials.tiktok = {
          advertiserId: "",
          accessToken: "",
          oauthAppId: prev.oauthAppId,
          oauthAppSecret: prev.oauthAppSecret,
        };
      }
    } else {
      if (platform === "meta") delete state.adCredentials.meta;
      else delete state.adCredentials.tiktok;
    }
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
