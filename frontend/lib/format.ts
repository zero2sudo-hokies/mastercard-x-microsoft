const dash = "—";

export const fmtInt = (n: number | null | undefined) => (n == null ? dash : Math.round(n).toLocaleString("en-US"));

export function fmtUSD(n: number | null | undefined) {
  if (n == null) return dash;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
}

// rates are decimals 0-1
export const fmtPct = (n: number | null | undefined, digits = 1) => (n == null ? dash : `${(n * 100).toFixed(digits)}%`);

export const fmtScore = (n: number | null | undefined) => (n == null ? dash : n.toFixed(0));
