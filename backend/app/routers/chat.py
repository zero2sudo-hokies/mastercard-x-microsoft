from fastapi import APIRouter, HTTPException

from app.ai.agent import answer
from app.models import ChatRequest, ChatResponse

router = APIRouter(prefix="/api/chat", tags=["ai"])


@router.post("", response_model=ChatResponse)
def post_chat(req: ChatRequest):
    if not req.messages or req.messages[-1].role != "user" or not req.messages[-1].content.strip():
        raise HTTPException(400, "Send a question as the last user message")
    return answer(req)
