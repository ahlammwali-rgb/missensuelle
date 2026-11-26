import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlarmClock,
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Edit3,
  ExternalLink,
  History,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  PhoneOff,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  UserCheck,
  XCircle,
} from "lucide-react";
import { formatDZD, getCatalogProducts, type Order, type OrderStatus } from "@/lib/store-data";
import { formatOrderDate, getOrderStats, parseOrderDate } from "@/lib/admin-orders";
import type { VisitAnalyticsData } from "@shared/siteVisits";
import { VisitsAnalyticsChart } from "@/components/VisitsAnalyticsChart";
import {
  GcomeKpiBellIcon,
  GcomeKpiChartIcon,
  GcomeKpiCheckIcon,
  GcomeKpiWalletIcon,
  GcomeWhatsAppLogo,
} from "@/components/GcomeIcons";

type Props = {
  orders: Order[];
  allOrders?: Order[];
  filtered: Order[];
  activeStatus: "all" | OrderStatus;
  setActiveStatus: (value: "all" | OrderStatus) => void;
  query: string;
  setQuery: (value: string) => void;
  period: string;
  setPeriod: (value: string) => void;
  onSelect: (order: Order) => void;
  onCall: (phone: string) => void;
  onCallOrder?: (order: Order) => void;
  onWhatsAppOrder?: (order: Order) => void;
  onOpenHistory?: (order: Order) => void;
  onOpenPostponeModal?: (order: Order) => void;
  onOpenCancelModal?: (order: Order) => void;
  onSetNrpLevel?: (id: string, level: 1 | 2 | 3) => void;
  onExport: () => void;
  onCreateOrder?: () => void;
  onUpdateStatus?: (id: string, status: OrderStatus) => void;
  onSetCarrier?: (id: string, carrier: "ecom" | "ecotrack") => void;
  heroBanner?: ReactNode;
  stockPanel: ReactNode;
  visitAnalytics?: VisitAnalyticsData;
  visitAnalyticsLoading?: boolean;
  visitAnalyticsFetching?: boolean;
  onRefreshVisits?: () => void;
};

const activeDashboardStatuses: OrderStatus[] = ["nouvelle", "confirmee", "reportee", "ne_repond_pas", "annulee"];

const labels: Record<OrderStatus, { label: string; icon: string }> = {
  nouvelle: { label: "Nouvelles", icon: "🟡" },
  confirmee: { label: "Confirmées", icon: "🟢" },
  transferee: { label: "Transférées", icon: "🟣" },
  reportee: { label: "Reportées", icon: "🔵" },
  ne_repond_pas: { label: "Sans réponse", icon: "🟠" },
  annulee: { label: "Annulées", icon: "🔴" },
};

const statusMeta: Record<OrderStatus, { label: string; badgeClass: string; cardClass: string }> = {
  nouvelle: {
    label: "Nouvelle commande",
    badgeClass: "badge-status-nouvelle",
    cardClass: "card-status-nouvelle",
  },
  confirmee: {
    label: "Confirmée",
    badgeClass: "badge-status-confirmee",
    cardClass: "card-status-confirmee",
  },
  transferee: {
    label: "Transférée E-com",
    badgeClass: "badge-status-transferee",
    cardClass: "card-status-transferee",
  },
  reportee: {
    label: "Reportée",
    badgeClass: "badge-status-reportee",
    cardClass: "card-status-reportee",
  },
  ne_repond_pas: {
    label: "Sans réponse",
    badgeClass: "badge-status-ne_repond_pas",
    cardClass: "card-status-ne_repond_pas",
  },
  annulee: {
    label: "Annulée",
    badgeClass: "badge-status-annulee",
    cardClass: "card-status-annulee",
  },
};

const PAGE_SIZE = 40;

function KpiSparkline({
  color,
  gradId,
  points,
  backPoints,
}: {
  color: string;
  gradId: string;
  points: string;
  backPoints: string;
}) {
  return (
    <svg
      className="gcome-kpi-spark"
      viewBox="0 0 180 54"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${gradId}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.08" />
          <stop offset="60%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.34" />
        </linearGradient>
        <linearGradient id={gradId} x1="0" y1="0.2" x2="1" y2="0.8">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="55%" stopColor={color} stopOpacity="0.42" />
          <stop offset="100%" stopColor={color} stopOpacity="0.62" />
        </linearGradient>
      </defs>
      <path d={`${backPoints} L 180 54 L 0 54 Z`} fill={`url(#${gradId}-bg)`} />
      <path d={`${points} L 180 54 L 0 54 Z`} fill={`url(#${gradId})`} />
      <path
        d={points}
        fill="none"
        stroke={color}
        strokeOpacity="0.55"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AdminDashboard({
  orders,
  allOrders,
  filtered,
  activeStatus,
  setActiveStatus,
  query,
  setQuery,
  period,
  setPeriod,
  onSelect,
  onCall,
  onCallOrder,
  onWhatsAppOrder,
  onOpenHistory,
  onOpenPostponeModal,
  onOpenCancelModal,
  onSetNrpLevel,
  onExport,
  onCreateOrder,
  onUpdateStatus,
  onSetCarrier,
  heroBanner,
  stockPanel,
  visitAnalytics,
  visitAnalyticsLoading,
  visitAnalyticsFetching,
  onRefreshVisits,
}: Props) {
  const stats = useMemo(() => getOrderStats(orders), [orders]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [nrpSubFilter, setNrpSubFilter] = useState<"all" | 1 | 2 | 3>("all");
  const [openNrpMenuOrderId, setOpenNrpMenuOrderId] = useState<string | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);

  const productImageByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const prod of getCatalogProducts()) {
      if (!prod.image) continue;
      if (prod.id) map.set(prod.id.toLowerCase(), prod.image);
      if (prod.slug) map.set(prod.slug.toLowerCase(), prod.image);
      if (prod.name) map.set(prod.name.toLowerCase().trim(), prod.image);
      if (prod.arName) map.set(prod.arName.toLowerCase().trim(), prod.image);
    }
    return map;
  }, []);

  const resolveOrderImage = (order: Order): string | undefined => {
    if (order.productId && productImageByKey.has(order.productId.toLowerCase())) {
      return productImageByKey.get(order.productId.toLowerCase());
    }
    const cleanProd = (order.product || "").split("×")[0].split("(")[0].trim().toLowerCase();
    if (cleanProd && productImageByKey.has(cleanProd)) {
      return productImageByKey.get(cleanProd);
    }
    for (const [key, img] of productImageByKey.entries()) {
      if (cleanProd && (cleanProd.includes(key) || key.includes(cleanProd))) {
        return img;
      }
    }
    return undefined;
  };

  useEffect(() => {
    setVisibleLimit(PAGE_SIZE);
  }, [activeStatus, query, period, nrpSubFilter]);

  const copyId = async (id: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(id);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1800);
      }
    } catch {}
  };

  const hasUndatedOrders = useMemo(
    () => orders.some(order => !parseOrderDate(order.createdAt)),
    [orders],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<OrderStatus, number> = {
      nouvelle: 0,
      confirmee: 0,
      transferee: 0,
      reportee: 0,
      ne_repond_pas: 0,
      annulee: 0,
    };
    for (const order of orders) {
      counts[order.status] = (counts[order.status] || 0) + 1;
    }
    return counts;
  }, [orders]);

  const displayedOrders = useMemo(
    () =>
      activeStatus === "ne_repond_pas" && nrpSubFilter !== "all"
        ? filtered.filter(order => (order.nrpLevel ?? 1) === nrpSubFilter)
        : filtered,
    [filtered, activeStatus, nrpSubFilter],
  );

  const visibleOrders = useMemo(
    () => displayedOrders.slice(0, visibleLimit),
    [displayedOrders, visibleLimit],
  );

  return (
    <div className="admin-app-dashboard">
      {/* ===== VISITES SITE & PRODUITS WAW (AVANT LES 4 BLOCS) ===== */}
      <VisitsAnalyticsChart
        data={visitAnalytics}
        isLoading={visitAnalyticsLoading}
        isRefreshing={visitAnalyticsFetching}
        onRefresh={onRefreshVisits}
        orders={allOrders ?? orders}
      />

      {/* ===== KPI CARDS GCOME ===== */}
      <section className="app-kpi-grid">
        <div className="app-kpi-card kpi-gradient-purple">
          <div className="app-kpi-header">
            <span className="app-kpi-icon-pill"><GcomeKpiChartIcon /></span>
            <span className="app-kpi-title">Total Commandes</span>
          </div>
          <div className="app-kpi-body">
            <strong className="app-kpi-num">{stats.count}</strong>
            <span className="app-kpi-sub">
              {period === "Toutes les dates" ? "Période globale" : period}
            </span>
          </div>
          <KpiSparkline
            color="#8b5cf6"
            gradId="spark-purple"
            backPoints="M0 44 C 24 41, 44 45, 76 34 C 102 25, 118 32, 146 20 C 162 13, 172 11, 180 8"
            points="M0 48 C 28 45, 52 38, 86 24 C 110 15, 130 28, 152 17 C 165 11, 173 6, 180 4"
          />
        </div>

        <div className="app-kpi-card kpi-gradient-orange">
          <div className="app-kpi-header">
            <span className="app-kpi-icon-pill pulse-orange"><GcomeKpiBellIcon /></span>
            <span className="app-kpi-title">À traiter d'urgence</span>
            {stats.pending > 0 && <span className="gcome-urgent-tri" aria-hidden="true"><AlertTriangle size={13} strokeWidth={2.5} /></span>}
          </div>
          <div className="app-kpi-body">
            <strong className="app-kpi-num">{stats.pending}</strong>
            <span className="app-kpi-sub">
              {stats.pending ? "Nouvelles en attente d'appel" : "Toutes traitées ! 🎉"}
            </span>
          </div>
          <KpiSparkline
            color="#f59e0b"
            gradId="spark-orange"
            backPoints="M0 46 C 24 42, 46 34, 72 38 C 96 42, 116 28, 144 26 C 162 25, 171 17, 180 12"
            points="M0 50 C 26 46, 48 39, 76 43 C 100 46, 122 33, 148 24 C 162 19, 172 15, 180 11"
          />
        </div>

        <div className="app-kpi-card kpi-gradient-mint">
          <div className="app-kpi-header">
            <span className="app-kpi-icon-pill"><GcomeKpiCheckIcon /></span>
            <span className="app-kpi-title">Taux Confirmation</span>
          </div>
          <div className="app-kpi-body">
            <strong className="app-kpi-num">
              {stats.confirmationRate === null ? "—" : `${new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 1 }).format(stats.confirmationRate)} %`}
            </strong>
            <span className="app-kpi-sub">
              {stats.count ? `${stats.confirmedCount} confirmée(s) sur ${stats.count}` : "0 commande"}
            </span>
          </div>
          <KpiSparkline
            color="#10b981"
            gradId="spark-mint"
            backPoints="M0 46 C 32 45, 56 41, 90 30 C 118 22, 138 25, 162 13 C 171 9, 176 7, 180 5"
            points="M0 50 C 30 48, 52 46, 86 38 C 114 31, 134 26, 156 16 C 168 10, 174 7, 180 4"
          />
        </div>

        <div className="app-kpi-card kpi-gradient-blue">
          <div className="app-kpi-header">
            <span className="app-kpi-icon-pill"><GcomeKpiWalletIcon /></span>
            <span className="app-kpi-title">Montant Confirmé</span>
          </div>
          <div className="app-kpi-body">
            <strong className="app-kpi-num">{formatDZD(stats.confirmedAmount)}</strong>
            <span className="app-kpi-sub">Prêt pour expédition COD</span>
          </div>
          <KpiSparkline
            color="#3b82f6"
            gradId="spark-blue"
            backPoints="M0 45 C 24 41, 48 44, 78 36 C 106 28, 128 33, 152 21 C 166 15, 173 14, 180 11"
            points="M0 49 C 28 45, 52 47, 82 39 C 110 32, 132 35, 156 24 C 168 18, 174 16, 180 12"
          />
        </div>
      </section>

      {/* ===== MAIN GRID: ORDERS + SIDEBAR ===== */}
      <section className="app-main-grid">
        <div className="app-orders-container">
          {/* Header Bar */}
          <div className="app-panel-head">
            <div className="app-head-left">
              <span className="app-head-badge">Gestion Directe</span>
              <h2 className="app-head-title">
                Flux Commandes <span className="app-count-bubble">{displayedOrders.length}</span>
              </h2>
            </div>
            <div className="gcome-flux-actions">
              {onCreateOrder && (
                <button
                  type="button"
                  className="gcome-new-order-btn"
                  onClick={onCreateOrder}
                >
                  <Plus size={16} />
                  <span>Nouvelle commande</span>
                </button>
              )}
              <button
                type="button"
                className="app-export-btn"
                onClick={onExport}
                disabled={!displayedOrders.length}
              >
                <ExternalLink size={15} />
                <span>Exporter CSV</span>
              </button>
            </div>
          </div>

          {/* Search & Period Filter */}
          <div className="app-filter-bar">
            <div className="app-search-box">
              <Search size={18} className="app-search-icon" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Rechercher par client, téléphone ou ID..."
                className="app-search-input"
              />
              {query && (
                <button
                  type="button"
                  className="app-clear-search"
                  onClick={() => setQuery("")}
                >
                  ✕
                </button>
              )}
            </div>

            <div className="app-period-select">
              <Calendar size={15} />
              <select value={period} onChange={event => setPeriod(event.target.value)}>
                <option>Toutes les dates</option>
                <option>Aujourd'hui</option>
                <option>7 derniers jours</option>
                <option>30 derniers jours</option>
              </select>
              <ChevronDown size={14} className="app-select-arrow" />
            </div>
          </div>

          {hasUndatedOrders && (
            <p className="admin-order-date-note">
              Les anciennes commandes sans date précise sont conservées sous « Toutes les dates ».
            </p>
          )}

          {heroBanner && (
            <div className="gcome-mobile-hero-slot">
              {heroBanner}
            </div>
          )}

          {/* Status Tabs Carousel */}
          <div className="app-status-carousel" role="tablist">
            <button
              type="button"
              className={`app-status-tab ${activeStatus === "all" ? "active" : ""}`}
              onClick={() => setActiveStatus("all")}
            >
              <span>Toutes</span>
              <b className="app-tab-count">{orders.length}</b>
            </button>
            {activeDashboardStatuses.map(status => {
              const count = statusCounts[status] ?? 0;
              const meta = labels[status];
              return (
                <button
                  key={status}
                  type="button"
                  className={`app-status-tab tab-${status} ${activeStatus === status ? "active" : ""}`}
                  onClick={() => setActiveStatus(status)}
                >
                  <span className={`gcome-status-orb orb-${status}`} aria-hidden="true" />
                  <span>{meta.label}</span>
                  <b className="app-tab-count">{count}</b>
                </button>
              );
            })}
          </div>

          {/* Sub-filter NRP 1 / NRP 2 / NRP 3 when viewing Sans réponse */}
          {activeStatus === "ne_repond_pas" && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                marginBottom: "14px",
                padding: "10px 12px",
                background: "rgba(245, 158, 11, 0.08)",
                border: "1px solid rgba(245, 158, 11, 0.25)",
                borderRadius: "14px",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#92400e", marginRight: "4px" }}>
                Filtrer par tentative :
              </span>
              {([
                { key: "all" as const, label: "Tous les NRP", count: filtered.length },
                {
                  key: 1 as const,
                  label: "🟠 NRP 1 (1er appel)",
                  count: filtered.filter(o => (o.nrpLevel ?? 1) === 1).length,
                },
                {
                  key: 2 as const,
                  label: "🟠 NRP 2 (2e appel)",
                  count: filtered.filter(o => o.nrpLevel === 2).length,
                },
                {
                  key: 3 as const,
                  label: "🔴 NRP 3 (Dernière relance)",
                  count: filtered.filter(o => o.nrpLevel === 3).length,
                },
              ]).map(tab => (
                <button
                  key={String(tab.key)}
                  type="button"
                  onClick={() => setNrpSubFilter(tab.key)}
                  className={`gcome-nrp-subtab ${nrpSubFilter === tab.key ? "is-active" : ""}`}
                >
                  <span>{tab.label}</span>
                  <b>{tab.count}</b>
                </button>
              ))}
            </div>
          )}

          {/* Orders Stream Cards */}
          <div className="app-orders-stream">
            {visibleOrders.map(order => {
              const isNew = order.status === "nouvelle";
              const meta = statusMeta[order.status] ?? statusMeta.nouvelle;
              const statusLabel =
                order.status === "ne_repond_pas"
                  ? `Sans réponse · NRP ${order.nrpLevel ?? 1}`
                  : meta.label;
              const handlerName = order.confirmedByName || order.assignedToName;
              const isPostponeDue =
                order.status === "reportee" &&
                Boolean(order.postponedUntil) &&
                new Date(order.postponedUntil!).getTime() <= Date.now();

              return (
                <article
                  key={order.id}
                  className={`app-order-card ${meta.cardClass} ${isNew ? "is-new-card" : ""}`}
                >
                  {/* Top Bar: Dedicated Status Badge on Left + Date on Right */}
                  <div className="aoc-top">
                    <div className="aoc-status-badge-wrap" style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                      <span className={`aoc-status-pill ${meta.badgeClass}`}>
                        {isNew ? (
                          <span className="gcome-bolt-icon" aria-hidden="true">⚡</span>
                        ) : (
                          <span className="aoc-status-glow-dot" />
                        )}
                        <span className="aoc-status-text">{statusLabel}</span>
                      </span>
                      {order.status === "transferee" && (
                        <span className="aoc-carrier-tag">E-com Delivery</span>
                      )}
                      {order.isDelivered && (
                        <span className="gcome-meta-badge gcome-meta-badge--green">
                          📦 Livrée ✅
                        </span>
                      )}
                      {handlerName && (
                        <span
                          className="gcome-meta-badge gcome-meta-badge--indigo"
                          title="Confirmateur en charge de cette commande"
                        >
                          <UserCheck size={12} />
                          <span>Suivi par : {handlerName}</span>
                        </span>
                      )}
                      {(order.callCount ?? 0) > 0 && (
                        <span
                          className="gcome-meta-badge gcome-meta-badge--green"
                          title="Nombre d'appels effectués sur cette commande"
                        >
                          📞 {order.callCount} appel{(order.callCount ?? 0) > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    <span className="aoc-date">
                      <Calendar size={12} aria-hidden="true" />
                      <span>{formatOrderDate(order.createdAt)}</span>
                    </span>
                  </div>

                  {/* ID Row: Wrap-Safe, Break-All, Clean Copy */}
                  <div className="aoc-id-row gcome-id-bar">
                    <button
                      type="button"
                      className="aoc-id-btn"
                      onClick={() => copyId(order.id)}
                      title="Cliquer pour copier l'identifiant"
                    >
                      <span className="aoc-id-left">
                        <span className="aoc-id-hash">#</span>
                        <strong className="aoc-id">{order.id}</strong>
                      </span>
                      <span className="aoc-copy-hint">
                        {copiedId === order.id ? "Copié !" : <Copy size={13} />}
                      </span>
                    </button>
                  </div>

                  {/* Postponed Reminder Banner */}
                  {order.status === "reportee" && (
                    <div className={`gcome-postpone-banner ${isPostponeDue ? "is-due" : ""}`}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <AlarmClock size={15} />
                        {order.postponedUntil ? (
                          <>
                            {isPostponeDue ? "🚨 RAPPEL ÉCHU — À rappeler maintenant : " : "⏰ Rappel programmé : "}
                            <b>
                              {new Intl.DateTimeFormat("fr-DZ", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              }).format(new Date(order.postponedUntil))}
                            </b>
                          </>
                        ) : (
                          "⏰ Reportée (sans date ni heure précise)"
                        )}
                        {order.postponedNote ? ` — « ${order.postponedNote} »` : ""}
                      </span>
                      {onOpenPostponeModal && (
                        <button
                          type="button"
                          onClick={() => onOpenPostponeModal(order)}
                          className="gcome-postpone-edit-btn"
                        >
                          Modifier l'heure
                        </button>
                      )}
                    </div>
                  )}

                  {/* Cancellation Reason Banner */}
                  {order.status === "annulee" && order.cancelReason && (
                    <div className="gcome-cancel-banner">
                      ❌ Motif d'annulation : <b>{order.cancelReason}</b>
                    </div>
                  )}

                  {/* Customer Block (2-Column Split Grid matching Mockup) */}
                  <div className="aoc-customer-box gcome-customer-box">
                    <div className="gcome-cust-col">
                      <div className="aoc-avatar gcome-initials-avatar">
                        {(() => {
                          const raw = (order.customer || "CL").trim();
                          const words = raw.split(/\s+/).filter(Boolean);
                          if (words.length >= 2) {
                            return `${Array.from(words[0])[0] ?? ""}${Array.from(words[1])[0] ?? ""}`.toUpperCase();
                          }
                          return Array.from(raw).slice(0, 2).join("").toUpperCase();
                        })()}
                      </div>

                      <div className="aoc-customer-details">
                        <span className="gcome-cust-eyebrow">Client</span>
                        <h3 className="aoc-name">{order.customer || "Cliente"}</h3>

                        <div className="aoc-loc-row">
                          <MapPin size={12} className="aoc-pin-icon" />
                          <span className="aoc-wilaya">
                            <b>{order.wilaya || "Wilaya non spécifiée"}</b>
                            {order.commune ? ` — ${order.commune}` : ""}
                          </span>
                        </div>

                        {order.address && (
                          <div className="aoc-address-text">
                            <small>| Adresse : {order.address}</small>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="gcome-contact-col">
                      <button
                        type="button"
                        className="gcome-call-col-btn"
                        onClick={() => (onCallOrder ? onCallOrder(order) : onCall(order.phone))}
                        aria-label={`Appeler ${order.customer || order.phone}`}
                        title="Appeler la cliente (enregistré dans l'historique)"
                      >
                        <span className="gcome-call-ico">
                          <Phone size={15} />
                        </span>
                        <span className="gcome-call-meta">
                          <small className="gcome-deliv-label">
                            {order.delivery === "office" ? "Bureau / Stopdesk" : "À domicile"}
                          </small>
                          <strong className="aoc-call-num">{order.phone}</strong>
                        </span>
                      </button>

                      {onWhatsAppOrder && (
                        <button
                          type="button"
                          className="gcome-wa-pill"
                          onClick={() => onWhatsAppOrder(order)}
                          title="Envoyer un message WhatsApp pré-rempli à la cliente"
                        >
                          <GcomeWhatsAppLogo />
                          <span>WhatsApp</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Order Content / Variants */}
                  {(() => {
                    const isExt =
                      order.productId === "p-005" ||
                      order.product.toLowerCase().includes("extension");
                    const cleanExtVariants = isExt && order.color
                      ? order.color
                          .split("+")
                          .map(part =>
                            part
                              .replace(/^\s*\d+\s*(\([^)]*\))?\s*:\s*/u, "")
                              .replace(/^\s*\[Art\.\d+\]\s*/i, "")
                              .trim()
                          )
                          .filter(Boolean)
                          .slice(0, 2)
                          .join(" + ")
                      : "";
                    const displayTitle = isExt
                      ? "Extensions Cheveux Naturels"
                      : order.product;
                    const hideAutoExtNote =
                      isExt &&
                      Boolean(order.note) &&
                      (order.note!.includes("عرض قطعتين") || order.note!.includes("1 achetée + 2ème gratuite"));

                    const prodThumb = resolveOrderImage(order);

                    return (
                      <>
                        <div className="aoc-product-row gcome-product-row">
                          {prodThumb ? (
                            <img
                              src={prodThumb}
                              alt={displayTitle}
                              className="gcome-prod-thumb"
                              loading="lazy"
                            />
                          ) : (
                            <div className="aoc-prod-badge gcome-prod-thumb-fallback">
                              <Package size={22} />
                            </div>
                          )}
                          <div className="gcome-prod-content">
                            <div className="aoc-prod-name-wrap">
                              <strong className="aoc-prod-title">{displayTitle}</strong>
                              <div className="aoc-prod-meta-tags">
                                {isExt ? (
                                  <>
                                    {cleanExtVariants && (
                                      <span className="aoc-chip aoc-chip-color">
                                        <Package size={12} aria-hidden="true" />
                                        <b>{cleanExtVariants}</b>
                                      </span>
                                    )}
                                    <span className="aoc-chip aoc-chip-qty">
                                      <b>1 achetée + 2ème gratuite 🎁</b>
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="aoc-chip aoc-chip-qty">
                                      Qté : <b>{order.quantity}</b>
                                    </span>
                                    {order.color && (
                                      <span className="aoc-chip aoc-chip-color">
                                        <Package size={12} aria-hidden="true" />
                                        <b>{order.color}</b>
                                      </span>
                                    )}
                                      {order.size && order.size.trim() !== "" && (
                                        <span className="aoc-chip aoc-chip-size">
                                          <b>{order.size}</b>
                                        </span>
                                      )}
                                    </>
                                  )}
                                {order.attribution?.channel && order.attribution.channel !== "direct" && (
                                  <span
                                    className={`aoc-chip aoc-chip-attr is-${order.attribution.channel}`}
                                    title={
                                      order.attribution.capiSent
                                        ? `Source ${order.attribution.channel.toUpperCase()} · Conversions API Meta envoyée (${order.attribution.capiPixels ?? 1} pixel)`
                                        : order.attribution.capiError
                                          ? `Erreur CAPI: ${order.attribution.capiError}`
                                          : `Source ${order.attribution.channel.toUpperCase()}`
                                    }
                                  >
                                    <b>
                                      {order.attribution.channel === "facebook"
                                        ? "FB Ads"
                                        : order.attribution.channel === "tiktok"
                                          ? "TikTok Ads"
                                          : "Google"}
                                    </b>
                                    {order.attribution.capiSent ? <span>· CAPI ✓</span> : null}
                                  </span>
                                )}
                                {order.attribution?.channel === "direct" && order.attribution.capiSent && (
                                  <span
                                    className="aoc-chip aoc-chip-attr is-capi"
                                    title={`Conversions API Meta envoyée (${order.attribution.capiPixels ?? 1} pixel)`}
                                  >
                                    <b>Meta CAPI ✓</b>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Dedicated TOTAL À ENCAISSER Bar */}
                        <div className="gcome-total-bar">
                          <span className="gcome-total-label">
                            <span aria-hidden="true">💰</span>
                            <span>TOTAL À ENCAISSER</span>
                          </span>
                          <strong className="gcome-total-value">{formatDZD(order.total)}</strong>
                        </div>

                        {order.note && !hideAutoExtNote && (
                          <div className="aoc-note-banner">
                            <span className="aoc-note-label">📝 Note :</span>
                            <span className="aoc-note-content">{order.note}</span>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Complete 1-Tap Confirmation Actions Bar matching Mockup */}
                  <div className="aoc-actions-bar">
                    {order.status !== "confirmee" ? (
                      <button
                        type="button"
                        className="aoc-btn aoc-btn-confirm gcome-confirm-full"
                        onClick={() => onUpdateStatus?.(order.id, "confirmee")}
                      >
                        <CheckCircle2 size={17} />
                        <span>Confirmer</span>
                        <ChevronRight size={17} className="gcome-cta-chev" />
                      </button>
                    ) : (
                      <div className="aoc-tag-confirmed gcome-confirm-full">
                        <CheckCircle2 size={16} />
                        <span>Commande confirmée</span>
                      </div>
                    )}

                    {/* Bouton unique « Pas de réponse » qui ouvre les options au clic */}
                    <button
                      type="button"
                      className={`aoc-btn aoc-btn-noanswer ${openNrpMenuOrderId === order.id ? "is-open" : ""}`}
                      onClick={() => {
                        if (onSetNrpLevel) {
                          setOpenNrpMenuOrderId(prev => (prev === order.id ? null : order.id));
                        } else {
                          onUpdateStatus?.(order.id, "ne_repond_pas");
                        }
                      }}
                      title="Marquer Pas de réponse et choisir le niveau de relance (NRP 1, 2, 3 ou WhatsApp)"
                    >
                      <XCircle size={14} />
                      <span>
                        Pas de réponse
                        {order.status === "ne_repond_pas" ? ` (NRP ${order.nrpLevel ?? 1})` : ""}
                      </span>
                      {onSetNrpLevel && <ChevronDown size={13} />}
                    </button>

                    <button
                      type="button"
                      className="aoc-btn aoc-btn-postpone"
                      onClick={() =>
                        onOpenPostponeModal
                          ? onOpenPostponeModal(order)
                          : onUpdateStatus?.(order.id, "reportee")
                      }
                      title="Reporter la confirmation (avec date/heure optionnelle)"
                    >
                      <Clock size={14} />
                      <span>{order.status === "reportee" ? "Reprogrammer" : "Reporter"}</span>
                    </button>

                    {order.status !== "annulee" ? (
                      <button
                        type="button"
                        className="aoc-btn aoc-btn-cancel"
                        onClick={() =>
                          onOpenCancelModal
                            ? onOpenCancelModal(order)
                            : onUpdateStatus?.(order.id, "annulee")
                        }
                        title="Annuler la commande"
                      >
                        <XCircle size={14} />
                        <span>Annuler</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="aoc-btn aoc-btn-reopen"
                        onClick={() => onUpdateStatus?.(order.id, "nouvelle")}
                        title="Rétablir en nouvelle commande"
                      >
                        <RotateCcw size={14} />
                        <span>Rétablir</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="aoc-btn aoc-btn-edit"
                      onClick={() => onSelect(order)}
                      title="Modifier les détails de la commande"
                    >
                      <Edit3 size={14} />
                      <span>Modifier</span>
                    </button>

                    {onOpenHistory && (
                      <button
                        type="button"
                        className="aoc-btn aoc-btn-history gcome-history-full"
                        onClick={() => onOpenHistory(order)}
                        title="Voir l'historique complet des appels, modifications et statuts"
                      >
                        <History size={14} />
                        <span>Historique ({order.historyCount ?? order.history?.length ?? 1})</span>
                      </button>
                    )}
                  </div>

                  {order.status === "confirmee" && onSetCarrier && (
                    <div className="gcome-carrier-bar">
                      <span className="gcome-carrier-label">
                        🚚 Société de livraison liée :
                      </span>
                      <button
                        type="button"
                        className={`aoc-btn gcome-carrier-pill ${(!order.carrier || order.carrier === "ecom") ? "is-ecom" : ""}`}
                        onClick={() => onSetCarrier(order.id, "ecom")}
                      >
                        🚚 E-com Delivery
                      </button>
                      <button
                        type="button"
                        className={`aoc-btn gcome-carrier-pill ${order.carrier === "ecotrack" ? "is-ecotrack" : ""}`}
                        onClick={() => onSetCarrier(order.id, "ecotrack")}
                      >
                        📦 DHD (EcoTrack)
                      </button>
                    </div>
                  )}

                  {/* Panneau d'options « Pas de réponse » affiché au clic sur le bouton */}
                  {onSetNrpLevel && openNrpMenuOrderId === order.id && (() => {
                    const currentLvl = order.status === "ne_repond_pas" ? (order.nrpLevel ?? 1) : 0;
                    const recommendedLvl = Math.min(3, currentLvl + 1) as 1 | 2 | 3;
                    return (
                      <div className="gcome-nrp-panel">
                        <div className="gcome-nrp-head">
                          <span className="gcome-nrp-head-title">
                            <PhoneOff size={14} />
                            Choisis le niveau « Pas de réponse » (NRP) :
                          </span>
                          <button
                            type="button"
                            onClick={() => setOpenNrpMenuOrderId(null)}
                            className="gcome-nrp-close"
                          >
                            ✕ Fermer
                          </button>
                        </div>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                          {([
                            { lvl: 1 as const, title: "NRP 1 — 1er appel", sub: "1ère tentative sans réponse" },
                            { lvl: 2 as const, title: "NRP 2 — 2e appel", sub: "2ème relance téléphonique" },
                            { lvl: 3 as const, title: "NRP 3 — 3e appel", sub: "Dernière relance avant annulation" },
                          ]).map(opt => {
                            const isCurrent = order.status === "ne_repond_pas" && (order.nrpLevel ?? 1) === opt.lvl;
                            const isRecommended = recommendedLvl === opt.lvl && !isCurrent;
                            return (
                              <button
                                key={opt.lvl}
                                type="button"
                                className={`gcome-nrp-opt ${isCurrent ? "is-current" : ""} ${isRecommended ? "is-rec" : ""} ${opt.lvl === 3 ? "is-lvl3" : ""}`}
                                onClick={() => {
                                  onSetNrpLevel(order.id, opt.lvl);
                                  setOpenNrpMenuOrderId(null);
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px" }}>
                                  <strong style={{ fontSize: "0.8rem", fontWeight: 900 }}>
                                    {opt.lvl === 3 ? "🔴" : "🟠"} {opt.title}
                                  </strong>
                                  {isRecommended && (
                                    <span className="gcome-nrp-next-tag">Suivant</span>
                                  )}
                                  {isCurrent && (
                                    <span style={{ fontSize: "0.65rem", fontWeight: 800 }}>✓ Actif</span>
                                  )}
                                </div>
                                <small style={{ fontSize: "0.7rem", opacity: isCurrent ? 0.9 : 0.78 }}>{opt.sub}</small>
                              </button>
                            );
                          })}

                          {onWhatsAppOrder && (
                            <button
                              type="button"
                              className="gcome-nrp-wa"
                              onClick={() => {
                                onSetNrpLevel(order.id, recommendedLvl);
                                onWhatsAppOrder({ ...order, status: "ne_repond_pas", nrpLevel: recommendedLvl });
                                setOpenNrpMenuOrderId(null);
                              }}
                            >
                              <strong style={{ fontSize: "0.8rem", fontWeight: 900, display: "flex", alignItems: "center", gap: "5px" }}>
                                <MessageCircle size={14} />
                                NRP {recommendedLvl} + Relance WhatsApp
                              </strong>
                              <small style={{ fontSize: "0.7rem" }}>
                                Marque NRP {recommendedLvl} et ouvre WhatsApp pré-rempli en 1 clic
                              </small>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </article>
              );
            })}

            {displayedOrders.length > visibleOrders.length && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  flexWrap: "wrap",
                  padding: "14px 8px",
                }}
              >
                <button
                  type="button"
                  className="button button-light"
                  onClick={() => setVisibleLimit(prev => prev + PAGE_SIZE)}
                >
                  Afficher {Math.min(PAGE_SIZE, displayedOrders.length - visibleOrders.length)} commandes de plus ({displayedOrders.length - visibleOrders.length} restantes)
                </button>
                <button
                  type="button"
                  className="button button-light"
                  onClick={() => setVisibleLimit(displayedOrders.length)}
                >
                  Tout afficher ({displayedOrders.length})
                </button>
              </div>
            )}

            {!displayedOrders.length && (
              <div className="admin-empty-orders" role="status">
                <strong>{orders.length ? "Aucune commande pour ces filtres" : "Aucune commande enregistrée"}</strong>
                <p>
                  {orders.length
                    ? "Modifie la recherche, la période ou le statut."
                    : "Les commandes enregistrées apparaîtront ici. Aucune donnée de démonstration n'est affichée."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Stocks / Quick Links */}
        <div className="app-stock-sidebar">{stockPanel}</div>
      </section>
    </div>
  );
}
