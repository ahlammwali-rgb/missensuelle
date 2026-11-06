import { useState, useMemo } from "react";
import {
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Scan,
  RefreshCw,
  Search,
  FileDown,
  Phone,
  Copy,
  Check,
  Package,
  TrendingUp,
  DollarSign,
  Truck,
  ArrowRight,
  ShieldAlert,
  Clock,
  ExternalLink,
} from "lucide-react";
import type { CheckoutOrder } from "@shared/checkout";
import { adjustProductStock, formatDZD } from "@/lib/store-data";
import { playScanSound } from "@/lib/sound";
import { trpc } from "@/lib/trpc";
import { ParcelScannerModal } from "./ParcelScannerModal";

interface ReturnsPanelProps {
  orders: CheckoutOrder[];
  notify: (msg: string) => void;
  onRefreshOrders?: () => void;
}

type ReturnTab = "all" | "missing" | "received";

export function ReturnsPanel({ orders, notify, onRefreshOrders }: ReturnsPanelProps) {
  const [tab, setTab] = useState<ReturnTab>("all");
  const [search, setSearch] = useState("");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const ecomStatusQuery = trpc.ecom.status.useQuery(undefined, { refetchOnWindowFocus: false });
  const shipments = ecomStatusQuery.data?.shipments || {};

  // Find all orders that have a tracking number or are transferred
  const shippedOrders = useMemo(() => {
    return orders.filter(o => o.status === "transferee" || Boolean(shipments[o.id]));
  }, [orders, shipments]);

  const allTrackings = useMemo(() => {
    return Array.from(new Set(shippedOrders.map(o => shipments[o.id]?.tracking).filter(Boolean)));
  }, [shippedOrders, shipments]);

  const trackingBatchQuery = trpc.ecom.trackBatch.useQuery(
    { trackings: allTrackings },
    {
      enabled: allTrackings.length > 0,
      refetchInterval: 60000,
      staleTime: 30000,
      refetchOnWindowFocus: false,
    }
  );

  const trackingMap = trackingBatchQuery.data || {};
  const markReturnMutation = trpc.admin.markReturnReceived.useMutation();

  // Classify returns according to E-com tracking status and local receipt state
  const returnsList = useMemo(() => {
    return shippedOrders
      .map(order => {
        const tracking = shipments[order.id]?.tracking;
        const info = tracking ? trackingMap[tracking] : undefined;
        const situation = info?.situation || "";
        const etat = info?.etat_logistique || "";

        const isDeclaredReturn =
          situation.toLowerCase().includes("retour") ||
          situation.toLowerCase().includes("refus") ||
          situation.toLowerCase().includes("annul") ||
          etat.toLowerCase().includes("retour");

        const isReceived = Boolean(order.returnReceived);

        if (!isDeclaredReturn && !isReceived) return null;

        return {
          order,
          tracking: tracking || "Sans tracking",
          trackingInfo: info,
          isDeclaredReturn,
          isReceived,
          situation: situation || (isReceived ? "Retour Réceptionné" : "En cours"),
          etatLogistique: etat || (isReceived ? "Au Dépôt" : "En transit"),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [shippedOrders, shipments, trackingMap]);

  // Stats
  const totalCount = returnsList.length;
  const receivedCount = returnsList.filter(r => r.isReceived).length;
  const missingCount = returnsList.filter(r => !r.isReceived).length;

  const recoveredValue = returnsList
    .filter(r => r.isReceived)
    .reduce((sum, r) => sum + (r.order.total || 0), 0);

  const missingValue = returnsList
    .filter(r => !r.isReceived)
    .reduce((sum, r) => sum + (r.order.total || 0), 0);

  // Filtered by active tab and search query
  const filteredReturns = useMemo(() => {
    return returnsList.filter(item => {
      if (tab === "missing" && item.isReceived) return false;
      if (tab === "received" && !item.isReceived) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const combined = `${item.order.customer} ${item.order.phone} ${item.tracking} ${item.order.wilaya} ${item.order.commune} ${item.order.product}`.toLowerCase();
      return combined.includes(q);
    });
  }, [returnsList, tab, search]);

  // Mark single return as received manually
  const toggleReturnReceived = async (order: CheckoutOrder, received: boolean) => {
    try {
      await markReturnMutation.mutateAsync({
        id: order.dbId,
        returnReceived: received,
      });

      const qty = order.quantity || 1;
      const productIdentifier = order.productId || order.product;
      const delta = received ? +qty : -qty;
      const updated = adjustProductStock(productIdentifier, delta);

      playScanSound(received);
      notify(
        received
          ? `✅ Colis ${order.customer} réceptionné ! Stock ${updated?.name || "produit"} réintégré (+${qty})`
          : `↩️ Réception annulée pour ${order.customer}. Stock réajusté (-${qty})`
      );

      await utils.admin.orders.invalidate();
      onRefreshOrders?.();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erreur de mise à jour");
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    notify("Copié dans le presse-papier !");
  };

  // Generate WhatsApp / Email complaint text for missing returns
  const exportComplaintWhatsApp = () => {
    const missing = returnsList.filter(r => !r.isReceived);
    if (!missing.length) {
      notify("Aucun colis retour manquant à réclamer !");
      return;
    }

    const today = new Intl.DateTimeFormat("fr-DZ", { dateStyle: "long" }).format(new Date());
    let msg = `⚠️ *RÉCLAMATION COLIS RETOURS NON REÇUS - MISS SENSUELLE*\n`;
    msg += `📅 Date : ${today}\n`;
    msg += `📦 Nombre de colis manquants : ${missing.length}\n`;
    msg += `💰 Montant total réclamé : ${formatDZD(missingValue)}\n\n`;
    msg += `*Liste des colis déclarés en retour par E-com mais jamais remis physiquement au vendeur :*\n`;

    missing.forEach((item, index) => {
      msg += `\n${index + 1}. *Tracking :* \`${item.tracking}\`\n`;
      msg += `   • Client : ${item.order.customer} (${item.order.phone})\n`;
      msg += `   • Destination : ${item.order.wilaya} / ${item.order.commune}\n`;
      msg += `   • Valeur : ${formatDZD(item.order.total)}\n`;
      msg += `   • Produit : ${item.order.product} (Qté: ${item.order.quantity})\n`;
    });

    msg += `\nMerci de bien vouloir vérifier auprès de vos centres de tri et livreurs, ou procéder à l'indemnisation.`;

    copyToClipboard(msg, "whatsapp-complaint");
    notify("Texte de réclamation complet copié ! Prêt à coller sur WhatsApp E-com.");
  };

  // Export CSV
  const exportCSV = () => {
    const headers = [
      "Tracking",
      "Client",
      "Telephone",
      "Wilaya",
      "Commune",
      "Produit",
      "Quantite",
      "Total DA",
      "Statut Ecom",
      "Receptionne Depôt",
      "Date Reception",
    ];

    const rows = returnsList.map(r => [
      r.tracking,
      r.order.customer,
      r.order.phone,
      r.order.wilaya,
      r.order.commune,
      r.order.product,
      r.order.quantity,
      r.order.total,
      r.situation,
      r.isReceived ? "OUI" : "NON - MANQUANT",
      r.order.returnReceivedAt ? new Date(r.order.returnReceivedAt).toLocaleString("fr-DZ") : "",
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([`\ufeff${csvContent}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reconciliation-retours-ecom-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notify("Export CSV des retours téléchargé !");
  };

  return (
    <section className="returns-admin-section">
      {/* Top Banner & Title */}
      <div className="returns-head">
        <div>
          <span className="eyebrow">Logistique & Rapprochement</span>
          <h2>
            Gestion des Retours & Stocks <span className="count-bubble">{totalCount}</span>
          </h2>
          <p>
            Contrôlez les colis retournés par E-com Delivery, réintégrez le stock au scan et identifiez les colis manquants.
          </p>
        </div>
        <div className="returns-actions-group">
          <button
            type="button"
            className="button button-scanner-action"
            onClick={() => setIsScannerOpen(true)}
          >
            <Scan size={17} /> <span>Scanner un Colis Retour</span>
          </button>
          <button
            type="button"
            className="button button-light"
            onClick={() => void trackingBatchQuery.refetch()}
            disabled={trackingBatchQuery.isFetching}
          >
            <RefreshCw size={15} className={trackingBatchQuery.isFetching ? "spin" : ""} />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="returns-kpis-grid">
        <div className="return-kpi-card">
          <div className="kpi-icon-wrap total">
            <RotateCcw size={20} />
          </div>
          <div>
            <span className="kpi-label">Total Retours Déclarés</span>
            <strong className="kpi-val">{totalCount}</strong>
            <small>par E-com Delivery</small>
          </div>
        </div>

        <div className="return-kpi-card missing">
          <div className="kpi-icon-wrap missing">
            <ShieldAlert size={20} />
          </div>
          <div>
            <span className="kpi-label">En Attente / Manquants</span>
            <strong className="kpi-val text-amber">{missingCount}</strong>
            <small>Valeur : {formatDZD(missingValue)}</small>
          </div>
        </div>

        <div className="return-kpi-card received">
          <div className="kpi-icon-wrap received">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="kpi-label">Reçus & En Stock (+1)</span>
            <strong className="kpi-val text-emerald">{receivedCount}</strong>
            <small>Valeur : {formatDZD(recoveredValue)}</small>
          </div>
        </div>
      </div>

      {/* Missing Returns Notice & Action Bar */}
      {missingCount > 0 && (
        <div className="returns-dispute-alert">
          <AlertTriangle size={22} className="alert-icon-warning" />
          <div className="alert-text">
            <strong>{missingCount} colis en retour n'ont pas encore été reçus physiquement !</strong>
            <p>
              E-com Delivery a déclaré ces colis comme retournés, mais ils n'ont pas été bippés à votre entrepôt. Vous pouvez exporter la réclamation officielle d'un clic.
            </p>
          </div>
          <div className="alert-actions">
            <button
              type="button"
              className="button button-whatsapp"
              onClick={exportComplaintWhatsApp}
            >
              <Copy size={15} /> <span>Copier Réclamation E-com</span>
            </button>
            <button type="button" className="button button-light" onClick={exportCSV}>
              <FileDown size={15} /> <span>Export CSV</span>
            </button>
          </div>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="returns-controls-row">
        <div className="returns-tabs">
          <button
            type="button"
            className={`return-tab-btn ${tab === "all" ? "active" : ""}`}
            onClick={() => setTab("all")}
          >
            Tous les retours ({totalCount})
          </button>
          <button
            type="button"
            className={`return-tab-btn missing ${tab === "missing" ? "active" : ""}`}
            onClick={() => setTab("missing")}
          >
            ⚠️ Manquants ({missingCount})
          </button>
          <button
            type="button"
            className={`return-tab-btn received ${tab === "received" ? "active" : ""}`}
            onClick={() => setTab("received")}
          >
            🟢 Reçus & Réintégrés ({receivedCount})
          </button>
        </div>

        <div className="returns-search-input-wrap">
          <Search size={16} />
          <input
            placeholder="Rechercher par nom, téléphone, tracking..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Main Returns Table / List */}
      <div className="returns-table-card">
        {filteredReturns.length === 0 ? (
          <div className="returns-empty-state">
            <RotateCcw size={40} className="empty-icon" />
            <h3>Aucun colis retour trouvé dans cet onglet</h3>
            <p>
              Dès qu'E-com Delivery signale un colis en situation « Retour » ou « Refusé », il apparaîtra automatiquement ici pour réconciliation.
            </p>
          </div>
        ) : (
          <div className="returns-list">
            {filteredReturns.map(item => (
              <div
                key={item.order.id}
                className={`return-row-item ${item.isReceived ? "status-received" : "status-missing"}`}
              >
                {/* Status Column */}
                <div className="return-col-status">
                  {item.isReceived ? (
                    <span className="badge-pill received">
                      <CheckCircle2 size={13} /> Reçu & En Stock
                    </span>
                  ) : (
                    <span className="badge-pill missing">
                      <Clock size={13} /> En attente de scan
                    </span>
                  )}
                  <span className="return-ecom-tag">E-com: {item.situation}</span>
                </div>

                {/* Customer Info */}
                <div className="return-col-customer">
                  <strong>{item.order.customer}</strong>
                  <span className="phone-line">
                    <Phone size={12} /> {item.order.phone}
                  </span>
                  <small className="destination-line">
                    {item.order.wilaya} · {item.order.commune}
                  </small>
                </div>

                {/* Product & Value */}
                <div className="return-col-product">
                  <div className="prod-badge">
                    <Package size={14} />
                    <span>{item.order.product}</span>
                    <b className="qty-tag">x{item.order.quantity}</b>
                  </div>
                  <strong className="price-tag">{formatDZD(item.order.total)}</strong>
                </div>

                {/* Tracking & Receipt Details */}
                <div className="return-col-tracking">
                  <div className="trk-code-badge">
                    <span>{item.tracking}</span>
                    <button
                      type="button"
                      className="icon-mini-btn"
                      onClick={() => copyToClipboard(item.tracking, item.order.id)}
                      title="Copier le tracking"
                    >
                      {copiedId === item.order.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    </button>
                  </div>
                  {item.order.returnReceivedAt && (
                    <small className="received-date">
                      Scanné le {new Date(item.order.returnReceivedAt).toLocaleDateString("fr-DZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </small>
                  )}
                </div>

                {/* Action Button */}
                <div className="return-col-action">
                  {item.isReceived ? (
                    <button
                      type="button"
                      className="button button-light btn-sm"
                      onClick={() => toggleReturnReceived(item.order, false)}
                      title="Annuler la réception et déduire le stock"
                    >
                      Annuler réception
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="button button-emerald btn-sm"
                      onClick={() => toggleReturnReceived(item.order, true)}
                    >
                      <CheckCircle2 size={14} /> <span>Valider Réception (+1 stock)</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Parcel Scanner Modal */}
      <ParcelScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        mode="return"
        orders={orders}
        notify={notify}
        onRefreshOrders={onRefreshOrders}
      />
    </section>
  );
}
