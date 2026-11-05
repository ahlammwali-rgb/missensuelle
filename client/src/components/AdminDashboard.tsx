import React, { useState, type ReactNode } from "react";
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Edit3,
  ExternalLink,
  Filter,
  MapPin,
  Package,
  Phone,
  PhoneOff,
  RotateCcw,
  Search,
  Sparkles,
  TrendingUp,
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
  onExport: () => void;
  onUpdateStatus?: (id: string, status: OrderStatus) => void;
  stockPanel: ReactNode;
};

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
  onExport,
  onUpdateStatus,
  stockPanel,
}: Props) {
  const stats = getOrderStats(orders);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyId = async (id: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(id);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1800);
      }
    } catch {}
  };

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
                Flux Commandes <span className="app-count-bubble">{filtered.length}</span>
              </h2>
            </div>
            <button
              type="button"
              className="app-export-btn"
              onClick={onExport}
              disabled={!filtered.length}
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
            {(Object.keys(labels) as OrderStatus[]).map(status => {
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

          {/* Orders Stream Cards */}
          <div className="app-orders-stream">
            {filtered.map(order => {
              const isNew = order.status === "nouvelle";
              const meta = statusMeta[order.status] ?? statusMeta.nouvelle;

              return (
                <article
                  key={order.id}
                  className={`app-order-card ${meta.cardClass} ${isNew ? "is-new-card" : ""}`}
                >
                  {/* Top Bar: Dedicated Status Badge on Left + Date on Right */}
                  <div className="aoc-top">
                    <div className="aoc-status-badge-wrap">
                      <span className={`aoc-status-pill ${meta.badgeClass}`}>
                        <span className="aoc-status-glow-dot" />
                        <span className="aoc-status-text">{meta.label}</span>
                      </span>
                      {order.status === "transferee" && (
                        <span className="aoc-carrier-tag">E-com Delivery</span>
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

                  {/* Customer Block with Sleek (Compact) Call Button */}
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

                    {/* Compact, Sleek 1-Tap Call Button (Not oversized) */}
                    <button
                      type="button"
                      className="aoc-call-compact-btn"
                      onClick={() => onCall(order.phone)}
                      aria-label={`Appeler ${order.customer || order.phone}`}
                      title="Appeler la cliente"
                    >
                      <Phone size={14} />
                      <span className="aoc-call-num">{order.phone}</span>
                    </button>
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

                  {/* Complete 1-Tap Confirmation Actions Bar with ALL buttons: Confirmer, Ne répond pas, Reporter, Annuler, Modifier */}
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

                    {order.status !== "ne_repond_pas" && (
                      <button
                        type="button"
                        className="aoc-btn aoc-btn-noanswer"
                        onClick={() => onUpdateStatus?.(order.id, "ne_repond_pas")}
                        title="Marquer sans réponse"
                      >
                        <PhoneOff size={14} />
                        <span>Ne répond pas</span>
                      </button>
                    )}

                    {order.status !== "reportee" && (
                      <button
                        type="button"
                        className="aoc-btn aoc-btn-postpone"
                        onClick={() => onUpdateStatus?.(order.id, "reportee")}
                        title="Reporter la confirmation"
                      >
                        <Clock size={14} />
                        <span>Reporter</span>
                      </button>
                    )}

                    {order.status !== "annulee" ? (
                      <button
                        type="button"
                        className="aoc-btn aoc-btn-cancel"
                        onClick={() => onUpdateStatus?.(order.id, "annulee")}
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
                  </div>
                </article>
              );
            })}

            {!filtered.length && (
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
