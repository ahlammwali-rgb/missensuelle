import { describe, expect, it } from "vitest";
import {
  classifyCarrierTracking,
  isCarrierStatusTextDelivered,
  isCarrierStatusTextReturned,
  isCarrierTrackingDelivered,
  isCarrierTrackingReturned,
  parseCarrierBoolean,
  type CarrierTrackingSummary,
} from "../shared/carrierStatus";
import { reconcileCarrierBatchOrders, wasOrderAutoDelivered } from "./carrierSync";
import { markOrderDelivered, submitCheckoutOrder, updateMemoryOrderStatus, listCheckoutOrders } from "./checkout";
import { buildEcoTrackingItem, getEcoTrackLocations, getEcoTrackTrackingBatch } from "./ecotrackDelivery";
import {
  clearSentVictoryTag,
  hasSentVictoryTag,
  markSentVictoryTag,
  normalizeOrderDeliveryHistory,
} from "./persistentStore";
import { sendAdminPushNotification } from "./webPush";
import { buildAdminNotifications } from "@/components/AdminNotificationCenter";

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

  it("locks deliveredNotified and prevents duplicate delivered history/reverts on ambiguous carrier payloads", async () => {
    const created = await submitCheckoutOrder({
      token: "880e8400-e29b-41d4-a716-446655440099",
      payload: {
        source: "abaya",
        customer: "Nour Test Notif",
        phone: "0550998877",
        wilaya: "الجزائر",
        commune: "باب الزوار",
        address: "الجزائر",
        note: "",
        delivery: "home",
        items: [{ productId: "p-007", quantity: 1, color: "Emerald", size: "M" }],
      },
    });

    await updateMemoryOrderStatus(created.orderId, "transferee", {
      actorId: "admin",
      actorName: "Admin",
    });

    // Mark delivered via markOrderDelivered
    await markOrderDelivered(created.orderId, true, {
      actorId: "system",
      actorName: "DHD / EcoTrack (Auto)",
    });

    // Toggle false then true, plus call updateMemoryOrderStatus("livre") — history & lock must never duplicate
    await markOrderDelivered(created.orderId, false);
    await markOrderDelivered(created.orderId, true, {
      actorId: "system",
      actorName: "DHD / EcoTrack (Auto)",
    });
    await updateMemoryOrderStatus(created.orderId, "livre", {
      actorId: "admin",
      actorName: "Admin",
    });

    // Ambiguous carrier response must NOT revert auto-delivered status back to false
    const currentOrders = await listCheckoutOrders();
    const target = currentOrders.filter(o => o.id === created.orderNumber);
    const recon = await reconcileCarrierBatchOrders({
      carrier: "ecotrack",
      orders: target,
      shipments: {
        [created.orderNumber]: { tracking: "DHD_AMBIGUOUS_1" },
      },
      trackingMap: {
        DHD_AMBIGUOUS_1: {
          situation: "En suivi",
          encaisser: false,
          recouvert: false,
        },
      },
      db: null,
    });
    expect(recon.revertedCount).toBe(0);

    const after = (await listCheckoutOrders()).find(o => o.id === created.orderNumber)!;
    expect(after.isDelivered).toBe(true);
    expect(after.deliveredNotified).toBe(true);
    expect(hasSentVictoryTag(`victory-${created.orderNumber}`)).toBe(true);
    expect((after.history ?? []).filter(h => h.type === "delivered")).toHaveLength(1);

    const dupPush = await sendAdminPushNotification({
      title: "🎉 COLIS LIVRÉ",
      body: `Test doublon ${created.orderNumber}`,
      tag: `victory-${created.orderNumber}`,
      type: "victory",
    });
    expect(dupPush.skippedDuplicate).toBe(true);

    const customTag = `victory-IMAN-LOOP-${Date.now()}`;
    expect(hasSentVictoryTag(customTag)).toBe(false);
    const first = await sendAdminPushNotification({
      title: "🎉 COLIS LIVRÉ : إيمان",
      body: "Test première notification",
      tag: customTag,
      type: "victory",
    });
    expect(first.skippedDuplicate).toBeUndefined();
    expect(hasSentVictoryTag(customTag)).toBe(true);

    const second = await sendAdminPushNotification({
      title: "🎉 COLIS LIVRÉ : إيمان",
      body: "Test boucle",
      tag: customTag,
      type: "victory",
    });
    expect(second.skippedDuplicate).toBe(true);
    markSentVictoryTag(customTag);
  });

  it("scans intermediate EcoTrack pages and enriches >60 empty-history parcels without truncation", async () => {
    const prevUrl = process.env.ECOTRACK_BASE_URL;
    const prevTok = process.env.ECOTRACK_API_TOKEN;
    const prevFetch = globalThis.fetch;

    const allTrackings = Array.from({ length: 65 }, (_, i) => `DHD-BATCH-${i + 1}`);
    const page10Target = "DHD-BATCH-65";
    const trackingInfoCalls = new Set<string>();

    process.env.ECOTRACK_BASE_URL = "https://mock.dhd-dz.example";
    process.env.ECOTRACK_API_TOKEN = "test-token";

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/v1/get/orders") {
        const page = Number(url.searchParams.get("page") || "1");
        let data: Array<Record<string, unknown>> = [];
        if (page === 1) {
          data = allTrackings.slice(0, 64).map(trk => ({
            tracking: trk,
            status: "en_livraison",
            livreur: "Ali",
          }));
        } else if (page === 10) {
          data = [{ tracking: page10Target, status: "livré_non_encaissé", livreur: "Karim" }];
        } else {
          data = [{ tracking: `DHD-OTHER-P${page}`, status: "en_preparation" }];
        }
        return new Response(
          JSON.stringify({
            current_page: page,
            last_page: 20,
            next_page_url: page < 20 ? `https://mock.dhd-dz.example/api/v1/get/orders?page=${page + 1}` : null,
            data,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.pathname === "/api/v1/get/tracking/info") {
        const trk = String(url.searchParams.get("tracking") || "");
        trackingInfoCalls.add(trk);
        return new Response(
          JSON.stringify({
            tracking: trk,
            status: trk === page10Target ? "livré_non_encaissé" : "en_livraison",
            activity: [{ date: "2026-11-24 10:00", status: "Sortir en livraison", wilaya: "Alger" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    try {
      const res = await getEcoTrackTrackingBatch(allTrackings, { forceRefresh: true });
      expect(res[page10Target]).toBeDefined();
      expect(isCarrierTrackingDelivered(res[page10Target])).toBe(true);
      expect(Object.keys(res)).toHaveLength(65);
      expect(trackingInfoCalls.size).toBe(65);
    } finally {
      globalThis.fetch = prevFetch;
      if (prevUrl === undefined) delete process.env.ECOTRACK_BASE_URL;
      else process.env.ECOTRACK_BASE_URL = prevUrl;
      if (prevTok === undefined) delete process.env.ECOTRACK_API_TOKEN;
      else process.env.ECOTRACK_API_TOKEN = prevTok;
    }
  });

  it("never misclassifies attempt_delivery or driver/livraison reasons as livree", () => {
    const samples = [
      buildEcoTrackingItem("DHD-ATTEMPT-1", {
        tracking: "DHD-ATTEMPT-1",
        status: "attempt_delivery",
        activity: [{ status: "attempt_delivery", reason: "Tentative de livraison" }],
      }),
      buildEcoTrackingItem("DHD-ATTEMPT-2", {
        tracking: "DHD-ATTEMPT-2",
        status: "tentative_echouee",
        activity: [{ status: "tentative_echouee", reason: "Livreur injoignable pour livraison" }],
      }),
      buildEcoTrackingItem("DHD-ATTEMPT-3", {
        tracking: "DHD-ATTEMPT-3",
        status: "en_suivi",
        activity: [{ status: "attempt_delivery", details: "Repasser livraison demain" }],
      }),
      buildEcoTrackingItem("DHD-DRIVER-4", {
        tracking: "DHD-DRIVER-4",
        status: "en_livraison",
        activity: [{ status: "", details: "Livreur : Karim 0550112233" }],
      }),
    ];

    for (const item of samples) {
      expect(isCarrierTrackingDelivered(item)).toBe(false);
    }
  });

  it("unlocks victory notification tags on carrier auto-revert so genuine delivery notifies later, and heals legacy revert logs", async () => {
    const created = await submitCheckoutOrder({
      token: "880e8400-e29b-41d4-a716-446655440123",
      payload: {
        source: "abaya",
        customer: "Imane Reverted Push",
        phone: "0551223344",
        wilaya: "Alger",
        commune: "Hydra",
        address: "Hydra",
        note: "",
        delivery: "home",
        items: [{ productId: "p-007", quantity: 1, color: "Noir", size: "M" }],
      },
    });

    await updateMemoryOrderStatus(created.orderId, "transferee", {
      actorId: "admin",
      actorName: "Admin",
    });

    const trk = "DHD-REVERT-UNLOCK-1";
    const getOrder = async () =>
      (await listCheckoutOrders()).find(o => o.id === created.orderNumber)!;

    // 1. Initial auto-delivery locks victory tag
    const firstSync = await reconcileCarrierBatchOrders({
      carrier: "ecotrack",
      orders: [await getOrder()],
      shipments: { [created.orderNumber]: { tracking: trk } },
      trackingMap: { [trk]: { situation: "livré_non_encaissé", encaisser: false } },
      db: null,
    });
    expect(firstSync.syncedCount).toBe(1);
    expect(hasSentVictoryTag(`victory-${created.orderNumber}`)).toBe(true);

    // 2. Carrier reverts to En cours de livraison -> must unlock victory tag & log as status_change (not delivered)
    const revertSync = await reconcileCarrierBatchOrders({
      carrier: "ecotrack",
      orders: [await getOrder()],
      shipments: { [created.orderNumber]: { tracking: trk } },
      trackingMap: { [trk]: { situation: "En cours de livraison", encaisser: false } },
      db: null,
    });
    expect(revertSync.revertedCount).toBe(1);

    const afterRevert = await getOrder();
    expect(afterRevert.isDelivered).toBe(false);
    expect(afterRevert.deliveredNotified).toBe(false);
    expect(hasSentVictoryTag(`victory-${created.orderNumber}`)).toBe(false);
    const latestEvt = afterRevert.history?.[0];
    expect(latestEvt?.type).toBe("status_change");
    expect(latestEvt?.meta?.statusFrom).toBe("livree");

    // 3. Genuine final delivery must be allowed to notify again (tag re-locked cleanly)
    const finalSync = await reconcileCarrierBatchOrders({
      carrier: "ecotrack",
      orders: [afterRevert],
      shipments: { [created.orderNumber]: { tracking: trk } },
      trackingMap: { [trk]: { situation: "Livrée & Encaissée", encaisser: true } },
      db: null,
    });
    expect(finalSync.syncedCount).toBe(1);
    const afterFinal = await getOrder();
    expect(afterFinal.isDelivered).toBe(true);
    expect(afterFinal.deliveredNotified).toBe(true);
    expect(hasSentVictoryTag(`victory-${created.orderNumber}`)).toBe(true);
    expect(afterFinal.history?.[0]?.type).toBe("delivered");
    expect((afterFinal.history ?? []).filter(h => h.type === "delivered")).toHaveLength(2);

    // 4. Legacy store healing: legacy revert stored as type="delivered" unlocks !isDelivered orders
    const legacyTag = "victory-MS-LEGACY-REVERT";
    markSentVictoryTag(legacyTag);
    const legacyOrder = {
      ...afterRevert,
      id: "MS-LEGACY-REVERT",
      isDelivered: false,
      deliveredNotified: true,
      history: [
        {
          id: "evt-1",
          at: new Date().toISOString(),
          type: "delivered" as const,
          actorId: "system",
          actorName: "DHD / EcoTrack (Auto)",
          summary: "🎉 Colis Livré et encaissé",
        },
        {
          id: "evt-2",
          at: new Date().toISOString(),
          type: "delivered" as const,
          actorId: "system",
          actorName: "DHD / EcoTrack (Correction Auto)",
          summary: "↩️ Statut Livré corrigé automatiquement (statut transporteur non livré)",
        },
      ],
    };
    const healed = normalizeOrderDeliveryHistory(legacyOrder);
    expect(healed).toBe(true);
    expect(legacyOrder.deliveredNotified).toBe(false);
    expect(hasSentVictoryTag(legacyTag)).toBe(false);
    expect(legacyOrder.history[1]?.type).toBe("status_change");
    clearSentVictoryTag(legacyTag);
  });

  it("never shows revert logs as Livré/victory in notification bell", () => {
    const nowIso = new Date().toISOString();
    const order = {
      dbId: 9001,
      id: "MS-BELL-REVERT-1",
      createdAt: nowIso,
      customer: "Sarah Test",
      phone: "0550001122",
      product: "Abaya Test",
      quantity: 1,
      total: 4500,
      wilaya: "Alger",
      commune: "Hydra",
      address: "Hydra",
      note: "",
      delivery: "home" as const,
      carrier: "ecotrack" as const,
      status: "transferee" as const,
      isDelivered: false,
    };

    const notifs = buildAdminNotifications(
      [order],
      [
        {
          id: "log-false-deliv",
          at: nowIso,
          actorId: "system",
          actorName: "DHD / EcoTrack (Auto)",
          orderDbId: 9001,
          orderId: "MS-BELL-REVERT-1",
          type: "delivered",
          summary: "🎉 Colis Livré et encaissé (4 500 DA)",
        },
        {
          id: "log-legacy-revert",
          at: nowIso,
          actorId: "system",
          actorName: "DHD / EcoTrack (Correction Auto)",
          orderDbId: 9001,
          orderId: "MS-BELL-REVERT-1",
          type: "delivered",
          summary: "↩️ Statut Livré corrigé automatiquement (statut transporteur non livré)",
        },
      ],
      [
        {
          id: "victory-MS-BELL-REVERT-1",
          kind: "victory",
          title: "🎉 COLIS LIVRÉ : Succès !",
          body: "Stale push",
          timestamp: nowIso,
          tsMs: Date.now(),
          orderId: "MS-BELL-REVERT-1",
          targetSection: "transferred",
          statusLabel: "Livré",
        },
      ]
    );

    expect(notifs.some(n => n.kind === "victory")).toBe(false);
    expect(notifs.some(n => n.title.startsWith("Livré ·"))).toBe(false);
    const revertNotif = notifs.find(n => n.id === "log:log-legacy-revert");
    expect(revertNotif).toBeDefined();
    expect(revertNotif?.kind).toBe("transferred");
    expect(revertNotif?.statusLabel).toContain("Non livré");
  });

  it("coerces PHP/SQL false flags and zero-dates cleanly without false Livré flips", () => {
    expect(parseCarrierBoolean("0")).toBe(false);
    expect(parseCarrierBoolean("false")).toBe(false);
    expect(parseCarrierBoolean("non")).toBe(false);
    expect(parseCarrierBoolean("null")).toBe(false);
    expect(parseCarrierBoolean("0000-00-00 00:00:00")).toBe(false);
    expect(parseCarrierBoolean(0)).toBe(false);
    expect(parseCarrierBoolean(false)).toBe(false);
    expect(parseCarrierBoolean("1")).toBe(true);
    expect(parseCarrierBoolean("true")).toBe(true);
    expect(parseCarrierBoolean("oui")).toBe(true);
    expect(parseCarrierBoolean(true)).toBe(true);

    // Hyphenated negations, future intents & internal hub/agency handoffs must NEVER trigger Livré
    expect(isCarrierStatusTextDelivered("non-livré")).toBe(false);
    expect(isCarrierStatusTextDelivered("non-payé")).toBe(false);
    expect(isCarrierStatusTextDelivered("pas encore livré")).toBe(false);
    expect(isCarrierStatusTextDelivered("reste à payer")).toBe(false);
    expect(isCarrierStatusTextDelivered("livré au hub")).toBe(false);
    expect(isCarrierStatusTextDelivered("livré station")).toBe(false);
    expect(isCarrierStatusTextDelivered("livré à l'agence")).toBe(false);
    expect(isCarrierStatusTextDelivered("livré au livreur")).toBe(false);
    expect(isCarrierStatusTextDelivered("livré bureau")).toBe(false);

    // Genuine delivered/cash strings stay preserved
    expect(isCarrierStatusTextDelivered("livré_non_encaissé")).toBe(true);
    expect(isCarrierStatusTextDelivered("encaissé_non_payé")).toBe(true);
    expect(isCarrierStatusTextDelivered("Livré au client")).toBe(true);

    // Stringified PHP flags ("0", "false") and zero-dates must NOT become isDelivered=true
    expect(
      isCarrierTrackingDelivered({
        situation: "En transit",
        etat_logistique: "vers_wilaya",
        encaisser: "0" as unknown as boolean,
        recouvert: "false" as unknown as boolean,
      })
    ).toBe(false);

    const itemZeroDate = buildEcoTrackingItem("DHD-ZERO-DATE-1", {
      tracking: "DHD-ZERO-DATE-1",
      status: "vers_wilaya",
      livred_at: "0000-00-00 00:00:00",
      delivered_at: "null",
      encaisser: "0" as unknown as boolean,
    });
    expect(itemZeroDate.encaisser).toBe(false);
    expect(itemZeroDate.recouvert).toBe(false);
    expect(isCarrierTrackingDelivered(itemZeroDate)).toBe(false);
  });

  it("deduplicates concurrent EcoTrack location fetches, retries HTTP 429, and avoids background tracking-info floods", async () => {
    const prevUrl = process.env.ECOTRACK_BASE_URL;
    const prevTok = process.env.ECOTRACK_API_TOKEN;
    const prevFetch = globalThis.fetch;

    process.env.ECOTRACK_BASE_URL = "https://mock.dhd-dz.example";
    process.env.ECOTRACK_API_TOKEN = "test-token";

    const counts: Record<string, number> = {
      wilayas: 0,
      communes: 0,
      desks: 0,
      orders: 0,
      trackingInfo: 0,
    };
    let simulateFirst429 = true;

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/v1/get/wilayas") {
        counts.wilayas++;
        if (simulateFirst429) {
          simulateFirst429 = false;
          return new Response(JSON.stringify({ message: "Too Many Requests" }), {
            status: 429,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify([{ wilaya_id: 16, wilaya_name: "Alger" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.pathname === "/api/v1/get/communes") {
        counts.communes++;
        return new Response(
          JSON.stringify([{ wilaya_id: 16, nom: "Hydra", is_active: 1 }]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.pathname === "/api/v1/get/desks") {
        counts.desks++;
        return new Response(
          JSON.stringify({ my_desk: { commune: "Bir Mourad Rais", hub_name: "Stop Desk Alger" }, other_desks: [] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.pathname === "/api/v1/get/orders") {
        counts.orders++;
        return new Response(
          JSON.stringify({
            current_page: 1,
            last_page: 1,
            next_page_url: null,
            data: [
              { tracking: "DHD-BG-NOFLOOD-1", status: "en_preparation" },
              { tracking: "DHD-BG-NOFLOOD-2", status: "en_hub" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.pathname === "/api/v1/get/tracking/info") {
        counts.trackingInfo++;
        return new Response(JSON.stringify({ status: "en_preparation", activity: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    try {
      // 10 simultaneous location queries must share 1 wilayas (with 429 retry), 1 communes, 1 desks call
      const locResults = await Promise.all(
        Array.from({ length: 10 }, () => getEcoTrackLocations(16))
      );
      expect(locResults).toHaveLength(10);
      expect(locResults[0].communes).toContain("Hydra");
      expect(counts.wilayas).toBe(2); // 1 initial 429 + 1 successful retry, shared across all 10 callers
      expect(counts.communes).toBe(1);
      expect(counts.desks).toBe(1);

      // Background poll (forceRefresh: false) must NOT blast /api/v1/get/tracking/info for parcels already returned by /get/orders
      const bgBatch = await getEcoTrackTrackingBatch(
        ["DHD-BG-NOFLOOD-1", "DHD-BG-NOFLOOD-2"],
        { forceRefresh: false }
      );
      expect(Object.keys(bgBatch)).toEqual(["DHD-BG-NOFLOOD-1", "DHD-BG-NOFLOOD-2"]);
      expect(counts.trackingInfo).toBe(0);
    } finally {
      globalThis.fetch = prevFetch;
      if (prevUrl === undefined) delete process.env.ECOTRACK_BASE_URL;
      else process.env.ECOTRACK_BASE_URL = prevUrl;
      if (prevTok === undefined) delete process.env.ECOTRACK_API_TOKEN;
      else process.env.ECOTRACK_API_TOKEN = prevTok;
    }
  });
});
