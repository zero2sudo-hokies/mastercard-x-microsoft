"use client";

import { geoAlbersUsa, geoPath } from "d3-geo";
import type { Feature, Geometry } from "geojson";
import { useEffect, useMemo, useRef, useState } from "react";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import us from "us-atlas/counties-albers-10m.json";
import { pinColor } from "@/lib/banks";
import { fmtInt, fmtScore } from "@/lib/format";
import { TOPIC_ICON, TOPIC_LABEL } from "@/lib/topics";
import type { AreaSummary, BranchPin, Layer, TopicId } from "@/lib/types";

const W = 975;
const H = 610;
const FULL: ViewBox = [0, 0, W, H];
type ViewBox = [number, number, number, number];

export const NAVY_RAMP = ["#e6ebf3", "#b4c3da", "#7a92ba", "#3f5f96", "#0b1f3a"];
export const HEAT_RAMP = ["#fdebd0", "#fbc580", "#f79e1b", "#dd5a26", "#a8231c"];

// ---- geometry, computed once per page load ----
type Shape = { id: string; d: string; centroid: [number, number] };
type Box = [[number, number], [number, number]];
type Geo = {
  states: Shape[];
  stateBounds: Record<string, ViewBox>;
  countyBoxes: Record<string, Box>;
  countiesByState: Record<string, Shape[]>;
  stateBorders: string;
  nation: string;
};
let GEO: Geo | null = null;
// us-atlas counties-albers-10m is pre-projected with exactly this projection, so lat/lon pins line up with the shapes
const PROJECT = geoAlbersUsa().scale(1300).translate([487.5, 305]);

function fit([[x0, y0], [x1, y1]]: [[number, number], [number, number]]): ViewBox {
  const pad = 24;
  let w = x1 - x0 + 2 * pad;
  let h = y1 - y0 + 2 * pad;
  if (w / h > W / H) h = w / (W / H);
  else w = h * (W / H);
  return [(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h];
}

/** A view where the county fills about half the frame, leaving room for the lift and the blurred context. */
function fitFocus([[x0, y0], [x1, y1]]: Box): ViewBox {
  // pad relative to the county so small and large counties both fill about 45% of the frame
  const pad = Math.max(x1 - x0, y1 - y0) * 0.6;
  return fit([[x0 - pad + 24, y0 - pad + 24], [x1 + pad - 24, y1 + pad - 24]]);
}

function geo(): Geo {
  if (GEO) return GEO;
  const topo = us as unknown as Topology<{ states: GeometryCollection; counties: GeometryCollection; nation: GeometryCollection }>;
  const path = geoPath();
  const toShape = (f: Feature<Geometry>) => ({ id: String(f.id), d: path(f) ?? "", centroid: path.centroid(f) as [number, number] });
  const stateFeatures = (feature(topo, topo.objects.states) as unknown as { features: Feature<Geometry>[] }).features;
  const countyFeatures = (feature(topo, topo.objects.counties) as unknown as { features: Feature<Geometry>[] }).features;
  const countiesByState: Record<string, Shape[]> = {};
  const countyBoxes: Record<string, Box> = {};
  for (const f of countyFeatures) {
    const s = toShape(f);
    (countiesByState[s.id.slice(0, 2)] ??= []).push(s);
    countyBoxes[s.id] = path.bounds(f) as Box;
  }
  GEO = {
    states: stateFeatures.map(toShape),
    stateBounds: Object.fromEntries(stateFeatures.map((f) => [String(f.id), fit(path.bounds(f) as [[number, number], [number, number]])])),
    countiesByState,
    countyBoxes,
    stateBorders: path(mesh(topo, topo.objects.states, (a, b) => a !== b)) ?? "",
    nation: path(mesh(topo, topo.objects.nation)) ?? "",
  };
  return GEO;
}

// ---- color scales ----
export type Scale = { thresholds: number[]; ramp: string[]; color: (s: AreaSummary) => string | null; title: string };

function quantileThresholds(values: number[]): number[] {
  const v = [...values].sort((a, b) => a - b);
  if (!v.length) return [];
  return [0.2, 0.4, 0.6, 0.8].map((q) => v[Math.min(v.length - 1, Math.floor(q * v.length))]);
}

export function makeScale(rows: AreaSummary[], layer: Layer, topic: TopicId | null): Scale {
  const value = (s: AreaSummary): number | null => {
    if (layer === "underserved") return s.exclusion_index;
    if (s.frustration_status !== "ok") return null;
    return topic ? (s.pain_scores?.[topic] ?? null) : s.frustration_score;
  };
  const values = rows.map(value).filter((v): v is number => v != null);
  const thresholds = quantileThresholds(values);
  const ramp = layer === "underserved" ? NAVY_RAMP : HEAT_RAMP;
  const title =
    layer === "underserved" ? "Exclusion index" : topic ? `${TOPIC_LABEL[topic]} pain score` : "Frustration score";
  return {
    thresholds,
    ramp,
    title,
    color: (s) => {
      const v = value(s);
      if (v == null) return null;
      return ramp[thresholds.filter((t) => v > t).length];
    },
  };
}

// ---- component ----
type Props = {
  states: Map<string, AreaSummary>;
  counties: Map<string, AreaSummary>;
  stateFips: string | null;
  layer: Layer;
  topic: TopicId | null;
  selectedFips: string | null;
  focusFips: string[];
  onStateClick: (fips: string) => void;
  onCountyClick: (fips: string) => void;
  /** lift the selected county in 3D and blur the rest (frustration view) */
  focusSelected?: boolean;
  onClearFocus?: () => void;
  /** branch locations for the focused county */
  pins?: BranchPin[];
};

export default function UsMap({ states, counties, stateFips, layer, topic, selectedFips, focusFips, onStateClick, onCountyClick, focusSelected, onClearFocus, pins = [] }: Props) {
  const g = geo();
  const focusShape = focusSelected && selectedFips && stateFips ? g.countiesByState[stateFips]?.find((c) => c.id === selectedFips) : undefined;
  const target = focusShape ? fitFocus(g.countyBoxes[focusShape.id]) : stateFips && g.stateBounds[stateFips] ? g.stateBounds[stateFips] : FULL;
  const depth = target[3] * 0.03; // lift height in map units, from the final view so it does not wobble while zooming
  const [vb, settled] = useAnimatedViewBox(target);
  // effects start only after the zoom lands: blurring the whole map on every zoom frame is what made it lag
  const focused = focusShape && settled ? focusShape : undefined;
  const k = vb[2] / W; // zoom factor for strokes, patterns and glyphs
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ fips: string; x: number; y: number; w: number } | null>(null);

  const countyShapes = stateFips ? (g.countiesByState[stateFips] ?? []) : [];
  const visibleRows = stateFips ? countyShapes.map((c) => counties.get(c.id)).filter((s): s is AreaSummary => !!s) : [...states.values()];
  const scale = useMemo(() => makeScale(visibleRows, layer, topic), [visibleRows.length, layer, topic, states, counties, stateFips]); // eslint-disable-line react-hooks/exhaustive-deps

  const fillFor = (s: AreaSummary | undefined) => (s ? (scale.color(s) ?? "url(#hatch)") : "url(#hatch)");
  const highlighted = new Set([...(selectedFips ? [selectedFips] : []), ...focusFips]);
  const allShapes = [...g.states, ...countyShapes];
  const hovered = hover ? (counties.get(hover.fips) ?? states.get(hover.fips)) : undefined;

  const track = (fips: string, e: React.MouseEvent) => {
    const r = wrap.current?.getBoundingClientRect();
    if (r) setHover({ fips, x: e.clientX - r.left, y: e.clientY - r.top, w: r.width });
  };

  return (
    <div ref={wrap} className="relative w-full" onMouseLeave={() => setHover(null)}>
      <svg viewBox={vb.join(" ")} className="block h-auto w-full" role="img" aria-label={`US map, ${scale.title}`}>
        <defs>
          <pattern id="hatch" patternUnits="userSpaceOnUse" width={6 * k} height={6 * k} patternTransform="rotate(45)">
            <rect width={6 * k} height={6 * k} fill="#f1f0ec" />
            <line x1="0" y1="0" x2="0" y2={6 * k} stroke="#c8c4ba" strokeWidth={2 * k} />
          </pattern>
          <filter id="lift-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy={depth * 0.6} stdDeviation={depth * 0.9} floodColor="#0b1f3a" floodOpacity="0.45" />
          </filter>
        </defs>
        <g className={`map-layer ${focused ? "map-dim" : ""}`}>

        {g.states.map((s) => {
          const inState = s.id === stateFips;
          const dim = stateFips && !inState;
          return (
            <path
              key={s.id}
              d={s.d}
              className="map-path cursor-pointer"
              fill={dim ? "#ebe9e3" : stateFips ? "none" : fillFor(states.get(s.id))}
              stroke="#ffffff"
              strokeWidth={0.6}
              onClick={() => onStateClick(s.id)}
              onMouseMove={stateFips ? undefined : (e) => track(s.id, e)}
            />
          );
        })}

        {countyShapes.map((c) => (
          <path
            key={c.id}
            d={c.d}
            className="map-path cursor-pointer hover:opacity-80"
            fill={fillFor(counties.get(c.id))}
            stroke="#ffffff"
            strokeWidth={0.4}
            onClick={() => onCountyClick(c.id)}
            onMouseMove={(e) => track(c.id, e)}
          />
        ))}

        <path d={g.stateBorders} fill="none" stroke="#ffffff" strokeWidth={1.2} className="map-path pointer-events-none" />
        {stateFips && (
          <path d={g.states.find((s) => s.id === stateFips)?.d} fill="none" stroke="#0b1f3a" strokeWidth={1.2} className="map-path pointer-events-none" />
        )}

        {layer === "frustration" &&
          stateFips &&
          countyShapes.map((c) => {
            const s = counties.get(c.id);
            if (!s?.top_topic || s.frustration_status !== "ok" || !s.pain_scores) return null;
            const clear = isClearLead(s);
            if (!clear) return null;
            const size = 6 * k;
            return (
              <g key={`g${c.id}`} transform={`translate(${c.centroid[0] - size / 2},${c.centroid[1] - size / 2}) scale(${size / 24})`} className="pointer-events-none">
                <circle cx="12" cy="12" r="13" fill="#ffffff" opacity="0.85" />
                <path d={TOPIC_ICON[s.top_topic]} fill="none" stroke="#0b1f3a" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              </g>
            );
          })}

        {allShapes
          .filter((s) => highlighted.has(s.id))
          .map((s) => (
            <path key={`h${s.id}`} d={s.d} fill="none" stroke="#f79e1b" strokeWidth={3} className="map-path pointer-events-none" />
          ))}
        </g>

        {focused && (
          <>
            {/* clicking anywhere on the blurred map goes back to the state view */}
            <rect x={vb[0]} y={vb[1]} width={vb[2]} height={vb[3]} fill="transparent" className="cursor-zoom-out" onClick={onClearFocus} onMouseMove={() => setHover(null)} />
            <g className="county-lift" style={{ "--lift": `${depth}px` } as React.CSSProperties}>
              {Array.from({ length: 6 }, (_, i) => 6 - i).map((i) => (
                <path
                  key={i}
                  d={focused.d}
                  transform={`translate(0 ${(depth * i) / 6})`}
                  fill="#0b1f3a"
                  opacity={0.22 + (6 - i) * 0.05}
                  filter={i === 6 ? "url(#lift-shadow)" : undefined}
                  className="map-path pointer-events-none"
                />
              ))}
              <path d={focused.d} fill={fillFor(counties.get(focused.id))} stroke="#ffffff" strokeWidth={1.5} className="map-path" onMouseMove={(e) => track(focused.id, e)} />
              <path d={focused.d} fill="none" stroke="#f79e1b" strokeWidth={2.5} className="map-path pointer-events-none" />
              <g className="branch-pins">
                {/* other banks first so the top 3 sit on top */}
                {[...pins].sort((a, b) => (b.rank && b.rank <= 3 ? 0 : 1) - (a.rank && a.rank <= 3 ? 0 : 1)).map((p, i) => {
                  const xy = PROJECT([p.lon, p.lat]);
                  if (!xy) return null;
                  const top = p.rank != null && p.rank <= 3;
                  return (
                    <circle key={i} cx={xy[0]} cy={xy[1]} r={target[3] * (top ? 0.011 : 0.0065)} fill={pinColor(p.rank)} stroke="#ffffff" strokeWidth={target[3] * 0.0025} opacity={top ? 1 : 0.75}>
                      <title>{`${p.bank ?? "Other bank"} · ${p.branch}`}</title>
                    </circle>
                  );
                })}
              </g>
            </g>
            <text
              x={focused.centroid[0]}
              y={g.countyBoxes[focused.id][0][1] - depth * 2.2}
              textAnchor="middle"
              fontSize={target[3] * 0.04}
              fontWeight={600}
              fill="#0b1f3a"
              stroke="#ffffff"
              strokeWidth={target[3] * 0.012}
              paintOrder="stroke"
              className="county-label pointer-events-none"
            >
              {counties.get(focused.id)?.name ?? ""}
            </text>
          </>
        )}
      </svg>

      {hover && hovered && <Tooltip s={hovered} x={hover.x} y={hover.y} width={hover.w} />}
      <Legend scale={scale} />
    </div>
  );
}

// clear_lead lives on FrustrationArea; summaries carry pain scores, so recompute the same rule (lead >= 1.15)
function isClearLead(s: AreaSummary) {
  const p = Object.values(s.pain_scores ?? {}).sort((a, b) => b - a);
  return p.length > 1 && p[1] > 0 && p[0] / p[1] >= 1.15;
}

function Tooltip({ s, x, y, width }: { s: AreaSummary; x: number; y: number; width: number }) {
  const left = x > width - 240 ? x - 232 : x + 14;
  return (
    <div className="pointer-events-none absolute z-10 w-56 rounded-lg border border-line bg-white p-3 text-xs shadow-lg" style={{ left, top: y + 14 }}>
      <div className="mb-1 font-semibold text-navy">
        {s.name}
        {s.level === "county" ? `, ${s.state_abbr}` : ""}
      </div>
      {s.exclusion_index != null && <Row k="Exclusion index" v={fmtScore(s.exclusion_index)} />}
      {s.frustration_status === "ok" && s.frustration_score != null && <Row k="Frustration score" v={fmtScore(s.frustration_score)} />}
      {s.frustration_status === "ok" && s.top_topic && <Row k="Top frustration" v={TOPIC_LABEL[s.top_topic]} />}
      {s.est_underserved_hh != null && <Row k="Est. underserved households" v={`${fmtInt(s.est_underserved_hh)} (modeled)`} />}
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-3 py-0.5">
    <span className="text-muted">{k}</span>
    <span className="text-right font-medium tabular-nums text-navy">{v}</span>
  </div>
);

function Legend({ scale }: { scale: Scale }) {
  const t = scale.thresholds;
  const fmt = (n: number) => (n < 10 ? n.toFixed(2) : n.toFixed(0));
  const labels = t.length ? [`≤ ${fmt(t[0])}`, ...t.slice(1).map((v, i) => `${fmt(t[i])}–${fmt(v)}`), `> ${fmt(t[3])}`] : [];
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
      <span className="font-medium text-navy">{scale.title} (quintiles)</span>
      {labels.map((l, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="h-3 w-4 rounded-sm" style={{ background: scale.ramp[i] }} />
          {l}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <svg width="16" height="12" aria-hidden>
          <rect width="16" height="12" fill="#f1f0ec" />
          <path d="M-2 10 L6 2 M4 14 L14 4 M10 16 L18 8" stroke="#c8c4ba" strokeWidth="2" />
        </svg>
        {scale.title === "Exclusion index" ? "No data" : "Not enough complaints to score (< 30)"}
      </span>
    </div>
  );
}

/** Animates the viewBox to the target and reports when it has landed (true at mount and after each zoom). */
function useAnimatedViewBox(target: ViewBox): [ViewBox, boolean] {
  const key = target.join(",");
  const [vb, setVb] = useState<ViewBox>(target);
  const [landed, setLanded] = useState(key);
  const from = useRef<ViewBox>(target);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 550);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const next = a.map((v, i) => v + (target[i] - v) * e) as ViewBox;
      from.current = next;
      setVb(next);
      if (t < 1) raf = requestAnimationFrame(step);
      else setLanded(key);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return [vb, landed === key];
}
