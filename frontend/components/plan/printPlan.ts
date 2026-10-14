import type { PilotPlan } from "@/lib/types";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const STYLE = `
  @page { size: letter; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Inter, "Segoe UI", Arial, sans-serif; color: #0b1f3a; font-size: 11pt; line-height: 1.45; margin: 0; }
  header { border-bottom: 2px solid #f79e1b; padding-bottom: 8pt; margin-bottom: 12pt; }
  .brand { font-size: 9pt; letter-spacing: .08em; text-transform: uppercase; color: #5b6577; }
  h1 { font-size: 18pt; margin: 4pt 0 2pt; }
  .pitch { font-size: 11pt; margin: 0 0 4pt; }
  .meta { font-size: 9pt; color: #5b6577; }
  .badge { display: inline-block; padding: 2pt 6pt; border-radius: 4pt; font-size: 9pt; font-weight: 600; margin-top: 6pt; }
  .draft { background: #fef9c3; color: #713f12; }
  .approved { background: #d1fae5; color: #065f46; }
  .warn { border: 1px solid #fcd34d; background: #fffbeb; padding: 6pt 8pt; border-radius: 4pt; font-size: 9pt; margin-bottom: 10pt; }
  .warn ul { margin: 2pt 0 0 14pt; padding: 0; }
  main h1, main h2 { font-size: 13pt; margin: 14pt 0 4pt; break-after: avoid; }
  main h3 { font-size: 11pt; margin: 10pt 0 3pt; }
  main p, main li { orphans: 3; widows: 3; }
  main ul, main ol { padding-left: 16pt; margin: 4pt 0; }
  main li + li { margin-top: 2pt; }
  main em { color: #5b6577; }
  footer { margin-top: 16pt; border-top: 1px solid #e4e2dc; padding-top: 6pt; font-size: 8pt; color: #5b6577; }
`;

/** Opens the browser print dialog (choose "Save as PDF") with the plan laid out as a document. */
export function printPlan(plan: PilotPlan, html: string, bankName?: string) {
  const approved = plan.status === "approved";
  const status = approved
    ? `<span class="badge approved">Approved by ${esc(plan.approved_by ?? "")} on ${esc(new Date(plan.approved_at ?? "").toLocaleString())}</span>`
    : `<span class="badge draft">AI-generated draft. Review before use.</span>`;
  const warnings = plan.warnings.length
    ? `<div class="warn"><strong>Guardrail checks flagged ${plan.warnings.length} item${plan.warnings.length > 1 ? "s" : ""}:</strong><ul>${plan.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></div>`
    : "";
  const doc = `<!doctype html><html><head><meta charset="utf-8"><title>Pilot plan - ${esc(plan.area_name)}</title><style>${STYLE}</style></head><body>
    <header>
      <div class="brand">Monopoly · Pilot program plan</div>
      <h1>${esc(plan.area_name)}</h1>
      ${bankName ? `<p class="pitch">Pitch for <strong>${esc(bankName)}</strong></p>` : ""}
      <div class="meta">Generated ${esc(new Date(plan.generated_at).toLocaleString())} · ${plan.mode === "foundry" ? `Azure AI Foundry (${esc(plan.model)})` : "Template"} · Plan ${esc(plan.id)}</div>
      ${status}
    </header>
    ${warnings}
    <main>${html}</main>
    <footer>Prototype for LEAD ASPIRE 2026. Modeled and placeholder figures must be validated in the pilot; not financial advice. No protected attributes are used.</footer>
  </body></html>`;

  // a hidden iframe instead of a popup, so pop-up blockers do not interfere
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const w = frame.contentWindow!;
  w.document.open();
  w.document.write(doc);
  w.document.close();
  const cleanup = () => setTimeout(() => frame.remove(), 1000);
  w.onafterprint = cleanup;
  setTimeout(() => {
    w.focus();
    w.print();
    cleanup();
  }, 250);
}
