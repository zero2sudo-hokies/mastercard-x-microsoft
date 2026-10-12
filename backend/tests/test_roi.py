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
    assert r.unit.annual_spend == 14830
    assert r.unit.annual_margin == 69
    assert r.unit.ltv == 172
    assert r.unit.breakeven_churn == 0.161
    assert r.program.accounts == 2910
    assert r.program.issuer_net_lifetime == -819279
    assert r.program.network_volume_y1 == 43154136
    assert r.program.network_revenue_y1_est == 125147


def test_large_bank_loses_money_and_has_no_breakeven():
    r = roi(issuer_type="large_bank")
    assert r.unit.annual_margin == -272
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
