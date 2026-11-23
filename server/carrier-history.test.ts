import { describe, expect, it } from "vitest";
import type { CheckoutOrder } from "../shared/checkout";
import {
  classifyOrderHistoryStage,
  computeTransferredHistoryAnalytics,
  inspectOrderCarrierHistory,
  matchesTransferredFilter,
  parseCarrierTimestamp,
  type OrderHistoryInspection,
} from "../shared/carrierHistory";

function makeOrder(id: string, total: number, createdAt = "2026-11-20T10:00:00.000Z"): CheckoutOrder {
  return {
    dbId: Number(id.replace(/\D/g, "")) || 1,
    id,
    createdAt,
    customer: `Client ${id}`,
    phone: "0550123456",
    productId: "p-007",
    product: "Abaya Royal Emerald × 1",
    quantity: 1,
    total,
    color: "Emerald",
    size: "M",
    delivery: "home",
    wilaya: "الجزائر",
    commune: "حيدرة",
    address: "حيدرة",
    note: "",
    status: "transferee",
  };
}

describe("carrier history stages & indicators", () => {
  it("parses ISO, SQL space timestamps, and DD/MM/YYYY carrier dates", () => {
    expect(parseCarrierTimestamp("2026-11-21T14:30:00.000Z")).not.toBeNull();
    expect(parseCarrierTimestamp("2026-11-21 14:30:00")).not.toBeNull();
    expect(parseCarrierTimestamp("21/11/2026 09:15")).not.toBeNull();
    expect(parseCarrierTimestamp("")).toBeNull();
  });

  it("classifies pre-delivery stages (prep, transit, out_for_delivery) from tracking & historique", () => {
    expect(classifyOrderHistoryStage(null)).toBe("prep");
    expect(
      classifyOrderHistoryStage({
        situation: "En préparation",
        historique: [{ date: "2026-11-22 10:00:00", situation: "Prêt à expédier" }],
      })
    ).toBe("prep");
    expect(
      classifyOrderHistoryStage({
        situation: "En transit vers Wilaya",
        historique: [
          { date: "2026-11-21 10:00:00", situation: "Expédié" },
          { date: "2026-11-22 08:00:00", situation: "Au Hub Blida" },
        ],
      })
    ).toBe("transit");
    expect(
      classifyOrderHistoryStage({
        situation: "En cours de livraison",
        historique: [
          { date: "2026-11-21 10:00:00", situation: "Expédié" },
          { date: "2026-11-23 09:00:00", situation: "Sorti en livraison" },
        ],
      })
    ).toBe("out_for_delivery");
  });

  it("computes history-based metrics (stalled >48h, multi-attempts, cashed vs uncollected, avg delivery duration)", () => {
    const nowMs = Date.parse("2026-11-23T18:00:00.000Z");

    const orders = [
      makeOrder("MS-1", 4000, "2026-11-20T10:00:00.000Z"), // Delivered & cashed (48h transit)
      makeOrder("MS-2", 3500, "2026-11-20T10:00:00.000Z"), // Delivered but non encaissée
      makeOrder("MS-3", 2500, "2026-11-19T08:00:00.000Z"), // Stalled >48h + 2 attempts NRP
      makeOrder("MS-4", 5000, "2026-11-23T08:00:00.000Z"), // Out for delivery (active, recent)
      makeOrder("MS-5", 3000, "2026-11-21T08:00:00.000Z"), // Returned
    ];

    const inspections = new Map<string, OrderHistoryInspection>();
    inspections.set(
      "MS-1",
      inspectOrderCarrierHistory(
        orders[0],
        {
          situation: "Livrée & Encaissée",
          encaisser: true,
          recouvert: true,
          historique: [
            { date: "2026-11-20T10:00:00.000Z", situation: "Expédié" },
            { date: "2026-11-22T10:00:00.000Z", situation: "Livrée" },
          ],
        },
        null,
        nowMs
      )
    );
    inspections.set(
      "MS-2",
      inspectOrderCarrierHistory(
        orders[1],
        {
          situation: "Livrée (Non encaissée)",
          encaisser: false,
          recouvert: false,
          historique: [
            { date: "2026-11-21T10:00:00.000Z", situation: "En livraison" },
            { date: "2026-11-22T10:00:00.000Z", situation: "Livrée" },
          ],
        },
        null,
        nowMs
      )
    );
    inspections.set(
      "MS-3",
      inspectOrderCarrierHistory(
        orders[2],
        {
          situation: "Ne répond pas",
          historique: [
            { date: "2026-11-19T09:00:00.000Z", situation: "Expédié" },
            { date: "2026-11-20T11:00:00.000Z", situation: "Tentative échouée", commentaire: "Ne répond pas" },
            { date: "2026-11-21T10:00:00.000Z", situation: "Ne répond pas", commentaire: "Injoignable" },
          ],
        },
        null,
        nowMs
      )
    );
    inspections.set(
      "MS-4",
      inspectOrderCarrierHistory(
        orders[3],
        {
          situation: "En cours de livraison",
          historique: [
            { date: "2026-11-23T09:00:00.000Z", situation: "Sorti en livraison" },
          ],
        },
        null,
        nowMs
      )
    );
    inspections.set(
      "MS-5",
      inspectOrderCarrierHistory(
        orders[4],
        {
          situation: "Retour reçu",
          historique: [
            { date: "2026-11-21T09:00:00.000Z", situation: "Tentative échouée" },
            { date: "2026-11-22T16:00:00.000Z", situation: "Retour reçu" },
          ],
        },
        null,
        nowMs
      )
    );

    const summary = computeTransferredHistoryAnalytics(orders, inspections);
    expect(summary.totalCount).toBe(5);
    expect(summary.totalCodAmount).toBe(18000);
    expect(summary.deliveredCount).toBe(2);
    expect(summary.deliveredAmount).toBe(7500);
    expect(summary.cashedCount).toBe(1);
    expect(summary.cashedAmount).toBe(4000);
    expect(summary.uncollectedDeliveredCount).toBe(1);
    expect(summary.uncollectedDeliveredAmount).toBe(3500);
    expect(summary.recoveredCount).toBe(1);
    expect(summary.returnedCount).toBe(1);
    expect(summary.activeCount).toBe(2);
    expect(summary.stalled48hCount).toBe(1);
    expect(summary.multiAttemptsCount).toBe(1);
    expect(summary.totalScans).toBe(10);
    expect(summary.avgDeliveryHours).toBe(36); // (48h + 24h) / 2 = 36h

    expect(matchesTransferredFilter("stalled_48h", inspections.get("MS-3")!)).toBe(true);
    expect(matchesTransferredFilter("multi_attempts", inspections.get("MS-3")!)).toBe(true);
    expect(matchesTransferredFilter("delivered_uncollected", inspections.get("MS-2")!)).toBe(true);
    expect(matchesTransferredFilter("delivered_cashed", inspections.get("MS-1")!)).toBe(true);
    expect(matchesTransferredFilter("out_for_delivery", inspections.get("MS-4")!)).toBe(true);
  });
});
