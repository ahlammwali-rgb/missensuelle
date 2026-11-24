import { isCarrierTrackingDelivered, type CarrierTrackingSummary } from "../shared/carrierStatus";
import type { CheckoutOrder } from "../shared/checkout";
import {
  listCheckoutOrders,
  markOrderDelivered,
  restoreTransferredStatusFromCarrier,
} from "./checkout";
import { getDb, updateStoreOrderStatus } from "./db";
import { getEcomStatus, getEcomTrackingBatch } from "./ecomDelivery";
import { getEcoTrackStatus, getEcoTrackTrackingBatch } from "./ecotrackDelivery";

type ShipmentEntry = { tracking?: string; readyToShip?: boolean };

/**
 * Returns true only when `order.isDelivered` was set by an automated carrier sync/webhook
 * (never reverts manual confirmations by Admin/Staff).
 */
export function wasOrderAutoDelivered(order: CheckoutOrder, carrier?: "ecom" | "ecotrack"): boolean {
  if (!order.isDelivered) return false;
  const deliveredEvents = (order.history ?? []).filter(h => h.type === "delivered");
  if (deliveredEvents.length === 0) return false;
  const last = deliveredEvents[deliveredEvents.length - 1];
  const actorLower = (last.actorName || "").toLowerCase();
  if (carrier === "ecom" && (actorLower.includes("ecotrack") || actorLower.includes("dhd"))) {
    return false;
  }
  if (carrier === "ecotrack" && actorLower.includes("e-com")) {
    return false;
  }
  return (
    last.actorId === "system" ||
    last.actorId === "webhook" ||
    /\(auto\)/i.test(last.actorName || "") ||
    /webhook/i.test(last.actorName || "")
  );
}

/**
 * Reconciles checkout orders against a carrier tracking batch:
 * - Marks genuinely delivered/collected parcels as `isDelivered = true` and restores `transferee` if needed.
 * - Cleans false positives previously auto-marked by the buggy substring matcher.
 */
export async function reconcileCarrierBatchOrders(params: {
  carrier: "ecom" | "ecotrack";
  orders: CheckoutOrder[];
  shipments: Record<string, ShipmentEntry>;
  trackingMap: Record<string, CarrierTrackingSummary>;
  db?: Awaited<ReturnType<typeof getDb>> | null;
}): Promise<{ syncedCount: number; revertedCount: number }> {
  const { carrier, orders, shipments, trackingMap } = params;
  const actorName = carrier === "ecotrack" ? "DHD / EcoTrack (Auto)" : "E-com Delivery (Auto)";
  const revertActorName =
    carrier === "ecotrack" ? "DHD / EcoTrack (Correction Auto)" : "E-com Delivery (Correction Auto)";
  const db = params.db !== undefined ? params.db : await getDb().catch(() => null);

  let syncedCount = 0;
  let revertedCount = 0;

  for (const order of orders) {
    const sh = shipments[order.id];
    const trkNum = sh?.tracking?.trim();
    if (!trkNum) continue;
    const trkData = trackingMap[trkNum];
    if (!trkData) continue;

    const deliveredNow = isCarrierTrackingDelivered(trkData);

    if (deliveredNow && !order.returnReceived) {
      if (order.status !== "transferee") {
        if (!db) {
          await restoreTransferredStatusFromCarrier(order.dbId, {
            actorId: "system",
            actorName,
          });
        } else {
          await updateStoreOrderStatus(order.dbId, "transferee");
        }
        order.status = "transferee";
      }
      if (!order.isDelivered) {
        await markOrderDelivered(order.dbId, true, {
          actorId: "system",
          actorName,
        });
        order.isDelivered = true;
        syncedCount++;
      }
    } else if (!deliveredNow && order.isDelivered && wasOrderAutoDelivered(order, carrier)) {
      const explicitSituation = `${trkData.situation || ""} ${trkData.etat_logistique || ""}`.trim();
      if (!explicitSituation || /^en suivi$/i.test(explicitSituation)) {
        continue;
      }
      await markOrderDelivered(order.dbId, false, {
        actorId: "system",
        actorName: revertActorName,
      });
      order.isDelivered = false;
      revertedCount++;
    }
  }

  return { syncedCount, revertedCount };
}

/**
 * Full bidirectional reconciliation across E-com Delivery and DHD/EcoTrack.
 */
export async function syncAllCarrierDeliveries(options?: {
  includeEcom?: boolean;
  includeEcoTrack?: boolean;
  forceRefresh?: boolean;
}): Promise<{ syncedCount: number; revertedCount: number }> {
  const includeEcom = options?.includeEcom ?? true;
  const includeEcoTrack = options?.includeEcoTrack ?? true;
  const forceRefresh = Boolean(options?.forceRefresh);

  let syncedCount = 0;
  let revertedCount = 0;

  const orders = await listCheckoutOrders();
  const [ecomStatus, ecoStatus, db] = await Promise.all([
    includeEcom ? getEcomStatus().catch(() => null) : Promise.resolve(null),
    includeEcoTrack ? getEcoTrackStatus().catch(() => null) : Promise.resolve(null),
    getDb().catch(() => null),
  ]);

  if (ecomStatus?.configured) {
    const ecomShipments = ecomStatus.shipments || {};
    const ecomTrackings = Array.from(
      new Set(
        orders
          .map(o => ecomShipments[o.id]?.tracking?.trim())
          .filter((t): t is string => Boolean(t))
      )
    );
    if (ecomTrackings.length > 0) {
      const batch: Record<string, CarrierTrackingSummary> = {};
      for (let i = 0; i < ecomTrackings.length; i += 80) {
        const chunk = await getEcomTrackingBatch(ecomTrackings.slice(i, i + 80), { forceRefresh }).catch(
          () => ({} as Record<string, CarrierTrackingSummary>)
        );
        Object.assign(batch, chunk);
      }
      const res = await reconcileCarrierBatchOrders({
        carrier: "ecom",
        orders,
        shipments: ecomShipments,
        trackingMap: batch,
        db,
      });
      syncedCount += res.syncedCount;
      revertedCount += res.revertedCount;
    }
  }

  if (ecoStatus?.configured) {
    const ecoShipments = ecoStatus.shipments || {};
    const ecoTrackings = Array.from(
      new Set(
        orders
          .map(o => ecoShipments[o.id]?.tracking?.trim())
          .filter((t): t is string => Boolean(t))
      )
    );
    if (ecoTrackings.length > 0) {
      const batch: Record<string, CarrierTrackingSummary> = {};
      for (let i = 0; i < ecoTrackings.length; i += 80) {
        const chunk = await getEcoTrackTrackingBatch(ecoTrackings.slice(i, i + 80), { forceRefresh }).catch(
          () => ({} as Record<string, CarrierTrackingSummary>)
        );
        Object.assign(batch, chunk);
      }
      const res = await reconcileCarrierBatchOrders({
        carrier: "ecotrack",
        orders,
        shipments: ecoShipments,
        trackingMap: batch,
        db,
      });
      syncedCount += res.syncedCount;
      revertedCount += res.revertedCount;
    }
  }

  return { syncedCount, revertedCount };
}
