"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import AreaProfilePanel from "@/components/area/AreaProfilePanel";
import TopBanksStrip from "@/components/banks/TopBanksStrip";
import ChatPanel from "@/components/chat/ChatPanel";
import UsMap from "@/components/map/UsMap";
import { ErrorBox, Spinner, Tabs } from "@/components/ui";
import { getAreas, USE_MOCK } from "@/lib/api";
import { TOPIC_LABEL, TOPICS } from "@/lib/topics";
import type { AreaSummary, Layer, TopicId } from "@/lib/types";

type Side = "agent" | "profile";
const EMPTY = new Map<string, AreaSummary>();

export default function Dashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const layer: Layer = params.get("layer") === "frustration" ? "frustration" : "underserved";
  const stateFips = params.get("state");
  const fips = params.get("fips");
  const topicParam = params.get("topic") as TopicId | null;
  const topic = topicParam && TOPICS.includes(topicParam) ? topicParam : null;

  const setQuery = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  const [side, setSide] = useState<Side>(fips ? "profile" : "agent");
  const [focusFips, setFocusFips] = useState<string[]>([]);

  // bump to retry a failed load
  const [attempt, setAttempt] = useState(0);
  const retry = () => setAttempt((a) => a + 1);

  // states, loaded once
  const [states, setStates] = useState<Map<string, AreaSummary> | null>(null);
  const [statesError, setStatesError] = useState<{ attempt: number; message: string } | null>(null);
  useEffect(() => {
    let alive = true;
    getAreas("state")
      .then((rows) => alive && setStates(new Map(rows.map((r) => [r.fips, r]))))
      .catch((e: Error) => alive && setStatesError({ attempt, message: e.message }));
    return () => {
      alive = false;
    };
  }, [attempt]);

  // counties of the zoomed state, cached per state
  const [countyCache, setCountyCache] = useState<Record<string, Map<string, AreaSummary>>>({});
  const [countyError, setCountyError] = useState<{ key: string; message: string } | null>(null);
  const countyKey = `${stateFips}#${attempt}`;
  const cached = stateFips ? countyCache[stateFips] : undefined;
  useEffect(() => {
    if (!stateFips || cached) return;
    let alive = true;
    getAreas("county", stateFips)
      .then((rows) => {
        // mock mode returns Texas for every state, so keep only this state's rows
        const map = new Map(rows.filter((r) => r.state_fips === stateFips).map((r) => [r.fips, r]));
        if (alive) setCountyCache((c) => ({ ...c, [stateFips]: map }));
      })
      .catch((e: Error) => alive && setCountyError({ key: countyKey, message: e.message }));
    return () => {
      alive = false;
    };
  }, [stateFips, cached, countyKey]);

  const counties = cached ?? EMPTY;
  const statesErrorMsg = statesError?.attempt === attempt && !states ? statesError.message : null;
  const countyErrorMsg = countyError?.key === countyKey && !cached ? countyError.message : null;

  const select = (f: string) => {
    setQuery({ fips: f, state: f.slice(0, 2) });
    setSide("profile");
  };

  // chat highlights areas; zoom to the first one's state if it is a county elsewhere
  const onFocus = (list: string[]) => {
    setFocusFips(list);
    const first = list[0];
    if (first?.length === 5 && first.slice(0, 2) !== stateFips) setQuery({ state: first.slice(0, 2) });
  };

  const stateName = stateFips ? states?.get(stateFips)?.name : null;
  const selectedName = fips ? (counties.get(fips)?.name ?? states?.get(fips)?.name) : null;

  return (
    <div className="grid gap-4 p-4 lg:h-[calc(100vh-7.5rem)] lg:grid-cols-[62fr_38fr]">
      <section className="flex min-h-0 flex-col rounded-xl border border-line bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div role="radiogroup" aria-label="Map layer" className="flex rounded-lg bg-paper p-1">
            {(["underserved", "frustration"] as Layer[]).map((l) => (
              <button
                key={l}
                role="radio"
                aria-checked={layer === l}
                onClick={() => setQuery({ layer: l === "underserved" ? null : l, topic: l === "underserved" ? null : topic })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${layer === l ? "bg-navy text-white" : "text-muted hover:text-navy"}`}
              >
                {l === "underserved" ? "Underserved" : "Frustration"}
              </button>
            ))}
          </div>
          {layer === "frustration" && (
            <select
              aria-label="Frustration topic"
              value={topic ?? ""}
              onChange={(e) => setQuery({ topic: e.target.value || null })}
              className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-navy"
            >
              <option value="">All frustrations</option>
              {TOPICS.map((t) => (
                <option key={t} value={t}>
                  {TOPIC_LABEL[t]}
                </option>
              ))}
            </select>
          )}
          <nav aria-label="Breadcrumb" className="ml-auto flex items-center gap-1 text-sm">
            <button onClick={() => setQuery({ state: null, fips: null })} className={stateFips ? "text-muted hover:text-navy hover:underline" : "font-medium text-navy"}>
              United States
            </button>
            {stateName && (
              <>
                <span className="text-muted">›</span>
                <button onClick={() => setQuery({ fips: null })} className={fips ? "text-muted hover:text-navy hover:underline" : "font-medium text-navy"}>
                  {stateName}
                </button>
              </>
            )}
            {selectedName && fips !== stateFips && (
              <>
                <span className="text-muted">›</span>
                <span className="font-medium text-navy">{selectedName}</span>
              </>
            )}
          </nav>
        </div>

        <div className="relative min-h-0 flex-1 overflow-auto">
          {statesErrorMsg ? (
            <ErrorBox message={statesErrorMsg} onRetry={retry} />
          ) : !states ? (
            <Spinner label="Loading map data" />
          ) : (
            <>
              {countyErrorMsg && <ErrorBox message={countyErrorMsg} onRetry={retry} />}
              {stateFips && !cached && !countyErrorMsg && (
                <div className="absolute right-2 top-2 z-10 rounded bg-white/90 px-2 py-1">
                  <Spinner label="Loading counties" />
                </div>
              )}
              <UsMap
                states={states}
                counties={counties}
                stateFips={stateFips}
                layer={layer}
                topic={layer === "frustration" ? topic : null}
                selectedFips={fips}
                focusFips={focusFips}
                onStateClick={(f) => setQuery({ state: f, fips: null })}
                onCountyClick={select}
                focusSelected={layer === "frustration"}
                onClearFocus={() => setQuery({ fips: null })}
              />
              {fips?.length === 5 && <TopBanksStrip fips={fips} name={selectedName ? `${selectedName}` : "this county"} />}
              <p className="mt-1 text-[11px] text-muted">
                {layer === "underserved"
                  ? "Exclusion index: FDIC 2023 unbanked and underbanked, ACS poverty, no internet, income, and bank branch density."
                  : "Frustration score: percentile of CFPB complaints per 100k residents. Under 30 complaints is not scored (hatched)."}
                {stateFips ? " County unbanked rates are state-level." : " Click a state to see its counties."}
                {USE_MOCK && " Mock data."}
              </p>
            </>
          )}
        </div>
      </section>

      <aside className="flex min-h-0 flex-col rounded-xl border border-line bg-white p-4 shadow-sm">
        <Tabs<Side>
          tabs={[
            { id: "agent", label: "Ask the agent" },
            { id: "profile", label: "Area profile" },
          ]}
          value={side}
          onChange={setSide}
        />
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          <div className={side === "agent" ? "h-full" : "hidden"}>
            <ChatPanel context={{ layer, state_fips: stateFips, selected_fips: fips }} onFocus={onFocus} onSelect={select} />
          </div>
          {side === "profile" && <AreaProfilePanel fips={fips} onSelect={select} />}
        </div>
      </aside>
    </div>
  );
}
