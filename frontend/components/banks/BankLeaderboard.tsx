"use client";

import { useEffect, useState } from "react";
import { Badge, EmptyState, ErrorBox, SourceNote, Spinner } from "@/components/ui";
import { getBanks } from "@/lib/api";
import { fmtPct, fmtUSD } from "@/lib/format";
import type { BankLeaderboard as Board } from "@/lib/types";

export const MAX_COMPARE = 5;

/** Top FDIC banks in an area by local deposits, with checkboxes to pick banks to compare. */
export default function BankLeaderboard({ fips, selected, onToggle, showNotes = true }: { fips: string; selected: string[]; onToggle: (cert: string) => void; showNotes?: boolean }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: Board; error?: string } | null>(null);
  const key = `${fips}#${attempt}`;

  useEffect(() => {
    let alive = true;
    getBanks(fips, 10)
      .then((data) => alive && setResult({ key, data }))
      .catch((e: Error) => alive && setResult({ key, error: e.message }));
    return () => {
      alive = false;
    };
  }, [fips, key]);

  if (result?.key !== key) return <Spinner label="Loading banks" />;
  if (result.error) return <ErrorBox message={result.error} onRetry={() => setAttempt((a) => a + 1)} />;
  const board = result.data!;
  if (!board.banks.length) return <EmptyState title="No bank data for this area">{board.labels[0]}</EmptyState>;
  const top = board.banks[0].deposit_share || 1;

  return (
    <div>
      <p className="mb-2 text-xs text-muted">
        {board.banks_present} FDIC-insured banks, {fmtUSD(board.total_deposits)} in local deposits (as of {board.as_of}). Pick up to {MAX_COMPARE} to compare.
      </p>
      <ol className="space-y-1">
        {board.banks.map((b) => {
          const on = selected.includes(b.cert);
          const full = !on && selected.length >= MAX_COMPARE;
          return (
            <li key={b.cert}>
              <label className={`grid grid-cols-[1rem_1.25rem_1fr_auto] items-center gap-2 rounded-lg px-1 py-1.5 text-xs ${full ? "opacity-50" : "cursor-pointer hover:bg-paper"}`}>
                <input type="checkbox" checked={on} disabled={full} onChange={() => onToggle(b.cert)} className="accent-navy" aria-label={`Compare ${b.name}`} />
                <span className="text-right font-semibold tabular-nums text-muted">{b.rank}</span>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-navy" title={b.name}>
                    {b.name}
                  </span>
                  <span className="mt-0.5 block h-1.5 rounded bg-paper">
                    <span className="block h-1.5 rounded bg-navy-soft/70" style={{ width: `${(b.deposit_share / top) * 100}%` }} />
                  </span>
                  <span className="mt-0.5 flex flex-wrap gap-x-2 text-muted">
                    <span>{fmtPct(b.deposit_share)} of deposits</span>
                    <span>
                      {b.branches} branch{b.branches === 1 ? "" : "es"}
                    </span>
                    <span>{fmtUSD(b.total_assets)} assets</span>
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <Badge tone={b.issuer_type === "community" ? "good" : "neutral"}>{b.issuer_type === "community" ? "Exempt tier" : "Covered tier"}</Badge>
                  {b.fdic_community_bank && <Badge tone="accent">Community bank</Badge>}
                </span>
              </label>
            </li>
          );
        })}
      </ol>
      {showNotes && board.labels.map((l) => <SourceNote key={l}>{l}</SourceNote>)}
    </div>
  );
}
