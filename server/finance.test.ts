import { describe, expect, it } from "vitest";
import {
  computeFinanceDashboard,
  createDefaultPersistedFinanceState,
  getEffectiveExchangeRate,
  type FinanceCatalogProductRef,
  type PersistedFinanceState,
} from "../shared/finance";
import type { CheckoutOrder, StaffMember } from "../shared/checkout";
import { importAdSpendCsv } from "./adPlatforms";
import { appRouter } from "./routers";

const TEST_CATALOG: FinanceCatalogProductRef[] = [
  {
    id: "p-ext",
    name: "Extension Cheveux",
    slug: "extensions",
    price: 3500,
    colors: ["Châtain", "Blonde"],
    stock: 40,
  },
  {
    id: "p-abaya",
    name: "Abaya Royal",
    slug: "abaya-royal",
    price: 5500,
    colors: ["Noir"],
    stock: 20,
  },
];

const TEST_STAFF: StaffMember[] = [
  {
    id: "staff-1",
    name: "Sara Confirm",
    phone: "0550000001",
    code: "SARA1",
    avatarColor: "#ec4899",
    baseSalary: 0,
    commissionPerDelivered: 150,
    upsellBonusPerDelivered: 50,
    productCommissions: { "p-ext": 200 },
    active: true,
    createdAt: "2026-11-01T10:00:00Z",
  },
];

describe("Finance IA deterministic accounting engine", () => {
  it("computes FIFO split lots (500->600), variant-specific lot (800), DHD 50 DA vs E-com 0 DA returns, USD rate history, commissions, and cohort vs cashflow", () => {
    const state: PersistedFinanceState = createDefaultPersistedFinanceState();
    state.settings = {
      ...state.settings,
      defaultUsdToDzd: 250,
      packagingPerParcelDzd: 40,
      ecomReturnFeeDzd: 0,
      dhdReturnFeeDzd: 50,
      chargeOutboundShippingOnReturn: false,
      includeStaffBaseSalary: false,
    };

    state.exchangeRates = [
      { id: "fx-1", effectiveDate: "2026-11-01", usdToDzd: 250, note: "Taux début mois" },
      { id: "fx-2", effectiveDate: "2026-11-16", usdToDzd: 260, note: "Hausse devise" },
    ];

    // Lots: 2 @ 500 (Nov 10), 5 @ 600 (Nov 15), and variant Blonde 3 @ 800 (Nov 12)
    state.lots = [
      {
        id: "lot-500",
        productId: "p-ext",
        productName: "Extension Cheveux",
        variantKey: "",
        purchasedAt: "2026-11-10",
        quantityInitial: 2,
        unitCostDzd: 500,
        supplier: "Grossiste A",
        note: "Semaine 1",
        createdAt: "2026-11-10T08:00:00Z",
        updatedAt: "2026-11-10T08:00:00Z",
      },
      {
        id: "lot-800-blonde",
        productId: "p-ext",
        productName: "Extension Cheveux",
        variantKey: "Blonde",
        purchasedAt: "2026-11-12",
        quantityInitial: 3,
        unitCostDzd: 800,
        supplier: "Grossiste Blonde",
        note: "Teinte spéciale",
        createdAt: "2026-11-12T08:00:00Z",
        updatedAt: "2026-11-12T08:00:00Z",
      },
      {
        id: "lot-600",
        productId: "p-ext",
        productName: "Extension Cheveux",
        variantKey: "",
        purchasedAt: "2026-11-15",
        quantityInitial: 5,
        unitCostDzd: 600,
        supplier: "Grossiste A",
        note: "Semaine 2",
        createdAt: "2026-11-15T08:00:00Z",
        updatedAt: "2026-11-15T08:00:00Z",
      },
    ];

    state.adSpends = [
      {
        id: "ad-1",
        date: "2026-11-12",
        platform: "tiktok",
        campaignId: "TT_EXT_01",
        campaignName: "Extension Cheveux Châtain",
        productId: "p-ext",
        spendAmount: 10, // @ 250 = 2500 DA
        currency: "USD",
        source: "tiktok_api",
        updatedAt: "2026-11-12T23:00:00Z",
      },
      {
        id: "ad-2",
        date: "2026-11-16",
        platform: "meta",
        campaignId: "FB_EXT_BLONDE",
        campaignName: "Extension Blonde Promo",
        productId: "p-ext",
        variantKey: "Blonde",
        spendAmount: 10, // @ 260 = 2600 DA
        currency: "USD",
        source: "meta_api",
        updatedAt: "2026-11-16T23:00:00Z",
      },
    ];

    state.expenses = [
      {
        id: "exp-daily",
        date: "2026-11-12",
        title: "Achat sachets en gros",
        category: "packaging",
        frequency: "daily",
        amount: 400,
        currency: "DZD",
        note: "",
        createdAt: "2026-11-12T10:00:00Z",
      },
      {
        id: "exp-fixed",
        date: "2026-11-01",
        title: "Loyer dépôt",
        category: "rent",
        frequency: "monthly_fixed",
        amount: 30000, // 1000 DA/day in 30-day Nov
        currency: "DZD",
        note: "",
        createdAt: "2026-11-01T10:00:00Z",
      },
    ];

    const orders: CheckoutOrder[] = [
      // Order 1: Nov 12, Châtain qty 1, delivered Nov 15 via DHD (wilaya Alger 16), fee 400 DA, total 3500
      {
        dbId: 1,
        id: "MS-2001",
        createdAt: "2026-11-12T11:00:00Z",
        customer: "Meriem",
        phone: "0550111111",
        productId: "p-ext",
        product: "Extension Cheveux",
        quantity: 1,
        total: 3500,
        wilaya: "Alger",
        commune: "Centre",
        address: "",
        note: "",
        color: "Châtain",
        delivery: "home",
        carrier: "ecotrack",
        status: "transferee",
        confirmedById: "staff-1",
        isDelivered: true,
        deliveredAt: "2026-11-15T14:00:00Z",
      },
      // Order 2: Nov 16, Châtain qty 2, upsell! Splits remaining 1 @ 500 + 1 @ 600 = 1100 DA, delivered Nov 17 via E-com (fee 500 DA), total 6200
      {
        dbId: 2,
        id: "MS-2002",
        createdAt: "2026-11-16T11:00:00Z",
        customer: "Kenza",
        phone: "0550222222",
        productId: "p-ext",
        product: "Extension Cheveux",
        quantity: 2,
        initialQuantity: 1,
        total: 6200,
        wilaya: "Oran",
        commune: "Oran",
        address: "",
        note: "",
        color: "Châtain",
        delivery: "home",
        carrier: "ecom",
        status: "transferee",
        confirmedById: "staff-1",
        upsellById: "staff-1",
        isDelivered: true,
        deliveredAt: "2026-11-17T14:00:00Z",
      },
      // Order 3: Nov 16, Blonde qty 1, variant lot = 800 DA, delivered Nov 17 via DHD stopdesk (fee 300 DA), total 3800
      {
        dbId: 3,
        id: "MS-2003",
        createdAt: "2026-11-16T12:00:00Z",
        customer: "Lina",
        phone: "0550333333",
        productId: "p-ext",
        product: "Extension Cheveux",
        quantity: 1,
        total: 3800,
        wilaya: "Alger",
        commune: "Centre",
        address: "",
        note: "",
        color: "Blonde",
        delivery: "office",
        carrier: "ecotrack",
        status: "transferee",
        confirmedById: "staff-1",
        isDelivered: true,
        deliveredAt: "2026-11-17T15:00:00Z",
      },
      // Order 4: Nov 16, returned on DHD -> 0 COGS, 0 Commission, 50 DA return fee + 40 DA packaging
      {
        dbId: 4,
        id: "MS-2004",
        createdAt: "2026-11-16T13:00:00Z",
        customer: "Nour",
        phone: "0550444444",
        productId: "p-ext",
        product: "Extension Cheveux",
        quantity: 1,
        total: 3500,
        wilaya: "Alger",
        commune: "Centre",
        address: "",
        note: "",
        color: "Châtain",
        delivery: "home",
        carrier: "ecotrack",
        status: "transferee",
        confirmedById: "staff-1",
        returnReceived: true,
        returnReceivedAt: "2026-11-18T10:00:00Z",
      },
      // Order 5: Nov 16, returned on E-com -> 0 COGS, 0 Commission, 0 DA return fee + 40 DA packaging
      {
        dbId: 5,
        id: "MS-2005",
        createdAt: "2026-11-16T14:00:00Z",
        customer: "Amira",
        phone: "0550555555",
        productId: "p-ext",
        product: "Extension Cheveux",
        quantity: 1,
        total: 3500,
        wilaya: "Oran",
        commune: "Oran",
        address: "",
        note: "",
        color: "Châtain",
        delivery: "home",
        carrier: "ecom",
        status: "transferee",
        confirmedById: "staff-1",
        returnReceived: true,
        returnReceivedAt: "2026-11-18T11:00:00Z",
      },
    ];

    const ecoRates = { "16": { domicile: 400, stopdesk: 300 } };
    const ecomRates = { "31": { domicile: 500, stopdesk: 350 } };

    // Cohort view across Nov 12 -> Nov 16 (5 days => 5 * 1000 = 5000 DA fixed rent)
    const report = computeFinanceDashboard({
      orders,
      catalog: TEST_CATALOG,
      staffMembers: TEST_STAFF,
      ecomShipments: {
        "MS-2002": { tracking: "ECM-2" },
        "MS-2005": { tracking: "ECM-5" },
      },
      ecoShipments: {
        "MS-2001": { tracking: "DHD-1" },
        "MS-2003": { tracking: "DHD-3" },
        "MS-2004": { tracking: "DHD-4" },
      },
      trackingMap: {
        "DHD-1": { situation: "Livré", encaisser: true, recouvert: true },
        "ECM-2": { situation: "Livré", encaisser: true, recouvert: false },
        "DHD-3": { situation: "Livré", encaisser: true, recouvert: false },
        "DHD-4": { situation: "retour_recu" },
        "ECM-5": { situation: "retour_recu" },
      },
      ecomRates,
      ecoRates,
      financeState: state,
      adConnectionsPublic: {
        meta: { configured: false, adAccountId: "", tokenPreview: "" },
        tiktok: { configured: false, advertiserId: "", tokenPreview: "" },
      },
      viewMode: "cohort",
      startDate: "2026-11-12",
      endDate: "2026-11-16",
    });

    // Exchange rates respected by date
    expect(getEffectiveExchangeRate("2026-11-12", "USD", state.exchangeRates, state.settings)).toBe(250);
    expect(getEffectiveExchangeRate("2026-11-16", "USD", state.exchangeRates, state.settings)).toBe(260);

    // Delivered revenue: 3500 + 6200 + 3800 = 13,500
    expect(report.kpis.grossRevenueDzd).toBe(13500);
    expect(report.kpis.deliveredOrders).toBe(3);
    expect(report.kpis.returnedOrders).toBe(2);

    // COGS: Order1(500) + Order2(500+600=1100) + Order3(Blonde=800) = 2400 (returns cost 0 COGS)
    expect(report.kpis.cogsDzd).toBe(2400);

    // Shipping fees: 400 + 500 + 300 = 1200; Return fees: DHD(50) + Ecom(0) = 50
    expect(report.kpis.shippingFeeDzd).toBe(1200);
    expect(report.kpis.returnFeeDzd).toBe(50);

    // Packaging per parcel: 5 shipped * 40 = 200
    expect(report.kpis.packagingPerParcelDzd).toBe(200);

    // Commissions (only delivered!): 200 + (200+50) + 200 = 650
    expect(report.kpis.commissionDzd).toBe(650);

    // Ad spend: 10*250 + 10*260 = 5100
    expect(report.kpis.adSpendDzd).toBe(5100);
    expect(report.kpis.tiktokSpendDzd).toBe(2500);
    expect(report.kpis.metaSpendDzd).toBe(2600);

    // Charges: Daily (400) + Fixed Nov 12..16 (5 days * 1000 = 5000)
    expect(report.kpis.dailyChargesDzd).toBe(400);
    expect(report.kpis.fixedChargesProratedDzd).toBe(5000);

    // Total costs: 2400 + 1200 + 50 + 200 + 650 + 5100 + 400 + 5000 = 15,000 -> Net = 13500 - 15000 = -1500
    expect(report.kpis.netProfitDzd).toBe(-1500);
    expect(report.kpis.status).toBe("deficit");

    // Cashflow recovery: MS-2001 recouvert (3500), MS-2002 & MS-2003 encaisser non-recouvert (10,000)
    expect(report.kpis.cashDeliveredRecoveredDzd).toBe(3500);
    expect(report.kpis.cashDeliveredUnrecoveredDzd).toBe(10000);

    // Lot health: lot-500 is empty (2 consumed), lot-600 has 4 remaining, lot-800-blonde has 2 remaining
    const lh500 = report.lotHealth.find(l => l.lot.id === "lot-500")!;
    const lh600 = report.lotHealth.find(l => l.lot.id === "lot-600")!;
    const lhBlonde = report.lotHealth.find(l => l.lot.id === "lot-800-blonde")!;
    expect(lh500.remainingQty).toBe(0);
    expect(lh600.remainingQty).toBe(4);
    expect(lhBlonde.remainingQty).toBe(2);

    // Variant Blonde kept its exact 800 DA lot + direct Meta ad spend (2600 DA) + 1/5 share of generic p-ext ad spend (500 DA) = 3100 DA
    const blondeVar = report.variants.find(v => v.variantKey === "Blonde")!;
    const chatainVar = report.variants.find(v => v.variantKey === "Châtain")!;
    expect(blondeVar.avgLotUnitCostDzd).toBe(800);
    expect(blondeVar.adSpendDzd).toBe(3100);
    expect(chatainVar.adSpendDzd).toBe(2000);

    // Cashflow lens on Nov 17 ONLY shows MS-2002 + MS-2003 delivered on Nov 17
    const cashflowNov17 = computeFinanceDashboard({
      orders,
      catalog: TEST_CATALOG,
      staffMembers: TEST_STAFF,
      ecomShipments: { "MS-2002": { tracking: "ECM-2" }, "MS-2005": { tracking: "ECM-5" } },
      ecoShipments: { "MS-2001": { tracking: "DHD-1" }, "MS-2003": { tracking: "DHD-3" }, "MS-2004": { tracking: "DHD-4" } },
      trackingMap: { "DHD-1": { situation: "Livré" }, "ECM-2": { situation: "Livré" }, "DHD-3": { situation: "Livré" } },
      ecomRates,
      ecoRates,
      financeState: state,
      adConnectionsPublic: {
        meta: { configured: false, adAccountId: "", tokenPreview: "" },
        tiktok: { configured: false, advertiserId: "", tokenPreview: "" },
      },
      viewMode: "cashflow",
      startDate: "2026-11-17",
      endDate: "2026-11-17",
    });
    expect(cashflowNov17.kpis.deliveredOrders).toBe(2);
    expect(cashflowNov17.kpis.grossRevenueDzd).toBe(10000);
  });

  it("imports Meta/TikTok CSV exports cleanly and denies confirmateurs from finance APIs", async () => {
    const csv = [
      "Reporting starts;Campaign name;Amount spent;Currency;Purchases",
      "2026-11-20;ABAYA_ROYAL_CONVERSION;18,50;USD;6",
      "2026-11-21;EXTENSION_CHATAIN;12.00;USD;4",
    ].join("\n");

    const imported = await importAdSpendCsv({
      platform: "meta",
      csvText: csv,
      defaultCurrency: "USD",
    });
    expect(imported.imported).toBe(2);
    expect(imported.totalSpendAmount).toBe(30.5);

    const callerStaff = appRouter.createCaller({
      user: {
        id: 2,
        openId: "staff:staff-1",
        name: "Sara",
        email: "staff-1",
        loginMethod: "staff_code",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: {} as any,
      res: {} as any,
    });

    await expect(callerStaff.finance.overview()).rejects.toThrow(/propriétaire/i);
  });
});
