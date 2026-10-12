from typing import Optional

from fastapi import APIRouter, Query

from app.models import Level, Recommendation, Topic
from app.services.recommend import recommendations

router = APIRouter(prefix="/api", tags=["recommendations"])


@router.get("/recommendations", response_model=list[Recommendation])
def get_recommendations(level: Level = "county", state: Optional[str] = None, topic: Optional[Topic] = None,
                        limit: int = Query(10, ge=1, le=100)):
    return recommendations(level, state or None, topic, limit)
