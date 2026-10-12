"""Chat agent: Foundry tool-calling loop over the Navigator API, with a no-AI rules fallback."""
import json
import logging
import re
import time
import unicodedata
import uuid

from app.ai import guardrails, tools
from app.ai.client import chat
from app.ai.prompts import AGENT_SYSTEM
from app.config import settings
from app.models import ChatRequest, ChatResponse, Recommendation, ToolCall

log = logging.getLogger("navigator.ai")
MAX_ROUNDS = 5
MAX_MESSAGE_CHARS = 2000
MAX_TOOL_RESULT_CHARS = 6000

TOPIC_WORDS = {
    "fees": ("no-fee", "no fee", "overdraft", "fee"), "fraud_scams": ("scam", "fraud"),
    "transfers": ("remittance", "sending money", "transfer"), "account_closed": ("closed", "frozen", "second chance"),
    "customer_service": ("support", "service"), "distrust": ("trust",),
}


def answer(req: ChatRequest) -> ChatResponse:
    rid, start = uuid.uuid4().hex[:8], time.perf_counter()
    if settings.ai_configured:
        try:
            resp = _foundry(req)
        except Exception as e:  # any Foundry failure falls back so the demo keeps working
            log.warning("chat %s foundry failed (%s), using rules", rid, type(e).__name__)
            resp = _rules(req)
            resp.warnings.append("AI unavailable, rules-based answer shown.")
    else:
        resp = _rules(req)
    log.info("chat %s mode=%s tools=%s %.0fms warnings=%d", rid, resp.mode, [t.name for t in resp.tool_calls],
             (time.perf_counter() - start) * 1000, len(resp.warnings))
    return resp


def _context_note(req: ChatRequest) -> str:
    c = req.context
    parts = [f"The map shows the {c.layer} layer."]
    if c.state_fips:
        parts.append(f"The user zoomed into state FIPS {c.state_fips}.")
    if c.selected_fips:
        parts.append(f"The user is looking at area FIPS {c.selected_fips}.")
    return " ".join(parts)


def _foundry(req: ChatRequest) -> ChatResponse:
    messages = [{"role": "system", "content": AGENT_SYSTEM}, {"role": "system", "content": _context_note(req)}]
    messages += [{"role": m.role, "content": m.content[:MAX_MESSAGE_CHARS]} for m in req.messages[-10:]]
    calls, results, reply = [], [], ""
    for round_ in range(MAX_ROUNDS + 1):
        last = round_ == MAX_ROUNDS
        msg = chat(messages, tools=tools.TOOLS, max_completion_tokens=3000, tool_choice="none" if last else "auto", reasoning_effort="low").choices[0].message
        if not msg.tool_calls:
            reply = (msg.content or "").strip()
            break
        messages.append({"role": "assistant", "content": msg.content or "",
                         "tool_calls": [{"id": c.id, "type": "function", "function": {"name": c.function.name, "arguments": c.function.arguments}}
                                        for c in msg.tool_calls]})
        for c in msg.tool_calls:
            try:
                args = json.loads(c.function.arguments or "{}")
            except ValueError:
                args = {}
            result = tools.run(c.function.name, args)
            calls.append(ToolCall(name=c.function.name, args=args))
            results.append((c.function.name, result))
            messages.append({"role": "tool", "tool_call_id": c.id, "content": json.dumps(result)[:MAX_TOOL_RESULT_CHARS]})
    if not reply:
        raise RuntimeError("empty reply")
    return _assemble(reply, calls, results, "foundry")


def _areas_in(results) -> dict[str, str]:
    """fips -> short name for every area that appeared in a tool result."""
    found = {}

    def walk(x):
        if isinstance(x, dict):
            if isinstance(x.get("fips"), str) and isinstance(x.get("name"), str):
                found.setdefault(x["fips"], x["name"])
            for v in x.values():
                walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)

    walk([r for _, r in results])
    return found


def _plain(s: str) -> str:
    """Lowercase without accents, so 'Doña Ana' matches 'Dona Ana' either way."""
    return "".join(c for c in unicodedata.normalize("NFKD", s.lower()) if not unicodedata.combining(c))


def _assemble(reply, calls, results, mode) -> ChatResponse:
    recs = next((r for name, r in reversed(results) if name == "get_recommendations" and isinstance(r, list)), [])
    low = _plain(reply)
    positions = {}
    for fips, name in _areas_in(results).items():
        short = _plain(name.removesuffix(" County").removesuffix(" Parish"))
        hits = [i for i in (low.find(short), low.find(fips)) if i >= 0]
        if hits:
            positions[fips] = min(hits)
    focus = sorted(positions, key=positions.get)[:10]
    return ChatResponse(
        reply=reply, recommendations=[Recommendation(**r) for r in recs], focus_fips=focus, tool_calls=calls, mode=mode,
        warnings=guardrails.check(reply, facts=[r for _, r in results], limit=250, kind="Answer"),
    )


def _rules(req: ChatRequest) -> ChatResponse:
    """No-AI answer: keyword topic + state name -> recommendations, as a templated list."""
    text = (req.messages[-1].content if req.messages else "").lower()[:MAX_MESSAGE_CHARS]
    topic = next((t for t, words in TOPIC_WORDS.items() if any(w in text for w in words)), None)
    state = req.context.state_fips
    try:
        # longest names first so "west virginia" is not read as "virginia"
        for s in sorted(tools._request("GET", "/api/areas?level=state"), key=lambda s: -len(s["name"])):
            if re.search(rf"\b{re.escape(s['name'].lower())}\b", text):
                state = s["fips"]
                break
        calls = [ToolCall(name="get_recommendations", args={"state_fips": state, "topic": topic, "limit": 5})]
        recs = tools.get_recommendations(state_fips=state, topic=topic, limit=5)
        results = [("get_recommendations", recs)]
        if isinstance(recs, list) and recs:
            lines = [f"- **{r['name']}, {r['state_abbr']}** (priority {r['priority_score']}): {'; '.join(r['reasons'])}" for r in recs]
            head = f"Top pilot areas{' for ' + topic.replace('_', ' and ') if topic else ''}:"
        else:
            calls.append(ToolCall(name="rank_underserved", args={"state_fips": state, "limit": 5}))
            ranked = tools.rank_underserved(state_fips=state, limit=5)
            results.append(("rank_underserved", ranked))
            ranked = ranked if isinstance(ranked, list) else []
            lines = [f"- **{r['name']}, {r['state_abbr']}**: exclusion index {r['exclusion_index']}, "
                     f"about {r['est_underserved_hh']:,} underserved households (modeled)" for r in ranked]
            head = "Not enough complaint data to score frustration here, so these are ranked by exclusion index only:"
    except Exception:
        return ChatResponse(reply="The Navigator API is not reachable right now. Please try again.", mode="rules",
                            warnings=["Navigator API unreachable."])
    reply = "\n".join([head, *lines, "", "Open an area's profile or build a pilot plan to go deeper."])
    return _assemble(reply, calls, results, "rules")
