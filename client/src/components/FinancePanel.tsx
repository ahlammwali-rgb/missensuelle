import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Bot,
  Calendar,
  CheckCircle2,
  Edit3,
  Layers,
  Link2,
  MessageSquare,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Truck,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  FINANCE_EXPENSE_CATEGORY_LABELS,
  algiersDateKey,
  type FinanceAdCurrency,
  type FinanceAdPlatform,
  type FinanceExpenseCategory,
  type FinancePurchaseLot,
  type FinanceViewMode,
} from "@shared/finance";
import { formatDZD } from "@/lib/store-data";
import { trpc } from "@/lib/trpc";

type FinanceTab = "overview" | "products" | "lots" | "ads" | "charges";
type DatePreset = "today" | "yesterday" | "7d" | "30d" | "month" | "all" | "custom";

function computePresetRange(preset: DatePreset): { startDate: string; endDate: string } {
  const now = new Date();
  const today = algiersDateKey(now);
  if (preset === "today") return { startDate: today, endDate: today };
  if (preset === "yesterday") {
    const y = algiersDateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    return { startDate: y, endDate: y };
  }
  if (preset === "7d") {
    return { startDate: algiersDateKey(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)), endDate: today };
  }
  if (preset === "30d") {
    return { startDate: algiersDateKey(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)), endDate: today };
  }
  if (preset === "month") {
    return { startDate: `${today.slice(0, 7)}-01`, endDate: today };
  }
  if (preset === "all") {
    return { startDate: "2024-01-01", endDate: today };
  }
  return { startDate: algiersDateKey(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)), endDate: today };
}

function formatSignedDzd(val: number): string {
  const rounded = Math.round(val);
  const absFormatted = formatDZD(Math.abs(rounded));
  if (rounded > 0) return `+${absFormatted}`;
  if (rounded < 0) return `-${absFormatted}`;
  return absFormatted;
}

export function FinancePanel({
  notify,
}: {
  notify: (msg: string, type?: "normal" | "urgent" | "victory" | "order") => void;
}) {
  const utils = trpc.useUtils();

  const [tab, setTab] = useState<FinanceTab>("overview");
  const [preset, setPreset] = useState<DatePreset>("30d");
  const [viewMode, setViewMode] = useState<FinanceViewMode>("cohort");
  const [customStart, setCustomStart] = useState(() => computePresetRange("30d").startDate);
  const [customEnd, setCustomEnd] = useState(() => computePresetRange("30d").endDate);

  const range = useMemo(
    () => (preset === "custom" ? { startDate: customStart, endDate: customEnd } : computePresetRange(preset)),
    [preset, customStart, customEnd]
  );

  const overviewQuery = trpc.finance.overview.useQuery(
    {
      viewMode,
      startDate: range.startDate,
      endDate: range.endDate,
    },
    { refetchOnWindowFocus: false }
  );

  const catalogQuery = trpc.finance.catalogOptions.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const invalidateFinance = async () => {
    await utils.finance.overview.invalidate();
  };

  // --- Sub-tabs UI state ---
  const [productBreakdownMode, setProductBreakdownMode] = useState<"product" | "variant">("product");
  const [productSort, setProductSort] = useState<"profit_desc" | "profit_asc" | "return_desc" | "orders_desc">("profit_desc");
  const [productSearch, setProductSearch] = useState("");

  // --- Lot Modal / Bottom Sheet state ---
  const [lotModalOpen, setLotModalOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<FinancePurchaseLot | null>(null);
  const [lotProductId, setLotProductId] = useState("");
  const [lotVariantKey, setLotVariantKey] = useState("");
  const [lotDate, setLotDate] = useState(() => algiersDateKey());
  const [lotQty, setLotQty] = useState("20");
  const [lotUnitCost, setLotUnitCost] = useState("500");
  const [lotSupplier, setLotSupplier] = useState("");
  const [lotNote, setLotNote] = useState("");

  // --- Expense form state ---
  const [expDate, setExpDate] = useState(() => algiersDateKey());
  const [expTitle, setExpTitle] = useState("");
  const [expCat, setExpCat] = useState<FinanceExpenseCategory>("packaging");
  const [expFreq, setExpFreq] = useState<"daily" | "monthly_fixed">("daily");
  const [expAmount, setExpAmount] = useState("");
  const [expCurrency, setExpCurrency] = useState<FinanceAdCurrency>("DZD");
  const [expNote, setExpNote] = useState("");

  // --- Ad credentials & Manual spend & FX rate state ---
  const [metaAccountInput, setMetaAccountInput] = useState("");
  const [metaTokenInput, setMetaTokenInput] = useState("");
  const [ttAdvInput, setTtAdvInput] = useState("");
  const [ttTokenInput, setTtTokenInput] = useState("");

  const [adDate, setAdDate] = useState(() => algiersDateKey());
  const [adPlatform, setAdPlatform] = useState<FinanceAdPlatform>("tiktok");
  const [adCampaignName, setAdCampaignName] = useState("");
  const [adProductId, setAdProductId] = useState("");
  const [adVariantKey, setAdVariantKey] = useState("");
  const [adSpendAmount, setAdSpendAmount] = useState("");
  const [adCurrency, setAdCurrency] = useState<FinanceAdCurrency>("USD");

  const [csvPlatform, setCsvPlatform] = useState<FinanceAdPlatform>("meta");
  const [csvCurrency, setCsvCurrency] = useState<FinanceAdCurrency>("USD");
  const [csvText, setCsvText] = useState("");

  const [fxDate, setFxDate] = useState(() => algiersDateKey());
  const [fxUsdDzd, setFxUsdDzd] = useState("250");
  const [fxNote, setFxNote] = useState("");

  // --- Settings form ---
  const [settingsDraft, setSettingsDraft] = useState({
    defaultUsdToDzd: 250,
    defaultEurToDzd: 270,
    packagingPerParcelDzd: 0,
    ecomReturnFeeDzd: 0,
    dhdReturnFeeDzd: 50,
    chargeOutboundShippingOnReturn: false,
    includeStaffBaseSalary: true,
    autoSyncAdsEnabled: true,
  });

  useEffect(() => {
    if (overviewQuery.data?.settings) {
      setSettingsDraft(overviewQuery.data.settings);
    }
    if (overviewQuery.data?.adConnections.meta.adAccountId && !metaAccountInput) {
      setMetaAccountInput(overviewQuery.data.adConnections.meta.adAccountId);
    }
    if (overviewQuery.data?.adConnections.tiktok.advertiserId && !ttAdvInput) {
      setTtAdvInput(overviewQuery.data.adConnections.tiktok.advertiserId);
    }
  }, [overviewQuery.data]);

  // --- AI CFO Briefing & Chat ---
  const [aiBriefing, setAiBriefing] = useState<{
    usedAi: boolean;
    model?: string;
    headline: string;
    healthScore: number;
    verdictTone: "profitable" | "warning" | "critical";
    summaryParagraph: string;
    insights: Array<{ type: string; title: string; detail: string; impactHint: string }>;
  } | null>(null);
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: "user" | "assistant"; text: string; usedAi?: boolean }>
  >([]);

  // --- Mutations ---
  const upsertLotMutation = trpc.finance.upsertLot.useMutation({
    onSuccess: async () => {
      notify("Lot d'achat enregistré & coûts FIFO recalculés ✓");
      setLotModalOpen(false);
      await invalidateFinance();
    },
    onError: e => notify(e.message, "urgent"),
  });

  const deleteLotMutation = trpc.finance.deleteLot.useMutation({
    onSuccess: async () => {
      notify("Lot supprimé");
      await invalidateFinance();
    },
  });

  const upsertExpenseMutation = trpc.finance.upsertExpense.useMutation({
    onSuccess: async () => {
      notify("Charge enregistrée ✓");
      setExpTitle("");
      setExpAmount("");
      setExpNote("");
      await invalidateFinance();
    },
    onError: e => notify(e.message, "urgent"),
  });

  const deleteExpenseMutation = trpc.finance.deleteExpense.useMutation({
    onSuccess: async () => {
      notify("Charge supprimée");
      await invalidateFinance();
    },
  });

  const saveFxMutation = trpc.finance.saveExchangeRate.useMutation({
    onSuccess: async () => {
      notify("Taux USD ➔ DZD enregistré ✓");
      setFxNote("");
      await invalidateFinance();
    },
    onError: e => notify(e.message, "urgent"),
  });

  const deleteFxMutation = trpc.finance.deleteExchangeRate.useMutation({
    onSuccess: async () => {
      await invalidateFinance();
    },
  });

  const saveAdCredsMutation = trpc.finance.saveAdCredentials.useMutation({
    onSuccess: async (_data, vars) => {
      notify(`API ${vars.platform === "meta" ? "Meta Ads" : "TikTok Ads"} connectée ✓`);
      if (vars.platform === "meta") setMetaTokenInput("");
      else setTtTokenInput("");
      await invalidateFinance();
    },
    onError: e => notify(e.message, "urgent"),
  });

  const clearAdCredsMutation = trpc.finance.clearAdCredentials.useMutation({
    onSuccess: async () => {
      notify("Connexion pub déconnectée");
      await invalidateFinance();
    },
  });

  const syncAdsMutation = trpc.finance.syncAdsNow.useMutation({
    onSuccess: async res => {
      const mCount = res.meta?.synced ?? 0;
      const tCount = res.tiktok?.synced ?? 0;
      const errs = [res.meta?.error, res.tiktok?.error].filter(Boolean);
      if (errs.length > 0 && mCount === 0 && tCount === 0) {
        notify(errs.join(" · "), "urgent");
      } else {
        notify(`Pub synchronisée (${mCount} Meta, ${tCount} TikTok) ✓`);
      }
      await invalidateFinance();
    },
    onError: e => notify(e.message, "urgent"),
  });

  const manualAdMutation = trpc.finance.upsertAdSpendManual.useMutation({
    onSuccess: async () => {
      notify("Dépense pub enregistrée ✓");
      setAdSpendAmount("");
      setAdCampaignName("");
      await invalidateFinance();
    },
    onError: e => notify(e.message, "urgent"),
  });

  const importCsvMutation = trpc.finance.importAdSpendCsv.useMutation({
    onSuccess: async res => {
      notify(`${res.imported} lignes pub importées (${res.totalSpendAmount}) ✓`);
      setCsvText("");
      await invalidateFinance();
    },
    onError: e => notify(e.message, "urgent"),
  });

  const deleteAdSpendMutation = trpc.finance.deleteAdSpend.useMutation({
    onSuccess: async () => {
      await invalidateFinance();
    },
  });

  const saveMappingMutation = trpc.finance.saveCampaignMapping.useMutation({
    onSuccess: async () => {
      notify("Campagne liée au produit ✓");
      await invalidateFinance();
    },
  });

  const autoMapAiMutation = trpc.finance.autoMapCampaignsWithAi.useMutation({
    onSuccess: async res => {
      notify(`${res.mappedCount} campagne(s) associées par IA ✓`);
      await invalidateFinance();
    },
    onError: e => notify(e.message, "urgent"),
  });

  const updateSettingsMutation = trpc.finance.updateSettings.useMutation({
    onSuccess: async () => {
      notify("Paramètres financiers mis à jour ✓");
      await invalidateFinance();
    },
    onError: e => notify(e.message, "urgent"),
  });

  const aiBriefingMutation = trpc.finance.aiBriefing.useMutation({
    onSuccess: res => setAiBriefing(res),
    onError: e => notify(e.message, "urgent"),
  });

  const aiChatMutation = trpc.finance.aiChat.useMutation({
    onSuccess: res => {
      setChatMessages(prev => [...prev, { role: "assistant", text: res.answer, usedAi: res.usedAi }]);
    },
    onError: e => notify(e.message, "urgent"),
  });

  const data = overviewQuery.data;
  const catalog = catalogQuery.data ?? [];

  const openNewLotModal = (prefillProductId?: string, prefillVariant?: string, existing?: FinancePurchaseLot) => {
    if (existing) {
      setEditingLot(existing);
      setLotProductId(existing.productId);
      setLotVariantKey(existing.variantKey || "");
      setLotDate(existing.purchasedAt);
      setLotQty(String(existing.quantityInitial));
      setLotUnitCost(String(existing.unitCostDzd));
      setLotSupplier(existing.supplier || "");
      setLotNote(existing.note || "");
    } else {
      setEditingLot(null);
      setLotProductId(prefillProductId || catalog[0]?.id || "");
      setLotVariantKey(prefillVariant || "");
      setLotDate(algiersDateKey());
      setLotQty("20");
      setLotUnitCost("500");
      setLotSupplier("");
      setLotNote("");
    }
    setLotModalOpen(true);
  };

  const handleSaveLot = (e: FormEvent) => {
    e.preventDefault();
    const prod = catalog.find(p => p.id === lotProductId);
    const name = prod?.name || editingLot?.productName || lotProductId;
    if (!lotProductId || !name) {
      notify("Choisis un produit", "urgent");
      return;
    }
    upsertLotMutation.mutate({
      id: editingLot?.id,
      productId: lotProductId,
      productName: name,
      variantKey: lotVariantKey.trim(),
      purchasedAt: lotDate,
      quantityInitial: Math.max(1, Math.round(Number(lotQty) || 1)),
      unitCostDzd: Math.max(0, Number(lotUnitCost) || 0),
      supplier: lotSupplier.trim(),
      note: lotNote.trim(),
    });
  };

  const handleSaveExpense = (e: FormEvent) => {
    e.preventDefault();
    if (!expTitle.trim() || !expAmount) {
      notify("Titre et montant requis", "urgent");
      return;
    }
    upsertExpenseMutation.mutate({
      date: expDate,
      title: expTitle.trim(),
      category: expCat,
      frequency: expFreq,
      amount: Math.max(0, Number(expAmount) || 0),
      currency: expCurrency,
      note: expNote.trim(),
    });
  };

  const handleSaveManualAd = (e: FormEvent) => {
    e.preventDefault();
    if (!adCampaignName.trim() || !adSpendAmount) {
      notify("Nom de campagne et montant requis", "urgent");
      return;
    }
    manualAdMutation.mutate({
      date: adDate,
      platform: adPlatform,
      campaignName: adCampaignName.trim(),
      productId: adProductId,
      variantKey: adVariantKey.trim(),
      spendAmount: Math.max(0, Number(adSpendAmount) || 0),
      currency: adCurrency,
      impressions: 0,
      clicks: 0,
      conversions: 0,
    });
  };

  const handleCsvFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    notify(`Fichier "${file.name}" chargé, clique sur Importer CSV`);
  };

  const handleAskCopilot = (q?: string) => {
    const prompt = (q ?? chatQuestion).trim();
    if (!prompt || aiChatMutation.isPending) return;
    setChatMessages(prev => [...prev, { role: "user", text: prompt }]);
    if (!q) setChatQuestion("");
    aiChatMutation.mutate({
      question: prompt,
      viewMode,
      startDate: range.startDate,
      endDate: range.endDate,
    });
  };

  const filteredProductRows = useMemo(() => {
    if (!data) return [];
    const rows = productBreakdownMode === "product" ? data.products : data.variants;
    const q = productSearch.trim().toLowerCase();
    const matched = q
      ? rows.filter(r =>
          `${r.productName} ${"variantKey" in r ? (r as { variantKey: string }).variantKey : ""}`
            .toLowerCase()
            .includes(q)
        )
      : [...rows];
    matched.sort((a, b) => {
      if (productSort === "profit_asc") return a.netProfitDzd - b.netProfitDzd;
      if (productSort === "return_desc") return b.returnRatePct - a.returnRatePct;
      if (productSort === "orders_desc") return b.totalOrders - a.totalOrders;
      return b.netProfitDzd - a.netProfitDzd;
    });
    return matched;
  }, [data, productBreakdownMode, productSearch, productSort]);

  return (
    <section className="finance-shell">
      {/* Top Sticky Native Control Bar */}
      <div className="fin-topbar-card">
        <div className="fin-presets-scroll" role="group" aria-label="Période financière">
          {(
            [
              { id: "today", label: "Aujourd'hui" },
              { id: "yesterday", label: "Hier" },
              { id: "7d", label: "7 jours" },
              { id: "30d", label: "30 jours" },
              { id: "month", label: "Ce mois" },
              { id: "all", label: "Global" },
              { id: "custom", label: "Dates" },
            ] as const
          ).map(item => (
            <button
              key={item.id}
              type="button"
              className={`fin-preset-chip${preset === item.id ? " is-active" : ""}`}
              onClick={() => setPreset(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="fin-custom-dates">
            <label>
              <Calendar size={13} />
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} />
            </label>
            <span>→</span>
            <label>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </label>
          </div>
        )}

        <div className="fin-mode-toolbar">
          <div className="fin-view-switch" role="group" aria-label="Mode de calcul">
            <button
              type="button"
              className={viewMode === "cohort" ? "is-active" : ""}
              onClick={() => setViewMode("cohort")}
              title="Compare les commandes créées sur la période face à la pub du même jour"
            >
              🎯 Rentabilité Pub
            </button>
            <button
              type="button"
              className={viewMode === "cashflow" ? "is-active" : ""}
              onClick={() => setViewMode("cashflow")}
              title="Argent encaissé sur la période selon les dates de livraison"
            >
              💵 Caisse Réelle
            </button>
          </div>

          <button
            type="button"
            className="fin-sync-pill"
            onClick={() => void overviewQuery.refetch()}
            disabled={overviewQuery.isFetching}
          >
            <RefreshCw size={13} className={overviewQuery.isFetching ? "animate-spin" : ""} />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      {overviewQuery.isLoading || !data ? (
        <div className="fin-loading-card">
          <Sparkles size={24} className="animate-pulse" />
          <p>Calcul des marges, lots FIFO, frais DHD/E-com et dépenses pub…</p>
        </div>
      ) : (
        <>
          {/* Hero Net Profit Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={`fin-hero-card tone-${data.kpis.status}`}
          >
            <div className="fin-hero-top">
              <div>
                <span className="fin-hero-eyebrow">
                  {viewMode === "cohort" ? "RÉSULTAT CAMPAGNES" : "TRÉSORERIE RÉELLE"} · {data.startDate} → {data.endDate}
                </span>
                <div className="fin-hero-profit-row">
                  <strong className="fin-hero-profit">{formatSignedDzd(data.kpis.netProfitDzd)}</strong>
                  <span className={`fin-verdict-badge tone-${data.kpis.status}`}>
                    {data.kpis.status === "profitable" ? (
                      <><TrendingUp size={13} /> RENTABLE</>
                    ) : data.kpis.status === "deficit" ? (
                      <><TrendingDown size={13} /> DÉFICITAIRE</>
                    ) : (
                      <>⚖️ ÉQUILIBRE</>
                    )}
                  </span>
                </div>
              </div>

              <div className="fin-hero-right-badges">
                <div className="fin-mini-stat">
                  <span>Marge Nette</span>
                  <strong>{data.kpis.netMarginPct}%</strong>
                </div>
                <div className="fin-mini-stat">
                  <span>ROAS</span>
                  <strong>{data.kpis.roasGross !== null ? `${data.kpis.roasGross}x` : "—"}</strong>
                </div>
              </div>
            </div>

            <div className="fin-hero-kpis-grid">
              <div className="fin-hero-kpi-tile">
                <span>CA Livré Encaissé</span>
                <strong>{formatDZD(data.kpis.grossRevenueDzd)}</strong>
                <small>
                  {data.kpis.deliveredOrders} livrées · {data.kpis.returnedOrders} retours ({data.kpis.returnRatePct}%)
                </small>
              </div>
              <div className="fin-hero-kpi-tile">
                <span>Stock & Transport</span>
                <strong>{formatDZD(data.kpis.cogsDzd + data.kpis.shippingFeeDzd + data.kpis.returnFeeDzd)}</strong>
                <small>
                  Lots {formatDZD(data.kpis.cogsDzd)} · Liv/Ret {formatDZD(data.kpis.shippingFeeDzd + data.kpis.returnFeeDzd)}
                </small>
              </div>
              <div className="fin-hero-kpi-tile">
                <span>Pub TikTok & Meta</span>
                <strong>{formatDZD(data.kpis.adSpendDzd)}</strong>
                <small>
                  ${data.kpis.adSpendUsd} · 1$ = {data.effectiveUsdToDzd} DA
                </small>
              </div>
              <div className="fin-hero-kpi-tile">
                <span>Cash Bloqué Dehors</span>
                <strong>{formatDZD(data.kpis.cashDeliveredUnrecoveredDzd)}</strong>
                <small>
                  En transit : {formatDZD(data.kpis.cashInTransitDzd)} ({data.kpis.inTransitOrders})
                </small>
              </div>
            </div>
          </motion.div>

          {/* Sticky Mobile App Bottom/Pill Navigation inside Finance */}
          <div className="fin-nav-tabs" role="tablist" aria-label="Sections Finance IA">
            {(
              [
                { id: "overview", label: "Bilan", icon: <Wallet size={14} /> },
                { id: "products", label: "Produits", icon: <Layers size={14} /> },
                { id: "lots", label: `Lots (${data.lots.length})`, icon: <Package size={14} /> },
                { id: "ads", label: "Pub API", icon: <Sparkles size={14} /> },
                { id: "charges", label: "Charges", icon: <Sliders size={14} /> },
              ] as const
            ).map(t => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`fin-nav-tab${tab === t.id ? " is-active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Alerts / Anomalies Strip */}
          {data.anomalies.length > 0 && (
            <div className="fin-anomalies-strip">
              {data.anomalies.slice(0, 4).map(anom => (
                <button
                  key={anom.id}
                  type="button"
                  className={`fin-anomaly-chip sev-${anom.severity}`}
                  onClick={() => {
                    if (anom.actionTab) setTab(anom.actionTab);
                  }}
                >
                  <AlertTriangle size={14} />
                  <div>
                    <strong>{anom.title}</strong>
                    <span>{anom.detail}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* TAB PANELS WITH FLUID TRANSITION */}
          <AnimatePresence mode="wait">
            {tab === "overview" && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="fin-tab-content"
              >
                {/* CFO IA Card + Copilot */}
                <div className="fin-panel-card fin-ai-card">
                  <div className="fin-panel-head">
                    <div className="fin-panel-title-wrap">
                      <span className="fin-ai-orb">
                        <Bot size={16} />
                      </span>
                      <div>
                        <h3>CFO IA & Recommandations</h3>
                        <small>Analyse basée sur tes vrais chiffres transporteurs, lots & pub</small>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="fin-ai-action-btn"
                      onClick={() =>
                        aiBriefingMutation.mutate({
                          viewMode,
                          startDate: range.startDate,
                          endDate: range.endDate,
                        })
                      }
                      disabled={aiBriefingMutation.isPending}
                    >
                      <Sparkles size={13} className={aiBriefingMutation.isPending ? "animate-spin" : ""} />
                      <span>{aiBriefingMutation.isPending ? "Analyse…" : "Analyser avec l'IA"}</span>
                    </button>
                  </div>

                  {aiBriefing && (
                    <div className="fin-ai-briefing-box">
                      <div className="fin-ai-score-row">
                        <span className={`fin-ai-score tone-${aiBriefing.verdictTone}`}>
                          Score {aiBriefing.healthScore}/100
                        </span>
                        <strong>{aiBriefing.headline}</strong>
                      </div>
                      <p>{aiBriefing.summaryParagraph}</p>
                      <div className="fin-ai-insights-grid">
                        {aiBriefing.insights.map((ins, i) => (
                          <div key={i} className={`fin-ai-insight-pill type-${ins.type}`}>
                            <strong>{ins.title}</strong>
                            <p>{ins.detail}</p>
                            <small>{ins.impactHint}</small>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Chat Copilot */}
                  <div className="fin-ai-chat-wrap">
                    <div className="fin-ai-quick-prompts">
                      {[
                        "Suis-je rentable globalement et pourquoi ?",
                        "Quel produit et quelle variante rapportent le plus ?",
                        "Que dois-je corriger aujourd'hui ?",
                      ].map(q => (
                        <button key={q} type="button" onClick={() => handleAskCopilot(q)}>
                          <MessageSquare size={11} />
                          <span>{q}</span>
                        </button>
                      ))}
                    </div>

                    {chatMessages.length > 0 && (
                      <div className="fin-ai-chat-history">
                        {chatMessages.map((msg, idx) => (
                          <div key={idx} className={`fin-chat-bubble role-${msg.role}`}>
                            {msg.text}
                          </div>
                        ))}
                      </div>
                    )}

                    <form
                      className="fin-ai-chat-form"
                      onSubmit={e => {
                        e.preventDefault();
                        handleAskCopilot();
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Demande à ton CFO IA (ex: combien j'ai gagné net sur DHD cette semaine ?)…"
                        value={chatQuestion}
                        onChange={e => setChatQuestion(e.target.value)}
                      />
                      <button type="submit" disabled={aiChatMutation.isPending || !chatQuestion.trim()}>
                        <Send size={14} />
                      </button>
                    </form>
                  </div>
                </div>

                {/* Waterfall Breakdown + Daily Trend Chart */}
                <div className="fin-two-col">
                  <div className="fin-panel-card">
                    <div className="fin-panel-head">
                      <div>
                        <h3>Cascade du Chiffre d’Affaires</h3>
                        <small>Où part chaque dinar sur la période</small>
                      </div>
                    </div>
                    <div className="fin-waterfall-list">
                      {data.waterfall.map(row => {
                        const widthPct = Math.min(100, Math.max(3, Math.abs(row.pctOfRevenue)));
                        return (
                          <div key={row.key} className="fin-wf-row">
                            <div className="fin-wf-meta">
                              <span>{row.label}</span>
                              <strong>
                                {row.key === "net" ? formatSignedDzd(row.amountDzd) : formatDZD(row.amountDzd)}
                                <small> ({row.pctOfRevenue}%)</small>
                              </strong>
                            </div>
                            <div className="fin-wf-track">
                              <div className={`fin-wf-fill tone-${row.tone}`} style={{ width: `${widthPct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="fin-panel-card">
                    <div className="fin-panel-head">
                      <div>
                        <h3>Bénéfice Net & Pub Jour par Jour</h3>
                        <small>Évolution quotidienne (DZD)</small>
                      </div>
                    </div>
                    {data.dailySeries.length === 0 ? (
                      <p className="fin-empty-hint">Aucune donnée sur cette plage de dates.</p>
                    ) : (
                      <div className="fin-chart-box">
                        <ResponsiveContainer width="100%" height={240}>
                          <ComposedChart data={data.dailySeries}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.16} />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 10 }} width={56} />
                            <Tooltip
                              formatter={(value: unknown, name: string) => [
                                `${Number(value || 0).toLocaleString("fr-DZ")} DA`,
                                name,
                              ]}
                            />
                            <Bar dataKey="grossRevenueDzd" name="CA Livré" fill="#8b5cf6" radius={[5, 5, 0, 0]} />
                            <Bar dataKey="adSpendDzd" name="Pub Ads" fill="#f59e0b" radius={[5, 5, 0, 0]} />
                            <Line
                              type="monotone"
                              dataKey="netProfitDzd"
                              name="Bénéfice Net"
                              stroke="#10b981"
                              strokeWidth={2.5}
                              dot={{ r: 3 }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>

                {/* Carriers + Wilayas */}
                <div className="fin-two-col">
                  <div className="fin-panel-card">
                    <div className="fin-panel-head">
                      <div>
                        <h3>Transporteurs : DHD vs E-com</h3>
                        <small>Taux livraison, retours ({data.settings.dhdReturnFeeDzd} / {data.settings.ecomReturnFeeDzd} DA) & trésorerie</small>
                      </div>
                    </div>
                    <div className="fin-carriers-grid">
                      {data.carriers.map(c => (
                        <div key={c.carrier} className="fin-carrier-box">
                          <div className="fin-carrier-top">
                            <strong><Truck size={14} /> {c.label}</strong>
                            <span className="fin-rate-pill">{c.deliveryRatePct}% livrées</span>
                          </div>
                          <div className="fin-carrier-metrics">
                            <div>
                              <span>Livrées / Retours</span>
                              <strong>{c.deliveredCount} / {c.returnedCount} ({c.returnRatePct}%)</strong>
                            </div>
                            <div>
                              <span>Frais livr. / retour</span>
                              <strong>{formatDZD(c.shippingFeeDzd)} / {formatDZD(c.returnFeeDzd)}</strong>
                            </div>
                            <div>
                              <span>Recouvré</span>
                              <strong className="is-emerald">{formatDZD(c.cashRecoveredDzd)}</strong>
                            </div>
                            <div>
                              <span>En attente virement</span>
                              <strong className="is-amber">{formatDZD(c.cashCollectedUnpaidDzd + c.cashDeliveredUnknownDzd)}</strong>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="fin-panel-card">
                    <div className="fin-panel-head">
                      <div>
                        <h3>Rentabilité par Wilaya</h3>
                        <small>Top wilayas classées par contribution nette</small>
                      </div>
                    </div>
                    <div className="fin-wilaya-list">
                      {data.wilayas.slice(0, 8).map(w => (
                        <div key={w.wilaya} className="fin-wilaya-row">
                          <div>
                            <strong>{w.wilaya}</strong>
                            <small>
                              {w.deliveredOrders} livrées · {w.returnedOrders} retours ({w.returnRatePct}%)
                            </small>
                          </div>
                          <div className="fin-wilaya-right">
                            <strong className={w.netProfitBeforeFixedDzd >= 0 ? "is-emerald" : "is-red"}>
                              {formatSignedDzd(w.netProfitBeforeFixedDzd)}
                            </strong>
                            <small>Frais {formatDZD(w.shippingAndReturnDzd)}</small>
                          </div>
                        </div>
                      ))}
                      {data.wilayas.length === 0 && (
                        <p className="fin-empty-hint">Aucune expédition wilaya sur cette période.</p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {tab === "products" && (
              <motion.div
                key="products"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="fin-tab-content"
              >
                <div className="fin-panel-card">
                  <div className="fin-products-toolbar">
                    <div className="fin-view-switch">
                      <button
                        type="button"
                        className={productBreakdownMode === "product" ? "is-active" : ""}
                        onClick={() => setProductBreakdownMode("product")}
                      >
                        Par Produit ({data.products.length})
                      </button>
                      <button
                        type="button"
                        className={productBreakdownMode === "variant" ? "is-active" : ""}
                        onClick={() => setProductBreakdownMode("variant")}
                      >
                        Par Variante ({data.variants.length})
                      </button>
                    </div>

                    <div className="fin-products-filters">
                      <input
                        type="search"
                        placeholder="Filtrer produit ou variante…"
                        value={productSearch}
                        onChange={e => setProductSearch(e.target.value)}
                      />
                      <select
                        value={productSort}
                        onChange={e => setProductSort(e.target.value as typeof productSort)}
                      >
                        <option value="profit_desc">Meilleur bénéfice</option>
                        <option value="profit_asc">Plus déficitaire</option>
                        <option value="return_desc">Pire taux retour</option>
                        <option value="orders_desc">Plus de volume</option>
                      </select>
                    </div>
                  </div>

                  <div className="fin-products-grid">
                    {filteredProductRows.map((row, idx) => {
                      const variantLabel = "variantKey" in row ? (row as { variantKey: string }).variantKey : "";
                      const cpaOverMax =
                        row.actualCpaDeliveredDzd !== null &&
                        row.breakevenCpaDeliveredDzd !== null &&
                        row.actualCpaDeliveredDzd > row.breakevenCpaDeliveredDzd;

                      return (
                        <div key={`${row.productId}-${variantLabel}-${idx}`} className={`fin-prod-card verdict-${row.verdict}`}>
                          <div className="fin-prod-head">
                            <div>
                              <strong>{row.productName}</strong>
                              {variantLabel && <span className="fin-variant-pill">{variantLabel}</span>}
                            </div>
                            <span className={`fin-verdict-tag verdict-${row.verdict}`}>
                              {row.verdict === "winner"
                                ? "🏆 Gagnant"
                                : row.verdict === "fragile"
                                  ? "⚠️ Limite"
                                  : row.verdict === "loser"
                                    ? "🔴 Déficitaire"
                                    : "⏳ En cours"}
                            </span>
                          </div>

                          <div className="fin-prod-net-row">
                            <div>
                              <span className="fin-sub-lbl">Bénéfice Net</span>
                              <strong className={`fin-prod-net ${row.netProfitDzd >= 0 ? "is-emerald" : "is-red"}`}>
                                {formatSignedDzd(row.netProfitDzd)}
                              </strong>
                            </div>
                            <div className="fin-prod-rates">
                              <span>Marge <b>{row.netMarginPct}%</b></span>
                              <span>Livr. <b>{row.deliveryRatePct}%</b></span>
                              <span className={row.returnRatePct >= 28 ? "is-red" : ""}>
                                Retour <b>{row.returnRatePct}%</b>
                              </span>
                            </div>
                          </div>

                          <div className="fin-prod-stats-grid">
                            <div>
                              <span>Volume</span>
                              <strong>{row.deliveredOrders} liv / {row.returnedOrders} ret</strong>
                            </div>
                            <div>
                              <span>Lot Achat Moy.</span>
                              <strong>
                                {row.avgLotUnitCostDzd > 0 ? formatDZD(row.avgLotUnitCostDzd) : "⚠️ Non saisi"}
                              </strong>
                            </div>
                            <div>
                              <span>Pub ($ / DA)</span>
                              <strong>${row.adSpendUsd} ({formatDZD(row.adSpendDzd)})</strong>
                            </div>
                            <div>
                              <span>CPA Réel / Max</span>
                              <strong className={cpaOverMax ? "is-red" : ""}>
                                {row.actualCpaDeliveredDzd ? formatDZD(row.actualCpaDeliveredDzd) : "—"} /{" "}
                                {row.breakevenCpaDeliveredDzd !== null ? formatDZD(row.breakevenCpaDeliveredDzd) : "—"}
                              </strong>
                            </div>
                          </div>

                          <div className="fin-prod-foot">
                            <small>
                              CA {formatDZD(row.grossRevenueDzd)} · Liv {formatDZD(row.shippingFeeDzd + row.returnFeeDzd)} · Comm {formatDZD(row.commissionDzd)}
                            </small>
                            <button
                              type="button"
                              className="fin-mini-btn"
                              onClick={() => openNewLotModal(row.productId, variantLabel === "Standard" ? "" : variantLabel)}
                            >
                              <Plus size={12} /> Lot
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {filteredProductRows.length === 0 && (
                      <p className="fin-empty-hint">Aucun produit ou variante trouvé sur cette période.</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {tab === "lots" && (
              <motion.div
                key="lots"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="fin-tab-content"
              >
                <div className="fin-panel-card">
                  <div className="fin-panel-head">
                    <div>
                      <h3>Lots d’Achat Stock (FIFO & Variantes)</h3>
                      <small>
                        Ex : semaine 1 à 500 DA, semaine 2 à 600 DA, et une variante précise à 800 DA.
                      </small>
                    </div>
                    <button type="button" className="fin-primary-btn" onClick={() => openNewLotModal()}>
                      <Plus size={14} /> Nouveau Lot
                    </button>
                  </div>

                  <div className="fin-lots-grid">
                    {data.lotHealth.map(lh => (
                      <div key={lh.lot.id} className={`fin-lot-card status-${lh.status}`}>
                        <div className="fin-lot-top">
                          <div>
                            <strong>{lh.lot.productName}</strong>
                            {lh.lot.variantKey ? (
                              <span className="fin-variant-pill">{lh.lot.variantKey}</span>
                            ) : (
                              <span className="fin-variant-pill is-generic">Toutes variantes</span>
                            )}
                          </div>
                          <strong className="fin-lot-price">{formatDZD(lh.lot.unitCostDzd)} / u</strong>
                        </div>

                        <div className="fin-lot-meta">
                          <span>📅 {lh.lot.purchasedAt}</span>
                          {lh.lot.supplier && <span>🏭 {lh.lot.supplier}</span>}
                          <span>Total : {lh.lot.quantityInitial} u</span>
                        </div>

                        <div className="fin-wf-track">
                          <div
                            className={`fin-wf-fill tone-${lh.status === "empty" ? "loss" : "profit"}`}
                            style={{ width: `${lh.pctRemaining}%` }}
                          />
                        </div>

                        <div className="fin-lot-bottom">
                          <small>
                            Restant <b>{lh.remainingQty}</b> · Livrés {lh.consumedDelivered} · En transit {lh.reservedInTransit}
                          </small>
                          <div className="fin-icon-actions">
                            <button
                              type="button"
                              aria-label="Modifier lot"
                              onClick={() => openNewLotModal(undefined, undefined, lh.lot)}
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              type="button"
                              aria-label="Supprimer lot"
                              onClick={() => {
                                if (window.confirm("Supprimer ce lot d'achat ?")) {
                                  deleteLotMutation.mutate({ id: lh.lot.id });
                                }
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {data.lotHealth.length === 0 && (
                      <div className="fin-empty-box">
                        <Package size={32} />
                        <p>Aucun lot saisi pour l’instant. Ajoute un lot initial daté rétroactivement pour chiffrer tes marges passées !</p>
                        <button type="button" className="fin-primary-btn" onClick={() => openNewLotModal()}>
                          <Plus size={14} /> Ajouter mon 1er lot
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {tab === "ads" && (
              <motion.div
                key="ads"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="fin-tab-content"
              >
                {/* API Connections Meta + TikTok */}
                <div className="fin-two-col">
                  <div className="fin-panel-card">
                    <div className="fin-panel-head">
                      <div>
                        <h3>Meta Marketing API (Facebook / IG)</h3>
                        <small>
                          {data.adConnections.meta.configured
                            ? `Connecté (${data.adConnections.meta.adAccountId} · ${data.adConnections.meta.tokenPreview})`
                            : "Non connecté"}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="fin-mini-btn"
                        disabled={!data.adConnections.meta.configured || syncAdsMutation.isPending}
                        onClick={() => syncAdsMutation.mutate({ platform: "meta" })}
                      >
                        <RefreshCw size={12} className={syncAdsMutation.isPending ? "animate-spin" : ""} /> Sync Meta
                      </button>
                    </div>
                    <form
                      className="fin-compact-form"
                      onSubmit={e => {
                        e.preventDefault();
                        saveAdCredsMutation.mutate({
                          platform: "meta",
                          accountId: metaAccountInput,
                          accessToken: metaTokenInput,
                        });
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Ad Account ID (ex: act_123456789)"
                        value={metaAccountInput}
                        onChange={e => setMetaAccountInput(e.target.value)}
                      />
                      <input
                        type="password"
                        placeholder={
                          data.adConnections.meta.configured
                            ? "Laisser vide pour garder le token actuel"
                            : "Token System User Meta Graph"
                        }
                        value={metaTokenInput}
                        onChange={e => setMetaTokenInput(e.target.value)}
                      />
                      <div className="fin-form-row-actions">
                        <button type="submit" className="fin-primary-btn" disabled={saveAdCredsMutation.isPending}>
                          <Link2 size={13} /> Enregistrer Meta
                        </button>
                        {data.adConnections.meta.configured && (
                          <button
                            type="button"
                            className="fin-danger-ghost"
                            onClick={() => clearAdCredsMutation.mutate({ platform: "meta" })}
                          >
                            Déconnecter
                          </button>
                        )}
                      </div>
                    </form>
                    {data.adConnections.meta.lastError && (
                      <p className="fin-error-note">{data.adConnections.meta.lastError}</p>
                    )}
                  </div>

                  <div className="fin-panel-card">
                    <div className="fin-panel-head">
                      <div>
                        <h3>TikTok Marketing API</h3>
                        <small>
                          {data.adConnections.tiktok.configured
                            ? `Connecté (${data.adConnections.tiktok.advertiserId} · ${data.adConnections.tiktok.tokenPreview})`
                            : "Non connecté"}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="fin-mini-btn"
                        disabled={!data.adConnections.tiktok.configured || syncAdsMutation.isPending}
                        onClick={() => syncAdsMutation.mutate({ platform: "tiktok" })}
                      >
                        <RefreshCw size={12} className={syncAdsMutation.isPending ? "animate-spin" : ""} /> Sync TikTok
                      </button>
                    </div>
                    <form
                      className="fin-compact-form"
                      onSubmit={e => {
                        e.preventDefault();
                        saveAdCredsMutation.mutate({
                          platform: "tiktok",
                          accountId: ttAdvInput,
                          accessToken: ttTokenInput,
                        });
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Advertiser ID TikTok (ex: 734567890123)"
                        value={ttAdvInput}
                        onChange={e => setTtAdvInput(e.target.value)}
                      />
                      <input
                        type="password"
                        placeholder={
                          data.adConnections.tiktok.configured
                            ? "Laisser vide pour garder le token actuel"
                            : "Access Token TikTok Business API"
                        }
                        value={ttTokenInput}
                        onChange={e => setTtTokenInput(e.target.value)}
                      />
                      <div className="fin-form-row-actions">
                        <button type="submit" className="fin-primary-btn" disabled={saveAdCredsMutation.isPending}>
                          <Link2 size={13} /> Enregistrer TikTok
                        </button>
                        {data.adConnections.tiktok.configured && (
                          <button
                            type="button"
                            className="fin-danger-ghost"
                            onClick={() => clearAdCredsMutation.mutate({ platform: "tiktok" })}
                          >
                            Déconnecter
                          </button>
                        )}
                      </div>
                    </form>
                    {data.adConnections.tiktok.lastError && (
                      <p className="fin-error-note">{data.adConnections.tiktok.lastError}</p>
                    )}
                  </div>
                </div>

                {/* Unmapped Campaigns + AI Mapper */}
                {data.unmappedCampaigns.length > 0 && (
                  <div className="fin-panel-card">
                    <div className="fin-panel-head">
                      <div>
                        <h3>Campagnes à Lier aux Produits ({data.unmappedCampaigns.length})</h3>
                        <small>Liaison automatique mémorisée pour les prochains jours</small>
                      </div>
                      <button
                        type="button"
                        className="fin-ai-action-btn"
                        disabled={autoMapAiMutation.isPending}
                        onClick={() =>
                          autoMapAiMutation.mutate({
                            unmapped: data.unmappedCampaigns.map(c => ({
                              campaignId: c.campaignId,
                              campaignName: c.campaignName,
                              platform: c.platform,
                            })),
                          })
                        }
                      >
                        <Sparkles size={13} /> Auto-mapper par IA
                      </button>
                    </div>
                    <div className="fin-mapping-list">
                      {data.unmappedCampaigns.map(camp => (
                        <div key={camp.campaignId} className="fin-mapping-row">
                          <div>
                            <span className={`fin-plat-pill plat-${camp.platform}`}>
                              {camp.platform === "meta" ? "Meta" : "TikTok"}
                            </span>
                            <strong>{camp.campaignName}</strong>
                            <small>${camp.spendUsd} ({formatDZD(camp.spendDzd)})</small>
                          </div>
                          <select
                            defaultValue=""
                            onChange={e => {
                              const pid = e.target.value;
                              if (!pid) return;
                              saveMappingMutation.mutate({
                                campaignId: camp.campaignId,
                                campaignName: camp.campaignName,
                                platform: camp.platform,
                                productId: pid,
                                variantKey: "",
                                mappedBy: "manual",
                              });
                            }}
                          >
                            <option value="">Choisir le produit…</option>
                            {catalog.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Exchange Rate History + Manual / CSV Spend */}
                <div className="fin-two-col">
                  <div className="fin-panel-card">
                    <div className="fin-panel-head">
                      <div>
                        <h3>Taux de Change Réel ($ USD ➔ DZD)</h3>
                        <small>Historisé par date d’effet pour ne pas fausser les jours passés</small>
                      </div>
                    </div>
                    <form
                      className="fin-compact-form"
                      onSubmit={e => {
                        e.preventDefault();
                        saveFxMutation.mutate({
                          effectiveDate: fxDate,
                          usdToDzd: Number(fxUsdDzd) || 250,
                          note: fxNote,
                        });
                      }}
                    >
                      <div className="fin-form-pair">
                        <input type="date" value={fxDate} onChange={e => setFxDate(e.target.value)} />
                        <input
                          type="number"
                          min="1"
                          step="0.5"
                          placeholder="1 USD = DZD (ex: 250)"
                          value={fxUsdDzd}
                          onChange={e => setFxUsdDzd(e.target.value)}
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Note (ex: RedotPay / Square)"
                        value={fxNote}
                        onChange={e => setFxNote(e.target.value)}
                      />
                      <button type="submit" className="fin-primary-btn">Enregistrer Taux</button>
                    </form>
                    <div className="fin-mini-list">
                      {data.exchangeRates.map(fx => (
                        <div key={fx.id} className="fin-mini-list-row">
                          <span>{fx.effectiveDate} · <b>1$ = {fx.usdToDzd} DA</b> {fx.note ? `(${fx.note})` : ""}</span>
                          <button type="button" onClick={() => deleteFxMutation.mutate({ id: fx.id })}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="fin-panel-card">
                    <div className="fin-panel-head">
                      <div>
                        <h3>Ajout Rapide / Import CSV Pub</h3>
                        <small>Secours immédiat si API en attente de validation</small>
                      </div>
                    </div>
                    <form className="fin-compact-form" onSubmit={handleSaveManualAd}>
                      <div className="fin-form-pair">
                        <input type="date" value={adDate} onChange={e => setAdDate(e.target.value)} />
                        <select value={adPlatform} onChange={e => setAdPlatform(e.target.value as FinanceAdPlatform)}>
                          <option value="tiktok">TikTok Ads</option>
                          <option value="meta">Meta Ads</option>
                        </select>
                      </div>
                      <div className="fin-form-pair">
                        <select value={adProductId} onChange={e => setAdProductId(e.target.value)}>
                          <option value="">Produit associé…</option>
                          {catalog.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="Variante opt. (ex: Blonde)"
                          value={adVariantKey}
                          onChange={e => setAdVariantKey(e.target.value)}
                        />
                      </div>
                      <div className="fin-form-pair">
                        <input
                          type="text"
                          placeholder="Nom campagne (ex: EXT_TIK_01)"
                          value={adCampaignName}
                          onChange={e => setAdCampaignName(e.target.value)}
                        />
                        <div className="fin-currency-pair">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Dépense"
                            value={adSpendAmount}
                            onChange={e => setAdSpendAmount(e.target.value)}
                          />
                          <select value={adCurrency} onChange={e => setAdCurrency(e.target.value as FinanceAdCurrency)}>
                            <option value="USD">$ USD</option>
                            <option value="EUR">€ EUR</option>
                            <option value="DZD">DA</option>
                          </select>
                        </div>
                      </div>
                      <button type="submit" className="fin-primary-btn">
                        <Plus size={13} /> Ajouter dépense pub
                      </button>
                    </form>

                    <div className="fin-csv-import-box">
                      <div className="fin-form-pair">
                        <select value={csvPlatform} onChange={e => setCsvPlatform(e.target.value as FinanceAdPlatform)}>
                          <option value="meta">CSV Meta Ads</option>
                          <option value="tiktok">CSV TikTok Ads</option>
                        </select>
                        <select value={csvCurrency} onChange={e => setCsvCurrency(e.target.value as FinanceAdCurrency)}>
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="DZD">DZD</option>
                        </select>
                      </div>
                      <label className="fin-file-upload">
                        <Upload size={13} />
                        <span>Choisir export .CSV Meta / TikTok</span>
                        <input type="file" accept=".csv,.txt" onChange={e => void handleCsvFileUpload(e)} />
                      </label>
                      {csvText && (
                        <button
                          type="button"
                          className="fin-mini-btn"
                          onClick={() =>
                            importCsvMutation.mutate({
                              platform: csvPlatform,
                              csvText,
                              defaultCurrency: csvCurrency,
                            })
                          }
                        >
                          Importer le CSV ({csvText.split(/\r?\n/).length} lignes)
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Recent Ad Spend Entries */}
                <div className="fin-panel-card">
                  <div className="fin-panel-head">
                    <h3>Historique Dépenses Pub ({data.adSpends.length})</h3>
                  </div>
                  <div className="fin-mini-list">
                    {data.adSpends.slice(0, 20).map(item => (
                      <div key={item.id} className="fin-mini-list-row">
                        <span>
                          <b className={`fin-plat-pill plat-${item.platform}`}>{item.platform.toUpperCase()}</b>{" "}
                          {item.date} · {item.campaignName} · <b>{item.spendAmount} {item.currency}</b>
                        </span>
                        <button type="button" onClick={() => deleteAdSpendMutation.mutate({ id: item.id })}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    {data.adSpends.length === 0 && (
                      <p className="fin-empty-hint">Aucune dépense pub enregistrée pour le moment.</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {tab === "charges" && (
              <motion.div
                key="charges"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="fin-tab-content"
              >
                <div className="fin-two-col">
                  <div className="fin-panel-card">
                    <div className="fin-panel-head">
                      <div>
                        <h3>Ajouter Charge Journalière ou Fixe</h3>
                        <small>Cartons d’emballage, loyer, salaires, UGC, transport stock…</small>
                      </div>
                    </div>
                    <form className="fin-compact-form" onSubmit={handleSaveExpense}>
                      <div className="fin-form-pair">
                        <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} />
                        <select value={expFreq} onChange={e => setExpFreq(e.target.value as "daily" | "monthly_fixed")}>
                          <option value="daily">Charge Journalière / Ponctuelle</option>
                          <option value="monthly_fixed">Charge Fixe Mensuelle (proratisée/j)</option>
                        </select>
                      </div>
                      <div className="fin-form-pair">
                        <select value={expCat} onChange={e => setExpCat(e.target.value as FinanceExpenseCategory)}>
                          {(Object.keys(FINANCE_EXPENSE_CATEGORY_LABELS) as FinanceExpenseCategory[]).map(k => (
                            <option key={k} value={k}>{FINANCE_EXPENSE_CATEGORY_LABELS[k]}</option>
                          ))}
                        </select>
                        <div className="fin-currency-pair">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="Montant"
                            value={expAmount}
                            onChange={e => setExpAmount(e.target.value)}
                          />
                          <select value={expCurrency} onChange={e => setExpCurrency(e.target.value as FinanceAdCurrency)}>
                            <option value="DZD">DA</option>
                            <option value="USD">$ USD</option>
                            <option value="EUR">€ EUR</option>
                          </select>
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="Libellé (ex: Loyer dépôt / Carton 500 sachets / Shooting)"
                        value={expTitle}
                        onChange={e => setExpTitle(e.target.value)}
                      />
                      <button type="submit" className="fin-primary-btn" disabled={upsertExpenseMutation.isPending}>
                        <Plus size={13} /> Enregistrer la charge
                      </button>
                    </form>

                    <div className="fin-mini-list">
                      {data.expenses.map(exp => (
                        <div key={exp.id} className="fin-mini-list-row">
                          <span>
                            <b>{exp.frequency === "monthly_fixed" ? "Fixe/mois" : exp.date}</b> · {exp.title} ·{" "}
                            <b>{exp.amount} {exp.currency}</b>
                          </span>
                          <button type="button" onClick={() => deleteExpenseMutation.mutate({ id: exp.id })}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                      {data.expenses.length === 0 && (
                        <p className="fin-empty-hint">Aucune charge enregistrée.</p>
                      )}
                    </div>
                  </div>

                  <div className="fin-panel-card">
                    <div className="fin-panel-head">
                      <div>
                        <h3>Règles de Calcul Transporteurs & Emballage</h3>
                        <small>Paramètres exacts appliqués au calcul de bénéfice net</small>
                      </div>
                    </div>
                    <form
                      className="fin-compact-form"
                      onSubmit={e => {
                        e.preventDefault();
                        updateSettingsMutation.mutate(settingsDraft);
                      }}
                    >
                      <label className="fin-field-row">
                        <span>Emballage par colis expédié (DA)</span>
                        <input
                          type="number"
                          min="0"
                          value={settingsDraft.packagingPerParcelDzd}
                          onChange={e =>
                            setSettingsDraft(s => ({ ...s, packagingPerParcelDzd: Number(e.target.value) || 0 }))
                          }
                        />
                      </label>
                      <label className="fin-field-row">
                        <span>Frais retour E-com Delivery (DA)</span>
                        <input
                          type="number"
                          min="0"
                          value={settingsDraft.ecomReturnFeeDzd}
                          onChange={e =>
                            setSettingsDraft(s => ({ ...s, ecomReturnFeeDzd: Number(e.target.value) || 0 }))
                          }
                        />
                      </label>
                      <label className="fin-field-row">
                        <span>Frais retour DHD / EcoTrack (DA)</span>
                        <input
                          type="number"
                          min="0"
                          value={settingsDraft.dhdReturnFeeDzd}
                          onChange={e =>
                            setSettingsDraft(s => ({ ...s, dhdReturnFeeDzd: Number(e.target.value) || 0 }))
                          }
                        />
                      </label>
                      <label className="fin-field-row">
                        <span>Taux USD par défaut ($1 = DA)</span>
                        <input
                          type="number"
                          min="1"
                          value={settingsDraft.defaultUsdToDzd}
                          onChange={e =>
                            setSettingsDraft(s => ({ ...s, defaultUsdToDzd: Number(e.target.value) || 250 }))
                          }
                        />
                      </label>
                      <label className="fin-check-row">
                        <input
                          type="checkbox"
                          checked={settingsDraft.chargeOutboundShippingOnReturn}
                          onChange={e =>
                            setSettingsDraft(s => ({ ...s, chargeOutboundShippingOnReturn: e.target.checked }))
                          }
                        />
                        <span>Ajouter la course aller sur un retour (désactivé = juste 50 / 0 DA)</span>
                      </label>
                      <label className="fin-check-row">
                        <input
                          type="checkbox"
                          checked={settingsDraft.includeStaffBaseSalary}
                          onChange={e =>
                            setSettingsDraft(s => ({ ...s, includeStaffBaseSalary: e.target.checked }))
                          }
                        />
                        <span>Inclure salaires fixes mensuels des confirmateurs</span>
                      </label>
                      <label className="fin-check-row">
                        <input
                          type="checkbox"
                          checked={settingsDraft.autoSyncAdsEnabled}
                          onChange={e =>
                            setSettingsDraft(s => ({ ...s, autoSyncAdsEnabled: e.target.checked }))
                          }
                        />
                        <span>Synchroniser automatiquement Meta & TikTok Ads toutes les 2h</span>
                      </label>
                      <button type="submit" className="fin-primary-btn" disabled={updateSettingsMutation.isPending}>
                        <CheckCircle2 size={14} /> Sauvegarder les règles
                      </button>
                    </form>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Modal / Bottom Sheet: Add / Edit FIFO Purchase Lot */}
      {lotModalOpen && (
        <div className="fin-modal-overlay" onClick={() => setLotModalOpen(false)}>
          <div className="fin-modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="fin-modal-head">
              <h3>{editingLot ? "Modifier le lot d'achat" : "Nouveau lot d'achat stock"}</h3>
              <button type="button" onClick={() => setLotModalOpen(false)} aria-label="Fermer">
                <X size={18} />
              </button>
            </div>
            <form className="fin-compact-form" onSubmit={handleSaveLot}>
              <label className="fin-stack-field">
                <span>Produit</span>
                <select value={lotProductId} onChange={e => setLotProductId(e.target.value)} required>
                  {catalog.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
              <label className="fin-stack-field">
                <span>Variante précise (optionnel : couleur/taille ex « Blonde », ou vide pour tout le produit)</span>
                <input
                  type="text"
                  placeholder="Laisser vide = toutes variantes"
                  value={lotVariantKey}
                  onChange={e => setLotVariantKey(e.target.value)}
                />
              </label>
              <div className="fin-form-pair">
                <label className="fin-stack-field">
                  <span>Date d’achat (peut être antérieure)</span>
                  <input type="date" value={lotDate} onChange={e => setLotDate(e.target.value)} required />
                </label>
                <label className="fin-stack-field">
                  <span>Quantité achetée</span>
                  <input type="number" min="1" value={lotQty} onChange={e => setLotQty(e.target.value)} required />
                </label>
              </div>
              <div className="fin-form-pair">
                <label className="fin-stack-field">
                  <span>Coût d'achat unitaire (DZD)</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={lotUnitCost}
                    onChange={e => setLotUnitCost(e.target.value)}
                    required
                  />
                </label>
                <label className="fin-stack-field">
                  <span>Fournisseur (optionnel)</span>
                  <input
                    type="text"
                    placeholder="Ex: Grossiste Alger"
                    value={lotSupplier}
                    onChange={e => setLotSupplier(e.target.value)}
                  />
                </label>
              </div>
              <label className="fin-stack-field">
                <span>Note (optionnel)</span>
                <input
                  type="text"
                  placeholder="Ex: Lot semaine 1 avant hausse prix"
                  value={lotNote}
                  onChange={e => setLotNote(e.target.value)}
                />
              </label>
              <button type="submit" className="fin-primary-btn" disabled={upsertLotMutation.isPending}>
                <ShieldCheck size={14} /> Enregistrer le lot FIFO
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
