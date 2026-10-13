"""Pilot plan generation and human approval. Plans live in memory."""
import json
import logging
import secrets
import time
from datetime import datetime, timezone

from fastapi import HTTPException

from app.ai import guardrails, template, tools
from app.ai.client import chat
from app.ai.facts import build_facts
from app.ai.prompts import PLAN_FOOTER, PLAN_SYSTEM
from app.config import settings
from app.models import ApproveRequest, PilotPlan, PlanRequest

log = logging.getLogger("navigator.ai")
PLANS: dict[str, PilotPlan] = {}


def _now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _get(method, path, body=None):
    r = tools._request(method, path, body)
    if isinstance(r, dict) and "error" in r:
        raise HTTPException(r.get("status", 502), r["error"])
    return r


def generate_plan(req: PlanRequest) -> PilotPlan:
    start = time.perf_counter()
    profile = _get("GET", f"/api/areas/{req.fips}")
    if (profile.get("frustration") or {}).get("status") != "ok":
        raise HTTPException(400, "Not enough complaint data to plan a pilot here")
    roi_body = req.roi.model_dump() if req.roi else {}
    roi_body["fips"] = req.fips
    roi = _get("POST", "/api/roi", roi_body)
    bench = _get("GET", "/api/assumptions")
    roi["benchmarks"] = {k: bench.get(k) for k in ("transactions_per_month", "avg_ticket")}
    ctx = tools._request("GET", f"/api/roi/context/{req.fips}")  # optional sourced audience (data/p3 FDIC inputs)
    roi["context"] = ctx if isinstance(ctx, dict) and "error" not in ctx else {}
    facts = build_facts(profile, roi, req.partner_name, req.notes)

    warnings, mode = [], "rules"
    markdown = None
    if settings.ai_configured:
        try:
            msg = chat([{"role": "system", "content": PLAN_SYSTEM},
                        {"role": "user", "content": "FACTS:\n" + json.dumps(facts, indent=1)}], max_completion_tokens=8000).choices[0].message
            if msg.content and msg.content.strip():
                markdown, mode = msg.content.strip() + PLAN_FOOTER, "foundry"
        except Exception as e:
            log.warning("plan foundry failed (%s), using template", type(e).__name__)
    if markdown is None:
        markdown = template.render(facts)
        warnings.append("AI unavailable, template draft shown.")
    warnings += guardrails.check(markdown, facts=facts, limit=900, kind="Plan")

    plan = PilotPlan(id=f"p_{secrets.token_hex(3)}", fips=req.fips, area_name=facts["area_name"], status="draft",
                     markdown=markdown, model=settings.azure_openai_deployment, mode=mode, generated_at=_now(),
                     warnings=warnings, facts_used=facts)
    PLANS[plan.id] = plan
    log.info("plan %s mode=%s %.0fms warnings=%d", plan.id, mode, (time.perf_counter() - start) * 1000, len(warnings))
    return plan


def approve(plan_id: str, req: ApproveRequest) -> PilotPlan:
    plan = PLANS.get(plan_id)
    if not plan:
        raise HTTPException(404, f"Unknown plan {plan_id}")
    if len(req.markdown) > 20000:
        raise HTTPException(400, "Plan text is too long")
    if not req.reviewer.strip():
        raise HTTPException(400, "Reviewer name is required")
    c = req.checklist
    if not (c.compliance_review and c.community_partner and c.no_protected_attributes):
        raise HTTPException(400, "Complete the safe-outreach checklist before approving")
    approved = plan.model_copy(update={
        "status": "approved", "markdown": req.markdown, "approved_by": req.reviewer.strip(), "approved_at": _now(),
        "warnings": guardrails.banned_terms(req.markdown),
    })
    PLANS[plan_id] = approved
    return approved
