"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import RoiPanel from "@/components/roi/RoiPanel";
import { Badge, Button, Card, DataStatusBadge, EmptyState, ErrorBox, Spinner, TopicIcon } from "@/components/ui";
import { approvePlan, getProfile, postPlan } from "@/lib/api";
import { TOPIC_LABEL } from "@/lib/topics";
import type { AreaProfile, PilotPlan, RoiRequest } from "@/lib/types";

const CHECKLIST = [
  { key: "compliance_review", label: "Issuer compliance team has reviewed targeting and marketing" },
  { key: "community_partner", label: "Outreach runs through named community partner organizations" },
  { key: "no_protected_attributes", label: "No immigration, citizenship, language, race or other protected attributes used in targeting or messaging" },
] as const;
type CheckKey = (typeof CHECKLIST)[number]["key"];

export default function PlanPage() {
  const fips = useSearchParams().get("fips");
  const [profile, setProfile] = useState<{ fips: string; data?: AreaProfile; error?: string } | null>(null);
  const roiReq = useRef<RoiRequest | null>(null);

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
          Pick a county on the <Link href="/" className="underline">dashboard</Link>, then use Build pilot plan.
        </EmptyState>
      </div>
    );
  }

  const p = profile?.fips === fips ? profile.data : undefined;
  const err = profile?.fips === fips ? profile.error : undefined;
  const fr = p?.frustration;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/?fips=${fips}&state=${fips.slice(0, 2)}`} className="text-xs text-muted hover:text-navy hover:underline">
            ← Back to dashboard
          </Link>
          {err ? (
            <ErrorBox message={err} />
          ) : !p ? (
            <Spinner label="Loading area" />
          ) : (
            <>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-navy">
                  Pilot plan: {p.area.name}
                  {p.area.level === "county" ? `, ${p.area.state_abbr}` : ""}
                </h1>
                <DataStatusBadge status={fr?.status ?? "no_data"} />
              </div>
              {fr?.top_topic && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-navy">
                  <TopicIcon topic={fr.top_topic} className="text-accent" />
                  Top frustration: {TOPIC_LABEL[fr.top_topic]}
                  {p.benefit && <span className="text-muted">→ {p.benefit.title}</span>}
                </p>
              )}
            </>
          )}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <section aria-label="Economics">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">1. Economics</h2>
          <RoiPanel fips={fips} onChange={(req) => (roiReq.current = req)} />
        </section>
        <section aria-label="Pilot plan">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">2. Pilot plan</h2>
          {p && fr?.status !== "ok" ? (
            <EmptyState title="Not enough complaint data to plan a pilot here">
              A plan needs at least 30 CFPB complaints to ground the frustration and benefit. Try a look-alike area.
            </EmptyState>
          ) : (
            <PlanDraft fips={fips} getRoi={() => roiReq.current} />
          )}
        </section>
      </div>
    </div>
  );
}

function PlanDraft({ fips, getRoi }: { fips: string; getRoi: () => RoiRequest | null }) {
  const [partner, setPartner] = useState("Community credit union (TBD)");
  const [notes, setNotes] = useState("");
  const [plan, setPlan] = useState<PilotPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [checks, setChecks] = useState<Record<CheckKey, boolean>>({ compliance_review: false, community_partner: false, no_protected_attributes: false });
  const [reviewer, setReviewer] = useState("");
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const p = await postPlan({ fips, roi: getRoi(), partner_name: partner.trim() || "Community credit union (TBD)", notes });
      setPlan(p);
      setText(p.markdown);
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!plan) return;
    setApproving(true);
    setApproveError(null);
    try {
      const p = await approvePlan(plan.id, { reviewer, markdown: text, checklist: checks });
      setPlan(p);
      setEditing(false);
    } catch (e) {
      setApproveError((e as Error).message);
    } finally {
      setApproving(false);
    }
  }

  const approved = plan?.status === "approved";
  const ready = Object.values(checks).every(Boolean) && reviewer.trim().length > 0;

  return (
    <div className="space-y-4">
      {!approved && (
        <Card>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-muted">
              Issuer partner
              <input value={partner} maxLength={120} onChange={(e) => setPartner(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm text-navy" />
            </label>
            <label className="block text-xs text-muted sm:row-span-2">
              Notes for the draft (optional)
              <textarea value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm text-navy" />
            </label>
            <Button onClick={generate} disabled={busy} className="self-end">
              {plan ? "Regenerate with Azure AI" : "Generate pilot plan with Azure AI"}
            </Button>
          </div>
          {busy && (
            <div className="mt-3">
              <Spinner label="Drafting the pilot plan from Navigator data... (20-40 s)" />
            </div>
          )}
          {error && (
            <div className="mt-3">
              <ErrorBox message={error} onRetry={generate} />
            </div>
          )}
        </Card>
      )}

      {plan && (
        <>
          {approved ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">
              ✓ Approved by <strong>{plan.approved_by}</strong> at {new Date(plan.approved_at ?? "").toLocaleString()}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
              <strong>AI-generated draft. Review before use.</strong>
              <Badge tone={plan.mode === "foundry" ? "accent" : "neutral"}>{plan.mode === "foundry" ? `Azure AI Foundry · ${plan.model}` : "Template fallback"}</Badge>
            </div>
          )}

          {plan.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="mb-1 font-semibold">Guardrail checks flagged {plan.warnings.length} item{plan.warnings.length > 1 ? "s" : ""} for the reviewer:</p>
              <ul className="list-disc pl-4">
                {plan.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <Card
            title={plan.area_name}
            action={
              approved ? (
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => navigator.clipboard?.writeText(text)}>
                    Copy
                  </Button>
                  <Button variant="secondary" onClick={() => download(`pilot-plan-${plan.fips}.md`, text)}>
                    Download .md
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" onClick={() => setEditing((e) => !e)}>
                  {editing ? "Preview" : "Edit"}
                </Button>
              )
            }
          >
            {editing && !approved ? (
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={28} className="w-full rounded-lg border border-line p-2 font-mono text-xs text-navy" aria-label="Edit plan markdown" />
            ) : (
              <div className="md text-sm text-navy">
                <ReactMarkdown>{text}</ReactMarkdown>
              </div>
            )}
          </Card>

          <details className="rounded-lg border border-line bg-white p-3 text-xs">
            <summary className="cursor-pointer font-medium text-navy">Facts the AI was allowed to use ({Object.keys(plan.facts_used).length})</summary>
            <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-3 gap-y-1">
              {Object.entries(plan.facts_used).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="truncate text-muted">{k.replaceAll("_", " ")}</dt>
                  <dd className="break-words text-navy">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
                </div>
              ))}
            </dl>
          </details>

          {!approved && (
            <Card title="Approve">
              <fieldset className="space-y-2">
                <legend className="mb-1 text-xs text-muted">Safe-outreach checklist (all required)</legend>
                {CHECKLIST.map((c) => (
                  <label key={c.key} className="flex items-start gap-2 text-sm text-navy">
                    <input type="checkbox" checked={checks[c.key]} onChange={(e) => setChecks({ ...checks, [c.key]: e.target.checked })} className="mt-1 accent-navy" />
                    {c.label}
                  </label>
                ))}
              </fieldset>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="block text-xs text-muted">
                  Reviewer name
                  <input value={reviewer} maxLength={80} onChange={(e) => setReviewer(e.target.value)} className="mt-1 w-56 rounded-lg border border-line px-2 py-1.5 text-sm text-navy" />
                </label>
                <Button onClick={approve} disabled={!ready || approving}>
                  {approving ? "Approving..." : "Approve pilot plan"}
                </Button>
              </div>
              {approveError && (
                <div className="mt-2">
                  <ErrorBox message={approveError} />
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}
