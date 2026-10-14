from fastapi import APIRouter, HTTPException, Query

from app.models import BankCompare, BankCompareRequest, BankLeaderboard, BranchPins
from app.routers.areas import known
from app.services import banks
from app.services.roi import area_audience
from app.store import store

router = APIRouter(prefix="/api", tags=["banks"])


@router.get("/areas/{fips}/banks", response_model=BankLeaderboard)
def get_banks(fips: str, n: int = Query(10, ge=1, le=10)):
    return banks.leaderboard(known(fips), n)


@router.get("/areas/{fips}/branches", response_model=BranchPins)
def get_branches(fips: str):
    if len(known(fips)) != 5:
        raise HTTPException(400, "Branch pins are available for counties only")
    return banks.branch_pins(fips)


@router.post("/banks/compare", response_model=BankCompare)
def compare_banks(req: BankCompareRequest):
    area = store.areas[known(req.fips)]
    bases = area_audience(area)
    if req.audience_basis not in bases:
        raise HTTPException(400, f"No FDIC audience data for {req.audience_basis.replace('_', ' ')} in {area.state_abbr}")
    return banks.compare(req, bases[req.audience_basis], store.state_households(area.state_fips))
