from fastapi import APIRouter

from app.ai import plans
from app.models import ApproveRequest, PilotPlan, PlanRequest

router = APIRouter(prefix="/api/plan", tags=["ai"])


@router.post("", response_model=PilotPlan)
def post_plan(req: PlanRequest):
    return plans.generate_plan(req)


@router.post("/{plan_id}/approve", response_model=PilotPlan)
def post_approve(plan_id: str, req: ApproveRequest):
    return plans.approve(plan_id, req)
