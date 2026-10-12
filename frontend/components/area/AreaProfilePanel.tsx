"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Card, DataStatusBadge, EmptyState, ErrorBox, SourceNote, Spinner, Stat, TopicIcon } from "@/components/ui";
import { getProfile } from "@/lib/api";
import { fmtInt, fmtPct, fmtScore } from "@/lib/format";
import { TOPIC_LABEL, TOPICS } from "@/lib/topics";
import type { AreaProfile } from "@/lib/types";

export default function AreaProfilePanel({ fips, onSelect }: { fips: string | null; onSelect: (fips: string) => void }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; profile?: AreaProfile; error?: string } | null>(null);
  const key = `${fips}#${attempt}`;

  useEffect(() => {
    if (!fips) return;
    let alive = true;
    getProfile(fips)
      .then((profile) => alive && setResult({ key, profile }))
      .catch((e: Error) => alive && setResult({ key, error: e.message }));
    return () => {
      alive = false;
    };
  }, [fips, key]);

  const loading = result?.key !== key;
  const profile = result?.profile ?? null;
  const error = !loading ? result?.error : null;
  const load = () => setAttempt((a) => a + 1);

  if (!fips) return <EmptyState title="No area selected">Click a state, then a county on the map, or ask the agent.</EmptyState>;
  if (loading && !profile) return <Spinner label="Loading area profile" />;
  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!profile) return null;

  const { area, frustration: fr, benefit, lookalikes, labels } = profile;
  const status = fr?.status ?? "no_data";
  const ok = status === "ok";
  const isCounty = area.level === "county";
  const maxShare = Math.max(...TOPICS.map((t) => fr?.topic_shares?.[t] ?? 0), 0.01);

  return (
    <div className={`space-y-3 ${loading ? "opacity-60" : ""}`}>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-navy">
            {area.name}
            {isCounty ? `, ${area.state_abbr}` : ""}
          </h2>
          <DataStatusBadge status={status} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <Stat label="Exclusion index" value={fmtScore(area.exclusion_index)} sublabel={`Rank ${fmtInt(area.exclusion_rank)} of US ${isCounty ? "counties" : "states"}`} tag="sourced" />
          <Stat label="Frustration score" value={ok ? fmtScore(fr?.frustration_score) : "Not enough data"} sublabel={fr ? `${fmtInt(fr.complaints)} CFPB complaints` : "No CFPB complaints"} />
        </div>
      </div>

      <Card title="Who is left out">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Households" value={fmtInt(area.households)} tag="sourced" />
          <Stat label="Est. underserved households" value={fmtInt(area.est_underserved_hh)} sublabel={fmtPct(area.underserved_rate)} tag="modeled" />
          <Stat label="Poverty rate" value={fmtPct(area.poverty_rate)} tag="sourced" />
          <Stat label="No internet at home" value={fmtPct(area.no_internet_rate)} tag="sourced" />
          <Stat label="Bank branches per 10k households" value={area.branches_per_10k_hh?.toFixed(1) ?? "—"} sublabel={`${fmtInt(area.branches)} branches`} tag="sourced" />
          <Stat label="Median household income" value={area.median_income == null ? "—" : `$${fmtInt(area.median_income)}`} tag="sourced" />
          <Stat label="Unbanked" value={fmtPct(area.unbanked_rate)} tag={isCounty ? "state-level" : "sourced"} />
          <Stat label="Underbanked" value={fmtPct(area.underbanked_rate)} tag={isCounty ? "state-level" : "sourced"} />
        </div>
        <SourceNote>ACS 5-year 2020-2024, FDIC 2023 household survey, FDIC BankFind branches.</SourceNote>
      </Card>

      <Card title="What frustrates people">
        {!fr ? (
          <EmptyState title="No complaints on record">No CFPB complaints for these products in the window.</EmptyState>
        ) : (
          <>
            {!ok && <p className="mb-2 text-xs text-amber-800">Fewer than 30 complaints, so these numbers are not scored and may be noisy.</p>}
            <ul className="space-y-1.5">
              {TOPICS.map((t) => {
                const share = fr.topic_shares?.[t] ?? 0;
                const pain = fr.pain_scores?.[t];
                const top = fr.top_topic === t;
                return (
                  <li key={t} className="grid grid-cols-[1.25rem_8rem_1fr_3.5rem] items-center gap-2 text-xs">
                    <TopicIcon topic={t} className={top ? "text-accent" : "text-muted"} />
                    <span className={top ? "font-semibold text-navy" : "text-navy"}>{TOPIC_LABEL[t]}</span>
                    <span className="h-2 rounded bg-paper">
                      <span className={`block h-2 rounded ${top ? "bg-accent" : "bg-navy-soft/60"}`} style={{ width: `${(share / maxShare) * 100}%` }} />
                    </span>
                    <span className="text-right tabular-nums text-muted" title="Pain score: topic share vs national, weighted by intensity">
                      {fmtPct(share, 0)} · {pain?.toFixed(2) ?? "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-1 text-[11px] text-muted">Share of complaints · pain score (1.00 = national level at intensity 5)</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Stat label="Mean intensity (1-5)" value={fr.mean_intensity?.toFixed(1) ?? "—"} sublabel={fr.intensity_source ? `From ${fr.intensity_source} narratives` : undefined} tag="modeled" />
              <Stat label="Complaints per 100k" value={fr.complaints_per_100k?.toFixed(1) ?? "—"} sublabel={`${fmtInt(fr.complaints)} total`} tag="sourced" />
            </div>
            {fr.excerpts.length > 0 && (
              <div className="mt-3 space-y-2">
                {fr.excerpts.slice(0, 3).map((e, i) => (
                  <blockquote key={i} className="rounded-lg border-l-2 border-accent bg-paper p-2 text-xs text-navy">
                    <div className="mb-1 text-[10px] uppercase tracking-wide text-muted">
                      CFPB complaint excerpt · {TOPIC_LABEL[e.topic]}
                    </div>
                    “{e.text}”
                  </blockquote>
                ))}
              </div>
            )}
            <SourceNote>CFPB Consumer Complaint Database. Topics and intensity classified by a Foundry model.</SourceNote>
          </>
        )}
      </Card>

      {benefit && (
        <Card title="Matched benefit" action={<Badge tone="accent">{TOPIC_LABEL[benefit.topic]}</Badge>}>
          <p className="text-sm font-medium text-navy">{benefit.title}</p>
          <p className="mt-1 text-xs text-muted">{benefit.description}</p>
          <p className="mt-2 text-xs text-navy">
            <span className="text-muted">Pilot tracks: </span>
            {benefit.pain_measure}
          </p>
        </Card>
      )}

      <Card title={`Look-alike ${isCounty ? "counties" : "states"}`}>
        {lookalikes.length === 0 ? (
          <EmptyState title="No look-alikes yet">Look-alikes need areas with enough complaint data at least 150 km away.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {lookalikes.map((l) => (
              <li key={l.fips}>
                <button onClick={() => onSelect(l.fips)} className="flex w-full items-center justify-between gap-2 py-2 text-left text-xs hover:bg-paper">
                  <span>
                    <span className="font-medium text-navy">
                      {l.name}, {l.state_abbr}
                    </span>
                    <span className="block text-muted">
                      {fmtInt(l.distance_km)} km away · exclusion {fmtScore(l.exclusion_index)}
                      {l.top_topic ? ` · ${TOPIC_LABEL[l.top_topic]}` : ""}
                    </span>
                  </span>
                  <Badge>{Math.round(l.similarity * 100)}% similar</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="sticky bottom-0 bg-white/90 pt-2 backdrop-blur">
        {ok ? (
          <Link href={`/plan?fips=${area.fips}`} className="flex w-full items-center justify-center rounded-lg bg-navy px-3 py-2.5 text-sm font-medium text-white hover:bg-navy-soft">
            Build pilot plan →
          </Link>
        ) : (
          <div>
            <button disabled className="w-full cursor-not-allowed rounded-lg bg-navy px-3 py-2.5 text-sm font-medium text-white opacity-50">
              Build pilot plan →
            </button>
            <p className="mt-1 text-center text-xs text-muted">Needs at least 30 CFPB complaints to ground the plan.</p>
          </div>
        )}
      </div>

      {labels.map((l) => (
        <SourceNote key={l}>{l}</SourceNote>
      ))}
    </div>
  );
}
