import React, { useState, type ReactNode } from "react";
import {
  AlarmClock,
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
  RotateCcw,
  Search,
  Sparkles,
  TrendingUp,
  UserCheck,
  XCircle,
} from "lucide-react";
import { formatDZD, type Order, type OrderStatus } from "@/lib/store-data";
import { formatOrderDate, getOrderStats, parseOrderDate } from "@/lib/admin-orders";

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
  onUpdateStatus?: (id: string, status: OrderStatus) => void;
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
  onUpdateStatus,
  stockPanel,
}: Props) {
  const stats = getOrderStats(orders);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [nrpSubFilter, setNrpSubFilter] = useState<"all" | 1 | 2 | 3>("all");

  const copyId = async (id: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(id);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1800);
      }
    } catch {}
  };

  const displayedOrders =
    activeStatus === "ne_repond_pas" && nrpSubFilter !== "all"
      ? filtered.filter(order => (order.nrpLevel ?? 1) === nrpSubFilter)
      : filtered;

  return (
    <div className="admin-app-dashboard">
      {/* ===== KPI CARDS 3D ===== */}
      <section className="app-kpi-grid">
        <div className="app-kpi-card kpi-gradient-purple">
          <div className="app-kpi-header">
            <span className="app-kpi-title">Total Commandes</span>
            <span className="app-kpi-icon-pill"><TrendingUp size={16} /></span>
          </div>
          <div className="app-kpi-body">
            <strong className="app-kpi-num">{stats.count}</strong>
            <span className="app-kpi-sub">
              {period === "Toutes les dates" ? "Période globale" : period}
            </span>
          </div>
        </div>

        <div className="app-kpi-card kpi-gradient-orange">
          <div className="app-kpi-header">
            <span className="app-kpi-title">À traiter d'urgence</span>
            <span className="app-kpi-icon-pill pulse-orange"><Bell size={16} /></span>
          </div>
          <div className="app-kpi-body">
            <strong className="app-kpi-num">{stats.pending}</strong>
            <span className="app-kpi-sub">
              {stats.pending ? "Nouvelles en attente d'appel" : "Toutes traitées ! 🎉"}
            </span>
          </div>
        </div>

        <div className="app-kpi-card kpi-gradient-mint">
          <div className="app-kpi-header">
            <span className="app-kpi-title">Taux Confirmation</span>
            <span className="app-kpi-icon-pill"><Sparkles size={16} /></span>
          </div>
          <div className="app-kpi-body">
            <strong className="app-kpi-num">
              {stats.confirmationRate === null ? "—" : `${new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 1 }).format(stats.confirmationRate)} %`}
            </strong>
            <span className="app-kpi-sub">
              {stats.count ? `${stats.confirmedCount} confirmée(s) sur ${stats.count}` : "0 commande"}
            </span>
          </div>
        </div>

        <div className="app-kpi-card kpi-gradient-blue">
          <div className="app-kpi-header">
            <span className="app-kpi-title">Montant Confirmé</span>
            <span className="app-kpi-icon-pill"><CheckCircle2 size={16} /></span>
          </div>
          <div className="app-kpi-body">
            <strong className="app-kpi-num">{formatDZD(stats.confirmedAmount)}</strong>
            <span className="app-kpi-sub">Prêt pour expédition COD</span>
          </div>
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

          {orders.some(order => !parseOrderDate(order.createdAt)) && (
            <p className="admin-order-date-note">
              Les anciennes commandes sans date précise sont conservées sous « Toutes les dates ».
            </p>
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
              const count = orders.filter(order => order.status === status).length;
              const meta = labels[status];
              return (
                <button
                  key={status}
                  type="button"
                  className={`app-status-tab tab-${status} ${activeStatus === status ? "active" : ""}`}
                  onClick={() => setActiveStatus(status)}
                >
                  <span className="app-tab-icon">{meta.icon}</span>
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
            {displayedOrders.map(order => {
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
                        <span className="aoc-status-glow-dot" />
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

                  {/* Customer Block with Sleek (Compact) Call & WhatsApp Buttons */}
                  <div className="aoc-customer-box">
                    <div className="aoc-customer-left">
                      <div className="aoc-avatar">
                        {order.customer ? order.customer.slice(0, 2).toUpperCase() : "CL"}
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

                    {/* Compact Call + WhatsApp Action Group */}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="aoc-call-compact-btn"
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
                          onClick={() => onWhatsAppOrder(order)}
                          title="Envoyer un message WhatsApp pré-rempli à la cliente"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "7px 11px",
                            borderRadius: "10px",
                            border: "1px solid rgba(37, 211, 102, 0.35)",
                            background: "rgba(37, 211, 102, 0.12)",
                            color: "#065f46",
                            fontSize: "0.76rem",
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          <MessageCircle size={14} />
                          <span>WhatsApp</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Order Content / Variants */}
                  <div className="aoc-product-row">
                    <div className="aoc-prod-main">
                      <div className="aoc-prod-badge">
                        <Package size={15} />
                      </div>
                      <div className="aoc-prod-name-wrap">
                        <strong className="aoc-prod-title">{order.product}</strong>
                        <div className="aoc-prod-meta-tags">
                          <span className="aoc-chip aoc-chip-qty">
                            Qté : <b>{order.quantity}</b>
                          </span>
                          {order.color && (
                            <span className="aoc-chip aoc-chip-color">
                              Couleur : <b>{order.color}</b>
                            </span>
                          )}
                          {order.size && order.size.trim() !== "" && (
                            <span className="aoc-chip aoc-chip-size">
                              Taille : <b>{order.size}</b>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="aoc-price-tag">
                      <small>Total à encaisser</small>
                      <strong>{formatDZD(order.total)}</strong>
                    </div>
                  </div>

                  {order.note && (
                    <div className="aoc-note-banner">
                      <span className="aoc-note-label">📝 Note :</span>
                      <span className="aoc-note-content">{order.note}</span>
                    </div>
                  )}

                  {/* Complete 1-Tap Confirmation Actions Bar with ALL buttons: Confirmer, NRP 1/2/3, Reporter, Annuler, Modifier, Historique */}
                  <div className="aoc-actions-bar">
                    {order.status !== "confirmee" ? (
                      <button
                        type="button"
                        className="aoc-btn aoc-btn-confirm"
                        onClick={() => onUpdateStatus?.(order.id, "confirmee")}
                      >
                        <CheckCircle2 size={15} />
                        <span>Confirmer</span>
                      </button>
                    ) : (
                      <div className="aoc-tag-confirmed">
                        <CheckCircle2 size={15} />
                        <span>Confirmée</span>
                      </div>
                    )}

                    {/* NRP 1 / NRP 2 / NRP 3 Direct Buttons */}
                    {onSetNrpLevel ? (
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          background: "rgba(245, 158, 11, 0.08)",
                          padding: "2px 4px",
                          borderRadius: "10px",
                          border: "1px solid rgba(245, 158, 11, 0.25)",
                        }}
                      >
                        {([1, 2, 3] as const).map(lvl => {
                          const isActiveNrp =
                            order.status === "ne_repond_pas" && (order.nrpLevel ?? 1) === lvl;
                          return (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() => onSetNrpLevel(order.id, lvl)}
                              title={`Marquer Ne répond pas — Tentative NRP ${lvl}`}
                              style={{
                                padding: "5px 9px",
                                borderRadius: "8px",
                                border: "none",
                                background: isActiveNrp
                                  ? lvl === 3
                                    ? "#dc2626"
                                  : "#d97706"
                                  : "transparent",
                                color: isActiveNrp ? "#fff" : "#92400e",
                                fontSize: "0.75rem",
                                fontWeight: 800,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px",
                              }}
                            >
                              <PhoneOff size={12} />
                              <span>NRP {lvl}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      order.status !== "ne_repond_pas" && (
                        <button
                          type="button"
                          className="aoc-btn aoc-btn-noanswer"
                          onClick={() => onUpdateStatus?.(order.id, "ne_repond_pas")}
                          title="Marquer sans réponse"
                        >
                          <PhoneOff size={14} />
                          <span>Ne répond pas</span>
                        </button>
                      )
                    )}

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
                        className="aoc-btn"
                        onClick={() => onOpenHistory(order)}
                        title="Voir l'historique complet des appels, modifications et statuts"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          background: "rgba(99, 102, 241, 0.1)",
                          color: "#3730a3",
                          border: "1px solid rgba(99, 102, 241, 0.28)",
                          fontWeight: 800,
                        }}
                      >
                        <History size={14} />
                        <span>Historique ({order.history?.length || 1})</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}

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
