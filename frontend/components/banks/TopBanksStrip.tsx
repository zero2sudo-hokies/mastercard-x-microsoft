"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui";
import BankLogo from "@/components/ui/BankLogo";
import { getBanks } from "@/lib/api";
import { fmtPct } from "@/lib/format";
import type { BankLeaderboard } from "@/lib/types";

/** Top 3 banks for the selected county, shown under the map, with a link to the full bank page. */
export default function TopBanksStrip({ fips, name, selected = null, onSelect }: { fips: string; name: string; selected?: string | null; onSelect?: (cert: string | null) => void }) {
  const [result, setResult] = useState<{ fips: string; data?: BankLeaderboard; error?: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    getBanks(fips, 3)
      .then((data) => alive && setResult({ fips, data }))
      .catch(() => alive && setResult({ fips, error: true }));
    return () => {
      alive = false;
    };
  }, [fips]);

  const data = result?.fips === fips ? result.data : undefined;
  const loading = result?.fips !== fips;

  return (
    <div className="mt-3 rounded-xl border border-line bg-paper/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-navy">Top banks in {name}</h3>
        <Link href={`/banks?fips=${fips}`} className="rounded-lg border border-navy px-2.5 py-1 text-xs font-medium text-navy hover:bg-white">
          Expand: compare banks →
        </Link>
      </div>
      {loading ? (
        <p className="text-xs text-muted">Loading banks...</p>
      ) : result?.error ? (
        <p className="text-xs text-muted">Bank data is unavailable right now.</p>
      ) : !data?.banks.length ? (
        <p className="text-xs text-muted">No FDIC-insured bank branches recorded here.</p>
      ) : (
        <ol className="grid gap-2 sm:grid-cols-3">
          {data.banks.map((b) => {
            const on = selected === b.cert;
            const dimmed = selected != null && !on;
            return (
            <li key={b.cert}>
              <button
                type="button"
                disabled={!onSelect}
                aria-pressed={on}
                onClick={() => onSelect?.(on ? null : b.cert)}
                className={`h-full w-full rounded-lg border bg-white p-2 text-left text-xs transition ${on ? "border-2 shadow-sm" : "border-line"} ${dimmed ? "opacity-50" : ""} ${onSelect ? "cursor-pointer hover:border-navy" : "cursor-default"}`}
                style={on ? { borderColor: "#0b1f3a" } : undefined}
                title={onSelect ? (on ? "Show all branches" : `Show only ${b.name} branches`) : undefined}
              >
              <div className="flex items-start gap-2">
                <BankLogo name={b.name} website={b.website} />
                <span className="line-clamp-2 font-medium text-navy" title={b.name}>
                  {b.name}
                </span>
              </div>
              <div className="mt-1 text-muted">
                {fmtPct(b.deposit_share)} of local deposits · {b.branches} branch{b.branches === 1 ? "" : "es"}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                <Badge tone={b.issuer_type === "community" ? "good" : "neutral"}>{b.issuer_type === "community" ? "Exempt tier" : "Covered tier"}</Badge>
                {b.fdic_community_bank && <Badge tone="accent">Community bank</Badge>}
              </div>
              </button>
            </li>
            );
          })}
        </ol>
      )}
      {data && (
        <p className="mt-2 text-[11px] text-muted">
          FDIC Summary of Deposits, {data.as_of}. Ranked by local deposits, the public proxy for customers. Crowded branches appear as dots; zoom in for bank logos.{onSelect ? " Click a bank to show only its branches." : ""}
        </p>
      )}
    </div>
  );
}
