import { beforeEach, describe, expect, it } from "vitest";
import {
  buildMultiMetricChartSummary,
  buildVisitDashboardSummary,
  getAlgiersDateKey,
  shiftDateKey,
  type CatalogProductLike,
  type OrderLikeForVisits,
} from "../shared/siteVisits";
import {
  getSiteVisitAnalytics,
  recordSiteVisit,
  resetVisitStoreForTest,
} from "./siteVisits";

const SAMPLE_CATALOG: CatalogProductLike[] = [
  { id: "p-007", slug: "abaya-royal-emerald", name: "Abaya Royal Emerald" },
  { id: "p-005", slug: "extensions-silk-wave", name: "Extensions Silk Wave" },
];

describe("site visits tracking & analytics aggregation", () => {
  beforeEach(() => {
    resetVisitStoreForTest();
  });

  it("ignores bots and /admin routes while counting genuine customer visits and unique visitors", async () => {
    const tToday = new Date("2026-11-23T14:20:00.000Z"); // 15:20 Algiers (hour 15)

    const botRes = await recordSiteVisit({
      productId: "p-007",
      productName: "Abaya Royal Emerald",
      path: "/abaya",
      userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)",
      visitorId: "v-bot",
      at: tToday,
    });
    expect(botRes.recorded).toBe(false);

    const adminRes = await recordSiteVisit({
      productId: "__home__",
      productName: "Admin",
      path: "/admin",
      userAgent: "Mozilla/5.0 Chrome/120.0",
      visitorId: "v-owner",
      at: tToday,
    });
    expect(adminRes.recorded).toBe(false);

    // Same visitor opens p-007 twice -> 2 views, 1 uniqueVisitor
    await recordSiteVisit({
      productId: "p-007",
      productName: "Abaya Royal Emerald",
      path: "/abaya",
      source: "facebook",
      visitorId: "v-client-1",
      userAgent: "Mozilla/5.0 iPhone",
      at: tToday,
    });
    await recordSiteVisit({
      productId: "p-007",
      productName: "Abaya Royal Emerald",
      path: "/abaya",
      source: "facebook",
      visitorId: "v-client-1",
      userAgent: "Mozilla/5.0 iPhone",
      at: new Date("2026-11-23T14:25:00.000Z"),
    });
    // Another visitor views p-005 via TikTok
    await recordSiteVisit({
      productId: "p-005",
      productName: "Extensions Silk Wave",
      path: "/extensions",
      source: "tiktok",
      visitorId: "v-client-2",
      userAgent: "Mozilla/5.0 Android",
      at: tToday,
    });

    const analytics = await getSiteVisitAnalytics();
    expect(analytics.days.length).toBe(1);
    const day = analytics.days[0];
    expect(day.date).toBe("2026-11-23");
    expect(day.totalViews).toBe(3);
    expect(day.uniqueVisitors).toBe(2);
    expect(day.hourly[15]).toBe(3);
    expect(day.byProduct["p-007"]?.views).toBe(2);
    expect(day.byProduct["p-007"]?.uniqueVisitors).toBe(1);
    expect(day.byProduct["p-005"]?.views).toBe(1);
    expect(day.bySource?.facebook).toBe(2);
    expect(day.bySource?.tiktok).toBe(1);
  });

  it("computes date filters, previous-period comparison, product comparison and real conversion rates", async () => {
    const yesterday = shiftDateKey(getAlgiersDateKey(new Date("2026-11-23T12:00:00Z")), -1);
    expect(yesterday).toBe("2026-11-22");

    // Yesterday: 1 view on p-007
    await recordSiteVisit({
      productId: "p-007",
      productName: "Abaya Royal Emerald",
      path: "/abaya",
      source: "facebook",
      visitorId: "v-y1",
      at: new Date("2026-11-22T11:00:00.000Z"),
    });

    // Today: 3 views on p-007, 1 view on p-005
    await recordSiteVisit({
      productId: "p-007",
      productName: "Abaya Royal Emerald",
      path: "/abaya",
      source: "facebook",
      visitorId: "v-t1",
      at: new Date("2026-11-23T10:00:00.000Z"),
    });
    await recordSiteVisit({
      productId: "p-007",
      productName: "Abaya Royal Emerald",
      path: "/abaya",
      source: "facebook",
      visitorId: "v-t2",
      at: new Date("2026-11-23T10:05:00.000Z"),
    });
    await recordSiteVisit({
      productId: "p-007",
      productName: "Abaya Royal Emerald",
      path: "/abaya",
      source: "direct",
      visitorId: "v-t3",
      at: new Date("2026-11-23T10:15:00.000Z"),
    });
    await recordSiteVisit({
      productId: "p-005",
      productName: "Extensions Silk Wave",
      path: "/extensions",
      source: "tiktok",
      visitorId: "v-t4",
      at: new Date("2026-11-23T10:30:00.000Z"),
    });

    const analytics = await getSiteVisitAnalytics();
    const fixedTodayAnalytics = { ...analytics, todayDateKey: "2026-11-23" };

    const orders: OrderLikeForVisits[] = [
      { id: "MS-1", createdAt: "2026-11-23T10:20:00.000Z", productId: "p-007", product: "Abaya Royal Emerald" },
    ];

    // 1) Today hourly view + previous_period comparison (vs yesterday)
    const todayPrevSummary = buildVisitDashboardSummary({
      data: fixedTodayAnalytics,
      orders,
      catalog: SAMPLE_CATALOG,
      dateFilter: "today",
      selectedProductKey: "all",
      compareMode: "previous_period",
      compareProductKey: "p-005",
    });
    expect(todayPrevSummary.hourlyMode).toBe(true);
    expect(todayPrevSummary.points.length).toBe(24);
    expect(todayPrevSummary.totalViews).toBe(4);
    expect(todayPrevSummary.compareTotalViews).toBe(1);
    expect(todayPrevSummary.deltaPct).toBe(300);
    expect(todayPrevSummary.conversionRate).toBe(25);

    // 2) Product vs Product comparison on 7d range (p-007 vs p-005)
    const prodVsProdSummary = buildVisitDashboardSummary({
      data: fixedTodayAnalytics,
      orders,
      catalog: SAMPLE_CATALOG,
      dateFilter: "7d",
      selectedProductKey: "p-007",
      compareMode: "product",
      compareProductKey: "p-005",
    });
    expect(prodVsProdSummary.hourlyMode).toBe(false);
    expect(prodVsProdSummary.points.length).toBe(7);
    expect(prodVsProdSummary.totalViews).toBe(4); // 1 yesterday + 3 today
    expect(prodVsProdSummary.compareTotalViews).toBe(1); // 1 today on p-005
    expect(prodVsProdSummary.deltaPct).toBe(300);
    expect(prodVsProdSummary.productRows[0]?.productKey).toBe("p-007");
    expect(prodVsProdSummary.productRows[0]?.orders).toBe(1);
    expect(prodVsProdSummary.productRows[0]?.conversionRate).toBe(25);
  });

  it("builds multi-metric 4-mode chart summary (views, delivered, transferred, global)", async () => {
    const tToday = new Date("2026-11-23T14:20:00.000Z"); // 15:20 Algiers
    const tYesterday = new Date("2026-11-22T10:15:00.000Z"); // 11:15 Algiers

    await recordSiteVisit({
      productId: "p-007",
      productName: "Abaya Royal Emerald",
      path: "/abaya",
      visitorId: "v-1",
      userAgent: "Mozilla/5.0",
      at: tYesterday,
    });
    await recordSiteVisit({
      productId: "p-007",
      productName: "Abaya Royal Emerald",
      path: "/abaya",
      visitorId: "v-2",
      userAgent: "Mozilla/5.0",
      at: tToday,
    });

    const analytics = await getSiteVisitAnalytics();
    const multiOrders = [
      {
        createdAt: "2026-11-23T14:10:00.000Z", // 15h Algiers
        status: "transferee",
        carrier: "ecotrack",
        isDelivered: false,
        total: 6500,
      },
      {
        createdAt: "2026-11-22T09:00:00.000Z",
        deliveredAt: "2026-11-23T14:30:00.000Z", // delivered at 15h Algiers today
        status: "transferee",
        carrier: "ecotrack",
        isDelivered: true,
        total: 8900,
      },
    ];

    const todayMulti = buildMultiMetricChartSummary({
      data: analytics,
      orders: multiOrders,
      dateFilter: "today",
      now: new Date("2026-11-23T16:00:00.000Z"),
    });
    expect(todayMulti.hourlyMode).toBe(true);
    expect(todayMulti.points).toHaveLength(24);
    expect(todayMulti.totals.views).toBe(1);
    expect(todayMulti.totals.created).toBe(1);
    expect(todayMulti.totals.createdAmount).toBe(6500);
    expect(todayMulti.totals.transferred).toBe(1);
    expect(todayMulti.totals.delivered).toBe(1);
    expect(todayMulti.totals.transferredAmount).toBe(6500);
    expect(todayMulti.totals.deliveredAmount).toBe(8900);
    expect(todayMulti.points[15]?.views).toBe(1);
    expect(todayMulti.points[15]?.created).toBe(1);
    expect(todayMulti.points[15]?.transferred).toBe(1);
    expect(todayMulti.points[15]?.delivered).toBe(1);

    const rangeMulti = buildMultiMetricChartSummary({
      data: analytics,
      orders: multiOrders,
      dateFilter: "7d",
      now: new Date("2026-11-23T16:00:00.000Z"),
    });
    expect(rangeMulti.hourlyMode).toBe(false);
    expect(rangeMulti.points).toHaveLength(7);
    expect(rangeMulti.totals.views).toBe(2);
    expect(rangeMulti.totals.created).toBe(2);
    expect(rangeMulti.totals.createdAmount).toBe(15400);
    expect(rangeMulti.totals.transferred).toBe(2);
    expect(rangeMulti.totals.delivered).toBe(1);
    expect(rangeMulti.totals.deliveredAmount).toBe(8900);
  });

  it("counts all created orders (checkout, manual, Google Sheet) separately from transferred/delivered", () => {
    const orders = [
      // Checkout web nouvelle (10h Algiers)
      { createdAt: "2026-11-25T09:10:00.000Z", status: "nouvelle", total: 4200 },
      // Manual admin confirmer (10h Algiers)
      { createdAt: "2026-11-25T09:45:00.000Z", status: "confirmee", total: 5500 },
      // Google Sheet imported nouvelle (14h Algiers)
      { createdAt: "2026-11-25T13:20:00.000Z", status: "nouvelle", total: 0 },
      // Transferred (14h Algiers)
      { createdAt: "2026-11-25T13:50:00.000Z", status: "transferee", carrier: "ecotrack", total: 6800 },
      // Previous day created for delta comparison (2 orders on Nov 24)
      { createdAt: "2026-11-24T11:00:00.000Z", status: "nouvelle", total: 3000 },
      { createdAt: "2026-11-24T16:00:00.000Z", status: "annulee", total: 3000 },
    ];

    const summary = buildMultiMetricChartSummary({
      data: undefined,
      orders,
      dateFilter: "today",
      now: new Date("2026-11-25T15:00:00.000Z"),
    });

    expect(summary.totals.created).toBe(4);
    expect(summary.totals.createdAmount).toBe(16500);
    expect(summary.totals.transferred).toBe(1);
    expect(summary.totals.delivered).toBe(0);
    expect(summary.deltas.created).toBe(100); // 4 today vs 2 yesterday = +100%
    expect(summary.points[10]?.created).toBe(2);
    expect(summary.points[14]?.created).toBe(2);
  });
});
