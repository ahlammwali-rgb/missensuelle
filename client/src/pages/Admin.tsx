import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Bell, ChevronDown, ClipboardList, Copy, Download, ExternalLink, Facebook, FileSpreadsheet, Filter, History, ImagePlus, LayoutDashboard, MessageCircle, Moon, MoreHorizontal, Package, PackageCheck, Pencil, Phone, Plus, RefreshCw, RotateCcw, Save, Search, Settings2, Smartphone, Sun, Trash2, Truck, TrendingUp, Upload, UserCheck, Users, X } from "lucide-react";
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
import { StaffPanel } from "@/components/StaffPanel";
import { OrderHistoryModal } from "@/components/OrderHistoryModal";
import {
  PostponeOrderModal,
  CancelOrderModal,
  PostponedReminderPopup,
} from "@/components/OrderStatusActionModal";
import { MobileAppCard, showPushNotification } from "@/components/MobileAppCard";
import { playChaChingSound, playUrgentAlertSound, playVictoryDeliveredSound, playAbandonedAlertSound } from "@/lib/sound";
import { loadRealOrders, orderMatchesPeriod } from "@/lib/admin-orders";

const actionLabels: { status: OrderStatus; label: string }[] = [{ status: "confirmee", label: "Confirmer" }, { status: "annulee", label: "Annuler" }, { status: "reportee", label: "Reporter" }, { status: "ne_repond_pas", label: "Pas de réponse" }, { status: "transferee", label: "Transférer" }];
type AdminSection = "dashboard" | "abandoned" | "catalogue" | "settings" | "ecom" | "sheet" | "transferred" | "returns" | "staff";

type DashboardOrder = Order;

const emptyProduct: Product = { id: "", slug: "", name: "", category: "mode", categoryLabel: "Mode femme", price: 0, oldPrice: 0, badge: "Nouveau", description: "", details: [], colors: [], image: "", gallery: [], arName: "", arCategoryLabel: "", arDescription: "", accent: "#9B82F6", stock: 0 };

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
  const [searchPopupQuery, setSearchPopupQuery] = useState("");
  const ordersQuery = trpc.admin.orders.useQuery(undefined, { refetchInterval: 10000, refetchIntervalInBackground: true, refetchOnWindowFocus: true, retry: false });
  const abandonedQuery = trpc.admin.abandonedOrders.useQuery(undefined, { refetchInterval: 10000, refetchIntervalInBackground: true, refetchOnWindowFocus: true, retry: false });
  const utils = trpc.useUtils();
  const updateOrderStatus = trpc.admin.updateOrderStatus.useMutation();
  const recordOrderInteraction = trpc.admin.recordOrderInteraction.useMutation();
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

  // E-com status & carrier batch tracking query for live parcel events
  const ecomStatusQuery = trpc.ecom.status.useQuery(undefined, {
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const shipments = useMemo(() => ecomStatusQuery.data?.shipments || {}, [ecomStatusQuery.data]);

  const activeTrackingNumbers = useMemo(() => {
    const list: string[] = [];
    for (const sh of Object.values(shipments)) {
      if (sh?.tracking) list.push(sh.tracking);
    }
    return list.slice(0, 100);
  }, [shipments]);

  const trackingBatchQuery = trpc.ecom.trackBatch.useQuery(
    { trackings: activeTrackingNumbers },
    {
      enabled: activeTrackingNumbers.length > 0,
      refetchInterval: 30000,
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: true,
      retry: false,
    }
  );

  const trackingMap = (trackingBatchQuery.data || {}) as Record<string, { situation?: string }>;
  const knownSituationsRef = useRef<Map<string, string>>(new Map());
  const initialSituationsLoadedRef = useRef(false);

  useEffect(() => {
    if (!trackingBatchQuery.data || Object.keys(trackingMap).length === 0) return;

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

  const saveOrderDetails = (dbId: number, updates: Omit<Parameters<typeof updateOrderDetails.mutate>[0], "id">) => {
    updateOrderDetails.mutate(
      { id: dbId, ...updates },
      {
        onSuccess: async updated => {
          await utils.admin.orders.invalidate();
          await utils.admin.staffData.invalidate();
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

  return <div className="admin-shell"><aside className="admin-sidebar"><Link href="/" className="wordmark admin-wordmark"><span className="wordmark-star">✦</span><span>miss</span><em>sensuelle</em></Link><nav className="admin-mobile-nav" aria-label="Navigation admin mobile"><button type="button" className={section === "dashboard" && !isMoreMenuOpen ? "active" : ""} aria-current={section === "dashboard" ? "page" : undefined} onClick={() => { go("dashboard"); setIsMoreMenuOpen(false); }}><LayoutDashboard size={17} /><span>Dashboard</span></button><button type="button" className={section === "transferred" && !isMoreMenuOpen ? "active" : ""} aria-current={section === "transferred" ? "page" : undefined} onClick={() => { go("transferred"); setIsMoreMenuOpen(false); }}><Truck size={17} /><span>Transférées</span>{transferredCount > 0 && <span className="nav-count-badge">{transferredCount}</span>}</button><button type="button" className={section === "staff" && !isMoreMenuOpen ? "active" : ""} aria-current={section === "staff" ? "page" : undefined} onClick={() => { go("staff"); setIsMoreMenuOpen(false); }}><Users size={17} /><span>Équipe</span></button><button type="button" className="btn-nav-search" onClick={() => { setIsSearchOpen(true); setIsMoreMenuOpen(false); }} aria-label="Recherche rapide de commande"><Search size={17} /><span>Recherche</span></button><button type="button" className={isMoreMenuOpen ? "active" : ""} onClick={() => setIsMoreMenuOpen(prev => !prev)} aria-label="Plus de menus"><MoreHorizontal size={17} /><span>Menu</span></button></nav><div className="admin-user"><div className="admin-avatar">{currentActorName.slice(0, 2).toUpperCase()}</div><div><strong>{currentActorName}</strong><span>{isOwner ? "Administratrice" : "Confirmateur"}</span></div></div><nav className="admin-nav"><span className="admin-nav-label">Workspace</span><button className={section === "dashboard" ? "active" : ""} onClick={() => go("dashboard")}><LayoutDashboard size={18} />Vue d'ensemble</button><button className={section === "dashboard" ? "active" : ""} onClick={() => go("dashboard")}><ClipboardList size={18} />Commandes Actives <b>{orders.filter(order => order.status !== "transferee" && order.status === "nouvelle").length}</b></button><button className={section === "staff" ? "active" : ""} onClick={() => go("staff")}><Users size={18} />Confirmateurs & Salaires</button><button className={section === "transferred" ? "active" : ""} onClick={() => go("transferred")}><Truck size={18} />Transférées <b className="nav-badge-purple">{transferredCount}</b></button><button className={section === "abandoned" ? "active" : ""} onClick={() => go("abandoned")}><ClipboardList size={18} />Commandes abandonnées <b>{abandonedCount === undefined ? "—" : abandonedCount}</b></button><button className={section === "sheet" ? "active" : ""} onClick={() => go("sheet")}><FileSpreadsheet size={18} />Google Sheets</button><button className={section === "ecom" ? "active" : ""} onClick={() => go("ecom")}><Truck size={18} />E-com Delivery <b>{orders.filter(order => order.status === "confirmee").length}</b></button><button className={section === "returns" ? "active" : ""} onClick={() => go("returns")}><RotateCcw size={18} />Retours & Stocks</button><button className={section === "catalogue" ? "active" : ""} onClick={() => go("catalogue")}><Package size={18} />Catalogue <b>{getCatalogProducts().length}</b></button><button onClick={() => go("catalogue")}><Users size={18} />Stocks</button><span className="admin-nav-label">Réglages</span><button onClick={() => go("staff")}><BarChart3 size={18} />Rapports & Performances</button><button className={section === "settings" ? "active" : ""} onClick={() => go("settings")}><Settings2 size={18} />Pixels & paramètres</button></nav><Link href="/" className="back-store">← Retour à la boutique</Link></aside><main className="admin-main"><header className="admin-topbar"><div><span className="eyebrow">{new Intl.DateTimeFormat("fr-DZ", { timeZone: "Africa/Algiers", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}</span><h1>{section === "staff" ? "Confirmateurs, Salaires & Journal d'Activité" : section === "transferred" ? "Commandes Transférées & Suivi" : section === "returns" ? "Gestion des Retours & Stocks" : section === "catalogue" ? "Catalogue produits" : section === "ecom" ? "E-com Delivery" : section === "sheet" ? "Google Sheets" : section === "settings" ? "Pixels & paramètres" : section === "abandoned" ? "Commandes abandonnées" : `Bonjour, ${currentActorName}`} <span>✦</span></h1></div><div className="admin-top-actions">
  <button
    type="button"
    className="neo-darkmode-btn"
    onClick={() => go("staff")}
    title="Gérer les confirmateurs, salaires, commissions et appels"
    style={{ background: "rgba(16, 185, 129, 0.14)", border: "1px solid rgba(16, 185, 129, 0.35)", cursor: "pointer" }}
  >
    <Users size={14} style={{ color: "#10b981" }} />
    <span className="neo-btn-label" style={{ color: "#10b981", fontWeight: 700 }}>Confirmateurs</span>
  </button>
  <button
    type="button"
    className="neo-darkmode-btn"
    onClick={() => go("settings")}
    title="Installer l'application mobile & alertes sonores"
    style={{ background: "rgba(139, 92, 246, 0.15)", border: "1px solid rgba(139, 92, 246, 0.35)", cursor: "pointer" }}
  >
    <Smartphone size={14} style={{ color: "#a855f7" }} />
    <span className="neo-btn-label" style={{ color: "#a855f7", fontWeight: 600 }}>App Mobile</span>
  </button>
  <button type="button" className="neo-darkmode-btn" onClick={toggleTheme} title={theme === "dark" ? "Mode Clair" : "Mode Sombre Neo Waw"} aria-label="Basculer Mode Sombre Neo">
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
</button><button className="icon-button" aria-label="Notifications"><Bell size={19} />{orders.some(order => order.status === "nouvelle") && <i />}</button><div className="admin-profile"><div className="admin-avatar small">{currentActorName.slice(0, 2).toUpperCase()}</div><ChevronDown size={16} /></div></div></header><div className="admin-content">{section === "staff" ? <StaffPanel orders={serverOrders} notify={notify} onOpenOrderHistory={order => setHistoryOrderId(order.id)} onOpenOrderEdit={order => setSelected(order)} /> : section === "transferred" ? <TransferredOrdersPanel orders={serverOrders} notify={notify} onUpdateStatus={updateStatus} onRefreshOrders={() => void utils.admin.orders.invalidate()} /> : section === "returns" ? <ReturnsPanel orders={serverOrders} notify={notify} onRefreshOrders={() => void utils.admin.orders.invalidate()} /> : section === "catalogue" ? <CatalogPanel notify={notify} /> : section === "sheet" ? <GoogleSheetPanel notify={notify} onOrdersUpdated={() => void utils.admin.orders.invalidate()} /> : section === "ecom" ? <EcomDeliveryPanel orders={serverOrders} notify={notify} onShipped={() => void utils.admin.orders.invalidate()} /> : section === "settings" ? <TrackingSettings notify={notify} /> : section === "abandoned" ? <AbandonedOrders items={abandonedQuery.data ?? []} isLoading={abandonedQuery.isLoading} isError={Boolean(abandonedQuery.error)} onRetry={() => void abandonedQuery.refetch()} onConverted={() => void utils.admin.orders.invalidate()} /> : ordersQuery.isLoading ? <section className="admin-data-state" role="status"><span className="eyebrow">Données enregistrées</span><h2>Chargement des commandes…</h2><p>La vue admin attend la réponse sécurisée du serveur.</p></section> : ordersQuery.error ? <section className="admin-data-state admin-data-error" role="alert"><span className="eyebrow">Données indisponibles</span><h2>Les commandes n’ont pas pu être chargées.</h2><p>Une erreur serveur ou réseau est survenue. Les données ne sont pas remplacées par une liste vide.</p><button type="button" className="button button-gradient" onClick={() => void ordersQuery.refetch()}><RefreshCw size={16} /> Réessayer</button></section> : <AdminDashboard orders={periodOrders} filtered={filtered} activeStatus={activeStatus} setActiveStatus={setActiveStatus} query={query} setQuery={setQuery} period={period} setPeriod={setPeriod} onSelect={order => setSelected(orderById.get(order.id) ?? null)} onCall={callCustomer} onCallOrder={handleCallOrder} onWhatsAppOrder={handleWhatsAppOrder} onOpenHistory={order => setHistoryOrderId(order.id)} onOpenPostponeModal={order => setPostponeOrderId(order.id)} onOpenCancelModal={order => setCancelOrderId(order.id)} onSetNrpLevel={(id, lvl) => updateStatusWithMeta(id, "ne_repond_pas", { nrpLevel: lvl })} onExport={exportOrders} onUpdateStatus={updateStatus} stockPanel={<StockPanel onManageCatalog={() => go("catalogue")} onOpenSheet={() => go("sheet")} />} />}</div></main>{isSearchOpen && (
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
          className={`more-sheet-item ${section === "staff" ? "active" : ""}`}
          onClick={() => { go("staff"); setIsMoreMenuOpen(false); }}
        >
          <div className="more-item-icon icon-emerald">
            <Users size={20} />
          </div>
          <div className="more-item-text">
            <strong>Confirmateurs & Salaires</strong>
            <small>Équipe, commissions, appels & journal live</small>
          </div>
        </button>

        <button
          type="button"
          className={`more-sheet-item ${section === "ecom" ? "active" : ""}`}
          onClick={() => { go("ecom"); setIsMoreMenuOpen(false); }}
        >
          <div className="more-item-icon icon-blue">
            <PackageCheck size={20} />
          </div>
          <div className="more-item-text">
            <strong>E-com Delivery</strong>
            <small>Expédition et suivi transporteur</small>
          </div>
        </button>

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
            <Smartphone size={20} />
          </div>
          <div className="more-item-text">
            <strong>App Mobile & Paramètres</strong>
            <small>Installer sur smartphone & alertes Cha-Ching</small>
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
)}{selected && <OrderModal order={selected} isSaving={updateOrderDetails.isPending} onClose={() => setSelected(null)} onCall={() => handleCallOrder(selected)} onWhatsApp={() => handleWhatsAppOrder(selected)} onOpenHistory={() => setHistoryOrderId(selected.id)} onOpenPostpone={() => setPostponeOrderId(selected.id)} onOpenCancel={() => setCancelOrderId(selected.id)} onSetNrpLevel={lvl => updateStatusWithMeta(selected.id, "ne_repond_pas", { nrpLevel: lvl })} onUpdate={updateStatus} onSaveDetails={saveOrderDetails} onDelete={handleDeleteOrder} onCopy={() => { void copyOrderDetails(selected, notify); setSelected(null); }} />}{activeHistoryOrder && (
  <OrderHistoryModal
    order={activeHistoryOrder}
    onClose={() => setHistoryOrderId(null)}
    onCall={handleCallOrder}
    onWhatsApp={handleWhatsAppOrder}
  />
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
)}{duePostponedOrders.length > 0 && (
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
  const isDoudoune = product.id === "p-008" || product.slug.includes("doudoune") || product.name.toLowerCase().includes("doudoune");
  if (isDoudoune) return ["أزرق سماوي", "أبيض", "أسود"];
  const isExtensions = product.id === "p-005" || product.slug.includes("extensions") || product.category === "extensions";
  if (isExtensions) {
    return ["شاتان فونس", "أسود", "بني غامق", "شاتان روكس", "أشقر فاتح", "نور بالياح غري"];
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
  const isDoudoune = product.id === "p-008" || product.slug.includes("doudoune") || product.name.toLowerCase().includes("doudoune");
  if (isDoudoune) {
    const pairs = Math.floor(qty / 2);
    const singles = qty % 2;
    return (pairs * 12900) + (singles * 7600);
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
  onUpdate: (id: string, status: OrderStatus) => void;
  onSaveDetails: (dbId: number, updates: OrderDetailsPayload) => void;
  onDelete: (dbId: number) => void;
  onCopy: () => void;
}) {
  const catalog = useMemo(() => getCatalogProducts(), []);
  const initialParsed = useMemo(() => parseInitialOrderItems(order, catalog), [order, catalog]);

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
  const [wilaya, setWilaya] = useState(order.wilaya);
  const [commune, setCommune] = useState(order.commune);
  const [address, setAddress] = useState(order.address || "");
  const [note, setNote] = useState(order.note || "");

  const selectedCatalogProduct = catalog.find(p => p.id === productId) || initialParsed.prod1;
  const isDoudoune = selectedCatalogProduct?.id === "p-008" || selectedCatalogProduct?.slug.includes("doudoune") || selectedCatalogProduct?.name.toLowerCase().includes("doudoune");

  const secondCatalogProduct = catalog.find(p => p.id === secondProductId) || initialParsed.prod2;
  const isSecondDoudoune = secondCatalogProduct?.id === "p-008" || secondCatalogProduct?.slug.includes("doudoune") || secondCatalogProduct?.name.toLowerCase().includes("doudoune");

  const availableColors = useMemo(() => getColorsForProduct(selectedCatalogProduct), [selectedCatalogProduct]);
  const secondAvailableColors = useMemo(() => getColorsForProduct(secondCatalogProduct), [secondCatalogProduct]);

  // Conserve le frais de livraison d'origine de la commande
  const initialShippingFee = useMemo(() => {
    const initialGoods1 = computeProductGoodsPrice(initialParsed.prod1, initialParsed.qty1);
    const initialGoods2 = initialParsed.hasSecond
      ? computeProductGoodsPrice(initialParsed.prod2, initialParsed.qty2)
      : 0;
    const diff = order.total - (initialGoods1 + initialGoods2);
    return diff > 0 ? diff : 0;
  }, [initialParsed, order.total]);

  const [shippingFee, setShippingFee] = useState<number>(initialShippingFee);

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

  const allWilayas = useMemo(() => Array.from(new Set([order.wilaya, ...abayaWilayas, ...wilayas].filter(Boolean))), [order.wilaya]);
  const arabicCommunes = abayaCommunesByWilaya[wilaya] ?? [];

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
      const currentShip = isFree ? 0 : shippingFee;
      if (isFree) setShippingFee(0);
      setTotal(recomputeCombinedTotal(found, quantity, hasSecondProduct, secondCatalogProduct, secondQuantity, currentShip, crossSellDiscount));
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
    setTotal(recomputeCombinedTotal(selectedCatalogProduct, quantity, true, found, 1, shippingFee, crossSellDiscount));
  };

  const removeSecondProduct = () => {
    setHasSecondProduct(false);
    setCrossSellDiscount(0);
    setTotal(recomputeCombinedTotal(selectedCatalogProduct, quantity, false, secondCatalogProduct, secondQuantity, shippingFee, 0));
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
      setTotal(recomputeCombinedTotal(selectedCatalogProduct, quantity, true, found, secondQuantity, shippingFee, crossSellDiscount));
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
    const nextShip = freeShip ? 0 : initialShippingFee;
    setShippingFee(nextShip);
    setCrossSellDiscount(discountAmount);
    setTotal(recomputeCombinedTotal(selectedCatalogProduct, quantity, hasSecondProduct, secondCatalogProduct, secondQuantity, nextShip, discountAmount));
  };

  const firstGoods = computeProductGoodsPrice(selectedCatalogProduct, quantity);
  const secondGoods = hasSecondProduct ? computeProductGoodsPrice(secondCatalogProduct, secondQuantity) : 0;
  const currentGoods = Math.max(0, firstGoods + secondGoods - crossSellDiscount);

  const handleSubmitEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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

    onSaveDetails(order.dbId, {
      customer: customer.trim() || order.customer,
      phone: phone.trim() || order.phone,
      productId,
      product: finalProduct,
      quantity: finalQuantity,
      total: Number(total) || 0,
      color: finalColor.trim(),
      size: finalSize.trim(),
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
                <History size={15} />Historique ({order.history?.length || 1})
              </button>
            )}
          </div>
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
                  const isSelected = crossSellDiscount === offer.discount && (offer.freeShip ? shippingFee === 0 : shippingFee === initialShippingFee);
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
            <div style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Total commande (DA)</span>
                <button
                  type="button"
                  onClick={() => setTotal(currentGoods + shippingFee)}
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
                  title="Recalculer selon le tarif catalogue et frais de livraison"
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
                  <> (Livraison incluse / 0 DA)</>
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

          <button type="submit" className="button button-gradient full" disabled={isSaving} style={{ marginTop: "6px", height: "48px", borderRadius: "14px", fontSize: "15px" }}>
            <Save size={17} /> {isSaving ? "Enregistrement…" : "Enregistrer les modifications"}
          </button>
        </form>

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
