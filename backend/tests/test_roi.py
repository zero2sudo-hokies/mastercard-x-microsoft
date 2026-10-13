import pytest

from app.models import RoiArea, RoiRequest
from app.services.roi import compute_roi
from app.store import store

HIDALGO = RoiArea(fips="48215", name="Hidalgo County", state_abbr="TX", est_underserved_hh=97000)


def roi(**kw):
    return compute_roi(HIDALGO, 3_400_000, store.benchmarks, RoiRequest(fips="48215", **kw))


def test_worked_example_community():
    r = roi(issuer_type="community")
    assert r.inputs.churn == 0.40 and r.inputs.cac == 428
    # sourced benchmarks (see benchmarks.json "sources"): 30.7 tx/month, $46.89 ticket, $900 balance
    assert r.unit.annual_spend == 17274
    assert r.unit.annual_margin == 38
    assert r.unit.ltv == 95
    assert r.unit.breakeven_churn == 0.088
    assert r.program.accounts == 2910
    assert r.program.issuer_net_lifetime == -1045165
    assert r.program.network_volume_y1 == 50268143
    assert r.program.network_revenue_y1_est == 155831


def test_large_bank_loses_money_and_has_no_breakeven():
    r = roi(issuer_type="large_bank")
    assert r.unit.annual_margin == -294
    assert r.unit.breakeven_churn is None


def test_overrides_and_curve():
    r = roi(churn=0.2, cac=100, adoption_rate=0.1, fixed_program_cost=0, network_yield=0.01)
    assert r.inputs.churn == 0.2 and r.program.accounts == 9700
    assert [p.churn for p in r.ltv_curve][:2] == [0.10, 0.11] and r.ltv_curve[-1].churn == 0.45
    assert len(r.ltv_curve) == 36
    assert [s.level for s in r.scale] == ["County", "State", "United States", "Global"]
    assert r.scale[1].accounts == 340000


@pytest.mark.parametrize("bad", [{"adoption_rate": 0}, {"adoption_rate": 1.5}, {"churn": 0}, {"cac": -1}, {"issuer_type": "fintech"}])
def test_request_validation(bad):
    with pytest.raises(ValueError):
        RoiRequest(fips="48215", **bad)


def test_audience_bases_from_p3_fdic_inputs():
    from fastapi.testclient import TestClient
    from app.main import app
    c = TestClient(app)
    if not store.state_audience:
        pytest.skip("data/p3/roi-inputs.json not present")
    fips = next(a.fips for a in store.by_level["county"] if a.state_abbr == "NY")
    ctx = c.get(f"/api/roi/context/{fips}").json()
    assert ctx["state"]["state_abbr"] == "NY" and ctx["state"]["small_sample"] is True
    under, unb, inter = (ctx["area_audience"][k] for k in ("underserved", "unbanked", "interested_unbanked"))
    assert under > unb > inter > 0  # interest applies to unbanked only, never underbanked
    r = c.post("/api/roi", json={"fips": fips, "audience_basis": "interested_unbanked", "adoption_rate": 0.1}).json()
    assert r["audience"]["area_households"] == inter and r["program"]["accounts"] == round(inter * 0.1)
    assert [s["level"] for s in r["scale"]] == ["County", "State", "United States"]  # no global "interested" base
    assert r["scale"][1]["base"] == ctx["state"]["interested_unbanked_households"]
    default = c.post("/api/roi", json={"fips": fips}).json()
    assert default["inputs"]["audience_basis"] == "underserved" and default["audience"]["area_households"] == under
