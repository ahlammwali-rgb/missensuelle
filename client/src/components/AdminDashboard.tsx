import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlarmClock,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Edit3,
  ExternalLink,
  Filter,
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
import {
  GcomeKpiBellIcon,
  GcomeKpiChartIcon,
  GcomeKpiCheckIcon,
  GcomeKpiWalletIcon,
  GcomeWhatsAppLogo,
} from "@/components/GcomeIcons";

type Props = {
  orders: Order[];
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
}: {
  color: string;
  gradId: string;
  points: string;
}) {
  return (
    <svg
      className="gcome-kpi-spark"
      viewBox="0 0 180 42"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.34" />
          <stop offset="65%" stopColor={color} stopOpacity="0.12" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={`${points} L 180 42 L 0 42 Z`} fill={`url(#${gradId})`} />
      <path
        d={points}
        fill="none"
        stroke={color}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AdminDashboard({
  orders,
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
            color="#7c3aed"
            gradId="spark-purple"
            points="M0 32 C 25 28, 40 36, 70 26 C 100 16, 125 24, 150 14 C 165 8, 172 10, 180 6"
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
            points="M0 34 C 30 30, 50 22, 85 26 C 115 30, 140 16, 165 18 C 172 19, 176 15, 180 12"
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
            points="M0 30 C 35 28, 55 34, 88 24 C 118 16, 140 22, 165 12 C 172 9, 176 8, 180 5"
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
            color="#2563eb"
            gradId="spark-blue"
            points="M0 35 C 28 32, 60 27, 92 22 C 122 18, 146 21, 168 11 C 174 8, 177 7, 180 5"
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
              <Filter size={15} />
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
                  style={{
                    padding: "6px 12px",
                    borderRadius: "999px",
                    border:
                      nrpSubFilter === tab.key
                        ? "1.5px solid #d97706"
                        : "1px solid rgba(217,119,6,0.28)",
                    background: nrpSubFilter === tab.key ? "#d97706" : "#fff",
                    color: nrpSubFilter === tab.key ? "#fff" : "#92400e",
                    fontSize: "0.78rem",
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>{tab.label}</span>
                  <b
                    style={{
                      background:
                        nrpSubFilter === tab.key ? "rgba(255,255,255,0.25)" : "rgba(217,119,6,0.12)",
                      padding: "1px 7px",
                      borderRadius: "999px",
                      fontSize: "0.72rem",
                    }}
                  >
                    {tab.count}
                  </b>
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
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "3px 9px",
                            borderRadius: "999px",
                            background: "rgba(16, 185, 129, 0.14)",
                            color: "#065f46",
                            fontSize: "0.72rem",
                            fontWeight: 800,
                          }}
                        >
                          📦 Livrée ✅
                        </span>
                      )}
                      {handlerName && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "3px 9px",
                            borderRadius: "999px",
                            background: "rgba(99, 102, 241, 0.12)",
                            color: "#3730a3",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                          }}
                          title="Confirmateur en charge de cette commande"
                        >
                          <UserCheck size={12} />
                          <span>Suivi par : {handlerName}</span>
                        </span>
                      )}
                      {(order.callCount ?? 0) > 0 && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "2px 8px",
                            borderRadius: "999px",
                            background: "rgba(16, 185, 129, 0.1)",
                            color: "#047857",
                            fontSize: "0.71rem",
                            fontWeight: 700,
                          }}
                          title="Nombre d'appels effectués sur cette commande"
                        >
                          📞 {order.callCount} appel{(order.callCount ?? 0) > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    <span className="aoc-date">{formatOrderDate(order.createdAt)}</span>
                  </div>

                  {/* ID Row: Wrap-Safe, Break-All, Clean Copy */}
                  <div className="aoc-id-row">
                    <button
                      type="button"
                      className="aoc-id-btn"
                      onClick={() => copyId(order.id)}
                      title="Cliquer pour copier l'identifiant"
                    >
                      <span className="aoc-id-hash">#</span>
                      <strong className="aoc-id">{order.id}</strong>
                      <span className="aoc-copy-hint">
                        {copiedId === order.id ? "Copié !" : <Copy size={11} />}
                      </span>
                    </button>
                  </div>

                  {/* Postponed Reminder Banner */}
                  {order.status === "reportee" && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "8px",
                        padding: "9px 12px",
                        marginBottom: "10px",
                        borderRadius: "12px",
                        background: isPostponeDue
                          ? "linear-gradient(135deg, rgba(220,38,38,0.14), rgba(245,158,11,0.18))"
                          : "rgba(37, 99, 235, 0.08)",
                        border: isPostponeDue
                          ? "1.5px solid rgba(220,38,38,0.45)"
                          : "1px solid rgba(37, 99, 235, 0.22)",
                        color: isPostponeDue ? "#991b1b" : "#1e40af",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                      }}
                    >
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
                          style={{
                            padding: "4px 10px",
                            borderRadius: "8px",
                            border: "1px solid currentColor",
                            background: "rgba(255,255,255,0.8)",
                            color: "inherit",
                            fontSize: "0.73rem",
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          Modifier l'heure
                        </button>
                      )}
                    </div>
                  )}

                  {/* Cancellation Reason Banner */}
                  {order.status === "annulee" && order.cancelReason && (
                    <div
                      style={{
                        padding: "8px 12px",
                        marginBottom: "10px",
                        borderRadius: "10px",
                        background: "rgba(239, 68, 68, 0.08)",
                        border: "1px solid rgba(239, 68, 68, 0.22)",
                        color: "#991b1b",
                        fontSize: "0.79rem",
                        fontWeight: 700,
                      }}
                    >
                      ❌ Motif d'annulation : <b>{order.cancelReason}</b>
                    </div>
                  )}

                  {/* Customer Block with Sleek Call & WhatsApp Buttons */}
                  <div className="aoc-customer-box gcome-customer-box">
                    <div className="aoc-customer-left">
                      <div className="aoc-avatar gcome-bag-avatar">
                        <ShoppingBag size={20} />
                      </div>

                      <div className="aoc-customer-details">
                        <div className="aoc-customer-name-row">
                          <h3 className="aoc-name">{order.customer || "Cliente"}</h3>
                          <span className="aoc-delivery-pill">
                            {order.delivery === "office" ? "🏢 Bureau / Stopdesk" : "🏠 À domicile"}
                          </span>
                        </div>

                        <div className="aoc-loc-row">
                          <MapPin size={13} className="aoc-pin-icon" />
                          <span className="aoc-wilaya">
                            <b>{order.wilaya || "Wilaya non spécifiée"}</b>
                            {order.commune ? ` — ${order.commune}` : ""}
                          </span>
                        </div>

                        {order.address && (
                          <div className="aoc-address-text">
                            <small>Adresse : {order.address}</small>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sleek Equal Pill Call + WhatsApp Action Group */}
                    <div className="gcome-contact-row">
                      <button
                        type="button"
                        className="aoc-call-compact-btn gcome-call-pill"
                        onClick={() => (onCallOrder ? onCallOrder(order) : onCall(order.phone))}
                        aria-label={`Appeler ${order.customer || order.phone}`}
                        title="Appeler la cliente (enregistré dans l'historique)"
                      >
                        <Phone size={14} />
                        <span className="aoc-call-num">{order.phone}</span>
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
                              </div>
                            </div>

                            <div className="aoc-price-tag gcome-price-tag">
                              <small>Total à encaisser</small>
                              <div className="gcome-price-line">
                                <strong>{formatDZD(order.total)}</strong>
                                <span className="gcome-price-trend" aria-hidden="true">
                                  <TrendingUp size={13} />
                                </span>
                              </div>
                            </div>
                          </div>
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

                  {/* Complete 1-Tap Confirmation Actions Bar with ALL buttons: Confirmer, NRP 1/2/3, Reporter, Annuler, Modifier, Historique */}
                  <div className="aoc-actions-bar">
                    {order.status !== "confirmee" ? (
                      <button
                        type="button"
                        className="aoc-btn aoc-btn-confirm gcome-confirm-full"
                        onClick={() => onUpdateStatus?.(order.id, "confirmee")}
                      >
                        <CheckCircle2 size={16} />
                        <span>Confirmer la commande</span>
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
                      className="aoc-btn aoc-btn-noanswer"
                      onClick={() => {
                        if (onSetNrpLevel) {
                          setOpenNrpMenuOrderId(prev => (prev === order.id ? null : order.id));
                        } else {
                          onUpdateStatus?.(order.id, "ne_repond_pas");
                        }
                      }}
                      title="Marquer Pas de réponse et choisir le niveau de relance (NRP 1, 2, 3 ou WhatsApp)"
                      style={
                        openNrpMenuOrderId === order.id
                          ? {
                              boxShadow: "0 0 0 2px #f59e0b",
                              background: "rgba(245, 158, 11, 0.22)",
                            }
                          : undefined
                      }
                    >
                      <PhoneOff size={14} />
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
                        className="aoc-btn aoc-btn-history"
                        onClick={() => onOpenHistory(order)}
                        title="Voir l'historique complet des appels, modifications et statuts"
                      >
                        <History size={14} />
                        <span>Historique ({order.historyCount ?? order.history?.length ?? 1})</span>
                      </button>
                    )}
                  </div>

                  {order.status === "confirmee" && onSetCarrier && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        flexWrap: "wrap",
                        marginTop: "6px",
                        padding: "6px 10px",
                        borderRadius: "10px",
                        background: "rgba(15, 23, 42, 0.03)",
                        border: "1px dashed rgba(100, 116, 139, 0.25)",
                      }}
                    >
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                        🚚 Société de livraison liée :
                      </span>
                      <button
                        type="button"
                        className="aoc-btn"
                        onClick={() => onSetCarrier(order.id, "ecom")}
                        style={{
                          padding: "4px 10px",
                          fontSize: "11px",
                          fontWeight: 800,
                          borderRadius: "8px",
                          background: (!order.carrier || order.carrier === "ecom") ? "#0f766e" : "rgba(255,255,255,0.85)",
                          color: (!order.carrier || order.carrier === "ecom") ? "#fff" : "#334155",
                          border: (!order.carrier || order.carrier === "ecom") ? "1px solid #0f766e" : "1px solid rgba(148,163,184,0.35)",
                        }}
                      >
                        🚚 E-com Delivery
                      </button>
                      <button
                        type="button"
                        className="aoc-btn"
                        onClick={() => onSetCarrier(order.id, "ecotrack")}
                        style={{
                          padding: "4px 10px",
                          fontSize: "11px",
                          fontWeight: 800,
                          borderRadius: "8px",
                          background: order.carrier === "ecotrack" ? "#2563eb" : "rgba(255,255,255,0.85)",
                          color: order.carrier === "ecotrack" ? "#fff" : "#334155",
                          border: order.carrier === "ecotrack" ? "1px solid #2563eb" : "1px solid rgba(148,163,184,0.35)",
                        }}
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
                      <div
                        style={{
                          marginTop: "10px",
                          padding: "12px 14px",
                          borderRadius: "14px",
                          background: "linear-gradient(135deg, rgba(245, 158, 11, 0.11), rgba(234, 88, 12, 0.06))",
                          border: "1.5px solid rgba(245, 158, 11, 0.38)",
                          display: "grid",
                          gap: "10px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#92400e", display: "flex", alignItems: "center", gap: "6px" }}>
                            <PhoneOff size={14} />
                            Choisis le niveau « Pas de réponse » (NRP) :
                          </span>
                          <button
                            type="button"
                            onClick={() => setOpenNrpMenuOrderId(null)}
                            style={{
                              background: "rgba(255,255,255,0.8)",
                              border: "1px solid rgba(146, 64, 14, 0.2)",
                              borderRadius: "999px",
                              padding: "3px 10px",
                              fontSize: "0.72rem",
                              fontWeight: 800,
                              color: "#92400e",
                              cursor: "pointer",
                            }}
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
                                onClick={() => {
                                  onSetNrpLevel(order.id, opt.lvl);
                                  setOpenNrpMenuOrderId(null);
                                }}
                                style={{
                                  flex: "1 1 150px",
                                  padding: "9px 12px",
                                  borderRadius: "11px",
                                  border: isCurrent
                                    ? opt.lvl === 3
                                      ? "2px solid #dc2626"
                                      : "2px solid #d97706"
                                    : isRecommended
                                      ? "2px solid #f59e0b"
                                      : "1px solid rgba(217, 119, 6, 0.28)",
                                  background: isCurrent
                                    ? opt.lvl === 3
                                      ? "#dc2626"
                                      : "#d97706"
                                    : "#fff",
                                  color: isCurrent ? "#fff" : opt.lvl === 3 ? "#991b1b" : "#92400e",
                                  textAlign: "left",
                                  cursor: "pointer",
                                  display: "grid",
                                  gap: "2px",
                                  boxShadow: isRecommended ? "0 4px 12px rgba(245, 158, 11, 0.18)" : "none",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px" }}>
                                  <strong style={{ fontSize: "0.8rem", fontWeight: 900 }}>
                                    {opt.lvl === 3 ? "🔴" : "🟠"} {opt.title}
                                  </strong>
                                  {isRecommended && (
                                    <span
                                      style={{
                                        fontSize: "0.65rem",
                                        padding: "1px 6px",
                                        borderRadius: "999px",
                                        background: "rgba(245, 158, 11, 0.2)",
                                        color: "#b45309",
                                        fontWeight: 800,
                                      }}
                                    >
                                      Suivant
                                    </span>
                                  )}
                                  {isCurrent && (
                                    <span style={{ fontSize: "0.65rem", fontWeight: 800 }}>✓ Actif</span>
                                  )}
                                </div>
                                <small style={{ fontSize: "0.7rem", opacity: isCurrent ? 0.9 : 0.75 }}>{opt.sub}</small>
                              </button>
                            );
                          })}

                          {onWhatsAppOrder && (
                            <button
                              type="button"
                              onClick={() => {
                                onSetNrpLevel(order.id, recommendedLvl);
                                onWhatsAppOrder({ ...order, status: "ne_repond_pas", nrpLevel: recommendedLvl });
                                setOpenNrpMenuOrderId(null);
                              }}
                              style={{
                                flex: "1 1 200px",
                                padding: "9px 12px",
                                borderRadius: "11px",
                                border: "1.5px solid rgba(16, 185, 129, 0.45)",
                                background: "linear-gradient(135deg, #ecfdf5, #d1fae5)",
                                color: "#065f46",
                                textAlign: "left",
                                cursor: "pointer",
                                display: "grid",
                                gap: "2px",
                              }}
                            >
                              <strong style={{ fontSize: "0.8rem", fontWeight: 900, display: "flex", alignItems: "center", gap: "5px" }}>
                                <MessageCircle size={14} />
                                NRP {recommendedLvl} + Relance WhatsApp
                              </strong>
                              <small style={{ fontSize: "0.7rem", color: "#047857" }}>
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
