import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Bell, ChevronDown, ClipboardList, Copy, ExternalLink, Facebook, FileSpreadsheet, Filter, ImagePlus, LayoutDashboard, Moon, MoreHorizontal, Package, PackageCheck, Pencil, Phone, Plus, RefreshCw, RotateCcw, Save, Search, Settings2, Sun, Trash2, Truck, TrendingUp, Upload, Users, X } from "lucide-react";
import { Link } from "wouter";
import { AdminAuthGate } from "@/components/AdminAuthGate";
import { AbandonedOrders } from "@/components/AbandonedOrders";
import { trpc } from "@/lib/trpc";
import type { CheckoutOrder } from "@shared/checkout";
import { abayaCommunesByWilaya, abayaWilayas } from "@/lib/abaya-communes";
import { categories, getCatalogProducts, saveCatalogProducts, formatDZD, wilayas, type Order, type OrderStatus, type Product } from "@/lib/store-data";
import { StatusPill } from "@/components/StoreLayout";
import { useTheme } from "@/contexts/ThemeContext";
import { getPixelConfig, savePixelConfig, trackPixelEvent, hasGlobalTikTokPixel, hasGlobalFacebookPixel, type PixelConfig } from "@/lib/tracking";
import "./admin-responsive.css";
import "./admin-app.css";
import { PixelDiagnostics } from "@/components/PixelDiagnostics";
import { AdminDashboard } from "@/components/AdminDashboard";
import { EcomDeliveryPanel } from "@/components/EcomDelivery";
import { GoogleSheetPanel } from "@/components/GoogleSheetPanel";
import { TransferredOrdersPanel } from "@/components/TransferredOrdersPanel";
import { ReturnsPanel } from "@/components/ReturnsPanel";
import { loadRealOrders, orderMatchesPeriod } from "@/lib/admin-orders";

const actionLabels: { status: OrderStatus; label: string }[] = [{ status: "confirmee", label: "Confirmer" }, { status: "annulee", label: "Annuler" }, { status: "reportee", label: "Reporter" }, { status: "ne_repond_pas", label: "Ne répond pas" }, { status: "transferee", label: "Transférer" }];
type AdminSection = "dashboard" | "abandoned" | "catalogue" | "settings" | "ecom" | "sheet" | "transferred" | "returns";

type DashboardOrder = Order;

const emptyProduct: Product = { id: "", slug: "", name: "", category: "mode", categoryLabel: "Mode femme", price: 0, oldPrice: 0, badge: "Nouveau", description: "", details: [], colors: [], image: "", gallery: [], arName: "", arCategoryLabel: "", arDescription: "", accent: "#9B82F6", stock: 0 };

function toDashboardOrder(order: CheckoutOrder): DashboardOrder {
  return {
    id: order.id,
    createdAt: order.createdAt,
    customer: order.customer,
    phone: order.phone,
    productId: order.productId,
    product: order.product,
    quantity: order.quantity,
    total: order.total,
    color: order.color,
    size: order.size,
    delivery: order.delivery,
    wilaya: order.wilaya,
    commune: order.commune,
    address: order.address,
    note: order.note,
    status: order.status,
  };
}

function AdminPageContent() {
  const { theme, toggleTheme } = useTheme();
  const [section, setSection] = useState<AdminSection>(() => {
    const requested = new URLSearchParams(window.location.search).get("section");
    return requested === "abandoned" || requested === "catalogue" || requested === "settings" || requested === "ecom" || requested === "sheet" || requested === "transferred" || requested === "returns" ? requested : "dashboard";
  });
  const [activeStatus, setActiveStatus] = useState<"all" | OrderStatus>("all");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("Toutes les dates");
  const [selected, setSelected] = useState<CheckoutOrder | null>(null);
  const [toast, setToast] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [searchPopupQuery, setSearchPopupQuery] = useState("");
  const ordersQuery = trpc.admin.orders.useQuery(undefined, { refetchInterval: 10000, refetchIntervalInBackground: false, refetchOnWindowFocus: true, retry: false });
  const abandonedQuery = trpc.admin.abandonedOrders.useQuery(undefined, { refetchInterval: 10000, refetchIntervalInBackground: false, refetchOnWindowFocus: true, retry: false });
  const utils = trpc.useUtils();
  const updateOrderStatus = trpc.admin.updateOrderStatus.useMutation();
  const updateOrderDetails = trpc.admin.updateOrderDetails.useMutation();
  const deleteOrderMutation = trpc.admin.deleteOrder.useMutation();
  const restoreOrders = trpc.admin.restoreOrders.useMutation();
  const restoredOnceRef = useRef(false);
  const syncSheetMutation = trpc.googleSheet.syncOrders.useMutation({
    onSuccess: (data) => {
      if (data.added > 0) {
        notify("Nouvelle(s) commande(s) TikTok synchronisée(s) !");
        void utils.admin.orders.invalidate();
      }
    },
  });
  useEffect(() => {
    syncSheetMutation.mutate();
  }, []);
  const serverOrders = ordersQuery.data ?? [];

  useEffect(() => {
    if (ordersQuery.isLoading || ordersQuery.error) return;
    try {
      const serverIds = new Set(serverOrders.map(o => o.id));
      const localOrders = loadRealOrders();
      const backupRaw = JSON.parse(
        localStorage.getItem("miss-sensuelle-admin-orders-backup") || "[]",
      ) as Order[];
      const combined = [...localOrders, ...(Array.isArray(backupRaw) ? backupRaw : [])];
      const uniqueMissing = new Map<string, Order>();
      for (const item of combined) {
        if (item && item.id && !serverIds.has(item.id) && !uniqueMissing.has(item.id)) {
          uniqueMissing.set(item.id, item);
        }
      }
      if (uniqueMissing.size > 0 && !restoredOnceRef.current) {
        restoredOnceRef.current = true;
        restoreOrders.mutate(
          { orders: Array.from(uniqueMissing.values()) },
          {
            onSuccess: async res => {
              if (res.restored > 0) {
                await utils.admin.orders.invalidate();
              }
            },
          },
        );
      }
      if (serverOrders.length > 0) {
        localStorage.setItem(
          "miss-sensuelle-admin-orders-backup",
          JSON.stringify(serverOrders),
        );
      }
    } catch {
      // Ignore storage error
    }
  }, [ordersQuery.isLoading, ordersQuery.error, serverOrders]);
  const orderById = useMemo(() => new Map(serverOrders.map(order => [order.id, order])), [serverOrders]);
  const orders = useMemo(() => serverOrders.map(toDashboardOrder), [serverOrders]);
  const periodOrders = useMemo(() => orders.filter(order => order.status !== "transferee" && orderMatchesPeriod(order, period)), [orders, period]);
  const filtered = useMemo(() => periodOrders.filter(order => order.status !== "transferee" && (activeStatus === "all" || order.status === activeStatus) && `${order.id} ${order.phone} ${order.customer}`.toLowerCase().includes(query.toLowerCase())), [periodOrders, activeStatus, query]);
  const transferredCount = useMemo(() => serverOrders.filter(order => order.status === "transferee").length, [serverOrders]);
  const searchResults = useMemo(() => {
    if (!searchPopupQuery.trim()) return [];
    const q = searchPopupQuery.toLowerCase().trim();
    return serverOrders
      .filter(o => `${o.id} ${o.customer} ${o.phone} ${o.wilaya} ${o.commune} ${o.product}`.toLowerCase().includes(q))
      .slice(0, 30);
  }, [serverOrders, searchPopupQuery]);
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2800); };
  const updateStatus = (id: string, status: OrderStatus) => {
    const source = orderById.get(id);
    if (!source) { notify("Commande introuvable dans les données serveur"); return; }
    updateOrderStatus.mutate({ id: source.dbId, status }, { onSuccess: async () => { await utils.admin.orders.invalidate(); notify(status === "transferee" ? `Commande ${id} transférée vers la section dédiée ✦` : `Commande ${id} · ${status === "confirmee" ? "confirmée" : "statut mis à jour"}`); setSelected(null); }, onError: error => notify(error.message || "Mise à jour impossible") });
  };
  const saveOrderDetails = (dbId: number, updates: Omit<Parameters<typeof updateOrderDetails.mutate>[0], "id">) => {
    updateOrderDetails.mutate(
      { id: dbId, ...updates },
      {
        onSuccess: async updated => {
          await utils.admin.orders.invalidate();
          if (updated) setSelected(updated);
          notify("Modifications de la commande enregistrées ✦");
        },
        onError: error => notify(error.message || "Impossible d'enregistrer les modifications"),
      }
    );
  };
  const handleDeleteOrder = (dbId: number) => {
    deleteOrderMutation.mutate(
      { id: dbId },
      {
        onSuccess: async () => {
          await utils.admin.orders.invalidate();
          setSelected(null);
          notify("Commande supprimée du tableau de bord");
        },
        onError: error => notify(error.message || "Suppression impossible"),
      }
    );
  };
  const callCustomer = async (phone: string) => { const clean = phone.replace(/[\s().-]/g, ""); try { if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(clean); else throw new Error("clipboard"); } catch { try { const area = document.createElement("textarea"); area.value = clean; area.style.position = "fixed"; area.style.opacity = "0"; document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove(); } catch {} } notify("Numéro copié · ouverture du téléphone…"); window.location.href = `tel:${clean}`; };
  const exportOrders = () => { const header = ["ID", "Date", "Client", "Téléphone", "Produit", "Quantité", "Couleur", "Taille", "Type Livraison", "Total", "Wilaya", "Commune", "Adresse", "Note", "Statut"]; const rows = filtered.map(order => [order.id, order.createdAt, order.customer, order.phone, order.product, order.quantity, order.color ?? "", order.size ?? "", order.delivery === "office" ? "Bureau" : "Domicile", order.total, order.wilaya, order.commune, order.address, order.note, order.status]); const csv = [header, ...rows].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n"); const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `miss-sensuelle-commandes-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url); notify("Export CSV prêt"); };
  const abandonedCount = abandonedQuery.data?.length;
  const go = (next: AdminSection) => setSection(next);

  return <div className="admin-shell"><aside className="admin-sidebar"><Link href="/" className="wordmark admin-wordmark"><span className="wordmark-star">✦</span><span>miss</span><em>sensuelle</em></Link><nav className="admin-mobile-nav" aria-label="Navigation admin mobile"><button type="button" className={section === "dashboard" && !isMoreMenuOpen ? "active" : ""} aria-current={section === "dashboard" ? "page" : undefined} onClick={() => { go("dashboard"); setIsMoreMenuOpen(false); }}><LayoutDashboard size={17} /><span>Dashboard</span></button><button type="button" className={section === "transferred" && !isMoreMenuOpen ? "active" : ""} aria-current={section === "transferred" ? "page" : undefined} onClick={() => { go("transferred"); setIsMoreMenuOpen(false); }}><Truck size={17} /><span>Transférées</span>{transferredCount > 0 && <span className="nav-count-badge">{transferredCount}</span>}</button><button type="button" className={section === "ecom" && !isMoreMenuOpen ? "active" : ""} aria-current={section === "ecom" ? "page" : undefined} onClick={() => { go("ecom"); setIsMoreMenuOpen(false); }}><PackageCheck size={17} /><span>Livraison</span></button><button type="button" className="btn-nav-search" onClick={() => { setIsSearchOpen(true); setIsMoreMenuOpen(false); }} aria-label="Recherche rapide de commande"><Search size={17} /><span>Recherche</span></button><button type="button" className={isMoreMenuOpen ? "active" : ""} onClick={() => setIsMoreMenuOpen(prev => !prev)} aria-label="Plus de menus"><MoreHorizontal size={17} /><span>Menu</span></button></nav><div className="admin-user"><div className="admin-avatar">MS</div><div><strong>Miss Sensuelle</strong><span>Administratrice</span></div></div><nav className="admin-nav"><span className="admin-nav-label">Workspace</span><button className={section === "dashboard" ? "active" : ""} onClick={() => go("dashboard")}><LayoutDashboard size={18} />Vue d'ensemble</button><button className={section === "dashboard" ? "active" : ""} onClick={() => go("dashboard")}><ClipboardList size={18} />Commandes Actives <b>{orders.filter(order => order.status !== "transferee" && order.status === "nouvelle").length}</b></button><button className={section === "transferred" ? "active" : ""} onClick={() => go("transferred")}><Truck size={18} />Transférées <b className="nav-badge-purple">{transferredCount}</b></button><button className={section === "abandoned" ? "active" : ""} onClick={() => go("abandoned")}><ClipboardList size={18} />Commandes abandonnées <b>{abandonedCount === undefined ? "—" : abandonedCount}</b></button><button className={section === "sheet" ? "active" : ""} onClick={() => go("sheet")}><FileSpreadsheet size={18} />Google Sheets</button><button className={section === "ecom" ? "active" : ""} onClick={() => go("ecom")}><Truck size={18} />E-com Delivery <b>{orders.filter(order => order.status === "confirmee").length}</b></button><button className={section === "returns" ? "active" : ""} onClick={() => go("returns")}><RotateCcw size={18} />Retours & Stocks</button><button className={section === "catalogue" ? "active" : ""} onClick={() => go("catalogue")}><Package size={18} />Catalogue <b>{getCatalogProducts().length}</b></button><button onClick={() => go("catalogue")}><Users size={18} />Stocks</button><span className="admin-nav-label">Réglages</span><button><BarChart3 size={18} />Rapports</button><button className={section === "settings" ? "active" : ""} onClick={() => go("settings")}><Settings2 size={18} />Pixels & paramètres</button></nav><Link href="/" className="back-store">← Retour à la boutique</Link></aside><main className="admin-main"><header className="admin-topbar"><div><span className="eyebrow">{new Intl.DateTimeFormat("fr-DZ", { timeZone: "Africa/Algiers", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}</span><h1>{section === "transferred" ? "Commandes Transférées & Suivi" : section === "returns" ? "Gestion des Retours & Stocks" : section === "catalogue" ? "Catalogue produits" : section === "ecom" ? "E-com Delivery" : section === "sheet" ? "Google Sheets" : section === "settings" ? "Pixels & paramètres" : section === "abandoned" ? "Commandes abandonnées" : "Bonjour, Miss"} <span>✦</span></h1></div><div className="admin-top-actions"><button type="button" className="neo-darkmode-btn" onClick={toggleTheme} title={theme === "dark" ? "Mode Clair" : "Mode Sombre Neo Waw"} aria-label="Basculer Mode Sombre Neo">
  {theme === "dark" ? (
    <>
      <Sun size={15} className="neo-sun-glow" />
      <span className="neo-btn-label">Clair</span>
    </>
  ) : (
    <>
      <Moon size={15} className="neo-moon-glow" />
      <span className="neo-btn-label">Dark</span>
      <span className="neo-glow-badge">NEO</span>
    </>
  )}
</button><button className="icon-button" aria-label="Notifications"><Bell size={19} />{orders.some(order => order.status === "nouvelle") && <i />}</button><div className="admin-profile"><div className="admin-avatar small">MS</div><ChevronDown size={16} /></div></div></header><div className="admin-content">{section === "transferred" ? <TransferredOrdersPanel orders={serverOrders} notify={notify} onUpdateStatus={updateStatus} onRefreshOrders={() => void utils.admin.orders.invalidate()} /> : section === "returns" ? <ReturnsPanel orders={serverOrders} notify={notify} onRefreshOrders={() => void utils.admin.orders.invalidate()} /> : section === "catalogue" ? <CatalogPanel notify={notify} /> : section === "sheet" ? <GoogleSheetPanel notify={notify} onOrdersUpdated={() => void utils.admin.orders.invalidate()} /> : section === "ecom" ? <EcomDeliveryPanel orders={serverOrders} notify={notify} onShipped={() => void utils.admin.orders.invalidate()} /> : section === "settings" ? <TrackingSettings notify={notify} /> : section === "abandoned" ? <AbandonedOrders items={abandonedQuery.data ?? []} isLoading={abandonedQuery.isLoading} isError={Boolean(abandonedQuery.error)} onRetry={() => void abandonedQuery.refetch()} onConverted={() => void utils.admin.orders.invalidate()} /> : ordersQuery.isLoading ? <section className="admin-data-state" role="status"><span className="eyebrow">Données enregistrées</span><h2>Chargement des commandes…</h2><p>La vue admin attend la réponse sécurisée du serveur.</p></section> : ordersQuery.error ? <section className="admin-data-state admin-data-error" role="alert"><span className="eyebrow">Données indisponibles</span><h2>Les commandes n’ont pas pu être chargées.</h2><p>Une erreur serveur ou réseau est survenue. Les données ne sont pas remplacées par une liste vide.</p><button type="button" className="button button-gradient" onClick={() => void ordersQuery.refetch()}><RefreshCw size={16} /> Réessayer</button></section> : <AdminDashboard orders={periodOrders} filtered={filtered} activeStatus={activeStatus} setActiveStatus={setActiveStatus} query={query} setQuery={setQuery} period={period} setPeriod={setPeriod} onSelect={order => setSelected(orderById.get(order.id) ?? null)} onCall={callCustomer} onExport={exportOrders} onUpdateStatus={updateStatus} stockPanel={<StockPanel onManageCatalog={() => go("catalogue")} onOpenSheet={() => go("sheet")} />} />}</div></main>{isSearchOpen && (
  <div className="admin-search-modal-overlay" onClick={() => setIsSearchOpen(false)}>
    <div className="admin-search-modal" onClick={e => e.stopPropagation()}>
      <div className="admin-search-modal-head">
        <div className="admin-search-modal-input-wrap">
          <Search size={18} className="search-modal-icon" />
          <input
            type="text"
            autoFocus
            placeholder="Numéro de tel, nom de cliente, wilaya, ID…"
            value={searchPopupQuery}
            onChange={e => setSearchPopupQuery(e.target.value)}
          />
          {searchPopupQuery && (
            <button
              type="button"
              className="search-modal-clear"
              onClick={() => setSearchPopupQuery("")}
            >
              <X size={15} />
            </button>
          )}
        </div>
        <button
          type="button"
          className="search-modal-close"
          onClick={() => setIsSearchOpen(false)}
          aria-label="Fermer la recherche"
        >
          <X size={20} />
        </button>
      </div>

      <div className="admin-search-modal-results">
        {!searchPopupQuery.trim() ? (
          <div className="search-modal-placeholder">
            <Search size={36} className="search-ph-icon" />
            <p>Recherchez rapidement n'importe quelle commande par numéro de téléphone ou nom de client.</p>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="search-modal-placeholder">
            <p>Aucun résultat pour <strong>« {searchPopupQuery} »</strong></p>
          </div>
        ) : (
          <div className="search-modal-list">
            <div className="search-results-count">{searchResults.length} commande(s) trouvée(s) :</div>
            {searchResults.map(order => (
              <div
                key={order.id}
                className="search-result-card"
                onClick={() => {
                  setSelected(order);
                  setIsSearchOpen(false);
                }}
              >
                <div className="src-top">
                  <div>
                    <span className="src-name">{order.customer || "Cliente"}</span>
                    <span className="src-phone">{order.phone}</span>
                  </div>
                  <span className={`src-badge badge-status-${order.status}`}>
                    {order.status === "nouvelle" ? "Nouvelle" :
                     order.status === "confirmee" ? "Confirmée" :
                     order.status === "transferee" ? "Transférée" :
                     order.status === "reportee" ? "Reportée" :
                     order.status === "ne_repond_pas" ? "Ne répond pas" : "Annulée"}
                  </span>
                </div>
                <div className="src-details">
                  <span>{order.product}</span>
                  <strong>{formatDZD(order.total)}</strong>
                </div>
                <div className="src-bottom">
                  <span>📍 {order.wilaya} {order.commune ? `— ${order.commune}` : ""}</span>
                  <button
                    type="button"
                    className="src-call-btn"
                    onClick={e => {
                      e.stopPropagation();
                      callCustomer(order.phone);
                    }}
                  >
                    <Phone size={12} /> Appeler
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
)}{isMoreMenuOpen && (
  <div className="admin-more-menu-overlay" onClick={() => setIsMoreMenuOpen(false)}>
    <div className="admin-more-menu-sheet" onClick={e => e.stopPropagation()}>
      <div className="admin-more-sheet-head">
        <div className="admin-more-sheet-handle" />
        <div className="admin-more-sheet-title-row">
          <h3>Menu & Autres Espaces</h3>
          <button
            type="button"
            className="admin-more-sheet-close"
            onClick={() => setIsMoreMenuOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="admin-more-sheet-grid">
        <button
          type="button"
          className={`more-sheet-item ${section === "abandoned" ? "active" : ""}`}
          onClick={() => { go("abandoned"); setIsMoreMenuOpen(false); }}
        >
          <div className="more-item-icon icon-orange">
            <ClipboardList size={20} />
          </div>
          <div className="more-item-text">
            <strong>Commandes Abandonnées</strong>
            <small>Récupération des paniers</small>
          </div>
          {abandonedCount !== undefined && abandonedCount > 0 && (
            <span className="more-item-badge">{abandonedCount}</span>
          )}
        </button>

        <button
          type="button"
          className={`more-sheet-item ${section === "returns" ? "active" : ""}`}
          onClick={() => { go("returns"); setIsMoreMenuOpen(false); }}
        >
          <div className="more-item-icon icon-rose">
            <RotateCcw size={20} />
          </div>
          <div className="more-item-text">
            <strong>Retours & Stocks</strong>
            <small>Scanner au dépôt & litiges E-com</small>
          </div>
        </button>

        <button
          type="button"
          className={`more-sheet-item ${section === "sheet" ? "active" : ""}`}
          onClick={() => { go("sheet"); setIsMoreMenuOpen(false); }}
        >
          <div className="more-item-icon icon-emerald">
            <FileSpreadsheet size={20} />
          </div>
          <div className="more-item-text">
            <strong>Google Sheets</strong>
            <small>Synchronisation auto Leads & TikTok</small>
          </div>
        </button>

        <button
          type="button"
          className={`more-sheet-item ${section === "catalogue" ? "active" : ""}`}
          onClick={() => { go("catalogue"); setIsMoreMenuOpen(false); }}
        >
          <div className="more-item-icon icon-blue">
            <Package size={20} />
          </div>
          <div className="more-item-text">
            <strong>Catalogue & Stocks</strong>
            <small>Gestion des produits et prix</small>
          </div>
        </button>

        <button
          type="button"
          className={`more-sheet-item ${section === "settings" ? "active" : ""}`}
          onClick={() => { go("settings"); setIsMoreMenuOpen(false); }}
        >
          <div className="more-item-icon icon-purple">
            <Settings2 size={20} />
          </div>
          <div className="more-item-text">
            <strong>Pixels & Paramètres</strong>
            <small>TikTok, Meta & Réglages boutique</small>
          </div>
        </button>

        <Link
          href="/"
          className="more-sheet-item more-store-link"
          onClick={() => setIsMoreMenuOpen(false)}
        >
          <div className="more-item-icon icon-slate">
            <ExternalLink size={20} />
          </div>
          <div className="more-item-text">
            <strong>Retour à la boutique</strong>
            <small>Voir la boutique en ligne</small>
          </div>
        </Link>
      </div>
    </div>
  </div>
)}{selected && <OrderModal order={selected} isSaving={updateOrderDetails.isPending} onClose={() => setSelected(null)} onCall={callCustomer} onUpdate={updateStatus} onSaveDetails={saveOrderDetails} onDelete={handleDeleteOrder} onCopy={() => { void copyOrderDetails(selected, notify); setSelected(null); }} />}{toast && <div className="toast-admin"><span>✦</span>{toast}</div>}</div>;
}

async function copyOrderDetails(order: CheckoutOrder, notify: (message: string) => void) { const value = `${order.id} · ${order.customer} · ${order.phone}`; try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); notify("Détails copiés"); return; } } catch {} try { const area = document.createElement("textarea"); area.value = value; area.style.position = "fixed"; area.style.opacity = "0"; document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove(); notify("Détails copiés"); } catch { notify("Copie indisponible dans ce navigateur"); } }

export default function AdminPage() { return <AdminAuthGate><AdminPageContent /></AdminAuthGate>; }

function StockPanel({ onManageCatalog, onOpenSheet }: { onManageCatalog: () => void; onOpenSheet?: () => void }) {
  const catalog = getCatalogProducts();
  const sheetQuery = trpc.googleSheet.getConfig.useQuery(undefined, { refetchOnWindowFocus: false, retry: false });
  const isConnected = Boolean(sheetQuery.data?.connected);

  return (
    <div className="stock-panel admin-panel">
      <div className="panel-heading"><div><span className="eyebrow">Inventaire</span><h2>Stock renseigné</h2></div><Package size={18} /></div>
      <div className="stock-list">{catalog.slice(0, 5).map(product => <div className="stock-row" key={product.id}><img src={product.image} alt="" /><div><strong>{product.name}</strong><small>{product.categoryLabel}</small></div><div className="stock-progress"><span><b>{product.stock}</b> unités</span></div></div>)}</div>
      <button type="button" className="button button-light full" onClick={onManageCatalog}>Gérer le catalogue <ChevronDown size={16} /></button>
      <div
        className="sheet-status"
        onClick={onOpenSheet}
        style={{ cursor: "pointer", transition: "all .15s" }}
        title="Gérer la synchronisation Google Sheets"
      >
        <span className="sheet-dot" style={{ background: isConnected ? "#10b981" : "#a8a5a0", boxShadow: isConnected ? "0 0 0 4px rgba(16,185,129,0.2)" : undefined }} />
        <div>
          <strong>{isConnected ? `Google Sheets connecté (${sheetQuery.data?.rowCount} lignes)` : "Google Sheets non connecté"}</strong>
          <small>{isConnected ? "Cliquez pour synchroniser" : "Cliquez pour configurer le lien"}</small>
        </div>
      </div>
    </div>
  );
}

function CatalogPanel({ notify }: { notify: (message: string) => void }) {
  const [catalog, setCatalog] = useState<Product[]>(() => getCatalogProducts());
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const refresh = (next: Product[]) => { try { saveCatalogProducts(next); } catch { notify("Sauvegarde impossible : stockage bloqué ou plein"); return false; } setCatalog(next); return true; };
  const remove = (id: string) => { if (!window.confirm("Supprimer définitivement ce produit du catalogue ?")) return; if (refresh(catalog.filter(product => product.id !== id))) notify("Produit supprimé du catalogue"); };
  return <section className="catalog-admin"><div className="catalog-admin-head"><div><span className="eyebrow">Gestion complète</span><h2>Catalogue <span className="count-bubble">{catalog.length}</span></h2><p>Ajoute, modifie ou supprime les produits visibles sur la boutique.</p></div><button className="button button-gradient" onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={17} />Ajouter un produit</button></div>{showForm && <ProductForm initial={editing ?? emptyProduct} onCancel={() => setShowForm(false)} onSave={product => { const next = editing ? catalog.map(item => item.id === product.id ? product : item) : [...catalog, product]; if (refresh(next)) { setShowForm(false); notify(editing ? "Produit modifié" : "Produit ajouté au catalogue"); } }} /> }<div className="catalog-admin-grid">{catalog.map(product => <article className="catalog-admin-card" key={product.id}><div className="catalog-admin-image"><img src={product.image} alt={product.name} /><span>{product.stock} en stock</span></div><div className="catalog-admin-info"><span className="product-category">{product.categoryLabel}</span><h3>{product.name}</h3><strong>{formatDZD(product.price)}</strong><p>{product.description}</p><div className="catalog-admin-actions"><button className="button button-light" onClick={() => { setEditing(product); setShowForm(true); }}><Pencil size={15} />Modifier</button><button className="icon-button danger-icon" onClick={() => remove(product.id)} title="Supprimer" aria-label={`Supprimer ${product.name}`}><Trash2 size={16} /></button></div></div></article>)}</div></section>;
}

function ProductForm({ initial, onCancel, onSave }: { initial: Product; onCancel: () => void; onSave: (product: Product) => void }) {
  const [form, setForm] = useState<Product>(initial); const [galleryText, setGalleryText] = useState((initial.gallery ?? []).join("\n")); const imageRef = useRef<HTMLInputElement>(null); const galleryRef = useRef<HTMLInputElement>(null);
  const set = (key: keyof Product, value: Product[keyof Product]) => setForm(current => ({ ...current, [key]: value }));
  const readImages = (files: FileList | null, multiple: boolean) => { if (!files?.length) return; const readers = Array.from(files).map(file => new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file); })); Promise.all(readers).then(values => { if (multiple) setGalleryText(current => [...current.split("\n").filter(Boolean), ...values].join("\n")); else set("image", values[0]); }); };
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const slug = form.slug || form.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); const product = { ...form, id: form.id || `p-${Date.now()}`, slug, price: Number(form.price), oldPrice: form.oldPrice ? Number(form.oldPrice) : undefined, stock: Number(form.stock), details: typeof form.details === "string" ? String(form.details).split("\n").filter(Boolean) : [], colors: typeof form.colors === "string" ? String(form.colors).split(",").map(value => value.trim()).filter(Boolean) : [], gallery: galleryText.split("\n").map(value => value.trim()).filter(Boolean) }; onSave(product); };
  return <form className="product-admin-form" onSubmit={submit}><div className="form-panel-head"><div><span className="eyebrow">{initial.id ? "Modifier" : "Nouveau produit"}</span><h3>{initial.id ? initial.name : "Créer une fiche complète"}</h3></div><button type="button" className="icon-button" onClick={onCancel} aria-label="Fermer le formulaire"><X size={18} /></button></div><div className="product-admin-grid"><label>Nom du produit<input required value={form.name} onChange={e => set("name", e.target.value)} /></label><label>Slug URL<input value={form.slug} onChange={e => set("slug", e.target.value)} placeholder="auto-generé si vide" /></label><label>Catégorie<select value={form.category} onChange={e => { const category = categories.find(item => item.id === e.target.value); set("category", e.target.value as Product["category"]); set("categoryLabel", category?.label ?? "Mode femme"); }}>{categories.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label><label>Badge<input value={form.badge ?? ""} onChange={e => set("badge", e.target.value)} placeholder="Nouveau, Best-seller…" /></label><label>Prix DA<input required type="number" min="0" value={form.price} onChange={e => set("price", Number(e.target.value))} /></label><label>Ancien prix DA<input type="number" min="0" value={form.oldPrice ?? ""} onChange={e => set("oldPrice", e.target.value ? Number(e.target.value) : undefined)} /></label><label>Stock<input required type="number" min="0" value={form.stock} onChange={e => set("stock", Number(e.target.value))} /></label><label>Couleur accent<input type="color" value={form.accent} onChange={e => set("accent", e.target.value)} /></label><label className="wide-field">Description<textarea required value={form.description} onChange={e => set("description", e.target.value)} /></label><label>Détails (une ligne par détail)<textarea value={Array.isArray(form.details) ? form.details.join("\n") : String(form.details)} onChange={e => set("details", e.target.value as never)} /></label><label>Couleurs séparées par virgule<textarea value={Array.isArray(form.colors) ? form.colors.join(", ") : String(form.colors)} onChange={e => set("colors", e.target.value as never)} /></label><label>Photo principale (URL)<input required value={form.image} onChange={e => set("image", e.target.value)} /><button type="button" className="upload-inline" onClick={() => imageRef.current?.click()}><ImagePlus size={14} />Importer une photo</button><input ref={imageRef} className="visually-hidden" type="file" accept="image/*" onChange={e => readImages(e.target.files, false)} /></label><label>Galerie (une URL par ligne)<textarea value={galleryText} onChange={e => setGalleryText(e.target.value)} /><button type="button" className="upload-inline" onClick={() => galleryRef.current?.click()}><Upload size={14} />Ajouter des photos</button><input ref={galleryRef} className="visually-hidden" type="file" accept="image/*" multiple onChange={e => readImages(e.target.files, true)} /></label><label>Nom arabe<input value={form.arName ?? ""} onChange={e => set("arName", e.target.value)} /></label><label>Catégorie arabe<input value={form.arCategoryLabel ?? ""} onChange={e => set("arCategoryLabel", e.target.value)} /></label><label className="wide-field">Description arabe<textarea value={form.arDescription ?? ""} onChange={e => set("arDescription", e.target.value)} /></label></div><div className="form-panel-actions"><button type="button" className="button button-light" onClick={onCancel}>Annuler</button><button type="submit" className="button button-gradient"><Save size={16} />Enregistrer le produit</button></div></form>;
}

function TrackingSettings({ notify }: { notify: (message: string) => void }) { const globalTikTok = hasGlobalTikTokPixel(); const globalFacebook = hasGlobalFacebookPixel(); const [config, setConfig] = useState<PixelConfig>(() => getPixelConfig()); const update = (key: keyof PixelConfig, value: string) => setConfig(current => ({ ...current, [key]: value })); const save = () => { try { savePixelConfig(config); notify("Pixels globaux du site · préférences enregistrées"); } catch (error) { notify(error instanceof Error ? error.message : "Impossible d’enregistrer les préférences pixels"); } }; return <section className="tracking-settings"><div className="settings-hero"><span className="eyebrow">Mesure & acquisition</span><h2>Connecte tes pixels<br /><em>sans perdre le signal.</em></h2><p>Les événements ViewContent, InitiateCheckout et Purchase sont envoyés sur les pages produit et après validation COD.</p></div><p className="tracking-config-notice">Meta et TikTok sont installés dans l’en-tête pour tous les visiteurs avec les identifiants du site. Ces identifiants globaux ne sont pas remplacés par le stockage local. Vérifie la réception dans le Gestionnaire d’événements de chaque plateforme.</p><PixelDiagnostics /><div className="tracking-grid"><div className="tracking-card"><div className="tracking-card-head"><Facebook size={22} /><div><h3>Meta Pixel</h3><p>Facebook / Instagram</p></div><span>{globalFacebook ? "Global" : "Optionnel"}</span></div><label>ID du pixel Facebook<input readOnly={globalFacebook} value={config.facebookPixelId} onChange={e => update("facebookPixelId", e.target.value)} placeholder="Ex. 123456789012345" /></label><small>Le pixel Meta global est configuré pour tous les visiteurs. Pour modifier cet identifiant global, il faut mettre à jour la configuration du site.</small></div><div className="tracking-card"><div className="tracking-card-head"><span className="tiktok-mark">♪</span><div><h3>TikTok Pixel</h3><p>ID ou code complet</p></div><span>Optionnel</span></div><label>ID TikTok<input readOnly={globalTikTok} value={config.tiktokPixelId} onChange={e => update("tiktokPixelId", e.target.value)} placeholder="Ex. CDEFGHIJKL123456" /></label><label>Code TikTok fourni<textarea disabled={globalTikTok} value={config.tiktokCode} onChange={e => update("tiktokCode", e.target.value)} placeholder="Colle ici le code que TikTok te donne…" /></label><small>Le pixel global du site est déjà configuré par ID : aucun code supplémentaire n’est nécessaire. Pour changer cet ID global, il faut mettre à jour la configuration du site.</small></div></div><div className="event-map"><div><span className="eyebrow">Événements COD actifs</span><h3>Le tunnel est déjà préparé</h3></div><div className="event-pills"><span>ViewContent <b>Fiche produit</b></span><span>InitiateCheckout <b>Commencer maintenant</b></span><span>Purchase <b>Commande COD reçue</b></span></div></div><div className="settings-actions"><button className="button button-light" onClick={() => { if (!config.facebookPixelId && !config.tiktokPixelId && !config.tiktokCode) { notify("Renseigne et enregistre un pixel avant le test"); return; } trackPixelEvent("ViewContent", { content_name: "Vérification du pixel", currency: "DZD" }); notify("Vérifie la réception dans Test Events — aucune commande créée"); }}><Facebook size={16} />Tester l’événement</button><button className="button button-gradient" onClick={save}><Save size={16} />Enregistrer les pixels</button></div></section>; }

type OrderDetailsPayload = {
  customer: string;
  phone: string;
  productId?: string;
  product: string;
  quantity: number;
  total: number;
  color: string;
  size: string;
  delivery: "home" | "office";
  wilaya: string;
  commune: string;
  address: string;
  note: string;
};

function OrderModal({
  order,
  isSaving,
  onClose,
  onCall,
  onUpdate,
  onSaveDetails,
  onDelete,
  onCopy,
}: {
  order: CheckoutOrder;
  isSaving: boolean;
  onClose: () => void;
  onCall: (phone: string) => void;
  onUpdate: (id: string, status: OrderStatus) => void;
  onSaveDetails: (dbId: number, updates: OrderDetailsPayload) => void;
  onDelete: (dbId: number) => void;
  onCopy: () => void;
}) {
  const catalog = useMemo(() => getCatalogProducts(), []);
  const initialBaseProduct = useMemo(() => {
    const cleanName = order.product.replace(/\s*×\s*\d+$/, "").trim();
    return catalog.find(p => p.id === order.productId || p.name === cleanName) ?? catalog[0];
  }, [catalog, order.product, order.productId]);

  const [customer, setCustomer] = useState(order.customer);
  const [phone, setPhone] = useState(order.phone);
  const [productId, setProductId] = useState(order.productId || initialBaseProduct?.id || "p-007");
  const [productName, setProductName] = useState(() => order.product.replace(/\s*×\s*\d+$/, "").trim() || initialBaseProduct?.name || "");
  const [quantity, setQuantity] = useState(order.quantity || 1);
  const [total, setTotal] = useState(order.total);
  const [color, setColor] = useState(order.color || "Emerald");
  const [size, setSize] = useState(order.size || "M");
  const [delivery, setDelivery] = useState<"home" | "office">(order.delivery || "home");
  const [wilaya, setWilaya] = useState(order.wilaya);
  const [commune, setCommune] = useState(order.commune);
  const [address, setAddress] = useState(order.address || "");
  const [note, setNote] = useState(order.note || "");

  const selectedCatalogProduct = catalog.find(p => p.id === productId);
  const availableColors = selectedCatalogProduct?.colors?.length ? selectedCatalogProduct.colors : ["Emerald", "Noir"];
  const allWilayas = useMemo(() => Array.from(new Set([order.wilaya, ...abayaWilayas, ...wilayas].filter(Boolean))), [order.wilaya]);
  const arabicCommunes = abayaCommunesByWilaya[wilaya] ?? [];

  const handleProductChange = (nextId: string) => {
    setProductId(nextId);
    const found = catalog.find(p => p.id === nextId);
    if (found) {
      setProductName(found.name);
      setTotal(found.price * quantity);
      if (found.colors.length && !found.colors.includes(color)) {
        setColor(found.colors[0]);
      }
    }
  };

  const handleQuantityChange = (nextQty: number) => {
    const safeQty = Math.max(1, Math.min(100, nextQty || 1));
    setQuantity(safeQty);
    if (selectedCatalogProduct) {
      setTotal(selectedCatalogProduct.price * safeQty);
    }
  };

  const handleSubmitEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formattedProduct = `${productName} × ${quantity}`;
    onSaveDetails(order.dbId, {
      customer: customer.trim() || order.customer,
      phone: phone.trim() || order.phone,
      productId,
      product: formattedProduct,
      quantity,
      total: Number(total) || 0,
      color: color.trim(),
      size: size.trim(),
      delivery,
      wilaya: wilaya.trim(),
      commune: commune.trim(),
      address: address.trim(),
      note: note.trim(),
    });
  };

  return (
    <div className="modal-layer">
      <button className="modal-backdrop" onClick={onClose} />
      <div className="order-modal" style={{ maxHeight: "90vh", overflowY: "auto" }}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">Détail & modification commande</span>
            <h2>{order.id}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fermer le détail de la commande">
            <X size={19} />
          </button>
        </div>

        <div className="modal-customer">
          <div className="admin-avatar">{order.customer.split(" ").map(part => part[0]).join("")}</div>
          <div>
            <strong>{order.customer}</strong>
            <span>{order.phone}</span>
          </div>
          <button className="button button-outline call-button" onClick={() => onCall(phone)}>
            <Phone size={15} />Appeler
          </button>
        </div>

        <form className="order-edit-form" onSubmit={handleSubmitEdit} style={{ display: "grid", gap: "14px", marginTop: "14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
            <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              Client(e)
              <input value={customer} onChange={e => setCustomer(e.target.value)} required />
            </label>
            <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              Téléphone
              <input value={phone} onChange={e => setPhone(e.target.value)} required />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
            <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              Produit
              <select value={productId} onChange={e => handleProductChange(e.target.value)}>
                {catalog.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({formatDZD(item.price)})
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              Quantité
              <input type="number" min={1} max={100} value={quantity} onChange={e => handleQuantityChange(Number(e.target.value))} required />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
            <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              Variante · Couleur
              <select value={color} onChange={e => setColor(e.target.value)}>
                {Array.from(new Set([color, ...availableColors, "Emerald (أخضر)", "Noir (أسود)"].filter(Boolean))).map(c => (
                  <option key={c} value={c}>{c === "Emerald" ? "Emerald (أخضر)" : c === "Noir" ? "Noir (أسود)" : c}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              Variante · Taille
              <select value={size} onChange={e => setSize(e.target.value)}>
                {["S", "M", "L", "XL", "XXL", "Standard"].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
            <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              Wilaya
              <select
                value={wilaya}
                onChange={e => {
                  const nextW = e.target.value;
                  setWilaya(nextW);
                  const nextList = abayaCommunesByWilaya[nextW];
                  if (nextList?.length) setCommune(nextList[0]);
                }}
              >
                {allWilayas.map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              Commune
              {arabicCommunes.length > 0 ? (
                <select value={commune} onChange={e => setCommune(e.target.value)}>
                  {Array.from(new Set([commune, ...arabicCommunes].filter(Boolean))).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              ) : (
                <input value={commune} onChange={e => setCommune(e.target.value)} required />
              )}
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
            <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              Type de livraison
              <select value={delivery} onChange={e => setDelivery(e.target.value as "home" | "office")}>
                <option value="home">🏠 À domicile (إلى المنزل)</option>
                <option value="office">🏢 Au bureau / Stop Desk (إلى المكتب)</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              Total (DA)
              <input type="number" min={0} value={total} onChange={e => setTotal(Number(e.target.value))} required style={{ fontWeight: 800, color: "#10b981" }} />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
            <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              Adresse
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Adresse / Précision" />
            </label>
            <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              Note
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note client / appel" />
            </label>
          </div>

          <button type="submit" className="button button-gradient full" disabled={isSaving} style={{ marginTop: "6px", height: "48px", borderRadius: "14px", fontSize: "15px" }}>
            <Save size={17} /> {isSaving ? "Enregistrement…" : "Enregistrer les modifications"}
          </button>
        </form>

        <div className="modal-actions" style={{ marginTop: "14px" }}>
          <p>Changer le statut</p>
          {actionLabels.map(action => (
            <button key={action.status} type="button" className={`action-${action.status}`} onClick={() => onUpdate(order.id, action.status)}>
              {action.label}
            </button>
          ))}
        </div>
        <button type="button" className="copy-order" onClick={onCopy}>
          <Copy size={15} />Copier les détails de la commande
        </button>
        <button
          type="button"
          style={{
            marginTop: "10px",
            width: "100%",
            height: "44px",
            borderRadius: "14px",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            background: "rgba(239, 68, 68, 0.08)",
            color: "#ef4444",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            fontWeight: 700,
            fontSize: "14px",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onClick={() => {
            if (window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement la commande ${order.id} ?`)) {
              onDelete(order.dbId);
            }
          }}
        >
          <Trash2 size={16} /> Supprimer cette commande
        </button>
      </div>
    </div>
  );
}
