import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  Eye,
  GitCompareArrows,
  Layers,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { getCatalogProducts, type Order } from "@/lib/store-data";
import {
  buildVisitDashboardSummary,
  getAlgiersDateKey,
  shiftDateKey,
  type VisitAnalyticsData,
  type VisitCompareMode,
  type VisitDateFilterKey,
  type VisitSeriesPoint,
  type VisitSource,
} from "@shared/siteVisits";

type Props = {
  data?: VisitAnalyticsData;
  isLoading?: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  orders: Order[];
};

const DATE_PRESETS: Array<{ key: VisitDateFilterKey; label: string }> = [
  { key: "today", label: "Aujourd'hui" },
  { key: "yesterday", label: "Hier" },
  { key: "7d", label: "7 jours" },
  { key: "14d", label: "14 jours" },
  { key: "30d", label: "30 jours" },
  { key: "all", label: "Tout" },
  { key: "custom", label: "Dates" },
];

const SOURCE_META: Record<VisitSource, { label: string; badgeClass: string }> = {
  facebook: { label: "Meta / Facebook", badgeClass: "src-meta" },
  tiktok: { label: "TikTok Ads", badgeClass: "src-tiktok" },
  google: { label: "Google", badgeClass: "src-google" },
  direct: { label: "Direct / Lien", badgeClass: "src-direct" },
  other: { label: "Autres sites", badgeClass: "src-other" },
};

function useAnimatedNumber(target: number, animKey: number, durationMs = 900): number {
  const [display, setDisplay] = useState(target);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
      setDisplay(target);
      return;
    }
    let raf = 0;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(target * eased));
      if (progress < 1) {
        raf = window.requestAnimationFrame(tick);
      }
    };
    setDisplay(0);
    raf = window.requestAnimationFrame(tick);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [target, animKey, durationMs]);
  return display;
}

type SvgCoord = { x: number; y: number };

function buildSmoothCurvePath(coords: SvgCoord[]): string {
  if (coords.length === 0) return "";
  if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;
  let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i - 1] ?? coords[i];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("fr-DZ").format(n);
}

export function VisitsAnalyticsChart({
  data,
  isLoading,
  isRefreshing,
  onRefresh,
  orders,
}: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const catalog = useMemo(() => getCatalogProducts(), []);

  const [dateFilter, setDateFilter] = useState<VisitDateFilterKey>("7d");
  const [customFrom, setCustomFrom] = useState(() => shiftDateKey(getAlgiersDateKey(), -6));
  const [customTo, setCustomTo] = useState(() => getAlgiersDateKey());
  const [selectedProductKey, setSelectedProductKey] = useState<string>("all");
  const [compareMode, setCompareMode] = useState<VisitCompareMode>("previous_period");
  const [compareProductKey, setCompareProductKey] = useState<string>(() => catalog[1]?.id || catalog[0]?.id || "__home__");
  const [chartStyle, setChartStyle] = useState<"area" | "bars">("area");
  const [animKey, setAnimKey] = useState(1);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [showCompareTable, setShowCompareTable] = useState(true);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const summary = useMemo(
    () =>
      buildVisitDashboardSummary({
        data,
        orders,
        catalog,
        dateFilter,
        selectedProductKey,
        compareMode,
        compareProductKey,
        customFrom,
        customTo,
      }),
    [data, orders, catalog, dateFilter, selectedProductKey, compareMode, compareProductKey, customFrom, customTo],
  );

  // Trigger entrance WAW animation whenever filters or mode change
  useEffect(() => {
    setAnimKey(k => k + 1);
    setHoveredIdx(null);
  }, [dateFilter, selectedProductKey, compareMode, compareProductKey, chartStyle, customFrom, customTo]);

  // All selectable product options (merged catalog + any visited keys)
  const productOptions = useMemo(() => {
    const map = new Map<string, { key: string; label: string; image?: string }>();
    map.set("__home__", { key: "__home__", label: "🏠 Accueil Boutique" });
    map.set("__catalogue__", { key: "__catalogue__", label: "🛍️ Page Catalogue" });
    map.set("__checkout__", { key: "__checkout__", label: "🧾 Page Commande" });
    for (const p of catalog) {
      map.set(p.id, { key: p.id, label: p.name, image: p.image });
    }
    for (const r of summary.productRows) {
      if (!map.has(r.productKey)) {
        map.set(r.productKey, { key: r.productKey, label: r.name });
      }
    }
    return Array.from(map.values());
  }, [catalog, summary.productRows]);

  const productMetaByKey = useMemo(() => {
    const map = new Map<string, { label: string; image?: string }>();
    for (const opt of productOptions) {
      map.set(opt.key, { label: opt.label, image: opt.image });
    }
    return map;
  }, [productOptions]);

  const animatedTotalViews = useAnimatedNumber(summary.totalViews, animKey, 950);
  const animatedUniqueVisitors = useAnimatedNumber(summary.uniqueVisitors, animKey, 850);
  const animatedOrdersCount = useAnimatedNumber(summary.ordersInPeriod, animKey, 800);

  // SVG Geometry (viewBox 760 x 220)
  const W = 760;
  const H = 220;
  const PAD_L = 44;
  const PAD_R = 16;
  const PAD_T = 20;
  const PAD_B = 34;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const points: VisitSeriesPoint[] = summary.points;
  const rawMax = useMemo(() => {
    let m = 4;
    for (const pt of points) {
      if (pt.views > m) m = pt.views;
      if (pt.compareViews !== null && pt.compareViews > m) m = pt.compareViews;
    }
    return Math.ceil(m * 1.18);
  }, [points]);

  const primaryCoords: SvgCoord[] = useMemo(() => {
    const count = points.length;
    return points.map((pt, i) => {
      const x = count <= 1 ? PAD_L + plotW / 2 : PAD_L + (i / (count - 1)) * plotW;
      const y = PAD_T + plotH - (pt.views / rawMax) * plotH;
      return { x, y };
    });
  }, [points, plotW, plotH, rawMax]);

  const compareCoords: SvgCoord[] = useMemo(() => {
    if (compareMode === "none") return [];
    const count = points.length;
    return points.map((pt, i) => {
      const x = count <= 1 ? PAD_L + plotW / 2 : PAD_L + (i / (count - 1)) * plotW;
      const val = pt.compareViews ?? 0;
      const y = PAD_T + plotH - (val / rawMax) * plotH;
      return { x, y };
    });
  }, [points, compareMode, plotW, plotH, rawMax]);

  const primaryLineD = useMemo(() => buildSmoothCurvePath(primaryCoords), [primaryCoords]);
  const primaryAreaD = useMemo(() => {
    if (!primaryLineD || primaryCoords.length === 0) return "";
    const first = primaryCoords[0];
    const last = primaryCoords[primaryCoords.length - 1];
    const baseline = PAD_T + plotH;
    return `${primaryLineD} L ${last.x.toFixed(1)} ${baseline} L ${first.x.toFixed(1)} ${baseline} Z`;
  }, [primaryLineD, primaryCoords, plotH]);

  const compareLineD = useMemo(
    () => (compareCoords.length > 0 ? buildSmoothCurvePath(compareCoords) : ""),
    [compareCoords],
  );
  const compareAreaD = useMemo(() => {
    if (!compareLineD || compareCoords.length === 0) return "";
    const first = compareCoords[0];
    const last = compareCoords[compareCoords.length - 1];
    const baseline = PAD_T + plotH;
    return `${compareLineD} L ${last.x.toFixed(1)} ${baseline} L ${first.x.toFixed(1)} ${baseline} Z`;
  }, [compareLineD, compareCoords, plotH]);

  const yTicks = useMemo(() => {
    return [0, 0.25, 0.5, 0.75, 1].map(ratio => ({
      val: Math.round(rawMax * ratio),
      y: PAD_T + plotH - ratio * plotH,
    }));
  }, [rawMax, plotH]);

  const handleSvgPointer = (clientX: number) => {
    const svgEl = svgRef.current;
    if (!svgEl || points.length === 0) return;
    const rect = svgEl.getBoundingClientRect();
    if (!rect.width) return;
    const relX = ((clientX - rect.left) / rect.width) * W;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < primaryCoords.length; i++) {
      const dist = Math.abs(primaryCoords[i].x - relX);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    setHoveredIdx(bestIdx);
  };

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;
  const activeCoord = hoveredIdx !== null ? primaryCoords[hoveredIdx] : null;
  const activeCompareCoord = hoveredIdx !== null ? compareCoords[hoveredIdx] : null;

  const primaryLegendName =
    selectedProductKey === "all"
      ? "Tout le site"
      : productMetaByKey.get(selectedProductKey)?.label || selectedProductKey;

  const compareLegendName =
    compareMode === "previous_period"
      ? "Période précédente"
      : compareMode === "product"
      ? productMetaByKey.get(compareProductKey)?.label || compareProductKey
      : "";

  const maxProductViews = Math.max(1, ...summary.productRows.map(r => r.views));

  return (
    <section className="gcome-visits-hub" aria-label="Analytique des visites du site et des produits">
      <div className="gcome-visits-ambient" aria-hidden="true" />

      {/* ===== HEADER: TITRE + COMPTEUR PRINCIPAL + ACTIONS ===== */}
      <div className="gcome-visits-head">
        <div className="gcome-visits-title-wrap">
          <div className="gcome-visits-live-badge">
            <span className="gcome-live-dot" aria-hidden="true" />
            <span>TRAFIC SITE &amp; PRODUITS · LIVE</span>
            <span className="gcome-range-chip">{summary.rangeLabel}</span>
          </div>
          <h2 className="gcome-visits-heading">
            Visites &amp; Audience Boutique
          </h2>
          <p className="gcome-visits-sub">
            {selectedProductKey === "all"
              ? "Suivi temps réel des visites globales et par fiche produit"
              : `Focus produit : ${primaryLegendName}`}
            {compareMode !== "none" && compareLegendName ? ` · Comparé à ${compareLegendName}` : ""}
          </p>
        </div>

        <div className="gcome-visits-hero-metrics">
          <div className="gcome-vm-card is-primary">
            <div className="gcome-vm-top">
              <Eye size={15} />
              <span>Visites</span>
              {summary.deltaPct !== null && (
                <span className={`gcome-vm-delta ${summary.deltaPct >= 0 ? "is-up" : "is-down"}`}>
                  {summary.deltaPct >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {summary.deltaPct > 0 ? `+${summary.deltaPct}%` : `${summary.deltaPct}%`}
                </span>
              )}
            </div>
            <strong className="gcome-vm-num">{formatNumber(animatedTotalViews)}</strong>
            <span className="gcome-vm-hint">
              {compareMode !== "none" && summary.compareTotalViews !== null
                ? `vs ${formatNumber(summary.compareTotalViews)} (${compareLegendName})`
                : summary.hourlyMode
                ? "Vue heure par heure"
                : "Total sur la période"}
            </span>
          </div>

          <div className="gcome-vm-card is-cyan">
            <div className="gcome-vm-top">
              <Users size={15} />
              <span>Visiteurs uniques</span>
            </div>
            <strong className="gcome-vm-num">{formatNumber(animatedUniqueVisitors)}</strong>
            <span className="gcome-vm-hint">Sessions distinctes</span>
          </div>

          <div className="gcome-vm-card is-mint">
            <div className="gcome-vm-top">
              <ShoppingBag size={15} />
              <span>Conversion</span>
            </div>
            <strong className="gcome-vm-num">
              {summary.conversionRate === null ? "—" : `${summary.conversionRate}%`}
            </strong>
            <span className="gcome-vm-hint">
              {formatNumber(animatedOrdersCount)} commande{animatedOrdersCount > 1 ? "s" : ""} liée
              {animatedOrdersCount > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* ===== BARRE DES FILTRES (DATE + PRODUIT + COMPARAISON + VUE) ===== */}
      <div className="gcome-visits-controls">
        {/* Filtre Date */}
        <div className="gcome-visits-filter-group">
          <span className="gcome-filter-label">
            <Calendar size={13} /> Période
          </span>
          <div className="gcome-date-pills" role="tablist" aria-label="Filtrer par date">
            {DATE_PRESETS.map(p => (
              <button
                key={p.key}
                type="button"
                className={`gcome-date-pill${dateFilter === p.key ? " is-active" : ""}`}
                onClick={() => setDateFilter(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          {dateFilter === "custom" && (
            <div className="gcome-custom-dates">
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                aria-label="Date de début"
              />
              <span>→</span>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                aria-label="Date de fin"
              />
            </div>
          )}
        </div>

        {/* Filtre Produit + Comparaison + Style + Replay */}
        <div className="gcome-visits-filter-group is-right">
          <label className="gcome-select-pill">
            <Sparkles size={13} />
            <select
              value={selectedProductKey}
              onChange={e => setSelectedProductKey(e.target.value)}
              aria-label="Filtrer par produit"
            >
              <option value="all">🌐 Tout le site (Tous les produits)</option>
              {productOptions.map(opt => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="gcome-select-pill is-compare">
            <GitCompareArrows size={13} />
            <select
              value={compareMode}
              onChange={e => {
                const next = e.target.value as VisitCompareMode;
                setCompareMode(next);
                if (next === "product" && compareProductKey === selectedProductKey) {
                  const alt = productOptions.find(o => o.key !== selectedProductKey)?.key || "__home__";
                  setCompareProductKey(alt);
                }
              }}
              aria-label="Mode de comparaison"
            >
              <option value="previous_period">📈 Comparer : Période préc.</option>
              <option value="product">⚔️ Comparer : Produit vs Produit</option>
              <option value="none">➖ Sans comparaison</option>
            </select>
          </label>

          {compareMode === "product" && (
            <label className="gcome-select-pill is-compare-target">
              <span>VS</span>
              <select
                value={compareProductKey}
                onChange={e => setCompareProductKey(e.target.value)}
                aria-label="Produit à comparer"
              >
                {productOptions.map(opt => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="gcome-view-switch" role="group" aria-label="Style de graphique">
            <button
              type="button"
              className={`gcome-view-btn${chartStyle === "area" ? " is-active" : ""}`}
              onClick={() => setChartStyle("area")}
              title="Courbe néon animée"
            >
              <TrendingUp size={14} />
              <span>Courbe</span>
            </button>
            <button
              type="button"
              className={`gcome-view-btn${chartStyle === "bars" ? " is-active" : ""}`}
              onClick={() => setChartStyle("bars")}
              title="Barres comparatives animées"
            >
              <BarChart3 size={14} />
              <span>Barres</span>
            </button>
          </div>

          <button
            type="button"
            className="gcome-icon-chip"
            onClick={() => setAnimKey(k => k + 1)}
            title="Rejouer l'animation d'entrée"
            aria-label="Rejouer l'animation"
          >
            <RotateCcw size={14} />
          </button>

          {onRefresh && (
            <button
              type="button"
              className="gcome-icon-chip"
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Actualiser les visites en direct"
              aria-label="Actualiser les visites"
            >
              <RefreshCw size={14} className={isRefreshing ? "spin" : ""} />
            </button>
          )}
        </div>
      </div>

      {/* ===== ZONE GRAPHE SVG ANIMÉE "WAW" ===== */}
      <div className="gcome-visits-canvas-shell" key={animKey}>
        {compareMode !== "none" && (
          <div className="gcome-chart-legend">
            <span className="gcome-legend-item is-primary">
              <i />
              <span>{primaryLegendName}</span>
              <b>{formatNumber(summary.totalViews)}</b>
            </span>
            <span className="gcome-legend-item is-compare">
              <i />
              <span>{compareLegendName}</span>
              <b>{formatNumber(summary.compareTotalViews ?? 0)}</b>
            </span>
          </div>
        )}

        <div
          className="gcome-visits-svg-wrap"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <svg
            ref={svgRef}
            className="gcome-visits-svg"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            role="img"
            aria-label="Graphique du nombre de visites sur le site"
            onMouseMove={e => handleSvgPointer(e.clientX)}
            onTouchStart={e => e.touches[0] && handleSvgPointer(e.touches[0].clientX)}
            onTouchMove={e => e.touches[0] && handleSvgPointer(e.touches[0].clientX)}
          >
            <defs>
              <linearGradient id={`area-prim-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.46" />
                <stop offset="55%" stopColor="#ec4899" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.01" />
              </linearGradient>

              <linearGradient id={`stroke-prim-${uid}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#7c3aed" />
                <stop offset="50%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>

              <linearGradient id={`area-comp-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.01" />
              </linearGradient>

              <linearGradient id={`bar-prim-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c084fc" />
                <stop offset="45%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>

              <linearGradient id={`bar-comp-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#67e8f9" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>

              <filter id={`glow-prim-${uid}`} x="-15%" y="-25%" width="130%" height="150%">
                <feGaussianBlur stdDeviation="3.2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <clipPath id={`sweep-clip-${uid}`}>
                <rect
                  x="0"
                  y="0"
                  width={W}
                  height={H}
                  className="gcome-svg-sweep-rect"
                />
              </clipPath>
            </defs>

            {/* Horizontal subtle gridlines + Y labels */}
            {yTicks.map((t, idx) => (
              <g key={idx}>
                <line
                  x1={PAD_L}
                  y1={t.y}
                  x2={W - PAD_R}
                  y2={t.y}
                  className="gcome-grid-line"
                />
                <text
                  x={PAD_L - 8}
                  y={t.y + 3.5}
                  textAnchor="end"
                  className="gcome-axis-label"
                >
                  {t.val}
                </text>
              </g>
            ))}

            {/* CHART RENDER */}
            {chartStyle === "area" ? (
              <g clipPath={`url(#sweep-clip-${uid})`}>
                {compareLineD && (
                  <>
                    <path d={compareAreaD} fill={`url(#area-comp-${uid})`} className="gcome-area-fade" />
                    <path
                      d={compareLineD}
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="2.4"
                      strokeDasharray="6 5"
                      strokeLinecap="round"
                    />
                  </>
                )}

                {primaryAreaD && (
                  <path d={primaryAreaD} fill={`url(#area-prim-${uid})`} className="gcome-area-fade" />
                )}

                {primaryLineD && (
                  <path
                    d={primaryLineD}
                    fill="none"
                    stroke={`url(#stroke-prim-${uid})`}
                    strokeWidth="3.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter={`url(#glow-prim-${uid})`}
                  />
                )}

                {/* Subtle nodes & glowing live dot on the last point */}
                {primaryCoords.map((c, idx) => {
                  const isLast = idx === primaryCoords.length - 1;
                  if (!isLast && points.length > 16) return null;
                  return (
                    <g key={idx}>
                      {isLast && (
                        <circle cx={c.x} cy={c.y} r="9" className="gcome-live-pulse-ring" />
                      )}
                      <circle
                        cx={c.x}
                        cy={c.y}
                        r={isLast ? 4.8 : 3.2}
                        className={isLast ? "gcome-live-dot-core" : "gcome-node-dot"}
                      />
                    </g>
                  );
                })}
              </g>
            ) : (
              <g>
                {points.map((pt, i) => {
                  const slotW = plotW / Math.max(1, points.length);
                  const hasCompare = compareMode !== "none";
                  const barW = hasCompare
                    ? Math.max(4, Math.min(18, slotW * 0.34))
                    : Math.max(5, Math.min(26, slotW * 0.56));
                  const cx = primaryCoords[i]?.x ?? PAD_L;
                  const baseline = PAD_T + plotH;
                  const hA = Math.max(2, (pt.views / rawMax) * plotH);
                  const hB = pt.compareViews !== null ? Math.max(2, (pt.compareViews / rawMax) * plotH) : 0;
                  const delay = `${Math.min(i * 25, 650)}ms`;
                  return (
                    <g key={pt.key}>
                      {hasCompare && (
                        <rect
                          x={cx + 2}
                          y={baseline - hB}
                          width={barW}
                          height={hB}
                          rx={Math.min(6, barW / 2)}
                          fill={`url(#bar-comp-${uid})`}
                          className="gcome-bar-rise"
                          style={{ animationDelay: delay }}
                        />
                      )}
                      <rect
                        x={hasCompare ? cx - barW - 1 : cx - barW / 2}
                        y={baseline - hA}
                        width={barW}
                        height={hA}
                        rx={Math.min(6, barW / 2)}
                        fill={`url(#bar-prim-${uid})`}
                        className="gcome-bar-rise"
                        style={{ animationDelay: delay }}
                      />
                    </g>
                  );
                })}
              </g>
            )}

            {/* Hover Crosshair & Highlighted Points */}
            {activeCoord && (
              <g className="gcome-crosshair">
                <line
                  x1={activeCoord.x}
                  y1={PAD_T}
                  x2={activeCoord.x}
                  y2={PAD_T + plotH}
                  className="gcome-crosshair-line"
                />
                {activeCompareCoord && (
                  <circle cx={activeCompareCoord.x} cy={activeCompareCoord.y} r="5.5" fill="#22d3ee" stroke="#fff" strokeWidth="2" />
                )}
                <circle cx={activeCoord.x} cy={activeCoord.y} r="6.5" fill="#ec4899" stroke="#fff" strokeWidth="2.2" />
              </g>
            )}

            {/* X-axis Labels */}
            {points.map((pt, i) => {
              if (!pt.shortLabel) return null;
              const x = primaryCoords[i]?.x ?? PAD_L;
              return (
                <text
                  key={pt.key}
                  x={x}
                  y={H - 10}
                  textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
                  className="gcome-axis-label"
                >
                  {pt.shortLabel}
                </text>
              );
            })}
          </svg>

          {/* Neon Scan Beam Effect during SVG sweep animation */}
          <div className="gcome-scan-beam" aria-hidden="true" />

          {/* Floating Tooltip on Hover / Touch */}
          {activePoint && activeCoord && (
            <div
              className="gcome-visits-tooltip"
              style={{
                left: `${Math.min(78, Math.max(12, (activeCoord.x / W) * 100))}%`,
              }}
            >
              <div className="gcome-tt-date">{activePoint.label}</div>
              <div className="gcome-tt-row is-primary">
                <span>{primaryLegendName}</span>
                <strong>{formatNumber(activePoint.views)} visites</strong>
              </div>
              {compareMode !== "none" && activePoint.compareViews !== null && (
                <div className="gcome-tt-row is-compare">
                  <span>{compareLegendName}</span>
                  <strong>{formatNumber(activePoint.compareViews)} visites</strong>
                </div>
              )}
              {activePoint.orders > 0 && (
                <div className="gcome-tt-row is-orders">
                  <span>Commandes</span>
                  <strong>{activePoint.orders} cmd</strong>
                </div>
              )}
            </div>
          )}
        </div>

        {summary.totalViews === 0 && !isLoading && (
          <div className="gcome-visits-empty-banner">
            <Activity size={15} />
            <span>
              Compteur en direct actif — chaque visite cliente sur la boutique ou sur une fiche produit apparaîtra ici instantanément.
            </span>
          </div>
        )}
      </div>

      {/* ===== COMPARATEUR VISUEL PAR PRODUIT ===== */}
      <div className="gcome-products-compare-wrap">
        <div className="gcome-products-compare-head">
          <div className="gcome-pc-title">
            <Layers size={15} />
            <span>Comparaison des visites selon les Produits</span>
            <span className="gcome-pc-count">{summary.productRows.length}</span>
          </div>
          <div className="gcome-pc-right">
            {summary.sourceTotals.length > 0 && (
              <div className="gcome-source-chips">
                {summary.sourceTotals.slice(0, 4).map(s => (
                  <span key={s.source} className={`gcome-src-pill ${SOURCE_META[s.source].badgeClass}`}>
                    {SOURCE_META[s.source].label} · <b>{s.pct}%</b>
                  </span>
                ))}
              </div>
            )}
            <button
              type="button"
              className="gcome-pc-toggle-btn"
              onClick={() => setShowCompareTable(v => !v)}
            >
              {showCompareTable ? "Réduire" : "Afficher le comparatif"}
            </button>
          </div>
        </div>

        {showCompareTable && (
          <div className="gcome-products-bars-grid" key={`bars-${animKey}`}>
            {summary.productRows.slice(0, 10).map((row, idx) => {
              const meta = productMetaByKey.get(row.productKey);
              const pctWidth = row.views > 0 ? Math.max(6, Math.round((row.views / maxProductViews) * 100)) : 0;
              const isSelectedA = selectedProductKey === row.productKey;
              const isSelectedB = compareMode === "product" && compareProductKey === row.productKey;
              return (
                <div
                  key={row.productKey}
                  className={`gcome-prod-bar-card${isSelectedA ? " is-selected-a" : ""}${isSelectedB ? " is-selected-b" : ""}`}
                  style={{ animationDelay: `${Math.min(idx * 45, 400)}ms` }}
                >
                  <div className="gcome-pbc-top">
                    <div className="gcome-pbc-id">
                      {meta?.image ? (
                        <img src={meta.image} alt="" className="gcome-pbc-thumb" loading="lazy" />
                      ) : (
                        <span className="gcome-pbc-rank">#{idx + 1}</span>
                      )}
                      <div className="gcome-pbc-names">
                        <strong title={row.name}>{row.name}</strong>
                        <span>
                          {formatNumber(row.uniqueVisitors)} uniques · {row.orders} cmd
                          {row.conversionRate !== null ? ` · ${row.conversionRate}% conv.` : ""}
                        </span>
                      </div>
                    </div>

                    <div className="gcome-pbc-stats">
                      <strong>{formatNumber(row.views)}</strong>
                      <small>{row.sharePct}% trafic</small>
                    </div>
                  </div>

                  <div className="gcome-pbc-track">
                    <div
                      className={`gcome-pbc-fill${idx === 0 ? " is-top" : idx % 2 === 1 ? " is-alt" : ""}`}
                      style={{
                        width: `${pctWidth}%`,
                        animationDelay: `${Math.min(idx * 55, 450)}ms`,
                      }}
                    />
                  </div>

                  <div className="gcome-pbc-actions">
                    <button
                      type="button"
                      className={`gcome-pbc-btn${isSelectedA ? " is-active" : ""}`}
                      onClick={() => setSelectedProductKey(isSelectedA ? "all" : row.productKey)}
                    >
                      {isSelectedA ? "✓ Filtré" : "Filtrer courbe"}
                    </button>
                    <button
                      type="button"
                      className={`gcome-pbc-btn is-vs${isSelectedB ? " is-active" : ""}`}
                      onClick={() => {
                        if (selectedProductKey === "all") {
                          const firstOther = summary.productRows.find(r => r.productKey !== row.productKey)?.productKey || "__home__";
                          setSelectedProductKey(firstOther);
                        } else if (selectedProductKey === row.productKey) {
                          return;
                        }
                        setCompareMode("product");
                        setCompareProductKey(row.productKey);
                      }}
                    >
                      {isSelectedB ? "✓ Produit B" : "Comparer VS"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
