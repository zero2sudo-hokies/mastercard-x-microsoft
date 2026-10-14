You are my pair programmer for the LEAD ASPIRE build. Read CLAUDE.md and CONTRACTS.md in the repo root first; they are the source of truth. I am **P5: chat UI, pilot plan page, demo lead**, on branch `p5-plan`. I own only `frontend/app/plan/**`, `frontend/components/chat/**`, `frontend/components/plan/**`, `frontend/public/mock/chat.json`, `frontend/public/mock/plan.json`, `docs/**`, `README.md`, `run_demo.sh`, `run_demo.ps1`. P4 owns the rest of `frontend/` (scaffold, `lib/`, `components/ui/`, `components/roi/RoiPanel`, the dashboard). Never edit P4's files; import from them. P4 creates a stub `components/chat/ChatPanel.tsx`; I replace it.

## Goal
The agent chat panel on the dashboard, the pilot plan page that ends the demo with a human approval, and everything that makes the demo and the security story bulletproof.

## Step 0 (while P4 scaffolds, ~20 min): docs
In `docs/`, concise and judge-readable Markdown:
1. `security-governance.md` following the event's Security & Governance kit (Zero Trust: verify explicitly, least privilege, assume breach). Sections: Identity (prototype local only; production Microsoft Entra ID with roles Viewer / Analyst / Approver, Conditional Access); Permissions (agent tools are read-only API calls; only an Approver approves a plan; the app's identity can call one model deployment); Secrets (gitignored `backend/.env`; production Key Vault + managed identity); Data (public aggregates only: FDIC, ACS, CFPB complaints already scrubbed by CFPB; no personal data; no protected attributes, and why we removed foreign-born and limited-English from the index; plans kept in memory only); Encryption (TLS in production, Azure storage encrypted at rest); Logging (request metadata only, no prompts, outputs or keys); Failure (AI down -> rules chat + template plan; data missing -> fixtures; wrong AI output -> guardrail warnings + human approval); AI guardrails (tools only, facts-only plan prompt, banned-term, number and revenue-wording checks, human approval with the safe-outreach checklist); Model quality (topic agreement vs CFPB's own Issue field, hand-check; numbers from P2's README); Ownership (`<name>` per area); Governance (production: Azure Policy, Defender for Cloud, Purview labels, Foundry evaluations). End with "How the solution protects the customer" in 3 bullets.
2. `readiness-checklist.md`: the 10-item Build Readiness Checklist as a table (Status, Evidence) plus an honest "Real functionality" table: fully working / partial / modeled or mocked per feature (underserved counts modeled; county FDIC rates are state-level; frustration scored only with >= 30 complaints; intensity from a sample; ROI on industry benchmarks with placeholder adoption and program cost; outreach is a checklist, not a campaign).
3. `concern-solution-map.md`: Customer Concern -> Solution table (5 rows: #, concern, part of the solution, covered Yes/Partial/Out of scope). Pre-fill: (1) don't know where underserved demand is -> Underserved heatmap; (2) don't know what to offer -> Frustration heatmap + matched benefit; (3) issuers need a business case -> ROI panel with churn and acquisition levers; (4) regulatory and reputational risk of targeting -> no protected attributes, compliance checklist, human approval; (5) slow manual analysis -> agent + pilot plan in minutes; plus "proving it works" -> look-alike pilot design. Mark "VERIFY against our Discovery notes" at the top.
4. `demo-script.md`: the demo path below with speaker per step (`<P1>`..`<P5>`), exact clicks, the one line to say, and the fallback per step.

## Step 1: mocks
`public/mock/chat.json` (a realistic ChatResponse with 5 recommendations, `focus_fips`, 2 tool_calls) and `plan.json` (a full 10-section PilotPlan for Hidalgo with one warning). Match CONTRACTS.md shapes.

## Step 2: ChatPanel (`components/chat/*`)
Props exactly per CONTRACTS.md: `{ context, onFocus, onSelect }`.
- Message list + input; Enter to send; keeps the full `messages` array and sends it with `context` to `postChat`.
- Starter chips when empty: "Where should we pilot a no-fee account?", "Best counties in this state for fraud protection", "Which areas have the most frustrated customers?", "Show look-alikes for the selected county".
- Assistant messages: rendered markdown (`react-markdown`, never `dangerouslySetInnerHTML`), a small "AI-generated, review before use" note, a mode badge (Foundry gpt-5-mini / Rules fallback), a collapsible "How I got this" listing `tool_calls`, and amber `warnings` if any.
- Recommendations as clickable cards (rank, name, state, priority, exclusion, frustration, benefit, clear-lead badge, first reason): click -> `onSelect(fips)`; a "Show on map" button -> `onFocus(focus_fips)` (also call it automatically when a reply arrives).
- Typing indicator ("Checking the data..."), friendly error with retry, disabled while sending. Keep it fast: the panel must not re-render the map.

## Step 3: pilot plan page (`app/plan/page.tsx`, `components/plan/*`)
Read `fips` from the query; EmptyState with a link back to `/` if missing.
1. **Header:** area name, state, `DataStatusBadge`, top frustration + matched benefit, back link to `/?fips=...`.
2. **Economics:** P4's `<RoiPanel fips onChange={(req, result) => ...} />`; keep the latest `req` for the plan request. Until P4 pushes RoiPanel (~1:50), render a placeholder card that calls `postRoi` with defaults so the page still works.
3. **Generate:** partner name input (default "Community credit union (TBD)"), notes textarea, "Generate pilot plan with Azure AI" -> `postPlan({ fips, roi: latestReq, partner_name, notes })`. Loading "Drafting the pilot plan from Monopoly data..." (can take 20-40 s).
4. **Review:** yellow banner "AI-generated draft. Review before use." + mode badge; amber warnings box listing every warning (a feature in the demo); rendered markdown with an Edit toggle (textarea); collapsible "Facts the AI was allowed to use" from `facts_used`.
5. **Approve:** safe-outreach checklist, all required: "Issuer compliance team has reviewed targeting and marketing", "Outreach runs through named community partner organizations", "No immigration, citizenship, language, race or other protected attributes used in targeting or messaging". Reviewer name. "Approve pilot plan" disabled until complete -> `approvePlan`. On success: green "Approved by X at <time>", editing locked, "Copy" and "Download .md" buttons. Show API 400 messages inline.

## Step 4: README + run scripts (repo root)
- `README.md`: one-paragraph pitch, the 4-step workflow, architecture sketch, prerequisites (Python 3.11+, Node 20+), setup (`cp .env.example backend/.env`, Foundry endpoint + key; `frontend/.env.local`), run, rebuild data (`python data/exclusion/build.py`, then the frustration pipeline per `data/frustration/README.md`), tests, team + ownership, links to `docs/`.
- `run_demo.sh` / `run_demo.ps1`: venv, `pip install -r backend/requirements.txt`, uvicorn :8000 in the background, `npm install` + `npm run dev` in `frontend/`, print the URL. Warn (don't fail) if `backend/.env` is missing: "AI will use rules and template fallbacks".

## Demo path (~4-5 min)
1. Dashboard, Underserved view: "here's who's left out", click into one state.
2. Toggle Frustration: hatched areas = not enough data (honesty), colored = scored; switch the topic select to Fees.
3. Ask the agent "Where should we pilot a no-fee account?": cited answer, map highlights, click the top recommendation.
4. Area profile: exclusion facts, top frustration, excerpts, look-alikes -> Build pilot plan.
5. ROI panel: community vs large bank, then churn from 40% to breakeven ~16%: "this is the lever the Monopoly targets".
6. Generate the plan with Azure AI, point at warnings and the facts panel, tick the checklist, approve, download.
7. Close: security and governance in 3 bullets.

## Backup plan (yours at code freeze, 2:30)
- Record a 4-minute screen video of the full path on merged `main` with real data, plus screenshots of each step.
- Test mock mode (`NEXT_PUBLIC_USE_MOCK=1`) once as the second fallback.
- If Foundry fails live: rules chat + template plan still work: "this is our graceful-degradation path".

## Order of work
Step 0 (until P4's scaffold lands) -> Step 1 -> Step 2 ChatPanel (by 1:15) -> Step 3 plan page (by 1:30) -> checkpoint: run `run_demo` on merged main, click the whole path, log bugs per owner -> Step 4 -> swap in RoiPanel when P4 pushes it -> polish -> 2:30 backup video.

`npm run build` clean before each push. Commit after each step. Ask P4 for any new shared type or component; ask me before changing any contract.
