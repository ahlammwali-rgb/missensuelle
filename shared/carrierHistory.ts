import type { CheckoutOrder } from "./checkout";
import {
  classifyCarrierTracking,
  normCarrierText,
  type CarrierTrackingSummary,
} from "./carrierStatus";

export type HistoryStageId =
  | "prep"
  | "transit"
  | "out_for_delivery"
  | "no_answer"
  | "postponed"
  | "delivered"
  | "returned";

export type TransferredFilterKey =
  | "all"
  | "reclamation_urgent"
  | "encours"
  | HistoryStageId
  | "delivered_cashed"
  | "delivered_uncollected"
  | "stalled_48h"
  | "multi_attempts";

export type OrderHistoryInspection = {
  stage: HistoryStageId;
  scanCount: number;
  attemptCount: number;
  hasMultipleAttempts: boolean;
  isDelivered: boolean;
  isCashed: boolean;
  isDeliveredUncollected: boolean;
  isRecovered: boolean;
  isStalled48h: boolean;
  isUrgentReclamation: boolean;
  hoursSinceLastScan: number | null;
  deliveryDurationHours: number | null;
  lastScanLabel: string | null;
};

export type StageMetric = {
  id: HistoryStageId;
  count: number;
  amount: number;
  pct: number;
};

export type TransferredHistoryAnalytics = {
  totalCount: number;
  totalCodAmount: number;
  activeCount: number;
  activeCodAmount: number;
  deliveredCount: number;
  deliveredAmount: number;
  deliveryRatePct: number;
  returnedCount: number;
  returnedAmount: number;
  returnRatePct: number;
  cashedCount: number;
  cashedAmount: number;
  uncollectedDeliveredCount: number;
  uncollectedDeliveredAmount: number;
  recoveredCount: number;
  recoveredAmount: number;
  cashCollectionRatePct: number;
  stalled48hCount: number;
  stalled48hAmount: number;
  multiAttemptsCount: number;
  multiAttemptsAmount: number;
  urgentReclamationCount: number;
  urgentReclamationAmount: number;
  totalScans: number;
  totalAttemptScans: number;
  trackedWithHistoryCount: number;
  avgScansPerTracked: number;
  avgDeliveryHours: number | null;
  stages: Record<HistoryStageId, StageMetric>;
};

const OUT_FOR_DELIVERY_RE =
  /(?:en[\s_]*livraison|sorti\w*[\s_]*(?:en|pour)[\s_]*livraison|dispatched[\s_]*to[\s_]*driver|en[\s_]*tournee|remis[\s_]*au[\s_]*livreur)/;
const TRANSIT_RE =
  /(?:^|[\s_/|,&()-])(?:expediee?s?|ramass\w*|accepted[\s_]*by[\s_]*carrier|vers[\s_]*hub|en[\s_]*hub|vers[\s_]*wilaya|recu[\s_]*wilaya|stop[\s_]*desk|au[\s_]*bureau|transit\w*|hub|dispatch\w*)(?:$|[\s_/|,&()-])/;
const PREP_RE =
  /(?:en[\s_]*preparation|pret\w*[\s_]*a[\s_]*expedier|order_information_received|etiquette|en[\s_]*attente|non[\s_]*assigne)/;
const ATTEMPT_SCAN_RE =
  /(?:tentative|attempt_delivery|ne[\s_]*repond|injoignable|sans[\s_]*reponse|nrp|report|reprogramm|echec|suspendu)/;

export function parseCarrierTimestamp(raw?: string | null): number | null {
  const s = String(raw || "").trim();
  if (!s) return null;

  // Try ISO or YYYY-MM-DD HH:mm(:ss)
  const normalizedSpace = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(s)
    ? s.replace(/\s+/, "T")
    : s;
  const direct = Date.parse(normalizedSpace);
  if (Number.isFinite(direct)) return direct;

  // Fallback DD/MM/YYYY or DD-MM-YYYY [HH:mm[:ss]]
  const dmy = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (dmy) {
    const [, dd, mm, yyyy, hh = "12", mi = "00", ss = "00"] = dmy;
    const iso = `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
    const ts = Date.parse(iso);
    if (Number.isFinite(ts)) return ts;
  }

  return null;
}

export function classifyOrderHistoryStage(
  trk?: CarrierTrackingSummary | null
): HistoryStageId {
  const cat = classifyCarrierTracking(trk);
  if (cat === "returned") return "returned";
  if (cat === "delivered") return "delivered";
  if (cat === "no_answer") return "no_answer";
  if (cat === "postponed") return "postponed";

  if (!trk) return "prep";

  const history = Array.isArray(trk.historique) ? trk.historique : [];
  const lastEvent = history.length > 0 ? history[history.length - 1] : undefined;
  const currentNorm = normCarrierText(
    `${trk.situation || ""} ${trk.etat_logistique || ""}`
  );
  const lastNorm = normCarrierText(
    `${lastEvent?.situation || ""} ${lastEvent?.commentaire || ""}`
  );
  const combinedNorm = `${currentNorm} ${lastNorm}`.trim();

  if (OUT_FOR_DELIVERY_RE.test(combinedNorm)) return "out_for_delivery";
  if (PREP_RE.test(currentNorm) && history.length <= 1 && !TRANSIT_RE.test(lastNorm)) {
    return "prep";
  }
  if (TRANSIT_RE.test(combinedNorm) || history.length >= 2) return "transit";
  return "prep";
}

export function inspectOrderCarrierHistory(
  order: CheckoutOrder,
  trk?: CarrierTrackingSummary | null,
  shipmentAt?: string | null,
  nowMs: number = Date.now()
): OrderHistoryInspection {
  const stage = classifyOrderHistoryStage(trk);
  const history = Array.isArray(trk?.historique) ? trk.historique : [];
  const scanCount = history.length;

  let attemptCount = 0;
  let earliestScanMs: number | null = null;
  let latestScanMs: number | null = null;
  let lastScanLabel: string | null = null;

  for (const step of history) {
    const stepText = `${step?.situation || ""} ${step?.commentaire || ""}`;
    if (ATTEMPT_SCAN_RE.test(normCarrierText(stepText))) {
      attemptCount++;
    }
    const ts = parseCarrierTimestamp(step?.date);
    if (ts !== null) {
      if (earliestScanMs === null || ts < earliestScanMs) earliestScanMs = ts;
      if (latestScanMs === null || ts > latestScanMs) latestScanMs = ts;
    }
    if (step?.situation) {
      lastScanLabel = step.situation;
    }
  }

  if (attemptCount === 0 && (stage === "no_answer" || stage === "postponed")) {
    attemptCount = 1;
  }

  const fallbackStartMs =
    earliestScanMs ??
    parseCarrierTimestamp((trk as { date_creation?: string } | null)?.date_creation) ??
    parseCarrierTimestamp(shipmentAt) ??
    parseCarrierTimestamp(order.createdAt);

  const referenceLatestMs =
    latestScanMs ?? parseCarrierTimestamp(shipmentAt) ?? parseCarrierTimestamp(order.createdAt);

  const isDelivered = stage === "delivered";
  const isCashed = isDelivered && Boolean(trk?.encaisser);
  const isDeliveredUncollected = isDelivered && !trk?.encaisser;
  const isRecovered = isDelivered && Boolean(trk?.recouvert);

  const hoursSinceLastScan =
    referenceLatestMs !== null ? Math.max(0, (nowMs - referenceLatestMs) / 3_600_000) : null;

  const isStalled48h =
    !isDelivered &&
    stage !== "returned" &&
    hoursSinceLastScan !== null &&
    hoursSinceLastScan >= 48;

  const isUrgentReclamation =
    isStalled48h ||
    attemptCount >= 2 ||
    stage === "no_answer" ||
    isDeliveredUncollected;

  let deliveryDurationHours: number | null = null;
  if (isDelivered && fallbackStartMs !== null && latestScanMs !== null && latestScanMs >= fallbackStartMs) {
    const hrs = (latestScanMs - fallbackStartMs) / 3_600_000;
    if (hrs <= 24 * 90) {
      deliveryDurationHours = hrs;
    }
  }

  return {
    stage,
    scanCount,
    attemptCount,
    hasMultipleAttempts: attemptCount >= 2,
    isDelivered,
    isCashed,
    isDeliveredUncollected,
    isRecovered,
    isStalled48h,
    isUrgentReclamation,
    hoursSinceLastScan,
    deliveryDurationHours,
    lastScanLabel,
  };
}

export function matchesTransferredFilter(
  filterKey: TransferredFilterKey,
  info: OrderHistoryInspection
): boolean {
  if (filterKey === "all") return true;
  if (filterKey === "reclamation_urgent") return info.isUrgentReclamation;
  if (filterKey === "encours") return !info.isDelivered && info.stage !== "returned";
  if (filterKey === "delivered_cashed") return info.isCashed;
  if (filterKey === "delivered_uncollected") return info.isDeliveredUncollected;
  if (filterKey === "stalled_48h") return info.isStalled48h;
  if (filterKey === "multi_attempts") return info.hasMultipleAttempts;
  return info.stage === filterKey;
}

export function computeTransferredHistoryAnalytics(
  orders: CheckoutOrder[],
  inspections: Map<string, OrderHistoryInspection>
): TransferredHistoryAnalytics {
  const stageIds: HistoryStageId[] = [
    "prep",
    "transit",
    "out_for_delivery",
    "no_answer",
    "postponed",
    "delivered",
    "returned",
  ];

  const stageAccum: Record<HistoryStageId, { count: number; amount: number }> = {
    prep: { count: 0, amount: 0 },
    transit: { count: 0, amount: 0 },
    out_for_delivery: { count: 0, amount: 0 },
    no_answer: { count: 0, amount: 0 },
    postponed: { count: 0, amount: 0 },
    delivered: { count: 0, amount: 0 },
    returned: { count: 0, amount: 0 },
  };

  let totalCodAmount = 0;
  let activeCount = 0;
  let activeCodAmount = 0;
  let deliveredCount = 0;
  let deliveredAmount = 0;
  let returnedCount = 0;
  let returnedAmount = 0;
  let cashedCount = 0;
  let cashedAmount = 0;
  let uncollectedDeliveredCount = 0;
  let uncollectedDeliveredAmount = 0;
  let recoveredCount = 0;
  let recoveredAmount = 0;
  let stalled48hCount = 0;
  let stalled48hAmount = 0;
  let multiAttemptsCount = 0;
  let multiAttemptsAmount = 0;
  let urgentReclamationCount = 0;
  let urgentReclamationAmount = 0;
  let totalScans = 0;
  let totalAttemptScans = 0;
  let trackedWithHistoryCount = 0;
  let durationSumHours = 0;
  let durationCount = 0;

  for (const order of orders) {
    const amt = Number(order.total) || 0;
    totalCodAmount += amt;
    const info = inspections.get(order.id);
    if (!info) continue;

    stageAccum[info.stage].count += 1;
    stageAccum[info.stage].amount += amt;

    if (info.scanCount > 0) {
      trackedWithHistoryCount += 1;
      totalScans += info.scanCount;
    }
    totalAttemptScans += info.attemptCount;

    if (info.isDelivered) {
      deliveredCount += 1;
      deliveredAmount += amt;
      if (info.isCashed) {
        cashedCount += 1;
        cashedAmount += amt;
      } else {
        uncollectedDeliveredCount += 1;
        uncollectedDeliveredAmount += amt;
      }
      if (info.isRecovered) {
        recoveredCount += 1;
        recoveredAmount += amt;
      }
      if (info.deliveryDurationHours !== null) {
        durationSumHours += info.deliveryDurationHours;
        durationCount += 1;
      }
    } else if (info.stage === "returned") {
      returnedCount += 1;
      returnedAmount += amt;
    } else {
      activeCount += 1;
      activeCodAmount += amt;
    }

    if (info.isStalled48h) {
      stalled48hCount += 1;
      stalled48hAmount += amt;
    }
    if (info.hasMultipleAttempts) {
      multiAttemptsCount += 1;
      multiAttemptsAmount += amt;
    }
    if (info.isUrgentReclamation) {
      urgentReclamationCount += 1;
      urgentReclamationAmount += amt;
    }
  }

  const totalCount = orders.length;
  const safeTotal = totalCount || 1;

  const stages = stageIds.reduce((acc, id) => {
    const item = stageAccum[id];
    acc[id] = {
      id,
      count: item.count,
      amount: item.amount,
      pct: totalCount > 0 ? Math.round((item.count / safeTotal) * 100) : 0,
    };
    return acc;
  }, {} as Record<HistoryStageId, StageMetric>);

  return {
    totalCount,
    totalCodAmount,
    activeCount,
    activeCodAmount,
    deliveredCount,
    deliveredAmount,
    deliveryRatePct: totalCount > 0 ? Math.round((deliveredCount / totalCount) * 100) : 0,
    returnedCount,
    returnedAmount,
    returnRatePct: totalCount > 0 ? Math.round((returnedCount / totalCount) * 100) : 0,
    cashedCount,
    cashedAmount,
    uncollectedDeliveredCount,
    uncollectedDeliveredAmount,
    recoveredCount,
    recoveredAmount,
    cashCollectionRatePct:
      deliveredCount > 0 ? Math.round((cashedCount / deliveredCount) * 100) : 0,
    stalled48hCount,
    stalled48hAmount,
    multiAttemptsCount,
    multiAttemptsAmount,
    urgentReclamationCount,
    urgentReclamationAmount,
    totalScans,
    totalAttemptScans,
    trackedWithHistoryCount,
    avgScansPerTracked:
      trackedWithHistoryCount > 0
        ? Math.round((totalScans / trackedWithHistoryCount) * 10) / 10
        : 0,
    avgDeliveryHours: durationCount > 0 ? Math.round(durationSumHours / durationCount) : null,
    stages,
  };
}

export type CarrierHistoryStep = NonNullable<CarrierTrackingSummary["historique"]>[number];

/**
 * Picks the chronologically newest scan in `historique` regardless of whether
 * the upstream carrier returned events oldest-first or newest-first.
 */
export function getLatestCarrierHistoryStep(
  trk?: CarrierTrackingSummary | null
): CarrierHistoryStep | null {
  const history = Array.isArray(trk?.historique) ? trk.historique : [];
  if (history.length === 0) return null;

  let bestIdx = history.length - 1;
  let bestTs: number | null = null;
  for (let i = 0; i < history.length; i++) {
    const step = history[i];
    if (!step) continue;
    const ts = parseCarrierTimestamp(step.date);
    if (ts !== null && (bestTs === null || ts >= bestTs)) {
      bestTs = ts;
      bestIdx = i;
    }
  }
  return history[bestIdx] ?? history[history.length - 1] ?? null;
}

export interface TransferredCardStatusBadge {
  label: string;
  sub: string;
  cls: string;
  cardClass: string;
  icon: string;
  isFromHistory: boolean;
  lastScan: CarrierHistoryStep | null;
}

/**
 * Builds the right-side card badge using the latest status from `historique`
 * while preserving semantic delivery state colors.
 */
export function buildTransferredCardStatusBadge(
  trk?: CarrierTrackingSummary | null,
  order?: Pick<CheckoutOrder, "isDelivered" | "status"> | null
): TransferredCardStatusBadge {
  const lastScan = getLatestCarrierHistoryStep(trk);
  const effectiveSummary: CarrierTrackingSummary | null = trk
    ? {
        ...trk,
        situation: trk.situation || lastScan?.situation || null,
      }
    : lastScan?.situation
      ? { situation: lastScan.situation }
      : null;

  const rawCat = classifyCarrierTracking(effectiveSummary);
  const cat =
    order?.isDelivered && rawCat === "in_transit" ? "delivered" : rawCat;

  const palette =
    cat === "delivered"
      ? {
          cls: "trans-badge-livre",
          cardClass: "trans-card-livre",
          icon: "🟢",
          fallbackLabel: "Livré",
          fallbackSub: "Colis remis au client",
        }
      : cat === "no_answer"
        ? {
            cls: "trans-badge-norepond",
            cardClass: "trans-card-norepond",
            icon: "📞",
            fallbackLabel: "Ne Répond Pas (Livreur)",
            fallbackSub: "Tentative d'appel livreur",
          }
        : cat === "postponed"
          ? {
              cls: "trans-badge-reporte",
              cardClass: "trans-card-reporte",
              icon: "📅",
              fallbackLabel: "Reporté",
              fallbackSub: "Reprogrammé avec le client",
            }
          : cat === "returned"
            ? {
                cls: "trans-badge-retour",
                cardClass: "trans-card-retour",
                icon: "↩️",
                fallbackLabel: "Retour / Refusé",
                fallbackSub: "En cours de retour",
              }
            : {
                cls: "trans-badge-encours",
                cardClass: "trans-card-encours",
                icon: "🚚",
                fallbackLabel: "En Transit / Livraison",
                fallbackSub: "En Préparation / Expédié",
              };

  const historySituation = lastScan?.situation?.trim();
  const etaOrSit = trk?.etat_logistique?.trim() || trk?.situation?.trim();

  if (historySituation) {
    const subParts: string[] = [];
    if (lastScan?.date?.trim()) subParts.push(lastScan.date.trim());
    if (lastScan?.ville !== undefined && lastScan?.ville !== null && String(lastScan.ville).trim()) {
      subParts.push(String(lastScan.ville).trim());
    }
    return {
      label: historySituation,
      sub: subParts.length > 0 ? subParts.join(" · ") : etaOrSit || palette.fallbackSub,
      cls: palette.cls,
      cardClass: palette.cardClass,
      icon: palette.icon,
      isFromHistory: true,
      lastScan,
    };
  }

  return {
    label: etaOrSit || palette.fallbackLabel,
    sub: trk?.situation?.trim() || trk?.etat_logistique?.trim() || palette.fallbackSub,
    cls: palette.cls,
    cardClass: palette.cardClass,
    icon: palette.icon,
    isFromHistory: false,
    lastScan: null,
  };
}
