import { FormEvent, lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import { BarChart3, Bell, ChevronDown, ChevronRight, ClipboardList, Copy, Crown, Download, ExternalLink, Facebook, FileSpreadsheet, Filter, History, ImagePlus, LayoutDashboard, Menu, MessageCircle, Moon, MoreHorizontal, Package, PackageCheck, Pencil, Phone, Plus, RefreshCw, RotateCcw, Save, Search, Settings2, ShoppingBag, Smartphone, Sparkles, Sun, Trash2, Truck, TrendingUp, Upload, UserCheck, Users, X } from "lucide-react";
import { Link } from "wouter";
import { AdminAuthGate } from "@/components/AdminAuthGate";
import { trpc } from "@/lib/trpc";
import type { CheckoutOrder } from "@shared/checkout";
import { abayaCommunesByWilaya, abayaWilayas } from "@/lib/abaya-communes";
import { isFreeShippingProduct, type ShippingRate, WILAYA_FRENCH_NAMES, wilayaIdFromName } from "@shared/shipping";
import { categories, getCatalogProducts, getProductVariantOptions, saveCatalogProducts, formatDZD, wilayas, type LandingTemplateId, type Order, type OrderStatus, type Product, type ProductVariantImage } from "@/lib/store-data";
import { AiLandingCreatorWizard } from "@/components/AiLandingCreatorWizard";
import { StatusPill } from "@/components/StoreLayout";
import { useTheme } from "@/contexts/ThemeContext";
import { getPixelConfig, savePixelConfig, trackPixelEvent, hasGlobalTikTokPixel, hasGlobalFacebookPixel, type PixelConfig } from "@/lib/tracking";
import "./admin-responsive.css";
import "./admin-app.css";
import { PixelDiagnostics } from "@/components/PixelDiagnostics";
import { AdminDashboard } from "@/components/AdminDashboard";
import {
  GcomeBottomWaveBar,
  GcomeMenuAiIcon,
  GcomeMenuBagIcon,
  GcomeMenuMoonIcon,
  GcomeMenuPlusIcon,
  GcomeMenuReturnIcon,
  GcomeMenuSheetIcon,
  GcomeMenuTeamIcon,
  GcomeMenuTruckIcon,
  GcomeMenuWaves,
} from "@/components/GcomeIcons";
import {
  PostponeOrderModal,
  CancelOrderModal,
  PostponedReminderPopup,
} from "@/components/OrderStatusActionModal";
import { MobileAppCard, showPushNotification } from "@/components/MobileAppCard";
import { playChaChingSound, playUrgentAlertSound, playVictoryDeliveredSound, playAbandonedAlertSound } from "@/lib/sound";
import { loadRealOrders, orderMatchesPeriod } from "@/lib/admin-orders";

const AbandonedOrders = lazy(() => import("@/components/AbandonedOrders").then(m => ({ default: m.AbandonedOrders })));
const EcomDeliveryPanel = lazy(() => import("@/components/EcomDelivery").then(m => ({ default: m.EcomDeliveryPanel })));
const GoogleSheetPanel = lazy(() => import("@/components/GoogleSheetPanel").then(m => ({ default: m.GoogleSheetPanel })));
const TransferredOrdersPanel = lazy(() => import("@/components/TransferredOrdersPanel").then(m => ({ default: m.TransferredOrdersPanel })));
const ReturnsPanel = lazy(() => import("@/components/ReturnsPanel").then(m => ({ default: m.ReturnsPanel })));
const StaffPanel = lazy(() => import("@/components/StaffPanel").then(m => ({ default: m.StaffPanel })));
const OrderHistoryModal = lazy(() => import("@/components/OrderHistoryModal").then(m => ({ default: m.OrderHistoryModal })));

const actionLabels: { status: OrderStatus; label: string }[] = [{ status: "confirmee", label: "Confirmer" }, { status: "annulee", label: "Annuler" }, { status: "reportee", label: "Reporter" }, { status: "ne_repond_pas", label: "Pas de réponse" }, { status: "transferee", label: "Transférer" }];
type AdminSection = "dashboard" | "abandoned" | "catalogue" | "settings" | "ecom" | "sheet" | "transferred" | "returns" | "staff";

type DashboardOrder = Order;

const emptyProduct: Product = { id: "", slug: "", name: "", category: "mode", categoryLabel: "Mode femme", price: 0, oldPrice: 0, packPrice: 0, landingTemplate: "doudoune", variantImages: [], badge: "Nouveau", description: "", details: [], colors: [], image: "", gallery: [], arName: "", arCategoryLabel: "", arDescription: "", accent: "#9B82F6", stock: 20 };

function GcomeBrand({
  compact = false,
  crownAbove = false,
  hideBag = false,
  showCrown = true,
  subtitle = "Vendez · Gérez · Suivez",
  large = false,
}: {
  compact?: boolean;
  crownAbove?: boolean;
  hideBag?: boolean;
  showCrown?: boolean;
  subtitle?: string;
  large?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const bagGradId = `gcomeBagGrad-${uid}`;
  const goldGradId = `gcomeGoldGrad-${uid}`;
  const bagSize = large ? 48 : compact ? 30 : 38;

  return (
    <span className={`gcome-brand ${compact ? "is-compact" : ""} ${large ? "is-large" : ""} ${crownAbove ? "has-crown-above" : ""} ${hideBag ? "no-bag" : ""}`}>
      {!hideBag && (
        <svg
          className="gcome-bag-svg"
          width={bagSize}
          height={bagSize}
          viewBox="0 0 40 40"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={bagGradId} x1="4" y1="8" x2="34" y2="36" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="55%" stopColor="#6D28D9" />
              <stop offset="100%" stopColor="#EC4899" />
            </linearGradient>
            <linearGradient id={goldGradId} x1="12" y1="15" x2="34" y2="36" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
          </defs>
          <path
            d="M14 12V9.5C14 6.46 16.46 4 19.5 4C22.54 4 25 6.46 25 9.5V12"
            stroke="#4C1D95"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <rect x="6" y="11" width="24" height="25" rx="6" fill={`url(#${bagGradId})`} />
          <rect x="13" y="17" width="21" height="19" rx="5.5" fill={`url(#${goldGradId})`} />
          <path
            d="M19 19V16.5C19 14.57 20.57 13 22.5 13C24.43 13 26 14.57 26 16.5V19"
            stroke="#FFFFFF"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      )}
      <span className="gcome-brand-text">
        <span className="gcome-brand-title-row">
          <strong className="gcome-brand-name">Gcome</strong>
          {showCrown && <Crown size={crownAbove ? 14 : compact ? 11 : 13} className="gcome-brand-crown" />}
        </span>
        <small className="gcome-brand-sub">{subtitle}</small>
      </span>
    </span>
  );
}

function GcomeHeroArtSvg() {
  return (
    <svg viewBox="0 0 112 96" className="gcome-hero-svg" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="gcomeShopAwning" x1="20" y1="6" x2="88" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F472B6" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>
        <linearGradient id="gcomePhoneScreen" x1="34" y1="24" x2="82" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#EEF2FF" />
          <stop offset="100%" stopColor="#DDD6FE" />
        </linearGradient>
      </defs>
      {/* Floating ambient circles */}
      <circle cx="94" cy="18" r="7" fill="rgba(253, 224, 71, 0.32)" />
      <circle cx="18" cy="34" r="5" fill="rgba(255, 255, 255, 0.18)" />
      {/* Smartphone Body */}
      <rect x="38" y="20" width="46" height="68" rx="10" fill="#1E1B4B" stroke="rgba(255,255,255,0.45)" strokeWidth="2" />
      <rect x="42" y="25" width="38" height="58" rx="7" fill="url(#gcomePhoneScreen)" />
      {/* Awning over Phone */}
      <path d="M32 23C32 15 38 10 46 10H76C84 10 90 15 90 23L92 31C92 34 89 36 86 36C83 36 81 34 80 31C79 34 77 36 74 36C71 36 69 34 68 31C67 34 65 36 62 36C59 36 57 34 56 31C55 34 53 36 50 36C47 36 45 34 44 31C43 34 41 36 38 36C35 36 30 34 32 23Z" fill="url(#gcomeShopAwning)" />
      <path d="M45 10V35M57 10V35M68 10V35M79 10V35" stroke="rgba(255,255,255,0.65)" strokeWidth="4" strokeLinecap="round" />
      {/* Screen Checkmark Badge */}
      <rect x="49" y="42" width="24" height="22" rx="6" fill="#6D28D9" />
      <path d="M55 53.5L59.5 58L68 49" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {/* Shopping Cart Foreground */}
      <path d="M12 46H21L26 71H54L58 53H24" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M27 59H55" stroke="rgba(255,255,255,0.65)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="29" cy="79" r="4.2" fill="#FACC15" stroke="#1E1B4B" strokeWidth="1.5" />
      <circle cx="50" cy="79" r="4.2" fill="#FACC15" stroke="#1E1B4B" strokeWidth="1.5" />
      {/* Floating Gold Coin / Sparkle */}
      <circle cx="88" cy="70" r="8" fill="#FACC15" />
      <path d="M88 66V74M84 70H92" stroke="#4C1D95" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function GcomeProRocketSvg() {
  return (
    <svg viewBox="0 0 64 64" className="gcome-pro-rocket-svg" fill="none" aria-hidden="true">
      {/* Decorative stars */}
      <path d="M12 16L13.5 20L17.5 21.5L13.5 23L12 27L10.5 23L6.5 21.5L10.5 20L12 16Z" fill="#FDE047" />
      <circle cx="52" cy="48" r="2.2" fill="#F9A8D4" />
      <circle cx="20" cy="46" r="1.8" fill="#C4B5FD" />
      {/* Flame */}
      <path d="M19 42C14 44 12 51 12 51C12 51 19 49 21 44Z" fill="#F97316" />
      <path d="M20 42C17 43 16 47 16 47C16 47 20 46 21 43Z" fill="#FDE047" />
      {/* Fins */}
      <path d="M24 30L15 32L21 38Z" fill="#EC4899" />
      <path d="M34 40L32 49L26 43Z" fill="#EC4899" />
      {/* Body */}
      <path d="M21 37C25 23 36 14 50 13C49 27 40 38 26 42L21 37Z" fill="#F8FAFC" />
      <path d="M40 16C44 14.5 47 13.5 50 13C49.5 16 48.5 19 47 23L40 16Z" fill="#F43F5E" />
      <circle cx="36" cy="28" r="5" fill="#7C3AED" stroke="#DDD6FE" strokeWidth="2" />
    </svg>
  );
}

function toDashboardOrder(order: CheckoutOrder): DashboardOrder {
  return {
    id: order.id,
    dbId: order.dbId,
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
    carrier: order.carrier,
    nrpLevel: order.nrpLevel,
    postponedUntil: order.postponedUntil,
    postponedNote: order.postponedNote,
    cancelReason: order.cancelReason,
    assignedToId: order.assignedToId,
    assignedToName: order.assignedToName,
    confirmedById: order.confirmedById,
    confirmedByName: order.confirmedByName,
    isDelivered: order.isDelivered,
    deliveredAt: order.deliveredAt,
    callCount: order.callCount,
    whatsappCount: order.whatsappCount,
    lastCalledAt: order.lastCalledAt,
    historyCount: order.historyCount,
    history: order.history,
  };
}

function AdminPageContent() {
  const { theme, toggleTheme } = useTheme();
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const isOwner = !String(meQuery.data?.openId || "").startsWith("staff:");
  const currentActorName = meQuery.data?.name || "Miss Sensuelle";
  const [section, setSection] = useState<AdminSection>(() => {
    const requested = new URLSearchParams(window.location.search).get("section");
    return requested === "abandoned" || requested === "catalogue" || requested === "settings" || requested === "ecom" || requested === "sheet" || requested === "transferred" || requested === "returns" || requested === "staff" ? requested : "dashboard";
  });
  const [activeStatus, setActiveStatus] = useState<"all" | OrderStatus>("all");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("Toutes les dates");
  const [selected, setSelected] = useState<CheckoutOrder | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState<boolean>(false);
  const [historyOrderId, setHistoryOrderId] = useState<string | null>(null);
  const [postponeOrderId, setPostponeOrderId] = useState<string | null>(null);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [dismissedReminders, setDismissedReminders] = useState<Record<string, string>>({});
  const [dueReminderOrder, setDueReminderOrder] = useState<CheckoutOrder | null>(null);
  type ToastType = "normal" | "urgent" | "victory" | "order";
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const notify = (message: string, type: ToastType = "normal") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3800);
  };
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileDeliveriesScope, setProfileDeliveriesScope] = useState<"auto" | "cycle" | "all" | "store">("auto");
  const [searchPopupQuery, setSearchPopupQuery] = useState("");
  const staffDataQuery = trpc.admin.staffData.useQuery(undefined, { enabled: isProfileModalOpen, retry: false, refetchOnWindowFocus: false });
  const syncProfileDeliveries = trpc.admin.syncDeliveredFromCarriers.useMutation({
    onSuccess: res => {
      if (res.syncedCount > 0) {
        void utils.admin.orders.invalidate();
        void utils.admin.staffData.invalidate();
      }
    },
  });
  useEffect(() => {
    const timer = window.setTimeout(() => {
      syncProfileDeliveries.mutate();
    }, 3000);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (isProfileModalOpen) {
      syncProfileDeliveries.mutate();
    }
  }, [isProfileModalOpen]);
  const ordersQuery = trpc.admin.orders.useQuery(undefined, { refetchInterval: 15000, refetchIntervalInBackground: false, refetchOnWindowFocus: true, retry: false });
  const abandonedQuery = trpc.admin.abandonedOrders.useQuery(undefined, { refetchInterval: 15000, refetchIntervalInBackground: false, refetchOnWindowFocus: true, retry: false });
  const utils = trpc.useUtils();
  const updateOrderStatus = trpc.admin.updateOrderStatus.useMutation();
  const recordOrderInteraction = trpc.admin.recordOrderInteraction.useMutation();
  const createOrderMutation = trpc.admin.createOrder.useMutation();
  const updateOrderDetails = trpc.admin.updateOrderDetails.useMutation();
  const deleteOrderMutation = trpc.admin.deleteOrder.useMutation();
  const setOrderCarrier = trpc.admin.setOrderCarrier.useMutation();
  const restoreOrders = trpc.admin.restoreOrders.useMutation();
  const restoredOnceRef = useRef(false);
  const backupSignatureRef = useRef("");
  const syncSheetMutation = trpc.googleSheet.syncOrders.useMutation({
    onSuccess: (data) => {
      if (data.added > 0) {
        notify("Nouvelle(s) commande(s) TikTok synchronisée(s) !");
        void utils.admin.orders.invalidate();
      }
    },
  });
  useEffect(() => {
    const timer = window.setTimeout(() => {
      syncSheetMutation.mutate({ force: false });
    }, 2500);
    return () => window.clearTimeout(timer);
  }, []);
  const serverOrders = ordersQuery.data ?? [];
  const orderById = useMemo(() => new Map(serverOrders.map(order => [order.id, order])), [serverOrders]);

  // Listen to background Web Push notifications received by the Service Worker
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_NOTIFICATION_RECEIVED") {
        const payload = event.data.payload;
        const soundUrgentEnabled = localStorage.getItem("ms_sound_urgent_enabled") !== "false";
        const soundVictoryEnabled = localStorage.getItem("ms_sound_victory_enabled") !== "false";
        const soundOrderEnabled = localStorage.getItem("ms_sound_order_enabled") !== "false";
        const notifNrpEnabled = localStorage.getItem("ms_notif_nrp_enabled") !== "false";
        const notifCancelEnabled = localStorage.getItem("ms_notif_cancel_enabled") !== "false";
        const notifDelayEnabled = localStorage.getItem("ms_notif_delay_enabled") !== "false";

        if (payload?.type === "urgent_alert" && soundUrgentEnabled) {
          const body = (payload?.body || "").toLowerCase();
          const title = (payload?.title || "").toLowerCase();
          const text = body + " " + title;
          if (text.includes("repond") && !notifNrpEnabled) return;
          if ((text.includes("annul") || text.includes("refus") || text.includes("retour")) && !notifCancelEnabled) return;
          if (text.includes("report") && !notifDelayEnabled) return;

          playUrgentAlertSound();
        } else if (payload?.type === "victory" && soundVictoryEnabled) {
          playVictoryDeliveredSound();
        } else if (payload?.type === "new_order" && soundOrderEnabled) {
          playChaChingSound();
        }
      }
    };
    navigator.serviceWorker.addEventListener("message", handleSwMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleSwMessage);
  }, []);

  // Real-time Shopify "Cha-Ching" sound & Push Notifications watcher for new orders
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const initialOrdersLoadedRef = useRef(false);

  useEffect(() => {
    if (ordersQuery.isLoading || !ordersQuery.data) return;
    const currentOrders = ordersQuery.data;

    if (!initialOrdersLoadedRef.current) {
      initialOrdersLoadedRef.current = true;
      let savedKnown: string[] = [];
      try {
        savedKnown = JSON.parse(localStorage.getItem("ms_known_orders_set") || "[]");
      } catch {}
      const initialSet = new Set<string>([...savedKnown, ...currentOrders.map(o => o.id)]);
      knownOrderIdsRef.current = initialSet;
      try {
        localStorage.setItem("ms_known_orders_set", JSON.stringify(Array.from(initialSet).slice(-200)));
      } catch {}
      return;
    }

    const soundEnabled = localStorage.getItem("ms_sound_order_enabled") !== "false";
    const pushEnabled = localStorage.getItem("ms_push_order_enabled") !== "false";

    for (const order of currentOrders) {
      if (!knownOrderIdsRef.current.has(order.id)) {
        knownOrderIdsRef.current.add(order.id);

        if (soundEnabled) {
          playChaChingSound();
        }

        if (pushEnabled) {
          const title = `🛍️ COMMANDE REÇUE ! (+${formatDZD(order.total)})`;
          const body = `${order.customer || "Cliente"} (${order.phone}) · ${order.product} · ${order.wilaya}`;
          showPushNotification(title, body, `order-${order.id}`, "order");
        }

        notify(`💰 Nouvelle commande : ${order.customer || "Cliente"} (+${formatDZD(order.total)}) !`, "order");
      }
    }

    try {
      localStorage.setItem("ms_known_orders_set", JSON.stringify(Array.from(knownOrderIdsRef.current).slice(-200)));
    } catch {}
  }, [ordersQuery.data, ordersQuery.isLoading]);

  // Real-time watcher for abandoned carts
  const knownAbandonedIdsRef = useRef<Set<number>>(new Set());
  const initialAbandonedLoadedRef = useRef(false);

  useEffect(() => {
    if (abandonedQuery.isLoading || !abandonedQuery.data) return;
    const currentAbandoned = abandonedQuery.data;

    if (!initialAbandonedLoadedRef.current) {
      initialAbandonedLoadedRef.current = true;
      let savedKnown: number[] = [];
      try {
        savedKnown = JSON.parse(localStorage.getItem("ms_known_abandoned_set") || "[]");
      } catch {}
      const initialSet = new Set<number>([...savedKnown, ...currentAbandoned.map(a => a.id)]);
      knownAbandonedIdsRef.current = initialSet;
      try {
        localStorage.setItem("ms_known_abandoned_set", JSON.stringify(Array.from(initialSet).slice(-200)));
      } catch {}
      return;
    }

    const soundEnabled = localStorage.getItem("ms_sound_abandoned_enabled") !== "false";
    const pushEnabled = localStorage.getItem("ms_push_order_enabled") !== "false";

    for (const item of currentAbandoned) {
      if (!knownAbandonedIdsRef.current.has(item.id)) {
        knownAbandonedIdsRef.current.add(item.id);

        if (soundEnabled) {
          playAbandonedAlertSound();
        }

        if (pushEnabled) {
          const title = `🛒 Nouveau Panier Abandonné !`;
          const body = `${item.customer || "Visiteur"} (${item.phone}) · ${item.product}`;
          showPushNotification(title, body, `abandoned-${item.id}`, "abandoned");
        }

        notify(`🛒 Nouveau panier abandonné détecté (${item.phone})`);
      }
    }

    try {
      localStorage.setItem("ms_known_abandoned_set", JSON.stringify(Array.from(knownAbandonedIdsRef.current).slice(-200)));
    } catch {}
  }, [abandonedQuery.data, abandonedQuery.isLoading]);

  // Real-time watcher for order status changes (ne_repond_pas, annulee, reportee)
  const orderStatusHistoryRef = useRef<Map<string, OrderStatus>>(new Map());
  const initialOrderStatusLoadedRef = useRef(false);

  useEffect(() => {
    if (ordersQuery.isLoading || !ordersQuery.data) return;
    const currentOrders = ordersQuery.data;

    if (!initialOrderStatusLoadedRef.current) {
      initialOrderStatusLoadedRef.current = true;
      for (const o of currentOrders) {
        orderStatusHistoryRef.current.set(o.id, o.status);
      }
      return;
    }

    const soundUrgentEnabled = localStorage.getItem("ms_sound_urgent_enabled") !== "false";
    const pushEnabled = localStorage.getItem("ms_push_order_enabled") !== "false";
    const notifNrpEnabled = localStorage.getItem("ms_notif_nrp_enabled") !== "false";
    const notifCancelEnabled = localStorage.getItem("ms_notif_cancel_enabled") !== "false";
    const notifDelayEnabled = localStorage.getItem("ms_notif_delay_enabled") !== "false";

    for (const o of currentOrders) {
      const prevStatus = orderStatusHistoryRef.current.get(o.id);
      if (prevStatus && prevStatus !== o.status) {
        orderStatusHistoryRef.current.set(o.id, o.status);

        if (o.status === "ne_repond_pas" && notifNrpEnabled) {
          if (soundUrgentEnabled) playUrgentAlertSound();
          if (pushEnabled) {
            showPushNotification(
              `🚨 INTERVENTION REQUISE : Client Ne Répond Pas !`,
              `${o.customer || "Cliente"} (${o.phone}) · Commande ${o.id} · Wilaya: ${o.wilaya} · Rappel urgent requis !`,
              `ord-nrp-${o.id}`,
              "urgent_issue"
            );
          }
          notify(`🚨 INTERVENTION : ${o.customer || "Cliente"} (${o.phone}) ne répond pas !`, "urgent");
        } else if (o.status === "annulee" && notifCancelEnabled) {
          if (soundUrgentEnabled) playUrgentAlertSound();
          if (pushEnabled) {
            showPushNotification(
              `🚨 COMMANDE ANNULÉE / REFUSÉE`,
              `${o.customer || "Cliente"} (${o.phone}) · Commande ${o.id} · Total: ${formatDZD(o.total)}`,
              `ord-cancel-${o.id}`,
              "urgent_issue"
            );
          }
          notify(`🚨 ALERTE : Commande ${o.id} annulée / refusée (${o.customer})`, "urgent");
        } else if (o.status === "reportee" && notifDelayEnabled) {
          if (soundUrgentEnabled) playUrgentAlertSound();
          if (pushEnabled) {
            showPushNotification(
              `⚠️ LIVRAISON REPORTÉE PAR LE CLIENT`,
              `${o.customer || "Cliente"} (${o.phone}) · Commande ${o.id} · Wilaya: ${o.wilaya}`,
              `ord-delay-${o.id}`,
              "urgent_issue"
            );
          }
          notify(`⚠️ REPORT : Commande ${o.id} reportée (${o.customer})`, "urgent");
        }
      } else if (!prevStatus) {
        orderStatusHistoryRef.current.set(o.id, o.status);
      }
    }
  }, [ordersQuery.data, ordersQuery.isLoading]);

  // E-com & EcoTrack status & carrier batch tracking query for live parcel events
  const ecomStatusQuery = trpc.ecom.status.useQuery(undefined, {
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    staleTime: 60000,
    retry: false,
  });
  const ecotrackStatusQuery = trpc.ecotrack.status.useQuery(undefined, {
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    staleTime: 60000,
    retry: false,
  });
  const ecomShipments = useMemo(() => ecomStatusQuery.data?.shipments || {}, [ecomStatusQuery.data]);
  const ecoShipments = useMemo(() => ecotrackStatusQuery.data?.shipments || {}, [ecotrackStatusQuery.data]);
  const shipments = useMemo(() => ({ ...ecomShipments, ...ecoShipments }), [ecomShipments, ecoShipments]);

  const activeEcomTrackings = useMemo(() => {
    const list: string[] = [];
    for (const sh of Object.values(ecomShipments)) {
      if (sh?.tracking) list.push(sh.tracking);
    }
    return list.slice(0, 100);
  }, [ecomShipments]);

  const activeEcoTrackings = useMemo(() => {
    const list: string[] = [];
    for (const sh of Object.values(ecoShipments)) {
      if (sh?.tracking) list.push(sh.tracking);
    }
    return list.slice(0, 100);
  }, [ecoShipments]);

  const trackingBatchQuery = trpc.ecom.trackBatch.useQuery(
    { trackings: activeEcomTrackings },
    {
      enabled: activeEcomTrackings.length > 0,
      refetchInterval: 60000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: false,
      staleTime: 60000,
      retry: false,
    }
  );
  const ecotrackBatchQuery = trpc.ecotrack.trackBatch.useQuery(
    { trackings: activeEcoTrackings },
    {
      enabled: activeEcoTrackings.length > 0,
      refetchInterval: 60000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: false,
      staleTime: 60000,
      retry: false,
    }
  );

  const trackingMap = useMemo(
    () =>
      ({
        ...(trackingBatchQuery.data || {}),
        ...(ecotrackBatchQuery.data || {}),
      }) as Record<string, { situation?: string }>,
    [trackingBatchQuery.data, ecotrackBatchQuery.data]
  );
  const knownSituationsRef = useRef<Map<string, string>>(new Map());
  const initialSituationsLoadedRef = useRef(false);

  useEffect(() => {
    if (Object.keys(trackingMap).length === 0) return;

    if (!initialSituationsLoadedRef.current) {
      initialSituationsLoadedRef.current = true;
      for (const [tracking, data] of Object.entries(trackingMap)) {
        if (data?.situation) {
          knownSituationsRef.current.set(tracking, data.situation.toLowerCase());
        }
      }
      return;
    }

    const soundUrgentEnabled = localStorage.getItem("ms_sound_urgent_enabled") !== "false";
    const soundVictoryEnabled = localStorage.getItem("ms_sound_victory_enabled") !== "false";
    const pushEnabled = localStorage.getItem("ms_push_order_enabled") !== "false";
    const notifNrpEnabled = localStorage.getItem("ms_notif_nrp_enabled") !== "false";
    const notifCancelEnabled = localStorage.getItem("ms_notif_cancel_enabled") !== "false";
    const notifDelayEnabled = localStorage.getItem("ms_notif_delay_enabled") !== "false";

    const orderIdByTracking = new Map<string, string>();
    for (const [orderId, sh] of Object.entries(shipments)) {
      if (sh?.tracking) orderIdByTracking.set(sh.tracking, orderId);
    }

    for (const [tracking, data] of Object.entries(trackingMap)) {
      if (!data?.situation) continue;
      const currentSit = data.situation.toLowerCase();
      const prevSit = knownSituationsRef.current.get(tracking);

      if (prevSit && prevSit !== currentSit) {
        knownSituationsRef.current.set(tracking, currentSit);
        const orderId = orderIdByTracking.get(tracking);
        const order = orderId ? orderById.get(orderId) : null;
        const customerName = order?.customer || "Cliente";
        const phone = order?.phone || "";
        const wilaya = order?.wilaya || "";
        const total = order?.total || 0;

        // 1. Colis LIVRÉ -> GREEN VICTORY
        if (currentSit.includes("livr") && !prevSit.includes("livr")) {
          if (soundVictoryEnabled) playVictoryDeliveredSound();
          if (pushEnabled) {
            showPushNotification(
              `🎉 COLIS LIVRÉ AVEC SUCCÈS ! (+${formatDZD(total)})`,
              `Encaissement validé pour ${customerName} (${wilaya}) · Commande ${orderId || tracking}`,
              `delivered-${tracking}`,
              "delivered"
            );
          }
          notify(`🎉 VICTOIRE : Colis ${orderId || tracking} livré à ${customerName} (+${formatDZD(total)}) !`, "victory");
        }
        // 2. Client NE RÉPOND PAS -> RED ALERT
        else if (currentSit.includes("repond") && !prevSit.includes("repond") && notifNrpEnabled) {
          if (soundUrgentEnabled) playUrgentAlertSound();
          if (pushEnabled) {
            showPushNotification(
              `🚨 INTERVENTION LIVREUR : Client Ne Répond Pas !`,
              `${customerName} (${phone}) ne répond pas au livreur · Wilaya: ${wilaya} · Appel requis immédiatement !`,
              `nrp-${tracking}`,
              "urgent_issue"
            );
          }
          notify(`🚨 INTERVENTION : ${customerName} (${phone}) ne répond pas au livreur !`, "urgent");
        }
        // 3. Colis REPORTÉ -> RED / ORANGE ALERT
        else if (currentSit.includes("report") && !prevSit.includes("report") && notifDelayEnabled) {
          if (soundUrgentEnabled) playUrgentAlertSound();
          if (pushEnabled) {
            showPushNotification(
              `⚠️ COLIS REPORTÉ PAR LE CLIENT`,
              `${customerName} (${phone}) a reporté la livraison · Wilaya: ${wilaya} · Commande ${orderId || tracking}`,
              `delay-${tracking}`,
              "urgent_issue"
            );
          }
          notify(`⚠️ LIVRAISON REPORTÉE : ${customerName} (${wilaya})`, "urgent");
        }
        // 4. Colis ANNULÉ / RETOUR / REFUSÉ -> RED ALERT
        else if ((currentSit.includes("retour") || currentSit.includes("annul") || currentSit.includes("refus")) &&
                 (!prevSit.includes("retour") && !prevSit.includes("annul") && !prevSit.includes("refus")) && notifCancelEnabled) {
          if (soundUrgentEnabled) playUrgentAlertSound();
          if (pushEnabled) {
            showPushNotification(
              `🚨 ALERTE RETOUR / COLIS REFUSÉ !`,
              `Colis ${orderId || tracking} en échec / refusé par ${customerName} (${phone}) · Action requise !`,
              `returned-${tracking}`,
              "urgent_issue"
            );
          }
          notify(`🚨 ALERTE RETOUR : Colis ${orderId || tracking} en retour (${customerName}) !`, "urgent");
        }
      } else if (!prevSit) {
        knownSituationsRef.current.set(tracking, currentSit);
      }
    }
  }, [trackingBatchQuery.data, shipments, orderById]);

  useEffect(() => {
    if (ordersQuery.isLoading || ordersQuery.error) return;
    const sig = `${serverOrders.length}:${serverOrders[0]?.id ?? ""}:${serverOrders[0]?.status ?? ""}:${serverOrders[serverOrders.length - 1]?.id ?? ""}`;
    if (restoredOnceRef.current && sig === backupSignatureRef.current) return;

    const timer = window.setTimeout(() => {
      try {
        if (!restoredOnceRef.current) {
          restoredOnceRef.current = true;
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
          if (uniqueMissing.size > 0) {
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
        }
        if (serverOrders.length > 0 && sig !== backupSignatureRef.current) {
          backupSignatureRef.current = sig;
          localStorage.setItem(
            "miss-sensuelle-admin-orders-backup",
            JSON.stringify(serverOrders),
          );
        }
      } catch {
        // Ignore storage error
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [ordersQuery.isLoading, ordersQuery.error, serverOrders]);
  const orders = useMemo(() => serverOrders.map(toDashboardOrder), [serverOrders]);
  const periodOrders = useMemo(() => orders.filter(order => order.status !== "transferee" && orderMatchesPeriod(order, period)), [orders, period]);
  const filtered = useMemo(() => periodOrders.filter(order => order.status !== "transferee" && (activeStatus === "all" || order.status === activeStatus) && `${order.id} ${order.phone} ${order.customer}`.toLowerCase().includes(query.toLowerCase())), [periodOrders, activeStatus, query]);
  const { activeNewCount, confirmedCount, transferredCount } = useMemo(() => {
    let activeNew = 0;
    let confirmed = 0;
    let transferred = 0;
    for (const order of serverOrders) {
      if (order.status === "nouvelle") activeNew++;
      else if (order.status === "confirmee") confirmed++;
      else if (order.status === "transferee") transferred++;
    }
    return { activeNewCount: activeNew, confirmedCount: confirmed, transferredCount: transferred };
  }, [serverOrders]);
  const catalogCount = useMemo(() => getCatalogProducts().length, [section]);
  const searchResults = useMemo(() => {
    if (!searchPopupQuery.trim()) return [];
    const q = searchPopupQuery.toLowerCase().trim();
    return serverOrders
      .filter(o => `${o.id} ${o.customer} ${o.phone} ${o.wilaya} ${o.commune} ${o.product}`.toLowerCase().includes(q))
      .slice(0, 30);
  }, [serverOrders, searchPopupQuery]);
  const updateStatusWithMeta = (
    id: string,
    status: OrderStatus,
    extra?: {
      nrpLevel?: 1 | 2 | 3;
      postponedUntil?: string | null;
      postponedNote?: string;
      cancelReason?: string;
    },
  ) => {
    const source = orderById.get(id);
    if (!source) {
      notify("Commande introuvable dans les données serveur");
      return;
    }
    updateOrderStatus.mutate(
      {
        id: source.dbId,
        status,
        nrpLevel: extra?.nrpLevel,
        postponedUntil: extra?.postponedUntil,
        postponedNote: extra?.postponedNote,
        cancelReason: extra?.cancelReason,
      },
      {
        onSuccess: async () => {
          await utils.admin.orders.invalidate();
          await utils.admin.staffData.invalidate();
          if (status === "ne_repond_pas") {
            playUrgentAlertSound();
            notify(
              `🚨 Commande ${id} : NE RÉPOND PAS (NRP ${extra?.nrpLevel ?? 1})`,
              "urgent",
            );
          } else if (status === "annulee") {
            playUrgentAlertSound();
            notify(
              `🚨 Commande ${id} : ANNULÉE${extra?.cancelReason ? ` (${extra.cancelReason})` : ""}`,
              "urgent",
            );
          } else if (status === "reportee") {
            playUrgentAlertSound();
            notify(
              extra?.postponedUntil
                ? `⏰ Commande ${id} reportée au ${new Date(extra.postponedUntil).toLocaleString("fr-DZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
                : `⚠️ Commande ${id} : REPORTÉE`,
              "urgent",
            );
          } else if (status === "confirmee") {
            notify(`Commande ${id} · confirmée ✦`, "normal");
          } else {
            notify(
              status === "transferee"
                ? `Commande ${id} transférée vers la section dédiée ✦`
                : `Commande ${id} · statut mis à jour`,
            );
          }
          setSelected(null);
        },
        onError: error => notify(error.message || "Mise à jour impossible"),
      },
    );
  };

  const updateStatus = (id: string, status: OrderStatus) => {
    updateStatusWithMeta(id, status);
  };

  // Real-time watcher for due postponed orders (shows popup + sound when scheduled time arrives)
  const duePostponedOrders = useMemo(() => {
    const now = Date.now();
    return serverOrders.filter(o => {
      if (o.status !== "reportee" || !o.postponedUntil) return false;
      const dueTime = new Date(o.postponedUntil).getTime();
      if (Number.isNaN(dueTime) || dueTime > now) return false;
      if (dismissedReminders[o.id] === o.postponedUntil) return false;
      return true;
    });
  }, [serverOrders, dismissedReminders]);

  const announcedDueSetRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const o of duePostponedOrders) {
      const key = `${o.id}:${o.postponedUntil}`;
      if (!announcedDueSetRef.current.has(key)) {
        announcedDueSetRef.current.add(key);
        const soundUrgentEnabled = localStorage.getItem("ms_sound_urgent_enabled") !== "false";
        const pushEnabled = localStorage.getItem("ms_push_order_enabled") !== "false";
        if (soundUrgentEnabled) playUrgentAlertSound();
        if (pushEnabled) {
          showPushNotification(
            `⏰ RAPPEL COMMANDE REPORTÉE !`,
            `Il est l'heure de rappeler ${o.customer || "Cliente"} (${o.phone}) · Commande ${o.id}`,
            `postponed-due-${o.id}`,
            "urgent_issue",
          );
        }
        notify(`⏰ RAPPEL : Il est l'heure de rappeler ${o.customer} (${o.phone}) !`, "urgent");
      }
    }
  }, [duePostponedOrders]);

  const saveOrderDetails = async (dbId: number, updates: Omit<Parameters<typeof updateOrderDetails.mutate>[0], "id">): Promise<CheckoutOrder | null> => {
    try {
      const updated = await updateOrderDetails.mutateAsync({ id: dbId, ...updates });
      if (updated) {
        utils.admin.orders.setData(undefined, prev =>
          prev ? prev.map(o => (o.id === updated.id || o.dbId === updated.dbId ? updated : o)) : prev
        );
        setSelected(updated);
      }
      await Promise.all([
        utils.admin.orders.invalidate(),
        utils.admin.staffData.invalidate(),
      ]);
      notify("Modifications de la commande enregistrées ✦");
      return updated ?? null;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Impossible d'enregistrer les modifications";
      notify(msg, "urgent");
      throw error;
    }
  };
  const handleCreateOrder = (payload: Parameters<typeof createOrderMutation.mutate>[0]) => {
    createOrderMutation.mutate(payload, {
      onSuccess: async created => {
        await utils.admin.orders.invalidate();
        await utils.admin.staffData.invalidate();
        setIsCreatingOrder(false);
        playChaChingSound();
        notify(`➕ Nouvelle commande ${created.id} créée avec succès (${created.customer}) ✦`, "order");
      },
      onError: error => notify(error.message || "Impossible de créer la commande", "urgent"),
    });
  };
  const handleSetCarrier = (id: string, carrier: "ecom" | "ecotrack") => {
    const o = orderById.get(id);
    if (!o) return;
    setOrderCarrier.mutate(
      { id: o.dbId, carrier },
      {
        onSuccess: async () => {
          await utils.admin.orders.invalidate();
          notify(
            carrier === "ecotrack"
              ? `📦 Commande ${id} liée à DHD (EcoTrack)`
              : `🚚 Commande ${id} liée à E-com Delivery`
          );
        },
        onError: error => notify(error.message || "Impossible de lier le transporteur", "urgent"),
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
  const handleCallOrder = (order: Order | CheckoutOrder) => {
    const source = orderById.get(order.id);
    if (source?.dbId) {
      recordOrderInteraction.mutate(
        { id: source.dbId, type: "call" },
        {
          onSuccess: () => {
            void utils.admin.orders.invalidate();
            void utils.admin.staffData.invalidate();
          },
        },
      );
    }
    void callCustomer(order.phone);
  };
  const handleWhatsAppOrder = (order: Order | CheckoutOrder) => {
    const source = orderById.get(order.id);
    if (source?.dbId) {
      recordOrderInteraction.mutate(
        { id: source.dbId, type: "whatsapp" },
        {
          onSuccess: () => {
            void utils.admin.orders.invalidate();
            void utils.admin.staffData.invalidate();
          },
        },
      );
    }
    const digits = order.phone.replace(/\D/g, "");
    const intl = digits.startsWith("213")
      ? digits
      : digits.startsWith("0")
        ? `213${digits.slice(1)}`
        : `213${digits}`;
    const msg = `Bonjour ${order.customer || ""} 🌸, c'est la boutique Miss Sensuelle concernant votre commande ${order.id} (${order.product} - ${formatDZD(order.total)} vers ${order.wilaya}). Nous avons essayé de vous joindre par téléphone pour confirmer l'expédition. Pouvez-vous nous confirmer votre commande ? Merci !\n\nمرحبا ${order.customer || ""} 🌸، نتصل بك من متجر Miss Sensuelle لتأكيد طلبيتك (${order.product} - ${formatDZD(order.total)}). يرجى الرد لتأكيد الإرسال وشكراً!`;
    window.open(`https://wa.me/${intl}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
    notify("Ouverture de WhatsApp · action enregistrée dans l'historique ✦");
  };
  const exportOrders = () => { const header = ["ID", "Date", "Client", "Téléphone", "Produit", "Quantité", "Couleur", "Taille", "Type Livraison", "Total", "Wilaya", "Commune", "Adresse", "Note", "Statut"]; const rows = filtered.map(order => [order.id, order.createdAt, order.customer, order.phone, order.product, order.quantity, order.color ?? "", order.size ?? "", order.delivery === "office" ? "Bureau" : "Domicile", order.total, order.wilaya, order.commune, order.address, order.note, order.status]); const csv = [header, ...rows].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n"); const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `miss-sensuelle-commandes-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url); notify("Export CSV prêt"); };
  const abandonedCount = abandonedQuery.data?.length;
  const go = (next: AdminSection) => setSection(next);

  const activeHistoryOrder = historyOrderId ? orderById.get(historyOrderId) ?? null : null;
  const activePostponeOrder = postponeOrderId ? orderById.get(postponeOrderId) ?? null : null;
  const activeCancelOrder = cancelOrderId ? orderById.get(cancelOrderId) ?? null : null;

  const gcomeHeroBanner = (
    <div className="gcome-hero-card">
      <div className="gcome-hero-copy">
        <span className="gcome-hero-badge">✦ GCOME STUDIO IA</span>
        <h3>Votre boutique au bout des <em>doigts !</em></h3>
        <p>Commandes, Landing Page et suivi en un seul endroit.</p>
        <button type="button" className="gcome-hero-cta" onClick={() => go("catalogue")}>
          Découvrir Gcome <ChevronRight size={14} />
        </button>
      </div>
      <div className="gcome-hero-art" aria-hidden="true">
        <GcomeHeroArtSvg />
      </div>
    </div>
  );

  return <div className="admin-shell gcome-shell"><aside className="admin-sidebar"><div className="admin-brand-mobile-row"><Link href="/" className="wordmark admin-wordmark gcome-logo-link"><img src="/gcome-dash-brand.png" alt="Gcome — Vendez · Gérez · Suivez" className="gcome-dash-brand-img" /><span className="gcome-dash-brand-dark-fallback"><GcomeBrand compact crownAbove hideBag /></span></Link><div className="admin-mobile-quick-top"><button type="button" className="neo-darkmode-btn mobile-top-theme-btn" onClick={toggleTheme} title={theme === "dark" ? "Passer en Mode Clair" : "Passer en Mode Sombre"} aria-label="Basculer Mode Clair / Sombre">{theme === "dark" ? (<><Sun size={13} className="neo-sun-glow" /><span>Clair</span></>) : (<><Moon size={13} className="neo-moon-glow" /><span>Dark</span></>)}</button><button type="button" className="neo-darkmode-btn mobile-top-create-btn gcome-mobile-cmd-btn" onClick={() => setIsCreatingOrder(true)} title="Créer une nouvelle commande"><Plus size={13} /><span>Commande</span></button><button type="button" onClick={() => setIsProfileModalOpen(true)} title="Mon profil, salaire & commissions" aria-label="Mon profil et commissions" className="gcome-profile-pill"><span>{currentActorName.slice(0, 2).toUpperCase()}</span>{activeNewCount > 0 && <span className="gcome-avatar-count">{activeNewCount}</span>}</button></div></div><button type="button" className="admin-user gcome-sidebar-shop-card" onClick={() => setIsProfileModalOpen(true)} title="Voir mon salaire, évolution & commissions"><div className="admin-avatar">{currentActorName.slice(0, 2).toUpperCase()}</div><div><strong>{currentActorName}</strong><span>{isOwner ? "Boutique Active • Voir profil" : "Confirmateur • Voir salaire"}</span></div></button><nav className="admin-nav"><span className="admin-nav-label">Espace Boutique</span><button className={section === "dashboard" ? "active" : ""} onClick={() => go("dashboard")}><LayoutDashboard size={18} />Vue d'ensemble</button><button className={section === "dashboard" ? "active" : ""} onClick={() => go("dashboard")}><ClipboardList size={18} />Commandes Actives <b>{activeNewCount}</b></button><button className={section === "staff" ? "active" : ""} onClick={() => go("staff")}><Users size={18} />Confirmateurs & Salaires</button><button className={section === "transferred" ? "active" : ""} onClick={() => go("transferred")}><Truck size={18} />Transférées <b className="nav-badge-purple">{transferredCount}</b></button><button className={section === "abandoned" ? "active" : ""} onClick={() => go("abandoned")}><ClipboardList size={18} />Commandes abandonnées <b>{abandonedCount === undefined ? "—" : abandonedCount}</b></button><button className={section === "sheet" ? "active" : ""} onClick={() => go("sheet")}><FileSpreadsheet size={18} />Google Sheets</button><button className={section === "ecom" ? "active" : ""} onClick={() => go("ecom")}><Truck size={18} />E-com & DHD <b>{confirmedCount}</b></button><button className={section === "returns" ? "active" : ""} onClick={() => go("returns")}><RotateCcw size={18} />Retours & Stocks</button><button className={section === "catalogue" ? "active" : ""} onClick={() => go("catalogue")}><Package size={18} />Catalogue & Studio IA <b>{catalogCount}</b></button><button onClick={() => go("catalogue")}><Users size={18} />Stocks</button><span className="admin-nav-label">Réglages</span><button onClick={() => go("staff")}><BarChart3 size={18} />Rapports & Performances</button><button className={section === "settings" ? "active" : ""} onClick={() => go("settings")}><Settings2 size={18} />Pixels & paramètres</button></nav><Link href="/" className="back-store">← Retour à la boutique</Link></aside><main className="admin-main"><header className="admin-topbar"><div><span className="eyebrow">{new Intl.DateTimeFormat("fr-DZ", { timeZone: "Africa/Algiers", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}</span><h1>{section === "staff" ? "Confirmateurs, Salaires & Journal d'Activité" : section === "transferred" ? "Commandes Transférées & Suivi" : section === "returns" ? "Gestion des Retours & Stocks" : section === "catalogue" ? "Studio Produits & Landing Pages" : section === "ecom" ? "E-com Delivery & DHD (EcoTrack)" : section === "sheet" ? "Google Sheets" : section === "settings" ? "Pixels & paramètres" : section === "abandoned" ? "Commandes abandonnées" : `Bonjour, ${currentActorName} 👑`}</h1></div><div className="admin-top-actions">
  <button type="button" className="neo-darkmode-btn" onClick={toggleTheme} title={theme === "dark" ? "Mode Clair" : "Mode Sombre"} aria-label="Basculer Mode Sombre">
  {theme === "dark" ? (
    <>
      <Sun size={15} className="neo-sun-glow" />
      <span className="neo-btn-label">Clair</span>
    </>
  ) : (
    <>
      <Moon size={15} className="neo-moon-glow" />
      <span className="neo-btn-label">Dark</span>
    </>
  )}
  </button>
  <button
    type="button"
    className="neo-darkmode-btn gcome-desktop-cmd-btn"
    onClick={() => setIsCreatingOrder(true)}
    title="Créer manuellement une nouvelle commande"
  >
    <Plus size={14} />
    <span className="neo-btn-label">+ Commande</span>
  </button>
  <button
    type="button"
    className="neo-darkmode-btn"
    onClick={() => go("catalogue")}
    title="Créer un produit ou lancer le Studio IA"
    style={{ background: "rgba(124, 58, 237, 0.10)", border: "1px solid rgba(124, 58, 237, 0.28)", cursor: "pointer" }}
  >
    <Sparkles size={14} style={{ color: "#7c3aed" }} />
    <span className="neo-btn-label" style={{ color: "#6d28d9", fontWeight: 800 }}>Studio IA</span>
  </button>
  <button
    type="button"
    className="neo-darkmode-btn"
    onClick={() => go("staff")}
    title="Gérer les confirmateurs, salaires, commissions et appels"
    style={{ background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.30)", cursor: "pointer" }}
  >
    <Users size={14} style={{ color: "#059669" }} />
    <span className="neo-btn-label" style={{ color: "#047857", fontWeight: 700 }}>Confirmateurs</span>
  </button>
  <button
    type="button"
    className="neo-darkmode-btn"
    onClick={() => go("settings")}
    title="Installer l'application mobile & alertes sonores"
    style={{ background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.32)", cursor: "pointer" }}
  >
    <Smartphone size={14} style={{ color: "#d97706" }} />
    <span className="neo-btn-label" style={{ color: "#b45309", fontWeight: 700 }}>App Mobile</span>
  </button>
  <button className="icon-button gcome-notif-bell" aria-label="Notifications"><Bell size={19} />{activeNewCount > 0 && <span className="gcome-bell-badge">{activeNewCount}</span>}</button><button type="button" className="admin-profile" onClick={() => setIsProfileModalOpen(true)} title="Voir mon profil, salaire & commissions" style={{ background: "transparent", border: 0, cursor: "pointer" }}><div className="admin-avatar small gcome-avatar-badge">{currentActorName.slice(0, 2).toUpperCase()}</div><ChevronDown size={16} /></button></div></header><div className="admin-content"><Suspense fallback={<section className="admin-data-state" role="status"><span className="eyebrow">Administration</span><h2>Chargement du module…</h2></section>}>{section === "staff" ? <StaffPanel orders={serverOrders} notify={notify} onOpenOrderHistory={order => setHistoryOrderId(order.id)} onOpenOrderEdit={order => setSelected(order)} /> : section === "transferred" ? <TransferredOrdersPanel orders={serverOrders} notify={notify} onUpdateStatus={updateStatus} onRefreshOrders={() => void utils.admin.orders.invalidate()} /> : section === "returns" ? <ReturnsPanel orders={serverOrders} notify={notify} onRefreshOrders={() => void utils.admin.orders.invalidate()} /> : section === "catalogue" ? <CatalogPanel notify={notify} /> : section === "sheet" ? <GoogleSheetPanel notify={notify} onOrdersUpdated={() => void utils.admin.orders.invalidate()} /> : section === "ecom" ? <EcomDeliveryPanel orders={serverOrders} notify={notify} onShipped={() => void utils.admin.orders.invalidate()} /> : section === "settings" ? <TrackingSettings notify={notify} /> : section === "abandoned" ? <AbandonedOrders items={abandonedQuery.data ?? []} isLoading={abandonedQuery.isLoading} isError={Boolean(abandonedQuery.error)} onRetry={() => void abandonedQuery.refetch()} onConverted={() => void utils.admin.orders.invalidate()} /> : ordersQuery.isLoading ? <section className="admin-data-state" role="status"><span className="eyebrow">Données enregistrées</span><h2>Chargement des commandes…</h2><p>La vue admin attend la réponse sécurisée du serveur.</p></section> : ordersQuery.error ? <section className="admin-data-state admin-data-error" role="alert"><span className="eyebrow">Données indisponibles</span><h2>Les commandes n’ont pas pu être chargées.</h2><p>Une erreur serveur ou réseau est survenue. Les données ne sont pas remplacées par une liste vide.</p><button type="button" className="button button-gradient" onClick={() => void ordersQuery.refetch()}><RefreshCw size={16} /> Réessayer</button></section> : <AdminDashboard orders={periodOrders} filtered={filtered} activeStatus={activeStatus} setActiveStatus={setActiveStatus} query={query} setQuery={setQuery} period={period} setPeriod={setPeriod} onSelect={order => setSelected(orderById.get(order.id) ?? null)} onCall={callCustomer} onCallOrder={handleCallOrder} onWhatsAppOrder={handleWhatsAppOrder} onOpenHistory={order => setHistoryOrderId(order.id)} onOpenPostponeModal={order => setPostponeOrderId(order.id)} onOpenCancelModal={order => setCancelOrderId(order.id)} onSetNrpLevel={(id, lvl) => updateStatusWithMeta(id, "ne_repond_pas", { nrpLevel: lvl })} onSetCarrier={handleSetCarrier} onExport={exportOrders} onCreateOrder={() => setIsCreatingOrder(true)} onUpdateStatus={updateStatus} stockPanel={<>{gcomeHeroBanner}<StockPanel onManageCatalog={() => go("catalogue")} onOpenSheet={() => go("sheet")} /></>} />}</Suspense></div></main><GcomeBottomWaveBar /><nav className="admin-mobile-nav gcome-bottom-dock" aria-label="Navigation admin mobile"><button type="button" className={section === "dashboard" && !isMoreMenuOpen ? "active" : ""} aria-current={section === "dashboard" ? "page" : undefined} onClick={() => { go("dashboard"); setIsMoreMenuOpen(false); }}><LayoutDashboard size={18} /><span>Dashboard</span></button><button type="button" className={section === "transferred" && !isMoreMenuOpen ? "active" : ""} aria-current={section === "transferred" ? "page" : undefined} onClick={() => { go("transferred"); setIsMoreMenuOpen(false); }}><Truck size={18} /><span>Transférées</span>{transferredCount > 0 && <span className="nav-count-badge gcome-red-badge">{transferredCount}</span>}</button><button type="button" className={section === "catalogue" && !isMoreMenuOpen ? "active" : ""} aria-current={section === "catalogue" ? "page" : undefined} onClick={() => { go("catalogue"); setIsMoreMenuOpen(false); }}><Package size={18} /><span>Produits</span></button><button type="button" className="btn-nav-search" onClick={() => { setIsSearchOpen(true); setIsMoreMenuOpen(false); }} aria-label="Recherche rapide de commande"><Search size={18} /><span>Recherche</span></button><button type="button" className={isMoreMenuOpen ? "active" : ""} onClick={() => setIsMoreMenuOpen(prev => !prev)} aria-label="Plus de menus"><Menu size={18} /><span>Menu</span></button></nav>{isSearchOpen && (
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
                      handleCallOrder(order);
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
  <div className="admin-more-menu-overlay gcome-menu-overlay" onClick={() => setIsMoreMenuOpen(false)}>
    <div className="gcome-menu-top-banner" onClick={e => e.stopPropagation()}>
      <img
        src="/gcome-menu-top.png"
        alt="Gcome — Votre solution tout-en-un"
        className="gcome-menu-banner-img"
      />
      <button
        type="button"
        className="gcome-menu-settings-hotspot"
        aria-label="Pixels et paramètres"
        title="Pixels & paramètres"
        onClick={() => {
          go("settings");
          setIsMoreMenuOpen(false);
        }}
      />
      <div className="gcome-menu-dark-fallback">
        <GcomeMenuWaves />
        <div className="gcome-menu-top-inner">
          <GcomeBrand subtitle="Votre solution tout-en-un" large showCrown={false} />
          <button
            type="button"
            className="gcome-menu-settings-btn"
            aria-label="Pixels et paramètres"
            title="Pixels & paramètres"
            onClick={() => {
              go("settings");
              setIsMoreMenuOpen(false);
            }}
          >
            <Settings2 size={20} />
          </button>
        </div>
      </div>
    </div>
    <div className="admin-more-menu-sheet gcome-menu-sheet" onClick={e => e.stopPropagation()}>
      <div className="admin-more-sheet-head">
        <div className="admin-more-sheet-title-row">
          <h3>Menu & Autres Espaces</h3>
          <button
            type="button"
            className="admin-more-sheet-close"
            onClick={() => setIsMoreMenuOpen(false)}
            aria-label="Fermer le menu"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="admin-more-sheet-grid gcome-menu-list">
        <button
          type="button"
          className="more-sheet-item gcome-menu-item"
          onClick={() => toggleTheme?.()}
        >
          <div className="more-item-icon icon-purple">
            {theme === "dark" ? <Sun size={19} /> : <GcomeMenuMoonIcon />}
          </div>
          <div className="more-item-text">
            <strong>{theme === "dark" ? "Mode Sombre activé" : "Activer le Mode Sombre"}</strong>
            <small>Basculez l'affichage clair ou sombre</small>
          </div>
          <span className={`gcome-toggle-pill ${theme === "dark" ? "is-on" : ""}`} aria-hidden="true">
            <i />
          </span>
        </button>

        <button
          type="button"
          className="more-sheet-item gcome-menu-item"
          onClick={() => { setIsCreatingOrder(true); setIsMoreMenuOpen(false); }}
        >
          <div className="more-item-icon icon-mint">
            <GcomeMenuPlusIcon />
          </div>
          <div className="more-item-text">
            <strong>Nouvelle commande manuelle</strong>
            <small>Ajouter une commande téléphone / WhatsApp</small>
          </div>
          <ChevronRight size={17} className="gcome-menu-chev" />
        </button>

        <button
          type="button"
          className={`more-sheet-item gcome-menu-item ${section === "staff" ? "active" : ""}`}
          onClick={() => { go("staff"); setIsMoreMenuOpen(false); }}
        >
          <div className="more-item-icon icon-orange">
            <GcomeMenuTeamIcon />
          </div>
          <div className="more-item-text">
            <strong>Confirmateurs & Salaires</strong>
            <small>Équipe, commissions, appels & journal live</small>
          </div>
          <ChevronRight size={17} className="gcome-menu-chev" />
        </button>

        <button
          type="button"
          className={`more-sheet-item gcome-menu-item ${section === "ecom" ? "active" : ""}`}
          onClick={() => { go("ecom"); setIsMoreMenuOpen(false); }}
        >
          <div className="more-item-icon icon-blue">
            <GcomeMenuTruckIcon />
          </div>
          <div className="more-item-text">
            <strong>E-com & DHD (EcoTrack)</strong>
            <small>Expédition et suivi transporteur</small>
          </div>
          <ChevronRight size={17} className="gcome-menu-chev" />
        </button>

        <button
          type="button"
          className={`more-sheet-item gcome-menu-item ${section === "abandoned" ? "active" : ""}`}
          onClick={() => { go("abandoned"); setIsMoreMenuOpen(false); }}
        >
          <div className="more-item-icon icon-rose">
            <GcomeMenuBagIcon />
          </div>
          <div className="more-item-text">
            <strong>Commandes Abandonnées</strong>
            <small>Récupération des paniers</small>
          </div>
          {abandonedCount !== undefined && abandonedCount > 0 ? (
            <span className="more-item-badge gcome-abandoned-badge">{abandonedCount}</span>
          ) : (
            <ChevronRight size={17} className="gcome-menu-chev" />
          )}
        </button>

        <button
          type="button"
          className={`more-sheet-item gcome-menu-item ${section === "returns" ? "active" : ""}`}
          onClick={() => { go("returns"); setIsMoreMenuOpen(false); }}
        >
          <div className="more-item-icon icon-lime">
            <GcomeMenuReturnIcon />
          </div>
          <div className="more-item-text">
            <strong>Retours & Stocks</strong>
            <small>Scanner au dépôt & litiges E-com</small>
          </div>
          <ChevronRight size={17} className="gcome-menu-chev" />
        </button>

        <button
          type="button"
          className={`more-sheet-item gcome-menu-item ${section === "sheet" ? "active" : ""}`}
          onClick={() => { go("sheet"); setIsMoreMenuOpen(false); }}
        >
          <div className="more-item-icon icon-emerald">
            <GcomeMenuSheetIcon />
          </div>
          <div className="more-item-text">
            <strong>Google Sheets</strong>
            <small>Synchronisation auto Leads & TikTok</small>
          </div>
          <ChevronRight size={17} className="gcome-menu-chev" />
        </button>

        <button
          type="button"
          className={`more-sheet-item gcome-menu-item ${section === "catalogue" ? "active" : ""}`}
          onClick={() => { go("catalogue"); setIsMoreMenuOpen(false); }}
        >
          <div className="more-item-icon icon-violet">
            <GcomeMenuAiIcon />
          </div>
          <div className="more-item-text">
            <strong>Produits & Studio IA</strong>
            <small>Création automatique par photo & templates</small>
          </div>
          <ChevronRight size={17} className="gcome-menu-chev" />
        </button>

        <div className="gcome-pro-banner">
          <svg className="gcome-pro-wave" viewBox="0 0 360 110" preserveAspectRatio="none" fill="none" aria-hidden="true">
            <path d="M0 76C78 44 166 96 254 58C305 36 338 42 360 56V110H0V76Z" fill="rgba(255,255,255,0.14)" />
            <path d="M0 92C112 64 205 106 360 72V110H0V92Z" fill="rgba(236,72,153,0.22)" />
          </svg>
          <div className="gcome-pro-copy">
            <div className="gcome-pro-title">
              <Crown size={20} className="gcome-pro-crown" /> <strong>Gcome Pro</strong>
            </div>
            <small>Boostez votre business !</small>
            <button
              type="button"
              className="gcome-pro-cta"
              onClick={() => {
                go("catalogue");
                setIsMoreMenuOpen(false);
              }}
            >
              Découvrir
            </button>
          </div>
          <div className="gcome-pro-right" aria-hidden="true">
            <GcomeProRocketSvg />
          </div>
        </div>

        <button
          type="button"
          className={`more-sheet-item gcome-menu-item ${section === "settings" ? "active" : ""}`}
          onClick={() => { go("settings"); setIsMoreMenuOpen(false); }}
        >
          <div className="more-item-icon icon-indigo">
            <Smartphone size={20} />
          </div>
          <div className="more-item-text">
            <strong>App Mobile &amp; Paramètres</strong>
            <small>Installer sur smartphone, Pixels &amp; alertes</small>
          </div>
          <ChevronRight size={17} className="gcome-menu-chev" />
        </button>

        <Link
          href="/"
          className="more-sheet-item more-store-link gcome-menu-item"
          onClick={() => setIsMoreMenuOpen(false)}
        >
          <div className="more-item-icon icon-slate">
            <ExternalLink size={20} />
          </div>
          <div className="more-item-text">
            <strong>Retour à la boutique</strong>
            <small>Voir la boutique en ligne</small>
          </div>
          <ChevronRight size={17} className="gcome-menu-chev" />
        </Link>
      </div>
    </div>
    <svg className="gcome-menu-bottom-wave" viewBox="0 0 430 95" preserveAspectRatio="none" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="gMenuBotSoft" x1="0" y1="0" x2="430" y2="95" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#DDD6FE" stopOpacity="0.25" />
          <stop offset="55%" stopColor="#C4B5FD" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#A78BFA" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <path d="M0 36C96 14 196 48 302 28C362 18 402 28 430 38V95H0V36Z" fill="url(#gMenuBotSoft)" />
    </svg>
  </div>
)}{isCreatingOrder && (
  <CreateOrderModal
    isSaving={createOrderMutation.isPending}
    onClose={() => setIsCreatingOrder(false)}
    onCreate={handleCreateOrder}
  />
)}{selected && <OrderModal key={selected.id} order={selected} isSaving={updateOrderDetails.isPending} onClose={() => setSelected(null)} onCall={() => handleCallOrder(selected)} onWhatsApp={() => handleWhatsAppOrder(selected)} onOpenHistory={() => setHistoryOrderId(selected.id)} onOpenPostpone={() => setPostponeOrderId(selected.id)} onOpenCancel={() => setCancelOrderId(selected.id)} onSetNrpLevel={lvl => updateStatusWithMeta(selected.id, "ne_repond_pas", { nrpLevel: lvl })} onSetCarrier={carrier => handleSetCarrier(selected.id, carrier)} onUpdate={updateStatus} onSaveDetails={saveOrderDetails} onDelete={handleDeleteOrder} onCopy={() => { void copyOrderDetails(selected, notify); setSelected(null); }} />}{activeHistoryOrder && (
  <Suspense fallback={null}>
    <OrderHistoryModal
      order={activeHistoryOrder}
      onClose={() => setHistoryOrderId(null)}
      onCall={handleCallOrder}
      onWhatsApp={handleWhatsAppOrder}
    />
  </Suspense>
)}{activePostponeOrder && (
  <PostponeOrderModal
    order={activePostponeOrder}
    onClose={() => setPostponeOrderId(null)}
    onConfirm={(postponedUntil, postponedNote) => {
      updateStatusWithMeta(activePostponeOrder.id, "reportee", {
        postponedUntil,
        postponedNote,
      });
      setPostponeOrderId(null);
    }}
  />
)}{activeCancelOrder && (
  <CancelOrderModal
    order={activeCancelOrder}
    onClose={() => setCancelOrderId(null)}
    onConfirm={reason => {
      updateStatusWithMeta(activeCancelOrder.id, "annulee", {
        cancelReason: reason,
      });
      setCancelOrderId(null);
    }}
  />
)}{isProfileModalOpen && (() => {
  const staffList = staffDataQuery.data?.staff ?? [];
  const staffId = String(meQuery.data?.email || meQuery.data?.openId || "").replace(/^staff:/, "");
  const myProfile =
    staffList.find(s => s.id === staffId) ||
    staffList.find(s => s.name.toLowerCase() === currentActorName.toLowerCase());
  const baseSalary = myProfile?.baseSalary ?? (isOwner ? 0 : 25000);
  const defaultComm = myProfile?.commissionPerDelivered ?? 150;
  const prodComms = myProfile?.productCommissions ?? {};
  const upsellBonus = myProfile?.upsellBonusPerDelivered ?? 50;

  const startStr = myProfile?.salaryStartDate || myProfile?.createdAt?.slice(0, 10);
  const nowDate = new Date();
  const startDate = startStr ? new Date(`${startStr}T00:00:00`) : new Date(nowDate.getFullYear(), nowDate.getMonth(), 1);
  const diffDays = Math.floor((nowDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const daysElapsed = Math.max(1, Math.min(30, Number.isFinite(diffDays) ? diffDays : 1));
  const dailySalary = Math.round(baseSalary / 30);
  const evolvedSalary = daysElapsed >= 30 ? baseSalary : Math.round((baseSalary / 30) * daysElapsed);
  const progressPct = Math.round((daysElapsed / 30) * 100);

  const matchesIdentity = (id: string | undefined, memberName: string | undefined) => {
    if (myProfile) {
      return (
        id === myProfile.id ||
        (Boolean(memberName) && memberName!.trim().toLowerCase() === myProfile.name.trim().toLowerCase())
      );
    }
    if (isOwner && (id === "owner" || memberName?.trim().toLowerCase() === "admin (patron)")) {
      return true;
    }
    return Boolean(memberName) && memberName!.trim().toLowerCase() === currentActorName.trim().toLowerCase();
  };

  const isMine = (o: CheckoutOrder) =>
    matchesIdentity(o.confirmedById, o.confirmedByName) ||
    ((!o.confirmedById || o.confirmedById === "owner") && matchesIdentity(o.assignedToId, o.assignedToName));

  const endStr = myProfile?.salaryEndDate;
  const endDate = endStr ? new Date(`${endStr}T23:59:59.999`) : null;
  const inSalaryCycle = (iso: string | undefined) => {
    if (!startStr || !iso) return true;
    const ms = new Date(iso).getTime();
    if (Number.isNaN(ms)) return true;
    if (ms < startDate.getTime()) return false;
    if (endDate && ms > endDate.getTime()) return false;
    return true;
  };

  const calcOrderComm = (o: CheckoutOrder) => {
    const unit = o.productId && typeof prodComms[o.productId] === "number" ? prodComms[o.productId] : defaultComm;
    const qty = Math.max(1, o.quantity || 1);
    const hasUpsell = (o.upsellById && myProfile && o.upsellById === myProfile.id) || (qty >= 2 && String(o.product || "").includes("+"));
    return unit * qty + (hasUpsell ? upsellBonus : 0);
  };

  const myConfirmedPending = serverOrders.filter(
    o => isMine(o) && (o.status === "confirmee" || o.status === "transferee") && !o.isDelivered && !o.returnReceived
  );
  const myDeliveredInCycle = serverOrders.filter(
    o =>
      isMine(o) &&
      Boolean(o.isDelivered) &&
      !o.returnReceived &&
      inSalaryCycle(o.deliveredAt || o.confirmedAt || o.createdAt)
  );
  const myDeliveredAll = serverOrders.filter(
    o => isMine(o) && Boolean(o.isDelivered) && !o.returnReceived
  );
  const storeDeliveredAll = serverOrders.filter(
    o => Boolean(o.isDelivered) && !o.returnReceived
  );

  const effectiveScope: "cycle" | "all" | "store" =
    profileDeliveriesScope !== "auto"
      ? profileDeliveriesScope
      : myDeliveredInCycle.length > 0
        ? "cycle"
        : myDeliveredAll.length > 0
          ? "all"
          : isOwner
            ? "store"
            : "all";

  const shownDelivered =
    effectiveScope === "store" && isOwner
      ? storeDeliveredAll
      : effectiveScope === "all"
        ? myDeliveredAll
        : myDeliveredInCycle;

  const virtualCommission = myConfirmedPending.reduce((sum, o) => sum + calcOrderComm(o), 0);
  const realCommission = myDeliveredInCycle.reduce((sum, o) => sum + calcOrderComm(o), 0);
  const totalAcquis = evolvedSalary + realCommission;

  return (
    <div
      onClick={() => setIsProfileModalOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(10, 14, 26, 0.68)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        className="order-modal"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 440,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          borderRadius: 24,
          padding: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 46, height: 46, borderRadius: "50%", background: myProfile?.avatarColor || "linear-gradient(135deg, #9b82f6, #ec4899)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16 }}>
              {currentActorName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>{currentActorName}</h3>
              <span style={{ fontSize: 12, color: "#8b5cf6", fontWeight: 700 }}>
                {isOwner ? "Administratrice" : "Confirmateur • Suivi Salaire & Commissions"}
              </span>
            </div>
          </div>
          <button type="button" onClick={() => setIsProfileModalOpen(false)} style={{ background: "transparent", border: 0, cursor: "pointer", padding: 4 }} aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        {/* Salaire de base & Évolution quotidienne */}
        <div style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(236,72,153,0.10))", border: "1px solid rgba(139,92,246,0.28)", borderRadius: 16, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#6d28d9" }}>💼 Salaire de base mensuel</span>
            <strong style={{ fontSize: 15, fontWeight: 900 }}>{formatDZD(baseSalary)}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginBottom: 8 }}>
            <span>📈 Évolution chaque jour (+{formatDZD(dailySalary)} / jour)</span>
            <strong style={{ color: "#059669" }}>Jour {daysElapsed}/30 · {formatDZD(evolvedSalary)}</strong>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: "rgba(148,163,184,0.25)", overflow: "hidden" }}>
            <div style={{ width: `${progressPct}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #8b5cf6, #ec4899)" }} />
          </div>
        </div>

        {/* Commissions Virtuelle & Réelle */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 16, padding: 12 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: "#b45309", marginBottom: 4 }}>⏳ Commission virtuelle</div>
            <div style={{ fontSize: 19, fontWeight: 900, color: "#d97706" }}>{formatDZD(virtualCommission)}</div>
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{myConfirmedPending.length} cmd confirmée(s)</div>
          </div>

          <div style={{ background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.35)", borderRadius: 16, padding: 12 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: "#10b981", marginBottom: 4 }}>✅ Commission réelle</div>
            <div style={{ fontSize: 19, fontWeight: 900, color: "#10b981" }}>{formatDZD(realCommission)}</div>
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
              {myDeliveredInCycle.length} sur cycle · {myDeliveredAll.length} total
            </div>
          </div>
        </div>

        {/* Total Acquis */}
        <div style={{ background: "linear-gradient(135deg, #1e1b4b, #4c1d95)", color: "#fff", borderRadius: 16, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11.5, opacity: 0.85 }}>Total acquis à ce jour (Salaire + Réelle)</div>
            <div style={{ fontSize: 11, color: "#fcd34d", marginTop: 2 }}>Avec virtuelle : {formatDZD(totalAcquis + virtualCommission)}</div>
          </div>
          <strong style={{ fontSize: 20, fontWeight: 900, color: "#fde047" }}>{formatDZD(totalAcquis)}</strong>
        </div>

        {/* Liste des commandes livrées du confirmateur / boutique */}
        <div style={{ border: "1px solid rgba(16,185,129,0.28)", borderRadius: 16, padding: 12, background: "rgba(16,185,129,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <strong style={{ fontSize: 12.5, color: "#10b981" }}>
              📦 Commandes livrées ({shownDelivered.length})
            </strong>
            <button
              type="button"
              disabled={syncProfileDeliveries.isPending}
              onClick={() =>
                syncProfileDeliveries.mutate(undefined, {
                  onSuccess: res => {
                    void utils.admin.orders.invalidate();
                    void utils.admin.staffData.invalidate();
                    notify(
                      res.syncedCount > 0
                        ? `${res.syncedCount} commande(s) livrée(s) synchronisée(s) 🎉`
                        : "Livraisons déjà à jour ✓"
                    );
                  },
                })
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 9px",
                borderRadius: 999,
                border: "1px solid rgba(16,185,129,0.45)",
                background: "rgba(16,185,129,0.12)",
                color: "#10b981",
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              <RefreshCw size={11} className={syncProfileDeliveries.isPending ? "animate-spin" : ""} />
              <span>{syncProfileDeliveries.isPending ? "Sync…" : "Actualiser"}</span>
            </button>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => setProfileDeliveriesScope("cycle")}
              style={{
                padding: "3px 9px",
                borderRadius: 999,
                border: "1px solid rgba(16,185,129,0.35)",
                background: effectiveScope === "cycle" ? "#10b981" : "transparent",
                color: effectiveScope === "cycle" ? "#fff" : "#10b981",
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Ce cycle ({myDeliveredInCycle.length})
            </button>
            <button
              type="button"
              onClick={() => setProfileDeliveriesScope("all")}
              style={{
                padding: "3px 9px",
                borderRadius: 999,
                border: "1px solid rgba(16,185,129,0.35)",
                background: effectiveScope === "all" ? "#10b981" : "transparent",
                color: effectiveScope === "all" ? "#fff" : "#10b981",
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Mes livrées ({myDeliveredAll.length})
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={() => setProfileDeliveriesScope("store")}
                style={{
                  padding: "3px 9px",
                  borderRadius: 999,
                  border: "1px solid rgba(139,92,246,0.4)",
                  background: effectiveScope === "store" ? "#7c3aed" : "transparent",
                  color: effectiveScope === "store" ? "#fff" : "#a78bfa",
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Boutique ({storeDeliveredAll.length})
              </button>
            )}
          </div>

          {shownDelivered.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--app-text-muted, #64748b)" }}>
              Aucune commande livrée trouvée pour cette vue. Cliquez sur « Actualiser » pour synchroniser les livraisons transporteurs.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 6, maxHeight: 210, overflowY: "auto" }}>
              {shownDelivered.slice(0, 50).map(order => (
                <div
                  key={order.id}
                  onClick={() => {
                    setHistoryOrderId(order.id);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === " ") setHistoryOrderId(order.id);
                  }}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 10px",
                    borderRadius: 10,
                    background: "var(--app-surface, #fff)",
                    border: "1px solid rgba(16,185,129,0.24)",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <strong>{order.id}</strong> · {order.customer}{" "}
                    <small style={{ opacity: 0.75 }}>({order.wilaya})</small>
                    <div style={{ fontSize: 11, color: "var(--app-text-muted, #64748b)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {order.product}{order.confirmedByName ? ` · ✓ ${order.confirmedByName}` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {!isOwner || effectiveScope !== "store" ? (
                      <strong style={{ color: "#10b981", display: "block" }}>+{formatDZD(calcOrderComm(order))}</strong>
                    ) : (
                      <strong style={{ color: "#10b981", display: "block" }}>✓ Livrée</strong>
                    )}
                    <small style={{ fontSize: 10.5, opacity: 0.75 }}>{formatDZD(order.total)}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
})()}{duePostponedOrders.length > 0 && (
  <PostponedReminderPopup
    orders={duePostponedOrders}
    onCall={handleCallOrder}
    onWhatsApp={handleWhatsAppOrder}
    onOpenOrder={order => setSelected(order)}
    onSnooze30Min={order => {
      const next30 = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      updateStatusWithMeta(order.id, "reportee", {
        postponedUntil: next30,
        postponedNote: order.postponedNote || "Reporté de +30 min",
      });
    }}
    onDismiss={orderId => {
      const target = orderById.get(orderId);
      if (target?.postponedUntil) {
        setDismissedReminders(prev => ({ ...prev, [orderId]: target.postponedUntil! }));
      }
    }}
  />
)}{toast && (
  <div className={`toast-admin toast-${toast.type}`}>
    <span>{toast.type === "urgent" ? "🚨" : toast.type === "victory" ? "🎉" : toast.type === "order" ? "💰" : "✦"}</span>
    {toast.message}
  </div>
)}</div>;
}

async function copyOrderDetails(order: CheckoutOrder, notify: (message: string) => void) { const value = `${order.id} · ${order.customer} · ${order.phone}`; try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); notify("Détails copiés"); return; } } catch {} try { const area = document.createElement("textarea"); area.value = value; area.style.position = "fixed"; area.style.opacity = "0"; document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove(); notify("Détails copiés"); } catch { notify("Copie indisponible dans ce navigateur"); } }

export default function AdminPage() { return <AdminAuthGate><AdminPageContent /></AdminAuthGate>; }

function StockPanel({ onManageCatalog, onOpenSheet }: { onManageCatalog: () => void; onOpenSheet?: () => void }) {
  const catalog = getCatalogProducts();
  const sheetQuery = trpc.googleSheet.getConfig.useQuery(undefined, { refetchOnWindowFocus: false, staleTime: 60000, retry: false });
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

const LANDING_TEMPLATES: {
  id: LandingTemplateId;
  title: string;
  subtitle: string;
  inspiredBy: string;
  previewImage: string;
  accentColor: string;
  bgGradient: string;
  features: string[];
  hasPackOffer: boolean;
}[] = [
  {
    id: "doudoune",
    title: "Template 1 · Style Doudoune Luxe",
    subtitle: "Hero Interactif + Compte à rebours + Offre Pack 2 pièces",
    inspiredBy: "Inspiré de : Doudoune Hiver de Luxe (p-008)",
    previewImage: "/manus-storage/doudoune-bg.jpg",
    accentColor: "#17307e",
    bgGradient: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
    features: [
      "Grande affiche Hero avec changement de couleur en direct",
      "Compte à rebours d'urgence + Offre Duo (2 pièces à prix réduit)",
      "Formulaire COD Arabe haute conversion avec choix de la 2ème pièce",
    ],
    hasPackOffer: true,
  },
  {
    id: "extensions",
    title: "Template 2 · Style Extensions Luxe (1+1 Offerte)",
    subtitle: "Hero Plein Écran + Slider Variantes + 1 Achetée = 1 Offerte",
    inspiredBy: "Inspiré de : Extensions Cheveux Naturel (p-005)",
    previewImage: "/manus-storage/ext-m2-hero.jpg",
    accentColor: "#d49b27",
    bgGradient: "linear-gradient(135deg, #fdf8f0 0%, #f9ebd2 100%)",
    features: [
      "Hero plein écran avec dégradé fondu continu entre les sections",
      "Slider horizontal de grandes cartes variantes cliquables",
      "Formulaire Espresso & Or Champagne (sélection de 2 variantes 1+1)",
    ],
    hasPackOffer: true,
  },
  {
    id: "abaya",
    title: "Template 3 · Style Abaya Royal Emerald",
    subtitle: "Lookbook Émeraude & Or + Grille 5 Détails + Avis Clientes",
    inspiredBy: "Inspiré de : Abaya Royal Emerald (p-007)",
    previewImage: "/manus-storage/v-hero_de8d807e.jpg",
    accentColor: "#0c6b4b",
    bgGradient: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
    features: [
      "Bannière livraison + Poster Hero avec badge prix doré",
      "Grille de 5 photos détails + Section Avis Clientes vérifiés (4.9★)",
      "Formulaire COD Royal avec vignettes photos par couleur & tailles",
    ],
    hasPackOffer: false,
  },
  {
    id: "coat",
    title: "Template 4 · Style Manteau / Trench Iconique",
    subtitle: "Éditorial Chic + Grille 4 Détails + Vue 360°",
    inspiredBy: "Inspiré de : Manteau Icon (p-001)",
    previewImage: "/manus-storage/1000012735_a03c5d58.jpg",
    accentColor: "#7c3aed",
    bgGradient: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
    features: [
      "Mise en page éditoriale luxe avec arguments clés sous le Hero",
      "Grille de 4 zooms détails + Carte focus 360°",
      "Formulaire COD direct avec pastilles couleurs et tailles S à XXL",
    ],
    hasPackOffer: false,
  },
  {
    id: "badil",
    title: "Template · Beauté RTL Rose & Or",
    subtitle: "Landing mobile haute conversion avec offres 1+1 / 2+1",
    inspiredBy: "Modèle Badil Microblading",
    previewImage: "/images/badil/01-badil.jpg",
    accentColor: "#e0145f",
    bgGradient: "linear-gradient(135deg, #fbe3ea 0%, #ffc2d4 100%)",
    features: [
      "Visuels promo pleine largeur + bannière formulaire dorée",
      "Cartes d'offres duo (1 pièce vs Pack 2+1 gratuit)",
      "Formulaire COD rapide + capture paniers abandonnés + pixels Meta/TikTok",
    ],
    hasPackOffer: true,
  },
  {
    id: "pyjama",
    title: "Template · Pyjama RTL Rose & Or (Multi-couleurs)",
    subtitle: "Landing mobile haute conversion avec couleurs multiples & tailles",
    inspiredBy: "Modèle Pyjama Été Sensuelle",
    previewImage: "/images/pyjama/01-pyjama.jpg",
    accentColor: "#e0145f",
    bgGradient: "linear-gradient(135deg, #fbe3ea 0%, #ffc2d4 100%)",
    features: [
      "Visuels promo pleine largeur + bannière formulaire dorée",
      "Sélection multi-couleurs + tailles S à XL + offres 1 pièce / 2+1 gratuit",
      "Liste déroulante wilayas & communes + pixels Meta/TikTok + paniers abandonnés",
    ],
    hasPackOffer: true,
  },
  {
    id: "standard",
    title: "Template 5 · Fiche Boutique Classique",
    subtitle: "Page produit e-commerce standard bilingue FR / AR",
    inspiredBy: "Modèle catalogue classique",
    previewImage: "/manus-storage/async-images/uM7lQJWYdXHIVBYkKtIu8c/image-1.webp",
    accentColor: "#64748b",
    bgGradient: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
    features: [
      "Galerie vignettes + sélecteur de quantité classique",
      "Accordéons détails & livraison bilingues FR / AR",
      "Formulaire de commande COD en bas de page",
    ],
    hasPackOffer: false,
  },
];

function resolveProductTemplate(product: Product): LandingTemplateId {
  if (product.landingTemplate) return product.landingTemplate;
  if (product.id === "p-008" || product.slug === "doudoune-hiver-luxe") return "doudoune";
  if (product.id === "p-005" || product.slug === "extensions-silk-wave" || product.slug === "extensions-cheveux") return "extensions";
  if (product.id === "p-007" || product.slug === "abaya-royal-emerald") return "abaya";
  if (product.id === "p-001" || product.slug === "blazer-lilac-dream") return "coat";
  if (product.id === "p-009" || product.slug === "perruque-longue") return "perruque";
  if (product.id === "p-010" || product.slug === "badil-microblading") return "badil";
  if (product.id === "p-011" || product.slug === "pyjama-ete") return "pyjama";
  return "standard";
}

function CatalogPanel({ notify }: { notify: (message: string) => void }) {
  const [catalog, setCatalog] = useState<Product[]>(() => getCatalogProducts());
  const [editing, setEditing] = useState<Product | null>(null);
  const [creatorMode, setCreatorMode] = useState<"none" | "ai" | "manual">("none");
  const [aiInitialTemplate, setAiInitialTemplate] = useState<LandingTemplateId>("pyjama");

  useEffect(() => {
    const sync = () => setCatalog(getCatalogProducts());
    window.addEventListener("miss-sensuelle-catalog-updated", sync);
    return () => window.removeEventListener("miss-sensuelle-catalog-updated", sync);
  }, []);

  const refresh = (next: Product[]) => {
    try {
      saveCatalogProducts(next);
    } catch {
      notify("Sauvegarde impossible : stockage bloqué ou plein");
      return false;
    }
    setCatalog(next);
    return true;
  };

  const upsertProduct = (product: Product) => {
    const exists = catalog.some(item => item.id === product.id);
    const next = exists
      ? catalog.map(item => (item.id === product.id ? product : item))
      : [product, ...catalog];
    if (refresh(next)) {
      notify(exists ? "Produit & Landing Page mis à jour ✨" : "Nouveau produit créé avec sa Landing Page 🚀");
      return true;
    }
    return false;
  };

  const remove = (id: string) => {
    if (!window.confirm("Supprimer définitivement ce produit du catalogue ?")) return;
    if (refresh(catalog.filter(product => product.id !== id))) {
      notify("Produit supprimé du catalogue");
    }
  };

  const startCreateWithTemplate = (templateId: LandingTemplateId) => {
    const tpl = LANDING_TEMPLATES.find(t => t.id === templateId) ?? LANDING_TEMPLATES[0];
    setEditing({
      ...emptyProduct,
      landingTemplate: templateId,
      accent: tpl.accentColor,
      category: templateId === "extensions" ? "extensions" : templateId === "doudoune" || templateId === "coat" ? "vestes" : templateId === "badil" ? "beaute" : "mode",
      categoryLabel: templateId === "extensions" ? "Extensions cheveux" : templateId === "doudoune" || templateId === "coat" ? "Vestes & ensembles" : templateId === "badil" ? "Beauté & Maquillage" : templateId === "pyjama" ? "Pyjamas & Détente" : "Mode femme",
      price: templateId === "extensions" ? 2700 : templateId === "doudoune" ? 7600 : templateId === "abaya" ? 7500 : templateId === "badil" || templateId === "pyjama" ? 1800 : 8500,
      oldPrice: templateId === "extensions" ? 3500 : templateId === "doudoune" ? 9000 : templateId === "abaya" ? 14000 : templateId === "badil" || templateId === "pyjama" ? 2800 : 11000,
      packPrice: templateId === "extensions" ? 4500 : templateId === "doudoune" ? 12900 : templateId === "badil" || templateId === "pyjama" ? 3000 : undefined,
    });
    setCreatorMode("manual");
  };

  const duplicateProduct = (source: Product) => {
    const copy: Product = {
      ...source,
      id: "",
      slug: `${source.slug}-copie-${Math.floor(100 + Math.random() * 900)}`,
      name: `${source.name} (Copie)`,
      landingTemplate: resolveProductTemplate(source),
    };
    setEditing(copy);
    setCreatorMode("manual");
    notify(`Modèle pré-rempli à partir de "${source.name}" ✨`);
  };

  return (
    <section className="catalog-admin">
      <div className="catalog-admin-head">
        <div>
          <span className="eyebrow">Studio Produits & Landing Pages COD</span>
          <h2>
            Catalogue & Templates <span className="count-bubble">{catalog.length}</span>
          </h2>
          <p>
            Deux modes séparés pour aller vite : génère automatiquement ta Landing Page complète depuis <strong>1 seule photo avec l’IA</strong>, ou configure un produit manuellement.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="button button-gradient"
            onClick={() => {
              setEditing(null);
              setAiInitialTemplate("pyjama");
              setCreatorMode("ai");
            }}
          >
            <Sparkles size={17} /> Créer avec l'IA (1 Photo)
          </button>
          <button
            type="button"
            className="button button-light"
            onClick={() => {
              setEditing(null);
              setCreatorMode("manual");
            }}
          >
            <Plus size={17} /> Création Manuelle
          </button>
        </div>
      </div>

      {/* Barre de création rapide par Template */}
      {creatorMode === "none" && (
        <div className="template-showcase-strip">
          <div className="template-showcase-head">
            <div>
              <strong>✨ Modèles de Landing Page prêts à convertir</strong>
              <small>Choisis un style puis lance soit la génération automatique par IA (1 photo), soit l'éditeur manuel</small>
            </div>
          </div>
          <div className="template-showcase-grid">
            {LANDING_TEMPLATES.filter(t => t.id !== "standard").map(tpl => (
              <div key={tpl.id} className="template-showcase-card" style={{ borderColor: `${tpl.accentColor}40` }}>
                <div className="template-showcase-img">
                  <img src={tpl.previewImage} alt={tpl.title} />
                  <span className="template-showcase-badge" style={{ background: tpl.accentColor }}>
                    {tpl.hasPackOffer ? "🔥 Offre Duo / 1+1" : "👑 Haute Conversion"}
                  </span>
                </div>
                <div className="template-showcase-body">
                  <h4>{tpl.title}</h4>
                  <p>{tpl.subtitle}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6 }}>
                    <button
                      type="button"
                      className="button button-gradient template-use-btn"
                      onClick={() => {
                        setEditing(null);
                        setAiInitialTemplate(tpl.id);
                        setCreatorMode("ai");
                      }}
                    >
                      <Sparkles size={13} /> Créer par IA
                    </button>
                    <button
                      type="button"
                      className="button button-light template-use-btn"
                      style={{ borderColor: tpl.accentColor, color: tpl.accentColor }}
                      onClick={() => startCreateWithTemplate(tpl.id)}
                    >
                      Manuel
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {creatorMode === "ai" && (
        <AiLandingCreatorWizard
          initialTemplate={aiInitialTemplate}
          initialProduct={editing}
          onCancel={() => {
            setCreatorMode("none");
            setEditing(null);
          }}
          onPublish={product => {
            upsertProduct(product);
          }}
          onOpenAdvanced={product => {
            setEditing(product);
            setCreatorMode("manual");
          }}
        />
      )}

      {creatorMode === "manual" && (
        <ProductForm
          initial={editing && editing.id ? editing : (editing ?? emptyProduct)}
          catalog={catalog}
          onCancel={() => {
            setCreatorMode("none");
            setEditing(null);
          }}
          onSave={product => {
            if (upsertProduct(product)) {
              setCreatorMode("none");
              setEditing(null);
            }
          }}
        />
      )}

      <div className="catalog-admin-grid">
        {catalog.map(product => {
          const tplId = resolveProductTemplate(product);
          const tplMeta = LANDING_TEMPLATES.find(t => t.id === tplId) ?? LANDING_TEMPLATES[4];
          return (
            <article className="catalog-admin-card" key={product.id}>
              <div className="catalog-admin-image">
                <img src={product.image} alt={product.name} />
                <span>{product.stock} en stock</span>
                <b
                  className="catalog-template-pill"
                  style={{ background: tplMeta.accentColor }}
                >
                  {tplMeta.title.replace(/^Template \d+ · /, "")}
                </b>
              </div>
              <div className="catalog-admin-info">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <span className="product-category">{product.categoryLabel}</span>
                  {product.packPrice ? (
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#be185d", background: "#fce7f3", padding: "3px 8px", borderRadius: 999 }}>
                      Pack 2 : {formatDZD(product.packPrice)}
                    </span>
                  ) : null}
                </div>
                <h3>{product.name}</h3>
                {product.arName && (
                  <small style={{ display: "block", color: "var(--muted)", fontSize: 12, marginBottom: 4 }} dir="rtl">
                    {product.arName}
                  </small>
                )}
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <strong>{formatDZD(product.price)}</strong>
                  {product.oldPrice ? (
                    <del style={{ fontSize: 12, color: "#94a3b8" }}>{formatDZD(product.oldPrice)}</del>
                  ) : null}
                </div>
                <p>{product.description}</p>
                {product.colors?.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                    {product.colors.slice(0, 6).map(c => (
                      <span key={c} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: "var(--bg-elev)", border: "1px solid var(--line)", fontWeight: 700 }}>
                        {c}
                      </span>
                    ))}
                  </div>
                )}
                <div className="catalog-admin-actions" style={{ flexWrap: "wrap", gap: 6 }}>
                  <button
                    type="button"
                    className="button button-light"
                    onClick={() => {
                      setEditing({ ...product, landingTemplate: tplId });
                      setCreatorMode("manual");
                    }}
                  >
                    <Pencil size={14} /> Modifier
                  </button>
                  <button
                    type="button"
                    className="button button-light"
                    onClick={() => {
                      setEditing({ ...product, landingTemplate: tplId });
                      setAiInitialTemplate(tplId);
                      setCreatorMode("ai");
                    }}
                    title="Re-générer la Landing Page avec Gemini IA"
                  >
                    <Sparkles size={14} /> IA
                  </button>
                  <button
                    type="button"
                    className="button button-light"
                    onClick={() => duplicateProduct(product)}
                    title="Dupliquer ce produit et son template"
                  >
                    <Copy size={14} /> Dupliquer
                  </button>
                  <Link
                    href={`/produit/${product.slug}`}
                    className="button button-light"
                    style={{ textDecoration: "none" }}
                  >
                    <ExternalLink size={14} /> Voir Page
                  </Link>
                  <button
                    type="button"
                    className="icon-button danger-icon"
                    onClick={() => remove(product.id)}
                    title="Supprimer"
                    aria-label={`Supprimer ${product.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ProductForm({
  initial,
  catalog,
  onCancel,
  onSave,
}: {
  initial: Product;
  catalog: Product[];
  onCancel: () => void;
  onSave: (product: Product) => void;
}) {
  const initialTemplate = resolveProductTemplate(initial);
  const [form, setForm] = useState<Product>(() => ({
    ...initial,
    landingTemplate: initialTemplate,
  }));
  const [galleryList, setGalleryList] = useState<string[]>(() =>
    (initial.gallery ?? []).filter(Boolean)
  );
  const [variants, setVariants] = useState<ProductVariantImage[]>(() => {
    if (initial.variantImages && initial.variantImages.length > 0) {
      return initial.variantImages;
    }
    if (initial.colors && initial.colors.length > 0) {
      return initial.colors.map((c, idx) => ({
        name: c,
        image: initial.gallery?.[idx] || "",
      }));
    }
    return [
      { name: "أسود", image: "" },
      { name: "أبيض", image: "" },
    ];
  });
  const [detailsText, setDetailsText] = useState(() =>
    Array.isArray(initial.details) ? initial.details.join("\n") : String(initial.details ?? "")
  );
  const [newGalleryUrl, setNewGalleryUrl] = useState("");
  const [isCompressing, setIsCompressing] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const bulkVariantsRef = useRef<HTMLInputElement>(null);

  const selectedTemplateMeta =
    LANDING_TEMPLATES.find(t => t.id === (form.landingTemplate ?? "doudoune")) ?? LANDING_TEMPLATES[0];

  const set = <K extends keyof Product>(key: K, value: Product[K]) =>
    setForm(current => ({ ...current, [key]: value }));

  const compressImageFile = (file: File, maxDim = 1150, quality = 0.82): Promise<string> =>
    new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => {
        const rawDataUrl = String(reader.result || "");
        const img = new Image();
        img.onload = () => {
          try {
            let { width, height } = img;
            if (width > maxDim || height > maxDim) {
              const ratio = Math.min(maxDim / width, maxDim / height);
              width = Math.max(1, Math.round(width * ratio));
              height = Math.max(1, Math.round(height * ratio));
            }
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              resolve(rawDataUrl);
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            const webp = canvas.toDataURL("image/webp", quality);
            if (webp && webp.startsWith("data:image/webp") && webp.length < rawDataUrl.length) {
              resolve(webp);
              return;
            }
            const jpeg = canvas.toDataURL("image/jpeg", quality);
            resolve(jpeg.length < rawDataUrl.length ? jpeg : rawDataUrl);
          } catch {
            resolve(rawDataUrl);
          }
        };
        img.onerror = () => resolve(rawDataUrl);
        img.src = rawDataUrl;
      };
      reader.readAsDataURL(file);
    });

  const handleMainImageUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setIsCompressing(true);
    const dataUrl = await compressImageFile(files[0], 1280, 0.84);
    set("image", dataUrl);
    setIsCompressing(false);
  };

  const handleGalleryUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setIsCompressing(true);
    const urls = await Promise.all(Array.from(files).map(f => compressImageFile(f, 1200, 0.82)));
    setGalleryList(prev => [...prev, ...urls]);
    if (!form.image && urls[0]) {
      set("image", urls[0]);
    }
    setIsCompressing(false);
  };

  const handleVariantImageUpload = async (index: number, files: FileList | null) => {
    if (!files?.length) return;
    setIsCompressing(true);
    const dataUrl = await compressImageFile(files[0], 900, 0.82);
    setVariants(prev =>
      prev.map((v, i) =>
        i === index
          ? { ...v, name: v.name.trim() || `اللون ${i + 1}`, image: dataUrl }
          : v
      )
    );
    if (!form.image && dataUrl) {
      set("image", dataUrl);
    }
    setIsCompressing(false);
  };

  const handleBulkVariantsUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setIsCompressing(true);
    const urls = await Promise.all(Array.from(files).map(f => compressImageFile(f, 900, 0.82)));
    setVariants(prev => {
      const existingNonEmpty = prev.filter(v => v.image.trim() || v.name.trim());
      const added = urls.map((imgUrl, idx) => ({
        name: `اللون ${existingNonEmpty.length + idx + 1}`,
        image: imgUrl,
      }));
      return [...existingNonEmpty, ...added];
    });
    if (!form.image && urls[0]) {
      set("image", urls[0]);
    }
    setIsCompressing(false);
  };

  const prefillFromExistingProduct = (templateId: LandingTemplateId) => {
    const sourceId =
      templateId === "doudoune"
        ? "p-008"
        : templateId === "extensions"
          ? "p-005"
          : templateId === "abaya"
            ? "p-007"
            : templateId === "coat"
              ? "p-001"
              : "";
    const found = catalog.find(p => p.id === sourceId);
    if (!found) return;
    setForm(curr => ({
      ...curr,
      landingTemplate: templateId,
      category: found.category,
      categoryLabel: found.categoryLabel,
      price: found.price,
      oldPrice: found.oldPrice,
      packPrice: found.packPrice,
      badge: found.badge,
      description: found.description,
      arName: found.arName,
      arCategoryLabel: found.arCategoryLabel,
      arDescription: found.arDescription,
      image: templateId === "extensions" ? "/manus-storage/ext-m2-hero.jpg" : found.image,
      accent: found.accent,
    }));
    setDetailsText((found.details ?? []).join("\n"));
    setGalleryList(found.gallery ?? []);
    if (templateId === "extensions") {
      setVariants([
        { name: "أسود طبيعي", image: "/manus-storage/ext-m2-v1.jpg" },
        { name: "بني غامق", image: "/manus-storage/ext-m2-v2.jpg" },
        { name: "بني عسلي", image: "/manus-storage/ext-m2-v3.jpg" },
        { name: "شاتين روكس", image: "/manus-storage/ext-m2-v4.jpg" },
        { name: "أشقر فاتح", image: "/manus-storage/ext-m2-v5.jpg" },
        { name: "نور بليلج غري", image: "/manus-storage/ext-m2-v6.jpg" },
      ]);
      setGalleryList([
        "/manus-storage/ext-m2-s1.jpg",
        "/manus-storage/ext-m2-s2.jpg",
      ]);
    } else {
      setVariants(getProductVariantOptions(found));
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const slug =
      form.slug.trim() ||
      form.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") ||
      `produit-${Date.now()}`;

    const mergedGallery = [
      ...galleryList,
      ...(newGalleryUrl.trim() ? [newGalleryUrl.trim()] : []),
    ].filter(Boolean);

    // Conserve toutes les variantes qui ont soit un nom soit une photo !
    const cleanVariants = variants
      .map((v, idx) => ({
        name: v.name.trim() || (v.image.trim() ? `اللون ${idx + 1}` : ""),
        image: v.image.trim(),
      }))
      .filter(v => v.name.length > 0 || v.image.length > 0);

    // Si l'utilisateur a ajouté des photos dans la galerie mais pas de variantes et que ce n'est pas un brouillon IA sans couleurs, associer automatiquement
    const enrichedVariants =
      cleanVariants.length > 0
        ? cleanVariants.map((v, idx) => ({
            name: v.name || `اللون ${idx + 1}`,
            image: v.image || mergedGallery[idx] || form.image || "",
          }))
        : form.landingConfig
          ? []
          : mergedGallery.map((img, idx) => ({
              name: `اللون ${idx + 1}`,
              image: img,
            }));

    const effectiveMainImage =
      form.image.trim() ||
      mergedGallery[0] ||
      enrichedVariants.find(v => v.image)?.image ||
      "/manus-storage/doudoune-bg.jpg";

    const syncedLandingConfig = form.landingConfig
      ? {
          ...form.landingConfig,
          colorSwatches:
            enrichedVariants.length > 0
              ? enrichedVariants.map((v, idx) => ({
                  name: v.name,
                  hex: form.landingConfig?.colorSwatches?.[idx]?.hex || "#e0145f",
                }))
              : [],
        }
      : undefined;

    const product: Product = {
      ...form,
      id: form.id || `p-${Date.now()}`,
      slug,
      image: effectiveMainImage,
      landingTemplate: form.landingTemplate ?? "doudoune",
      landingConfig: syncedLandingConfig,
      price: Number(form.price) || 0,
      oldPrice: form.oldPrice ? Number(form.oldPrice) : undefined,
      packPrice: form.packPrice ? Number(form.packPrice) : undefined,
      stock: Number(form.stock) || 0,
      details: detailsText
        .split("\n")
        .map(v => v.trim())
        .filter(Boolean),
      colors: enrichedVariants.map(v => v.name),
      variantImages: enrichedVariants,
      gallery:
        mergedGallery.length > 0
          ? mergedGallery
          : enrichedVariants.map(v => v.image).filter(Boolean),
    };
    onSave(product);
  };

  return (
    <form className="product-admin-form product-studio-form" onSubmit={submit}>
      <div className="form-panel-head">
        <div>
          <span className="eyebrow">{initial.id ? "Modifier le produit & sa Landing Page" : "Création Manuelle Produit"}</span>
          <h3>{initial.id ? initial.name : "Créer un nouveau produit manuellement"}</h3>
        </div>
        <button type="button" className="icon-button" onClick={onCancel} aria-label="Fermer le formulaire">
          <X size={18} />
        </button>
      </div>

      {/* ÉTAPE 1 : CHOIX DU TEMPLATE DE LANDING PAGE */}
      <div className="studio-step-box">
        <div className="studio-step-header">
          <span className="studio-step-num">1</span>
          <div>
            <h4>Choisis le Template de ta Landing Page (inspiré des 4 produits phares)</h4>
            <p>Le produit utilisera automatiquement le design, l'animation et le formulaire COD du modèle sélectionné.</p>
          </div>
        </div>

        <div className="studio-template-grid">
          {LANDING_TEMPLATES.map(tpl => {
            const isSelected = (form.landingTemplate ?? "doudoune") === tpl.id;
            return (
              <div
                key={tpl.id}
                role="button"
                tabIndex={0}
                onClick={() => set("landingTemplate", tpl.id)}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") set("landingTemplate", tpl.id);
                }}
                className={`studio-tpl-card ${isSelected ? "is-selected" : ""}`}
                style={{
                  borderColor: isSelected ? tpl.accentColor : undefined,
                  background: isSelected ? tpl.bgGradient : undefined,
                }}
              >
                <div className="studio-tpl-thumb">
                  <img src={tpl.previewImage} alt={tpl.title} />
                  {isSelected && (
                    <span className="studio-tpl-selected-pill" style={{ background: tpl.accentColor }}>
                      ✓ Sélectionné
                    </span>
                  )}
                </div>
                <div className="studio-tpl-content">
                  <small style={{ color: tpl.accentColor, fontWeight: 800 }}>{tpl.inspiredBy}</small>
                  <h5>{tpl.title}</h5>
                  <p>{tpl.subtitle}</p>
                  <ul className="studio-tpl-features">
                    {tpl.features.map((f, i) => (
                      <li key={i}>• {f}</li>
                    ))}
                  </ul>
                  {tpl.id !== "standard" && (
                    <button
                      type="button"
                      className="studio-prefill-btn"
                      onClick={e => {
                        e.stopPropagation();
                        prefillFromExistingProduct(tpl.id);
                      }}
                    >
                      ✨ Charger les photos/textes d'exemple de ce modèle
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ÉTAPE 2 : INFORMATIONS & PRIX COD */}
      <div className="studio-step-box">
        <div className="studio-step-header">
          <span className="studio-step-num">2</span>
          <div>
            <h4>Informations du produit & Prix de l'offre COD</h4>
            <p>Configure les titres (Français & Arabe) ainsi que le prix unitaire et le prix Pack Duo / 1+1.</p>
          </div>
        </div>

        <div className="product-admin-grid">
          <label>
            Nom du produit (Français) *
            <input
              required
              placeholder="Ex: Doudoune Hiver Luxe, Extensions..."
              value={form.name}
              onChange={e => set("name", e.target.value)}
            />
          </label>
          <label>
            Titre affiché en Arabe sur la Landing Page
            <input
              dir="rtl"
              placeholder="مثال: دواقون شتوية فاخرة / إكستنشن الشعر"
              value={form.arName ?? ""}
              onChange={e => set("arName", e.target.value)}
            />
          </label>
          <label>
            Catégorie
            <select
              value={form.category}
              onChange={e => {
                const category = categories.find(item => item.id === e.target.value);
                set("category", e.target.value as Product["category"]);
                set("categoryLabel", category?.label ?? "Mode femme");
              }}
            >
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Lien URL (Slug)
            <input
              value={form.slug}
              onChange={e => set("slug", e.target.value)}
              placeholder="Généré automatiquement si vide"
            />
          </label>
          <label>
            Prix 1 Pièce (DA) *
            <input
              required
              type="number"
              min="0"
              value={form.price}
              onChange={e => set("price", Number(e.target.value))}
            />
          </label>
          <label>
            Ancien prix barré (DA)
            <input
              type="number"
              min="0"
              placeholder="Ex: 9000"
              value={form.oldPrice ?? ""}
              onChange={e => set("oldPrice", e.target.value ? Number(e.target.value) : undefined)}
            />
          </label>
          <label style={{ background: selectedTemplateMeta.hasPackOffer ? "rgba(236, 72, 153, 0.08)" : undefined, padding: selectedTemplateMeta.hasPackOffer ? "8px 10px" : undefined, borderRadius: 12, border: selectedTemplateMeta.hasPackOffer ? "1.5px dashed #ec4899" : undefined }}>
            🎁 Prix Offre 2 Pièces / 1+1 Offerte (DA)
            <input
              type="number"
              min="0"
              placeholder={form.landingTemplate === "extensions" ? "Ex: 4500 (1 achetée + 1 offerte)" : "Ex: 12900 (Pack 2 pièces)"}
              value={form.packPrice ?? ""}
              onChange={e => set("packPrice", e.target.value ? Number(e.target.value) : undefined)}
            />
          </label>
          <label>
            Stock disponible *
            <input
              required
              type="number"
              min="0"
              value={form.stock}
              onChange={e => set("stock", Number(e.target.value))}
            />
          </label>
          <label>
            Badge Promo
            <input
              value={form.badge ?? ""}
              onChange={e => set("badge", e.target.value)}
              placeholder="Ex: Offre 1+1, Livraison Gratuite, Best-seller…"
            />
          </label>
          <label>
            Couleur thème (Accent)
            <input type="color" value={form.accent} onChange={e => set("accent", e.target.value)} />
          </label>
          <label className="wide-field">
            Description (Français) *
            <textarea
              required
              rows={2}
              value={form.description}
              onChange={e => set("description", e.target.value)}
            />
          </label>
          <label className="wide-field">
            Description Arabe (affichée sur la Landing Page)
            <textarea
              dir="rtl"
              rows={2}
              placeholder="وصف المنتج باللغة العربية..."
              value={form.arDescription ?? ""}
              onChange={e => set("arDescription", e.target.value)}
            />
          </label>
        </div>
      </div>

      {/* ÉTAPE 3 : VARIANTES / COULEURS AVEC LEURS PHOTOS */}
      <div className="studio-step-box">
        <div className="studio-step-header">
          <span className="studio-step-num">3</span>
          <div>
            <h4>Variantes & Couleurs du produit (Slider & Sélecteur Formulaire)</h4>
            <p>
              Ajoute chaque couleur/variante avec son nom (ex: أسود طبيعي, أبيض, Emerald) et sa photo dédiée. Dans les templates Extensions et Doudoune, la cliente pourra sélectionner 2 variantes !
            </p>
          </div>
        </div>

        <div className="studio-variants-list">
          {variants.map((variant, index) => (
            <div key={index} className="studio-variant-row">
              <div className="studio-variant-preview">
                {variant.image ? (
                  <img src={variant.image} alt={variant.name} />
                ) : (
                  <span>#{index + 1}</span>
                )}
              </div>
              <div className="studio-variant-inputs">
                <input
                  type="text"
                  placeholder={`Nom de la variante #${index + 1} (ex: أسود طبيعي ou Noir)`}
                  value={variant.name}
                  onChange={e => {
                    const val = e.target.value;
                    setVariants(prev => prev.map((v, i) => (i === index ? { ...v, name: val } : v)));
                  }}
                />
                <div className="studio-variant-url-row">
                  <input
                    type="text"
                    placeholder="URL de la photo de cette variante (ou importer →)"
                    value={variant.image}
                    onChange={e => {
                      const val = e.target.value;
                      setVariants(prev => prev.map((v, i) => (i === index ? { ...v, image: val } : v)));
                    }}
                  />
                  <label className="upload-inline" style={{ margin: 0, cursor: "pointer" }}>
                    <ImagePlus size={14} /> Photo
                    <input
                      type="file"
                      accept="image/*"
                      className="visually-hidden"
                      onChange={e => void handleVariantImageUpload(index, e.target.files)}
                    />
                  </label>
                </div>
              </div>
              <button
                type="button"
                className="icon-button danger-icon"
                onClick={() => setVariants(prev => prev.filter((_, i) => i !== index))}
                title="Supprimer cette variante"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="button button-light"
            onClick={() => setVariants(prev => [...prev, { name: `اللون ${prev.length + 1}`, image: "" }])}
          >
            <Plus size={15} /> Ajouter une variante / couleur
          </button>
          <button
            type="button"
            className="upload-inline"
            onClick={() => bulkVariantsRef.current?.click()}
            style={{ cursor: "pointer" }}
          >
            <Upload size={14} /> 📸 Importer plusieurs photos de variantes d'un coup
          </button>
          <input
            ref={bulkVariantsRef}
            className="visually-hidden"
            type="file"
            accept="image/*"
            multiple
            onChange={e => void handleBulkVariantsUpload(e.target.files)}
          />
        </div>
      </div>

      {/* ÉTAPE 4 : PHOTO PRINCIPALE (HERO) & GALERIE / BANNIÈRES VERTICALES */}
      <div className="studio-step-box">
        <div className="studio-step-header">
          <span className="studio-step-num">4</span>
          <div>
            <h4>Photo Principale (Hero) & Galerie / Bannières de la Landing Page</h4>
            <p>
              {form.landingTemplate === "extensions"
                ? "Pour le template Extensions : la Photo Principale s'affiche en grand Hero tout en haut, et les photos de la Galerie s'empilent en grandes bannières sous le slider !"
                : "Importe la photo principale (Hero) ainsi que les photos de détails ou du lookbook (toutes les photos sont compressées automatiquement en HD)."}
            </p>
          </div>
        </div>

        <div className="product-admin-grid">
          <div className="studio-media-block">
            <label>
              Photo principale (Hero Banner)
              <input
                placeholder="URL de l'image principale ou importe depuis ton appareil"
                value={form.image}
                onChange={e => set("image", e.target.value)}
              />
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
              <button type="button" className="upload-inline" onClick={() => imageRef.current?.click()}>
                <ImagePlus size={14} /> Importer la photo principale
              </button>
              <input
                ref={imageRef}
                className="visually-hidden"
                type="file"
                accept="image/*"
                onChange={e => void handleMainImageUpload(e.target.files)}
              />
              {(form.image || galleryList[0] || variants[0]?.image) && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <img
                    src={form.image || galleryList[0] || variants[0]?.image}
                    alt="Aperçu Hero"
                    style={{ width: 68, height: 68, objectFit: "cover", borderRadius: 12, border: "2px solid #10b981" }}
                  />
                  <small style={{ fontSize: 11, fontWeight: 800, color: "#059669" }}>
                    ✓ Photo Hero prise en compte
                  </small>
                </div>
              )}
            </div>
          </div>

          <div className="studio-media-block">
            <label>
              Arguments clés / Détails (une ligne par avantage)
              <textarea
                rows={4}
                placeholder={"Ex:\nقماش عالي الجودة\nمناسب لجميع المناسبات\nتوصيل سريع 58 ولاية"}
                value={detailsText}
                onChange={e => setDetailsText(e.target.value)}
              />
            </label>
          </div>

          <div className="wide-field studio-media-block">
            <label>
              Galerie photos / Bannières verticales ({galleryList.length} photo{galleryList.length > 1 ? "s" : ""})
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              <input
                type="text"
                style={{ flex: "1 1 220px", minHeight: 40, padding: "8px 12px", borderRadius: 10, border: "1px solid var(--line)" }}
                placeholder="Coller une URL d'image et cliquer sur + Ajouter"
                value={newGalleryUrl}
                onChange={e => setNewGalleryUrl(e.target.value)}
              />
              <button
                type="button"
                className="button button-light"
                onClick={() => {
                  if (!newGalleryUrl.trim()) return;
                  setGalleryList(prev => [...prev, newGalleryUrl.trim()]);
                  if (!form.image) set("image", newGalleryUrl.trim());
                  setNewGalleryUrl("");
                }}
              >
                <Plus size={14} /> Ajouter URL
              </button>
              <button type="button" className="upload-inline" onClick={() => galleryRef.current?.click()}>
                <Upload size={14} /> 📸 Importer plusieurs photos
              </button>
              <input
                ref={galleryRef}
                className="visually-hidden"
                type="file"
                accept="image/*"
                multiple
                onChange={e => void handleGalleryUpload(e.target.files)}
              />
            </div>

            {galleryList.length > 0 && (
              <div className="studio-gallery-thumbs">
                {galleryList.map((imgUrl, idx) => (
                  <div key={`${imgUrl.slice(0, 40)}-${idx}`} className="studio-gallery-thumb-item">
                    <img src={imgUrl} alt={`Galerie ${idx + 1}`} />
                    <span
                      style={{
                        position: "absolute",
                        bottom: 4,
                        right: 4,
                        background: "rgba(15,23,42,0.8)",
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: 800,
                        padding: "1px 6px",
                        borderRadius: 999,
                      }}
                    >
                      #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => setGalleryList(prev => prev.filter((_, i) => i !== idx))}
                      title="Retirer cette photo"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bilan en direct des photos prises en compte */}
        <div
          style={{
            marginTop: 14,
            padding: "12px 14px",
            borderRadius: 14,
            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(59, 130, 246, 0.06))",
            border: "1.5px solid rgba(16, 185, 129, 0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="gcome-photo-summary-title">
              {isCompressing
                ? "⏳ Optimisation et compression HD des photos en cours…"
                : "✅ Bilan des photos prises en compte :"}
            </span>
            <span className="gcome-photo-summary-chip">
              🖼️ Hero : {form.image || galleryList[0] || variants.some(v => v.image) ? "1 photo prête" : "Auto"}
            </span>
            <span className="gcome-photo-summary-chip">
              🎨 Variantes avec photo : {variants.filter(v => v.image.trim()).length} / {variants.length}
            </span>
            <span className="gcome-photo-summary-chip">
              📸 Galerie / Bannières : {galleryList.length + (newGalleryUrl.trim() ? 1 : 0)} photo(s)
            </span>
          </div>
        </div>
      </div>

      <div className="form-panel-actions">
        <button type="button" className="button button-light" onClick={onCancel}>
          Annuler
        </button>
        <button type="submit" className="button button-gradient" disabled={isCompressing}>
          <Save size={16} /> {isCompressing ? "Compression des photos…" : "Enregistrer le produit & publier la Landing Page"}
        </button>
      </div>
    </form>
  );
}

function TrackingSettings({ notify }: { notify: (message: string) => void }) {
  const globalTikTok = hasGlobalTikTokPixel();
  const globalFacebook = hasGlobalFacebookPixel();
  const [config, setConfig] = useState<PixelConfig>(() => getPixelConfig());
  const update = (key: keyof PixelConfig, value: string) => setConfig(current => ({ ...current, [key]: value }));
  const save = () => {
    try {
      savePixelConfig(config);
      notify("Pixels globaux du site · préférences enregistrées");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Impossible d’enregistrer les préférences pixels");
    }
  };

  return (
    <section className="tracking-settings">
      <MobileAppCard notify={notify} />

      <div className="settings-hero">
        <span className="eyebrow">Mesure & acquisition</span>
        <h2>Connecte tes pixels<br /><em>sans perdre le signal.</em></h2>
        <p>Les événements ViewContent, InitiateCheckout et Purchase sont envoyés sur les pages produit et après validation COD.</p>
      </div>
      <p className="tracking-config-notice">Meta et TikTok sont installés dans l’en-tête pour tous les visiteurs avec les identifiants du site. Ces identifiants globaux ne sont pas remplacés par le stockage local. Vérifie la réception dans le Gestionnaire d’événements de chaque plateforme.</p>
      <PixelDiagnostics />
      <div className="tracking-grid">
        <div className="tracking-card">
          <div className="tracking-card-head">
            <Facebook size={22} />
            <div>
              <h3>Meta Pixel</h3>
              <p>Facebook / Instagram</p>
            </div>
            <span>{globalFacebook ? "Global" : "Optionnel"}</span>
          </div>
          <label>
            ID du pixel Facebook
            <input readOnly={globalFacebook} value={config.facebookPixelId} onChange={e => update("facebookPixelId", e.target.value)} placeholder="Ex. 123456789012345" />
          </label>
          <small>Le pixel Meta global est configuré pour tous les visiteurs. Pour modifier cet identifiant global, il faut mettre à jour la configuration du site.</small>
        </div>
        <div className="tracking-card">
          <div className="tracking-card-head">
            <span className="tiktok-mark">♪</span>
            <div>
              <h3>TikTok Pixel</h3>
              <p>ID ou code complet</p>
            </div>
            <span>Optionnel</span>
          </div>
          <label>
            ID TikTok
            <input readOnly={globalTikTok} value={config.tiktokPixelId} onChange={e => update("tiktokPixelId", e.target.value)} placeholder="Ex. CDEFGHIJKL123456" />
          </label>
          <label>
            Code TikTok fourni
            <textarea disabled={globalTikTok} value={config.tiktokCode} onChange={e => update("tiktokCode", e.target.value)} placeholder="Colle ici le code que TikTok te donne…" />
          </label>
          <small>Le pixel global du site est déjà configuré par ID : aucun code supplémentaire n’est nécessaire. Pour changer cet ID global, il faut mettre à jour la configuration du site.</small>
        </div>
      </div>
      <div className="event-map">
        <div>
          <span className="eyebrow">Événements COD actifs</span>
          <h3>Le tunnel est déjà préparé</h3>
        </div>
        <div className="event-pills">
          <span>ViewContent <b>Fiche produit</b></span>
          <span>InitiateCheckout <b>Commencer maintenant</b></span>
          <span>Purchase <b>Commande COD reçue</b></span>
        </div>
      </div>
      <div className="settings-actions">
        <button
          className="button button-light"
          onClick={() => {
            if (!config.facebookPixelId && !config.tiktokPixelId && !config.tiktokCode) {
              notify("Renseigne et enregistre un pixel avant le test");
              return;
            }
            trackPixelEvent("ViewContent", { content_name: "Vérification du pixel", currency: "DZD" });
            notify("Vérifie la réception dans Test Events — aucune commande créée");
          }}
        >
          <Facebook size={16} />Tester l’événement
        </button>
        <button className="button button-gradient" onClick={save}>
          <Save size={16} />Enregistrer les pixels
        </button>
      </div>
    </section>
  );
}

type OrderDetailsPayload = {
  orderId?: string;
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

type CarrierShippingRates = Record<string, ShippingRate>;

function pickPreferredShippingRates(
  carrier: "ecom" | "ecotrack" | undefined,
  ecoRates: CarrierShippingRates | undefined,
  ecomRates: CarrierShippingRates | undefined,
): CarrierShippingRates | undefined {
  const hasEco = Boolean(ecoRates && Object.keys(ecoRates).length > 0);
  const hasEcom = Boolean(ecomRates && Object.keys(ecomRates).length > 0);
  if (carrier === "ecom") return hasEcom ? ecomRates : hasEco ? ecoRates : undefined;
  return hasEco ? ecoRates : hasEcom ? ecomRates : undefined;
}

function resolveWilayaShippingFee(
  rates: CarrierShippingRates | undefined,
  wilaya: string,
  commune: string,
  delivery: "home" | "office",
  productIds: string[],
): number | null {
  if (!productIds.length || productIds.every(isFreeShippingProduct)) return 0;
  if (!rates) return null;
  const wid = wilayaIdFromName(wilaya, commune);
  if (!wid) return null;
  const rate = rates[String(wid)];
  if (!rate) return null;
  return delivery === "office" ? rate.stopdesk : rate.domicile;
}

function resolveEditableLocation(rawWilaya: string, rawCommune: string): { wilaya: string; commune: string } {
  const wRaw = (rawWilaya || "").trim();
  const cRaw = (rawCommune || "").trim();
  const wid = wilayaIdFromName(wRaw, cRaw);
  const resolvedWilaya = wid && abayaWilayas[wid - 1] ? abayaWilayas[wid - 1] : (wRaw || abayaWilayas[15] || "الجزائر");
  const communesForWilaya = abayaCommunesByWilaya[resolvedWilaya] ?? [];
  const resolvedCommune = cRaw || communesForWilaya[0] || resolvedWilaya;
  return { wilaya: resolvedWilaya, commune: resolvedCommune };
}

function findMatchingCatalogProduct(catalog: Product[], orderProductId?: string, orderProductName?: string): Product {
  if (orderProductId) {
    const byId = catalog.find(p => p.id === orderProductId || p.slug === orderProductId);
    if (byId) return byId;
  }
  const raw = (orderProductName || "").trim().toLowerCase();
  if (raw) {
    const exact = catalog.find(p => raw.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(raw));
    if (exact) return exact;
    if (raw.includes("extension") || raw.includes("extention") || raw.includes("إكستنشن") || raw.includes("شعر")) {
      const ext = catalog.find(p => p.id === "p-005" || p.slug.includes("extensions"));
      if (ext) return ext;
    }
    if (raw.includes("doudoune") || raw.includes("دواقون")) {
      const d = catalog.find(p => p.id === "p-008" || p.slug.includes("doudoune"));
      if (d) return d;
    }
    if (raw.includes("abaya") || raw.includes("عباية")) {
      const a = catalog.find(p => p.id === "p-007" || p.slug.includes("abaya"));
      if (a) return a;
    }
    if (raw.includes("manteau") || raw.includes("icon") || raw.includes("blazer") || raw.includes("معطف")) {
      const m = catalog.find(p => p.id === "p-001" || p.slug.includes("blazer"));
      if (m) return m;
    }
    if (raw.includes("badil") || raw.includes("microblading") || raw.includes("حواجب") || raw.includes("بديل")) {
      const b = catalog.find(p => p.id === "p-010" || p.slug.includes("badil"));
      if (b) return b;
    }
    if (raw.includes("pyjama") || raw.includes("بيجام")) {
      const py = catalog.find(p => p.id === "p-011" || p.slug.includes("pyjama"));
      if (py) return py;
    }
    for (const p of catalog) {
      if (raw.includes(p.slug.toLowerCase())) return p;
    }
  }
  return catalog[0] ?? {
    id: "p-008",
    slug: "doudoune-hiver-luxe",
    name: "Doudoune Hiver de Luxe",
    category: "vestes",
    categoryLabel: "Vestes & Manteaux",
    price: 7600,
    oldPrice: 9000,
    description: "",
    details: [],
    colors: ["أزرق سماوي", "أبيض", "أسود"],
    image: "",
    accent: "#17307e",
    stock: 25,
  };
}

function getColorsForProduct(product: Product | undefined): string[] {
  if (!product) return ["Noir"];
  const variantOpts = getProductVariantOptions(product);
  if (variantOpts.length > 0) {
    return variantOpts.map(v => v.name);
  }
  const isDoudoune = product.id === "p-008" || product.slug.includes("doudoune") || product.name.toLowerCase().includes("doudoune");
  if (isDoudoune) return ["أزرق سماوي", "أبيض", "أسود"];
  const isExtensions = product.id === "p-005" || product.slug.includes("extensions") || product.category === "extensions";
  if (isExtensions) {
    return ["أسود طبيعي", "بني غامق", "بني عسلي", "شاتين روكس", "أشقر فاتح", "نور بليلج غري"];
  }
  return product.colors?.length ? product.colors : ["Emerald", "Noir"];
}

function getDefaultSizeForProduct(product: Product | undefined): string {
  if (!product) return "M";
  if (product.id === "p-005" || product.category === "extensions" || product.category === "beaute" || product.category === "lentilles") {
    return "Standard";
  }
  return "M";
}

function computeProductGoodsPrice(product: Product | undefined, qty: number): number {
  if (!product) return 0;
  if (product.packPrice && product.packPrice > 0) {
    const pairs = Math.floor(qty / 2);
    const singles = qty % 2;
    return (pairs * product.packPrice) + (singles * product.price);
  }
  const isDoudoune = product.id === "p-008" || product.slug.includes("doudoune") || product.name.toLowerCase().includes("doudoune");
  if (isDoudoune) {
    const pairs = Math.floor(qty / 2);
    const singles = qty % 2;
    return (pairs * 12900) + (singles * 7600);
  }
  const isExtensions = product.id === "p-005" || product.slug.includes("extensions") || product.category === "extensions";
  if (isExtensions) {
    const pairs = Math.floor(qty / 2);
    const singles = qty % 2;
    return (pairs * 4500) + (singles * 2700);
  }
  return product.price * qty;
}

type PieceVariant = { color: string; size: string };

function parseVariants(rawColor: string | undefined, rawSize: string | undefined, count: number, availableColors: string[], defaultSize = "M"): PieceVariant[] {
  const result: PieceVariant[] = [];
  const defaultColor = availableColors[0] || "Noir";

  for (let i = 1; i <= count; i++) {
    const cMatch = rawColor ? rawColor.match(new RegExp(`(?:^|\\|\\s*)${i}\\s*:\\s*([^|]+)`, "i")) : null;
    const sMatch = rawSize ? rawSize.match(new RegExp(`(?:^|\\|\\s*)${i}\\s*:\\s*([^|]+)`, "i")) : null;

    let cVal = cMatch ? cMatch[1].trim() : "";
    let sVal = sMatch ? sMatch[1].trim() : "";

    if (!cVal && i === 1 && rawColor && !rawColor.includes(":")) {
      cVal = rawColor.split("|")[0]?.trim() || "";
    }
    if (!sVal && i === 1 && rawSize && !rawSize.includes(":")) {
      sVal = rawSize.split("|")[0]?.trim() || "";
    }

    result.push({
      color: cVal || defaultColor,
      size: sVal || defaultSize,
    });
  }
  return result;
}

function parseInitialOrderItems(order: CheckoutOrder, catalog: Product[]) {
  const rawProductStr = (order.product || "").trim();
  const hasPlusSeparator = rawProductStr.includes(" + ");
  if (hasPlusSeparator) {
    const parts = rawProductStr.split(" + ").map(s => s.trim()).filter(Boolean);
    const firstPart = parts[0] || rawProductStr;
    const secondPart = parts.slice(1).join(" + ") || "";

    const extractQtyAndName = (segment: string, fallbackQty: number) => {
      const m = segment.match(/^(.*?)\s*×\s*(\d+)$/);
      if (m) {
        return { name: m[1].trim(), qty: Math.max(1, parseInt(m[2], 10) || 1) };
      }
      if (segment.includes("عرض 2 دواقون")) {
        return { name: segment.replace(/\s*\(عرض 2 دواقون.*?\)/, "").trim(), qty: 2 };
      }
      return { name: segment.trim(), qty: fallbackQty };
    };

    const parsed1 = extractQtyAndName(firstPart, 1);
    const parsed2 = extractQtyAndName(secondPart, Math.max(1, (order.quantity || 2) - parsed1.qty));

    const prod1 = findMatchingCatalogProduct(catalog, order.productId, parsed1.name);
    const prod2 = findMatchingCatalogProduct(catalog, undefined, parsed2.name);

    const colorParts = (order.color || "").split(" + ").map(s => s.replace(/^\[Art\.\d+\]\s*/i, "").trim());
    const sizeParts = (order.size || "").split(" + ").map(s => s.replace(/^\[Art\.\d+\]\s*/i, "").trim());

    return {
      hasSecond: true,
      prod1,
      prod1Name: prod1.name || parsed1.name,
      qty1: parsed1.qty,
      rawColor1: colorParts[0] || "",
      rawSize1: sizeParts[0] || "",
      prod2,
      prod2Name: prod2.name || parsed2.name,
      qty2: parsed2.qty,
      rawColor2: colorParts.slice(1).join(" | ") || "",
      rawSize2: sizeParts.slice(1).join(" | ") || "",
    };
  }

  const prod1 = findMatchingCatalogProduct(catalog, order.productId, order.product);
  const defaultSecond =
    catalog.find(p => p.id === "p-005" && p.id !== prod1.id) ||
    catalog.find(p => p.id === "p-008" && p.id !== prod1.id) ||
    catalog.find(p => p.id !== prod1.id) ||
    prod1;

  return {
    hasSecond: false,
    prod1,
    prod1Name: prod1?.name || order.product.replace(/\s*×\s*\d+$/, "").trim(),
    qty1: Math.max(1, order.quantity || 1),
    rawColor1: order.color || "",
    rawSize1: order.size || "",
    prod2: defaultSecond,
    prod2Name: defaultSecond.name,
    qty2: 1,
    rawColor2: "",
    rawSize2: "",
  };
}

function OrderModal({
  order,
  isSaving,
  onClose,
  onCall,
  onWhatsApp,
  onOpenHistory,
  onOpenPostpone,
  onOpenCancel,
  onSetNrpLevel,
  onSetCarrier,
  onUpdate,
  onSaveDetails,
  onDelete,
  onCopy,
}: {
  order: CheckoutOrder;
  isSaving: boolean;
  onClose: () => void;
  onCall: (phone: string) => void;
  onWhatsApp?: () => void;
  onOpenHistory?: () => void;
  onOpenPostpone?: () => void;
  onOpenCancel?: () => void;
  onSetNrpLevel?: (level: 1 | 2 | 3) => void;
  onSetCarrier?: (carrier: "ecom" | "ecotrack") => void;
  onUpdate: (id: string, status: OrderStatus) => void;
  onSaveDetails: (dbId: number, updates: OrderDetailsPayload) => Promise<CheckoutOrder | null>;
  onDelete: (dbId: number) => void;
  onCopy: () => void;
}) {
  const catalog = useMemo(() => getCatalogProducts(), []);
  const initialParsed = useMemo(() => parseInitialOrderItems(order, catalog), [order, catalog]);
  const initialLoc = useMemo(() => resolveEditableLocation(order.wilaya, order.commune), [order.wilaya, order.commune]);

  const [customer, setCustomer] = useState(order.customer);
  const [phone, setPhone] = useState(order.phone);
  const [productId, setProductId] = useState(initialParsed.prod1.id || "p-008");
  const [productName, setProductName] = useState(initialParsed.prod1Name);
  const [quantity, setQuantity] = useState(initialParsed.qty1);

  // 2nd Product (Cross-Sell) states
  const [hasSecondProduct, setHasSecondProduct] = useState<boolean>(initialParsed.hasSecond);
  const [secondProductId, setSecondProductId] = useState<string>(initialParsed.prod2.id);
  const [secondProductName, setSecondProductName] = useState<string>(initialParsed.prod2Name);
  const [secondQuantity, setSecondQuantity] = useState<number>(initialParsed.qty2);
  const [crossSellDiscount, setCrossSellDiscount] = useState<number>(0);
  const [showModalNrpOptions, setShowModalNrpOptions] = useState<boolean>(false);

  const [total, setTotal] = useState(order.total);
  const [delivery, setDelivery] = useState<"home" | "office">(order.delivery || "home");
  const [wilaya, setWilaya] = useState(initialLoc.wilaya);
  const [commune, setCommune] = useState(initialLoc.commune);
  const [customCommuneMode, setCustomCommuneMode] = useState<boolean>(false);
  const [address, setAddress] = useState(order.address || "");
  const [note, setNote] = useState(order.note || "");
  const [saveFeedback, setSaveFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const loc = resolveEditableLocation(order.wilaya, order.commune);
    setCustomer(order.customer);
    setPhone(order.phone);
    setTotal(order.total);
    setDelivery(order.delivery || "home");
    setWilaya(loc.wilaya);
    setCommune(loc.commune);
    setCustomCommuneMode(false);
    setAddress(order.address || "");
    setNote(order.note || "");
  }, [order.id, order.customer, order.phone, order.wilaya, order.commune, order.address, order.note, order.total, order.delivery]);

  const selectedCatalogProduct = catalog.find(p => p.id === productId) || initialParsed.prod1;
  const isDoudoune = selectedCatalogProduct?.id === "p-008" || selectedCatalogProduct?.slug.includes("doudoune") || selectedCatalogProduct?.name.toLowerCase().includes("doudoune");

  const secondCatalogProduct = catalog.find(p => p.id === secondProductId) || initialParsed.prod2;
  const isSecondDoudoune = secondCatalogProduct?.id === "p-008" || secondCatalogProduct?.slug.includes("doudoune") || secondCatalogProduct?.name.toLowerCase().includes("doudoune");

  const availableColors = useMemo(() => getColorsForProduct(selectedCatalogProduct), [selectedCatalogProduct]);
  const secondAvailableColors = useMemo(() => getColorsForProduct(secondCatalogProduct), [secondCatalogProduct]);

  // Tarifs de livraison DHD (EcoTrack) et E-com Delivery selon la wilaya
  const ecotrackFeesQuery = trpc.ecotrack.fees.useQuery(undefined, {
    retry: false,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const ecomRatesQuery = trpc.store.shippingRates.useQuery(undefined, {
    retry: false,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const preferredRates = useMemo(
    () => pickPreferredShippingRates(order.carrier, ecotrackFeesQuery.data?.rates, ecomRatesQuery.data?.rates),
    [order.carrier, ecotrackFeesQuery.data?.rates, ecomRatesQuery.data?.rates]
  );

  // Conserve le frais de livraison d'origine de la commande à l'ouverture
  const initialShippingFee = useMemo(() => {
    const initialGoods1 = computeProductGoodsPrice(initialParsed.prod1, initialParsed.qty1);
    const initialGoods2 = initialParsed.hasSecond
      ? computeProductGoodsPrice(initialParsed.prod2, initialParsed.qty2)
      : 0;
    const diff = order.total - (initialGoods1 + initialGoods2);
    return diff > 0 ? diff : 0;
  }, [initialParsed, order.total]);

  const [shippingFee, setShippingFee] = useState<number>(initialShippingFee);
  const [freeShippingForced, setFreeShippingForced] = useState<boolean>(false);

  const computeLiveFee = (
    targetWilaya = wilaya,
    targetCommune = commune,
    targetDelivery = delivery,
    p1 = productId,
    withSecond = hasSecondProduct,
    p2 = secondProductId,
  ): number | null => {
    const ids = withSecond ? [p1, p2] : [p1];
    return resolveWilayaShippingFee(preferredRates, targetWilaya, targetCommune, targetDelivery, ids);
  };

  const liveWilayaFee = useMemo(
    () =>
      resolveWilayaShippingFee(
        preferredRates,
        wilaya,
        commune,
        delivery,
        hasSecondProduct ? [productId, secondProductId] : [productId],
      ),
    [preferredRates, wilaya, commune, delivery, productId, secondProductId, hasSecondProduct]
  );

  const [variants, setVariants] = useState<PieceVariant[]>(() =>
    parseVariants(
      initialParsed.rawColor1,
      initialParsed.rawSize1,
      initialParsed.qty1,
      availableColors,
      getDefaultSizeForProduct(initialParsed.prod1),
    )
  );

  const [secondVariants, setSecondVariants] = useState<PieceVariant[]>(() =>
    parseVariants(
      initialParsed.rawColor2,
      initialParsed.rawSize2,
      initialParsed.qty2,
      secondAvailableColors,
      getDefaultSizeForProduct(initialParsed.prod2),
    )
  );

  const allWilayas = useMemo(() => {
    const custom = wilaya && !abayaWilayas.includes(wilaya) ? [wilaya] : [];
    return [...custom, ...abayaWilayas];
  }, [wilaya]);
  const arabicCommunes = abayaCommunesByWilaya[wilaya] ?? [];
  const communeOptions = useMemo(
    () => Array.from(new Set([commune, ...arabicCommunes].map(c => c.trim()).filter(Boolean))),
    [commune, arabicCommunes]
  );

  const recomputeCombinedTotal = (
    prod1: Product | undefined,
    qty1: number,
    withSecond: boolean,
    prod2: Product | undefined,
    qty2: number,
    ship: number,
    discount: number
  ) => {
    const g1 = computeProductGoodsPrice(prod1, qty1);
    const g2 = withSecond ? computeProductGoodsPrice(prod2, qty2) : 0;
    return Math.max(0, g1 + g2 - discount + ship);
  };

  const handleProductChange = (nextId: string) => {
    setProductId(nextId);
    const found = catalog.find(p => p.id === nextId);
    if (found) {
      setProductName(found.name);
      const nextColors = getColorsForProduct(found);
      const nextDefaultSize = getDefaultSizeForProduct(found);
      setVariants(prev =>
        prev.map(v => ({
          color: nextColors.includes(v.color) ? v.color : (nextColors[0] || "Noir"),
          size: nextDefaultSize === "Standard" ? "Standard" : v.size || nextDefaultSize,
        }))
      );
      const isFree = (found.id === "p-007" || found.slug.includes("abaya")) && !hasSecondProduct;
      const computedNext = isFree
        ? 0
        : freeShippingForced
          ? 0
          : (computeLiveFee(wilaya, commune, delivery, nextId, hasSecondProduct, secondProductId) ?? shippingFee);
      setShippingFee(computedNext);
      setTotal(recomputeCombinedTotal(found, quantity, hasSecondProduct, secondCatalogProduct, secondQuantity, computedNext, crossSellDiscount));
    }
  };

  const handleQuantityChange = (nextQty: number) => {
    const safeQty = Math.max(1, Math.min(10, nextQty || 1));
    setQuantity(safeQty);

    const defSize = getDefaultSizeForProduct(selectedCatalogProduct);
    setVariants(prev => {
      const next = [...prev];
      while (next.length < safeQty) {
        const last = next[next.length - 1] || { color: availableColors[0] || "Noir", size: defSize };
        next.push({ ...last });
      }
      return next.slice(0, safeQty);
    });

    setTotal(recomputeCombinedTotal(selectedCatalogProduct, safeQty, hasSecondProduct, secondCatalogProduct, secondQuantity, shippingFee, crossSellDiscount));
  };

  const updatePieceVariant = (index: number, field: "color" | "size", val: string) => {
    setVariants(prev => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], [field]: val };
      }
      return next;
    });
  };

  // Handlers for 2nd Product (Cross-Sell)
  const activateSecondProduct = (targetProductId?: string) => {
    const chosenId =
      targetProductId ||
      secondProductId ||
      catalog.find(p => p.id === "p-005" && p.id !== productId)?.id ||
      catalog.find(p => p.id !== productId)?.id ||
      catalog[0]?.id ||
      "p-005";
    const found = catalog.find(p => p.id === chosenId) || secondCatalogProduct;
    const cols = getColorsForProduct(found);
    const defSize = getDefaultSizeForProduct(found);
    setHasSecondProduct(true);
    setSecondProductId(found.id);
    setSecondProductName(found.name);
    setSecondQuantity(1);
    setSecondVariants([{ color: cols[0] || "Noir", size: defSize }]);
    const nextShip = freeShippingForced
      ? 0
      : (computeLiveFee(wilaya, commune, delivery, productId, true, found.id) ?? shippingFee);
    setShippingFee(nextShip);
    setTotal(recomputeCombinedTotal(selectedCatalogProduct, quantity, true, found, 1, nextShip, crossSellDiscount));
  };

  const removeSecondProduct = () => {
    setHasSecondProduct(false);
    setCrossSellDiscount(0);
    const nextShip = freeShippingForced
      ? 0
      : (computeLiveFee(wilaya, commune, delivery, productId, false, secondProductId) ?? shippingFee);
    setShippingFee(nextShip);
    setTotal(recomputeCombinedTotal(selectedCatalogProduct, quantity, false, secondCatalogProduct, secondQuantity, nextShip, 0));
  };

  const handleSecondProductChange = (nextId: string) => {
    setSecondProductId(nextId);
    const found = catalog.find(p => p.id === nextId);
    if (found) {
      setSecondProductName(found.name);
      const nextColors = getColorsForProduct(found);
      const nextDefSize = getDefaultSizeForProduct(found);
      setSecondVariants(prev =>
        prev.map(v => ({
          color: nextColors.includes(v.color) ? v.color : (nextColors[0] || "Noir"),
          size: nextDefSize === "Standard" ? "Standard" : (v.size === "Standard" ? "M" : v.size || nextDefSize),
        }))
      );
      const nextShip = freeShippingForced
        ? 0
        : (computeLiveFee(wilaya, commune, delivery, productId, true, found.id) ?? shippingFee);
      setShippingFee(nextShip);
      setTotal(recomputeCombinedTotal(selectedCatalogProduct, quantity, true, found, secondQuantity, nextShip, crossSellDiscount));
    }
  };

  const handleSecondQuantityChange = (nextQty: number) => {
    const safeQty = Math.max(1, Math.min(10, nextQty || 1));
    setSecondQuantity(safeQty);
    const defSize = getDefaultSizeForProduct(secondCatalogProduct);
    setSecondVariants(prev => {
      const next = [...prev];
      while (next.length < safeQty) {
        const last = next[next.length - 1] || { color: secondAvailableColors[0] || "Noir", size: defSize };
        next.push({ ...last });
      }
      return next.slice(0, safeQty);
    });
    setTotal(recomputeCombinedTotal(selectedCatalogProduct, quantity, true, secondCatalogProduct, safeQty, shippingFee, crossSellDiscount));
  };

  const updateSecondPieceVariant = (index: number, field: "color" | "size", val: string) => {
    setSecondVariants(prev => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], [field]: val };
      }
      return next;
    });
  };

  const applyCrossSellDiscount = (discountAmount: number, freeShip = false) => {
    const resolvedShip = computeLiveFee() ?? initialShippingFee;
    const nextShip = freeShip ? 0 : resolvedShip;
    setFreeShippingForced(freeShip);
    setShippingFee(nextShip);
    setCrossSellDiscount(discountAmount);
    setTotal(recomputeCombinedTotal(selectedCatalogProduct, quantity, hasSecondProduct, secondCatalogProduct, secondQuantity, nextShip, discountAmount));
  };

  const handleRecalculateAuto = () => {
    const resolvedShip = computeLiveFee() ?? shippingFee;
    setFreeShippingForced(false);
    setShippingFee(resolvedShip);
    setTotal(currentGoods + resolvedShip);
    setSaveFeedback(null);
  };

  const firstGoods = computeProductGoodsPrice(selectedCatalogProduct, quantity);
  const secondGoods = hasSecondProduct ? computeProductGoodsPrice(secondCatalogProduct, secondQuantity) : 0;
  const currentGoods = Math.max(0, firstGoods + secondGoods - crossSellDiscount);

  const handleSubmitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveFeedback(null);

    const trimmedCustomer = customer.trim();
    if (!trimmedCustomer) {
      setSaveFeedback({ type: "error", text: "Le nom de la cliente est obligatoire." });
      return;
    }

    const finalWilaya = wilaya.trim() || order.wilaya?.trim() || "الجزائر";
    const finalCommune = commune.trim() || arabicCommunes[0] || finalWilaya;
    const finalPhone = phone.trim() || order.phone?.trim() || "0000";

    const activeVariants1 = variants.slice(0, quantity);
    const color1 = quantity === 1
      ? (activeVariants1[0]?.color || availableColors[0] || "")
      : activeVariants1.map((v, i) => `${i + 1}: ${v.color}`).join(" | ");

    const size1 = quantity === 1
      ? (activeVariants1[0]?.size || getDefaultSizeForProduct(selectedCatalogProduct))
      : activeVariants1.map((v, i) => `${i + 1}: ${v.size}`).join(" | ");

    let formattedProduct1 = "";
    if (isDoudoune && quantity === 2) {
      formattedProduct1 = `${productName} (عرض 2 دواقون بـ 12900 دج)`;
    } else if (quantity > 1 || hasSecondProduct) {
      formattedProduct1 = `${productName} × ${quantity}`;
    } else {
      formattedProduct1 = productName;
    }

    let finalProduct = formattedProduct1;
    let finalQuantity = quantity;
    let finalColor = color1;
    let finalSize = size1;

    if (hasSecondProduct && secondCatalogProduct) {
      const activeVariants2 = secondVariants.slice(0, secondQuantity);
      const color2 = secondQuantity === 1
        ? (activeVariants2[0]?.color || secondAvailableColors[0] || "")
        : activeVariants2.map((v, i) => `${i + 1}: ${v.color}`).join(" | ");
      const size2 = secondQuantity === 1
        ? (activeVariants2[0]?.size || getDefaultSizeForProduct(secondCatalogProduct))
        : activeVariants2.map((v, i) => `${i + 1}: ${v.size}`).join(" | ");

      const formattedProduct2 = isSecondDoudoune && secondQuantity === 2
        ? `${secondProductName} (عرض 2 دواقون بـ 12900 دج)`
        : `${secondProductName} × ${secondQuantity}`;

      finalProduct = `${formattedProduct1} + ${formattedProduct2}`;
      finalQuantity = quantity + secondQuantity;
      finalColor = `[Art.1] ${color1} + [Art.2] ${color2}`;
      finalSize = `[Art.1] ${size1} + [Art.2] ${size2}`;
    }

    const safeDbId = typeof order.dbId === "number" && Number.isInteger(order.dbId) && order.dbId > 0 ? order.dbId : 1;

    try {
      await onSaveDetails(safeDbId, {
        orderId: order.id,
        customer: trimmedCustomer,
        phone: finalPhone,
        productId,
        product: finalProduct.trim() || order.product || "Produit",
        quantity: finalQuantity,
        total: Math.max(0, Math.round(Number(total) || 0)),
        color: finalColor.trim(),
        size: finalSize.trim(),
        delivery,
        wilaya: finalWilaya,
        commune: finalCommune,
        address: address.trim(),
        note: note.trim(),
      });
      setSaveFeedback({ type: "success", text: "✅ Modifications enregistrées avec succès !" });
    } catch (err) {
      setSaveFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Impossible d'enregistrer les modifications",
      });
    }
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

        <div className="modal-customer" style={{ flexWrap: "wrap", gap: "10px" }}>
          <div className="admin-avatar">{order.customer.split(" ").map(part => part[0]).join("")}</div>
          <div style={{ flex: 1, minWidth: "130px" }}>
            <strong>{order.customer}</strong>
            <span>{order.phone}</span>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button type="button" className="button button-outline call-button" onClick={() => onCall(phone)}>
              <Phone size={15} />Appeler
            </button>
            {onWhatsApp && (
              <button
                type="button"
                className="button"
                onClick={onWhatsApp}
                style={{
                  background: "rgba(37, 211, 102, 0.14)",
                  color: "#065f46",
                  border: "1px solid rgba(37, 211, 102, 0.4)",
                  fontWeight: 800,
                }}
              >
                <MessageCircle size={15} />WhatsApp
              </button>
            )}
            {onOpenHistory && (
              <button
                type="button"
                className="button"
                onClick={onOpenHistory}
                style={{
                  background: "rgba(99, 102, 241, 0.12)",
                  color: "#3730a3",
                  border: "1px solid rgba(99, 102, 241, 0.3)",
                  fontWeight: 800,
                }}
              >
                <History size={15} />Historique ({order.historyCount ?? order.history?.length ?? 1})
              </button>
            )}
          </div>
        </div>

        <form className="order-edit-form" onSubmit={handleSubmitEdit} noValidate style={{ display: "grid", gap: "14px", marginTop: "14px" }}>
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
              Quantité (Liste déroulante)
              <select
                value={quantity}
                onChange={e => handleQuantityChange(Number(e.target.value))}
                style={{
                  height: "44px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  padding: "0 12px",
                  fontWeight: 700,
                  fontSize: "14px",
                  backgroundColor: "var(--input-bg, #fff)",
                  cursor: "pointer",
                }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(qty => {
                  const goods = computeProductGoodsPrice(selectedCatalogProduct, qty);
                  let label = `${qty} pièce${qty > 1 ? "s" : ""} — ${formatDZD(goods)}`;
                  if (isDoudoune && qty === 2) {
                    label = `2 pièces (Pack Duo 12 900 DA - Promo 🔥)`;
                  } else if (isDoudoune && qty === 4) {
                    label = `4 pièces (2x Pack Duo 25 800 DA - Promo 🔥)`;
                  }
                  return (
                    <option key={qty} value={qty}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>

          {quantity === 1 ? (
            <div style={{ display: "grid", gap: "10px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
                  Variante · Couleur
                  <select
                    value={variants[0]?.color || availableColors[0]}
                    onChange={e => updatePieceVariant(0, "color", e.target.value)}
                  >
                    {Array.from(new Set([variants[0]?.color, ...availableColors].filter(Boolean))).map(c => (
                      <option key={c} value={c}>{c === "Emerald" ? "Emerald (أخضر)" : c === "Noir" ? "Noir (أسود)" : c}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
                  Variante · Taille
                  <select
                    value={variants[0]?.size || "M"}
                    onChange={e => updatePieceVariant(0, "size", e.target.value)}
                  >
                    {["S", "M", "L", "XL", "XXL", "Standard"].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
              {getProductVariantOptions(selectedCatalogProduct).some(vo => vo.image) && (
                <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
                  {getProductVariantOptions(selectedCatalogProduct).map((vo, vIdx) => {
                    const isPicked = (variants[0]?.color || availableColors[0]) === vo.name;
                    return (
                      <button
                        key={`${vo.name}-${vIdx}`}
                        type="button"
                        onClick={() => updatePieceVariant(0, "color", vo.name)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "7px",
                          padding: "4px 10px 4px 5px",
                          borderRadius: "10px",
                          border: isPicked ? "2px solid #10b981" : "1px solid var(--line, #cbd5e1)",
                          background: isPicked ? "rgba(16, 185, 129, 0.12)" : "var(--input-bg, #fff)",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        {vo.image && (
                          <img
                            src={vo.image}
                            alt={vo.name}
                            style={{ width: 32, height: 32, borderRadius: 7, objectFit: "cover" }}
                          />
                        )}
                        <span style={{ fontSize: 12, fontWeight: 800 }}>{vo.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div style={{
              padding: "12px 14px",
              borderRadius: "14px",
              background: isDoudoune && quantity === 2
                ? "linear-gradient(135deg, rgba(235, 75, 122, 0.08), rgba(244, 63, 94, 0.04))"
                : "rgba(99, 102, 241, 0.06)",
              border: isDoudoune && quantity === 2
                ? "1px solid rgba(235, 75, 122, 0.3)"
                : "1px solid rgba(99, 102, 241, 0.2)",
              display: "grid",
              gap: "10px",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
                <span style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  color: isDoudoune && quantity === 2 ? "#eb4b7a" : "#4f46e5",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}>
                  <span>{isDoudoune && quantity === 2 ? "🔥" : "📦"}</span>
                  Variantes par pièce ({quantity} pièces)
                  {isDoudoune && quantity === 2 && (
                    <span style={{
                      background: "#eb4b7a",
                      color: "#fff",
                      fontSize: "11px",
                      padding: "2px 8px",
                      borderRadius: "999px",
                      fontWeight: 700,
                    }}>
                      Pack Duo 12 900 DA
                    </span>
                  )}
                </span>
                <small style={{ color: "var(--muted, #64748b)", fontSize: "11px" }}>
                  Sélectionne la couleur et taille de chaque article
                </small>
              </div>
              <div style={{ display: "grid", gap: "8px" }}>
                {variants.slice(0, quantity).map((v, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr 1fr",
                      gap: "8px",
                      alignItems: "center",
                      background: "rgba(255, 255, 255, 0.9)",
                      padding: "8px 10px",
                      borderRadius: "10px",
                      border: "1px solid rgba(0,0,0,0.08)",
                    }}
                  >
                    <span style={{ fontWeight: 800, fontSize: "12px", minWidth: "60px", color: "#334155" }}>
                      Pièce {idx + 1} :
                    </span>
                    <select
                      value={v.color}
                      onChange={e => updatePieceVariant(idx, "color", e.target.value)}
                      style={{ height: "36px", borderRadius: "8px", fontSize: "12px", fontWeight: 600 }}
                    >
                      {Array.from(new Set([v.color, ...availableColors].filter(Boolean))).map(c => (
                        <option key={c} value={c}>{c === "Emerald" ? "Emerald (أخضر)" : c === "Noir" ? "Noir (أسود)" : c}</option>
                      ))}
                    </select>
                    <select
                      value={v.size}
                      onChange={e => updatePieceVariant(idx, "size", e.target.value)}
                      style={{ height: "36px", borderRadius: "8px", fontSize: "12px", fontWeight: 600 }}
                    >
                      {["S", "M", "L", "XL", "XXL", "Standard"].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== BLOC 2ÈME PRODUIT (CROSS-SELL / PANIER COMBINÉ) ===== */}
          {!hasSecondProduct ? (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "14px",
                background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(5, 150, 105, 0.04))",
                border: "1.5px dashed rgba(16, 185, 129, 0.45)",
                display: "grid",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                <div>
                  <strong style={{ fontSize: "13px", fontWeight: 800, color: "#065f46", display: "flex", alignItems: "center", gap: "6px" }}>
                    🛍️ Cross-Sell : Ajouter un 2ème produit au même colis
                  </strong>
                  <small style={{ fontSize: "11px", color: "#047857" }}>
                    1 seul frais de livraison facturé + Bonus Upsell/Cross-Sell crédité au confirmateur !
                  </small>
                </div>
                <button
                  type="button"
                  onClick={() => activateSecondProduct()}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "10px",
                    border: "1px solid #10b981",
                    background: "#10b981",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: "12.5px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)",
                  }}
                >
                  <Plus size={15} /> Ajouter un 2ème produit
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#065f46" }}>Ajout rapide 1-clic :</span>
                {catalog
                  .filter(p => ["p-005", "p-008", "p-007", "p-003", "p-004"].includes(p.id))
                  .map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => activateSecondProduct(item.id)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "999px",
                        border: "1px solid rgba(16, 185, 129, 0.35)",
                        background: "#fff",
                        color: "#065f46",
                        fontSize: "11px",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      + {item.name} ({formatDZD(item.price)})
                    </button>
                  ))}
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: "14px",
                borderRadius: "14px",
                background: "linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(59, 130, 246, 0.06))",
                border: "1.5px solid rgba(16, 185, 129, 0.45)",
                display: "grid",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span
                    style={{
                      background: "#10b981",
                      color: "#fff",
                      fontSize: "11px",
                      fontWeight: 900,
                      padding: "3px 9px",
                      borderRadius: "999px",
                    }}
                  >
                    PRODUIT #2 (CROSS-SELL)
                  </span>
                  <strong style={{ fontSize: "13px", color: "#064e3b" }}>
                    +{formatDZD(secondGoods)}
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={removeSecondProduct}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "8px",
                    border: "1px solid rgba(239, 68, 68, 0.35)",
                    background: "rgba(255, 255, 255, 0.9)",
                    color: "#dc2626",
                    fontSize: "11.5px",
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <Trash2 size={13} /> Retirer le 2ème produit
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
                  2ème Produit
                  <select value={secondProductId} onChange={e => handleSecondProductChange(e.target.value)}>
                    {catalog.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({formatDZD(item.price)})
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
                  Quantité 2ème produit
                  <select
                    value={secondQuantity}
                    onChange={e => handleSecondQuantityChange(Number(e.target.value))}
                    style={{
                      height: "44px",
                      borderRadius: "10px",
                      border: "1px solid #cbd5e1",
                      padding: "0 12px",
                      fontWeight: 700,
                      fontSize: "14px",
                      backgroundColor: "var(--input-bg, #fff)",
                      cursor: "pointer",
                    }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(qty => {
                      const goods = computeProductGoodsPrice(secondCatalogProduct, qty);
                      let label = `${qty} pièce${qty > 1 ? "s" : ""} — ${formatDZD(goods)}`;
                      if (isSecondDoudoune && qty === 2) {
                        label = `2 pièces (Pack Duo 12 900 DA - Promo 🔥)`;
                      }
                      return (
                        <option key={qty} value={qty}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </label>
              </div>

              {secondQuantity === 1 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                  <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
                    Couleur (2ème produit)
                    <select
                      value={secondVariants[0]?.color || secondAvailableColors[0]}
                      onChange={e => updateSecondPieceVariant(0, "color", e.target.value)}
                    >
                      {Array.from(new Set([secondVariants[0]?.color, ...secondAvailableColors].filter(Boolean))).map(c => (
                        <option key={c} value={c}>
                          {c === "Emerald" ? "Emerald (أخضر)" : c === "Noir" ? "Noir (أسود)" : c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
                    Taille (2ème produit)
                    <select
                      value={secondVariants[0]?.size || getDefaultSizeForProduct(secondCatalogProduct)}
                      onChange={e => updateSecondPieceVariant(0, "size", e.target.value)}
                    >
                      {["Standard", "S", "M", "L", "XL", "XXL"].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : (
                <div style={{ display: "grid", gap: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 800, color: "#065f46" }}>
                    Variantes du 2ème produit ({secondQuantity} pièces) :
                  </span>
                  {secondVariants.slice(0, secondQuantity).map((v, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "auto 1fr 1fr",
                        gap: "8px",
                        alignItems: "center",
                        background: "rgba(255, 255, 255, 0.9)",
                        padding: "8px 10px",
                        borderRadius: "10px",
                        border: "1px solid rgba(0,0,0,0.08)",
                      }}
                    >
                      <span style={{ fontWeight: 800, fontSize: "12px", minWidth: "60px", color: "#334155" }}>
                        Pièce {idx + 1} :
                      </span>
                      <select
                        value={v.color}
                        onChange={e => updateSecondPieceVariant(idx, "color", e.target.value)}
                        style={{ height: "36px", borderRadius: "8px", fontSize: "12px", fontWeight: 600 }}
                      >
                        {Array.from(new Set([v.color, ...secondAvailableColors].filter(Boolean))).map(c => (
                          <option key={c} value={c}>
                            {c === "Emerald" ? "Emerald (أخضر)" : c === "Noir" ? "Noir (أسود)" : c}
                          </option>
                        ))}
                      </select>
                      <select
                        value={v.size}
                        onChange={e => updateSecondPieceVariant(idx, "size", e.target.value)}
                        style={{ height: "36px", borderRadius: "8px", fontSize: "12px", fontWeight: 600 }}
                      >
                        {["Standard", "S", "M", "L", "XL", "XXL"].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}

              {/* Offres commerciales rapides Cross-Sell */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", paddingTop: "4px", borderTop: "1px dashed rgba(16, 185, 129, 0.3)" }}>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "#065f46" }}>🎁 Geste commercial Cross-Sell :</span>
                {[
                  { label: "Tarif normal", discount: 0, freeShip: false },
                  { label: "-300 DA (Remise Duo)", discount: 300, freeShip: false },
                  { label: "-500 DA (Pack Combiné)", discount: 500, freeShip: false },
                  { label: "🚚 Livraison Offerte", discount: 0, freeShip: true },
                ].map(offer => {
                  const isSelected = crossSellDiscount === offer.discount && (offer.freeShip ? freeShippingForced || shippingFee === 0 : !freeShippingForced && shippingFee === (liveWilayaFee ?? initialShippingFee));
                  return (
                    <button
                      key={offer.label}
                      type="button"
                      onClick={() => applyCrossSellDiscount(offer.discount, offer.freeShip)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "999px",
                        border: isSelected ? "1.5px solid #059669" : "1px solid rgba(16, 185, 129, 0.3)",
                        background: isSelected ? "#059669" : "#fff",
                        color: isSelected ? "#fff" : "#065f46",
                        fontSize: "11px",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      {offer.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
            <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              Wilaya
              <select
                value={wilaya}
                onChange={e => {
                  const nextW = e.target.value;
                  setWilaya(nextW);
                  const nextList = abayaCommunesByWilaya[nextW];
                  const nextCommune = nextList?.length ? nextList[0] : nextW;
                  setCommune(nextCommune);
                  setCustomCommuneMode(false);
                  setSaveFeedback(null);
                  const nextFee = computeLiveFee(nextW, nextCommune, delivery);
                  if (nextFee !== null && !freeShippingForced) {
                    setShippingFee(nextFee);
                    setTotal(recomputeCombinedTotal(selectedCatalogProduct, quantity, hasSecondProduct, secondCatalogProduct, secondQuantity, nextFee, crossSellDiscount));
                  }
                }}
              >
                {allWilayas.map(w => {
                  const idx = abayaWilayas.indexOf(w);
                  const fr = idx >= 0 ? WILAYA_FRENCH_NAMES[idx + 1] : "";
                  const label = idx >= 0 ? `${String(idx + 1).padStart(2, "0")} - ${w}${fr ? ` (${fr})` : ""}` : w;
                  return (
                    <option key={w} value={w}>{label}</option>
                  );
                })}
              </select>
            </label>
            <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              Commune
              {arabicCommunes.length > 0 && !customCommuneMode ? (
                <select
                  value={communeOptions.includes(commune) ? commune : (communeOptions[0] ?? "")}
                  onChange={e => {
                    if (e.target.value === "__custom__") {
                      setCustomCommuneMode(true);
                    } else {
                      setCommune(e.target.value);
                    }
                    setSaveFeedback(null);
                  }}
                >
                  {communeOptions.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="__custom__">✏️ Autre commune (saisie libre)…</option>
                </select>
              ) : (
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <input
                    value={commune}
                    onChange={e => {
                      setCommune(e.target.value);
                      setSaveFeedback(null);
                    }}
                    placeholder="Nom de la commune"
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  {arabicCommunes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomCommuneMode(false);
                        if (!commune.trim() && arabicCommunes[0]) {
                          setCommune(arabicCommunes[0]);
                        }
                      }}
                      style={{
                        height: "44px",
                        padding: "0 10px",
                        borderRadius: "10px",
                        border: "1px solid var(--app-border, #cbd5e1)",
                        background: "var(--app-surface-sub, #f8fafc)",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Liste
                    </button>
                  )}
                </div>
              )}
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
            <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              Type de livraison
              <select
                value={delivery}
                onChange={e => {
                  const nextDelivery = e.target.value as "home" | "office";
                  setDelivery(nextDelivery);
                  setSaveFeedback(null);
                  const nextFee = computeLiveFee(wilaya, commune, nextDelivery);
                  if (nextFee !== null && !freeShippingForced) {
                    setShippingFee(nextFee);
                    setTotal(recomputeCombinedTotal(selectedCatalogProduct, quantity, hasSecondProduct, secondCatalogProduct, secondQuantity, nextFee, crossSellDiscount));
                  }
                }}
              >
                <option value="home">🏠 À domicile (إلى المنزل)</option>
                <option value="office">🏢 Au bureau / Stop Desk (إلى المكتب)</option>
              </select>
            </label>
            <div style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Total commande (DA)</span>
                <button
                  type="button"
                  onClick={handleRecalculateAuto}
                  style={{
                    fontSize: "11px",
                    background: "none",
                    border: "none",
                    color: "#2563eb",
                    cursor: "pointer",
                    textDecoration: "underline",
                    padding: 0,
                    fontWeight: 600,
                  }}
                  title="Recalculer : prix produit + tarif livraison de la wilaya sélectionnée"
                >
                  Recalculer auto
                </button>
              </div>
              <input
                type="number"
                min={0}
                value={total}
                onChange={e => setTotal(Number(e.target.value))}
                required
                style={{ fontWeight: 800, color: "#10b981", fontSize: "16px", height: "44px" }}
              />
              <div style={{ fontSize: "11px", color: "var(--muted, #64748b)", fontWeight: 500, lineHeight: 1.45 }}>
                {hasSecondProduct ? (
                  <>
                    Produit 1 : <strong>{formatDZD(firstGoods)}</strong> + Produit 2 : <strong>{formatDZD(secondGoods)}</strong>
                    {crossSellDiscount > 0 && (
                      <> − Remise : <strong style={{ color: "#059669" }}>{formatDZD(crossSellDiscount)}</strong></>
                    )}
                  </>
                ) : (
                  <>Articles : <strong>{formatDZD(currentGoods)}</strong></>
                )}
                {shippingFee > 0 ? (
                  <> + Livraison : <strong>{formatDZD(shippingFee)}</strong></>
                ) : (
                  <> + Livraison : <strong>0 DA</strong></>
                )}
                {liveWilayaFee !== null && liveWilayaFee !== shippingFee && (
                  <span style={{ color: "#2563eb", marginLeft: "6px", fontWeight: 700 }}>
                    (Tarif wilaya : {formatDZD(liveWilayaFee)})
                  </span>
                )}
                {total !== currentGoods + shippingFee && (
                  <span style={{ color: "#d97706", marginLeft: "6px", fontWeight: 600 }}>
                    (Ajustement manuel)
                  </span>
                )}
              </div>
            </div>
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

          {saveFeedback && (
            <div
              role={saveFeedback.type === "error" ? "alert" : "status"}
              style={{
                padding: "10px 14px",
                borderRadius: "12px",
                fontSize: "13px",
                fontWeight: 800,
                background: saveFeedback.type === "error" ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.14)",
                color: saveFeedback.type === "error" ? "#b91c1c" : "#047857",
                border: saveFeedback.type === "error" ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid rgba(16, 185, 129, 0.35)",
              }}
            >
              {saveFeedback.text}
            </div>
          )}

          <button type="submit" className="button button-gradient full" disabled={isSaving} style={{ marginTop: "6px", height: "48px", borderRadius: "14px", fontSize: "15px" }}>
            <Save size={17} /> {isSaving ? "Enregistrement…" : "Enregistrer les modifications"}
          </button>
        </form>

        {order.status === "confirmee" && onSetCarrier && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px 12px",
              borderRadius: "12px",
              background: "rgba(15, 23, 42, 0.04)",
              border: "1px dashed rgba(100, 116, 139, 0.28)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
              🚚 Société de livraison liée :
            </span>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => onSetCarrier("ecom")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "9px",
                  fontSize: "12px",
                  fontWeight: 800,
                  cursor: "pointer",
                  background: !order.carrier || order.carrier === "ecom" ? "#0f766e" : "#fff",
                  color: !order.carrier || order.carrier === "ecom" ? "#fff" : "#334155",
                  border: !order.carrier || order.carrier === "ecom" ? "1px solid #0f766e" : "1px solid rgba(148,163,184,0.35)",
                }}
              >
                🚚 E-com Delivery
              </button>
              <button
                type="button"
                onClick={() => onSetCarrier("ecotrack")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "9px",
                  fontSize: "12px",
                  fontWeight: 800,
                  cursor: "pointer",
                  background: order.carrier === "ecotrack" ? "#2563eb" : "#fff",
                  color: order.carrier === "ecotrack" ? "#fff" : "#334155",
                  border: order.carrier === "ecotrack" ? "1px solid #2563eb" : "1px solid rgba(148,163,184,0.35)",
                }}
              >
                📦 DHD (EcoTrack)
              </button>
            </div>
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: "14px" }}>
          <p>Changer le statut</p>
          {actionLabels.map(action => (
            <button
              key={action.status}
              type="button"
              className={`action-${action.status}`}
              onClick={() => {
                if (action.status === "ne_repond_pas" && onSetNrpLevel) {
                  setShowModalNrpOptions(prev => !prev);
                  return;
                }
                if (action.status === "reportee" && onOpenPostpone) {
                  onOpenPostpone();
                  return;
                }
                if (action.status === "annulee" && onOpenCancel) {
                  onOpenCancel();
                  return;
                }
                onUpdate(order.id, action.status);
              }}
            >
              {action.label}
              {action.status === "ne_repond_pas" && order.status === "ne_repond_pas" ? ` (NRP ${order.nrpLevel ?? 1})` : ""}
            </button>
          ))}
        </div>

        {showModalNrpOptions && onSetNrpLevel && (
          <div
            style={{
              marginTop: "10px",
              padding: "12px",
              borderRadius: "12px",
              background: "rgba(245, 158, 11, 0.1)",
              border: "1px solid rgba(245, 158, 11, 0.35)",
              display: "grid",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "12px", fontWeight: 800, color: "#92400e" }}>
              📵 Choisis le niveau « Pas de réponse » :
            </span>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {([1, 2, 3] as const).map(lvl => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => {
                    onSetNrpLevel(lvl);
                    setShowModalNrpOptions(false);
                  }}
                  style={{
                    flex: "1 1 90px",
                    padding: "8px 10px",
                    borderRadius: "9px",
                    border: "1px solid rgba(217, 119, 6, 0.35)",
                    background: lvl === 3 ? "#dc2626" : "#d97706",
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {lvl === 3 ? `🔴 NRP 3 (Dernière)` : `🟠 NRP ${lvl} (${lvl === 1 ? "1er" : "2e"} appel)`}
                </button>
              ))}
              {onWhatsApp && (
                <button
                  type="button"
                  onClick={() => {
                    const nextLvl = Math.min(3, (order.status === "ne_repond_pas" ? (order.nrpLevel ?? 1) : 0) + 1) as 1 | 2 | 3;
                    onSetNrpLevel(nextLvl);
                    onWhatsApp();
                    setShowModalNrpOptions(false);
                  }}
                  style={{
                    flex: "1 1 140px",
                    padding: "8px 10px",
                    borderRadius: "9px",
                    border: "1px solid rgba(16, 185, 129, 0.45)",
                    background: "#059669",
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  💬 NRP + Relance WhatsApp
                </button>
              )}
            </div>
          </div>
        )}
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

function CreateOrderModal({
  isSaving,
  onClose,
  onCreate,
}: {
  isSaving: boolean;
  onClose: () => void;
  onCreate: (payload: {
    customer: string;
    phone: string;
    productId?: string;
    product: string;
    quantity: number;
    total: number;
    color?: string;
    size?: string;
    delivery: "home" | "office";
    wilaya: string;
    commune: string;
    address?: string;
    note?: string;
    status?: OrderStatus;
  }) => void;
}) {
  const [catalog, setCatalog] = useState<Product[]>(() => getCatalogProducts());
  useEffect(() => {
    const sync = () => setCatalog(getCatalogProducts());
    window.addEventListener("miss-sensuelle-catalog-updated", sync);
    return () => window.removeEventListener("miss-sensuelle-catalog-updated", sync);
  }, []);

  const defaultProduct = catalog.find(p => p.id === "p-005") || catalog[0];

  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<OrderStatus>("confirmee");
  const [productId, setProductId] = useState(defaultProduct?.id || "p-005");
  const [productName, setProductName] = useState(defaultProduct?.name || "Extensions Cheveux Naturels");
  const [quantity, setQuantity] = useState<number>(defaultProduct?.id === "p-005" || defaultProduct?.packPrice ? 2 : 1);

  const selectedCatalogProduct = catalog.find(p => p.id === productId) || defaultProduct;
  const variantOptions1 = useMemo(
    () => getProductVariantOptions(selectedCatalogProduct),
    [selectedCatalogProduct]
  );
  const availableColors = useMemo(() => getColorsForProduct(selectedCatalogProduct), [selectedCatalogProduct]);

  const [variants, setVariants] = useState<PieceVariant[]>(() => [
    { color: availableColors[0] || "أسود طبيعي", size: getDefaultSizeForProduct(defaultProduct) },
    { color: availableColors[1] || availableColors[0] || "بني غامق", size: getDefaultSizeForProduct(defaultProduct) },
  ]);

  // 2nd Product (Cross-Sell)
  const secondDefault = catalog.find(p => p.id !== productId) || defaultProduct;
  const [hasSecondProduct, setHasSecondProduct] = useState<boolean>(false);
  const [secondProductId, setSecondProductId] = useState<string>(secondDefault?.id || "p-008");
  const [secondProductName, setSecondProductName] = useState<string>(secondDefault?.name || "");
  const [secondQuantity, setSecondQuantity] = useState<number>(1);
  const secondCatalogProduct = catalog.find(p => p.id === secondProductId) || secondDefault;
  const variantOptions2 = useMemo(
    () => getProductVariantOptions(secondCatalogProduct),
    [secondCatalogProduct]
  );
  const secondAvailableColors = useMemo(() => getColorsForProduct(secondCatalogProduct), [secondCatalogProduct]);
  const [secondVariants, setSecondVariants] = useState<PieceVariant[]>(() => [
    { color: secondAvailableColors[0] || "Noir", size: getDefaultSizeForProduct(secondDefault) },
  ]);

  const [wilaya, setWilaya] = useState<string>(abayaWilayas[15] || abayaWilayas[0] || "16 - الجزائر");
  const [commune, setCommune] = useState<string>(() => {
    const w = abayaWilayas[15] || abayaWilayas[0] || "";
    return (abayaCommunesByWilaya[w] ?? [])[0] || w;
  });
  const [delivery, setDelivery] = useState<"home" | "office">("home");
  const [address, setAddress] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const ecotrackFeesQuery = trpc.ecotrack.fees.useQuery(undefined, {
    retry: false,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const ratesQuery = trpc.store.shippingRates.useQuery(undefined, {
    retry: false,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const computedShippingFee = useMemo(() => {
    if (!wilaya) return 0;
    const ids = hasSecondProduct ? [productId, secondProductId] : [productId];
    const rates = pickPreferredShippingRates(undefined, ecotrackFeesQuery.data?.rates, ratesQuery.data?.rates);
    return resolveWilayaShippingFee(rates, wilaya, commune, delivery, ids) ?? 0;
  }, [wilaya, commune, delivery, productId, secondProductId, hasSecondProduct, ecotrackFeesQuery.data?.rates, ratesQuery.data?.rates]);

  const firstGoods = computeProductGoodsPrice(selectedCatalogProduct, quantity);
  const secondGoods = hasSecondProduct ? computeProductGoodsPrice(secondCatalogProduct, secondQuantity) : 0;
  const autoTotal = firstGoods + secondGoods + computedShippingFee;
  const [customTotal, setCustomTotal] = useState<number | null>(null);
  const effectiveTotal = customTotal !== null ? customTotal : autoTotal;

  const handleProductChange = (nextId: string) => {
    setProductId(nextId);
    setCustomTotal(null);
    const found = catalog.find(p => p.id === nextId);
    if (found) {
      setProductName(found.name);
      const nextColors = getColorsForProduct(found);
      const nextDefSize = getDefaultSizeForProduct(found);
      const nextQty = found.id === "p-005" || found.landingTemplate === "extensions" ? 2 : 1;
      setQuantity(nextQty);
      setVariants([
        { color: nextColors[0] || "Noir", size: nextDefSize },
        { color: nextColors[1] || nextColors[0] || "Noir", size: nextDefSize },
      ]);
    }
  };

  const handleQuantityChange = (nextQty: number) => {
    const safeQty = Math.max(1, Math.min(10, nextQty || 1));
    setQuantity(safeQty);
    setCustomTotal(null);
    const defSize = getDefaultSizeForProduct(selectedCatalogProduct);
    setVariants(prev => {
      const next = [...prev];
      while (next.length < safeQty) {
        const fallbackColor = availableColors[next.length % availableColors.length] || availableColors[0] || "Noir";
        next.push({ color: fallbackColor, size: defSize });
      }
      return next.slice(0, safeQty);
    });
  };

  const updatePieceVariant = (index: number, field: "color" | "size", val: string) => {
    setVariants(prev => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const handleSecondProductChange = (nextId: string) => {
    setSecondProductId(nextId);
    setCustomTotal(null);
    const found = catalog.find(p => p.id === nextId);
    if (found) {
      setSecondProductName(found.name);
      const cols = getColorsForProduct(found);
      const defSize = getDefaultSizeForProduct(found);
      setSecondVariants([{ color: cols[0] || "Noir", size: defSize }]);
    }
  };

  const handleSubmitCreate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const activeVariants1 = variants.slice(0, quantity);
    const color1 =
      quantity === 1
        ? activeVariants1[0]?.color || availableColors[0] || ""
        : activeVariants1.map((v, i) => `${i + 1}: ${v.color}`).join(" | ");
    const size1 =
      quantity === 1
        ? activeVariants1[0]?.size || getDefaultSizeForProduct(selectedCatalogProduct)
        : activeVariants1.map((v, i) => `${i + 1}: ${v.size}`).join(" | ");

    let finalProduct = quantity > 1 || hasSecondProduct ? `${productName} × ${quantity}` : productName;
    let finalQuantity = quantity;
    let finalColor = color1;
    let finalSize = size1;

    if (hasSecondProduct && secondCatalogProduct) {
      const activeVariants2 = secondVariants.slice(0, secondQuantity);
      const color2 =
        secondQuantity === 1
          ? activeVariants2[0]?.color || secondAvailableColors[0] || ""
          : activeVariants2.map((v, i) => `${i + 1}: ${v.color}`).join(" | ");
      const size2 =
        secondQuantity === 1
          ? activeVariants2[0]?.size || getDefaultSizeForProduct(secondCatalogProduct)
          : activeVariants2.map((v, i) => `${i + 1}: ${v.size}`).join(" | ");

      finalProduct = `${productName} × ${quantity} + ${secondProductName} × ${secondQuantity}`;
      finalQuantity = quantity + secondQuantity;
      finalColor = `[Art.1] ${color1} + [Art.2] ${color2}`;
      finalSize = `[Art.1] ${size1} + [Art.2] ${size2}`;
    }

    onCreate({
      customer: customer.trim(),
      phone: phone.trim(),
      productId,
      product: finalProduct,
      quantity: finalQuantity,
      total: Math.max(0, Math.round(Number(effectiveTotal) || 0)),
      color: finalColor,
      size: finalSize,
      delivery,
      wilaya: wilaya.trim(),
      commune: (commune || wilaya).trim(),
      address: (address || commune || wilaya).trim(),
      note: note.trim(),
      status,
    });
  };

  const arabicCommunes = abayaCommunesByWilaya[wilaya] ?? [];

  return (
    <div className="modal-layer">
      <button className="modal-backdrop" onClick={onClose} />
      <div className="order-modal" style={{ maxHeight: "92vh", overflowY: "auto", maxWidth: "720px" }}>
        <div
          className="modal-head"
          style={{
            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(59, 130, 246, 0.08))",
            padding: "14px 16px",
            borderRadius: "16px",
            border: "1px solid rgba(16, 185, 129, 0.28)",
          }}
        >
          <div>
            <span className="eyebrow" style={{ color: "#10b981", fontWeight: 900 }}>
              ✨ Studio Commande Directe (Téléphone / WhatsApp / Instagram)
            </span>
            <h2 style={{ margin: "2px 0 0" }}>Créer une nouvelle commande</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fermer">
            <X size={19} />
          </button>
        </div>

        <form className="order-edit-form" onSubmit={handleSubmitCreate} style={{ display: "grid", gap: "14px", marginTop: "12px" }}>
          {/* 1. INFOS CLIENTE */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "12px" }}>
            <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 800 }}>
              👤 Nom & Prénom de la cliente *
              <input
                value={customer}
                onChange={e => setCustomer(e.target.value)}
                placeholder="Ex: Sara Benali"
                required
              />
            </label>
            <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 800 }}>
              📞 Numéro de téléphone *
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Ex: 0550123456"
                required
              />
            </label>
          </div>

          {/* 2. SÉLECTION VISUELLE DU PRODUIT AVEC PHOTOS */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "16px",
              background: "var(--bg-elev, rgba(148, 163, 184, 0.08))",
              border: "1.5px solid var(--line, rgba(148, 163, 184, 0.25))",
              display: "grid",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: 900 }}>
                🛍️ 1. Choisis le produit (clique sur la photo ou dans la liste) :
              </span>
              <span style={{ fontSize: "11.5px", fontWeight: 800, color: "#10b981" }}>
                {catalog.length} produits disponibles
              </span>
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                overflowX: "auto",
                padding: "4px 2px 8px",
                scrollbarWidth: "thin",
              }}
            >
              {catalog.map(item => {
                const isSelected = item.id === productId;
                const heroThumb = item.image || item.gallery?.[0] || item.variantImages?.[0]?.image || "/manus-storage/doudoune-bg.jpg";
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleProductChange(item.id)}
                    style={{
                      flex: "0 0 132px",
                      borderRadius: "14px",
                      border: isSelected ? "2.5px solid #10b981" : "1.5px solid var(--line, #cbd5e1)",
                      background: isSelected
                        ? "linear-gradient(180deg, rgba(16, 185, 129, 0.14), rgba(16, 185, 129, 0.04))"
                        : "var(--input-bg, #fff)",
                      padding: "6px",
                      cursor: "pointer",
                      textAlign: "left",
                      position: "relative",
                      boxShadow: isSelected ? "0 6px 16px rgba(16, 185, 129, 0.22)" : "none",
                      transition: "all 0.16s ease",
                    }}
                  >
                    <div style={{ position: "relative", width: "100%", height: "86px", borderRadius: "10px", overflow: "hidden", background: "#0f172a" }}>
                      <img
                        src={heroThumb}
                        alt={item.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                      {isSelected && (
                        <span
                          style={{
                            position: "absolute",
                            top: 5,
                            right: 5,
                            background: "#10b981",
                            color: "#fff",
                            fontSize: "10px",
                            fontWeight: 900,
                            padding: "2px 7px",
                            borderRadius: "999px",
                          }}
                        >
                          ✓ Choisi
                        </span>
                      )}
                      {item.packPrice ? (
                        <span
                          style={{
                            position: "absolute",
                            bottom: 4,
                            left: 4,
                            background: "rgba(15, 23, 42, 0.85)",
                            color: "#fde047",
                            fontSize: "9.5px",
                            fontWeight: 800,
                            padding: "1px 6px",
                            borderRadius: "999px",
                          }}
                        >
                          🎁 Pack {formatDZD(item.packPrice)}
                        </span>
                      ) : null}
                    </div>
                    <div style={{ marginTop: "6px" }}>
                      <div
                        style={{
                          fontSize: "11.5px",
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          color: "var(--text, #0f172a)",
                        }}
                      >
                        {item.name}
                      </div>
                      <div style={{ fontSize: "11.5px", fontWeight: 900, color: "#10b981", marginTop: "1px" }}>
                        {formatDZD(item.price)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
              <label style={{ display: "grid", gap: "5px", fontSize: "12.5px", fontWeight: 700 }}>
                Produit sélectionné
                <select value={productId} onChange={e => handleProductChange(e.target.value)}>
                  {catalog.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({formatDZD(item.price)})
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: "5px", fontSize: "12.5px", fontWeight: 700 }}>
                Quantité / Offre Promo
                <select
                  value={quantity}
                  onChange={e => handleQuantityChange(Number(e.target.value))}
                  style={{
                    height: "44px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    padding: "0 12px",
                    fontWeight: 800,
                    fontSize: "13.5px",
                    backgroundColor: "var(--input-bg, #fff)",
                  }}
                >
                  {[1, 2, 3, 4, 5, 6].map(qty => {
                    const goods = computeProductGoodsPrice(selectedCatalogProduct, qty);
                    let label = `${qty} pièce${qty > 1 ? "s" : ""} — ${formatDZD(goods)}`;
                    if ((productId === "p-005" || selectedCatalogProduct?.landingTemplate === "extensions") && qty === 2) {
                      label = `2 pièces (Offre 1+1 Gratuite = ${formatDZD(goods)} 🎁)`;
                    } else if ((productId === "p-008" || selectedCatalogProduct?.packPrice) && qty === 2) {
                      label = `2 pièces (Pack Duo = ${formatDZD(goods)} 🔥)`;
                    }
                    return (
                      <option key={qty} value={qty}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>
          </div>

          {/* 3. VARIANTES DU PRODUIT PRINCIPAL AVEC PHOTOS CLIQUABLES */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "16px",
              background: "rgba(16, 185, 129, 0.06)",
              border: "1.5px solid rgba(16, 185, 129, 0.28)",
              display: "grid",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
              <span style={{ fontSize: "13px", fontWeight: 900, color: "#065f46" }}>
                🎨 2. Choix des variantes & photos ({quantity} pièce{quantity > 1 ? "s" : ""}) :
              </span>
              <small style={{ fontSize: "11.5px", fontWeight: 700, color: "#047857" }}>
                Clique sur la photo de la couleur/modèle pour chaque pièce
              </small>
            </div>

            {variants.slice(0, quantity).map((v, idx) => {
              const matchedOpt = variantOptions1.find(vo => vo.name === v.color) || variantOptions1[0];
              return (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gap: "8px",
                    background: "var(--input-bg, #fff)",
                    padding: "10px 12px",
                    borderRadius: "12px",
                    border: "1px solid rgba(16, 185, 129, 0.22)",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto",
                      gap: "10px",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {matchedOpt?.image ? (
                        <img
                          src={matchedOpt.image}
                          alt={v.color}
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 10,
                            objectFit: "cover",
                            border: "2px solid #10b981",
                          }}
                        />
                      ) : null}
                      <div>
                        <span style={{ fontWeight: 900, fontSize: "12.5px", display: "block" }}>
                          Pièce {idx + 1} {idx === 1 && quantity === 2 && (productId === "p-005" || selectedCatalogProduct?.landingTemplate === "extensions") ? "(🎁 Gratuite)" : ""}
                        </span>
                        <small style={{ fontSize: "11px", color: "#10b981", fontWeight: 800 }}>
                          {v.color} · {v.size}
                        </small>
                      </div>
                    </div>

                    <select
                      value={v.color}
                      onChange={e => updatePieceVariant(idx, "color", e.target.value)}
                      style={{ height: "38px", borderRadius: "9px", fontSize: "12.5px", fontWeight: 700 }}
                    >
                      {Array.from(new Set([v.color, ...availableColors].filter(Boolean))).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>

                    <select
                      value={v.size}
                      onChange={e => updatePieceVariant(idx, "size", e.target.value)}
                      style={{ height: "38px", borderRadius: "9px", fontSize: "12.5px", fontWeight: 700, minWidth: "90px" }}
                    >
                      {["Standard", "S", "M", "L", "XL", "XXL"].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Mini galerie de photos de variantes cliquables */}
                  {variantOptions1.some(vo => vo.image) && (
                    <div
                      style={{
                        display: "flex",
                        gap: "7px",
                        overflowX: "auto",
                        paddingTop: "4px",
                        paddingBottom: "2px",
                      }}
                    >
                      {variantOptions1.map((vo, vIdx) => {
                        const active = v.color === vo.name;
                        return (
                          <button
                            key={`${idx}-${vo.name}-${vIdx}`}
                            type="button"
                            onClick={() => updatePieceVariant(idx, "color", vo.name)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "4px 9px 4px 4px",
                              borderRadius: "10px",
                              border: active ? "2px solid #10b981" : "1px solid rgba(148, 163, 184, 0.35)",
                              background: active ? "rgba(16, 185, 129, 0.14)" : "transparent",
                              cursor: "pointer",
                              flexShrink: 0,
                              transition: "all 0.15s ease",
                            }}
                          >
                            {vo.image ? (
                              <img
                                src={vo.image}
                                alt={vo.name}
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: "50%",
                                  objectFit: "cover",
                                  border: active ? "1.5px solid #10b981" : "1px solid #cbd5e1",
                                }}
                              />
                            ) : null}
                            <span style={{ fontSize: "11.5px", fontWeight: active ? 900 : 700 }}>
                              {vo.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 4. OPTION 2ÈME PRODUIT CROSS-SELL AVEC PHOTOS */}
          {!hasSecondProduct ? (
            <button
              type="button"
              onClick={() => setHasSecondProduct(true)}
              style={{
                padding: "10px 14px",
                borderRadius: "12px",
                border: "1.5px dashed rgba(16, 185, 129, 0.5)",
                background: "rgba(16, 185, 129, 0.06)",
                color: "#059669",
                fontWeight: 800,
                fontSize: "13px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <Plus size={15} /> Ajouter un 2ème produit au même colis (Cross-Sell)
            </button>
          ) : (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "14px",
                background: "rgba(59, 130, 246, 0.06)",
                border: "1.5px solid rgba(59, 130, 246, 0.3)",
                display: "grid",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "12.5px", color: "#1d4ed8" }}>🛍️ 2ème Produit (Cross-Sell)</strong>
                <button
                  type="button"
                  onClick={() => {
                    setHasSecondProduct(false);
                    setCustomTotal(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#dc2626",
                    fontSize: "12px",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  ✕ Retirer
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <select value={secondProductId} onChange={e => handleSecondProductChange(e.target.value)}>
                  {catalog.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({formatDZD(item.price)})
                    </option>
                  ))}
                </select>
                <select
                  value={secondVariants[0]?.color || secondAvailableColors[0]}
                  onChange={e =>
                    setSecondVariants([
                      {
                        color: e.target.value,
                        size: secondVariants[0]?.size || getDefaultSizeForProduct(secondCatalogProduct),
                      },
                    ])
                  }
                >
                  {secondAvailableColors.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              {variantOptions2.some(vo => vo.image) && (
                <div style={{ display: "flex", gap: "7px", overflowX: "auto", paddingBottom: "2px" }}>
                  {variantOptions2.map((vo, vIdx) => {
                    const active = (secondVariants[0]?.color || secondAvailableColors[0]) === vo.name;
                    return (
                      <button
                        key={`sec-${vo.name}-${vIdx}`}
                        type="button"
                        onClick={() =>
                          setSecondVariants([
                            {
                              color: vo.name,
                              size: secondVariants[0]?.size || getDefaultSizeForProduct(secondCatalogProduct),
                            },
                          ])
                        }
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "4px 9px 4px 4px",
                          borderRadius: "10px",
                          border: active ? "2px solid #2563eb" : "1px solid rgba(148, 163, 184, 0.35)",
                          background: active ? "rgba(37, 99, 235, 0.12)" : "var(--input-bg, #fff)",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        {vo.image && (
                          <img
                            src={vo.image}
                            alt={vo.name}
                            style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }}
                          />
                        )}
                        <span style={{ fontSize: "11.5px", fontWeight: 800 }}>{vo.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 5. WILAYA & COMMUNE */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
            <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              📍 Wilaya *
              <select
                value={wilaya}
                onChange={e => {
                  const nextW = e.target.value;
                  setWilaya(nextW);
                  setCustomTotal(null);
                  const nextList = abayaCommunesByWilaya[nextW];
                  setCommune(nextList?.[0] || nextW);
                }}
                required
              >
                {abayaWilayas.map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              🏘️ Commune *
              {arabicCommunes.length > 0 ? (
                <select value={commune} onChange={e => setCommune(e.target.value)} required>
                  {arabicCommunes.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              ) : (
                <input value={commune} onChange={e => setCommune(e.target.value)} required />
              )}
            </label>
          </div>

          {/* 6. LIVRAISON, STATUT INITIAL & TOTAL */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
            <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              Type de livraison
              <select
                value={delivery}
                onChange={e => {
                  setDelivery(e.target.value as "home" | "office");
                  setCustomTotal(null);
                }}
              >
                <option value="home">🏠 À domicile</option>
                <option value="office">🏢 Stop Desk / Bureau</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              Statut initial
              <select value={status} onChange={e => setStatus(e.target.value as OrderStatus)}>
                <option value="confirmee">🟢 Confirmée (Prête à expédier)</option>
                <option value="nouvelle">🟡 Nouvelle (En attente d'appel)</option>
                <option value="reportee">🔵 Reportée</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              <span style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Total (DA)</span>
                {customTotal !== null && (
                  <button
                    type="button"
                    onClick={() => setCustomTotal(null)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#2563eb",
                      fontSize: "11px",
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                    }}
                  >
                    Auto ({formatDZD(autoTotal)})
                  </button>
                )}
              </span>
              <input
                type="number"
                min={0}
                value={effectiveTotal}
                onChange={e => setCustomTotal(Number(e.target.value))}
                style={{ fontWeight: 900, color: "#10b981", fontSize: "15px" }}
                required
              />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
            <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              Adresse (optionnel)
              <input
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Adresse / précision"
              />
            </label>
            <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              Note (optionnel)
              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Ex: Commande WhatsApp / Instagram"
              />
            </label>
          </div>

          {/* RÉCAPITULATIF VISUEL DE LA COMMANDE */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(15, 23, 42, 0.04))",
              border: "1.5px dashed rgba(16, 185, 129, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {selectedCatalogProduct?.image && (
                <img
                  src={selectedCatalogProduct.image}
                  alt={selectedCatalogProduct.name}
                  style={{ width: 46, height: 46, borderRadius: 10, objectFit: "cover", border: "1.5px solid #10b981" }}
                />
              )}
              <div>
                <strong style={{ fontSize: "13px", display: "block" }}>
                  {productName} × {quantity} {hasSecondProduct ? `+ ${secondProductName} × ${secondQuantity}` : ""}
                </strong>
                <small style={{ fontSize: "11.5px", color: "var(--muted, #64748b)", fontWeight: 700 }}>
                  Articles : {formatDZD(firstGoods + secondGoods)} · Livraison : {computedShippingFee === 0 ? "Gratuite 🎉" : formatDZD(computedShippingFee)}
                </small>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <small style={{ fontSize: "11px", fontWeight: 700, display: "block", color: "var(--muted, #64748b)" }}>
                Total à encaisser
              </small>
              <strong style={{ fontSize: "18px", fontWeight: 900, color: "#10b981" }}>
                {formatDZD(effectiveTotal)}
              </strong>
            </div>
          </div>

          <button
            type="submit"
            className="button button-gradient full"
            disabled={isSaving}
            style={{ marginTop: "2px", height: "50px", borderRadius: "14px", fontSize: "15.5px", fontWeight: 900 }}
          >
            <Plus size={18} /> {isSaving ? "Création en cours…" : "Créer et enregistrer la commande"}
          </button>
        </form>
      </div>
    </div>
  );
}
