You are my pair programmer for the LEAD ASPIRE build. Read CLAUDE.md and CONTRACTS.md in the repo root first; they are the source of truth. I am **P4: dashboard + ROI panel**, on branch `p4-dashboard`. I own `frontend/**` EXCEPT P5's paths: `frontend/app/plan/**`, `frontend/components/chat/**` (after my one-line stub), `frontend/components/plan/**`, `frontend/public/mock/chat.json`, `frontend/public/mock/plan.json`. Never edit those.

## Goal
The Next.js app, the shared typed API layer, the two-heatmap dashboard (the demo centerpiece) and the reusable `RoiPanel` P5 embeds in the plan page. **P5 is blocked until my scaffold is pushed: push it within 20 minutes.**

## Step 1: scaffold (push by 0:20, then tell P5)
- From the repo root: `npx create-next-app@latest frontend --ts --tailwind --eslint --app --src-dir=false --import-alias "@/*" --use-npm` (non-interactive).
- `npm i d3-geo topojson-client us-atlas react-markdown` and `npm i -D @types/d3-geo @types/topojson-client` (react-markdown is for P5; I own package.json).
- `lib/types.ts`: every type in CONTRACTS.md (Area, AreaSummary, FrustrationArea, AreaProfile, Benefit, Recommendation, Lookalike, Benchmarks, RoiRequest, RoiResult, ChatContext, ChatMessage, ChatRequest, ChatResponse, PlanRequest, PilotPlan, ApproveRequest, Health, TopicId). snake_case like the API.
- `lib/api.ts`: `API_BASE`, `USE_MOCK`, `ApiError(message, status)`, and `getHealth, getAreas(level, state?), getProfile(fips), getLookalikes(fips, n), getRecommendations(params), getBenefits, getAssumptions, postRoi, postChat, postPlan, approvePlan`. Mock mode reads `/mock/*.json` (file names in CONTRACTS.md section 3; P5 creates chat.json and plan.json).
- `lib/topics.ts`: topic ids -> labels and icons (simple inline SVG or emoji-free glyphs), benefit ids -> titles. `lib/format.ts`: `fmtInt`, `fmtUSD` (compact >= 1M: $43.2M, >= 1B: $10.9B), `fmtPct`, `fmtScore`.
- `components/chat/ChatPanel.tsx` stub: `export default function ChatPanel(_: any) { return null }` (P5 replaces it; never touch it again after this commit).
- My mocks in `public/mock/`: `areas_state.json` (all 50 states + DC, plausible values), `areas_county.json` (~40 Texas counties incl. 48215, mix of ok / low_data / no_data), `profile.json` (Hidalgo), `lookalikes.json`, `recommendations.json`, `benefits.json`, `assumptions.json` (copy benchmarks from CONTRACTS.md), `roi.json` (the worked example), `health.json`.
- `frontend/.env.local.example`. `npm run build` passes. Commit + push.

## Step 2: shell + shared UI (`app/layout.tsx`, `components/ui/*`)
- Clean fintech look: off-white background, deep navy `#0B1F3A` text/primary, warm orange `#F79E1B` accent used sparingly, Inter. No Mastercard logos or official branding.
- Top bar: "Monopoly", a "Prototype" pill, API status dot from `getHealth` (green = pipeline for both files, amber = any fixtures/mock, red = down) with a tooltip naming each source.
- Footer: "Prototype for LEAD ASPIRE 2026. Modeled data; not financial advice. No protected attributes are used."
- Shared components P5 reuses: `Card`, `Stat` (label, value, sublabel, tag "modeled" | "placeholder" | "sourced"), `Button`, `Badge`, `Tabs`, `Spinner`, `ErrorBox` (friendly + retry), `EmptyState`, `SourceNote`, `DataStatusBadge` (ok / low data / no data).

## Step 3: dashboard (`app/page.tsx`, `components/map/*`, `components/area/*`)
Layout at 1280-1440px: map on the left (~62%), sidebar on the right with `Tabs`: **Ask the agent** (P5's `ChatPanel`) and **Area profile** (auto-switches when an area is clicked).
- **Controls above the map:** layer toggle **Underserved | Frustration**; when Frustration is on, a topic select "All frustrations | Fees | Fraud and scams | ..." (colors by that topic's pain score percentile); breadcrumb "United States > Texas" to go back up.
- **Map** (`components/map/UsMap.tsx`): load `us-atlas/counties-albers-10m.json` (import from node_modules), `topojson-client` `feature()` for states/counties and `mesh()` for borders, `d3-geo` `geoPath()` with no projection, SVG `viewBox="0 0 975 610"`. National view = states; click a state -> zoom (animate viewBox to the state's `path.bounds` with padding) and show its counties from `getAreas("county", stateFips)`.
  - Underserved: sequential navy ramp, 5 quantile bins of `exclusion_index`.
  - Frustration: sequential orange-red ramp, 5 bins of `frustration_score`; `low_data` / `no_data` areas get a grey diagonal-hatch SVG pattern. Legend shows bins + a hatched swatch "Not enough complaints to score (< 30)".
  - In Frustration view, small topic glyphs on counties with `clear_lead` (only when zoomed into a state).
  - Hover tooltip: name, exclusion index, frustration score or "not enough data", top frustration, est. underserved households (modeled).
  - Highlight: thick orange outline for `focusFips` (set by the chat panel via `onFocus`) and the selected area.
  - Memoize paths and color scales; 3,000+ county paths must stay smooth (only render the zoomed state's counties).
- **Area profile panel** (`components/area/AreaProfilePanel.tsx`, from `getProfile`): header with name, `DataStatusBadge`, exclusion index + rank, frustration score; "Who is left out": households, est. underserved (modeled), poverty, no-internet, branches per 10k, state FDIC unbanked/underbanked (labeled "state-level"); "What frustrates people": topic bars (shares vs national, pain scores), mean intensity + its source, complaints and per-100k, up to 3 excerpts labeled "CFPB complaint excerpt"; "Matched benefit" card; "Look-alike counties" list (click to select); primary button **Build pilot plan ->** to `/plan?fips=XXXXX` (disabled with a reason if `frustration_status !== "ok"`).
- Pass `ChatPanel` props exactly as in CONTRACTS.md: `context={{ layer, state_fips, selected_fips }}`, `onFocus(fips[])` (highlight + zoom to the state of the first one if needed), `onSelect(fips)` (select + open profile).
- State in URL query (`?layer=frustration&state=48&fips=48215&topic=fees`) so refresh, back and the demo script work.

## Step 4: ROI panel (`components/roi/*`, used by P5's plan page)
`RoiPanel({ fips, onChange })`, all numbers from `postRoi` (debounced 300 ms) and defaults from `getAssumptions`:
- Inputs: issuer type toggle (Community issuer / Large bank), adoption rate slider (0.5-15%, "placeholder"), churn slider (5-50%) with preset chips "Observed 40%" and "Breakeven" (sets churn to `breakeven_churn`), acquisition cost slider ($100-$700), fixed program cost, and under "Advanced" the network yield placeholder.
- Unit economics table: spend, swipe revenue, deposit earnings, fraud loss, servicing, **annual margin**, LTV, net per account, breakeven churn.
- **LTV vs churn chart** (plain SVG): `ltv_curve` line, dashed horizontal line at CAC, dot at breakeven, marker at the current churn. Title states the finding, e.g. "Pays back only below 16% yearly churn".
- Program stats: accounts, issuer net (lifetime, red/green), network volume year 1 ("spend on Mastercard's network, not Mastercard revenue"), estimated network revenue (placeholder yield).
- Scale row: County -> State -> United States -> Global cards with accounts and network volume; Global labeled "adults".
- `labels` from the API as small notes. Calls `onChange(req, result)` after each successful update.

## Quality bar
`npm run build` clean before each push. Every modeled / placeholder / state-level number tagged. Loading, error and empty states everywhere. No secrets in the frontend.

## Order of work
Step 1 (by 0:20) -> Step 2 (by 0:40) -> Step 3 map + profile (by 1:30, demo centerpiece) -> Step 4 RoiPanel (by 1:50; tell P5 when it's pushed). After checkpoint: switch `.env.local` to the real API, test the Underserved and Frustration views on Texas and two other states, fix bugs, polish.

Commit after each step. If I change `lib/types.ts` or a shared component's props, tell P5. Ask me before changing any contract.
