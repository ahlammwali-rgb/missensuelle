import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  Clock,
  PackageCheck,
  ShoppingBag,
  Truck,
  X,
} from "lucide-react";
import type { CheckoutOrder, StaffActivityLog } from "@shared/checkout";

export interface AdminNotificationItem {
  id: string;
  kind: "victory" | "new_order" | "urgent" | "transferred" | "activity";
  title: string;
  body: string;
  timestamp: string;
  tsMs: number;
  orderId?: string;
  targetSection: "dashboard" | "transferred" | "abandoned";
  statusLabel: string;
  amountDzd?: number;
}

const READ_IDS_KEY = "ms_notif_read_ids_v1";
const MARK_ALL_TS_KEY = "ms_notif_mark_all_ts_v1";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function readStoredReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function readStoredMarkAllTs(): number {
  try {
    const raw = Number(localStorage.getItem(MARK_ALL_TS_KEY) || "0");
    return Number.isFinite(raw) ? raw : 0;
  } catch {
    return 0;
  }
}

function persistReadIds(ids: Set<string>) {
  try {
    const compact = Array.from(ids).slice(-250);
    localStorage.setItem(READ_IDS_KEY, JSON.stringify(compact));
  } catch {
    // ignore storage quota errors
  }
}

function parseTimestampMs(raw?: string): number {
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRelativeFr(tsMs: number): string {
  if (!tsMs) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - tsMs) / 1000));
  if (diffSec < 60) return "À l'instant";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Il y a ${diffHours} h`;
  return new Intl.DateTimeFormat("fr-DZ", {
    timeZone: "Africa/Algiers",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(tsMs));
}

export function buildAdminNotifications(
  orders: CheckoutOrder[],
  activityLogs: StaffActivityLog[] = [],
  liveItems: AdminNotificationItem[] = []
): AdminNotificationItem[] {
  const byId = new Map<string, AdminNotificationItem>();
  const now = Date.now();
  const minRelevantMs = now - 30 * 24 * 60 * 60 * 1000;

  for (const live of liveItems) {
    byId.set(live.id, live);
  }

  const orderMap = new Map<string, CheckoutOrder>();
  for (const order of orders) {
    orderMap.set(order.id, order);
    const createdMs = parseTimestampMs(order.createdAt);
    const deliveredMs = parseTimestampMs(order.deliveredAt || order.createdAt);

    if (order.isDelivered && deliveredMs >= minRelevantMs) {
      const id = `delivered:${order.id}`;
      byId.set(id, {
        id,
        kind: "victory",
        title: `Colis livré · ${order.id}`,
        body: `${order.customer || "Cliente"} · ${order.wilaya || "Algérie"}`,
        timestamp: order.deliveredAt || order.createdAt,
        tsMs: deliveredMs,
        orderId: order.id,
        targetSection: "transferred",
        statusLabel: "Livré",
        amountDzd: order.total,
      });
    } else if (order.status === "nouvelle" && createdMs >= minRelevantMs) {
      const id = `new:${order.id}`;
      byId.set(id, {
        id,
        kind: "new_order",
        title: `Nouvelle commande · ${order.id}`,
        body: `${order.customer || "Cliente"} (${order.phone}) · ${order.product || "Produit"} · ${order.wilaya}`,
        timestamp: order.createdAt,
        tsMs: createdMs,
        orderId: order.id,
        targetSection: "dashboard",
        statusLabel: "Nouvelle",
        amountDzd: order.total,
      });
    } else if (order.status === "reportee" && order.postponedUntil) {
      const dueMs = parseTimestampMs(order.postponedUntil);
      if (dueMs > 0 && dueMs <= now && dueMs >= minRelevantMs) {
        const id = `due:${order.id}:${order.postponedUntil}`;
        byId.set(id, {
          id,
          kind: "urgent",
          title: `Rappel reportée · ${order.id}`,
          body: `Rappeler ${order.customer || "Cliente"} (${order.phone}) · ${order.wilaya}`,
          timestamp: order.postponedUntil,
          tsMs: dueMs,
          orderId: order.id,
          targetSection: "dashboard",
          statusLabel: "Reportée",
          amountDzd: order.total,
        });
      }
    } else if (order.status === "transferee" && createdMs >= minRelevantMs && !order.isDelivered) {
      const id = `transferred:${order.id}`;
      if (!byId.has(id)) {
        byId.set(id, {
          id,
          kind: "transferred",
          title: `Transférée · ${order.id}`,
          body: `${order.customer || "Cliente"} · ${order.carrier ? order.carrier.toUpperCase() : "Livreur"} · ${order.wilaya}`,
          timestamp: order.createdAt,
          tsMs: createdMs,
          orderId: order.id,
          targetSection: "transferred",
          statusLabel: "Transférée",
          amountDzd: order.total,
        });
      }
    }
  }

  for (const log of activityLogs) {
    const tsMs = parseTimestampMs(log.at);
    if (!tsMs || tsMs < minRelevantMs) continue;
    const summaryLower = log.summary.toLowerCase();
    const isDeliveredAction = summaryLower.includes("livré");
    const isCreatedAction = summaryLower.includes("créée") || summaryLower.includes("nouvelle");
    const oid = log.orderId || "";
    if (oid && isDeliveredAction && byId.has(`delivered:${oid}`)) continue;
    if (oid && isCreatedAction && byId.has(`new:${oid}`)) continue;

    const matchedOrder = oid ? orderMap.get(oid) : undefined;
    const isTransferredAction = summaryLower.includes("transfér");
    const targetSection: "dashboard" | "transferred" =
      isDeliveredAction ||
      isTransferredAction ||
      matchedOrder?.status === "transferee" ||
      Boolean(matchedOrder?.carrier) ||
      Boolean(matchedOrder?.isDelivered)
        ? "transferred"
        : "dashboard";

    const kind: AdminNotificationItem["kind"] =
      isDeliveredAction
        ? "victory"
        : isCreatedAction
          ? "new_order"
          : isTransferredAction
            ? "transferred"
            : log.warning ||
                log.type === "postponed" ||
                summaryLower.includes("annul") ||
                summaryLower.includes("répond pas") ||
                summaryLower.includes("report")
              ? "urgent"
              : "activity";

    const id = `log:${log.id}`;
    if (!byId.has(id)) {
      byId.set(id, {
        id,
        kind,
        title: `${matchedOrder?.isDelivered ? "Livré · " : ""}${oid || log.actorName || "Activité"}`,
        body: log.summary,
        timestamp: log.at,
        tsMs,
        orderId: oid || undefined,
        targetSection,
        statusLabel: matchedOrder?.isDelivered
          ? "Livré"
          : matchedOrder?.status === "transferee"
            ? "Transférée"
            : matchedOrder?.status === "confirmee"
              ? "Confirmée"
              : log.actorName || "Suivi",
        amountDzd: matchedOrder?.total,
      });
    }
  }

  return Array.from(byId.values())
    .sort((a, b) => b.tsMs - a.tsMs)
    .slice(0, 40);
}

export function useAdminNotifications(
  orders: CheckoutOrder[],
  activityLogs: StaffActivityLog[] = [],
  liveItems: AdminNotificationItem[] = []
) {
  const [readIds, setReadIds] = useState<Set<string>>(readStoredReadIds);
  const [markAllTs, setMarkAllTs] = useState<number>(readStoredMarkAllTs);

  const items = useMemo(
    () => buildAdminNotifications(orders, activityLogs, liveItems),
    [orders, activityLogs, liveItems]
  );

  const recentThresholdMs = Date.now() - SEVEN_DAYS_MS;

  const isUnread = (item: AdminNotificationItem): boolean => {
    if (readIds.has(item.id)) return false;
    if (item.tsMs > 0 && item.tsMs <= markAllTs) return false;
    if (item.kind === "new_order" || item.kind === "urgent") return true;
    return item.tsMs >= recentThresholdMs;
  };

  const unreadCount = useMemo(
    () => items.reduce((acc, item) => (isUnread(item) ? acc + 1 : acc), 0),
    [items, readIds, markAllTs]
  );

  const markAsRead = (id: string) => {
    setReadIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      persistReadIds(next);
      return next;
    });
  };

  const markAllAsRead = () => {
    const now = Date.now();
    setMarkAllTs(now);
    try {
      localStorage.setItem(MARK_ALL_TS_KEY, String(now));
    } catch {
      // ignore storage errors
    }
    setReadIds(prev => {
      const next = new Set(prev);
      for (const item of items) next.add(item.id);
      persistReadIds(next);
      return next;
    });
  };

  return {
    items,
    unreadCount,
    isUnread,
    markAsRead,
    markAllAsRead,
  };
}

export function AdminNotificationCenter({
  open,
  onClose,
  items,
  unreadCount,
  isUnread,
  onMarkAsRead,
  onMarkAllAsRead,
  onSelectNotification,
}: {
  open: boolean;
  onClose: () => void;
  items: AdminNotificationItem[];
  unreadCount: number;
  isUnread: (item: AdminNotificationItem) => boolean;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onSelectNotification: (item: AdminNotificationItem) => void;
}) {
  const [filterMode, setFilterMode] = useState<"all" | "unread">("all");
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest(".gcome-notif-bell") || target.closest(".gcome-mobile-bell-btn")) return;
      if (panelRef.current && !panelRef.current.contains(target)) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, onClose]);

  if (!open) return null;

  const visibleItems = filterMode === "unread" ? items.filter(isUnread) : items;

  const renderIcon = (kind: AdminNotificationItem["kind"]) => {
    if (kind === "victory") return <PackageCheck size={16} />;
    if (kind === "new_order") return <ShoppingBag size={16} />;
    if (kind === "urgent") return <AlertTriangle size={16} />;
    if (kind === "transferred") return <Truck size={16} />;
    return <Clock size={16} />;
  };

  return (
    <div className="gcome-notif-backdrop" role="presentation">
      <div
        ref={panelRef}
        className="gcome-notif-popover"
        role="dialog"
        aria-label="Centre de notifications"
      >
        <div className="gcome-notif-head">
          <div className="gcome-notif-head-title">
            <span className="gcome-notif-head-icon">
              <Bell size={15} />
            </span>
            <div>
              <strong>Notifications</strong>
              <span>
                {unreadCount > 0
                  ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`
                  : "Tout est à jour"}
              </span>
            </div>
          </div>
          <div className="gcome-notif-head-actions">
            {unreadCount > 0 && (
              <button
                type="button"
                className="gcome-notif-mark-all"
                onClick={onMarkAllAsRead}
                title="Marquer toutes comme lues"
              >
                <CheckCheck size={14} />
                <span>Tout lire</span>
              </button>
            )}
            <button
              type="button"
              className="gcome-notif-close"
              onClick={onClose}
              aria-label="Fermer les notifications"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="gcome-notif-tabs">
          <button
            type="button"
            className={filterMode === "all" ? "is-active" : ""}
            onClick={() => setFilterMode("all")}
          >
            Toutes ({items.length})
          </button>
          <button
            type="button"
            className={filterMode === "unread" ? "is-active" : ""}
            onClick={() => setFilterMode("unread")}
          >
            Non lues ({unreadCount})
          </button>
        </div>

        <div className="gcome-notif-list">
          {visibleItems.length === 0 ? (
            <div className="gcome-notif-empty">
              <Bell size={22} />
              <p>
                {filterMode === "unread"
                  ? "Aucune notification non lue."
                  : "Aucune notification récente."}
              </p>
            </div>
          ) : (
            visibleItems.map(item => {
              const unread = isUnread(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`gcome-notif-item kind-${item.kind} ${unread ? "is-unread" : ""}`}
                  onClick={() => {
                    onMarkAsRead(item.id);
                    onClose();
                    onSelectNotification(item);
                  }}
                >
                  <span className={`gcome-notif-item-ico kind-${item.kind}`}>
                    {renderIcon(item.kind)}
                  </span>
                  <div className="gcome-notif-item-body">
                    <div className="gcome-notif-item-top">
                      <strong>{item.title}</strong>
                      <span className={`gcome-notif-status-tag kind-${item.kind}`}>
                        {item.statusLabel}
                      </span>
                    </div>
                    <p>{item.body}</p>
                    <div className="gcome-notif-item-meta">
                      <span>{formatRelativeFr(item.tsMs)}</span>
                      {typeof item.amountDzd === "number" && item.amountDzd > 0 && (
                        <strong>{item.amountDzd.toLocaleString("fr-DZ")} DA</strong>
                      )}
                    </div>
                  </div>
                  {unread && <span className="gcome-notif-unread-dot" aria-hidden="true" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
