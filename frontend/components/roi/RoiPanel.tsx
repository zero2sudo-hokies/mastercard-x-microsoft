"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Card, ErrorBox, SourceNote, Spinner, Tag, type DataTag } from "@/components/ui";
import { getAssumptions, postRoi } from "@/lib/api";
import { fmtInt, fmtPct, fmtUSD } from "@/lib/format";
import type { Benchmarks, IssuerType, RoiRequest, RoiResult } from "@/lib/types";
import LtvChart from "./LtvChart";

type Inputs = Omit<RoiRequest, "fips"> & { adoption_rate: number; churn: number; cac: number; fixed_program_cost: number; network_yield: number };

function defaultsFor(b: Benchmarks, issuer: IssuerType, prev?: Inputs): Inputs {
  return {
    issuer_type: issuer,
    adoption_rate: prev?.adoption_rate ?? b.roi_defaults.adoption_rate,
    churn: b.churn_observed[issuer],
    cac: b.cac[issuer],
    fixed_program_cost: prev?.fixed_program_cost ?? b.roi_defaults.fixed_program_cost,
    network_yield: prev?.network_yield ?? b.network_yield_placeholder,
  };
}

export default function RoiPanel({ fips, onChange }: { fips: string; onChange?: (req: RoiRequest, result: RoiResult) => void }) {
  const [bench, setBench] = useState<Benchmarks | null>(null);
  const [inputs, setInputs] = useState<Inputs | null>(null);
  const [benchError, setBenchError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: RoiResult; error?: string } | null>(null);

  useEffect(() => {
    let alive = true;
    getAssumptions()
      .then((b) => {
        if (!alive) return;
        setBench(b);
        setInputs(defaultsFor(b, b.roi_defaults.issuer_type));
      })
      .catch((e: Error) => alive && setBenchError(e.message));
    return () => {
      alive = false;
    };
  }, [attempt]);

  const req: RoiRequest | null = inputs ? { fips, ...inputs } : null;
  const key = req ? `${JSON.stringify(req)}#${attempt}` : "";

  // debounced recompute on every input change
  useEffect(() => {
    if (!req) return;
    let alive = true;
    const t = setTimeout(() => {
      postRoi(req)
        .then((data) => {
          if (!alive) return;
          setResult({ key, data });
          onChange?.(req, data);
        })
        .catch((e: Error) => alive && setResult({ key, error: e.message }));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (benchError) return <ErrorBox message={benchError} onRetry={() => (setBenchError(null), setAttempt((a) => a + 1))} />;
  if (!bench || !inputs) return <Spinner label="Loading ROI assumptions" />;

  const set = (patch: Partial<Inputs>) => setInputs({ ...inputs, ...patch });
  const data = result?.data;
  const stale = result?.key !== key;
  const error = !stale ? result?.error : null;

  return (
    <div className="space-y-4">
      <Card title="Levers">
        <div className="space-y-4">
          <div role="radiogroup" aria-label="Issuer type" className="flex rounded-lg bg-paper p-1">
            {(["community", "large_bank"] as IssuerType[]).map((t) => (
              <button
                key={t}
                role="radio"
                aria-checked={inputs.issuer_type === t}
                onClick={() => setInputs(defaultsFor(bench, t, inputs))}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${inputs.issuer_type === t ? "bg-navy text-white" : "text-muted hover:text-navy"}`}
              >
                {t === "community" ? "Community issuer" : "Large bank"}
              </button>
            ))}
          </div>

          <Slider label="Adoption rate" tag="placeholder" value={inputs.adoption_rate} min={0.005} max={0.15} step={0.005} display={fmtPct(inputs.adoption_rate)} onChange={(v) => set({ adoption_rate: v })} />

          <div>
            <Slider label="Yearly churn" value={inputs.churn} min={0.05} max={0.5} step={0.01} display={fmtPct(inputs.churn, 0)} onChange={(v) => set({ churn: v })} />
            <div className="mt-1.5 flex gap-2">
              <Chip onClick={() => set({ churn: bench.churn_observed[inputs.issuer_type] })}>Observed {fmtPct(bench.churn_observed[inputs.issuer_type], 0)}</Chip>
              <Chip disabled={data?.unit.breakeven_churn == null} onClick={() => data?.unit.breakeven_churn != null && set({ churn: Math.max(0.05, data.unit.breakeven_churn) })}>
                Breakeven{data?.unit.breakeven_churn != null ? ` ${fmtPct(data.unit.breakeven_churn)}` : ""}
              </Chip>
            </div>
          </div>

          <Slider label="Acquisition cost per account" value={inputs.cac} min={100} max={700} step={10} display={fmtUSD(inputs.cac)} onChange={(v) => set({ cac: v })} />

          <NumberField label="Fixed program cost" tag="placeholder" prefix="$" value={inputs.fixed_program_cost} step={5000} onChange={(v) => set({ fixed_program_cost: v })} />

          <details className="text-sm">
            <summary className="cursor-pointer text-xs font-medium text-muted">Advanced</summary>
            <div className="mt-2">
              <NumberField
                label="Network yield (net revenue / volume)"
                tag="placeholder"
                suffix="%"
                value={+(inputs.network_yield * 100).toFixed(3)}
                step={0.01}
                onChange={(v) => set({ network_yield: v / 100 })}
              />
              <SourceNote>{bench.notes.network_yield_placeholder}</SourceNote>
            </div>
          </details>
        </div>
      </Card>

      {error && <ErrorBox message={error} onRetry={() => setAttempt((a) => a + 1)} />}
      {!data && !error && <Spinner label="Computing ROI" />}

      {data && (
        <div className={`space-y-4 transition-opacity ${stale ? "opacity-60" : ""}`} aria-busy={stale}>
          <Card title="Per account, per year">
            <table className="w-full text-sm">
              <tbody className="tabular-nums">
                <UnitRow label="Card spend" value={fmtUSD(data.unit.annual_spend)} />
                <UnitRow label="Swipe (interchange) revenue" value={fmtUSD(data.unit.swipe_revenue)} />
                <UnitRow label="Deposit earnings" value={fmtUSD(data.unit.deposit_earnings)} />
                <UnitRow label="Fraud loss (issuer share)" value={`-${fmtUSD(data.unit.fraud_loss)}`} />
                <UnitRow label="Servicing cost" value={`-${fmtUSD(data.unit.servicing)}`} />
                <UnitRow label="Annual margin" value={fmtUSD(data.unit.annual_margin)} strong tone={data.unit.annual_margin} />
                <UnitRow label="Lifetime value (margin / churn)" value={fmtUSD(data.unit.ltv)} />
                <UnitRow label="Net per account (LTV - acquisition)" value={fmtUSD(data.unit.net_per_account)} strong tone={data.unit.net_per_account} />
                <UnitRow label="Breakeven churn" value={data.unit.breakeven_churn == null ? "Never pays back" : fmtPct(data.unit.breakeven_churn)} />
              </tbody>
            </table>
          </Card>

          <Card>
            <LtvChart result={data} />
          </Card>

          <Card title={`Program in ${data.area.name}, ${data.area.state_abbr}`}>
            <div className="grid grid-cols-2 gap-3">
              <Big label="Accounts" value={fmtInt(data.program.accounts)} sub={`${fmtPct(data.inputs.adoption_rate)} of ${fmtInt(data.area.est_underserved_hh)} underserved households`} tag="modeled" />
              <Big
                label="Issuer net, lifetime"
                value={<span className={data.program.issuer_net_lifetime >= 0 ? "text-emerald-700" : "text-red-700"}>{fmtUSD(data.program.issuer_net_lifetime)}</span>}
                sub="After fixed program cost"
                tag="modeled"
              />
              <Big label="Network volume, year 1" value={fmtUSD(data.program.network_volume_y1)} sub="Spend on Mastercard's network, not Mastercard revenue" tag="modeled" />
              <Big label="Est. network revenue, year 1" value={fmtUSD(data.program.network_revenue_y1_est)} sub={`At ${fmtPct(data.inputs.network_yield, 2)} yield`} tag="placeholder" />
            </div>
          </Card>

          <Card title="If it scales">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {data.scale.map((s, i) => (
                <div key={s.level} className="rounded-lg border border-line p-3">
                  <div className="text-xs text-muted">
                    {i > 0 && "→ "}
                    {s.level}
                  </div>
                  <div className="mt-1 text-base font-semibold tabular-nums text-navy">{fmtInt(s.accounts)}</div>
                  <div className="text-[11px] text-muted">accounts from {fmtInt(s.base)} {s.unit}</div>
                  <div className="mt-1 text-sm font-medium tabular-nums text-navy">{fmtUSD(s.network_volume_y1)}</div>
                  <div className="text-[11px] text-muted">network volume, year 1</div>
                </div>
              ))}
            </div>
            <SourceNote>Same adoption rate at every level. US base: FDIC 2023 unbanked + underbanked households. Global base: unbanked adults.</SourceNote>
          </Card>

          {data.labels.map((l) => (
            <SourceNote key={l}>{l}</SourceNote>
          ))}
        </div>
      )}
    </div>
  );
}

function Slider({ label, tag, value, min, max, step, display, onChange }: { label: string; tag?: DataTag; value: number; min: number; max: number; step: number; display: string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-xs text-muted">
        <span className="flex items-center gap-1.5">
          {label} {tag && <Tag tag={tag} />}
        </span>
        <span className="text-sm font-semibold tabular-nums text-navy">{display}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="mt-1 w-full accent-navy" />
    </label>
  );
}

function NumberField({ label, tag, prefix, suffix, value, step, onChange }: { label: string; tag?: DataTag; prefix?: string; suffix?: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-xs text-muted">
        {label} {tag && <Tag tag={tag} />}
      </span>
      <span className="mt-1 flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1.5 focus-within:outline-2 focus-within:outline-accent">
        {prefix && <span className="text-sm text-muted">{prefix}</span>}
        <input
          type="number"
          min={0}
          step={step}
          value={value}
          onChange={(e) => {
            const v = +e.target.value;
            if (Number.isFinite(v) && v >= 0) onChange(v);
          }}
          className="w-full bg-transparent text-sm tabular-nums text-navy outline-none"
        />
        {suffix && <span className="text-sm text-muted">{suffix}</span>}
      </span>
    </label>
  );
}

function Chip({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-navy hover:bg-paper disabled:cursor-not-allowed disabled:opacity-40">
      {children}
    </button>
  );
}

function UnitRow({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: number }) {
  const color = tone == null ? "text-navy" : tone >= 0 ? "text-emerald-700" : "text-red-700";
  return (
    <tr className={strong ? "border-t border-line" : ""}>
      <td className={`py-1 ${strong ? "font-semibold text-navy" : "text-muted"}`}>{label}</td>
      <td className={`py-1 text-right ${strong ? "font-semibold" : ""} ${color}`}>{value}</td>
    </tr>
  );
}

function Big({ label, value, sub, tag }: { label: string; value: ReactNode; sub: string; tag: DataTag }) {
  return (
    <div className="rounded-lg bg-paper p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        {label} <Tag tag={tag} />
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted">{sub}</div>
    </div>
  );
}
