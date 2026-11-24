import { algiersDateKey, computeFinanceDashboard, type FinanceOverviewResponse, type FinanceViewMode } from "../shared/finance";
import type { CarrierTrackingSummary } from "../shared/carrierStatus";
import { listCheckoutOrders } from "./checkout";
import { getEcomStatus, getEcomTrackingBatch, getShippingRates } from "./ecomDelivery";
import { getEcoTrackFees, getEcoTrackStatus, getEcoTrackTrackingBatch } from "./ecotrackDelivery";
import {
  buildPublicAdConnectionStatus,
  getFinanceStateSnapshot,
  getMergedCatalogRefs,
} from "./financeStore";
import { getStaffMembers } from "./persistentStore";

export function defaultFinanceRange(daysBack = 30): { startDate: string; endDate: string } {
  const endDate = algiersDateKey(new Date());
  const startDate = algiersDateKey(new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000));
  return { startDate, endDate };
}

/**
 * Loads orders, catalog, staff, carrier fee tables, carrier tracking caches,
 * and finance state, then runs the deterministic `computeFinanceDashboard` engine.
 */
export async function buildFinanceOverviewForRequest(options?: {
  viewMode?: FinanceViewMode;
  startDate?: string;
  endDate?: string;
  refreshCarriers?: boolean;
}): Promise<FinanceOverviewResponse> {
  const def = defaultFinanceRange(30);
  const startDate = options?.startDate && /^\d{4}-\d{2}-\d{2}$/.test(options.startDate) ? options.startDate : def.startDate;
  const endDate = options?.endDate && /^\d{4}-\d{2}-\d{2}$/.test(options.endDate) ? options.endDate : def.endDate;
  const viewMode: FinanceViewMode = options?.viewMode === "cashflow" ? "cashflow" : "cohort";
  const forceRefresh = Boolean(options?.refreshCarriers);

  const [orders, financeState, ecomStatus, ecoStatus, ecomRatesRes, ecoRatesRes] = await Promise.all([
    listCheckoutOrders(),
    getFinanceStateSnapshot(),
    getEcomStatus().catch(() => ({ configured: false as const, shipments: {} as Record<string, { tracking?: string; at?: string }> })),
    getEcoTrackStatus().catch(() => ({ configured: false as const, shipments: {} as Record<string, { tracking?: string; at?: string }> })),
    getShippingRates().catch(() => ({ configured: false, rates: {} })),
    getEcoTrackFees().catch(() => ({ configured: false, rates: {} })),
  ]);

  const ecomShipments = ecomStatus?.shipments || {};
  const ecoShipments = ecoStatus?.shipments || {};

  const ecomTrackings = Array.from(
    new Set(
      orders
        .map(o => ecomShipments[o.id]?.tracking?.trim())
        .filter((t): t is string => Boolean(t))
    )
  );
  const ecoTrackings = Array.from(
    new Set(
      orders
        .map(o => ecoShipments[o.id]?.tracking?.trim())
        .filter((t): t is string => Boolean(t))
    )
  );

  const [ecomBatch, ecoBatch] = await Promise.all([
    ecomStatus?.configured && ecomTrackings.length > 0
      ? getEcomTrackingBatch(ecomTrackings, { forceRefresh }).catch(() => ({} as Record<string, CarrierTrackingSummary>))
      : Promise.resolve({} as Record<string, CarrierTrackingSummary>),
    ecoStatus?.configured && ecoTrackings.length > 0
      ? getEcoTrackTrackingBatch(ecoTrackings, { forceRefresh }).catch(() => ({} as Record<string, CarrierTrackingSummary>))
      : Promise.resolve({} as Record<string, CarrierTrackingSummary>),
  ]);

  const trackingMap: Record<string, CarrierTrackingSummary> = {
    ...ecomBatch,
    ...ecoBatch,
  };

  return computeFinanceDashboard({
    orders,
    catalog: getMergedCatalogRefs(),
    staffMembers: getStaffMembers(),
    ecomShipments,
    ecoShipments,
    trackingMap,
    ecomRates: ecomRatesRes?.rates || {},
    ecoRates: ecoRatesRes?.rates || {},
    financeState,
    adConnectionsPublic: buildPublicAdConnectionStatus(),
    viewMode,
    startDate: startDate <= endDate ? startDate : endDate,
    endDate: endDate >= startDate ? endDate : startDate,
  });
}
