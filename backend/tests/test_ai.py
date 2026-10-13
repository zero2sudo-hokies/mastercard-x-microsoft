"""AI tests with no network: the Navigator API is served in-process and Foundry is mocked."""
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.ai import agent, guardrails, plans, tools
from app.config import settings
from app.main import app
from app.services.recommend import recommendations
from app.store import store

client = TestClient(app)


@pytest.fixture(autouse=True)
def in_process_api(monkeypatch):
    """Tools call the real routes through TestClient instead of a live server."""
    def fake_request(method, path, body=None):
        r = client.request(method, path, json=body)
        return r.json() if r.status_code < 400 else {"error": r.json()["detail"], "status": r.status_code}
    monkeypatch.setattr(tools, "_request", fake_request)


def ok_county():
    return recommendations("county", limit=1)[0].model_dump()


def low_data_county():
    return next(f for f, fr in store.frustration.items() if len(f) == 5 and fr.status != "ok" and f in store.areas)


def ai_off(monkeypatch):
    monkeypatch.setattr(type(settings), "ai_configured", property(lambda self: False))


def fake_message(content=None, tool_calls=None):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content, tool_calls=tool_calls))])


def test_rules_fallback_answers_with_recommendations(monkeypatch):
    ai_off(monkeypatch)
    r = client.post("/api/chat", json={"messages": [{"role": "user", "content": "where should we pilot a no-fee account?"}]}).json()
    assert r["mode"] == "rules"
    assert r["recommendations"] and r["recommendations"][0]["benefit_id"] == "no_fee_account"
    assert r["focus_fips"] and r["focus_fips"][0] == r["recommendations"][0]["fips"]


def test_tool_loop_then_answer(monkeypatch):
    monkeypatch.setattr(type(settings), "ai_configured", property(lambda self: True))
    top = ok_county()
    call = SimpleNamespace(id="c1", function=SimpleNamespace(name="get_recommendations", arguments='{"limit": 3}'))
    replies = iter([fake_message(tool_calls=[call]),
                    fake_message(f"- **{top['name']}, {top['state_abbr']}**: exclusion index {top['exclusion_index']}.")])
    monkeypatch.setattr(agent, "chat", lambda *a, **k: next(replies))
    r = client.post("/api/chat", json={"messages": [{"role": "user", "content": "where to pilot?"}]}).json()
    assert r["mode"] == "foundry"
    assert r["tool_calls"] == [{"name": "get_recommendations", "args": {"limit": 3}}]
    assert r["focus_fips"] == [top["fips"]] and r["warnings"] == []


def test_foundry_error_falls_back_to_rules(monkeypatch):
    monkeypatch.setattr(type(settings), "ai_configured", property(lambda self: True))
    monkeypatch.setattr(agent, "chat", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")))
    r = client.post("/api/chat", json={"messages": [{"role": "user", "content": "where to pilot?"}]}).json()
    assert r["mode"] == "rules" and "AI unavailable" in r["warnings"][-1]


def test_guardrails():
    assert guardrails.banned_terms("Target by Ethnicity") == ["Mentions a protected attribute: ethnic"]
    assert guardrails.banned_terms("embrace the trace") == []
    facts = {"households": 138433, "poverty_rate": 0.2483}
    assert guardrails.unmatched_numbers("138,433 households, 24.8% poverty, in 2026", facts) == []
    assert guardrails.unmatched_numbers("about 999,999 people", facts) == ["Number 999,999 does not match any provided fact."]
    assert guardrails.revenue_wording("network volume of $27.7M is new revenue for us")
    assert guardrails.revenue_wording("Network volume year 1 $112.7M (modeled) with network revenue $349,362 (placeholder).") == []
    assert guardrails.revenue_wording("Network volume is spend on the network, not Mastercard revenue.") == []


def test_plan_template_mode_and_approval(monkeypatch):
    ai_off(monkeypatch)
    fips = ok_county()["fips"]
    plan = client.post("/api/plan", json={"fips": fips, "partner_name": "Test CU"}).json()
    assert plan["mode"] == "rules" and plan["status"] == "draft"
    assert plan["markdown"].count("\n## ") >= 10 and "AI unavailable" in plan["warnings"][0]
    assert not [w for w in plan["warnings"] if w.startswith("Number")], plan["warnings"]

    body = {"reviewer": "Aadu", "markdown": plan["markdown"],
            "checklist": {"compliance_review": True, "community_partner": True, "no_protected_attributes": False}}
    r = client.post(f"/api/plan/{plan['id']}/approve", json=body)
    assert r.status_code == 400 and r.json()["detail"] == "Complete the safe-outreach checklist before approving"
    body["checklist"]["no_protected_attributes"] = True
    assert client.post(f"/api/plan/{plan['id']}/approve", json={**body, "reviewer": " "}).status_code == 400
    ok = client.post(f"/api/plan/{plan['id']}/approve", json=body).json()
    assert ok["status"] == "approved" and ok["approved_by"] == "Aadu"


def test_plan_errors(monkeypatch):
    ai_off(monkeypatch)
    assert client.post("/api/plan", json={"fips": "99999"}).status_code == 404
    r = client.post("/api/plan", json={"fips": low_data_county()})
    assert r.status_code == 400 and r.json()["detail"] == "Not enough complaint data to plan a pilot here"
    body = {"reviewer": "A", "markdown": "x", "checklist": {"compliance_review": True, "community_partner": True, "no_protected_attributes": True}}
    assert client.post("/api/plan/p_nope/approve", json=body).status_code == 404
    plans.PLANS.clear()


def test_plan_uses_roi_panel_inputs_and_fdic_context(monkeypatch):
    ai_off(monkeypatch)
    fips = next((f for f, fr in store.frustration.items() if len(f) == 5 and fr.status == "ok" and f.startswith("36")), None)
    if not fips or not store.state_audience:
        pytest.skip("needs NY frustration data and data/p3 roi-inputs")
    roi = {"fips": fips, "issuer_type": "community", "adoption_rate": 0.05, "churn": 0.16, "cac": 300,
           "fixed_program_cost": 50000, "network_yield": None, "audience_basis": "interested_unbanked"}
    plan = client.post("/api/plan", json={"fips": fips, "roi": roi, "partner_name": "Test CU"}).json()
    f = plan["facts_used"]
    assert f["yearly_churn"] == 0.16 and f["acquisition_cost_per_account"] == 300 and f["adoption_rate_placeholder"] == 0.05
    assert f["pilot_audience_basis"] == "interested_unbanked" and f["state_fdic_unbanked_households"] > 0
    assert "Audience:" in plan["markdown"] and "State FDIC survey" in plan["markdown"]
    assert not [w for w in plan["warnings"] if w.startswith("Number")], plan["warnings"]
