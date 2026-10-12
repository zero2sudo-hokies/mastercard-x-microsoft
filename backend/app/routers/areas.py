from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.models import AreaProfile, AreaSummary, Level, Lookalike
from app.services.lookalikes import lookalikes
from app.services.merge import profile, summaries
from app.store import store

router = APIRouter(prefix="/api/areas", tags=["areas"])


def known(fips: str) -> str:
    if fips not in store.areas:
        raise HTTPException(404, f"Unknown fips {fips}")
    return fips


@router.get("", response_model=list[AreaSummary])
def list_areas(level: Level, state: Optional[str] = None):
    return summaries(level, state or None)


@router.get("/{fips}", response_model=AreaProfile)
def get_area(fips: str):
    return profile(known(fips))


@router.get("/{fips}/lookalikes", response_model=list[Lookalike])
def get_lookalikes(fips: str, n: int = Query(5, ge=1, le=50)):
    return lookalikes(known(fips), n)
