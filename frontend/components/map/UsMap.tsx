"use client";

import { geoBounds } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import us from "us-atlas/counties-10m.json";
import { Map as RegionMap, MapControls, MapGeoJSON, MapMarker, MarkerContent, MarkerTooltip, useMap, type MapGeoJSONEvent } from "@/components/ui/map";
import BankLogo from "@/components/ui/BankLogo";
import { bankDotColor, crowdedMarkers } from "@/lib/marker-layout";
import { mapBounds } from "@/lib/map-bounds";
import { fmtInt, fmtScore } from "@/lib/format";
import { TOPIC_LABEL } from "@/lib/topics";
import type { AreaSummary, BranchPin, Layer, TopicId } from "@/lib/types";

const topology = us as unknown as Topology<{ states: GeometryCollection; counties: GeometryCollection }>;
const stateShapes = (feature(topology, topology.objects.states) as FeatureCollection).features;
const countyShapes = (feature(topology, topology.objects.counties) as FeatureCollection).features;
const regionBounds = (shape: Feature) => geoBounds(shape) as [[number, number], [number, number]];

export const NAVY_RAMP = ["#e6ebf3", "#b4c3da", "#7a92ba", "#3f5f96", "#0b1f3a"];
export const HEAT_RAMP = ["#fdebd0", "#fbc580", "#f79e1b", "#dd5a26", "#a8231c"];

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
  /** when set, only this bank's pins are highlighted */
  highlightCert?: string | null;
};

export default function UsMap(props: Props) {
  const { states, counties, stateFips, layer, topic, selectedFips, focusFips, focusSelected } = props;
  const shapes = useMemo(() => stateFips ? countyShapes.filter((s) => String(s.id).slice(0, 2) === stateFips) : stateShapes, [stateFips]);
  const rows = useMemo(() => shapes.flatMap((s) => {
    const row = (stateFips ? counties : states).get(String(s.id));
    return row ? [row] : [];
  }), [shapes, stateFips, counties, states]);
  const scale = useMemo(() => makeScale(rows, layer, topic), [rows, layer, topic]);
  const focused = focusSelected && stateFips ? shapes.find((s) => String(s.id) === selectedFips) : undefined;
  const data = useMemo<FeatureCollection<Geometry, { fips: string; color: string; opacity: number; outline: string; width: number }>>(() => ({
    type: "FeatureCollection",
    features: shapes.map((s) => {
      const fips = String(s.id);
      const row = (stateFips ? counties : states).get(fips);
      return { ...s, properties: { fips, color: row ? scale.color(row) ?? "#f1f0ec" : "#f1f0ec",
        opacity: focused && fips !== selectedFips ? 0.25 : 0.65,
        outline: fips === selectedFips || focusFips.includes(fips) ? "#f79e1b" : "#ffffff",
        width: fips === selectedFips || focusFips.includes(fips) ? 3 : 0.7 } };
    }),
  }), [shapes, stateFips, counties, states, scale, focused, selectedFips, focusFips]);
  const contextStates = useMemo<FeatureCollection<Geometry, { fips: string }>>(() => ({
    type: "FeatureCollection",
    features: stateShapes.filter((s) => String(s.id) !== stateFips).map((s) => ({ ...s, properties: { fips: String(s.id) } })),
  }), [stateFips]);
  const [hover, setHover] = useState<MapGeoJSONEvent<{ fips: string }> | null>(null);
  const hovered = hover ? (stateFips ? counties : states).get(hover.feature.properties.fips) : undefined;
  return (
    <div className="relative w-full">
      <div className="relative h-[610px] max-h-[75vh] min-h-[360px] overflow-hidden rounded-lg border border-line bg-white" onMouseLeave={() => setHover(null)}>
        <RegionMap theme="light" styles={{ light: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/map-style-light.json` }} center={[-98, 38]} zoom={3.3} minZoom={2} maxZoom={18} maxBounds={mapBounds(stateFips)} renderWorldCopies={false}>
          {stateFips && <MapGeoJSON<{ fips: string }> id="surrounding-states" beforeId="waterway_label" data={contextStates} promoteId="fips" interactive
            fillPaint={{ "fill-color": "#ebe9e3", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.55, 12, 0.08, 15, 0] }}
            linePaint={{ "line-color": "#ffffff", "line-width": 0.7 }}
            onClick={(e) => {
              setHover(null);
              if (focused) props.onClearFocus?.();
              else props.onStateClick(e.feature.properties.fips);
            }} />}
          <MapGeoJSON<{ fips: string }> id="regions" beforeId="waterway_label" data={data} promoteId="fips" interactive
            fillPaint={{ "fill-color": ["get", "color"], "fill-opacity": ["interpolate", ["linear"], ["zoom"], 7, ["case", ["boolean", ["feature-state", "hover"], false], 0.85, ["get", "opacity"]], 11, ["case", ["boolean", ["feature-state", "hover"], false], 0.25, 0.18], 14, ["case", ["boolean", ["feature-state", "hover"], false], 0.06, 0.03]] }}
            linePaint={{ "line-color": ["get", "outline"], "line-width": ["get", "width"] }}
            onHover={setHover} onClick={(e) => {
              setHover(null);
              if (focused && e.feature.properties.fips !== selectedFips) props.onClearFocus?.();
              else if (!focused) (stateFips ? props.onCountyClick : props.onStateClick)(e.feature.properties.fips);
            }} />
          <MapNavigation stateFips={stateFips} focused={focused} focusColor={selectedFips && counties.has(selectedFips) ? scale.color(counties.get(selectedFips)!) ?? "#f1f0ec" : "#f1f0ec"} onClearFocus={props.onClearFocus} />
          {focused && <BranchMarkers pins={props.pins ?? []} highlightCert={props.highlightCert ?? null} />}
          <MapControls position="bottom-right" showZoom showCompass />
        </RegionMap>
        {focused && <button onClick={props.onClearFocus} className="absolute left-3 top-3 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-sm">Back to state</button>}
        {hover && hovered && <Tooltip s={hovered} x={hover.originalEvent.point.x} y={hover.originalEvent.point.y} width={hover.originalEvent.target.getContainer().clientWidth} />}
      </div>
      <Legend scale={scale} />
    </div>
  );
}

function MapNavigation({ stateFips, focused, focusColor, onClearFocus }: { stateFips: string | null; focused?: Feature<Geometry>; focusColor: string; onClearFocus?: () => void }) {
  const { map, isLoaded } = useMap();
  const navigationStarted = useRef(false);
  useEffect(() => {
    if (!map || !isLoaded) return;
    const pixels = new Uint8Array(8 * 8 * 4);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const color = (x + y) % 8 < 2 ? [200, 196, 186, 255] : [241, 240, 236, 255];
      pixels.set(color, (y * 8 + x) * 4);
    }
    map.addImage("no-data-hatch", { width: 8, height: 8, data: pixels });
    map.addLayer({ id: "no-data-hatch", type: "fill", source: "geojson-source-regions",
      filter: ["==", ["get", "color"], "#f1f0ec"],
      paint: { "fill-pattern": "no-data-hatch", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 7, ["get", "opacity"], 11, 0.18, 14, 0.03] } }, "waterway_label");
    return () => {
      if (!map.getStyle()) return;
      if (map.getLayer("no-data-hatch")) map.removeLayer("no-data-hatch");
      if (map.hasImage("no-data-hatch")) map.removeImage("no-data-hatch");
    };
  }, [map, isLoaded]);
  useEffect(() => {
    if (!map || !isLoaded) return;
    const duration = navigationStarted.current ? 650 : 0;
    navigationStarted.current = true;
    map.setMaxBounds(mapBounds(stateFips));
    const shape = focused ?? stateShapes.find((s) => String(s.id) === stateFips);
    if (shape) map.fitBounds(regionBounds(shape), { padding: focused ? 100 : 40, maxZoom: focused ? 12 : 8, pitch: focused ? 35 : 0, duration });
    else map.fitBounds([[-125, 24], [-66, 50]], { padding: 30, pitch: 0, duration });
  }, [map, isLoaded, stateFips, focused]);
  useEffect(() => {
    if (!map || !isLoaded || !focused) return;
    const bounds = regionBounds(focused);
    const height = Math.max(500, (bounds[1][1] - bounds[0][1]) * 4000);
    map.addSource("county-focus", { type: "geojson", data: focused });
    map.addLayer({ id: "county-focus", type: "fill-extrusion", source: "county-focus", paint: {
      "fill-extrusion-color": focusColor, "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 10, height, 13, 0], "fill-extrusion-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.2, 13, 0],
    } }, "waterway_label");
    return () => {
      if (!map.getStyle()) return;
      if (map.getLayer("county-focus")) map.removeLayer("county-focus");
      if (map.getSource("county-focus")) map.removeSource("county-focus");
    };
  }, [map, isLoaded, focused, focusColor]);
  useEffect(() => {
    if (!map || !isLoaded || !focused) return;
    const clear = (e: import("maplibre-gl").MapMouseEvent) => {
      if (!map.queryRenderedFeatures(e.point, { layers: ["geojson-fill-regions"] }).length) onClearFocus?.();
    };
    map.on("click", clear);
    return () => { map.off("click", clear); };
  }, [map, isLoaded, focused, onClearFocus]);
  return null;
}

function BranchMarkers({ pins, highlightCert }: { pins: BranchPin[]; highlightCert: string | null }) {
  const { map } = useMap();
  const [, setRevision] = useState(0);
  useEffect(() => {
    if (!map) return;
    const update = () => setRevision((n) => n + 1);
    map.on("moveend", update);
    return () => { map.off("moveend", update); };
  }, [map]);
  const crowded = (() => {
    const active = pins.map((p, i) => ({ p, i })).filter(({ p }) => !highlightCert || p.cert === highlightCert);
    const overlapping = crowdedMarkers(active.map(({ p }) => map?.project([p.lon, p.lat]) ?? { x: 0, y: 0 }), 36);
    return new Set(active.filter((_, i) => overlapping.has(i)).map(({ i }) => i));
  })();
  return pins.map((p, i) => {
    const lit = !highlightCert || p.cert === highlightCert;
    return <MapMarker key={`${p.cert}-${i}`} longitude={p.lon} latitude={p.lat}>
      <MarkerContent><div style={{ opacity: lit ? 1 : 0.15 }}>
        {lit && !crowded.has(i) ? <div className="h-8 w-8 [&>span]:h-8 [&>span]:w-8 [&>span]:rounded-sm [&>span]:text-xs [&_img]:h-8 [&_img]:w-8 [&_img]:p-0.5"><BankLogo name={p.bank ?? "Other bank"} website={p.website} /></div> : <div className="h-2 w-2 rounded-full border border-white" style={{ background: bankDotColor(p.rank) }} />}
      </div></MarkerContent>
      <MarkerTooltip className="border border-line bg-white text-navy">{p.bank ?? "Other bank"} · {p.branch}</MarkerTooltip>
    </MapMarker>;
  });
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
