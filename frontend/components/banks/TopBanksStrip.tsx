"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui";
import BankLogo from "@/components/ui/BankLogo";
import { getBanks } from "@/lib/api";
import { pinColor } from "@/lib/banks";
import { fmtPct } from "@/lib/format";
import type { BankLeaderboard } from "@/lib/types";

/** Top 3 banks for the selected county, shown under the map, with a link to the full bank page. */
export default function TopBanksStrip({ fips, name }: { fips: string; name: string }) {
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
          {data.banks.map((b) => (
            <li key={b.cert} className="rounded-lg border border-line bg-white p-2 text-xs">
              <div className="flex items-start gap-2">
                <BankLogo name={b.name} website={b.website} />
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ background: pinColor(b.rank) }}>
                  {b.rank}
                </span>
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
            </li>
          ))}
        </ol>
      )}
      {data && (
        <p className="mt-2 text-[11px] text-muted">
          FDIC Summary of Deposits, {data.as_of}. Ranked by local deposits, the public proxy for customers. Map pins: numbered colors = these banks, grey = other banks.
        </p>
      )}
    </div>
  );
}
