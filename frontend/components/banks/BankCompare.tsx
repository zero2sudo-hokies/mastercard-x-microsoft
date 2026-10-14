"use client";

import { useEffect, useState, type ReactNode } from "react";
import { EmptyState, ErrorBox, SourceNote, Spinner, Tag } from "@/components/ui";
import { compareBanks } from "@/lib/api";
import { fmtInt, fmtPct, fmtUSD } from "@/lib/format";
import type { AudienceBasis, BankCompare as Compare } from "@/lib/types";

type Shared = { adoption_rate?: number | null; fixed_program_cost?: number | null; audience_basis?: AudienceBasis };

/** Side-by-side ROI and footprint for 2-5 banks. Churn and acquisition cost follow each bank's own tier. */
export default function BankCompare({ fips, certs, shared, target, onTarget }: { fips: string; certs: string[]; shared: Shared; target: string | null; onTarget: (cert: string) => void }) {
  const [result, setResult] = useState<{ key: string; data?: Compare; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([fips, certs, shared, attempt]);

  useEffect(() => {
    if (certs.length < 2) return;
    let alive = true;
    compareBanks({ fips, certs, ...shared })
      .then((data) => alive && setResult({ key, data }))
      .catch((e: Error) => alive && setResult({ key, error: e.message }));
    return () => {
      alive = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (certs.length < 2) return <EmptyState title="Pick at least 2 banks to compare">Tick banks in the leaderboard (up to 5).</EmptyState>;
  if (result?.key !== key && !result?.data) return <Spinner label="Comparing banks" />;
  if (result?.key === key && result.error) return <ErrorBox message={result.error} onRetry={() => setAttempt((a) => a + 1)} />;
  const data = result!.data!;
  const stale = result?.key !== key;
  const best = Math.max(...data.rows.map((r) => r.roi.program.issuer_net_lifetime));

  const rows: [ReactNode, (r: Compare["rows"][number]) => ReactNode][] = [
    ["Local deposit share", (r) => fmtPct(r.bank.deposit_share)],
    ["Local branches", (r) => fmtInt(r.bank.branches)],
    [<>Underserved households per branch <Tag tag="modeled" /></>, (r) => fmtInt(r.underserved_households_per_branch)],
    ["Total assets", (r) => fmtUSD(r.bank.total_assets)],
    ["Debit pricing tier", (r) => (r.bank.issuer_type === "community" ? "Exempt (<$10B)" : "Covered ($10B+)")],
    ["FDIC community bank", (r) => (r.bank.fdic_community_bank ? "Yes" : "No")],
    ["Net interest margin (whole bank)", (r) => fmtPct(r.bank.net_interest_margin, 2)],
    ["Efficiency ratio (whole bank)", (r) => fmtPct(r.bank.efficiency_ratio, 0)],
    ["Annual margin per account", (r) => <Signed v={r.roi.unit.annual_margin} />],
    ["Breakeven churn", (r) => (r.roi.unit.breakeven_churn == null ? "Never" : fmtPct(r.roi.unit.breakeven_churn))],
    [<>Issuer net, lifetime <Tag tag="modeled" /></>, (r) => <Signed v={r.roi.program.issuer_net_lifetime} usd strong={r.roi.program.issuer_net_lifetime === best} />],
    [<>Network volume, year 1 <Tag tag="modeled" /></>, (r) => fmtUSD(r.roi.program.network_volume_y1)],
  ];

  return (
    <div className={stale ? "opacity-60" : ""}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-xs">
          <thead>
            <tr className="text-left">
              <th className="py-2 pr-2 font-normal text-muted">{data.area_name}</th>
              {data.rows.map((r) => (
                <th key={r.bank.cert} className="py-2 pr-2 align-bottom font-semibold text-navy">
                  <span className="text-muted">#{r.bank.rank} </span>
                  {r.bank.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map(([label, cell], i) => (
              <tr key={i} className="border-t border-line">
                <td className="py-1.5 pr-2 text-muted">{label}</td>
                {data.rows.map((r) => (
                  <td key={r.bank.cert} className="py-1.5 pr-2 text-navy">
                    {cell(r)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t border-line">
              <td className="py-2 pr-2 text-muted">Target for the pilot plan</td>
              {data.rows.map((r) => (
                <td key={r.bank.cert} className="py-2 pr-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-navy">
                    <input type="radio" name="target-bank" checked={target === r.bank.cert} onChange={() => onTarget(r.bank.cert)} className="accent-navy" />
                    Pitch this bank
                  </label>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {data.labels.map((l) => (
        <SourceNote key={l}>{l}</SourceNote>
      ))}
    </div>
  );
}

function Signed({ v, usd = true, strong }: { v: number; usd?: boolean; strong?: boolean }) {
  return <span className={`${v >= 0 ? "text-emerald-700" : "text-red-700"} ${strong ? "font-semibold" : ""}`}>{usd ? fmtUSD(v) : v}</span>;
}
