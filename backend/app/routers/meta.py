from fastapi import APIRouter

from app.config import settings
from app.models import Benefit, DataSource, Health
from app.services.benefits import BENEFITS
from app.store import store

router = APIRouter(prefix="/api", tags=["meta"])


@router.get("/health", response_model=Health)
def health():
    return Health(data_source=DataSource(areas=store.areas_source, frustration=store.frustration_source),
                  ai_configured=settings.ai_configured)


@router.get("/benefits", response_model=list[Benefit])
def benefits():
    return BENEFITS


@router.get("/assumptions")
def assumptions():
    return store.benchmarks
