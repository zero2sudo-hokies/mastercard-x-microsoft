"""One plain call and one tool call against Foundry. Run from backend/: python -m app.ai.smoke"""
import json
import time

from app.ai.client import chat
from app.config import settings

TOOL = [{"type": "function", "function": {
    "name": "get_area_profile", "description": "Get facts for one US county by 5-digit FIPS.",
    "parameters": {"type": "object", "properties": {"fips": {"type": "string"}}, "required": ["fips"]}}}]

if __name__ == "__main__":
    print("ai_configured:", settings.ai_configured)
    t = time.perf_counter()
    r = chat([{"role": "user", "content": "Reply with the single word: ready"}], max_completion_tokens=200)
    print("plain:", repr(r.choices[0].message.content), r.usage.total_tokens, "tokens", f"{time.perf_counter() - t:.1f}s")
    t = time.perf_counter()
    r = chat([{"role": "user", "content": "Look up county 48215."}], tools=TOOL, max_completion_tokens=600)
    calls = r.choices[0].message.tool_calls or []
    print("tool:", [(c.function.name, json.loads(c.function.arguments)) for c in calls], f"{time.perf_counter() - t:.1f}s")
