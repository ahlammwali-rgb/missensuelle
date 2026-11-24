import {
  algiersDateKey,
  type FinanceAdCurrency,
  type FinanceAdPlatform,
} from "../shared/finance";
import {
  bulkUpsertAdSpendEntries,
  getFinanceAdCredentialsServerOnly,
  recordFinanceAdSyncResult,
} from "./financeStore";

type ParsedSpendRow = {
  date: string;
  platform: FinanceAdPlatform;
  campaignId: string;
  campaignName: string;
  spendAmount: number;
  currency: FinanceAdCurrency;
  impressions: number;
  clicks: number;
  conversions: number;
  source: "meta_api" | "tiktok_api" | "csv";
};

function normalizeCurrency(raw?: string | null): FinanceAdCurrency {
  const c = String(raw || "USD").trim().toUpperCase();
  if (c === "DZD") return "DZD";
  if (c === "EUR") return "EUR";
  return "USD";
}

function defaultDateRange(daysBack = 30): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = algiersDateKey(now);
  const start = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const startDate = algiersDateKey(start);
  return { startDate, endDate };
}

function extractMetaPurchases(
  actions?: Array<{ action_type?: string; value?: string | number }>
): number {
  if (!Array.isArray(actions)) return 0;
  let maxVal = 0;
  for (const act of actions) {
    const t = String(act?.action_type || "").toLowerCase();
    if (
      t === "purchase" ||
      t === "offsite_conversion.fb_pixel_purchase" ||
      t === "omni_purchase"
    ) {
      maxVal = Math.max(maxVal, Math.round(Number(act.value || 0)));
    }
  }
  return maxVal;
}

/**
 * Pulls daily campaign insights from Meta Marketing API (Facebook / Instagram Ads).
 */
export async function syncMetaAdInsights(options?: {
  startDate?: string;
  endDate?: string;
}): Promise<{ ok: boolean; synced: number; error?: string }> {
  const creds = getFinanceAdCredentialsServerOnly().meta;
  if (!creds?.adAccountId || !creds?.accessToken) {
    return { ok: false, synced: 0, error: "Compte Meta Ads non configuré" };
  }

  const def = defaultDateRange(30);
  const since = options?.startDate || def.startDate;
  const until = options?.endDate || def.endDate;
  const actId = creds.adAccountId.startsWith("act_") ? creds.adAccountId : `act_${creds.adAccountId}`;

  const url = new URL(`https://graph.facebook.com/v21.0/${encodeURIComponent(actId)}/insights`);
  url.searchParams.set("access_token", creds.accessToken);
  url.searchParams.set("level", "campaign");
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("time_range", JSON.stringify({ since, until }));
  url.searchParams.set("limit", "200");
  url.searchParams.set(
    "fields",
    "campaign_id,campaign_name,spend,impressions,clicks,actions,account_currency,date_start"
  );

  const collected: ParsedSpendRow[] = [];
  let nextUrl: string | null = url.toString();
  let pageGuard = 0;

  try {
    while (nextUrl && pageGuard < 15) {
      pageGuard++;
      const res = await fetch(nextUrl, {
        method: "GET",
        signal: AbortSignal.timeout(15000),
      });
      const json = (await res.json()) as {
        data?: Array<{
          campaign_id?: string;
          campaign_name?: string;
          spend?: string | number;
          impressions?: string | number;
          clicks?: string | number;
          actions?: Array<{ action_type?: string; value?: string | number }>;
          account_currency?: string;
          date_start?: string;
        }>;
        paging?: { next?: string };
        error?: { message?: string };
      };

      if (!res.ok || json.error) {
        const msg = json.error?.message || `Meta Graph HTTP ${res.status}`;
        await recordFinanceAdSyncResult("meta", { ok: false, error: msg });
        return { ok: false, synced: 0, error: msg };
      }

      for (const row of json.data || []) {
        const date = String(row.date_start || "").slice(0, 10);
        const cid = String(row.campaign_id || "").trim();
        const spend = Number(row.spend || 0);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !cid || !Number.isFinite(spend)) continue;
        collected.push({
          date,
          platform: "meta",
          campaignId: cid,
          campaignName: String(row.campaign_name || `Meta ${cid}`).trim(),
          spendAmount: spend,
          currency: normalizeCurrency(row.account_currency),
          impressions: Math.max(0, Math.round(Number(row.impressions || 0))),
          clicks: Math.max(0, Math.round(Number(row.clicks || 0))),
          conversions: extractMetaPurchases(row.actions),
          source: "meta_api",
        });
      }

      nextUrl = json.paging?.next || null;
    }

    const { upserted } = await bulkUpsertAdSpendEntries(collected);
    await recordFinanceAdSyncResult("meta", { ok: true });
    return { ok: true, synced: upserted };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur réseau Meta API";
    await recordFinanceAdSyncResult("meta", { ok: false, error: msg });
    return { ok: false, synced: 0, error: msg };
  }
}

/**
 * Pulls daily campaign insights from TikTok Marketing API (Business API v1.3).
 */
export async function syncTikTokAdInsights(options?: {
  startDate?: string;
  endDate?: string;
}): Promise<{ ok: boolean; synced: number; error?: string }> {
  const creds = getFinanceAdCredentialsServerOnly().tiktok;
  if (!creds?.advertiserId || !creds?.accessToken) {
    return { ok: false, synced: 0, error: "Compte TikTok Ads non configuré" };
  }

  const def = defaultDateRange(30);
  const startDate = options?.startDate || def.startDate;
  const endDate = options?.endDate || def.endDate;

  let currency: FinanceAdCurrency = "USD";
  try {
    const infoUrl = new URL("https://business-api.tiktok.com/open_api/v1.3/advertiser/info/");
    infoUrl.searchParams.set("advertiser_ids", JSON.stringify([creds.advertiserId]));
    const infoRes = await fetch(infoUrl.toString(), {
      method: "GET",
      headers: { "Access-Token": creds.accessToken },
      signal: AbortSignal.timeout(10000),
    });
    if (infoRes.ok) {
      const infoJson = (await infoRes.json()) as {
        data?: { list?: Array<{ currency?: string }> };
      };
      const curRaw = infoJson.data?.list?.[0]?.currency;
      if (curRaw) currency = normalizeCurrency(curRaw);
    }
  } catch {
    // Default cleanly to USD
  }

  const collected: ParsedSpendRow[] = [];
  let page = 1;
  let totalPage = 1;

  try {
    while (page <= totalPage && page <= 15) {
      const url = new URL("https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/");
      url.searchParams.set("advertiser_id", creds.advertiserId);
      url.searchParams.set("report_type", "BASIC");
      url.searchParams.set("service_type", "AUCTION");
      url.searchParams.set("data_level", "AUCTION_CAMPAIGN");
      url.searchParams.set("dimensions", JSON.stringify(["campaign_id", "stat_time_day"]));
      url.searchParams.set(
        "metrics",
        JSON.stringify(["campaign_name", "spend", "impressions", "clicks", "conversion"])
      );
      url.searchParams.set("start_date", startDate);
      url.searchParams.set("end_date", endDate);
      url.searchParams.set("page", String(page));
      url.searchParams.set("page_size", "200");

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { "Access-Token": creds.accessToken },
        signal: AbortSignal.timeout(15000),
      });

      const json = (await res.json()) as {
        code?: number;
        message?: string;
        data?: {
          page_info?: { total_page?: number };
          list?: Array<{
            dimensions?: { campaign_id?: string; stat_time_day?: string };
            metrics?: {
              campaign_name?: string;
              spend?: string | number;
              impressions?: string | number;
              clicks?: string | number;
              conversion?: string | number;
            };
          }>;
        };
      };

      if (!res.ok || (typeof json.code === "number" && json.code !== 0)) {
        const msg = json.message || `TikTok API HTTP ${res.status}`;
        await recordFinanceAdSyncResult("tiktok", { ok: false, error: msg });
        return { ok: false, synced: 0, error: msg };
      }

      totalPage = Math.max(1, Number(json.data?.page_info?.total_page || 1));

      for (const row of json.data?.list || []) {
        const cid = String(row.dimensions?.campaign_id || "").trim();
        const date = String(row.dimensions?.stat_time_day || "").slice(0, 10);
        const spend = Number(row.metrics?.spend || 0);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !cid || !Number.isFinite(spend)) continue;
        collected.push({
          date,
          platform: "tiktok",
          campaignId: cid,
          campaignName: String(row.metrics?.campaign_name || `TikTok ${cid}`).trim(),
          spendAmount: spend,
          currency,
          impressions: Math.max(0, Math.round(Number(row.metrics?.impressions || 0))),
          clicks: Math.max(0, Math.round(Number(row.metrics?.clicks || 0))),
          conversions: Math.max(0, Math.round(Number(row.metrics?.conversion || 0))),
          source: "tiktok_api",
        });
      }

      page++;
    }

    const { upserted } = await bulkUpsertAdSpendEntries(collected);
    await recordFinanceAdSyncResult("tiktok", { ok: true });
    return { ok: true, synced: upserted };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur réseau TikTok API";
    await recordFinanceAdSyncResult("tiktok", { ok: false, error: msg });
    return { ok: false, synced: 0, error: msg };
  }
}

export async function syncConfiguredAdPlatforms(options?: {
  platform?: "all" | "meta" | "tiktok";
  startDate?: string;
  endDate?: string;
}) {
  const target = options?.platform || "all";
  const creds = getFinanceAdCredentialsServerOnly();
  const metaPromise =
    (target === "all" || target === "meta") && creds.meta?.accessToken
      ? syncMetaAdInsights(options)
      : Promise.resolve(null);
  const tiktokPromise =
    (target === "all" || target === "tiktok") && creds.tiktok?.accessToken
      ? syncTikTokAdInsights(options)
      : Promise.resolve(null);

  const [meta, tiktok] = await Promise.all([metaPromise, tiktokPromise]);
  return { meta, tiktok };
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function normalizeHeaderName(h: string): string {
  return h
    .replace(/^\ufeff/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseFlexibleNumber(raw?: string): number {
  const clean = String(raw || "")
    .replace(/[^\d.,-]/g, "")
    .replace(",", ".");
  const num = Number(clean);
  return Number.isFinite(num) ? Math.max(0, num) : 0;
}

function parseFlexibleDate(raw?: string): string | null {
  const clean = String(raw || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) return clean.slice(0, 10);
  const dmy = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const parsed = Date.parse(clean);
  if (Number.isFinite(parsed)) return algiersDateKey(parsed);
  return null;
}

/**
 * Parses CSV exports from Meta Ads Manager & TikTok Ads Manager (FR/EN headers).
 */
export async function importAdSpendCsv(params: {
  platform: FinanceAdPlatform;
  csvText: string;
  defaultCurrency?: FinanceAdCurrency;
}): Promise<{ imported: number; totalSpendAmount: number }> {
  const lines = params.csvText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error("CSV vide ou en-têtes manquants.");
  }

  const headerLine = lines[0];
  const delimiter = headerLine.includes(";") ? ";" : headerLine.includes("\t") ? "\t" : ",";
  const headers = splitCsvLine(headerLine, delimiter).map(normalizeHeaderName);

  const findCol = (candidates: string[]) =>
    headers.findIndex(h => candidates.some(c => h === c || h.includes(c)));

  const colCampaignName = findCol([
    "campaign name",
    "nom de la campagne",
    "campagne",
    "campaign",
  ]);
  const colCampaignId = findCol(["campaign id", "id de la campagne", "identifiant de la campagne"]);
  const colDate = findCol([
    "reporting starts",
    "debut des rapports",
    "by day",
    "stat_time_day",
    "date",
    "jour",
  ]);
  const colSpend = findCol([
    "amount spent",
    "montant depense",
    "cost",
    "cout",
    "spend",
    "depense",
  ]);
  const colCurrency = findCol(["currency", "devise"]);
  const colImpr = findCol(["impressions"]);
  const colClicks = findCol(["clicks", "clics"]);
  const colConv = findCol(["results", "resultats", "purchases", "achats", "conversion"]);

  if (colCampaignName < 0 || colSpend < 0) {
    throw new Error(
      "Colonnes requises introuvables (Nom de campagne + Montant dépensé). Utilise l'export CSV standard Meta ou TikTok."
    );
  }

  const today = algiersDateKey();
  const entries: ParsedSpendRow[] = [];
  let totalSpendAmount = 0;

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i], delimiter);
    const campName = (cells[colCampaignName] || "").trim();
    if (!campName || /^(total|résumé|summary)/i.test(campName)) continue;

    const spendAmount = parseFlexibleNumber(cells[colSpend]);
    if (spendAmount <= 0) continue;

    const date = (colDate >= 0 ? parseFlexibleDate(cells[colDate]) : null) || today;
    const campaignId =
      (colCampaignId >= 0 ? (cells[colCampaignId] || "").trim() : "") ||
      `${params.platform}:${campName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48)}`;
    const currency =
      colCurrency >= 0 && cells[colCurrency]
        ? normalizeCurrency(cells[colCurrency])
        : params.defaultCurrency || "USD";

    totalSpendAmount += spendAmount;
    entries.push({
      date,
      platform: params.platform,
      campaignId,
      campaignName: campName,
      spendAmount,
      currency,
      impressions: colImpr >= 0 ? Math.round(parseFlexibleNumber(cells[colImpr])) : 0,
      clicks: colClicks >= 0 ? Math.round(parseFlexibleNumber(cells[colClicks])) : 0,
      conversions: colConv >= 0 ? Math.round(parseFlexibleNumber(cells[colConv])) : 0,
      source: "csv",
    });
  }

  const { upserted } = await bulkUpsertAdSpendEntries(entries);
  return { imported: upserted, totalSpendAmount: Math.round(totalSpendAmount * 100) / 100 };
}
