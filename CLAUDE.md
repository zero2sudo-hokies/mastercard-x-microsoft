# Monopoly v2 — shared context for every Claude Code session

## What this is
LEAD ASPIRE 2026 (Microsoft Times Square). Client: Mastercard. Our Statement of Work was approved by the EY Partner; we are in the 3-hour BUILD phase, then PITCH to judges.

We are building **Monopoly**: it shows Mastercard employees where people are left out of banking and what frustrates them most, recommends where to pilot, and drafts a pilot program plan for a human to approve. Pilot-first (EY's recommendation): prove it in one county, then scale to the US (24.6M unbanked + underbanked households, FDIC 2023) and globally (about 1.3B unbanked adults).

## v1 workflow (what the demo must do end to end)
1. **Dashboard** (`/`): US map, toggle between two heatmaps:
   - **Underserved**: exclusion index (FDIC + ACS + bank branch density).
   - **Frustration**: frustration score from CFPB complaints, with topic and intensity from a Foundry model. Areas with under 30 complaints show "not enough data".
   Click a state to drill into its counties. Click a county to open its profile panel.
2. **Agent chat panel** on the dashboard: answers questions like "where should we pilot a no-fee account?" by calling our API tools, cites the numbers, highlights areas on the map.
3. **Area profile**: exclusion facts, top frustration + matched benefit, short complaint excerpts, look-alike counties, "Build pilot plan" button.
4. **Pilot plan** (`/plan?fips=...`): ROI levers (issuer type, adoption, churn, acquisition cost) with the LTV vs churn curve, then a Foundry-written pilot program plan (why this area, offers, outreach, why Mastercard, ROI, pilot design and measures, risks). A human edits, ticks the safe-outreach checklist and approves.

## Stack (decided, do not change)
- Frontend: Next.js (App Router, TypeScript, Tailwind). Map = SVG with `d3-geo` + `topojson-client` + `us-atlas` (`counties-albers-10m.json`). No map tiles. Runs on :3000.
- Backend: FastAPI, Python 3.11+, pydantic v2. Runs on :8000.
- AI: Azure OpenAI v1 endpoint in our Microsoft Foundry project, deployment `gpt-5-mini`, `openai` Python SDK, chat completions with tool calling. Backend only. (No Foundry Agent Service: we lack the Foundry User role.)
- Data: precomputed JSON in `backend/app/data/`. No database.
- Demo: local + recorded backup video.

## Non-negotiable rules
- NEVER use, collect, infer or display immigration status, citizenship, national origin, country names as targets, ITIN/SSN status, language spoken, limited-English status, race, ethnicity or religion. No such ACS tables, no such search terms, no such words in AI output. Target by economic access and complaint topics only.
- Banned-term list for data excerpts and AI output checks: immigra, undocumented, illegal alien, citizen, ITIN, SSN, foreign-born, nativity, national origin, race, ethnic, hispanic, latino, religion, deport.
- NEVER hard-code secrets. Keys live in gitignored `backend/.env`. Never log keys, prompts or model outputs.
- Every number in the UI is sourced (FDIC, ACS, CFPB, benchmarks) or labeled "modeled" / "placeholder". Network volume is never called Mastercard revenue.
- AI output is a DRAFT until a human approves. Show "AI-generated, review before use" on every AI draft and chat answer.
- Only edit files you own (table below). Need something else changed? Ask the owner.
- `CONTRACTS.md` is the source of truth. Don't change a contract without telling the whole team.
- Demo-ready always: loading, error and empty states; never a stack trace on screen.

## Ownership (no overlap)
| Person | Branch | Owns |
|---|---|---|
| P1 Exclusion data + core API | p1-core | `data/exclusion/**`; `backend/**` EXCEPT P2's and P3's paths below; writes `backend/app/data/areas.json` and `benchmarks.json` |
| P2 Sahaj, frustration layer | p2-frustration | `data/frustration/**`; writes `backend/app/data/frustration.json` |
| P3 AI agent + pilot plan | p3-ai | `backend/app/ai/**`, `backend/app/routers/chat.py`, `backend/app/routers/plan.py`, `backend/tests/test_ai.py` |
| P4 Dashboard + ROI panel | p4-dashboard | `frontend/**` EXCEPT P5's paths below |
| P5 Chat UI, plan page, demo | p5-plan | `frontend/app/plan/**`, `frontend/components/chat/**`, `frontend/components/plan/**`, `frontend/public/mock/chat.json`, `frontend/public/mock/plan.json`, `docs/**`, `README.md`, `run_demo.sh`, `run_demo.ps1` |

One handoff: P4 creates a one-line stub `frontend/components/chat/ChatPanel.tsx` in the scaffold commit so the dashboard compiles; from then on P5 owns it.
Root files `CLAUDE.md`, `CONTRACTS.md`, `.gitignore`, `.env.example` come from Step 0; change only with team agreement.

## Git
- Work on your branch, commit small, push often.
- Checkpoint merges to `main` in order P1 -> P2 -> P3 -> P4 -> P5, then everyone pulls `main`.
- Code freeze 2:30 into the build.
