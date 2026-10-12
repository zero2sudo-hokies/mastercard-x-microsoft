// Shared UI. P5 reuses these; tell P5 before changing any props.
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { TOPIC_ICON } from "@/lib/topics";
import type { FrustrationStatus, TopicId } from "@/lib/types";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Card({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-xl border border-line bg-white p-4 shadow-sm", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h3 className="text-sm font-semibold text-navy">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export type DataTag = "modeled" | "placeholder" | "sourced" | "state-level";

const TAG_STYLE: Record<DataTag, string> = {
  modeled: "bg-sky-50 text-sky-800 border-sky-200",
  placeholder: "bg-amber-50 text-amber-800 border-amber-200",
  sourced: "bg-emerald-50 text-emerald-800 border-emerald-200",
  "state-level": "bg-slate-50 text-slate-700 border-slate-200",
};

export function Tag({ tag }: { tag: DataTag }) {
  return <span className={cx("rounded border px-1.5 py-px text-[10px] font-medium uppercase tracking-wide", TAG_STYLE[tag])}>{tag}</span>;
}

export function Stat({ label, value, sublabel, tag }: { label: string; value: ReactNode; sublabel?: ReactNode; tag?: DataTag }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <span className="truncate">{label}</span>
        {tag && <Tag tag={tag} />}
      </div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums text-navy">{value}</div>
      {sublabel && <div className="text-xs text-muted">{sublabel}</div>}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" };

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  const styles = {
    primary: "bg-navy text-white hover:bg-navy-soft",
    secondary: "border border-line bg-white text-navy hover:bg-paper",
    ghost: "text-navy hover:bg-paper",
  }[variant];
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50",
        styles,
        className,
      )}
      {...props}
    />
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "good" | "warn" | "bad" }) {
  const styles = {
    neutral: "bg-slate-100 text-slate-700",
    accent: "bg-accent/15 text-navy",
    good: "bg-emerald-100 text-emerald-800",
    warn: "bg-amber-100 text-amber-800",
    bad: "bg-red-100 text-red-800",
  }[tone];
  return <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", styles)}>{children}</span>;
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div role="tablist" className="flex gap-1 rounded-lg bg-paper p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === t.id ? "bg-white text-navy shadow-sm" : "text-muted hover:text-navy",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-navy" aria-hidden />
      {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 font-medium underline underline-offset-2">
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line p-6 text-center">
      <p className="text-sm font-medium text-navy">{title}</p>
      {children && <div className="mt-1 text-xs text-muted">{children}</div>}
    </div>
  );
}

export function SourceNote({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-[11px] leading-snug text-muted">{children}</p>;
}

export function DataStatusBadge({ status }: { status: FrustrationStatus }) {
  if (status === "ok") return <Badge tone="good">Enough data</Badge>;
  if (status === "low_data") return <Badge tone="warn">Low data</Badge>;
  return <Badge>No data</Badge>;
}

export function TopicIcon({ topic, size = 16, className }: { topic: TopicId; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={TOPIC_ICON[topic]} />
    </svg>
  );
}
