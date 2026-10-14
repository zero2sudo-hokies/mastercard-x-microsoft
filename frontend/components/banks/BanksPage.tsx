"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import BankCompare from "@/components/banks/BankCompare";
import BankLeaderboard, { MAX_COMPARE } from "@/components/banks/BankLeaderboard";
import { Card, DataStatusBadge, EmptyState, ErrorBox, Spinner } from "@/components/ui";
import { getProfile } from "@/lib/api";
import type { AreaProfile } from "@/lib/types";

/** Bank partners for one area: full leaderboard, side-by-side comparison, and a bank-specific pilot plan. */
export default function BanksPage() {
  const params = useSearchParams();
  const fips = params.get("fips");
  const [certs, setCerts] = useState<string[]>(() => (params.get("banks") || "").split(",").filter(Boolean).slice(0, MAX_COMPARE));
  const [profile, setProfile] = useState<{ fips: string; data?: AreaProfile; error?: string } | null>(null);

  useEffect(() => {
    if (!fips) return;
    let alive = true;
    getProfile(fips)
      .then((data) => alive && setProfile({ fips, data }))
      .catch((e: Error) => alive && setProfile({ fips, error: e.message }));
    return () => {
      alive = false;
    };
  }, [fips]);

  if (!fips) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <EmptyState title="No area chosen">
          Pick a county on the <Link href="/" className="underline">dashboard</Link>, then open its banks.
        </EmptyState>
      </div>
    );
  }

  const p = profile?.fips === fips ? profile.data : undefined;
  const err = profile?.fips === fips ? profile.error : undefined;
  const canPlan = p?.frustration?.status === "ok";
  const toggle = (cert: string) => setCerts((c) => (c.includes(cert) ? c.filter((x) => x !== cert) : [...c, cert]));

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <header>
        <Link href={`/?fips=${fips}&state=${fips.slice(0, 2)}&layer=frustration`} className="text-xs text-muted hover:text-navy hover:underline">
          ← Back to map
        </Link>
        {err ? (
          <ErrorBox message={err} />
        ) : !p ? (
          <Spinner label="Loading area" />
        ) : (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-navy">
              Bank partners: {p.area.name}
              {p.area.level === "county" ? `, ${p.area.state_abbr}` : ""}
            </h1>
            <DataStatusBadge status={p.frustration?.status ?? "no_data"} />
          </div>
        )}
        <p className="mt-1 text-sm text-muted">Which issuer should Mastercard approach? Pick 2 to {MAX_COMPARE} banks to compare footprint and pilot economics, then build a plan pitched to one of them.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
        <Card title="Top banks by local deposits">
          <BankLeaderboard fips={fips} selected={certs} onToggle={toggle} />
        </Card>
        <Card title="Compare banks">
          <BankCompare
            fips={fips}
            certs={certs}
            planHref={canPlan ? (cert) => `/plan?fips=${fips}&bank=${cert}` : undefined}
          />
          {p && !canPlan && <p className="mt-2 text-xs text-muted">A pilot plan needs at least 30 CFPB complaints in this area, so plan buttons are off here.</p>}
        </Card>
      </div>
    </div>
  );
}
