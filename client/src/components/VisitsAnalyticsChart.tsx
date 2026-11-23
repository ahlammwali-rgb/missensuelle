import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  GitCompareArrows,
  RefreshCw,
  RotateCcw,
  TrendingUp,
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
  { key: "7d", label: "7j" },
  { key: "14d", label: "14j" },
  { key: "30d", label: "30j" },
  { key: "all", label: "Tout" },
  { key: "custom", label: "Dates" },
];

function useAnimatedNumber(target: number, animKey: number, durationMs = 850): number {
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

function formatNum(n: number): string {
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
  const [compareProductKey, setCompareProductKey] = useState<string>(
    () => catalog[1]?.id || catalog[0]?.id || "__home__",
  );
  const [chartStyle, setChartStyle] = useState<"area" | "bars">("area");
  const [animKey, setAnimKey] = useState(1);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

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

  useEffect(() => {
    setAnimKey(k => k + 1);
    setHoveredIdx(null);
  }, [dateFilter, selectedProductKey, compareMode, compareProductKey, chartStyle, customFrom, customTo]);

  // Slide pills list (Tout le site + Produits catalogue + Pages)
  const productSlideItems = useMemo(() => {
    const viewsByKey = new Map<string, number>();
    for (const r of summary.productRows) {
      viewsByKey.set(r.productKey, r.views);
    }
    const items: Array<{ key: string; label: string; views: number }> = [];
    const pushItem = (key: string, label: string) => {
      if (items.some(i => i.key === key)) return;
      items.push({ key, label, views: viewsByKey.get(key) ?? 0 });
    };
    for (const p of catalog) {
      pushItem(p.id, p.name);
    }
    pushItem("__home__", "Accueil");
    pushItem("__catalogue__", "Catalogue");
    pushItem("__checkout__", "Commande");
    for (const r of summary.productRows) {
      pushItem(r.productKey, r.name);
    }
    return items;
  }, [catalog, summary.productRows]);

  const productLabelByKey = useMemo(() => {
    const map = new Map<string, string>();
    map.set("all", "Tout le site");
    for (const item of productSlideItems) {
      map.set(item.key, item.label);
    }
    return map;
  }, [productSlideItems]);

  const animatedTotalViews = useAnimatedNumber(summary.totalViews, animKey, 850);

  // Edge-to-edge SVG dimensions (full width bleed!)
  const W = 800;
  const H = 236;
  const PAD_X = 6;
  const PAD_T = 20;
  const PAD_B = 28;
  const plotW = W - PAD_X * 2;
  const plotH = H - PAD_T - PAD_B;

  const points: VisitSeriesPoint[] = summary.points;
  const rawMax = useMemo(() => {
    let m = 4;
    for (const pt of points) {
      if (pt.views > m) m = pt.views;
      if (pt.compareViews !== null && pt.compareViews > m) m = pt.compareViews;
    }
    return Math.ceil(m * 1.15);
  }, [points]);

  const primaryCoords: SvgCoord[] = useMemo(() => {
    const count = points.length;
    return points.map((pt, i) => {
      const x = count <= 1 ? W / 2 : PAD_X + (i / (count - 1)) * plotW;
      const y = PAD_T + plotH - (pt.views / rawMax) * plotH;
      return { x, y };
    });
  }, [points, plotW, plotH, rawMax]);

  const compareCoords: SvgCoord[] = useMemo(() => {
    if (compareMode === "none") return [];
    const count = points.length;
    return points.map((pt, i) => {
      const x = count <= 1 ? W / 2 : PAD_X + (i / (count - 1)) * plotW;
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

  const primaryLegendName = productLabelByKey.get(selectedProductKey) || selectedProductKey;
  const compareLegendName =
    compareMode === "previous_period"
      ? "Période préc."
      : compareMode === "product"
      ? productLabelByKey.get(compareProductKey) || compareProductKey
      : "";

  const toggleProductCompareSlide = () => {
    if (compareMode === "product") {
      setCompareMode("previous_period");
      return;
    }
    if (selectedProductKey === "all") {
      const firstProd = productSlideItems[0]?.key || "__home__";
      const secondProd = productSlideItems[1]?.key || "__catalogue__";
      setSelectedProductKey(firstProd);
      setCompareProductKey(secondProd);
    } else if (compareProductKey === selectedProductKey) {
      const alt = productSlideItems.find(p => p.key !== selectedProductKey)?.key || "__home__";
      setCompareProductKey(alt);
    }
    setCompareMode("product");
  };

  const handleProductPillTap = (key: string) => {
    if (compareMode === "product") {
      if (key === "all") {
        setCompareMode("previous_period");
        setSelectedProductKey("all");
        return;
      }
      if (key === selectedProductKey) return;
      setCompareProductKey(key);
      return;
    }
    setSelectedProductKey(selectedProductKey === key ? "all" : key);
  };

  const activeFilterIdx = Math.max(0, DATE_PRESETS.findIndex(p => p.key === dateFilter));

  return (
    <section className="gcome-mchart-shell" aria-label="Graphe des visites site et produits">
      {/* ===== 1. EN-TÊTE STYLE APP MOBILE: CHIFFRE + INDICATEURS + ACTION SLIDE ===== */}
      <div className="gcome-mchart-top">
        <div className="gcome-mchart-stat">
          <div className="gcome-mchart-eyebrow">
            <span className="gcome-mchart-live-dot" aria-hidden="true" />
            <span>VISITES SITE</span>
            <span className="gcome-mchart-range-pill">{summary.rangeLabel}</span>
          </div>

          <div className="gcome-mchart-num-row">
            <strong className="gcome-mchart-big-num">{formatNum(animatedTotalViews)}</strong>
            {summary.deltaPct !== null && (
              <span className={`gcome-mchart-delta ${summary.deltaPct >= 0 ? "is-up" : "is-down"}`}>
                {summary.deltaPct >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                {summary.deltaPct > 0 ? `+${summary.deltaPct}%` : `${summary.deltaPct}%`}
              </span>
            )}
          </div>

          {/* Indicateurs compacts inline */}
          <div className="gcome-mchart-indicators">
            <span className="gcome-mind-chip is-purple">
              <i />
              {primaryLegendName} : <b>{formatNum(summary.totalViews)}</b>
            </span>
            {compareMode !== "none" && compareLegendName && (
              <>
                {compareMode === "product" && (
                  <button
                    type="button"
                    className="gcome-mswap-btn"
                    onClick={() => {
                      const prevA = selectedProductKey;
                      setSelectedProductKey(compareProductKey);
                      setCompareProductKey(prevA);
                    }}
                    title="Inverser Produit A et Produit B"
                  >
                    ⇄
                  </button>
                )}
                <span className="gcome-mind-chip is-cyan">
                  <i />
                  {compareLegendName} : <b>{formatNum(summary.compareTotalViews ?? 0)}</b>
                </span>
              </>
            )}
            <span className="gcome-mind-chip is-muted">
              Uniques <b>{formatNum(summary.uniqueVisitors)}</b>
            </span>
            <span className="gcome-mind-chip is-mint">
              Conv. <b>{summary.conversionRate === null ? "—" : `${summary.conversionRate}%`}</b>
            </span>
          </div>
        </div>

        {/* Switch Slide Courbe/Barres + Replay + Refresh */}
        <div className="gcome-mchart-actions">
          <button
            type="button"
            className="gcome-mslide-mode-switch"
            onClick={() => setChartStyle(s => (s === "area" ? "bars" : "area"))}
            aria-label="Basculer entre courbe et barres"
            title={chartStyle === "area" ? "Passer en barres" : "Passer en courbe"}
          >
            <span className={`gcome-mslide-thumb${chartStyle === "bars" ? " is-right" : ""}`} />
            <span className={`gcome-mslide-opt${chartStyle === "area" ? " is-on" : ""}`}>
              <TrendingUp size={13} />
            </span>
            <span className={`gcome-mslide-opt${chartStyle === "bars" ? " is-on" : ""}`}>
              <BarChart3 size={13} />
            </span>
          </button>

          <button
            type="button"
            className="gcome-mchart-icon-btn"
            onClick={() => setAnimKey(k => k + 1)}
            title="Rejouer l'animation"
            aria-label="Rejouer l'animation"
          >
            <RotateCcw size={14} />
          </button>

          {onRefresh && (
            <button
              type="button"
              className="gcome-mchart-icon-btn"
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Actualiser"
              aria-label="Actualiser les visites"
            >
              <RefreshCw size={14} className={isRefreshing ? "spin" : ""} />
            </button>
          )}
        </div>
      </div>

      {/* ===== 2. BARRE SLIDE DES DATES (MOBILE APP SLIDER) ===== */}
      <div className="gcome-mslider-row" role="tablist" aria-label="Filtres de date">
        <div className="gcome-mdate-track">
          <span
            className="gcome-mdate-slider-bg"
            style={{
              width: `calc((100% - 8px) / ${DATE_PRESETS.length})`,
              transform: `translateX(${activeFilterIdx * 100}%)`,
            }}
            aria-hidden="true"
          />
          {DATE_PRESETS.map(p => (
            <button
              key={p.key}
              type="button"
              className={`gcome-mdate-btn${dateFilter === p.key ? " is-active" : ""}`}
              onClick={() => setDateFilter(p.key)}
            >
              {p.key === "custom" ? <Calendar size={12} /> : null}
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {dateFilter === "custom" && (
        <div className="gcome-mcustom-dates">
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

      {/* ===== 3. LE GRAND GRAPHE PLEINE LARGEUR BORD-À-BORD ===== */}
      <div
        className="gcome-mchart-canvas-wrap"
        key={animKey}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <svg
          ref={svgRef}
          className="gcome-mchart-svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Courbe des visites sur le site"
          onMouseMove={e => handleSvgPointer(e.clientX)}
          onTouchStart={e => e.touches[0] && handleSvgPointer(e.touches[0].clientX)}
          onTouchMove={e => e.touches[0] && handleSvgPointer(e.touches[0].clientX)}
        >
          <defs>
            <linearGradient id={`mc-area-a-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.48" />
              <stop offset="58%" stopColor="#ec4899" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.01" />
            </linearGradient>

            <linearGradient id={`mc-stroke-a-${uid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>

            <linearGradient id={`mc-area-b-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.01" />
            </linearGradient>

            <linearGradient id={`mc-bar-a-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c084fc" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>

            <linearGradient id={`mc-bar-b-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#67e8f9" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>

            <filter id={`mc-glow-${uid}`} x="-12%" y="-25%" width="124%" height="150%">
              <feGaussianBlur stdDeviation="3.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <clipPath id={`mc-sweep-${uid}`}>
              <rect x="0" y="0" width={W} height={H} className="gcome-svg-sweep-rect" />
            </clipPath>
          </defs>

          {/* Subtle horizontal guide lines */}
          {[0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = PAD_T + plotH - ratio * plotH;
            const val = Math.round(rawMax * ratio);
            return (
              <g key={idx}>
                <line x1={0} y1={y} x2={W} y2={y} className="gcome-grid-line" />
                <text x={8} y={y - 4} className="gcome-mchart-ylabel">
                  {val}
                </text>
              </g>
            );
          })}

          {chartStyle === "area" ? (
            <g clipPath={`url(#mc-sweep-${uid})`}>
              {compareLineD && (
                <>
                  <path d={compareAreaD} fill={`url(#mc-area-b-${uid})`} className="gcome-area-fade" />
                  <path
                    d={compareLineD}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="2.5"
                    strokeDasharray="6 5"
                    strokeLinecap="round"
                  />
                </>
              )}

              {primaryAreaD && (
                <path d={primaryAreaD} fill={`url(#mc-area-a-${uid})`} className="gcome-area-fade" />
              )}

              {primaryLineD && (
                <path
                  d={primaryLineD}
                  fill="none"
                  stroke={`url(#mc-stroke-a-${uid})`}
                  strokeWidth="3.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter={`url(#mc-glow-${uid})`}
                />
              )}

              {primaryCoords.map((c, idx) => {
                const isLast = idx === primaryCoords.length - 1;
                if (!isLast && points.length > 16) return null;
                return (
                  <g key={idx}>
                    {isLast && <circle cx={c.x} cy={c.y} r="9" className="gcome-live-pulse-ring" />}
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={isLast ? 5 : 3}
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
                  ? Math.max(5, Math.min(20, slotW * 0.34))
                  : Math.max(6, Math.min(28, slotW * 0.54));
                const cx = primaryCoords[i]?.x ?? PAD_X;
                const baseline = PAD_T + plotH;
                const hA = Math.max(3, (pt.views / rawMax) * plotH);
                const hB = pt.compareViews !== null ? Math.max(3, (pt.compareViews / rawMax) * plotH) : 0;
                const delay = `${Math.min(i * 22, 600)}ms`;
                return (
                  <g key={pt.key}>
                    {hasCompare && (
                      <rect
                        x={cx + 2}
                        y={baseline - hB}
                        width={barW}
                        height={hB}
                        rx={Math.min(6, barW / 2)}
                        fill={`url(#mc-bar-b-${uid})`}
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
                      fill={`url(#mc-bar-a-${uid})`}
                      className="gcome-bar-rise"
                      style={{ animationDelay: delay }}
                    />
                  </g>
                );
              })}
            </g>
          )}

          {activeCoord && (
            <g>
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

          {/* X labels neatly anchored inside bottom edge */}
          {points.map((pt, i) => {
            if (!pt.shortLabel) return null;
            const x = primaryCoords[i]?.x ?? PAD_X;
            const anchor = i === 0 ? "start" : i === points.length - 1 ? "end" : "middle";
            return (
              <text key={pt.key} x={x} y={H - 8} textAnchor={anchor} className="gcome-axis-label">
                {pt.shortLabel}
              </text>
            );
          })}
        </svg>

        {/* Scan beam WAW sweep */}
        <div className="gcome-scan-beam" aria-hidden="true" />

        {/* Live Floating Pill Tooltip when touching/hovering */}
        {activePoint && activeCoord && (
          <div
            className="gcome-visits-tooltip"
            style={{
              left: `${Math.min(82, Math.max(18, (activeCoord.x / W) * 100))}%`,
            }}
          >
            <div className="gcome-tt-date">{activePoint.label}</div>
            <div className="gcome-tt-row is-primary">
              <span>{primaryLegendName}</span>
              <strong>{formatNum(activePoint.views)}</strong>
            </div>
            {compareMode !== "none" && activePoint.compareViews !== null && (
              <div className="gcome-tt-row is-compare">
                <span>{compareLegendName}</span>
                <strong>{formatNum(activePoint.compareViews)}</strong>
              </div>
            )}
            {activePoint.orders > 0 && (
              <div className="gcome-tt-row is-orders">
                <span>Commandes</span>
                <strong>{activePoint.orders}</strong>
              </div>
            )}
          </div>
        )}

        {summary.totalViews === 0 && !isLoading && (
          <div className="gcome-mchart-zero-hint">
            Compteur temps réel prêt — chaque visite s'affichera ici automatiquement
          </div>
        )}
      </div>

      {/* ===== 4. BOUTON SLIDE COMPARATEUR + CARROUSEL SLIDE DES PRODUITS ===== */}
      <div className="gcome-mchart-footer">
        {/* Boutons slide de comparaison */}
        <div className="gcome-mcompare-controls">
          <button
            type="button"
            className={`gcome-mslide-compare-toggle${compareMode === "product" ? " is-on" : ""}`}
            onClick={toggleProductCompareSlide}
            role="switch"
            aria-checked={compareMode === "product"}
          >
            <span className="gcome-mswitch-track">
              <span className="gcome-mswitch-knob" />
            </span>
            <GitCompareArrows size={13} />
            <span>Comparer Produits</span>
          </button>

          <button
            type="button"
            className={`gcome-mprev-chip${compareMode === "previous_period" ? " is-active" : ""}`}
            onClick={() =>
              setCompareMode(m => (m === "previous_period" ? "none" : "previous_period"))
            }
          >
            vs Période préc.
          </button>
        </div>

        {/* Slider horizontal scrollable au doigt des produits */}
        <div className="gcome-mproducts-slider" aria-label="Filtrer ou comparer selon les produits">
          <button
            type="button"
            className={`gcome-mprod-pill${selectedProductKey === "all" && compareMode !== "product" ? " is-a" : ""}`}
            onClick={() => handleProductPillTap("all")}
          >
            <span>🌐 Tout</span>
          </button>

          {productSlideItems.map(item => {
            const isA = selectedProductKey === item.key;
            const isB = compareMode === "product" && compareProductKey === item.key;
            return (
              <button
                key={item.key}
                type="button"
                className={`gcome-mprod-pill${isA ? " is-a" : ""}${isB ? " is-b" : ""}`}
                onClick={() => handleProductPillTap(item.key)}
              >
                {isA && compareMode === "product" && <b className="gcome-mprod-badge is-a">A</b>}
                {isB && <b className="gcome-mprod-badge is-b">B</b>}
                <span>{item.label}</span>
                {item.views > 0 && <small>{formatNum(item.views)}</small>}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
