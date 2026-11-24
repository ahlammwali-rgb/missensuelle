import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Layers,
  PackageCheck,
  RefreshCw,
  Truck,
} from "lucide-react";
import {
  buildMultiMetricChartSummary,
  type ChartViewMode,
  type MultiMetricChartPoint,
  type OrderLikeForMultiChart,
  type VisitAnalyticsData,
  type VisitDateFilterKey,
} from "@shared/siteVisits";

const DATE_PRESETS: Array<{ key: VisitDateFilterKey; label: string }> = [
  { key: "today", label: "Auj." },
  { key: "yesterday", label: "Hier" },
  { key: "7d", label: "7j" },
  { key: "14d", label: "14j" },
  { key: "30d", label: "30j" },
  { key: "all", label: "Tout" },
  { key: "custom", label: "Dates" },
];

const CHART_MODES: ChartViewMode[] = ["views", "delivered", "transferred", "global"];

interface ChartModeMeta {
  key: ChartViewMode;
  eyebrow: string;
  shortLabel: string;
  subtitle: string;
  dotColor: string;
}

const CHART_MODE_META: Record<ChartViewMode, ChartModeMeta> = {
  views: {
    key: "views",
    eyebrow: "VUES DU SITE",
    shortLabel: "Vues",
    subtitle: "Trafic & visiteurs en direct",
    dotColor: "#a855f7",
  },
  delivered: {
    key: "delivered",
    eyebrow: "COMMANDES LIVRÉES",
    shortLabel: "Livrées",
    subtitle: "Colis livrés & encaissés",
    dotColor: "#10b981",
  },
  transferred: {
    key: "transferred",
    eyebrow: "COMMANDES TRANSFÉRÉES",
    shortLabel: "Transférées",
    subtitle: "Colis expédiés aux livreurs",
    dotColor: "#3b82f6",
  },
  global: {
    key: "global",
    eyebrow: "VUE GLOBALE (3 GRAPHES)",
    shortLabel: "Globale",
    subtitle: "Vues + Transférées + Livrées",
    dotColor: "#ec4899",
  },
};

type SvgCoord = { x: number; y: number };

function buildSmoothCurvePath(coords: SvgCoord[]): string {
  if (coords.length === 0) return "";
  if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;
  let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const cx = ((p0.x + p1.x) / 2).toFixed(1);
    d += ` C ${cx} ${p0.y.toFixed(1)}, ${cx} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }
  return d;
}

function mapValuesToCoords(
  values: number[],
  maxVal: number,
  svgW: number,
  padX: number,
  padTop: number,
  plotH: number
): SvgCoord[] {
  const n = Math.max(1, values.length);
  const innerW = svgW - padX * 2;
  return values.map((val, i) => {
    const x = n === 1 ? svgW / 2 : padX + (i / (n - 1)) * innerW;
    const ratio = maxVal > 0 ? Math.max(0, Math.min(1, val / maxVal)) : 0;
    const y = padTop + plotH * (1 - ratio);
    return { x, y };
  });
}

function renderModeIcon(mode: ChartViewMode, size = 14) {
  if (mode === "delivered") return <PackageCheck size={size} />;
  if (mode === "transferred") return <Truck size={size} />;
  if (mode === "global") return <Layers size={size} />;
  return <Eye size={size} />;
}

export function VisitsAnalyticsChart({
  data,
  orders = [],
  isLoading,
  isRefreshing,
  onRefresh,
}: {
  data: VisitAnalyticsData | undefined;
  orders?: OrderLikeForMultiChart[];
  isLoading?: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}) {
  const [viewMode, setViewMode] = useState<ChartViewMode>("views");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [swipeDir, setSwipeDir] = useState<"left" | "right" | null>(null);
  const [dateFilter, setDateFilter] = useState<VisitDateFilterKey>("today");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; t: number; ignore: boolean } | null>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const onDocDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    window.addEventListener("mousedown", onDocDown);
    return () => window.removeEventListener("mousedown", onDocDown);
  }, [dropdownOpen]);

  const switchMode = (nextMode: ChartViewMode, dir?: "left" | "right") => {
    if (nextMode === viewMode) {
      setDropdownOpen(false);
      return;
    }
    setSwipeDir(dir ?? null);
    setViewMode(nextMode);
    setHoveredIdx(null);
    setDropdownOpen(false);
  };

  const stepMode = (delta: 1 | -1) => {
    const idx = CHART_MODES.indexOf(viewMode);
    const nextIdx = (idx + delta + CHART_MODES.length) % CHART_MODES.length;
    switchMode(CHART_MODES[nextIdx], delta > 0 ? "left" : "right");
  };

  const summary = useMemo(
    () =>
      buildMultiMetricChartSummary({
        data,
        orders,
        dateFilter,
        selectedProductKey: "all",
        customFrom,
        customTo,
      }),
    [data, orders, dateFilter, customFrom, customTo]
  );

  const points = summary.points;
  const pointCount = points.length;

  const SVG_W = 800;
  const SVG_H = 196;
  const PAD_TOP = 16;
  const PAD_BOT = 24;
  const PAD_X = 6;
  const PLOT_H = SVG_H - PAD_TOP - PAD_BOT;

  const chartGeometry = useMemo(() => {
    const viewsVals = points.map(p => p.views);
    const deliveredVals = points.map(p => p.delivered);
    const transferredVals = points.map(p => p.transferred);

    const maxViews = Math.max(1, ...viewsVals);
    const maxOrders = Math.max(1, ...deliveredVals, ...transferredVals);
    const maxDelivered = Math.max(1, ...deliveredVals);
    const maxTransferred = Math.max(1, ...transferredVals);

    const viewsCoords = mapValuesToCoords(viewsVals, maxViews, SVG_W, PAD_X, PAD_TOP, PLOT_H);
    const globalDeliveredCoords = mapValuesToCoords(deliveredVals, maxOrders, SVG_W, PAD_X, PAD_TOP, PLOT_H);
    const globalTransferredCoords = mapValuesToCoords(transferredVals, maxOrders, SVG_W, PAD_X, PAD_TOP, PLOT_H);
    const singleDeliveredCoords = mapValuesToCoords(deliveredVals, maxDelivered, SVG_W, PAD_X, PAD_TOP, PLOT_H);
    const singleTransferredCoords = mapValuesToCoords(transferredVals, maxTransferred, SVG_W, PAD_X, PAD_TOP, PLOT_H);

    const closeArea = (coords: SvgCoord[], lineD: string) => {
      if (coords.length === 0) return "";
      const baseY = PAD_TOP + PLOT_H;
      const last = coords[coords.length - 1];
      const first = coords[0];
      return `${lineD} L ${last.x.toFixed(1)} ${baseY} L ${first.x.toFixed(1)} ${baseY} Z`;
    };

    const viewsLineD = buildSmoothCurvePath(viewsCoords);
    const globalDeliveredLineD = buildSmoothCurvePath(globalDeliveredCoords);
    const globalTransferredLineD = buildSmoothCurvePath(globalTransferredCoords);
    const singleDeliveredLineD = buildSmoothCurvePath(singleDeliveredCoords);
    const singleTransferredLineD = buildSmoothCurvePath(singleTransferredCoords);

    return {
      maxViews,
      maxOrders,
      maxDelivered,
      maxTransferred,
      viewsCoords,
      globalDeliveredCoords,
      globalTransferredCoords,
      singleDeliveredCoords,
      singleTransferredCoords,
      viewsLineD,
      viewsAreaD: closeArea(viewsCoords, viewsLineD),
      globalDeliveredLineD,
      globalDeliveredAreaD: closeArea(globalDeliveredCoords, globalDeliveredLineD),
      globalTransferredLineD,
      globalTransferredAreaD: closeArea(globalTransferredCoords, globalTransferredLineD),
      singleDeliveredLineD,
      singleDeliveredAreaD: closeArea(singleDeliveredCoords, singleDeliveredLineD),
      singleTransferredLineD,
      singleTransferredAreaD: closeArea(singleTransferredCoords, singleTransferredLineD),
    };
  }, [points, PLOT_H]);

  const activeModeMeta = CHART_MODE_META[viewMode];

  const primaryCoords =
    viewMode === "delivered"
      ? chartGeometry.singleDeliveredCoords
      : viewMode === "transferred"
        ? chartGeometry.singleTransferredCoords
        : viewMode === "global"
          ? chartGeometry.globalDeliveredCoords
          : chartGeometry.viewsCoords;

  const activeIndex = hoveredIdx !== null && hoveredIdx < pointCount ? hoveredIdx : null;
  const activePoint: MultiMetricChartPoint | null = activeIndex !== null ? points[activeIndex] : null;
  const activeCoord = activeIndex !== null ? primaryCoords[activeIndex] : null;

  const lastNonZeroIdx = useMemo(() => {
    for (let i = points.length - 1; i >= 0; i--) {
      const p = points[i];
      const v =
        viewMode === "delivered"
          ? p.delivered
          : viewMode === "transferred"
            ? p.transferred
            : viewMode === "global"
              ? p.views + p.delivered + p.transferred
              : p.views;
      if (v > 0) return i;
    }
    return Math.max(0, points.length - 1);
  }, [points, viewMode]);

  const primaryTotal =
    viewMode === "delivered"
      ? summary.totals.delivered
      : viewMode === "transferred"
        ? summary.totals.transferred
        : summary.totals.views;

  const primaryDelta =
    viewMode === "delivered"
      ? summary.deltas.delivered
      : viewMode === "transferred"
        ? summary.deltas.transferred
        : summary.deltas.views;

  const primaryYMax =
    viewMode === "delivered"
      ? chartGeometry.maxDelivered
      : viewMode === "transferred"
        ? chartGeometry.maxTransferred
        : viewMode === "global"
          ? Math.max(chartGeometry.maxViews, chartGeometry.maxOrders)
          : chartGeometry.maxViews;

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const target = e.target as HTMLElement | null;
    const ignore = Boolean(
      target?.closest(".gcome-raw-dates") ||
        target?.closest(".gcome-mcustom-dates") ||
        target?.closest(".gcome-mode-dropdown")
    );
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      t: Date.now(),
      ignore,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || start.ignore || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    const dt = Date.now() - start.t;
    if (dt <= 450 && Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.35) {
      stepMode(dx < 0 ? 1 : -1);
    }
  };

  const handlePointerHover = (clientX: number, rect: DOMRect) => {
    if (pointCount <= 0) return;
    const relX = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    const idx = Math.min(pointCount - 1, Math.max(0, Math.round(relX * (pointCount - 1))));
    setHoveredIdx(idx);
  };

  const animKey = `${viewMode}-${dateFilter}-${customFrom}-${customTo}`;

  return (
    <section
      className={`gcome-raw-visits mode-${viewMode} ${swipeDir ? `is-swipe-${swipeDir}` : ""}`}
      aria-label="Statistiques graphiques boutique"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Header: Dropdown Mode Selector + Total / Multi-Counters + Refresh */}
      <div className="gcome-raw-top">
        <div className="gcome-raw-stat">
          <div className="gcome-raw-label-row" ref={dropdownRef}>
            <button
              type="button"
              className={`gcome-raw-mode-btn mode-${viewMode} ${dropdownOpen ? "is-open" : ""}`}
              onClick={() => setDropdownOpen(prev => !prev)}
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
              title="Changer la vue du graphique"
            >
              <span
                className="gcome-mchart-live-dot"
                style={{
                  background: activeModeMeta.dotColor,
                  boxShadow: `0 0 8px ${activeModeMeta.dotColor}`,
                }}
                aria-hidden="true"
              />
              <span className="gcome-raw-eyebrow">{activeModeMeta.eyebrow}</span>
              <ChevronDown size={13} className="gcome-mode-chevron" />
            </button>
            <span className="gcome-raw-period-txt">{summary.rangeLabel}</span>

            {dropdownOpen && (
              <div className="gcome-mode-dropdown" role="listbox" aria-label="Modes d'affichage du graphe">
                {CHART_MODES.map(modeKey => {
                  const meta = CHART_MODE_META[modeKey];
                  const selected = modeKey === viewMode;
                  const modeCount =
                    modeKey === "views"
                      ? summary.totals.views
                      : modeKey === "delivered"
                        ? summary.totals.delivered
                        : modeKey === "transferred"
                          ? summary.totals.transferred
                          : summary.totals.views + summary.totals.delivered + summary.totals.transferred;
                  return (
                    <button
                      key={modeKey}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`gcome-mode-option ${selected ? "is-selected" : ""}`}
                      onClick={() => switchMode(modeKey)}
                    >
                      <span
                        className="gcome-mode-option-ico"
                        style={{ color: meta.dotColor, background: `${meta.dotColor}1f` }}
                      >
                        {renderModeIcon(modeKey, 15)}
                      </span>
                      <span className="gcome-mode-option-copy">
                        <strong>{meta.eyebrow}</strong>
                        <span>{meta.subtitle}</span>
                      </span>
                      <span className="gcome-mode-option-val">
                        {modeKey === "global"
                          ? "3x"
                          : modeCount.toLocaleString("fr-FR")}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {viewMode === "global" ? (
            <div className="gcome-raw-global-stats">
              <div className="gcome-global-stat-pill is-views">
                <span className="gcome-gs-dot" />
                <span className="gcome-gs-label">Vues</span>
                <strong>{summary.totals.views.toLocaleString("fr-FR")}</strong>
              </div>
              <div className="gcome-global-stat-pill is-transferred">
                <span className="gcome-gs-dot" />
                <span className="gcome-gs-label">Transférées</span>
                <strong>{summary.totals.transferred.toLocaleString("fr-FR")}</strong>
              </div>
              <div className="gcome-global-stat-pill is-delivered">
                <span className="gcome-gs-dot" />
                <span className="gcome-gs-label">Livrées</span>
                <strong>{summary.totals.delivered.toLocaleString("fr-FR")}</strong>
              </div>
            </div>
          ) : (
            <div className="gcome-raw-num-row">
              <span className="gcome-raw-big-num">
                {isLoading && !data ? "—" : primaryTotal.toLocaleString("fr-FR")}
              </span>
              {viewMode === "delivered" && summary.totals.deliveredAmount > 0 && (
                <span className="gcome-raw-amount-chip is-delivered">
                  +{summary.totals.deliveredAmount.toLocaleString("fr-DZ")} DA
                </span>
              )}
              {viewMode === "transferred" && summary.totals.transferredAmount > 0 && (
                <span className="gcome-raw-amount-chip is-transferred">
                  {summary.totals.transferredAmount.toLocaleString("fr-DZ")} DA
                </span>
              )}
              {primaryDelta !== null && (
                <span className={`gcome-mchart-delta ${primaryDelta >= 0 ? "is-up" : "is-down"}`}>
                  {primaryDelta >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                  {Math.abs(primaryDelta)}%
                </span>
              )}
            </div>
          )}
        </div>

        <div className="gcome-raw-right">
          {onRefresh && (
            <button
              type="button"
              className="gcome-raw-refresh"
              onClick={onRefresh}
              title="Actualiser"
              aria-label="Actualiser les statistiques"
            >
              <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
            </button>
          )}
        </div>
      </div>

      {/* Date Filter Strip */}
      <div className="gcome-raw-dates">
        {DATE_PRESETS.map(p => (
          <button
            key={p.key}
            type="button"
            className={`gcome-raw-date-btn ${dateFilter === p.key ? "is-active" : ""}`}
            onClick={() => {
              setDateFilter(p.key);
              setHoveredIdx(null);
            }}
          >
            {p.key === "custom" && <Calendar size={11} />}
            <span>{p.label}</span>
          </button>
        ))}
      </div>

      {dateFilter === "custom" && (
        <div className="gcome-mcustom-dates">
          <input
            type="date"
            aria-label="Date début"
            value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
          />
          <span>→</span>
          <input
            type="date"
            aria-label="Date fin"
            value={customTo}
            onChange={e => setCustomTo(e.target.value)}
          />
        </div>
      )}

      {/* Edge-to-edge Full-Width SVG Graph Canvas */}
      <div
        className="gcome-raw-canvas"
        onPointerMove={e => handlePointerHover(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerDown={e => handlePointerHover(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => setHoveredIdx(null)}
      >
        <svg
          key={animKey}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="none"
          className="gcome-mchart-svg"
          role="img"
          aria-label={`Courbe ${activeModeMeta.eyebrow}`}
        >
          <defs>
            <linearGradient id="gcomeRawGradViews" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="55%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
            <linearGradient id="gcomeRawAreaViews" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.42" />
              <stop offset="65%" stopColor="#ec4899" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.01" />
            </linearGradient>

            <linearGradient id="gcomeRawGradDelivered" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#059669" />
              <stop offset="55%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
            <linearGradient id="gcomeRawAreaDelivered" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.42" />
              <stop offset="70%" stopColor="#34d399" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
            </linearGradient>

            <linearGradient id="gcomeRawGradTransferred" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="55%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
            <linearGradient id="gcomeRawAreaTransferred" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
              <stop offset="70%" stopColor="#06b6d4" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01" />
            </linearGradient>

            <filter id="gcomeRawGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <clipPath id="gcomeRawSweep">
              <rect
                x="0"
                y="0"
                width={SVG_W}
                height={SVG_H}
                className="gcome-svg-sweep-rect"
              />
            </clipPath>
          </defs>

          {[0, 0.5, 1].map((frac, gi) => {
            const gy = PAD_TOP + PLOT_H * (1 - frac);
            const labelVal = Math.round(primaryYMax * frac);
            return (
              <g key={gi}>
                <line
                  x1={0}
                  x2={SVG_W}
                  y1={gy}
                  y2={gy}
                  className="gcome-grid-line"
                />
                {frac > 0 && viewMode !== "global" && (
                  <text x={12} y={gy - 4} className="gcome-axis-label">
                    {labelVal}
                  </text>
                )}
              </g>
            );
          })}

          {viewMode === "global" ? (
            <g clipPath="url(#gcomeRawSweep)">
              {chartGeometry.viewsAreaD && (
                <path
                  d={chartGeometry.viewsAreaD}
                  fill="url(#gcomeRawAreaViews)"
                  className="gcome-area-fade"
                  opacity={0.55}
                />
              )}
              {chartGeometry.globalDeliveredAreaD && (
                <path
                  d={chartGeometry.globalDeliveredAreaD}
                  fill="url(#gcomeRawAreaDelivered)"
                  className="gcome-area-fade"
                  opacity={0.55}
                />
              )}
              {chartGeometry.viewsLineD && (
                <path
                  d={chartGeometry.viewsLineD}
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth={2.6}
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {chartGeometry.globalTransferredLineD && (
                <path
                  d={chartGeometry.globalTransferredLineD}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={3.1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {chartGeometry.globalDeliveredLineD && (
                <path
                  d={chartGeometry.globalDeliveredLineD}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth={3.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#gcomeRawGlow)"
                />
              )}
            </g>
          ) : (
            <g clipPath="url(#gcomeRawSweep)">
              {viewMode === "views" && chartGeometry.viewsAreaD && (
                <path d={chartGeometry.viewsAreaD} fill="url(#gcomeRawAreaViews)" className="gcome-area-fade" />
              )}
              {viewMode === "delivered" && chartGeometry.singleDeliveredAreaD && (
                <path d={chartGeometry.singleDeliveredAreaD} fill="url(#gcomeRawAreaDelivered)" className="gcome-area-fade" />
              )}
              {viewMode === "transferred" && chartGeometry.singleTransferredAreaD && (
                <path d={chartGeometry.singleTransferredAreaD} fill="url(#gcomeRawAreaTransferred)" className="gcome-area-fade" />
              )}

              {viewMode === "views" && chartGeometry.viewsLineD && (
                <path
                  d={chartGeometry.viewsLineD}
                  fill="none"
                  stroke="url(#gcomeRawGradViews)"
                  strokeWidth={3.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#gcomeRawGlow)"
                />
              )}
              {viewMode === "delivered" && chartGeometry.singleDeliveredLineD && (
                <path
                  d={chartGeometry.singleDeliveredLineD}
                  fill="none"
                  stroke="url(#gcomeRawGradDelivered)"
                  strokeWidth={3.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#gcomeRawGlow)"
                />
              )}
              {viewMode === "transferred" && chartGeometry.singleTransferredLineD && (
                <path
                  d={chartGeometry.singleTransferredLineD}
                  fill="none"
                  stroke="url(#gcomeRawGradTransferred)"
                  strokeWidth={3.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#gcomeRawGlow)"
                />
              )}
            </g>
          )}

          {points.map((pt, i) => {
            if (!pt.shortLabel || !primaryCoords[i]) return null;
            const anchor =
              i === 0 ? "start" : i === points.length - 1 ? "end" : "middle";
            const tx =
              i === 0
                ? Math.max(12, primaryCoords[i].x)
                : i === points.length - 1
                  ? Math.min(SVG_W - 12, primaryCoords[i].x)
                  : primaryCoords[i].x;
            return (
              <text
                key={pt.key}
                x={tx}
                y={SVG_H - 6}
                textAnchor={anchor}
                className="gcome-axis-label"
              >
                {pt.shortLabel}
              </text>
            );
          })}

          {viewMode !== "global" &&
            pointCount <= 16 &&
            primaryCoords.map((c, i) => (
              <circle
                key={`pt-${i}`}
                cx={c.x}
                cy={c.y}
                r={activeIndex === i ? 5.2 : 2.8}
                className="gcome-node-dot"
                style={{ fill: activeModeMeta.dotColor }}
              />
            ))}

          {activeIndex === null && primaryCoords[lastNonZeroIdx] && (
            <g>
              <circle
                cx={primaryCoords[lastNonZeroIdx].x}
                cy={primaryCoords[lastNonZeroIdx].y}
                r={10}
                className="gcome-live-pulse-ring"
                style={{ stroke: activeModeMeta.dotColor }}
              />
              <circle
                cx={primaryCoords[lastNonZeroIdx].x}
                cy={primaryCoords[lastNonZeroIdx].y}
                r={4.2}
                className="gcome-live-dot-core"
                style={{ fill: activeModeMeta.dotColor }}
              />
            </g>
          )}

          {activeCoord && (
            <g>
              <line
                x1={activeCoord.x}
                x2={activeCoord.x}
                y1={PAD_TOP}
                y2={PAD_TOP + PLOT_H}
                className="gcome-crosshair-line"
                style={{ stroke: activeModeMeta.dotColor }}
              />
              {viewMode === "global" && activeIndex !== null ? (
                <>
                  <circle
                    cx={chartGeometry.viewsCoords[activeIndex]?.x ?? activeCoord.x}
                    cy={chartGeometry.viewsCoords[activeIndex]?.y ?? activeCoord.y}
                    r={4.6}
                    fill="#a855f7"
                    stroke="#fff"
                    strokeWidth={1.6}
                  />
                  <circle
                    cx={chartGeometry.globalTransferredCoords[activeIndex]?.x ?? activeCoord.x}
                    cy={chartGeometry.globalTransferredCoords[activeIndex]?.y ?? activeCoord.y}
                    r={4.8}
                    fill="#3b82f6"
                    stroke="#fff"
                    strokeWidth={1.6}
                  />
                  <circle
                    cx={chartGeometry.globalDeliveredCoords[activeIndex]?.x ?? activeCoord.x}
                    cy={chartGeometry.globalDeliveredCoords[activeIndex]?.y ?? activeCoord.y}
                    r={5.4}
                    fill="#10b981"
                    stroke="#fff"
                    strokeWidth={2}
                  />
                </>
              ) : (
                <circle
                  cx={activeCoord.x}
                  cy={activeCoord.y}
                  r={5.8}
                  className="gcome-live-dot-core"
                  style={{ fill: activeModeMeta.dotColor }}
                />
              )}
            </g>
          )}
        </svg>

        <div key={`beam-${animKey}`} className="gcome-scan-beam" />

        {activePoint && activeCoord && (
          <div
            className="gcome-visits-tooltip"
            style={{
              left: `${Math.min(76, Math.max(24, (activeCoord.x / SVG_W) * 100))}%`,
            }}
          >
            <div className="gcome-tt-date">{activePoint.label}</div>
            {viewMode === "global" ? (
              <>
                <div className="gcome-tt-row">
                  <span style={{ color: "#d8b4fe" }}>● Vues</span>
                  <strong>{activePoint.views.toLocaleString("fr-FR")}</strong>
                </div>
                <div className="gcome-tt-row">
                  <span style={{ color: "#93c5fd" }}>● Transférées</span>
                  <strong>{activePoint.transferred.toLocaleString("fr-FR")}</strong>
                </div>
                <div className="gcome-tt-row">
                  <span style={{ color: "#6ee7b7" }}>● Livrées</span>
                  <strong>{activePoint.delivered.toLocaleString("fr-FR")}</strong>
                </div>
              </>
            ) : viewMode === "delivered" ? (
              <>
                <div className="gcome-tt-row is-primary">
                  <span>Livrées</span>
                  <strong style={{ color: "#34d399" }}>
                    {activePoint.delivered.toLocaleString("fr-FR")}
                  </strong>
                </div>
                <div className="gcome-tt-row">
                  <span>Encaissé</span>
                  <strong>{activePoint.deliveredAmount.toLocaleString("fr-DZ")} DA</strong>
                </div>
              </>
            ) : viewMode === "transferred" ? (
              <>
                <div className="gcome-tt-row is-primary">
                  <span>Transférées</span>
                  <strong style={{ color: "#60a5fa" }}>
                    {activePoint.transferred.toLocaleString("fr-FR")}
                  </strong>
                </div>
                <div className="gcome-tt-row">
                  <span>Valeur</span>
                  <strong>{activePoint.transferredAmount.toLocaleString("fr-DZ")} DA</strong>
                </div>
              </>
            ) : (
              <div className="gcome-tt-row is-primary">
                <span>Vues</span>
                <strong>{activePoint.views.toLocaleString("fr-FR")}</strong>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Swipe / Quick Slide Indicators Bar (Option 2) */}
      <div className="gcome-chart-swipe-bar">
        <button
          type="button"
          className="gcome-chart-nav-arrow"
          onClick={() => stepMode(-1)}
          aria-label="Graphique précédent"
        >
          <ChevronLeft size={14} />
        </button>

        <div className="gcome-chart-mode-dots" role="tablist" aria-label="Choisir un graphique">
          {CHART_MODES.map(modeKey => {
            const meta = CHART_MODE_META[modeKey];
            const active = modeKey === viewMode;
            return (
              <button
                key={modeKey}
                type="button"
                role="tab"
                aria-selected={active}
                className={`gcome-chart-dot-pill ${active ? "is-active" : ""}`}
                onClick={() => switchMode(modeKey)}
              >
                <span className="gcome-chart-dot" style={{ background: meta.dotColor }} />
                <span>{meta.shortLabel}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="gcome-chart-nav-arrow"
          onClick={() => stepMode(1)}
          aria-label="Graphique suivant"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </section>
  );
}
