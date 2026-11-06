import { useState, useMemo, useEffect } from "react";
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
  DollarSign,
  ChevronRight,
  ShieldCheck,
  Eye,
  X,
} from "lucide-react";
import type { CheckoutOrder } from "@shared/checkout";
import { formatDZD, type OrderStatus } from "@/lib/store-data";
import { trpc } from "@/lib/trpc";

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
  const [filterSituation, setFilterSituation] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedTimelineOrder, setSelectedTimelineOrder] = useState<{
    order: CheckoutOrder;
    tracking?: TrackingData;
  } | null>(null);

  // E-com status to get shipments map
  const ecomStatusQuery = trpc.ecom.status.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });
  const shipments = ecomStatusQuery.data?.shipments || {};

  // Filter transferred orders
  const transferredOrders = useMemo(() => {
    return orders.filter(
      o => o.status === "transferee" || Boolean(shipments[o.id])
    );
  }, [orders, shipments]);

  // Extract all tracking numbers
  const trackingNumbers = useMemo(() => {
    const list: string[] = [];
    for (const o of transferredOrders) {
      const sh = shipments[o.id];
      if (sh?.tracking) list.push(sh.tracking);
    }
    return list;
  }, [transferredOrders, shipments]);

  // Batch tracking query
  const trackingQuery = trpc.ecom.trackBatch.useQuery(
    { trackings: trackingNumbers },
    {
      enabled: trackingNumbers.length > 0,
      refetchInterval: 60000, // Auto refresh tracking every 60s
      refetchOnWindowFocus: false,
    }
  );

  const trackingMap = (trackingQuery.data || {}) as Record<string, TrackingData>;

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

  const copyParcelSlip = (order: CheckoutOrder, tracking?: string) => {
    const text = [
      `📦 COLIS MISS SENSUELLE`,
      `N° Commande: ${order.id}`,
      tracking ? `N° Suivi E-com: ${tracking}` : null,
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

  // Filtered by search and situation
  const filteredOrders = useMemo(() => {
    return transferredOrders.filter(o => {
      const sh = shipments[o.id];
      const trk = sh?.tracking ? trackingMap[sh.tracking] : null;
      const sit = (trk?.situation || "EnCours").toLowerCase();

      if (filterSituation !== "all") {
        if (filterSituation === "livre" && !sit.includes("livr")) return false;
        if (filterSituation === "encours" && !sit.includes("cours")) return false;
        if (filterSituation === "ne_repond_pas" && !sit.includes("repond")) return false;
        if (filterSituation === "reporte" && !sit.includes("report")) return false;
        if (filterSituation === "retour" && (!sit.includes("retour") && !sit.includes("annul") && !sit.includes("refus"))) return false;
      }

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const matchTrk = sh?.tracking?.toLowerCase().includes(q);
      const matchOrder = `${o.id} ${o.customer} ${o.phone} ${o.wilaya} ${o.commune} ${o.product}`
        .toLowerCase()
        .includes(q);
      return matchOrder || matchTrk;
    });
  }, [transferredOrders, shipments, trackingMap, search, filterSituation]);

  // Statistics
  const stats = useMemo(() => {
    let delivered = 0;
    let inTransit = 0;
    let noAnswer = 0;
    let returned = 0;

    for (const o of transferredOrders) {
      const sh = shipments[o.id];
      const trk = sh?.tracking ? trackingMap[sh.tracking] : null;
      const sit = (trk?.situation || "").toLowerCase();

      if (sit.includes("livr")) delivered++;
      else if (sit.includes("repond")) noAnswer++;
      else if (sit.includes("retour") || sit.includes("annul") || sit.includes("refus")) returned++;
      else inTransit++;
    }

    return { total: transferredOrders.length, delivered, inTransit, noAnswer, returned };
  }, [transferredOrders, shipments, trackingMap]);

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
      const sh = shipments[o.id];
      const trk = sh?.tracking ? trackingMap[sh.tracking] : null;
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

  const getStatusBadge = (situation?: string, etatLogistique?: string) => {
    const sit = (situation || "").toLowerCase();
    if (sit.includes("livr")) {
      return {
        label: "Livré",
        cls: "trans-badge-livre",
        icon: "🟢",
        sub: etatLogistique || "Colis remis au client",
      };
    }
    if (sit.includes("repond")) {
      return {
        label: "Ne Répond Pas (Livreur)",
        cls: "trans-badge-norepond",
        icon: "📞",
        sub: etatLogistique || "Tentative d'appel livreur",
      };
    }
    if (sit.includes("report")) {
      return {
        label: "Reporté",
        cls: "trans-badge-reporte",
        icon: "📅",
        sub: etatLogistique || "Reprogrammé avec le client",
      };
    }
    if (sit.includes("retour") || sit.includes("annul") || sit.includes("refus")) {
      return {
        label: "Retour / Refusé",
        cls: "trans-badge-retour",
        icon: "↩️",
        sub: etatLogistique || "En cours de retour",
      };
    }
    return {
      label: "En Transit / Livraison",
      cls: "trans-badge-encours",
      icon: "🚚",
      sub: etatLogistique || "En Préparation / Expédié",
    };
  };

  return (
    <div className="transferred-panel">
      {/* Header */}
      <div className="transferred-header">
        <div className="transferred-title-block">
          <div className="transferred-icon-wrapper">
            <Truck size={24} className="transferred-main-icon" />
          </div>
          <div>
            <div className="transferred-eyebrow">Espace Expéditions & Transporteurs</div>
            <h1 className="transferred-title">
              Commandes Transférées <span>({transferredOrders.length})</span>
            </h1>
            <p className="transferred-desc">
              Toutes les commandes sorties du Dashboard actif avec synchronisation en direct des statuts de livraison.
            </p>
          </div>
        </div>

        <div className="transferred-header-actions">
          <button
            type="button"
            className="trans-btn trans-btn-refresh"
            onClick={() => {
              void ecomStatusQuery.refetch();
              void trackingQuery.refetch();
              if (onRefreshOrders) onRefreshOrders();
              notify("Actualisation des statuts de livraison…");
            }}
            disabled={trackingQuery.isFetching}
          >
            <RefreshCw size={15} className={trackingQuery.isFetching ? "animate-spin" : ""} />
            <span>{trackingQuery.isFetching ? "Actualisation…" : "Actualiser Suivis"}</span>
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

      {/* Stats Cards */}
      <div className="transferred-stats-grid">
        <div
          className={`trans-stat-card ${filterSituation === "all" ? "active" : ""}`}
          onClick={() => setFilterSituation("all")}
        >
          <div className="stat-label">Total Transférées</div>
          <div className="stat-val val-purple">{stats.total}</div>
          <div className="stat-sub">Toutes expéditions</div>
        </div>

        <div
          className={`trans-stat-card ${filterSituation === "encours" ? "active" : ""}`}
          onClick={() => setFilterSituation("encours")}
        >
          <div className="stat-label">En Cours</div>
          <div className="stat-val val-blue">{stats.inTransit}</div>
          <div className="stat-sub">En transit & tournée</div>
        </div>

        <div
          className={`trans-stat-card ${filterSituation === "livre" ? "active" : ""}`}
          onClick={() => setFilterSituation("livre")}
        >
          <div className="stat-label">Livrées</div>
          <div className="stat-val val-green">{stats.delivered}</div>
          <div className="stat-sub">Remises & encaissées</div>
        </div>

        <div
          className={`trans-stat-card ${filterSituation === "ne_repond_pas" ? "active" : ""}`}
          onClick={() => setFilterSituation("ne_repond_pas")}
        >
          <div className="stat-label">Ne Répond Pas</div>
          <div className="stat-val val-orange">{stats.noAnswer}</div>
          <div className="stat-sub">Relance livreur requise</div>
        </div>

        <div
          className={`trans-stat-card ${filterSituation === "retour" ? "active" : ""}`}
          onClick={() => setFilterSituation("retour")}
        >
          <div className="stat-label">Retours / Échecs</div>
          <div className="stat-val val-red">{stats.returned}</div>
          <div className="stat-sub">Refus ou non livrable</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="transferred-toolbar">
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
      </div>

      {/* Orders List / Empty State */}
      {filteredOrders.length === 0 ? (
        <div className="transferred-empty">
          <PackageCheck size={48} className="transferred-empty-icon" />
          <h3>Aucune commande transférée trouvée</h3>
          <p>
            {search || filterSituation !== "all"
              ? "Aucun résultat pour vos filtres de recherche."
              : "Dès que vous validez une commande et cliquez sur Transférer, elle apparaîtra ici avec son suivi direct."}
          </p>
        </div>
      ) : (
        <div className="transferred-cards-grid">
          {filteredOrders.map(order => {
            const sh = shipments[order.id];
            const tracking = sh?.tracking;
            const trk = tracking ? trackingMap[tracking] : null;
            const badge = getStatusBadge(trk?.situation, trk?.etat_logistique);

            return (
              <div key={order.id} className="trans-order-card">
                {/* Card Top */}
                <div className="trans-card-header">
                  <div className="trans-card-ids">
                    <span className="trans-order-id">{order.id}</span>
                    <span className="trans-carrier-pill">
                      <Truck size={12} />
                      E-com Delivery
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
                    onClick={() => copyParcelSlip(order, tracking)}
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
                  <h3>Historique Transporteur E-com</h3>
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
                      {new Date(step.date).toLocaleString("fr-DZ")}
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
