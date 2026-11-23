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
} from "lucide-react";
import type { CheckoutOrder } from "@shared/checkout";
import { classifyCarrierTracking, isCarrierTrackingDelivered } from "@shared/carrierStatus";
import {
  computeTransferredHistoryAnalytics,
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
}: TransferredOrdersPanelProps) {
  const [search, setSearch] = useState("");
  const [filterSituation, setFilterSituation] = useState<TransferredFilterKey>("all");
  const [filterCarrier, setFilterCarrier] = useState<"all" | "ecotrack" | "ecom" | "other">("all");
  const [lastSyncAt, setLastSyncAt] = useState<string>(() =>
    new Date().toLocaleTimeString("fr-DZ", { hour: "2-digit", minute: "2-digit" })
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const syncedDeliveredIdsRef = useRef<Set<string>>(new Set());
  const [selectedTimelineOrder, setSelectedTimelineOrder] = useState<{
    order: CheckoutOrder;
    tracking?: TrackingData;
  } | null>(null);

  // E-com & EcoTrack status & live refresh mutations
  const utils = trpc.useUtils();
  const initialEcoForcedRef = useRef(false);
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
    refetchOnMount: "always",
    staleTime: 0,
  });
  const ecotrackStatusQuery = trpc.ecotrack.status.useQuery(undefined, {
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
    staleTime: 0,
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

  // Batch tracking queries (E-com + EcoTrack)
  const trackingQuery = trpc.ecom.trackBatch.useQuery(
    { trackings: ecomTrackings },
    {
      enabled: ecomTrackings.length > 0,
      refetchInterval: 45000,
      refetchOnMount: "always",
      staleTime: 0,
      refetchOnWindowFocus: false,
    }
  );
  const ecotrackTrackingQuery = trpc.ecotrack.trackBatch.useQuery(
    { trackings: ecoTrackings },
    {
      enabled: ecoTrackings.length > 0,
      refetchInterval: 45000,
      refetchOnMount: "always",
      staleTime: 0,
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

  // Trigger a live cache-bypass sync for DHD on first view load
  useEffect(() => {
    if (ecoTrackings.length > 0 && !initialEcoForcedRef.current) {
      initialEcoForcedRef.current = true;
      void ecotrackRefreshMutation
        .mutateAsync({ trackings: ecoTrackings })
        .then(() => {
          setLastSyncAt(new Date().toLocaleTimeString("fr-DZ", { hour: "2-digit", minute: "2-digit" }));
          if (onRefreshOrders) onRefreshOrders();
        })
        .catch(() => {});
    }
  }, [ecoTrackings]);

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

  // Filtered by search, carrier, history stage & diagnostic alerts
  const filteredOrders = useMemo(() => {
    return transferredOrders.filter(o => {
      if (filterCarrier !== "all" && getOrderCarrier(o) !== filterCarrier) {
        return false;
      }

      const info = inspectionMap.get(o.id);
      if (filterSituation !== "all" && info && !matchesTransferredFilter(filterSituation, info)) {
        return false;
      }

      if (!search.trim()) return true;
      const sh = ecoShipments[o.id] || ecomShipments[o.id] || shipments[o.id];
      const q = search.toLowerCase();
      const matchTrk = sh?.tracking?.toLowerCase().includes(q);
      const matchOrder = `${o.id} ${o.customer} ${o.phone} ${o.wilaya} ${o.commune} ${o.product}`
        .toLowerCase()
        .includes(q);
      return matchOrder || matchTrk;
    });
  }, [transferredOrders, shipments, ecoShipments, ecomShipments, inspectionMap, search, filterSituation, filterCarrier]);

  const exportCSV = () => {
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

    const rows = filteredOrders.map(o => {
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
    notify("Export CSV des commandes transférées téléchargé ✦");
  };

  const getStatusBadge = (trk?: TrackingData | null) => {
    const cat = classifyCarrierTracking(trk);
    const situation = trk?.situation;
    const etatLogistique = trk?.etat_logistique;
    if (cat === "delivered") {
      return {
        label: "Livré",
        cls: "trans-badge-livre",
        icon: "🟢",
        sub: etatLogistique || situation || "Colis remis au client",
      };
    }
    if (cat === "no_answer") {
      return {
        label: "Ne Répond Pas (Livreur)",
        cls: "trans-badge-norepond",
        icon: "📞",
        sub: etatLogistique || situation || "Tentative d'appel livreur",
      };
    }
    if (cat === "postponed") {
      return {
        label: "Reporté",
        cls: "trans-badge-reporte",
        icon: "📅",
        sub: etatLogistique || situation || "Reprogrammé avec le client",
      };
    }
    if (cat === "returned") {
      return {
        label: "Retour / Refusé",
        cls: "trans-badge-retour",
        icon: "↩️",
        sub: etatLogistique || situation || "En cours de retour",
      };
    }
    return {
      label: "En Transit / Livraison",
      cls: "trans-badge-encours",
      icon: "🚚",
      sub: etatLogistique || situation || "En Préparation / Expédié",
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
      {/* Executive Header */}
      <div className="trp-hero-card">
        <div className="trp-hero-main">
          <div className="trp-hero-badge-icon">
            <Truck size={24} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="trp-hero-eyebrow-row">
              <span className={`trp-live-chip${isTrackingFetching ? " is-syncing" : ""}`}>
                <span className="trp-live-dot" />
                {isTrackingFetching ? "Synchronisation…" : "Suivi Historique Live"}
              </span>
              <span className="trp-sync-time">MAJ {syncClockText}</span>
            </div>
            <h1 className="trp-hero-title">
              Expéditions & Suivi Historique <span>({analytics.totalCount})</span>
            </h1>
            <div className="trp-hero-meta-strip">
              <span className="trp-meta-pill">
                <Banknote size={13} /> COD total : {formatDZD(analytics.totalCodAmount)}
              </span>
              <span className="trp-meta-pill">
                <Activity size={13} /> {analytics.totalScans} scans historiques ({analytics.trackedWithHistoryCount}/{analytics.totalCount} suivis)
              </span>
              {avgDurationLabel && (
                <span className="trp-meta-pill">
                  <Clock size={13} /> Délai moy. livraison : {avgDurationLabel}
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
            <RefreshCw size={15} className={isTrackingFetching ? "animate-spin" : ""} />
            <span>{isTrackingFetching ? "Synchronisation…" : "Actualiser Suivis"}</span>
          </button>

          <button
            type="button"
            className="trans-btn trans-btn-export"
            onClick={exportCSV}
            title="Exporter en CSV"
          >
            <FileDown size={15} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Executive KPI Cards */}
      <div className="trp-kpi-grid">
        <button
          type="button"
          className={`trp-kpi-card${filterSituation === "encours" ? " is-active" : ""}`}
          onClick={() => toggleFilter("encours")}
        >
          <div className="trp-kpi-top">
            <span className="trp-kpi-label">En Circulation</span>
            <span className="trp-kpi-icon is-indigo"><Truck size={15} /></span>
          </div>
          <div className="trp-kpi-value-row">
            <span className="trp-kpi-value">{analytics.activeCount}</span>
            <span className="trp-kpi-badge is-indigo">
              {analytics.stages.out_for_delivery.count} livreur
            </span>
          </div>
          <div className="trp-kpi-amount">{formatDZD(analytics.activeCodAmount)}</div>
          <div className="trp-kpi-sub">
            {analytics.stages.prep.count} prép. · {analytics.stages.transit.count} transit
          </div>
        </button>

        <button
          type="button"
          className={`trp-kpi-card${filterSituation === "delivered" ? " is-active" : ""}`}
          onClick={() => toggleFilter("delivered")}
        >
          <div className="trp-kpi-top">
            <span className="trp-kpi-label">Livrées</span>
            <span className="trp-kpi-icon is-green"><PackageCheck size={15} /></span>
          </div>
          <div className="trp-kpi-value-row">
            <span className="trp-kpi-value">{analytics.deliveredCount}</span>
            <span className="trp-kpi-badge is-green">{analytics.deliveryRatePct}%</span>
          </div>
          <div className="trp-kpi-amount">{formatDZD(analytics.deliveredAmount)}</div>
          <div className="trp-kpi-bar-track">
            <div
              className="trp-kpi-bar-fill"
              style={{ width: `${analytics.deliveryRatePct}%`, background: "#10b981" }}
            />
          </div>
        </button>

        <button
          type="button"
          className={`trp-kpi-card${filterSituation === "delivered_cashed" ? " is-active" : ""}`}
          onClick={() => toggleFilter("delivered_cashed")}
        >
          <div className="trp-kpi-top">
            <span className="trp-kpi-label">Trésorerie Encaissée</span>
            <span className="trp-kpi-icon is-cyan"><ShieldCheck size={15} /></span>
          </div>
          <div className="trp-kpi-value-row">
            <span className="trp-kpi-value" style={{ fontSize: "20px" }}>
              {formatDZD(analytics.cashedAmount)}
            </span>
            <span className="trp-kpi-badge is-cyan">
              {analytics.cashedCount}/{analytics.deliveredCount}
            </span>
          </div>
          <div className="trp-kpi-sub">
            {analytics.uncollectedDeliveredCount > 0
              ? `${analytics.uncollectedDeliveredCount} livrées à encaisser (${formatDZD(analytics.uncollectedDeliveredAmount)})`
              : `${analytics.cashCollectionRatePct}% des livrées encaissées`}
          </div>
          <div className="trp-kpi-bar-track">
            <div
              className="trp-kpi-bar-fill"
              style={{ width: `${analytics.cashCollectionRatePct}%`, background: "#0ea5e9" }}
            />
          </div>
        </button>

        <button
          type="button"
          className={`trp-kpi-card${filterSituation === "returned" ? " is-active" : ""}`}
          onClick={() => toggleFilter("returned")}
        >
          <div className="trp-kpi-top">
            <span className="trp-kpi-label">Retours & Échecs</span>
            <span className="trp-kpi-icon is-red"><RotateCcw size={15} /></span>
          </div>
          <div className="trp-kpi-value-row">
            <span className="trp-kpi-value">{analytics.returnedCount}</span>
            <span className="trp-kpi-badge is-red">{analytics.returnRatePct}%</span>
          </div>
          <div className="trp-kpi-amount">{formatDZD(analytics.returnedAmount)}</div>
          <div className="trp-kpi-sub">
            {analytics.totalAttemptScans} tentatives de livraison enregistrées
          </div>
        </button>
      </div>

      {/* Carrier History Pipeline & Diagnostic Signals */}
      <div className="trp-pipeline-card">
        <div className="trp-pipeline-head">
          <div className="trp-pipeline-title">
            <Package size={16} />
            <span>Étapes du Parcours Colis</span>
          </div>
          <span className="trp-swipe-hint">Glisser →</span>
          <div className="trp-pipeline-summary">
            Moy. {analytics.avgScansPerTracked} scans/colis · Cliquez sur une étape pour filtrer
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
                <div className="trp-stage-top">
                  <span className="trp-stage-dot" style={{ background: st.color }} />
                  <span className="trp-stage-pct">{metric.pct}%</span>
                </div>
                <div className="trp-stage-count">{metric.count}</div>
                <div className="trp-stage-name">{st.label}</div>
                <div className="trp-stage-amount">{formatDZD(metric.amount)}</div>
              </button>
            );
          })}
        </div>

        <div className="trp-signals-row">
          <button
            type="button"
            className={`trp-signal-chip ${analytics.stalled48hCount > 0 ? "is-danger" : ""}${filterSituation === "stalled_48h" ? " is-active" : ""}`}
            onClick={() => toggleFilter("stalled_48h")}
          >
            <AlertTriangle size={13} />
            <span>Bloqués +48h sans scan : <strong>{analytics.stalled48hCount}</strong></span>
          </button>

          <button
            type="button"
            className={`trp-signal-chip ${analytics.multiAttemptsCount > 0 ? "is-warn" : ""}${filterSituation === "multi_attempts" ? " is-active" : ""}`}
            onClick={() => toggleFilter("multi_attempts")}
          >
            <PhoneMissed size={13} />
            <span>2+ tentatives / relances : <strong>{analytics.multiAttemptsCount}</strong></span>
          </button>

          <button
            type="button"
            className={`trp-signal-chip ${analytics.uncollectedDeliveredCount > 0 ? "is-warn" : ""}${filterSituation === "delivered_uncollected" ? " is-active" : ""}`}
            onClick={() => toggleFilter("delivered_uncollected")}
          >
            <Banknote size={13} />
            <span>Livrées non encaissées : <strong>{analytics.uncollectedDeliveredCount}</strong></span>
          </button>

          <button
            type="button"
            className={`trp-signal-chip is-success${filterSituation === "delivered_cashed" ? " is-active" : ""}`}
            onClick={() => toggleFilter("delivered_cashed")}
          >
            <ShieldCheck size={13} />
            <span>Encaissées confirmées : <strong>{analytics.cashedCount}</strong></span>
          </button>

          {analytics.recoveredCount > 0 && (
            <span className="trp-signal-chip is-info">
              <Check size={13} />
              <span>Recouvrées : <strong>{analytics.recoveredCount}</strong> ({formatDZD(analytics.recoveredAmount)})</span>
            </span>
          )}
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="trp-toolbar">
        <div className="trans-search-box">
          <Search size={16} className="trans-search-icon" />
          <input
            type="text"
            placeholder="Rechercher par client, téléphone, wilaya, n° commande ou tracking…"
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
              { id: "ecom" as const, label: `📦 E-com Delivery (${carrierCounts.ecom})` },
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

          <span className="trp-filter-count-pill">
            <SlidersHorizontal size={12} />
            {filteredOrders.length} / {analytics.totalCount}
          </span>

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
              <X size={13} />
              <span>Réinitialiser</span>
            </button>
          )}
        </div>
      </div>

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
            const badge = getStatusBadge(trk);

            return (
              <div key={order.id} className="trans-order-card">
                {/* Card Top */}
                <div className="trans-card-header">
                  <div className="trans-card-ids">
                    <span className="trans-order-id">{order.id}</span>
                    <span className={`trans-carrier-pill${isEcoTrack ? " is-ecotrack" : ""}`}>
                      <Truck size={12} />
                      {isEcoTrack ? ecoCarrierName : "E-com Delivery"}
                    </span>
                    {tracking && (
                      <button
                        type="button"
                        className="trans-tracking-pill"
                        onClick={() => copyText(tracking, "N° de tracking", order.id)}
                        title="Cliquer pour copier le N° de suivi"
                      >
                        <span>{tracking}</span>
                        {copiedId === order.id ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    )}
                  </div>

                  <div className={`trans-status-badge ${badge.cls}`}>
                    <span className="trans-badge-dot">{badge.icon}</span>
                    <div>
                      <span className="trans-badge-text">{badge.label}</span>
                      <span className="trans-badge-sub">{badge.sub}</span>
                    </div>
                  </div>
                </div>

                {/* Customer & Delivery details */}
                <div className="trans-card-body">
                  <div className="trans-info-row">
                    <div className="trans-customer-box">
                      <div className="trans-customer-name">{order.customer}</div>
                      <div className="trans-customer-phone">
                        <Phone size={13} />
                        <span>{order.phone}</span>
                      </div>
                    </div>

                    <div className="trans-price-box">
                      <div className="trans-price-amount">{formatDZD(order.total)}</div>
                      {trk?.encaisser ? (
                        <span className="trans-paid-pill">
                          <ShieldCheck size={11} /> Encaissé
                        </span>
                      ) : isCarrierTrackingDelivered(trk) ? (
                        <span className="trans-paid-pill">
                          <ShieldCheck size={11} /> Livré · Non encaissé
                        </span>
                      ) : (
                        <span className="trans-unpaid-pill">
                          À encaisser
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="trans-product-info">
                    <div className="trans-product-line">
                      <strong>Produit :</strong> {order.product}
                      {order.color && <span className="trans-chip-color">{order.color}</span>}
                      {order.size && <span className="trans-chip-size">{order.size}</span>}
                    </div>

                    <div className="trans-destination-line">
                      <MapPin size={13} />
                      <span>
                        {order.wilaya} {order.commune ? `— ${order.commune}` : ""}
                        {order.address ? ` (${order.address})` : ""}
                      </span>
                    </div>
                  </div>

                  {/* Carrier Latest Log Note if available */}
                  {trk?.historique && trk.historique.length > 0 && (
                    <div className="trans-carrier-last-event">
                      <Clock size={12} />
                      <span>
                        Dernier scan : <strong>{trk.historique[trk.historique.length - 1].situation}</strong>
                        {trk.historique[trk.historique.length - 1].commentaire
                          ? ` — ${trk.historique[trk.historique.length - 1].commentaire}`
                          : ""}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="trans-card-footer">
                  <button
                    type="button"
                    className="trans-act-btn trans-act-call"
                    onClick={() => callPhone(order.phone)}
                    title="Appeler le client"
                  >
                    <Phone size={14} />
                    <span>Appeler</span>
                  </button>

                  <button
                    type="button"
                    className="trans-act-btn trans-act-copy"
                    onClick={() => copyParcelSlip(order, tracking, isEcoTrack)}
                    title="Copier les détails du bordereau"
                  >
                    <Copy size={14} />
                    <span>Bordereau</span>
                  </button>

                  {trk?.historique && trk.historique.length > 0 && (
                    <button
                      type="button"
                      className="trans-act-btn trans-act-timeline"
                      onClick={() => setSelectedTimelineOrder({ order, tracking: trk })}
                      title="Voir l'historique complet des scans du transporteur"
                    >
                      <Eye size={14} />
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
                    <ArrowLeftRight size={14} />
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
