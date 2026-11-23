import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Calendar, RefreshCw } from "lucide-react";
import type { Order } from "@/lib/store-data";
import {
  buildVisitDashboardSummary,
  getAlgiersDateKey,
  shiftDateKey,
  type VisitAnalyticsData,
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
  { key: "today", label: "Auj." },
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
  isRefreshing,
  onRefresh,
  orders,
}: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const [dateFilter, setDateFilter] = useState<VisitDateFilterKey>("7d");
  const [customFrom, setCustomFrom] = useState(() => shiftDateKey(getAlgiersDateKey(), -6));
  const [customTo, setCustomTo] = useState(() => getAlgiersDateKey());
  const [animKey, setAnimKey] = useState(1);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const summary = useMemo(
    () =>
      buildVisitDashboardSummary({
        data,
        orders,
        catalog: [],
        dateFilter,
        selectedProductKey: "all",
        compareMode: "previous_period",
        compareProductKey: "all",
        customFrom,
        customTo,
      }),
    [data, orders, dateFilter, customFrom, customTo],
  );

  useEffect(() => {
    setAnimKey(k => k + 1);
    setHoveredIdx(null);
  }, [dateFilter, customFrom, customTo]);

  const animatedTotalViews = useAnimatedNumber(summary.totalViews, animKey, 850);

  // Full screen width bleed: SVG coordinates start at 0 and end at 800
  const W = 800;
  const H = 196;
  const PAD_T = 18;
  const PAD_B = 26;
  const plotH = H - PAD_T - PAD_B;

  const points: VisitSeriesPoint[] = summary.points;
  const rawMax = useMemo(() => {
    let m = 4;
    for (const pt of points) {
      if (pt.views > m) m = pt.views;
    }
    return Math.ceil(m * 1.16);
  }, [points]);

  const coords: SvgCoord[] = useMemo(() => {
    const count = points.length;
    return points.map((pt, i) => {
      const x = count <= 1 ? W / 2 : (i / (count - 1)) * W;
      const y = PAD_T + plotH - (pt.views / rawMax) * plotH;
      return { x, y };
    });
  }, [points, plotH, rawMax]);

  const lineD = useMemo(() => buildSmoothCurvePath(coords), [coords]);
  const areaD = useMemo(() => {
    if (!lineD || coords.length === 0) return "";
    const first = coords[0];
    const last = coords[coords.length - 1];
    const baseline = PAD_T + plotH;
    return `${lineD} L ${last.x.toFixed(1)} ${baseline} L ${first.x.toFixed(1)} ${baseline} Z`;
  }, [lineD, coords, plotH]);

  const handleSvgPointer = (clientX: number) => {
    const svgEl = svgRef.current;
    if (!svgEl || points.length === 0) return;
    const rect = svgEl.getBoundingClientRect();
    if (!rect.width) return;
    const relX = ((clientX - rect.left) / rect.width) * W;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < coords.length; i++) {
      const dist = Math.abs(coords[i].x - relX);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    setHoveredIdx(bestIdx);
  };

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;
  const activeCoord = hoveredIdx !== null ? coords[hoveredIdx] : null;

  return (
    <section className="gcome-raw-visits" aria-label="Visites du site">
      {/* Ligne titre + compteur + filtre date sans aucun bloc */}
      <div className="gcome-raw-top">
        <div className="gcome-raw-stat">
          <div className="gcome-raw-label-row">
            <span className="gcome-mchart-live-dot" aria-hidden="true" />
            <span className="gcome-raw-eyebrow">VUES DU SITE</span>
            <span className="gcome-raw-period-txt">{summary.rangeLabel}</span>
          </div>

          <div className="gcome-raw-num-row">
            <strong className="gcome-raw-big-num">{formatNum(animatedTotalViews)}</strong>
            {summary.deltaPct !== null && (
              <span className={`gcome-mchart-delta ${summary.deltaPct >= 0 ? "is-up" : "is-down"}`}>
                {summary.deltaPct >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {summary.deltaPct > 0 ? `+${summary.deltaPct}%` : `${summary.deltaPct}%`}
              </span>
            )}
          </div>
        </div>

        <div className="gcome-raw-right">
          {onRefresh && (
            <button
              type="button"
              className="gcome-raw-refresh"
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Actualiser"
              aria-label="Actualiser les vues"
            >
              <RefreshCw size={14} className={isRefreshing ? "spin" : ""} />
            </button>
          )}
        </div>
      </div>

      {/* Filtre Date léger horizontal scrollable (sans boîte lourde) */}
      <div className="gcome-raw-dates" role="tablist" aria-label="Filtre date des visites">
        {DATE_PRESETS.map(p => (
          <button
            key={p.key}
            type="button"
            className={`gcome-raw-date-btn${dateFilter === p.key ? " is-active" : ""}`}
            onClick={() => setDateFilter(p.key)}
          >
            {p.key === "custom" ? <Calendar size={12} /> : null}
            <span>{p.label}</span>
          </button>
        ))}
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

      {/* Le Graphe lui-même — 100% largeur de l'écran du téléphone, sans bloc */}
      <div
        className="gcome-raw-canvas"
        key={animKey}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <svg
          ref={svgRef}
          className="gcome-mchart-svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Courbe des visites du site"
          onMouseMove={e => handleSvgPointer(e.clientX)}
          onTouchStart={e => e.touches[0] && handleSvgPointer(e.touches[0].clientX)}
          onTouchMove={e => e.touches[0] && handleSvgPointer(e.touches[0].clientX)}
        >
          <defs>
            <linearGradient id={`rv-area-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.42" />
              <stop offset="55%" stopColor="#ec4899" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
            </linearGradient>

            <linearGradient id={`rv-stroke-${uid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>

            <filter id={`rv-glow-${uid}`} x="-10%" y="-25%" width="120%" height="150%">
              <feGaussianBlur stdDeviation="3.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <clipPath id={`rv-sweep-${uid}`}>
              <rect x="0" y="0" width={W} height={H} className="gcome-svg-sweep-rect" />
            </clipPath>
          </defs>

          {[0.33, 0.66, 1].map((ratio, idx) => {
            const y = PAD_T + plotH - ratio * plotH;
            return (
              <line key={idx} x1={0} y1={y} x2={W} y2={y} className="gcome-grid-line" />
            );
          })}

          <g clipPath={`url(#rv-sweep-${uid})`}>
            {areaD && (
              <path d={areaD} fill={`url(#rv-area-${uid})`} className="gcome-area-fade" />
            )}

            {lineD && (
              <path
                d={lineD}
                fill="none"
                stroke={`url(#rv-stroke-${uid})`}
                strokeWidth="3.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={`url(#rv-glow-${uid})`}
              />
            )}

            {coords.map((c, idx) => {
              const isLast = idx === coords.length - 1;
              if (!isLast && points.length > 14) return null;
              return (
                <g key={idx}>
                  {isLast && <circle cx={c.x} cy={c.y} r="9" className="gcome-live-pulse-ring" />}
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={isLast ? 4.8 : 2.8}
                    className={isLast ? "gcome-live-dot-core" : "gcome-node-dot"}
                  />
                </g>
              );
            })}
          </g>

          {activeCoord && (
            <g>
              <line
                x1={activeCoord.x}
                y1={PAD_T}
                x2={activeCoord.x}
                y2={PAD_T + plotH}
                className="gcome-crosshair-line"
              />
              <circle cx={activeCoord.x} cy={activeCoord.y} r="6.5" fill="#ec4899" stroke="#fff" strokeWidth="2.2" />
            </g>
          )}

          {points.map((pt, i) => {
            if (!pt.shortLabel) return null;
            const rawX = coords[i]?.x ?? 0;
            const safeX = i === 0 ? 10 : i === points.length - 1 ? W - 10 : rawX;
            const anchor = i === 0 ? "start" : i === points.length - 1 ? "end" : "middle";
            return (
              <text key={pt.key} x={safeX} y={H - 7} textAnchor={anchor} className="gcome-axis-label">
                {pt.shortLabel}
              </text>
            );
          })}
        </svg>

        <div className="gcome-scan-beam" aria-hidden="true" />

        {activePoint && activeCoord && (
          <div
            className="gcome-visits-tooltip"
            style={{
              left: `${Math.min(82, Math.max(18, (activeCoord.x / W) * 100))}%`,
            }}
          >
            <div className="gcome-tt-date">{activePoint.label}</div>
            <div className="gcome-tt-row is-primary">
              <span>Vues</span>
              <strong>{formatNum(activePoint.views)}</strong>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
