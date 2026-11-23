import { describe, expect, it } from "vitest";
import {
  classifyCarrierTracking,
  isCarrierStatusTextDelivered,
  isCarrierStatusTextReturned,
  isCarrierTrackingDelivered,
  isCarrierTrackingReturned,
  type CarrierTrackingSummary,
} from "../shared/carrierStatus";
import { reconcileCarrierBatchOrders, wasOrderAutoDelivered } from "./carrierSync";
import { markOrderDelivered, submitCheckoutOrder, updateMemoryOrderStatus, listCheckoutOrders } from "./checkout";
import { buildEcoTrackingItem } from "./ecotrackDelivery";

describe("strict carrier status detection", () => {
  it("recognizes genuine delivered / collected DHD & E-com statuses", () => {
    expect(isCarrierStatusTextDelivered("livré_non_encaissé")).toBe(true);
    expect(isCarrierStatusTextDelivered("Livré (Non encaissé)")).toBe(true);
    expect(isCarrierStatusTextDelivered("encaissé_non_payé")).toBe(true);
    expect(isCarrierStatusTextDelivered("encaissé_payé")).toBe(true);
    expect(isCarrierStatusTextDelivered("Colis livré au client")).toBe(true);
    expect(isCarrierStatusTextDelivered("Livré payé")).toBe(true);
    expect(isCarrierStatusTextDelivered("delivered")).toBe(true);
  });

  it("rejects in-transit / driver / return / postponed / cancelled statuses containing 'livr'", () => {
    expect(isCarrierStatusTextDelivered("en_livraison")).toBe(false);
    expect(isCarrierStatusTextDelivered("En livraison")).toBe(false);
    expect(isCarrierStatusTextDelivered("Sortir en livraison")).toBe(false);
    expect(isCarrierStatusTextDelivered("retour_chez_livreur")).toBe(false);
    expect(isCarrierStatusTextDelivered("Retour chez livreur")).toBe(false);
    expect(isCarrierStatusTextDelivered("Tentative de livraison")).toBe(false);
    expect(isCarrierStatusTextDelivered("Livreur : Mohamed")).toBe(false);
    expect(isCarrierStatusTextDelivered("non livré")).toBe(false);
    expect(isCarrierStatusTextDelivered("non_encaisse")).toBe(false);
  });

  it("ignores driver phone/name notes in historique when current status is en_livraison", () => {
    const trk: CarrierTrackingSummary = {
      situation: "En livraison",
      driver: "Livreur : Karim 0550112233",
      encaisser: false,
      recouvert: false,
      historique: [
        { date: "2026-11-20", statut: "Sortir en livraison", note: "Livreur : Karim" },
        { date: "2026-11-21", statut: "Livreur assigné", note: "En cours de livraison" },
      ],
    };
    expect(isCarrierTrackingDelivered(trk)).toBe(false);
    expect(classifyCarrierTracking(trk)).toBe("in_transit");
  });

  it("recognizes returned parcels strictly across DHD and E-com", () => {
    expect(isCarrierStatusTextReturned("retour_chez_livreur")).toBe(true);
    expect(isCarrierStatusTextReturned("retour_recu")).toBe(true);
    expect(isCarrierStatusTextReturned("retour_en_traitement")).toBe(true);
    expect(isCarrierStatusTextReturned("Retour vendeur")).toBe(true);
    expect(isCarrierTrackingReturned({ situation: "retour_recu", encaisser: false })).toBe(true);
    expect(classifyCarrierTracking({ situation: "retour_recu", encaisser: false })).toBe("returned");
  });

  it("classifies both livré non encaissé and encaissé_non_payé as delivered", () => {
    expect(
      classifyCarrierTracking({ situation: "livré_non_encaissé", encaisser: false, recouvert: false })
    ).toBe("delivered");
    expect(
      classifyCarrierTracking({ situation: "encaissé_non_payé", encaisser: true, recouvert: false })
    ).toBe("delivered");
  });

  it("maps raw DHD payload with activity fallback cleanly via buildEcoTrackingItem", () => {
    const deliveredFromRoot = buildEcoTrackingItem("DHDVFUR26111922379039", {
      tracking: "DHDVFUR26111922379039",
      status: "livré_non_encaissé",
      livreur: "Ali",
    });
    expect(deliveredFromRoot.tracking).toBe("DHDVFUR26111922379039");
    expect(isCarrierTrackingDelivered(deliveredFromRoot)).toBe(true);
    expect(deliveredFromRoot.encaisser).toBe(false);

    const paidFromActivity = buildEcoTrackingItem("DHDVFUR26111922379033", {
      tracking: "DHDVFUR26111922379033",
      activity: [
        { status: "dispatched_to_driver", driver: "Livreur Test" },
        { status: "encaissé_non_payé", date: "2026-11-22" },
      ],
    });
    expect(isCarrierTrackingDelivered(paidFromActivity)).toBe(true);
    expect(paidFromActivity.encaisser).toBe(true);

    const inDelivery = buildEcoTrackingItem("DHDTEST123", {
      tracking: "DHDTEST123",
      activity: [{ status: "dispatched_to_driver", driver: "Livreur Amine" }],
    });
    expect(isCarrierTrackingDelivered(inDelivery)).toBe(false);
  });
});

describe("bidirectional carrier delivery reconciliation", () => {
  it("reconciles missing delivered DHD parcels (even if locally annulee) while reverting auto false positives and keeping Patron markings", async () => {
    const basePayload = {
      source: "abaya" as const,
      customer: "Test Client",
      wilaya: "Alger",
      commune: "Centre",
      address: "Rue 1",
      note: "",
      delivery: "home" as const,
      items: [{ productId: "p-007", quantity: 1, color: "Noir", size: "M" }],
    };

    const oDeliveredButAnnulee = await submitCheckoutOrder({
      token: "880e8400-e29b-41d4-a716-446655440001",
      payload: { ...basePayload, phone: "0550100001", customer: "DHD Collé Annulé" },
    });
    const oFalseAutoDelivered = await submitCheckoutOrder({
      token: "880e8400-e29b-41d4-a716-446655440002",
      payload: { ...basePayload, phone: "0550100002", customer: "Faux Positif Auto" },
    });
    const oManualPatron = await submitCheckoutOrder({
      token: "880e8400-e29b-41d4-a716-446655440003",
      payload: { ...basePayload, phone: "0550100003", customer: "Confirmé Patron" },
    });
    const oCrossCarrierAuto = await submitCheckoutOrder({
      token: "880e8400-e29b-41d4-a716-446655440004",
      payload: { ...basePayload, phone: "0550100004", customer: "Ecom Auto Intouché" },
    });

    await updateMemoryOrderStatus(oDeliveredButAnnulee.orderId, "annulee", {
      actorId: "staff-1",
      actorName: "Sarah",
    });

    await updateMemoryOrderStatus(oFalseAutoDelivered.orderId, "transferee", {
      actorId: "admin",
      actorName: "Admin",
    });
    await markOrderDelivered(oFalseAutoDelivered.orderId, true, {
      actorId: "system",
      actorName: "DHD / EcoTrack (Auto)",
    });

    await updateMemoryOrderStatus(oManualPatron.orderId, "transferee", {
      actorId: "admin",
      actorName: "Admin",
    });
    await markOrderDelivered(oManualPatron.orderId, true, {
      actorId: "admin-1",
      actorName: "Admin (Patron)",
    });

    await updateMemoryOrderStatus(oCrossCarrierAuto.orderId, "transferee", {
      actorId: "admin",
      actorName: "Admin",
    });
    await markOrderDelivered(oCrossCarrierAuto.orderId, true, {
      actorId: "system",
      actorName: "E-com Delivery (Auto)",
    });

    const orders = await listCheckoutOrders();
    const targetOrders = orders.filter(o =>
      [
        oDeliveredButAnnulee.orderNumber,
        oFalseAutoDelivered.orderNumber,
        oManualPatron.orderNumber,
        oCrossCarrierAuto.orderNumber,
      ].includes(o.id)
    );

    const manualOrder = targetOrders.find(o => o.id === oManualPatron.orderNumber)!;
    expect(wasOrderAutoDelivered(manualOrder, "ecotrack")).toBe(false);

    const crossOrder = targetOrders.find(o => o.id === oCrossCarrierAuto.orderNumber)!;
    expect(wasOrderAutoDelivered(crossOrder, "ecotrack")).toBe(false);

    const result = await reconcileCarrierBatchOrders({
      carrier: "ecotrack",
      orders: targetOrders,
      shipments: {
        [oDeliveredButAnnulee.orderNumber]: { tracking: "DHD_TRK_DELIVERED" },
        [oFalseAutoDelivered.orderNumber]: { tracking: "DHD_TRK_IN_TRANSIT" },
        [oManualPatron.orderNumber]: { tracking: "DHD_TRK_IN_TRANSIT" },
        [oCrossCarrierAuto.orderNumber]: { tracking: "DHD_TRK_IN_TRANSIT" },
      },
      trackingMap: {
        DHD_TRK_DELIVERED: {
          situation: "encaissé_non_payé",
          encaisser: true,
          recouvert: false,
        },
        DHD_TRK_IN_TRANSIT: {
          situation: "En livraison",
          driver: "Livreur Ali",
          encaisser: false,
          recouvert: false,
        },
      },
      db: null,
    });

    expect(result.syncedCount).toBe(1);
    expect(result.revertedCount).toBe(1);

    const refreshed = await listCheckoutOrders();
    const afterDelivered = refreshed.find(o => o.id === oDeliveredButAnnulee.orderNumber)!;
    expect(afterDelivered.isDelivered).toBe(true);
    expect(afterDelivered.status).toBe("transferee");

    const afterFalse = refreshed.find(o => o.id === oFalseAutoDelivered.orderNumber)!;
    expect(afterFalse.isDelivered).toBe(false);

    const afterManual = refreshed.find(o => o.id === oManualPatron.orderNumber)!;
    expect(afterManual.isDelivered).toBe(true);

    const afterCross = refreshed.find(o => o.id === oCrossCarrierAuto.orderNumber)!;
    expect(afterCross.isDelivered).toBe(true);
  });
});
