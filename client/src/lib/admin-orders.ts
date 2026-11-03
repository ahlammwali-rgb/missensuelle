import type { Order, OrderStatus } from "./store-data";

export const ORDERS_STORAGE_KEY = "miss-sensuelle-orders";
type OrderStorage = Pick<Storage, "getItem" | "setItem">;

// Empreintes des anciens exemples, uniquement pour nettoyer leurs copies persistées.
// L'identifiant seul ne suffit jamais à supprimer une commande.
const legacyDemoKeys = new Set([
  ["MS-1048", "Aujourd'hui, 11:42", "Imane B.", "0550 24 18 62", "Blazer Lilac Dream", 1, 6900],
  ["MS-1047", "Aujourd'hui, 10:15", "Lina K.", "0661 90 42 11", "Gloss Peach Plump", 2, 3600],
  ["MS-1046", "Hier, 18:09", "Sarah M.", "0770 11 83 45", "Extensions Silk Wave", 1, 9800],
  ["MS-1045", "Hier, 15:33", "Nour A.", "0555 62 17 02", "Lentilles Honey Haze", 1, 3200],
  ["MS-1044", "26 oct., 13:21", "Meriem T.", "0790 44 09 71", "Ensemble Cloud Nine", 1, 8200],
].map(key => JSON.stringify(key)));

const statuses: OrderStatus[] = ["nouvelle", "confirmee", "annulee", "reportee", "ne_repond_pas", "transferee"];

export function isLegacyDemoOrder(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const order = value as Record<string, unknown>;
  return legacyDemoKeys.has(JSON.stringify([order.id, order.createdAt, order.customer, order.phone, order.product, order.quantity, order.total]));
}

function isReadableOrder(value: unknown): value is Order {
  if (!value || typeof value !== "object") return false;
  const order = value as Record<string, unknown>;
  return ["id", "createdAt", "customer", "phone", "product", "wilaya", "commune", "address", "note"].every(key => typeof order[key] === "string")
    && typeof order.total === "number" && Number.isFinite(order.total)
    && typeof order.quantity === "number" && Number.isFinite(order.quantity)
    && statuses.includes(order.status as OrderStatus);
}

function readStored(storage: OrderStorage): unknown[] {
  const parsed: unknown = JSON.parse(storage.getItem(ORDERS_STORAGE_KEY) ?? "[]");
  if (!Array.isArray(parsed)) throw new Error("Format de commandes illisible");
  return parsed;
}

export function loadRealOrders(storage: OrderStorage | undefined = typeof localStorage === "undefined" ? undefined : localStorage): Order[] {
  if (!storage) return [];
  try {
    const saved = readStored(storage);
    const cleaned = saved.filter(order => !isLegacyDemoOrder(order));
    if (cleaned.length !== saved.length) {
      try { storage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(cleaned)); } catch { /* Masqués même si le nettoyage ne peut pas être persisté. */ }
    }
    // Les données non reconnues restent dans le stockage, sans devenir de faux exemples.
    return cleaned.filter(isReadableOrder);
  } catch { return []; }
}

export function saveRealOrders(orders: Order[], storage: OrderStorage = localStorage): void {
  const unknownRecords = readStored(storage).filter(order => !isReadableOrder(order) && !isLegacyDemoOrder(order));
  storage.setItem(ORDERS_STORAGE_KEY, JSON.stringify([...orders.filter(order => !isLegacyDemoOrder(order)), ...unknownRecords]));
}

export function getOrderStats(orders: Order[]) {
  const confirmed = orders.filter(order => order.status === "confirmee");
  return {
    count: orders.length,
    confirmedAmount: confirmed.reduce((sum, order) => sum + order.total, 0),
    confirmedCount: confirmed.length,
    confirmationRate: orders.length ? confirmed.length * 100 / orders.length : null,
    pending: orders.filter(order => order.status === "nouvelle").length,
  };
}

export function parseOrderDate(value: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  const match = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\D|$)/);
  if (!match) return null;
  const day = Number(match[1]); const month = Number(match[2]); const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return date.getUTCDate() === day && date.getUTCMonth() === month - 1 ? date : null;
}

function dayNumber(date: Date) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Africa/Algiers", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (name: string) => Number(parts.find(item => item.type === name)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day")) / 86400000;
}

export function orderMatchesPeriod(order: Order, period: string, now = new Date()): boolean {
  if (period === "Toutes les dates") return true;
  const date = parseOrderDate(order.createdAt);
  if (!date) return false; // Une ancienne mention relative ne permet pas d'inventer une date.
  const age = dayNumber(now) - dayNumber(date);
  const days = period === "Aujourd'hui" ? 1 : period === "7 derniers jours" ? 7 : 30;
  return age >= 0 && age < days;
}

export function formatOrderDate(value: string): string {
  if (!parseOrderDate(value)) return "Date non renseignée";
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  return new Intl.DateTimeFormat("fr-DZ", { timeZone: "Africa/Algiers", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
