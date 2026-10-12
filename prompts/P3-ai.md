You are my pair programmer for the LEAD ASPIRE build. Read CLAUDE.md and CONTRACTS.md in the repo root first; they are the source of truth. I am **P3: AI agent + pilot plan**, on branch `p3-ai`. I own only `backend/app/ai/**`, `backend/app/routers/chat.py`, `backend/app/routers/plan.py`, `backend/tests/test_ai.py`. P1 owns the rest of `backend/` (main.py, config.py, models.py, requirements.txt). Never edit P1's files.

## Goal
Two features on our Microsoft Foundry deployment (`gpt-5-mini`), both with guardrails and a no-AI fallback:
1. `POST /api/chat`: an agent that answers "where should we pilot X?" by calling our API as tools, cites real numbers and returns areas for the map to highlight.
2. `POST /api/plan` + `POST /api/plan/{id}/approve`: a pilot program plan for one county that a human reviews and approves.
This is our Responsible AI story, so every claim must trace to a tool result.

## Integration
- P1's `main.py` includes `app.routers.chat` and `app.routers.plan` if they import. Each exports `router = APIRouter(prefix="/api/chat" | "/api/plan", ...)`.
- **Tools call P1's HTTP API** with `httpx` (base `settings.api_base`, default `http://localhost:8000`), never P1's Python internals. That keeps us decoupled and works against P1's fixtures from minute 30.
- Settings: `from app.config import settings` (azure_openai_endpoint, azure_openai_api_key, azure_openai_deployment, ai_configured, api_base). If P1 hasn't pushed config yet, read the same env vars from `backend/.env` with python-dotenv in `app/ai/settings_fallback.py`.
- Define my own pydantic models in `app/ai/schemas.py` (ChatRequest, ChatResponse, PlanRequest, PilotPlan, ApproveRequest, Checklist) matching CONTRACTS.md; the Recommendation shape is passed through as returned by P1.

## Structure
```
backend/app/ai/
  schemas.py  client.py  smoke.py
  tools.py        # tool JSON schemas + executors (httpx -> P1 API), with a small in-process cache
  agent.py        # chat loop with tool calling, max 5 tool rounds, rules fallback
  facts.py        # flat facts dict for a plan (the ONLY numbers the model may use)
  prompts.py      # AGENT_SYSTEM, PLAN_SYSTEM, builders
  guardrails.py   # banned terms, number check, revenue-wording check, length
  template.py     # no-AI pilot plan
  plans.py        # generate_plan, approve, in-memory store
backend/app/routers/chat.py  backend/app/routers/plan.py
backend/tests/test_ai.py
```

## Foundry client
```python
from openai import OpenAI
client = OpenAI(base_url=settings.azure_openai_endpoint, api_key=settings.azure_openai_api_key, timeout=45, max_retries=1)
client.chat.completions.create(model=settings.azure_openai_deployment, messages=..., tools=TOOLS, tool_choice="auto", max_completion_tokens=1500)
```
gpt-5-mini is a reasoning model: no `temperature`. First thing: `smoke.py` makes one plain call and one tool call and prints both. If a parameter errors, read the error and adjust. Never log keys, prompts or outputs; log only request id, mode, tool names, latency, warning count.

## Agent tools (tools.py)
| Tool | Calls | Purpose |
|---|---|---|
| `get_recommendations(level="county", state_fips=None, topic=None, limit=5)` | `GET /api/recommendations` | rank pilot areas, optionally for one benefit topic |
| `get_area_profile(fips)` | `GET /api/areas/{fips}` | exclusion + frustration detail, benefit, look-alikes |
| `search_areas(query, level="county")` | `GET /api/areas?level=...` (cached) | resolve "Hidalgo" / "Texas" to fips |
| `compute_roi(fips, issuer_type="community", adoption_rate=None, churn=None, cac=None)` | `POST /api/roi` | economics for an area |
| `list_benefits()` | `GET /api/benefits` | benefit catalog |
Return compact JSON to the model (trim to the fields it needs). Map topic words in the user's question ("no-fee", "overdraft" -> fees; "scams" -> fraud_scams; "remittance"/"transfers" -> transfers; "closed" -> account_closed; "support" -> customer_service; "trust" -> distrust) in the system prompt, not in code.

**AGENT_SYSTEM** essentials: you help Mastercard employees choose financial-inclusion pilot areas. Use tools for every number; never invent or estimate figures. Prefer areas with a frustration score and a clear lead topic; say when data is thin ("not enough complaints to score"). Explain in 3-6 short bullets: why the area (exclusion + frustration numbers), its top frustration and matched benefit, one trade-off. Network volume is not Mastercard revenue. Never mention, infer or target by immigration, citizenship, national origin, language, race, ethnicity or religion; if asked to, decline briefly and offer the economic-access view. End by suggesting the user open the area's profile or build a pilot plan. Answer in under 180 words.

**ChatResponse assembly:** `recommendations` = the last `get_recommendations` result (if any); `focus_fips` = fips from tool results that appear in the final answer; `tool_calls` = names + args (shown in the UI for transparency); run guardrails on `reply` and put hits in `warnings`; `context.selected_fips` is passed to the model as "the user is looking at <name>".

**Rules fallback** (`mode: "rules"`) when AI is not configured or errors: detect a topic keyword and a state name with simple string matching, call `get_recommendations`, return a templated markdown list of the top 5 with their `reasons`. The demo must work with no AI.

## Pilot plan (plans.py)
- `POST /api/plan`: fetch `GET /api/areas/{fips}`, `POST /api/roi` (with the request's roi inputs), `GET /api/benefits`; 404 if the area is unknown; 400 if its `frustration_status` isn't "ok" ("Not enough complaint data to plan a pilot here").
- `facts.py` flattens: area name/state, exclusion index + rank, households, est. underserved (modeled), poverty, no-internet, branches per 10k, state FDIC unbanked/underbanked; complaints, per 100k, frustration score, top and second topic with pain scores, intensity + source, clear_lead; benefit title + description + pain_measure; ROI inputs and all unit/program outputs incl. breakeven churn; 3-5 look-alikes (name, state, similarity); partner_name; notes.
- **PLAN_SYSTEM**: write a pilot program plan for Mastercard and a community-focused issuer partner, using ONLY the facts; label modeled and placeholder figures; same protected-attribute ban; outreach only through community organizations with issuer compliance review; network volume is not Mastercard revenue. Sections (markdown, under 750 words): 1 Executive summary (3 sentences) · 2 Why this area · 3 What frustrates people here and the benefit · 4 Offer design · 5 Outreach plan (partners, channels, compliance review, no protected-attribute targeting) · 6 Why Mastercard · 7 Economics and the two levers (churn toward breakeven, cheaper acquisition via partners) · 8 Pilot design and success measures (launch area vs the look-alikes, 12-month baseline, 12-month pilot with a 6-month read, difference-in-differences; usage measures: new accounts per 1,000 adults, 90-day active, transactions per account per month vs 33.4, yearly churn vs breakeven; pain measures: target-topic complaints per 100k and their intensity vs look-alikes; the 2x2 read: usage rose + pain fell = scale, usage rose + pain flat = rework benefit, usage flat + pain fell = fix outreach, both flat = drop) · 9 Risks and safeguards (complaint data skews banked, modeled counts, older servicing benchmark, Mastercard doesn't hold accounts so an issuer partner is required) · 10 Decision needed.
- Append: "_Draft generated with AI from Navigator data. Modeled and placeholder figures must be validated in the pilot._"
- Template fallback renders the same 10 sections from the facts with f-strings, `mode: "template"`, warning "AI unavailable, template draft shown".
- Store plans in a dict; id `p_` + 6 hex.
- Approve: per CONTRACTS.md (checklist all true, reviewer non-blank, 404 unknown); store edited markdown; re-run banned-term check on it and return warnings.

## Guardrails (guardrails.py, return warnings, never silently edit)
1. Banned terms from CLAUDE.md, case-insensitive -> "Mentions a protected attribute: <term>".
2. Numbers: extract every number ($, %, commas, k/M/B), warn if it matches no fact within 1% (ignore years 2020-2030, section numbers, integers under 13, and the 33.4 / 12-month / 6-month design constants). "Number X does not match any provided fact."
3. Revenue wording: warn if "revenue" appears within 10 words of the network volume figure.
4. Length: plan > 900 words or chat > 250 words -> warning.

## Tests (pytest, no network: mock httpx and the OpenAI client)
Rules fallback answer; tool loop with one tool call then answer; banned-term and invented-number warnings; plan template mode; plan 400 on low_data area; approve without checklist 400; approve ok; unknown plan 404.

## Order of work
1. (0:00-0:20) smoke.py works (plain + tool call). If I have no keys yet, tell me where: Foundry portal home -> "Azure OpenAI endpoint" and "API key", into `backend/.env`.
2. (0:20-1:00) tools + agent + chat router against P1's fixture API, then rules fallback. Commit + push.
3. (1:00-1:30) facts, plan prompt, template, plan + approve routes, guardrails, tests green. Push before checkpoint.
4. After checkpoint: run 5 realistic questions against real data ("where should we pilot a no-fee account?", "best county in Texas for fraud protection?", "compare Hidalgo with its look-alikes", "what's the ROI if churn drops to 16%?", a protected-attribute bait question) and tune prompts until answers are right, short and cited. Write `backend/app/ai/README.md`: what the AI can know (tool data only), decide (rank and draft), and do (nothing external); what a human approves; limits; production hardening (Entra managed identity, Key Vault, Foundry evaluations and content safety, no prompt logging). P5 uses it for the governance slide.

Commit after each step. Ask me before changing any contract shape.
