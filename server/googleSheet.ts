import type { CheckoutOrder } from "../shared/checkout";
import { normalizeOrderLocation } from "../shared/shipping";
import { getDb } from "./db";
import { getCloudToken } from "./persistentStore";

export type GoogleSheetConfig = {
  url: string;
  webhookUrl?: string;
  autoSync?: boolean;
  lastSyncAt?: string;
};

const DEFAULT_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1hgk4KXFcJNwS9Nr9AV9NwEHXbtu2lfzUrhIESyPdWlU/edit?usp=sharing";

let sheetConfig: GoogleSheetConfig = {
  url: DEFAULT_SHEET_URL,
  webhookUrl: "",
  autoSync: true,
  lastSyncAt: undefined,
};

export function getStoredSheetConfig(): GoogleSheetConfig {
  return { ...sheetConfig };
}

export function setStoredSheetConfig(newConfig: Partial<GoogleSheetConfig>) {
  sheetConfig = {
    ...sheetConfig,
    ...newConfig,
  };
  return sheetConfig;
}

export function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/** Parses standard CSV taking quotes and commas into account */
function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") i++;
      row.push(field.trim());
      if (row.some(f => f.length > 0)) lines.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some(f => f.length > 0)) lines.push(row);
  }
  return lines;
}

function cleanPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("213") && digits.length >= 11) {
    return "0" + digits.slice(3);
  }
  if (digits.length === 9 && ["5", "6", "7"].includes(digits[0])) {
    return "0" + digits;
  }
  return digits;
}

export async function fetchSheetRows(sheetUrl = sheetConfig.url): Promise<string[][]> {
  const id = extractSpreadsheetId(sheetUrl);
  if (!id) throw new Error("Lien Google Sheet invalide (ID introuvable)");
  const csvUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=0`;

  const res = await fetch(csvUrl, {
    headers: { "User-Agent": "MissSensuelle-Sync/1.0" },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Google Sheet inaccessible (${res.status}). Assurez-vous que le lien est partagé en "Tous les utilisateurs disposant du lien : Lecteur ou Éditeur".`);
  }

  const text = await res.text();
  return parseCSV(text);
}

export async function importGoogleSheetToOrders(
  memoryOrders: CheckoutOrder[],
  saveStore: () => void,
  getNextOrderId: () => number,
  sheetUrl = sheetConfig.url
): Promise<{ added: number; totalRows: number; skipped: number }> {
  const rows = await fetchSheetRows(sheetUrl);
  if (rows.length < 2) {
    return { added: 0, totalRows: rows.length, skipped: 0 };
  }

  const header = rows[0].map(h => h.toLowerCase());
  const idxNom = header.findIndex(h => h.includes("nom") || h.includes("client"));
  const idxTel = header.findIndex(h => h.includes("numero") || h.includes("tel") || h.includes("phone"));
  const idxProd = header.findIndex(h => h.includes("produit") || h.includes("article"));
  const idxVar = header.findIndex(h => h.includes("variant") || h.includes("couleur") || h.includes("taille"));
  const idxQty = header.findIndex(h => h.includes("quntiter") || h.includes("quantite") || h.includes("qte"));
  const idxWil = header.findIndex(h => h.includes("wilaya"));
  const idxCom = header.findIndex(h => h.includes("comun") || h.includes("commune"));
  const idxPrix = header.findIndex(h => h.includes("prix") || h.includes("total"));
  const idxLeadId = header.findIndex(h => h.includes("tiktok lead id") || h.includes("lead id") || h.includes("utm"));

  const existingOrderIds = new Set(memoryOrders.map(o => o.id));
  const existingPhones = new Set(memoryOrders.map(o => cleanPhone(o.phone)));

    // Clean up any previously imported orders that had size: "L" or default 7500 DA mistakenly set
  for (const o of memoryOrders) {
    if (o.size === "L" && (o.id.startsWith("MS-GS-") || o.id.startsWith("MS-TT-") || o.product.includes("EXTENTION"))) {
      o.size = "";
    }
    if (o.total === 7500 && (o.id.startsWith("MS-GS-") || o.id.startsWith("MS-TT-") || o.product.includes("EXTENTION"))) {
      o.total = 0;
    }
  }

  let added = 0;
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rawTel = idxTel >= 0 ? row[idxTel] : row[1] || "";
    const phone = cleanPhone(rawTel);

    if (!phone || phone.length < 8) {
      skipped++;
      continue;
    }

    const leadId = idxLeadId >= 0 ? row[idxLeadId] : "";
    const orderId = leadId ? `MS-TT-${leadId.slice(-10)}` : `MS-GS-${i}-${phone.slice(-4)}`;

    if (existingOrderIds.has(orderId) || existingPhones.has(phone)) {
      skipped++;
      continue;
    }

    const customer = (idxNom >= 0 ? row[idxNom] : row[0]) || "Cliente TikTok Lead";
    let product = (idxProd >= 0 ? row[idxProd] : row[2]) || "Abaya Royal Emerald";
    const variant = (idxVar >= 0 ? row[idxVar] : row[3]) || "";
    const qty = Math.max(1, parseInt(idxQty >= 0 ? row[idxQty] : "1", 10) || 1);
    const rawWilaya = (idxWil >= 0 ? row[idxWil] : row[5]) || "الجزائر";
    const rawCommune = (idxCom >= 0 ? row[idxCom] : row[6]) || "";
    const normLoc = normalizeOrderLocation(rawWilaya, rawCommune, "");
    const wilaya = normLoc.wilaya || "الجزائر";
    const commune = normLoc.commune || wilaya;
    const rawPriceStr = idxPrix >= 0 && row[idxPrix] ? row[idxPrix].replace(/\D/g, "") : "";
    const total = rawPriceStr ? (parseInt(rawPriceStr, 10) || 0) : 0;

    const prodLower = `${product} ${variant}`.toLowerCase();
    let productId = "p-007";
    if (prodLower.includes("extention") || prodLower.includes("extension") || prodLower.includes("إكستنشن") || prodLower.includes("شعر") || prodLower.includes("p-005")) {
      productId = "p-005";
      if (!idxProd || !row[idxProd]) product = "Extensions Cheveux Naturel";
    } else if (prodLower.includes("doudoune") || prodLower.includes("دواقون") || prodLower.includes("جاكيت") || prodLower.includes("hiver") || prodLower.includes("p-008")) {
      productId = "p-008";
      if (!idxProd || !row[idxProd]) product = "Doudoune Hiver de Luxe";
    } else if (prodLower.includes("manteau") || prodLower.includes("blazer") || prodLower.includes("coat") || prodLower.includes("p-001")) {
      productId = "p-001";
      if (!idxProd || !row[idxProd]) product = "Manteau Icon";
    }

    const newOrder: CheckoutOrder = {
      dbId: getNextOrderId(),
      id: orderId,
      createdAt: new Date().toISOString(),
      customer: customer.trim(),
      phone,
      productId,
      product: `${product} × ${qty}`,
      quantity: qty,
      total,
      color: variant.trim(),
      size: "",
      delivery: "home",
      wilaya: wilaya.trim(),
      commune: commune.trim(),
      address: normLoc.address || "",
      note: leadId ? `Lead TikTok Ads #${leadId}` : "Importé depuis Google Sheet",
      status: "nouvelle",
    };

    memoryOrders.unshift(newOrder);
    existingOrderIds.add(orderId);
    existingPhones.add(phone);
    added++;
  }

  if (added > 0) {
    saveStore();
  }

  sheetConfig.lastSyncAt = new Date().toISOString();
  return { added, totalRows: rows.length - 1, skipped };
}

/** Optionally pushes newly placed store orders to the user's Google Sheet via Apps Script Webhook */
export async function pushOrderToGoogleSheet(order: CheckoutOrder): Promise<boolean> {
  const webhook = sheetConfig.webhookUrl?.trim();
  if (!webhook) return false;

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: order.id,
        date: order.createdAt,
        nom: order.customer,
        numero: order.phone,
        produit: order.product,
        variant: [order.color, order.size].filter(Boolean).join(" / "),
        quntiter: order.quantity,
        wilaya: order.wilaya,
        comun: order.commune,
        prix: order.total,
        statut: order.status,
      }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
