from fastapi import APIRouter

from app.models import RoiRequest, RoiResult
from app.routers.areas import known
from app.services.roi import compute_roi
from app.store import store

router = APIRouter(prefix="/api", tags=["roi"])


@router.post("/roi", response_model=RoiResult)
def post_roi(req: RoiRequest):
    area = store.areas[known(req.fips)]
    return compute_roi(area, store.state_households(area.state_fips), store.benchmarks, req)
