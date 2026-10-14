from fastapi import APIRouter, HTTPException

from app.models import BankBenchmark, RoiContext, RoiRequest, RoiResult, StateAudience
from app.routers.areas import known
from app.services.roi import area_audience, compute_roi
from app.store import store

router = APIRouter(prefix="/api", tags=["roi"])


def _bases(area):
    return area_audience(area)


@router.post("/roi", response_model=RoiResult)
def post_roi(req: RoiRequest):
    area = store.areas[known(req.fips)]
    bases = _bases(area)
    if req.audience_basis not in bases:
        raise HTTPException(400, f"No FDIC audience data for {req.audience_basis.replace('_', ' ')} in {area.state_abbr}")
    return compute_roi(area, store.state_households(area.state_fips), store.benchmarks, req, bases[req.audience_basis])


@router.get("/roi/context/{fips}", response_model=RoiContext)
def roi_context(fips: str):
    """Sourced audience (FDIC 2023 survey) and whole-bank reference ratios for the ROI panel. Read-only context:
    the bank ratios are portfolio averages, not per-account economics, so they never feed the ROI math."""
    area = store.areas[known(fips)]
    row = store.state_audience.get(area.state_abbr)
    meta = (store.roi_inputs or {}).get("metadata", {})
    state = None
    if row:
        rnd = lambda k: None if row.get(k) is None else round(row[k])  # noqa: E731
        state = StateAudience(
            state_abbr=row["state"], survey_year=row.get("survey_year", 2023), households=round(row["households"]),
            unbanked_households=round(row["unbanked_households"]), unbanked_rate=row["unbanked_rate"],
            underbanked_households=round(row["underbanked_households"]), underbanked_rate=row["underbanked_rate"],
            interested_share_of_unbanked=row.get("interested_share_of_unbanked"),
            interested_unbanked_households=rnd("interested_unbanked_households"),
            very_interested_households=rnd("very_interested_households"),
            interested_and_once_banked_households=rnd("interested_and_once_banked_households"),
            n_unbanked_surveyed=int(row.get("n_unbanked_surveyed") or 0),
            small_sample=bool(row.get("unbanked_sample_below_100") or row.get("small_sample_flag")),
        )
    banks = [BankBenchmark(**{**b, "banks": int(b["banks"])}) for b in (store.roi_inputs or {}).get("bank_reference_benchmarks", [])]
    labels = [
        "Stated interest in a bank account is not an adoption or card conversion rate.",
        "County unbanked and interested counts are modeled from state FDIC rates.",
        "Bank ratios are whole-bank portfolio averages by asset size, not per-account economics or FDIC community-bank classes.",
    ]
    if state and state.small_sample:
        labels.insert(0, f"Small sample: {state.n_unbanked_surveyed} unbanked respondents in {state.state_abbr}; no confidence interval published.")
    return RoiContext(fips=fips, state=state, area_audience={k: v["area"] for k, v in _bases(area).items()}, banks=banks,
                      bank_quarter=meta.get("bank_financial_quarter"), labels=labels)
