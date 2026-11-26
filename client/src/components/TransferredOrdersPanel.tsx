import { useState, useMemo, useEffect, useRef } from "react";
import {
  Truck,
  PackageCheck,
  RefreshCw,
  Phone,
  Copy,
  Check,
  Clock,
  AlertTriangle,
  ArrowLeftRight,
  Search,
  FileDown,
  MapPin,
  Calendar,
  ShieldCheck,
  Eye,
  X,
  Activity,
  RotateCcw,
  Banknote,
  Package,
  PhoneMissed,
  SlidersHorizontal,
  MessageCircle,
} from "lucide-react";
import type { CheckoutOrder } from "@shared/checkout";
import { classifyCarrierTracking, isCarrierTrackingDelivered } from "@shared/carrierStatus";
import {
  buildTransferredCardStatusBadge,
  computeTransferredHistoryAnalytics,
  getLatestCarrierHistoryStep,
  inspectOrderCarrierHistory,
  matchesTransferredFilter,
  parseCarrierTimestamp,
  type HistoryStageId,
  type OrderHistoryInspection,
  type TransferredFilterKey,
} from "@shared/carrierHistory";
import { formatDZD, type OrderStatus } from "@/lib/store-data";
import { trpc } from "@/lib/trpc";

function findTrackingData(
  map: Record<string, TrackingData>,
  rawTracking?: string | null
): TrackingData | null {
  const key = String(rawTracking || "").trim();
  if (!key) return null;
  if (map[key]) return map[key];
  const lower = key.toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (k.trim().toLowerCase() === lower) return v;
  }
  return null;
}

function formatCarrierStepDate(raw?: string | null): string {
  const clean = String(raw || "").trim();
  if (!clean) return "Scan enregistré";
  const ts = parseCarrierTimestamp(clean);
  if (ts !== null) {
    return new Date(ts).toLocaleString("fr-DZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return clean;
}

interface TransferredOrdersPanelProps {
  orders: CheckoutOrder[];
  notify: (msg: string) => void;
  onUpdateStatus: (id: string, status: OrderStatus) => void;
  onRefreshOrders?: () => void;
  focusedOrderId?: string | null;
  onClearFocusedOrder?: () => void;
}

type TimelineItem = {
  date: string;
  ville: number | string;
  situation: string;
  commentaire?: string | null;
};

type TrackingData = {
  tracking: string;
  situation?: string;
  etat_logistique?: string;
  date_creation?: string;
  encaisser?: boolean;
  recouvert?: boolean;
  commune?: string;
  id_wilaya?: number;
  historique?: TimelineItem[];
};

export function TransferredOrdersPanel({
  orders,
  notify,
  onUpdateStatus,
  onRefreshOrders,
  focusedOrderId,
  onClearFocusedOrder,
}: TransferredOrdersPanelProps) {
  const [search, setSearch] = useState("");
  const [filterSituation, setFilterSituation] = useState<TransferredFilterKey>("all");
  const [filterCarrier, setFilterCarrier] = useState<"all" | "ecotrack" | "ecom" | "other">("all");
  const [lastSyncAt, setLastSyncAt] = useState<string>(() =>
    new Date().toLocaleTimeString("fr-DZ", { hour: "2-digit", minute: "2-digit" })
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const syncedDeliveredIdsRef = useRef<Set<string>>(new Set());
  const [selectedTimelineOrder, setSelectedTimelineOrder] = useState<{
    order: CheckoutOrder;
    tracking?: TrackingData;
  } | null>(null);

  useEffect(() => {
    if (!focusedOrderId) return;
    setFilterSituation("all");
    setFilterCarrier("all");
    setSearch("");
    const safeSelector = `[data-order-id="${CSS.escape(focusedOrderId)}"]`;
    const scrollToTarget = () => {
      const el = document.querySelector(safeSelector);
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        return true;
      }
      return false;
    };
    const timers: number[] = [];
    for (const delay of [80, 260, 620]) {
      timers.push(
        window.setTimeout(() => {
          scrollToTarget();
        }, delay)
      );
    }
    return () => {
      timers.forEach(t => window.clearTimeout(t));
    };
  }, [focusedOrderId]);

  // E-com & EcoTrack status & live refresh mutations
  const utils = trpc.useUtils();
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const syncDeliveriesMutation = trpc.admin.syncDeliveredFromCarriers.useMutation({
    onSuccess: res => {
      if (onRefreshOrders && (res.syncedCount > 0 || (res as { revertedCount?: number }).revertedCount)) {
        onRefreshOrders();
      }
    },
  });
  const ecomStatusQuery = trpc.ecom.status.useQuery(undefined, {
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    staleTime: 30000,
  });
  const ecotrackStatusQuery = trpc.ecotrack.status.useQuery(undefined, {
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    staleTime: 30000,
  });
  const ecomShipments = useMemo(() => ecomStatusQuery.data?.shipments || {}, [ecomStatusQuery.data]);
  const ecoShipments = useMemo(() => ecotrackStatusQuery.data?.shipments || {}, [ecotrackStatusQuery.data]);
  const ecoCarrierName = ecotrackStatusQuery.data?.label || "DHD (EcoTrack)";
  const shipments = useMemo(() => ({ ...ecomShipments, ...ecoShipments }), [ecomShipments, ecoShipments]);

  // Filter transferred orders
  const transferredOrders = useMemo(() => {
    return orders.filter(
      o => o.status === "transferee" || Boolean(shipments[o.id])
    );
  }, [orders, shipments]);

  // Extract tracking numbers split per carrier (trimmed)
  const { ecomTrackings, ecoTrackings } = useMemo(() => {
    const ecomList: string[] = [];
    const ecoList: string[] = [];
    for (const o of transferredOrders) {
      const ecoSh = ecoShipments[o.id];
      const ecomSh = ecomShipments[o.id];
      if (ecoSh?.tracking?.trim()) ecoList.push(ecoSh.tracking.trim());
      else if (ecomSh?.tracking?.trim()) ecomList.push(ecomSh.tracking.trim());
    }
    return {
      ecomTrackings: Array.from(new Set(ecomList)),
      ecoTrackings: Array.from(new Set(ecoList)),
    };
  }, [transferredOrders, ecomShipments, ecoShipments]);

  // Batch tracking queries (E-com + EcoTrack) — utilisent le cache serveur 3 min pour éviter les 429
  const trackingQuery = trpc.ecom.trackBatch.useQuery(
    { trackings: ecomTrackings },
    {
      enabled: ecomTrackings.length > 0,
      refetchInterval: 120000,
      refetchOnMount: true,
      staleTime: 60000,
      refetchOnWindowFocus: false,
    }
  );
  const ecotrackTrackingQuery = trpc.ecotrack.trackBatch.useQuery(
    { trackings: ecoTrackings },
    {
      enabled: ecoTrackings.length > 0,
      refetchInterval: 120000,
      refetchOnMount: true,
      staleTime: 60000,
      refetchOnWindowFocus: false,
    }
  );

  const ecomRefreshMutation = trpc.ecom.refreshBatch.useMutation({
    onSuccess: data => {
      if (ecomTrackings.length > 0) {
        utils.ecom.trackBatch.setData({ trackings: ecomTrackings }, data);
      }
    },
  });
  const ecotrackRefreshMutation = trpc.ecotrack.refreshBatch.useMutation({
    onSuccess: data => {
      if (ecoTrackings.length > 0) {
        utils.ecotrack.trackBatch.setData({ trackings: ecoTrackings }, data);
      }
    },
  });

  const handleForceRefreshAll = async () => {
    setIsManualRefreshing(true);
    syncedDeliveredIdsRef.current.clear();
    try {
      await Promise.all([ecomStatusQuery.refetch(), ecotrackStatusQuery.refetch()]);
      await Promise.all([
        ecoTrackings.length > 0
          ? ecotrackRefreshMutation.mutateAsync({ trackings: ecoTrackings })
          : Promise.resolve(null),
        ecomTrackings.length > 0
          ? ecomRefreshMutation.mutateAsync({ trackings: ecomTrackings })
          : Promise.resolve(null),
      ]);
      await syncDeliveriesMutation.mutateAsync({ forceRefresh: true }).catch(() => null);
      if (onRefreshOrders) onRefreshOrders();
      setLastSyncAt(new Date().toLocaleTimeString("fr-DZ", { hour: "2-digit", minute: "2-digit" }));
      notify("Statuts & historiques synchronisés en direct ✦");
    } catch {
      notify("Impossible de joindre le transporteur pour le moment");
    } finally {
      setIsManualRefreshing(false);
    }
  };

  const trackingMap = useMemo(
    () =>
      ({
        ...(trackingQuery.data || {}),
        ...(ecotrackTrackingQuery.data || {}),
      }) as Record<string, TrackingData>,
    [trackingQuery.data, ecotrackTrackingQuery.data]
  );
  const isTrackingFetching =
    isManualRefreshing ||
    trackingQuery.isFetching ||
    ecotrackTrackingQuery.isFetching ||
    ecomRefreshMutation.isPending ||
    ecotrackRefreshMutation.isPending ||
    syncDeliveriesMutation.isPending;

  const getOrderCarrier = (o: CheckoutOrder): "ecotrack" | "ecom" | "other" => {
    if (ecoShipments[o.id] || o.carrier === "ecotrack") return "ecotrack";
    if (ecomShipments[o.id] || o.carrier === "ecom") return "ecom";
    return "other";
  };

  useEffect(() => {
    if (!onRefreshOrders) return;
    let needsRefresh = false;
    for (const o of transferredOrders) {
      const sh = ecoShipments[o.id] || ecomShipments[o.id] || shipments[o.id];
      const trk = findTrackingData(trackingMap, sh?.tracking);
      if (!trk) continue;
      const deliveredNow = isCarrierTrackingDelivered(trk);
      const syncKey = `${o.id}:${deliveredNow}`;
      if (syncedDeliveredIdsRef.current.has(syncKey)) continue;
      if ((deliveredNow && !o.isDelivered) || (!deliveredNow && Boolean(o.isDelivered))) {
        syncedDeliveredIdsRef.current.add(syncKey);
        needsRefresh = true;
      }
    }
    if (needsRefresh) {
      onRefreshOrders();
    }
  }, [transferredOrders, ecoShipments, ecomShipments, shipments, trackingMap, onRefreshOrders]);

  const copyText = async (text: string, label: string, id: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
      setCopiedId(id);
      notify(`${label} copié ✦`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      notify("Impossible de copier");
    }
  };

  const copyParcelSlip = (order: CheckoutOrder, tracking?: string, isEcoTrack?: boolean) => {
    const text = [
      `📦 COLIS MISS SENSUELLE`,
      `N° Commande: ${order.id}`,
      tracking ? `N° Suivi ${isEcoTrack ? "EcoTrack" : "E-com"}: ${tracking}` : null,
      `Destinataire: ${order.customer}`,
      `Téléphone: ${order.phone}`,
      `Wilaya/Commune: ${order.wilaya} - ${order.commune}`,
      order.address ? `Adresse: ${order.address}` : null,
      `Produit: ${order.product}`,
      order.color ? `Couleur: ${order.color}` : null,
      order.size ? `Taille: ${order.size}` : null,
      `Total à encaisser: ${order.total} DA`,
    ]
      .filter(Boolean)
      .join("\n");

    copyText(text, "Bordereau colis", order.id);
  };

  const callPhone = (phone: string) => {
    const clean = phone.replace(/[\s().-]/g, "");
    notify("Ouverture de l'appel téléphonique…");
    window.location.href = `tel:${clean}`;
  };

  const carrierCounts = useMemo(() => {
    let ecotrack = 0;
    let ecom = 0;
    let other = 0;
    for (const o of transferredOrders) {
      const c = getOrderCarrier(o);
      if (c === "ecotrack") ecotrack++;
      else if (c === "ecom") ecom++;
      else other++;
    }
    return { all: transferredOrders.length, ecotrack, ecom, other };
  }, [transferredOrders, ecoShipments, ecomShipments]);

  // Compute per-order inspection & history metrics once
  const inspectionMap = useMemo(() => {
    const map = new Map<string, OrderHistoryInspection>();
    const nowMs = Date.now();
    for (const o of transferredOrders) {
      const isEco = Boolean(ecoShipments[o.id]) || o.carrier === "ecotrack";
      const sh = isEco ? (ecoShipments[o.id] || shipments[o.id]) : (ecomShipments[o.id] || shipments[o.id]);
      const trk = findTrackingData(trackingMap, sh?.tracking);
      map.set(o.id, inspectOrderCarrierHistory(o, trk, sh?.at, nowMs));
    }
    return map;
  }, [transferredOrders, ecoShipments, ecomShipments, shipments, trackingMap]);

  // Aggregate step-based & financial analytics from carrier history
  const analytics = useMemo(
    () => computeTransferredHistoryAnalytics(transferredOrders, inspectionMap),
    [transferredOrders, inspectionMap]
  );

  // Filtered by search, carrier, history stage & diagnostic alerts, sorted by latest activity desc
  const filteredOrders = useMemo(() => {
    const matching = transferredOrders.filter(o => {
      if (filterCarrier !== "all" && getOrderCarrier(o) !== filterCarrier) {
        return false;
      }

      const info = inspectionMap.get(o.id);
      if (filterSituation !== "all" && info && !matchesTransferredFilter(filterSituation, info)) {
        return false;
      }

      if (!search.trim()) return true;
      const sh = ecoShipments[o.id] || ecomShipments[o.id] || shipments[o.id];
      const q = search.trim().toLowerCase();
      const matchTrk = sh?.tracking?.toLowerCase().includes(q);
      const matchOrder = `${o.id} ${o.customer} ${o.phone} ${o.wilaya} ${o.commune} ${o.product}`
        .toLowerCase()
        .includes(q);
      return matchOrder || matchTrk;
    });

    const activityTs = (o: CheckoutOrder): number => {
      const isEco = Boolean(ecoShipments[o.id]) || o.carrier === "ecotrack";
      const sh = isEco ? (ecoShipments[o.id] || shipments[o.id]) : (ecomShipments[o.id] || shipments[o.id]);
      const trk = findTrackingData(trackingMap, sh?.tracking);
      const latest = getLatestCarrierHistoryStep(trk);
      const scanMs = latest?.date ? parseCarrierTimestamp(latest.date) : null;
      if (scanMs) return scanMs;
      const shippedMs = sh?.at ? parseCarrierTimestamp(sh.at) : null;
      if (shippedMs) return shippedMs;
      const deliveredMs = o.deliveredAt ? Date.parse(o.deliveredAt) : NaN;
      if (Number.isFinite(deliveredMs)) return deliveredMs;
      const createdMs = Date.parse(o.createdAt);
      return Number.isFinite(createdMs) ? createdMs : 0;
    };

    return [...matching].sort((a, b) => activityTs(b) - activityTs(a));
  }, [transferredOrders, shipments, ecoShipments, ecomShipments, trackingMap, inspectionMap, search, filterSituation, filterCarrier]);

  // Sync selectedIds when transferred orders change (prune removed/repatriated IDs)
  useEffect(() => {
    const validIds = new Set(transferredOrders.map(o => o.id));
    setSelectedIds(prev => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Set<string>();
      prev.forEach(id => {
        if (validIds.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [transferredOrders]);

  const toggleSelectOrder = (orderId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const selectedInViewCount = useMemo(
    () => filteredOrders.filter(o => selectedIds.has(o.id)).length,
    [filteredOrders, selectedIds]
  );

  const allFilteredSelected =
    filteredOrders.length > 0 && selectedInViewCount === filteredOrders.length;

  const toggleSelectAllFiltered = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const o of filteredOrders) next.delete(o.id);
      } else {
        for (const o of filteredOrders) next.add(o.id);
      }
      return next;
    });
  };

  const selectedOrdersList = useMemo(
    () => transferredOrders.filter(o => selectedIds.has(o.id)),
    [transferredOrders, selectedIds]
  );

  const exportCSV = (subset?: CheckoutOrder[]) => {
    const sourceOrders = subset && subset.length > 0 ? subset : filteredOrders;
    const header = [
      "ID Commande",
      "Tracking Transporteur",
      "Date Commande",
      "Client",
      "Téléphone",
      "Wilaya",
      "Commune",
      "Adresse",
      "Produit",
      "Total (DA)",
      "Statut Transporteur",
      "Étape Logistique",
      "Encaissé",
    ];

    const rows = sourceOrders.map(o => {
      const isEco = Boolean(ecoShipments[o.id]) || o.carrier === "ecotrack";
      const sh = isEco ? (ecoShipments[o.id] || shipments[o.id]) : (ecomShipments[o.id] || shipments[o.id]);
      const trk = findTrackingData(trackingMap, sh?.tracking);
      return [
        o.id,
        sh?.tracking || "Non assigné",
        o.createdAt ? new Date(o.createdAt).toLocaleDateString("fr-DZ") : "",
        o.customer,
        o.phone,
        o.wilaya,
        o.commune,
        o.address,
        o.product,
        o.total,
        trk?.situation || "EnCours",
        trk?.etat_logistique || "En Préparation",
        trk?.encaisser ? "OUI" : "NON",
      ];
    });

    const csvContent =
      "\uFEFF" +
      [header, ...rows]
        .map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(","))
        .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `commandes-transferees-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notify(
      subset && subset.length > 0
        ? `Export CSV de ${sourceOrders.length} colis sélectionné(s) téléchargé ✦`
        : "Export CSV des commandes transférées téléchargé ✦"
    );
  };

  const copySelectedTrackingList = () => {
    if (selectedOrdersList.length === 0) return;
    const lines = selectedOrdersList.map(o => {
      const isEco = Boolean(ecoShipments[o.id]) || o.carrier === "ecotrack";
      const sh = isEco ? (ecoShipments[o.id] || shipments[o.id]) : (ecomShipments[o.id] || shipments[o.id]);
      const trk = findTrackingData(trackingMap, sh?.tracking);
      const badge = getStatusBadge(trk, o);
      return `${o.id} | ${sh?.tracking || "Sans tracking"} | ${o.customer} (${o.phone}) | ${o.wilaya} | ${formatDZD(o.total)} | ${badge.label}`;
    });
    void navigator.clipboard?.writeText(lines.join("\n"));
    notify(`${selectedOrdersList.length} bordereau(x) copié(s) dans le presse-papiers ✦`);
  };

  const handleBulkRapatrier = () => {
    if (selectedOrdersList.length === 0) return;
    if (
      !window.confirm(
        `Rapatrier ${selectedOrdersList.length} commande(s) sélectionnée(s) vers le Dashboard actif ?`
      )
    ) {
      return;
    }
    const count = selectedOrdersList.length;
    for (const order of selectedOrdersList) {
      onUpdateStatus(order.id, "confirmee");
    }
    setSelectedIds(new Set());
    notify(`${count} commande(s) réintégrée(s) dans le Dashboard actif ✦`);
  };

  const openWhatsApp = (order: CheckoutOrder, trackingCode?: string) => {
    const clean = String(order.phone || "").replace(/\D/g, "");
    const intl = clean.startsWith("0") ? `213${clean.slice(1)}` : clean.startsWith("213") ? clean : `213${clean}`;
    const msg = `Bonjour ${order.customer || ""}, concernant votre commande ${order.id}${trackingCode ? ` (suivi ${trackingCode})` : ""} chez Miss Sensuelle…`;
    window.open(`https://wa.me/${intl}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  };

  const getStatusBadge = (trk?: TrackingData | null, order?: CheckoutOrder) => {
    const badge = buildTransferredCardStatusBadge(trk, order);
    return {
      ...badge,
      sub: badge.isFromHistory && badge.lastScan?.date
        ? `${formatCarrierStepDate(badge.lastScan.date)}${badge.lastScan.ville ? ` · ${badge.lastScan.ville}` : ""}`
        : badge.sub,
    };
  };

  const stageMeta: ReadonlyArray<{ id: HistoryStageId; label: string; color: string }> = [
    { id: "prep", label: "Préparation", color: "#64748b" },
    { id: "transit", label: "Transit / Hub", color: "#6366f1" },
    { id: "out_for_delivery", label: "Chez Livreur", color: "#0ea5e9" },
    { id: "no_answer", label: "Ne Répond Pas", color: "#f97316" },
    { id: "postponed", label: "Reporté", color: "#eab308" },
    { id: "delivered", label: "Livrées", color: "#10b981" },
    { id: "returned", label: "Retours / Échecs", color: "#ef4444" },
  ];

  const toggleFilter = (next: TransferredFilterKey) => {
    setFilterSituation(prev => (prev === next ? "all" : next));
  };

  const hasActiveFilters = filterSituation !== "all" || filterCarrier !== "all" || Boolean(search.trim());
  const latestDataUpdatedMs = Math.max(trackingQuery.dataUpdatedAt || 0, ecotrackTrackingQuery.dataUpdatedAt || 0);
  const syncClockText = latestDataUpdatedMs > 0
    ? new Date(latestDataUpdatedMs).toLocaleTimeString("fr-DZ", { hour: "2-digit", minute: "2-digit" })
    : lastSyncAt;
  const avgDurationLabel = analytics.avgDeliveryHours === null
    ? null
    : analytics.avgDeliveryHours < 24
      ? `${analytics.avgDeliveryHours}h`
      : `${Math.floor(analytics.avgDeliveryHours / 24)}j ${analytics.avgDeliveryHours % 24}h`;

  return (
    <div className="transferred-panel">
      {/* Compact Dashboard Executive Header */}
      <div className="trp-hero-card">
        <div className="trp-hero-main">
          <div className="trp-hero-badge-icon">
            <Truck size={20} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="trp-hero-title-row">
              <h1 className="trp-hero-title">
                Suivi & Réclamations <span>({analytics.totalCount})</span>
              </h1>
              <span className={`trp-live-chip${isTrackingFetching ? " is-syncing" : ""}`}>
                <span className="trp-live-dot" />
                {isTrackingFetching ? "Sync…" : `Live · ${syncClockText}`}
              </span>
            </div>
            <div className="trp-hero-meta-strip">
              <span className="trp-meta-pill">
                <Banknote size={12} /> {formatDZD(analytics.totalCodAmount)} COD
              </span>
              <span className="trp-meta-pill">
                <Activity size={12} /> {analytics.totalScans} scans ({analytics.trackedWithHistoryCount}/{analytics.totalCount})
              </span>
              {avgDurationLabel && (
                <span className="trp-meta-pill">
                  <Clock size={12} /> Délai {avgDurationLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="trp-hero-actions">
          <button
            type="button"
            className="trans-btn trp-btn-primary"
            onClick={() => void handleForceRefreshAll()}
            disabled={isTrackingFetching}
          >
            <RefreshCw size={14} className={isTrackingFetching ? "animate-spin" : ""} />
            <span>{isTrackingFetching ? "Sync…" : "Actualiser"}</span>
          </button>

          <button
            type="button"
            className="trans-btn trans-btn-export"
            onClick={() => exportCSV()}
            title="Exporter en CSV"
          >
            <FileDown size={14} />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Compact Dashboard-Style KPI Blocks */}
      <div className="trp-kpi-grid">
        <button
          type="button"
          className={`trp-kpi-card is-indigo${filterSituation === "encours" ? " is-active" : ""}`}
          onClick={() => toggleFilter("encours")}
        >
          <div className="trp-kpi-top">
            <span className="trp-kpi-label">En Circulation</span>
            <span className="trp-kpi-icon is-indigo"><Truck size={14} /></span>
          </div>
          <div className="trp-kpi-value-row">
            <span className="trp-kpi-value">{analytics.activeCount}</span>
            <span className="trp-kpi-badge is-indigo">
              {analytics.stages.out_for_delivery.count} livreur
            </span>
          </div>
          <div className="trp-kpi-foot">
            <span className="trp-kpi-amount">{formatDZD(analytics.activeCodAmount)}</span>
            <span className="trp-kpi-sub">{analytics.stages.prep.count} prép · {analytics.stages.transit.count} hub</span>
          </div>
        </button>

        <button
          type="button"
          className={`trp-kpi-card is-emerald${filterSituation === "delivered" ? " is-active" : ""}`}
          onClick={() => toggleFilter("delivered")}
        >
          <div className="trp-kpi-top">
            <span className="trp-kpi-label">Livrées</span>
            <span className="trp-kpi-icon is-green"><PackageCheck size={14} /></span>
          </div>
          <div className="trp-kpi-value-row">
            <span className="trp-kpi-value">{analytics.deliveredCount}</span>
            <span className="trp-kpi-badge is-green">{analytics.deliveryRatePct}%</span>
          </div>
          <div className="trp-kpi-foot">
            <span className="trp-kpi-amount">{formatDZD(analytics.deliveredAmount)}</span>
            <div className="trp-kpi-bar-track">
              <div
                className="trp-kpi-bar-fill"
                style={{ width: `${analytics.deliveryRatePct}%`, background: "linear-gradient(90deg, #10b981, #34d399)" }}
              />
            </div>
          </div>
        </button>

        <button
          type="button"
          className={`trp-kpi-card is-cyan${filterSituation === "delivered_cashed" ? " is-active" : ""}`}
          onClick={() => toggleFilter("delivered_cashed")}
        >
          <div className="trp-kpi-top">
            <span className="trp-kpi-label">Encaissées COD</span>
            <span className="trp-kpi-icon is-cyan"><ShieldCheck size={14} /></span>
          </div>
          <div className="trp-kpi-value-row">
            <span className="trp-kpi-value is-money">{formatDZD(analytics.cashedAmount)}</span>
            <span className="trp-kpi-badge is-cyan">
              {analytics.cashedCount}/{analytics.deliveredCount}
            </span>
          </div>
          <div className="trp-kpi-foot">
            <span className="trp-kpi-sub">
              {analytics.uncollectedDeliveredCount > 0
                ? `${analytics.uncollectedDeliveredCount} à enc. (${formatDZD(analytics.uncollectedDeliveredAmount)})`
                : `${analytics.cashCollectionRatePct}% encaissé`}
            </span>
            <div className="trp-kpi-bar-track">
              <div
                className="trp-kpi-bar-fill"
                style={{ width: `${analytics.cashCollectionRatePct}%`, background: "linear-gradient(90deg, #0ea5e9, #38bdf8)" }}
              />
            </div>
          </div>
        </button>

        <button
          type="button"
          className={`trp-kpi-card is-rose${filterSituation === "reclamation_urgent" ? " is-active" : ""}`}
          onClick={() => toggleFilter("reclamation_urgent")}
        >
          <div className="trp-kpi-top">
            <span className="trp-kpi-label">À Réclamer</span>
            <span className="trp-kpi-icon is-red"><AlertTriangle size={14} /></span>
          </div>
          <div className="trp-kpi-value-row">
            <span className="trp-kpi-value">{analytics.urgentReclamationCount}</span>
            <span className="trp-kpi-badge is-red">{analytics.returnedCount} ret. ({analytics.returnRatePct}%)</span>
          </div>
          <div className="trp-kpi-foot">
            <span className="trp-kpi-amount">{formatDZD(analytics.urgentReclamationAmount)}</span>
            <span className="trp-kpi-sub">{analytics.stalled48hCount} +48h · {analytics.multiAttemptsCount} rel.</span>
          </div>
        </button>
      </div>

      {/* Unified Overview, History Pipeline, Reclamation Queue & Search Console */}
      <div className="trp-overview-card">
        <div className="trp-overview-head">
          <div className="trp-overview-title-wrap">
            <Package size={15} className="trp-overview-icon" />
            <span className="trp-overview-title">Vue d'Ensemble & Étapes Historique</span>
            <span className="trp-overview-avg">Moy. {analytics.avgScansPerTracked} scans</span>
          </div>
          <div className="trp-overview-right">
            <span className="trp-swipe-hint">Glisser →</span>
            <span className="trp-filter-count-pill">
              <SlidersHorizontal size={11} />
              {filteredOrders.length} / {analytics.totalCount}
            </span>
          </div>
        </div>

        <div className="trp-progress-stack" aria-hidden="true">
          {stageMeta.map(st => {
            const metric = analytics.stages[st.id];
            if (metric.count <= 0) return null;
            return (
              <div
                key={st.id}
                className="trp-progress-seg"
                style={{
                  width: `${Math.max(metric.pct, 2)}%`,
                  background: st.color,
                  opacity: filterSituation === "all" || filterSituation === st.id ? 1 : 0.3,
                }}
                title={`${st.label}: ${metric.count} (${metric.pct}%)`}
              />
            );
          })}
        </div>

        {/* Compact 7 Stage Dashboard Chips */}
        <div className="trp-stages-grid">
          {stageMeta.map(st => {
            const metric = analytics.stages[st.id];
            const isActive = filterSituation === st.id;
            return (
              <button
                key={st.id}
                type="button"
                className={`trp-stage-btn${isActive ? " is-active" : ""}`}
                onClick={() => toggleFilter(st.id)}
              >
                <div className="trp-stage-head">
                  <span className="trp-stage-dot" style={{ background: st.color }} />
                  <span className="trp-stage-name">{st.label}</span>
                  <span className="trp-stage-count">{metric.count}</span>
                </div>
                <div className="trp-stage-sub">
                  <span>{metric.pct}%</span>
                  <span>{formatDZD(metric.amount)}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Agent de Réclamation 1-Tap Fluid Queues */}
        <div className="trp-signals-row" role="group" aria-label="Files agent de réclamation">
          <button
            type="button"
            className={`trp-signal-chip${!hasActiveFilters ? " is-active" : ""}`}
            onClick={() => {
              setFilterSituation("all");
              setFilterCarrier("all");
              setSearch("");
            }}
          >
            <span>Tout <strong>({analytics.totalCount})</strong></span>
          </button>

          <button
            type="button"
            className={`trp-signal-chip is-urgent${filterSituation === "reclamation_urgent" ? " is-active" : ""}`}
            onClick={() => toggleFilter("reclamation_urgent")}
          >
            <AlertTriangle size={12} />
            <span>À Réclamer <strong>({analytics.urgentReclamationCount})</strong></span>
          </button>

          <button
            type="button"
            className={`trp-signal-chip ${analytics.stalled48hCount > 0 ? "is-danger" : ""}${filterSituation === "stalled_48h" ? " is-active" : ""}`}
            onClick={() => toggleFilter("stalled_48h")}
          >
            <Clock size={12} />
            <span>+48h sans scan <strong>({analytics.stalled48hCount})</strong></span>
          </button>

          <button
            type="button"
            className={`trp-signal-chip ${analytics.multiAttemptsCount > 0 ? "is-warn" : ""}${filterSituation === "multi_attempts" ? " is-active" : ""}`}
            onClick={() => toggleFilter("multi_attempts")}
          >
            <PhoneMissed size={12} />
            <span>2+ tentatives <strong>({analytics.multiAttemptsCount})</strong></span>
          </button>

          <button
            type="button"
            className={`trp-signal-chip ${analytics.uncollectedDeliveredCount > 0 ? "is-warn" : ""}${filterSituation === "delivered_uncollected" ? " is-active" : ""}`}
            onClick={() => toggleFilter("delivered_uncollected")}
          >
            <Banknote size={12} />
            <span>Non encaissées <strong>({analytics.uncollectedDeliveredCount})</strong></span>
          </button>

          <button
            type="button"
            className={`trp-signal-chip is-success${filterSituation === "delivered_cashed" ? " is-active" : ""}`}
            onClick={() => toggleFilter("delivered_cashed")}
          >
            <ShieldCheck size={12} />
            <span>Encaissées <strong>({analytics.cashedCount})</strong></span>
          </button>

          <button
            type="button"
            className={`trp-signal-chip ${analytics.returnedCount > 0 ? "is-danger" : ""}${filterSituation === "returned" ? " is-active" : ""}`}
            onClick={() => toggleFilter("returned")}
          >
            <RotateCcw size={12} />
            <span>Retours <strong>({analytics.returnedCount})</strong></span>
          </button>

          {analytics.recoveredCount > 0 && (
            <span className="trp-signal-chip is-info">
              <Check size={12} />
              <span>Recouvrées <strong>({analytics.recoveredCount})</strong></span>
            </span>
          )}
        </div>

        {/* Integrated Search & Carrier Bar */}
        <div className="trp-search-strip">
          <div className="trans-search-box trp-search-compact">
            <Search size={15} className="trans-search-icon" />
            <input
              type="search"
              name="transferred-order-search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Rechercher client, tél, wilaya, n° commande, tracking…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="trans-clear-search"
                onClick={() => setSearch("")}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="trp-toolbar-right">
            <div
              className="trans-carrier-filters"
              role="group"
              aria-label="Filtrer par société de livraison"
              style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}
            >
              {[
                { id: "all" as const, label: `Toutes (${carrierCounts.all})` },
                { id: "ecotrack" as const, label: `🚚 ${ecoCarrierName} (${carrierCounts.ecotrack})` },
                { id: "ecom" as const, label: `📦 E-com (${carrierCounts.ecom})` },
                ...(carrierCounts.other > 0
                  ? [{ id: "other" as const, label: `📋 Autres (${carrierCounts.other})` }]
                  : []),
              ].map(opt => {
                const active = filterCarrier === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`trans-carrier-pill-btn${active ? " is-active" : ""}`}
                    onClick={() => setFilterCarrier(opt.id)}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                className="trp-reset-btn"
                onClick={() => {
                  setFilterSituation("all");
                  setFilterCarrier("all");
                  setSearch("");
                }}
              >
                <X size={12} />
                <span>Réinitialiser</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live visible count, Select-All & quick reset bar */}
      <div className="trp-results-bar">
        <span className="trp-results-count">
          Affichées : <strong>{filteredOrders.length}</strong> / {transferredOrders.length} commande
          {transferredOrders.length > 1 ? "s" : ""}
        </span>
        <div className="trp-results-actions">
          {filteredOrders.length > 0 && (
            <button
              type="button"
              className={`trp-select-all-btn${allFilteredSelected ? " is-active" : ""}`}
              onClick={toggleSelectAllFiltered}
            >
              <Check size={12} />
              <span>
                {allFilteredSelected
                  ? `Tout désélectionner (${selectedInViewCount})`
                  : `Tout sélectionner (${filteredOrders.length})`}
              </span>
            </button>
          )}
          {hasActiveFilters && (
            <button
              type="button"
              className="trp-results-reset-btn"
              onClick={() => {
                setFilterSituation("all");
                setFilterCarrier("all");
                setSearch("");
              }}
            >
              <X size={12} />
              <span>Tout afficher ({transferredOrders.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Bulk actions bar for selected parcels */}
      {selectedOrdersList.length > 0 && (
        <div className="trp-bulk-bar">
          <div className="trp-bulk-info">
            <span className="trp-bulk-badge">{selectedOrdersList.length}</span>
            <span>
              colis sélectionné{selectedOrdersList.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="trp-bulk-actions">
            <button
              type="button"
              className="trp-bulk-btn"
              onClick={() => exportCSV(selectedOrdersList)}
            >
              <FileDown size={13} />
              <span>Exporter CSV ({selectedOrdersList.length})</span>
            </button>
            <button
              type="button"
              className="trp-bulk-btn"
              onClick={copySelectedTrackingList}
            >
              <Copy size={13} />
              <span>Copier bordereaux ({selectedOrdersList.length})</span>
            </button>
            <button
              type="button"
              className="trp-bulk-btn is-revert"
              onClick={handleBulkRapatrier}
            >
              <ArrowLeftRight size={13} />
              <span>Rapatrier ({selectedOrdersList.length})</span>
            </button>
            <button
              type="button"
              className="trp-bulk-clear"
              onClick={() => setSelectedIds(new Set())}
              title="Effacer la sélection"
              aria-label="Effacer la sélection"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Orders List / Empty State */}
      {filteredOrders.length === 0 ? (
        <div className="transferred-empty">
          <PackageCheck size={48} className="transferred-empty-icon" />
          <h3>Aucune commande transférée trouvée</h3>
          <p>
            {search || filterSituation !== "all" || filterCarrier !== "all"
              ? "Aucun résultat pour vos filtres de recherche."
              : "Dès que vous validez une commande et cliquez sur Transférer, elle apparaîtra ici avec son suivi direct."}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              className="trp-results-reset-btn is-large"
              onClick={() => {
                setFilterSituation("all");
                setFilterCarrier("all");
                setSearch("");
              }}
            >
              Tout afficher ({transferredOrders.length})
            </button>
          )}
        </div>
      ) : (
        <div className="transferred-cards-grid">
          {filteredOrders.map(order => {
            const isEcoTrack = Boolean(ecoShipments[order.id]) || order.carrier === "ecotrack";
            const sh = isEcoTrack
              ? (ecoShipments[order.id] || shipments[order.id])
              : (ecomShipments[order.id] || shipments[order.id]);
            const tracking = sh?.tracking?.trim();
            const trk = findTrackingData(trackingMap, tracking);
            const badge = getStatusBadge(trk, order);
            const latestScan = badge.lastScan || getLatestCarrierHistoryStep(trk);
            const isFocused = Boolean(focusedOrderId && focusedOrderId === order.id);
            const isSelected = selectedIds.has(order.id);
            const fullDest = `${order.wilaya}${order.commune ? ` — ${order.commune}` : ""}${order.address ? ` (${order.address})` : ""}`;

            return (
              <div
                key={order.id}
                data-order-id={order.id}
                className={`trans-order-card gcome-trans-card ${badge.cardClass}${isFocused ? " is-focused-order" : ""}${isSelected ? " is-selected-card" : ""}`}
              >
                {isFocused && (
                  <div className="trans-focus-banner">
                    <span>📌 Commande ciblée · Statut : {badge.label}</span>
                    {onClearFocusedOrder && (
                      <button
                        type="button"
                        onClick={onClearFocusedOrder}
                        aria-label="Fermer la mise en avant"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                )}

                {/* Ligne 1 : ID + Transporteur + Tracking à gauche | Dernier Statut Historique à droite */}
                <div className="trans-card-header">
                  <div className="trans-card-ids">
                    <div className="trans-compact-id-line">
                      <input
                        type="checkbox"
                        className="trp-card-checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOrder(order.id)}
                        aria-label={`Sélectionner le colis ${order.id}`}
                      />
                      <span className="trans-order-id">{order.id}</span>
                      <span className={`trans-carrier-pill${isEcoTrack ? " is-ecotrack" : ""}`}>
                        <Truck size={10} />
                        {isEcoTrack ? ecoCarrierName : "E-com"}
                      </span>
                      {tracking && (
                        <button
                          type="button"
                          className="trans-tracking-pill"
                          onClick={() => copyText(tracking, "N° de tracking", order.id)}
                          title="Cliquer pour copier le N° de suivi"
                        >
                          <span>{tracking}</span>
                          {copiedId === order.id ? <Check size={10} /> : <Copy size={10} />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div
                    className={`trans-status-badge ${badge.cls}`}
                    title={
                      badge.isFromHistory
                        ? "Dernier statut de l'historique transporteur"
                        : "Statut transporteur"
                    }
                  >
                    <span className="trans-badge-dot">{badge.icon}</span>
                    <div className="trans-badge-copy">
                      <span className="trans-badge-text">{badge.label}</span>
                      <span className="trans-badge-sub">{badge.sub}</span>
                    </div>
                  </div>
                </div>

                {/* Ligne 2 : Client + Tel/WhatsApp à gauche | Montant + Encaissé à droite */}
                <div className="trans-card-body">
                  <div className="trans-info-row">
                    <div className="trans-customer-box">
                      <div className="trans-customer-name" title={order.customer}>
                        {order.customer}
                      </div>
                      <div className="trans-phone-row">
                        <button
                          type="button"
                          className="trans-customer-phone"
                          onClick={() => callPhone(order.phone)}
                          title="Appeler le client"
                        >
                          <Phone size={11} />
                          <span>{order.phone}</span>
                        </button>
                        <button
                          type="button"
                          className="trans-mini-wa-btn"
                          onClick={() => openWhatsApp(order, tracking)}
                          title="Envoyer un message WhatsApp"
                          aria-label="WhatsApp"
                        >
                          <MessageCircle size={11} />
                        </button>
                      </div>
                    </div>

                    <div className="trans-price-box">
                      <div className="trans-price-amount">{formatDZD(order.total)}</div>
                      {trk?.encaisser ? (
                        <span className="trans-paid-pill">
                          <ShieldCheck size={10} /> Encaissé
                        </span>
                      ) : isCarrierTrackingDelivered(trk) || order.isDelivered ? (
                        <span className="trans-paid-pill is-uncollected">
                          <ShieldCheck size={10} /> Non encaissé
                        </span>
                      ) : (
                        <span className="trans-unpaid-pill">À encaisser</span>
                      )}
                    </div>
                  </div>

                  {/* Ligne 3 : Résumé produit sans photo + Destination compacte */}
                  <div className="trans-compact-product-box">
                    <div className="trans-compact-prod-line" title={order.product}>
                      <strong className="trans-compact-prod-title">{order.product}</strong>
                      {order.color && <span className="trans-chip-color">{order.color}</span>}
                      {order.size && <span className="trans-chip-size">{order.size}</span>}
                      {order.delivery && (
                        <span className="trans-chip-size">
                          {order.delivery === "office" ? "Stop Desk" : "Domicile"}
                        </span>
                      )}
                    </div>
                    <div className="trans-destination-line" title={fullDest}>
                      <MapPin size={10} />
                      <span>{fullDest}</span>
                    </div>
                  </div>

                  {/* Ligne 4 : Note Dernier Scan (1 ligne compacte) */}
                  {latestScan && (
                    <div
                      className="trans-carrier-last-event"
                      title={`${latestScan.situation}${latestScan.commentaire ? ` — ${latestScan.commentaire}` : ""}`}
                    >
                      <Clock size={10} />
                      <span>
                        <strong>{latestScan.situation}</strong>
                        {latestScan.commentaire ? ` — ${latestScan.commentaire}` : ""}
                      </span>
                    </div>
                  )}
                </div>

                {/* Ligne 4 : Actions sur 1 seule rangée compacte */}
                <div className="trans-card-footer gcome-trans-footer">
                  <button
                    type="button"
                    className="trans-act-btn trans-act-call"
                    onClick={() => callPhone(order.phone)}
                    title="Appeler le client"
                  >
                    <Phone size={13} />
                    <span>Appeler</span>
                  </button>

                  <button
                    type="button"
                    className="trans-act-btn trans-act-copy"
                    onClick={() => copyParcelSlip(order, tracking, isEcoTrack)}
                    title="Copier les détails du bordereau"
                  >
                    <Copy size={13} />
                    <span>Bordereau</span>
                  </button>

                  {trk?.historique && trk.historique.length > 0 && (
                    <button
                      type="button"
                      className="trans-act-btn trans-act-timeline"
                      onClick={() => setSelectedTimelineOrder({ order, tracking: trk })}
                      title="Voir l'historique complet des scans du transporteur"
                    >
                      <Eye size={13} />
                      <span>Historique ({trk.historique.length})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="trans-act-btn trans-act-revert"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Rapatrier la commande ${order.id} (${order.customer}) vers le Dashboard actif ?`
                        )
                      ) {
                        onUpdateStatus(order.id, "confirmee");
                        notify(`Commande ${order.id} réintégrée dans le Dashboard actif ✦`);
                      }
                    }}
                    title="Rapatrier vers le Dashboard actif"
                  >
                    <ArrowLeftRight size={13} />
                    <span>Rapatrier</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Timeline Modal */}
      {selectedTimelineOrder && (
        <div className="trans-modal-overlay" onClick={() => setSelectedTimelineOrder(null)}>
          <div className="trans-modal-content" onClick={e => e.stopPropagation()}>
            <div className="trans-modal-header">
              <div className="trans-modal-title">
                <Truck size={20} className="text-purple-400" />
                <div>
                  <h3>Historique Transporteur</h3>
                  <div className="text-sm opacity-70">
                    Commande {selectedTimelineOrder.order.id} · Suivi {selectedTimelineOrder.tracking?.tracking}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="trans-modal-close"
                onClick={() => setSelectedTimelineOrder(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="trans-timeline-list">
              {selectedTimelineOrder.tracking?.historique?.map((step, idx) => (
                <div key={idx} className="trans-timeline-item">
                  <div className="trans-timeline-marker" />
                  <div className="trans-timeline-body">
                    <div className="trans-timeline-time">
                      <Calendar size={12} />
                      {formatCarrierStepDate(step.date)}
                      {step.ville ? ` · ${step.ville}` : ""}
                    </div>
                    <div className="trans-timeline-situation">{step.situation}</div>
                    {step.commentaire && (
                      <div className="trans-timeline-comment">{step.commentaire}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="trans-modal-footer">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setSelectedTimelineOrder(null)}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
