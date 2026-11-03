import React, { type ReactNode } from "react";
import { Bell, ChevronDown, ExternalLink, Filter, Phone, Search, TrendingUp } from "lucide-react";
import { formatDZD, type Order, type OrderStatus } from "@/lib/store-data";
import { formatOrderDate, getOrderStats, parseOrderDate } from "@/lib/admin-orders";
import { StatusPill } from "./StoreLayout";

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
  stockPanel: ReactNode;
};

const labels: Record<OrderStatus, string> = {
  nouvelle: "Nouvelles", confirmee: "Confirmées", reportee: "Reportées", ne_repond_pas: "Sans réponse", transferee: "Transférées", annulee: "Annulées",
};

export function AdminDashboard({ orders, filtered, activeStatus, setActiveStatus, query, setQuery, period, setPeriod, onSelect, onCall, onExport, stockPanel }: Props) {
  const stats = getOrderStats(orders);
  return (
    <>
      <section className="admin-kpis">
        <div className="kpi-card kpi-purple"><div className="kpi-top"><span>Commandes enregistrées</span><TrendingUp size={18} /></div><strong>{stats.count}</strong><small>{period === "Toutes les dates" ? "Toutes les commandes enregistrées" : period}</small></div>
        <div className="kpi-card kpi-blue"><div className="kpi-top"><span>Montant confirmé</span><TrendingUp size={18} /></div><strong>{formatDZD(stats.confirmedAmount)}</strong><small>Valeur confirmée · pas un montant encaissé</small></div>
        <div className="kpi-card kpi-mint"><div className="kpi-top"><span>Taux de confirmation</span><TrendingUp size={18} /></div><strong>{stats.confirmationRate === null ? "—" : `${new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 1 }).format(stats.confirmationRate)} %`}</strong><small>{stats.count ? `${stats.confirmedCount} confirmée(s) sur ${stats.count}` : "Aucune commande à mesurer"}</small></div>
        <div className="kpi-card kpi-orange"><div className="kpi-top"><span>À traiter maintenant</span><Bell size={18} /></div><strong>{stats.pending}</strong><small>{stats.pending ? "En attente de confirmation" : "Aucune commande à traiter"}</small></div>
      </section>
      <section className="admin-grid">
        <div className="orders-panel admin-panel">
          <div className="panel-heading"><div><span className="eyebrow">Activité enregistrée</span><h2>Commandes <span className="count-bubble">{orders.length}</span></h2></div><button className="button button-outline" onClick={onExport} disabled={!filtered.length}><ExternalLink size={15} />Exporter</button></div>
          <div className="orders-controls">
            <label className="admin-search"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="ID ou numéro de téléphone" /></label>
            <div className="period-select"><Filter size={15} /><select value={period} onChange={event => setPeriod(event.target.value)}><option>Toutes les dates</option><option>30 derniers jours</option><option>7 derniers jours</option><option>Aujourd'hui</option></select><ChevronDown size={15} /></div>
          </div>
          {orders.some(order => !parseOrderDate(order.createdAt)) && <p className="admin-order-date-note">Les anciennes commandes sans date précise sont conservées sous « Toutes les dates ».</p>}
          <div className="status-tabs">
            <button className={activeStatus === "all" ? "active" : ""} onClick={() => setActiveStatus("all")}>Toutes <b>{orders.length}</b></button>
            {(Object.keys(labels) as OrderStatus[]).map(status => <button key={status} className={activeStatus === status ? "active" : ""} onClick={() => setActiveStatus(status)}>{labels[status]} <b>{orders.filter(order => order.status === status).length}</b></button>)}
          </div>
          <div className="orders-table">
            <div className="orders-table-head"><span>Commande</span><span>Client</span><span>Article</span><span>Livraison</span><span>Statut</span><span /></div>
            {filtered.map(order => (
              <div className="order-row" key={order.id}>
                <div data-label="Commande"><strong>{order.id}</strong><small>{formatOrderDate(order.createdAt)}</small></div>
                <div data-label="Client"><strong>{order.customer}</strong><small>{order.phone}</small></div>
                <div data-label="Article"><strong>{order.product}</strong><small>Quantité · {order.quantity}</small></div>
                <div data-label="Livraison"><strong>{order.wilaya}</strong><small>{order.commune}</small></div>
                <div data-label="Statut"><StatusPill status={order.status} /></div>
                <div className="row-actions"><button className="icon-button" title="Appeler" aria-label={`Appeler ${order.customer}`} onClick={() => onCall(order.phone)}><Phone size={15} /></button><button className="row-more" aria-label={`Voir le détail de la commande ${order.id}`} onClick={() => onSelect(order)}>•••</button></div>
              </div>
            ))}
            {!filtered.length && <div className="admin-empty-orders" role="status"><strong>{orders.length ? "Aucune commande pour ces filtres" : "Aucune commande enregistrée"}</strong><p>{orders.length ? "Modifie la recherche, la période ou le statut." : "Les commandes enregistrées apparaîtront ici. Aucune donnée de démonstration n’est affichée."}</p></div>}
          </div>
        </div>
        {stockPanel}
      </section>
    </>
  );
}
