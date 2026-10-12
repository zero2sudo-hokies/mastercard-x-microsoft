# Navigator AI (Foundry, gpt-5-mini)

Two features, both on our Microsoft Foundry deployment via the Azure OpenAI v1 endpoint, both with a no-AI fallback.

| Feature | Route | What it does | Fallback |
|---|---|---|---|
| Agent | `POST /api/chat` | Answers "where should we pilot X?" by calling the Navigator API as tools, cites the numbers, returns `focus_fips` for the map | Keyword rules over `/api/recommendations` (`mode: "rules"`) |
| Pilot plan | `POST /api/plan`, `POST /api/plan/{id}/approve` | Drafts a 10-section pilot program plan for one area; a human edits, ticks the safe-outreach checklist and approves | Template plan from the same facts (`mode: "rules"`) |

Run `python -m app.ai.smoke` from `backend/` to check the Foundry connection (one plain call, one tool call).

## What the AI can know, decide and do
- **Know:** only tool results from our own API (ACS, FDIC, CFPB-derived data, benchmarks). No web, no personal data.
- **Decide:** rank areas and draft text. Every figure in a plan must come from the facts dict (`facts.py`).
- **Do:** nothing outside the app. Tools are read-only GETs plus the ROI calculator. Plans stay drafts until a person approves them.

## Guardrails (`guardrails.py`, warnings shown to the reviewer, text never silently edited)
1. Protected-attribute terms from CLAUDE.md.
2. Every number in the output must match a provided fact within 1%.
3. Network volume must not be described as revenue.
4. Length limits (chat 250 words, plan 900).
Plus: the agent prompt refuses protected-attribute targeting, user messages are capped at 2,000 characters, at most 5 tool rounds, and approval requires all three checklist items and a reviewer name.

## Logging
Only request id, mode, tool names, latency and warning count. Never keys, prompts or model output.

## Limits
- Answers are only as good as the data layers: complaint data skews toward banked, online consumers; county household counts are modeled.
- gpt-5-mini can still phrase things loosely; the number check catches invented figures, not wrong emphasis.
- Plans are kept in memory and are lost on restart.

## Production hardening
Entra ID managed identity instead of API keys, keys in Azure Key Vault, Foundry content filters and Prompt Shields on the deployment, Foundry evaluations (groundedness, safety) on a fixed question set, rate limiting on `/api/chat`, persistent plan storage with an audit trail.
