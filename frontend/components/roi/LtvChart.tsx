import { fmtPct, fmtUSD } from "@/lib/format";
import type { RoiResult } from "@/lib/types";

const W = 520;
const H = 220;
const M = { l: 56, r: 16, t: 12, b: 32 };

/** LTV vs churn line, dashed CAC line, dot at breakeven, marker at the current churn. */
export default function LtvChart({ result }: { result: RoiResult }) {
  const curve = result.ltv_curve;
  if (!curve.length) return null;
  const { cac, churn } = result.inputs;
  const breakeven = result.unit.breakeven_churn;
  const x0 = curve[0].churn;
  const x1 = curve[curve.length - 1].churn;
  const ys = [...curve.map((p) => p.ltv), cac, 0];
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys) * 1.05 || 1;
  const x = (c: number) => M.l + ((c - x0) / (x1 - x0)) * (W - M.l - M.r);
  const y = (v: number) => H - M.b - ((v - y0) / (y1 - y0)) * (H - M.t - M.b);
  const line = curve.map((p, i) => `${i ? "L" : "M"}${x(p.churn).toFixed(1)},${y(p.ltv).toFixed(1)}`).join("");
  const curChurn = Math.min(x1, Math.max(x0, churn));
  const curLtv = result.unit.annual_margin / churn;
  const yTicks = [y0, (y0 + y1) / 2, y1].map((v) => Math.round(v));
  const xTicks = [0.1, 0.2, 0.3, 0.4].filter((c) => c >= x0 && c <= x1);

  return (
    <figure>
      <figcaption className="mb-1 text-sm font-semibold text-navy">{headline(result)}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Lifetime value per account by yearly churn">
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="#e4e2dc" />
            <text x={M.l - 6} y={y(v)} dy="0.32em" textAnchor="end" fontSize="10" fill="#5b6577">
              {fmtUSD(v)}
            </text>
          </g>
        ))}
        {xTicks.map((c) => (
          <text key={c} x={x(c)} y={H - M.b + 16} textAnchor="middle" fontSize="10" fill="#5b6577">
            {fmtPct(c, 0)}
          </text>
        ))}
        <text x={(W + M.l) / 2} y={H - 2} textAnchor="middle" fontSize="10" fill="#5b6577">
          Yearly churn
        </text>
        {y0 < 0 && <line x1={M.l} x2={W - M.r} y1={y(0)} y2={y(0)} stroke="#9aa3b2" />}
        <line x1={M.l} x2={W - M.r} y1={y(cac)} y2={y(cac)} stroke="#a8231c" strokeDasharray="5 4" />
        <text x={W - M.r} y={y(cac) - 5} textAnchor="end" fontSize="10" fill="#a8231c">
          Acquisition cost {fmtUSD(cac)}
        </text>
        <path d={line} fill="none" stroke="#0b1f3a" strokeWidth="2.5" />
        {breakeven != null && breakeven >= x0 && breakeven <= x1 && (
          <g>
            <circle cx={x(breakeven)} cy={y(cac)} r="5" fill="#f79e1b" stroke="#fff" strokeWidth="1.5" />
            <text x={x(breakeven) + 8} y={y(cac) + 14} fontSize="10" fill="#0b1f3a">
              Breakeven {fmtPct(breakeven)}
            </text>
          </g>
        )}
        <line x1={x(curChurn)} x2={x(curChurn)} y1={M.t} y2={H - M.b} stroke="#0b1f3a" strokeOpacity="0.35" strokeDasharray="2 3" />
        {churn >= x0 && churn <= x1 && <circle cx={x(churn)} cy={y(curLtv)} r="4" fill="#0b1f3a" />}
        <text x={x(curChurn)} y={M.t + 8} textAnchor={curChurn > (x0 + x1) / 2 ? "end" : "start"} dx={curChurn > (x0 + x1) / 2 ? -4 : 4} fontSize="10" fill="#0b1f3a">
          Now {fmtPct(churn, 0)}
        </text>
      </svg>
    </figure>
  );
}

function headline(r: RoiResult) {
  if (r.unit.annual_margin <= 0) return "Loses money at any churn: each account costs more to serve than it earns";
  if (r.unit.breakeven_churn == null) return "Lifetime value vs yearly churn";
  return `Pays back only below ${fmtPct(r.unit.breakeven_churn, 0)} yearly churn`;
}
