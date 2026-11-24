export type VisitSource = "facebook" | "tiktok" | "google" | "direct" | "other";

export type VisitDateFilterKey = "today" | "yesterday" | "7d" | "14d" | "30d" | "all" | "custom";

export type VisitCompareMode = "none" | "previous_period" | "product";

export type ProductVisitCount = {
  name: string;
  slug?: string;
  views: number;
  uniqueVisitors: number;
};

export type DailyVisitBucket = {
  date: string; // YYYY-MM-DD in Africa/Algiers
  totalViews: number;
  uniqueVisitors: number;
  hourly: number[]; // 24 slots (00..23)
  byProduct: Record<string, ProductVisitCount>;
  hourlyByProduct?: Record<string, number[]>;
  bySource?: Partial<Record<VisitSource, number>>;
};

export type VisitAnalyticsData = {
  days: DailyVisitBucket[];
  todayDateKey: string;
  serverNowIso: string;
  productNames: Record<string, { name: string; slug?: string }>;
};

export type VisitSeriesPoint = {
  key: string;
  label: string;
  shortLabel: string;
  views: number;
  uniqueVisitors: number;
  compareViews: number | null;
  orders: number;
};

export type ProductComparisonRow = {
  productKey: string;
  name: string;
  slug?: string;
  views: number;
  uniqueVisitors: number;
  orders: number;
  conversionRate: number | null;
  sharePct: number;
};

export type OrderLikeForVisits = {
  id: string;
  createdAt: string;
  productId?: string;
  product: string;
};

export type CatalogProductLike = {
  id: string;
  slug?: string;
  name: string;
  arName?: string;
};

const ALGIERS_OFFSET_MS = 60 * 60 * 1000; // Algeria is UTC+1 year-round (Africa/Algiers)

export function toAlgiersShiftedDate(date: Date = new Date()): Date {
  return new Date(date.getTime() + ALGIERS_OFFSET_MS);
}

export function getAlgiersDateKey(date: Date = new Date()): string {
  return toAlgiersShiftedDate(date).toISOString().slice(0, 10);
}

export function getAlgiersHour(date: Date = new Date()): number {
  return toAlgiersShiftedDate(date).getUTCHours();
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  const utc = new Date(Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0));
  return utc.toISOString().slice(0, 10);
}

export function enumerateDateKeys(startKey: string, endKey: string): string[] {
  if (!startKey || !endKey) return [];
  const start = startKey <= endKey ? startKey : endKey;
  const end = startKey <= endKey ? endKey : startKey;
  const out: string[] = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 366) {
    out.push(cursor);
    cursor = shiftDateKey(cursor, 1);
    guard++;
  }
  return out;
}

export function formatShortFrDate(dateKey: string): string {
  const [, m, d] = dateKey.split("-").map(Number);
  if (!m || !d) return dateKey;
  const months = ["jan", "fév", "mar", "avr", "mai", "juin", "juil", "août", "sep", "oct", "nov", "déc"];
  return `${d} ${months[m - 1] ?? ""}`.trim();
}

export function parseOrderAlgiersDateAndHour(createdAt: string): { dateKey: string; hour: number } | null {
  if (!createdAt || !createdAt.trim()) return null;
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    dateKey: getAlgiersDateKey(parsed),
    hour: getAlgiersHour(parsed),
  };
}

export function normalizeVisitProductKey(rawKey?: string | null): string {
  const clean = (rawKey || "").trim();
  if (!clean) return "__home__";
  return clean;
}

export function inferOrderProductKey(
  order: OrderLikeForVisits,
  catalog: CatalogProductLike[],
): string {
  if (order.productId && order.productId.trim()) {
    const idClean = order.productId.trim();
    const byId = catalog.find(p => p.id.toLowerCase() === idClean.toLowerCase());
    if (byId) return byId.id;
    return idClean;
  }
  const cleanProd = (order.product || "").split("×")[0].split("(")[0].trim().toLowerCase();
  if (!cleanProd) return "__other__";
  for (const p of catalog) {
    const fr = p.name.toLowerCase().trim();
    const ar = (p.arName || "").toLowerCase().trim();
    if (cleanProd === fr || (ar && cleanProd === ar) || cleanProd.includes(fr) || (ar && cleanProd.includes(ar))) {
      return p.id;
    }
  }
  return "__other__";
}

function getBucketViewsForProduct(bucket: DailyVisitBucket | undefined, productKey: string): number {
  if (!bucket) return 0;
  if (!productKey || productKey === "all") return bucket.totalViews || 0;
  return bucket.byProduct?.[productKey]?.views ?? 0;
}

function getBucketUniqueForProduct(bucket: DailyVisitBucket | undefined, productKey: string): number {
  if (!bucket) return 0;
  if (!productKey || productKey === "all") return bucket.uniqueVisitors || 0;
  return bucket.byProduct?.[productKey]?.uniqueVisitors ?? 0;
}

function getBucketHourlyForProduct(bucket: DailyVisitBucket | undefined, productKey: string, hour: number): number {
  if (!bucket || hour < 0 || hour > 23) return 0;
  if (!productKey || productKey === "all") {
    return bucket.hourly?.[hour] ?? 0;
  }
  const prodHours = bucket.hourlyByProduct?.[productKey];
  if (Array.isArray(prodHours)) {
    return prodHours[hour] ?? 0;
  }
  return 0;
}

export function resolveDateRangeKeys(params: {
  dateFilter: VisitDateFilterKey;
  todayKey: string;
  availableDates: string[];
  customFrom?: string;
  customTo?: string;
}): { currentKeys: string[]; previousKeys: string[]; hourlyMode: boolean } {
  const { dateFilter, todayKey, availableDates, customFrom, customTo } = params;
  if (dateFilter === "today") {
    return {
      currentKeys: [todayKey],
      previousKeys: [shiftDateKey(todayKey, -1)],
      hourlyMode: true,
    };
  }
  if (dateFilter === "yesterday") {
    const yest = shiftDateKey(todayKey, -1);
    return {
      currentKeys: [yest],
      previousKeys: [shiftDateKey(todayKey, -2)],
      hourlyMode: true,
    };
  }
  if (dateFilter === "7d" || dateFilter === "14d" || dateFilter === "30d") {
    const span = dateFilter === "7d" ? 7 : dateFilter === "14d" ? 14 : 30;
    const start = shiftDateKey(todayKey, -(span - 1));
    const prevEnd = shiftDateKey(start, -1);
    const prevStart = shiftDateKey(prevEnd, -(span - 1));
    return {
      currentKeys: enumerateDateKeys(start, todayKey),
      previousKeys: enumerateDateKeys(prevStart, prevEnd),
      hourlyMode: false,
    };
  }
  if (dateFilter === "custom" && customFrom && customTo) {
    const currentKeys = enumerateDateKeys(customFrom, customTo);
    const span = Math.max(1, currentKeys.length);
    if (span === 1) {
      return {
        currentKeys,
        previousKeys: [shiftDateKey(currentKeys[0], -1)],
        hourlyMode: true,
      };
    }
    const prevEnd = shiftDateKey(currentKeys[0], -1);
    const prevStart = shiftDateKey(prevEnd, -(span - 1));
    return {
      currentKeys,
      previousKeys: enumerateDateKeys(prevStart, prevEnd),
      hourlyMode: false,
    };
  }

  // "all": from earliest available date (or last 14 days if empty) up to todayKey
  const sorted = [...availableDates].filter(Boolean).sort();
  const earliest = sorted[0] && sorted[0] <= todayKey ? sorted[0] : shiftDateKey(todayKey, -13);
  const currentKeys = enumerateDateKeys(earliest, todayKey);
  const span = Math.max(1, currentKeys.length);
  const prevEnd = shiftDateKey(currentKeys[0], -1);
  const prevStart = shiftDateKey(prevEnd, -(span - 1));
  return {
    currentKeys,
    previousKeys: enumerateDateKeys(prevStart, prevEnd),
    hourlyMode: false,
  };
}

export function buildVisitDashboardSummary(params: {
  data: VisitAnalyticsData | undefined;
  orders: OrderLikeForVisits[];
  catalog: CatalogProductLike[];
  dateFilter: VisitDateFilterKey;
  selectedProductKey: string; // "all" or specific productKey
  compareMode: VisitCompareMode;
  compareProductKey: string; // productKey for B when compareMode === "product"
  customFrom?: string;
  customTo?: string;
}): {
  points: VisitSeriesPoint[];
  hourlyMode: boolean;
  totalViews: number;
  uniqueVisitors: number;
  ordersInPeriod: number;
  conversionRate: number | null;
  compareTotalViews: number | null;
  deltaPct: number | null;
  productRows: ProductComparisonRow[];
  sourceTotals: Array<{ source: VisitSource; views: number; pct: number }>;
  rangeLabel: string;
} {
  const {
    data,
    orders,
    catalog,
    dateFilter,
    selectedProductKey,
    compareMode,
    compareProductKey,
    customFrom,
    customTo,
  } = params;

  const todayKey = data?.todayDateKey || getAlgiersDateKey();
  const daysMap = new Map<string, DailyVisitBucket>();
  const availableDates: string[] = [];
  for (const day of data?.days ?? []) {
    if (day?.date) {
      daysMap.set(day.date, day);
      availableDates.push(day.date);
    }
  }

  const { currentKeys, previousKeys, hourlyMode } = resolveDateRangeKeys({
    dateFilter,
    todayKey,
    availableDates,
    customFrom,
    customTo,
  });

  const currentKeySet = new Set(currentKeys);

  // Index orders by dateKey / hour / productKey
  const ordersByDay = new Map<string, number>();
  const ordersByHour = new Array<number>(24).fill(0);
  const ordersByProduct = new Map<string, number>();

  for (const order of orders) {
    const parsed = parseOrderAlgiersDateAndHour(order.createdAt);
    if (!parsed || !currentKeySet.has(parsed.dateKey)) continue;
    const orderProdKey = inferOrderProductKey(order, catalog);
    ordersByProduct.set(orderProdKey, (ordersByProduct.get(orderProdKey) ?? 0) + 1);
    if (selectedProductKey === "all" || orderProdKey === selectedProductKey) {
      ordersByDay.set(parsed.dateKey, (ordersByDay.get(parsed.dateKey) ?? 0) + 1);
      if (hourlyMode && parsed.hour >= 0 && parsed.hour < 24) {
        ordersByHour[parsed.hour] += 1;
      }
    }
  }

  const primaryProduct = selectedProductKey || "all";
  const points: VisitSeriesPoint[] = [];

  if (hourlyMode) {
    const currentBucket = daysMap.get(currentKeys[0]);
    const prevBucket = daysMap.get(previousKeys[0]);
    for (let h = 0; h < 24; h++) {
      const views = getBucketHourlyForProduct(currentBucket, primaryProduct, h);
      let compareViews: number | null = null;
      if (compareMode === "previous_period") {
        compareViews = getBucketHourlyForProduct(prevBucket, primaryProduct, h);
      } else if (compareMode === "product") {
        compareViews = getBucketHourlyForProduct(currentBucket, compareProductKey || "all", h);
      }
      const hourLabel = `${String(h).padStart(2, "0")}h`;
      points.push({
        key: `${currentKeys[0]}-${hourLabel}`,
        label: `${formatShortFrDate(currentKeys[0])} · ${hourLabel}`,
        shortLabel: h % 3 === 0 ? hourLabel : "",
        views,
        uniqueVisitors: 0,
        compareViews,
        orders: ordersByHour[h] ?? 0,
      });
    }
  } else {
    currentKeys.forEach((dateKey, idx) => {
      const bucket = daysMap.get(dateKey);
      const prevKey = previousKeys[idx];
      const prevBucket = prevKey ? daysMap.get(prevKey) : undefined;
      const views = getBucketViewsForProduct(bucket, primaryProduct);
      const uniqueVisitors = getBucketUniqueForProduct(bucket, primaryProduct);
      let compareViews: number | null = null;
      if (compareMode === "previous_period") {
        compareViews = getBucketViewsForProduct(prevBucket, primaryProduct);
      } else if (compareMode === "product") {
        compareViews = getBucketViewsForProduct(bucket, compareProductKey || "all");
      }
      points.push({
        key: dateKey,
        label: formatShortFrDate(dateKey),
        shortLabel:
          currentKeys.length <= 10 || idx === 0 || idx === currentKeys.length - 1 || idx % Math.ceil(currentKeys.length / 7) === 0
            ? formatShortFrDate(dateKey)
            : "",
        views,
        uniqueVisitors,
        compareViews,
        orders: ordersByDay.get(dateKey) ?? 0,
      });
    });
  }

  let totalViews = 0;
  let uniqueVisitors = 0;
  for (const key of currentKeys) {
    const b = daysMap.get(key);
    totalViews += getBucketViewsForProduct(b, primaryProduct);
    uniqueVisitors += getBucketUniqueForProduct(b, primaryProduct);
  }

  let compareTotalViews: number | null = null;
  if (compareMode === "previous_period") {
    compareTotalViews = previousKeys.reduce((sum, k) => sum + getBucketViewsForProduct(daysMap.get(k), primaryProduct), 0);
  } else if (compareMode === "product") {
    compareTotalViews = currentKeys.reduce((sum, k) => sum + getBucketViewsForProduct(daysMap.get(k), compareProductKey || "all"), 0);
  }

  const deltaPct =
    compareTotalViews !== null && compareTotalViews > 0
      ? Math.round(((totalViews - compareTotalViews) / compareTotalViews) * 1000) / 10
      : null;

  const ordersInPeriod =
    primaryProduct === "all"
      ? Array.from(ordersByProduct.values()).reduce((a, b) => a + b, 0)
      : ordersByProduct.get(primaryProduct) ?? 0;

  const conversionRate =
    totalViews > 0 ? Math.round((ordersInPeriod / totalViews) * 1000) / 10 : null;

  // Build Product comparison breakdown
  const prodAgg = new Map<string, { name: string; slug?: string; views: number; uniqueVisitors: number }>();

  const defaultPageNames: Record<string, string> = {
    __home__: "Accueil Boutique",
    __catalogue__: "Page Catalogue",
    __checkout__: "Page Commande / Panier",
  };

  for (const cProd of catalog) {
    prodAgg.set(cProd.id, {
      name: cProd.name,
      slug: cProd.slug,
      views: 0,
      uniqueVisitors: 0,
    });
  }

  for (const key of currentKeys) {
    const b = daysMap.get(key);
    if (!b?.byProduct) continue;
    for (const [pKey, pStats] of Object.entries(b.byProduct)) {
      if (!pKey) continue;
      const existing = prodAgg.get(pKey) ?? {
        name: pStats.name || data?.productNames?.[pKey]?.name || defaultPageNames[pKey] || pKey,
        slug: pStats.slug || data?.productNames?.[pKey]?.slug,
        views: 0,
        uniqueVisitors: 0,
      };
      existing.views += pStats.views || 0;
      existing.uniqueVisitors += pStats.uniqueVisitors || 0;
      if (!existing.name && pStats.name) existing.name = pStats.name;
      prodAgg.set(pKey, existing);
    }
  }

  const totalAcrossProducts = Array.from(prodAgg.values()).reduce((sum, item) => sum + item.views, 0);
  const productRows: ProductComparisonRow[] = Array.from(prodAgg.entries())
    .map(([productKey, item]) => {
      const ordCount = ordersByProduct.get(productKey) ?? 0;
      return {
        productKey,
        name: item.name,
        slug: item.slug,
        views: item.views,
        uniqueVisitors: item.uniqueVisitors,
        orders: ordCount,
        conversionRate: item.views > 0 ? Math.round((ordCount / item.views) * 1000) / 10 : null,
        sharePct: totalAcrossProducts > 0 ? Math.round((item.views / totalAcrossProducts) * 1000) / 10 : 0,
      };
    })
    .filter(r => r.views > 0 || r.orders > 0 || !r.productKey.startsWith("__"))
    .sort((a, b) => b.views - a.views || b.orders - a.orders);

  // Source breakdown
  const sourceAcc: Record<VisitSource, number> = {
    facebook: 0,
    tiktok: 0,
    google: 0,
    direct: 0,
    other: 0,
  };
  for (const key of currentKeys) {
    const b = daysMap.get(key);
    if (!b?.bySource) continue;
    for (const src of ["facebook", "tiktok", "google", "direct", "other"] as VisitSource[]) {
      sourceAcc[src] += b.bySource[src] ?? 0;
    }
  }
  const sourceTotalSum = Object.values(sourceAcc).reduce((a, b) => a + b, 0);
  const sourceTotals = (Object.entries(sourceAcc) as Array<[VisitSource, number]>)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([source, views]) => ({
      source,
      views,
      pct: sourceTotalSum > 0 ? Math.round((views / sourceTotalSum) * 100) : 0,
    }));

  const rangeLabel =
    currentKeys.length === 1
      ? formatShortFrDate(currentKeys[0])
      : `${formatShortFrDate(currentKeys[0])} → ${formatShortFrDate(currentKeys[currentKeys.length - 1])}`;

  return {
    points,
    hourlyMode,
    totalViews,
    uniqueVisitors,
    ordersInPeriod,
    conversionRate,
    compareTotalViews,
    deltaPct,
    productRows,
    sourceTotals,
    rangeLabel,
  };
}

export type ChartViewMode = "views" | "delivered" | "transferred" | "global";

export interface OrderLikeForMultiChart {
  createdAt: string;
  status?: string;
  carrier?: string | null;
  isDelivered?: boolean;
  deliveredAt?: string | null;
  total?: number;
}

export interface MultiMetricChartPoint {
  key: string;
  label: string;
  shortLabel: string;
  views: number;
  delivered: number;
  transferred: number;
  deliveredAmount: number;
  transferredAmount: number;
}

export interface MultiMetricChartSummary {
  points: MultiMetricChartPoint[];
  hourlyMode: boolean;
  rangeLabel: string;
  totals: {
    views: number;
    delivered: number;
    transferred: number;
    deliveredAmount: number;
    transferredAmount: number;
  };
  deltas: {
    views: number | null;
    delivered: number | null;
    transferred: number | null;
  };
}

function calcDeltaPct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function formatCompactBucketLabel(dateKey: string): string {
  const parts = dateKey.split("-");
  if (parts.length !== 3) return dateKey;
  return `${parts[2]}/${parts[1]}`;
}

export function buildMultiMetricChartSummary(params: {
  data: VisitAnalyticsData | undefined;
  orders: OrderLikeForMultiChart[];
  dateFilter: VisitDateFilterKey;
  selectedProductKey?: string;
  customFrom?: string;
  customTo?: string;
  now?: Date;
}): MultiMetricChartSummary {
  const {
    data,
    orders,
    dateFilter,
    selectedProductKey = "all",
    customFrom,
    customTo,
    now,
  } = params;

  const daysMap = new Map<string, DailyVisitBucket>();
  for (const d of data?.days ?? []) {
    if (d?.date) daysMap.set(d.date, d);
  }
  const availableDates = Array.from(daysMap.keys());
  const todayKey = getAlgiersDateKey(now ?? new Date());
  const { currentKeys, previousKeys, hourlyMode } = resolveDateRangeKeys({
    dateFilter,
    todayKey,
    availableDates,
    customFrom,
    customTo,
  });

  const currentSet = new Set(currentKeys);
  const previousSet = new Set(previousKeys);

  // Pre-aggregate transferred & delivered orders by dateKey and hour
  const transferredByDateHour = new Map<string, { count: number; amount: number }>();
  const deliveredByDateHour = new Map<string, { count: number; amount: number }>();
  const transferredByDate = new Map<string, { count: number; amount: number }>();
  const deliveredByDate = new Map<string, { count: number; amount: number }>();

  for (const order of orders) {
    const amount = Number(order.total || 0);
    const isCancelled = order.status === "annulee";
    const isTransferred =
      order.status === "transferee" ||
      (Boolean(order.carrier) && !isCancelled) ||
      Boolean(order.isDelivered);

    if (isTransferred) {
      const parsedCreated = parseOrderAlgiersDateAndHour(order.createdAt);
      if (parsedCreated) {
        const dAcc = transferredByDate.get(parsedCreated.dateKey) ?? { count: 0, amount: 0 };
        dAcc.count += 1;
        dAcc.amount += amount;
        transferredByDate.set(parsedCreated.dateKey, dAcc);

        const dhKey = `${parsedCreated.dateKey}#${parsedCreated.hour}`;
        const hAcc = transferredByDateHour.get(dhKey) ?? { count: 0, amount: 0 };
        hAcc.count += 1;
        hAcc.amount += amount;
        transferredByDateHour.set(dhKey, hAcc);
      }
    }

    if (order.isDelivered) {
      const parsedDelivered = parseOrderAlgiersDateAndHour(order.deliveredAt || order.createdAt);
      if (parsedDelivered) {
        const dAcc = deliveredByDate.get(parsedDelivered.dateKey) ?? { count: 0, amount: 0 };
        dAcc.count += 1;
        dAcc.amount += amount;
        deliveredByDate.set(parsedDelivered.dateKey, dAcc);

        const dhKey = `${parsedDelivered.dateKey}#${parsedDelivered.hour}`;
        const hAcc = deliveredByDateHour.get(dhKey) ?? { count: 0, amount: 0 };
        hAcc.count += 1;
        hAcc.amount += amount;
        deliveredByDateHour.set(dhKey, hAcc);
      }
    }
  }

  const points: MultiMetricChartPoint[] = [];

  if (hourlyMode) {
    const targetDay = currentKeys[0] || todayKey;
    const dayBucket = daysMap.get(targetDay);
    for (let hour = 0; hour < 24; hour++) {
      const hh = String(hour).padStart(2, "0");
      const dhKey = `${targetDay}#${hour}`;
      const tr = transferredByDateHour.get(dhKey) ?? { count: 0, amount: 0 };
      const dl = deliveredByDateHour.get(dhKey) ?? { count: 0, amount: 0 };
      points.push({
        key: `${targetDay}T${hh}`,
        label: `${hh}h00`,
        shortLabel: hour % 6 === 0 || hour === 23 ? `${hour}h` : "",
        views: getBucketHourlyForProduct(dayBucket, selectedProductKey, hour),
        delivered: dl.count,
        transferred: tr.count,
        deliveredAmount: dl.amount,
        transferredAmount: tr.amount,
      });
    }
  } else {
    const totalLen = currentKeys.length;
    const step = totalLen <= 8 ? 1 : totalLen <= 16 ? 2 : Math.max(2, Math.ceil(totalLen / 6));
    currentKeys.forEach((dateKey, idx) => {
      const dayBucket = daysMap.get(dateKey);
      const tr = transferredByDate.get(dateKey) ?? { count: 0, amount: 0 };
      const dl = deliveredByDate.get(dateKey) ?? { count: 0, amount: 0 };
      const showShort = idx === 0 || idx === totalLen - 1 || idx % step === 0;
      points.push({
        key: dateKey,
        label: formatShortFrDate(dateKey),
        shortLabel: showShort ? formatCompactBucketLabel(dateKey) : "",
        views: getBucketViewsForProduct(dayBucket, selectedProductKey),
        delivered: dl.count,
        transferred: tr.count,
        deliveredAmount: dl.amount,
        transferredAmount: tr.amount,
      });
    });
  }

  let totalViews = 0;
  let totalDelivered = 0;
  let totalTransferred = 0;
  let totalDeliveredAmount = 0;
  let totalTransferredAmount = 0;

  for (const key of currentKeys) {
    totalViews += getBucketViewsForProduct(daysMap.get(key), selectedProductKey);
    const dl = deliveredByDate.get(key);
    if (dl) {
      totalDelivered += dl.count;
      totalDeliveredAmount += dl.amount;
    }
    const tr = transferredByDate.get(key);
    if (tr) {
      totalTransferred += tr.count;
      totalTransferredAmount += tr.amount;
    }
  }

  let prevViews = 0;
  let prevDelivered = 0;
  let prevTransferred = 0;
  for (const key of previousKeys) {
    if (currentSet.has(key) && !previousSet.has(key)) continue;
    prevViews += getBucketViewsForProduct(daysMap.get(key), selectedProductKey);
    prevDelivered += deliveredByDate.get(key)?.count ?? 0;
    prevTransferred += transferredByDate.get(key)?.count ?? 0;
  }

  const rangeLabel =
    currentKeys.length === 1
      ? formatShortFrDate(currentKeys[0])
      : `${formatShortFrDate(currentKeys[0])} → ${formatShortFrDate(currentKeys[currentKeys.length - 1])}`;

  return {
    points,
    hourlyMode,
    rangeLabel,
    totals: {
      views: totalViews,
      delivered: totalDelivered,
      transferred: totalTransferred,
      deliveredAmount: totalDeliveredAmount,
      transferredAmount: totalTransferredAmount,
    },
    deltas: {
      views: calcDeltaPct(totalViews, prevViews),
      delivered: calcDeltaPct(totalDelivered, prevDelivered),
      transferred: calcDeltaPct(totalTransferred, prevTransferred),
    },
  };
}
