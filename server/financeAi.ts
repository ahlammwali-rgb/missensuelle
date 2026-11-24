import { GoogleGenAI } from "@google/genai";
import type {
  FinanceAdPlatform,
  FinanceCatalogProductRef,
  FinanceOverviewResponse,
} from "../shared/finance";
import { getResolvedGeminiApiKey } from "./aiLanding";

const FINANCE_AI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
] as const;

export type FinanceAiInsight = {
  type: "scale" | "cut" | "lot" | "carrier" | "cashflow";
  title: string;
  detail: string;
  impactHint: string;
};

export type FinanceAiBriefingResult = {
  usedAi: boolean;
  model?: string;
  headline: string;
  healthScore: number;
  verdictTone: "profitable" | "warning" | "critical";
  summaryParagraph: string;
  insights: FinanceAiInsight[];
};

const BRIEFING_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string", description: "Phrase verdict concise sur la rentabilité (max 15 mots)" },
    healthScore: { type: "integer", description: "Score santé financière de 0 à 100" },
    verdictTone: { type: "string", enum: ["profitable", "warning", "critical"] },
    summaryParagraph: { type: "string", description: "Synthèse CFO claire en 2-3 phrases avec vrais chiffres DZD" },
    insights: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: ["scale", "cut", "lot", "carrier", "cashflow"] },
          title: { type: "string" },
          detail: { type: "string" },
          impactHint: { type: "string" },
        },
        required: ["type", "title", "detail", "impactHint"],
      },
    },
  },
  required: ["headline", "healthScore", "verdictTone", "summaryParagraph", "insights"],
};

const MAPPING_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          campaignId: { type: "string" },
          productId: { type: "string" },
          variantKey: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["campaignId", "productId", "variantKey", "confidence"],
      },
    },
  },
  required: ["suggestions"],
};

function compactFactPayload(overview: FinanceOverviewResponse) {
  return {
    periode: `${overview.startDate} au ${overview.endDate}`,
    mode: overview.viewMode === "cohort" ? "Rentabilité par date commande/campagne" : "Trésorerie par date d'encaissement",
    tauxUsdDzd: overview.effectiveUsdToDzd,
    kpis: overview.kpis,
    topProduits: overview.products.slice(0, 8).map(p => ({
      nom: p.productName,
      livrées: p.deliveredOrders,
      retours: p.returnedOrders,
      tauxRetourPct: p.returnRatePct,
      caDzd: p.grossRevenueDzd,
      coutLotDzd: p.cogsDzd,
      lotMoyDzd: p.avgLotUnitCostDzd,
      pubUsd: p.adSpendUsd,
      pubDzd: p.adSpendDzd,
      cpaReelDzd: p.actualCpaDeliveredDzd,
      cpaMaxSupportableDzd: p.breakevenCpaDeliveredDzd,
      roas: p.roasGross,
      beneficeNetDzd: p.netProfitDzd,
      margePct: p.netMarginPct,
      verdict: p.verdict,
    })),
    topVariantes: overview.variants.slice(0, 12).map(v => ({
      produit: v.productName,
      variante: v.variantKey,
      livrées: v.deliveredOrders,
      retours: v.returnedOrders,
      tauxRetourPct: v.returnRatePct,
      lotMoyDzd: v.avgLotUnitCostDzd,
      pubDzd: v.adSpendDzd,
      beneficeNetDzd: v.netProfitDzd,
      cpaMaxDzd: v.breakevenCpaDeliveredDzd,
    })),
    transporteurs: overview.carriers,
    topWilayas: overview.wilayas.slice(0, 6),
    piresWilayas: [...overview.wilayas].sort((a, b) => a.netProfitBeforeFixedDzd - b.netProfitBeforeFixedDzd).slice(0, 5),
    anomaliesDetectees: overview.anomalies.map(a => `${a.title}: ${a.detail}`),
  };
}

function buildDeterministicBriefing(overview: FinanceOverviewResponse): FinanceAiBriefingResult {
  const { kpis } = overview;
  const scoreBase =
    kpis.grossRevenueDzd <= 0
      ? 50
      : Math.max(10, Math.min(98, Math.round(50 + kpis.netMarginPct * 1.4 - Math.max(0, kpis.returnRatePct - 18) * 0.8)));

  const verdictTone: FinanceAiBriefingResult["verdictTone"] =
    kpis.netProfitDzd > 0 && kpis.netMarginPct >= 10
      ? "profitable"
      : kpis.netProfitDzd >= 0
        ? "warning"
        : "critical";

  const headline =
    kpis.netProfitDzd >= 0
      ? `Activité rentable : +${kpis.netProfitDzd.toLocaleString("fr-DZ")} DA net (${kpis.netMarginPct}%)`
      : `Alerte déficit : ${kpis.netProfitDzd.toLocaleString("fr-DZ")} DA net sur la période`;

  const insights: FinanceAiInsight[] = [];

  const winner = overview.products.find(p => p.netProfitDzd > 0 && p.deliveredOrders >= 1);
  if (winner) {
    insights.push({
      type: "scale",
      title: `Top gagnant : ${winner.productName}`,
      detail: `+${winner.netProfitDzd.toLocaleString("fr-DZ")} DA net (${winner.deliveredOrders} livrées, ${winner.returnRatePct}% retours).`,
      impactHint: winner.breakevenCpaDeliveredDzd
        ? `CPA max supportable : ${winner.breakevenCpaDeliveredDzd.toLocaleString("fr-DZ")} DA / livrée`
        : "Rentable",
    });
  }

  const loserVar = overview.variants.find(v => v.netProfitDzd < 0 && v.deliveredOrders + v.returnedOrders >= 2);
  if (loserVar) {
    insights.push({
      type: "cut",
      title: `Variante déficitaire : ${loserVar.productName} (${loserVar.variantKey})`,
      detail: `${loserVar.netProfitDzd.toLocaleString("fr-DZ")} DA (${loserVar.returnRatePct}% retours, coût lot ${loserVar.avgLotUnitCostDzd} DA).`,
      impactHint: "Réduire la pub sur cette variante ou ajuster le prix / lot",
    });
  }

  const lowLot = overview.lotHealth.find(l => l.status === "low" || (l.status === "empty" && l.consumedDelivered > 0));
  if (lowLot) {
    insights.push({
      type: "lot",
      title: `Stock lot : ${lowLot.lot.productName}${lowLot.lot.variantKey ? ` (${lowLot.lot.variantKey})` : ""}`,
      detail: `Reste ${lowLot.remainingQty}/${lowLot.lot.quantityInitial} unités au coût de ${lowLot.lot.unitCostDzd} DA.`,
      impactHint: "Saisir le prochain lot avant rupture",
    });
  }

  if (kpis.cashDeliveredUnrecoveredDzd > 0) {
    insights.push({
      type: "cashflow",
      title: `Trésorerie à recouvrer chez transporteurs`,
      detail: `${kpis.cashDeliveredUnrecoveredDzd.toLocaleString("fr-DZ")} DA déjà livrés non encore versés.`,
      impactHint: "Relancer virement DHD / E-com",
    });
  }

  const dhd = overview.carriers.find(c => c.carrier === "ecotrack");
  const ecom = overview.carriers.find(c => c.carrier === "ecom");
  if (dhd && ecom && dhd.deliveredCount + dhd.returnedCount > 0 && ecom.deliveredCount + ecom.returnedCount > 0) {
    insights.push({
      type: "carrier",
      title: "Comparatif transporteurs",
      detail: `DHD : ${dhd.deliveryRatePct}% livrées (${dhd.returnFeeDzd} DA retours) vs E-com : ${ecom.deliveryRatePct}% livrées (${ecom.returnFeeDzd} DA retours).`,
      impactHint: dhd.deliveryRatePct >= ecom.deliveryRatePct ? "DHD devant en taux de livraison" : "E-com devant en taux de livraison",
    });
  }

  const summaryParagraph = [
    `Sur un CA encaissé de ${kpis.grossRevenueDzd.toLocaleString("fr-DZ")} DA (${kpis.deliveredOrders} livrées, ${kpis.returnedOrders} retours soit ${kpis.returnRatePct}%),`,
    `le total des coûts (lots stock ${kpis.cogsDzd.toLocaleString("fr-DZ")} DA, livraison/retours ${(kpis.shippingFeeDzd + kpis.returnFeeDzd).toLocaleString("fr-DZ")} DA, pub ${kpis.adSpendDzd.toLocaleString("fr-DZ")} DA / ${kpis.adSpendUsd}$, commissions & charges ${(kpis.commissionDzd + kpis.packagingPerParcelDzd + kpis.dailyChargesDzd + kpis.fixedChargesProratedDzd + kpis.staffSalaryProratedDzd).toLocaleString("fr-DZ")} DA)`,
    `dégage un résultat net de ${kpis.netProfitDzd.toLocaleString("fr-DZ")} DA.`,
  ].join(" ");

  return {
    usedAi: false,
    headline,
    healthScore: scoreBase,
    verdictTone,
    summaryParagraph,
    insights: insights.slice(0, 5),
  };
}

export async function generateFinanceAiBriefing(
  overview: FinanceOverviewResponse
): Promise<FinanceAiBriefingResult> {
  const apiKey = getResolvedGeminiApiKey();
  const fallback = buildDeterministicBriefing(overview);
  if (!apiKey) return fallback;

  const ai = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });
  const facts = JSON.stringify(compactFactPayload(overview));

  const prompt = [
    "Tu es le Directeur Financier (CFO) expert e-commerce COD Algérie pour la boutique Miss Sensuelle.",
    "Analyse EXCLUSIVEMENT les chiffres réels ci-dessous (ne jamais inventer un seul nombre non présent).",
    "Sois direct, pragmatique, actionnable en français (pense lots à prix variables, variantes rentables/déficitaires, retours DHD 50 DA / E-com 0 DA, CPA réel vs CPA max, trésorerie).",
    "",
    `DONNÉES EXACTES : ${facts}`,
  ].join("\n");

  for (const model of FINANCE_AI_MODELS) {
    try {
      const interaction = await ai.interactions.create({
        model,
        store: false,
        response_format: BRIEFING_SCHEMA,
        input: prompt,
      });
      const text = interaction.output_text?.trim();
      if (!text) continue;
      const parsed = JSON.parse(text) as Omit<FinanceAiBriefingResult, "usedAi" | "model">;
      return {
        ...parsed,
        usedAi: true,
        model,
        insights: Array.isArray(parsed.insights) ? parsed.insights.slice(0, 6) : fallback.insights,
      };
    } catch {
      // try next fallback model
    }
  }

  return fallback;
}

export async function askFinanceAiCopilot(
  question: string,
  overview: FinanceOverviewResponse
): Promise<{ answer: string; usedAi: boolean; model?: string }> {
  const cleanQ = question.trim();
  if (!cleanQ) throw new Error("Pose une question précise.");

  const apiKey = getResolvedGeminiApiKey();
  if (!apiKey) {
    const { kpis } = overview;
    const topP = overview.products[0];
    return {
      usedAi: false,
      answer: [
        `📊 Résumé réel (${overview.startDate} → ${overview.endDate}) : Bénéfice net = ${kpis.netProfitDzd.toLocaleString("fr-DZ")} DA (${kpis.netMarginPct}% de marge) sur ${kpis.grossRevenueDzd.toLocaleString("fr-DZ")} DA de CA livré.`,
        `Pub totale : ${kpis.adSpendDzd.toLocaleString("fr-DZ")} DA ($${kpis.adSpendUsd}) · Stock lots : ${kpis.cogsDzd.toLocaleString("fr-DZ")} DA · Transport & retours : ${(kpis.shippingFeeDzd + kpis.returnFeeDzd).toLocaleString("fr-DZ")} DA · Commissions : ${kpis.commissionDzd.toLocaleString("fr-DZ")} DA.`,
        topP
          ? `Meilleur produit : ${topP.productName} (+${topP.netProfitDzd.toLocaleString("fr-DZ")} DA, CPA max ${topP.breakevenCpaDeliveredDzd ?? "—"} DA).`
          : "",
        "(Ajoute une clé API Gemini dans Paramètres / Studio IA pour activer le chat CFO IA complet.)",
      ]
        .filter(Boolean)
        .join("\n\n"),
    };
  }

  const ai = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });
  const facts = JSON.stringify(compactFactPayload(overview));

  const prompt = [
    "Tu es l'assistant CFO IA de la boutique Miss Sensuelle (e-commerce COD en Algérie).",
    "Réponds de façon claire, concise, structurée et chiffrée en français en utilisant UNIQUEMENT les données JSON ci-dessous.",
    "Si une info n'est pas dans les données (ex: un produit sans lot saisi), dis-le honnêtement au lieu d'inventer.",
    "",
    `DONNÉES FINANCIÈRES RÉELLES : ${facts}`,
    "",
    `QUESTION DE LA PROPRIÉTAIRE : ${cleanQ}`,
  ].join("\n");

  for (const model of FINANCE_AI_MODELS) {
    try {
      const interaction = await ai.interactions.create({
        model,
        store: false,
        input: prompt,
      });
      const text = interaction.output_text?.trim();
      if (text) {
        return { answer: text, usedAi: true, model };
      }
    } catch {
      // try next fallback model
    }
  }

  return {
    usedAi: false,
    answer: `Voici les chiffres actuels : Bénéfice net ${overview.kpis.netProfitDzd.toLocaleString("fr-DZ")} DA sur ${overview.kpis.grossRevenueDzd.toLocaleString("fr-DZ")} DA livrés (${overview.kpis.deliveredOrders} livrées / ${overview.kpis.returnedOrders} retours).`,
  };
}

function normTxt(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export async function suggestCampaignMappingsWithAi(
  unmapped: Array<{ campaignId: string; campaignName: string; platform: FinanceAdPlatform }>,
  catalog: FinanceCatalogProductRef[]
): Promise<Array<{ campaignId: string; productId: string; variantKey: string; confidence: number }>> {
  if (unmapped.length === 0 || catalog.length === 0) return [];

  // Deterministic keyword heuristic first
  const heuristicMatches: Array<{ campaignId: string; productId: string; variantKey: string; confidence: number }> = [];
  const remaining: typeof unmapped = [];

  for (const camp of unmapped) {
    const cn = normTxt(camp.campaignName);
    let found: FinanceCatalogProductRef | undefined;
    for (const p of catalog) {
      const pn = normTxt(p.name);
      const sn = normTxt((p.slug || "").replace(/-/g, " "));
      const tokens = pn.split(/\s+/).filter(t => t.length >= 4);
      if (cn.includes(pn) || (sn && cn.includes(sn)) || tokens.some(t => cn.includes(t))) {
        found = p;
        break;
      }
    }
    if (found) {
      const matchedColor = (found.colors || []).find(c => cn.includes(normTxt(c))) || "";
      heuristicMatches.push({
        campaignId: camp.campaignId,
        productId: found.id,
        variantKey: matchedColor,
        confidence: 0.88,
      });
    } else {
      remaining.push(camp);
    }
  }

  const apiKey = getResolvedGeminiApiKey();
  if (!apiKey || remaining.length === 0) {
    return heuristicMatches;
  }

  const ai = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });
  const catalogList = catalog.map(c => ({
    id: c.id,
    name: c.name,
    colors: c.colors || [],
  }));
  const prompt = [
    "Associe chaque campagne publicitaire Meta/TikTok à l'ID exact du produit correspondant dans le catalogue.",
    "Ne propose une suggestion (confidence >= 0.6) que si tu es raisonnablement sûr. Sinon mets productId vide.",
    `CATALOGUE: ${JSON.stringify(catalogList)}`,
    `CAMPAGNES: ${JSON.stringify(remaining)}`,
  ].join("\n");

  for (const model of FINANCE_AI_MODELS) {
    try {
      const interaction = await ai.interactions.create({
        model,
        store: false,
        response_format: MAPPING_SCHEMA,
        input: prompt,
      });
      const text = interaction.output_text?.trim();
      if (!text) continue;
      const parsed = JSON.parse(text) as {
        suggestions?: Array<{ campaignId: string; productId: string; variantKey: string; confidence: number }>;
      };
      const validIds = new Set(catalog.map(c => c.id));
      const aiResults = (parsed.suggestions || []).filter(
        s => s.productId && validIds.has(s.productId) && s.confidence >= 0.55
      );
      return [...heuristicMatches, ...aiResults];
    } catch {
      // try next model
    }
  }

  return heuristicMatches;
}
