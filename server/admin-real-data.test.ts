import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { AdminDashboard } from "../client/src/components/AdminDashboard";
import { getOrderStats, loadRealOrders, saveRealOrders, orderMatchesPeriod, formatOrderDate } from "../client/src/lib/admin-orders";
import type { Order } from "../client/src/lib/store-data";

afterEach(() => vi.unstubAllGlobals());

const demoKeys = [
  ["MS-1048", "Aujourd'hui, 11:42", "Imane B.", "0550 24 18 62", "Blazer Lilac Dream", 1, 6900],
  ["MS-1047", "Aujourd'hui, 10:15", "Lina K.", "0661 90 42 11", "Gloss Peach Plump", 2, 3600],
  ["MS-1046", "Hier, 18:09", "Sarah M.", "0770 11 83 45", "Extensions Silk Wave", 1, 9800],
  ["MS-1045", "Hier, 15:33", "Nour A.", "0555 62 17 02", "Lentilles Honey Haze", 1, 3200],
  ["MS-1044", "26 oct., 13:21", "Meriem T.", "0790 44 09 71", "Ensemble Cloud Nine", 1, 8200],
];
const demos: Order[] = demoKeys.map(([id, createdAt, customer, phone, product, quantity, total]) => ({
  id, createdAt, customer, phone, product, quantity, total, wilaya: "Alger", commune: "Centre", address: "", note: "", status: "reportee",
} as Order));
const real: Order = { ...demos[0], id: "MS-REAL-UNIT", customer: "Commande enregistrée", createdAt: "2026-10-31T12:00:00.000Z", total: 9600, status: "nouvelle" };

function storageFor(value: unknown) {
  let raw = JSON.stringify(value);
  return { getItem: () => raw, setItem: vi.fn((_key: string, value: string) => { raw = value; }), raw: () => JSON.parse(raw) };
}

describe("Admin without demonstration data", () => {
  it("removes all five precise legacy examples, even after status changes, while keeping real orders", () => {
    const storage = storageFor([...demos, real]);
    expect(loadRealOrders(storage)).toEqual([real]);
    expect(storage.raw()).toEqual([real]);
    expect(loadRealOrders(storage)).toEqual([real]);
  });

  it("does not delete a real order merely because its ID matches an old example", () => {
    const sameId = { ...real, id: "MS-1048" };
    const storage = storageFor([sameId]);
    expect(loadRealOrders(storage)).toEqual([sameId]);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("never falls back to sample orders for an empty or unreadable store", () => {
    expect(loadRealOrders(storageFor([]))).toEqual([]);
    expect(loadRealOrders({ getItem: () => "not-json", setItem: vi.fn() })).toEqual([]);
    expect(loadRealOrders({ getItem: () => { throw new Error("blocked"); }, setItem: vi.fn() })).toEqual([]);
  });

  it("keeps unknown records intact during targeted cleanup and status updates", () => {
    const unknown = { id: "LEGACY-IMPORT", fields: ["unrecognized record, keep it"] };
    const storage = storageFor([...demos, real, unknown]);
    const orders = loadRealOrders(storage);
    saveRealOrders(orders.map(order => ({ ...order, status: "confirmee" })), storage);
    expect(storage.raw()).toEqual([{ ...real, status: "confirmee" }, unknown]);
  });

  it("computes counts and confirmed value from saved records rather than fabricated revenue", () => {
    const stats = getOrderStats([real, { ...real, id: "SECOND-UNIT", status: "confirmee" }]);
    expect(stats).toEqual({ count: 2, confirmedAmount: 9600, confirmedCount: 1, confirmationRate: 100 / 2, pending: 1 });
    expect(getOrderStats([])).toEqual({ count: 0, confirmedAmount: 0, confirmedCount: 0, confirmationRate: null, pending: 0 });
  });

  it("filters dated orders without inventing dates for old relative labels", () => {
    const now = new Date("2026-10-31T12:00:00.000Z");
    expect(orderMatchesPeriod(real, "Aujourd'hui", now)).toBe(true);
    const older = { ...real, createdAt: new Date(now.getTime() - 8 * 86400000).toISOString() };
    expect(orderMatchesPeriod(older, "7 derniers jours", now)).toBe(false);
    expect(orderMatchesPeriod(older, "30 derniers jours", now)).toBe(true);
    const undated = { ...real, createdAt: "À l'instant" };
    expect(orderMatchesPeriod(undated, "Toutes les dates", now)).toBe(true);
    expect(orderMatchesPeriod(undated, "Aujourd'hui", now)).toBe(false);
    expect(formatOrderDate(undated.createdAt)).toBe("Date non renseignée");
  });

  it("renders an empty dashboard without fake stats, charts or customers", () => {
    const html = renderToStaticMarkup(React.createElement(AdminDashboard, {
      orders: [], filtered: [], activeStatus: "all", query: "", period: "Toutes les dates", stockPanel: null,
      setActiveStatus: vi.fn(), setQuery: vi.fn(), setPeriod: vi.fn(), onSelect: vi.fn(), onCall: vi.fn(), onExport: vi.fn(),
    }));
    expect(html).toContain("Aucune commande enregistrée");
    expect(html).not.toMatch(/486\.2k|78\.4|18\.6|mini-chart|Imane B/);
  });

  it("records actual dates in every existing checkout without changing their saving or tracking flow", () => {
    for (const name of ["../client/src/components/AbayaOrder.tsx", "../client/src/pages/CoatLanding.tsx", "../client/src/pages/Storefront.tsx"]) {
      const source = readFileSync(new URL(name, import.meta.url), "utf8");
      expect(source).toContain("createdAt: new Date().toISOString()");
      expect(source).not.toContain('createdAt: "À l\'instant"');
    }
    expect(readFileSync(new URL("../client/src/pages/Admin.tsx", import.meta.url), "utf8")).not.toContain("seedOrders");
  });
});
