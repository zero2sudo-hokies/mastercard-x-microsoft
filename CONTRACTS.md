# CONTRACTS v2 — source of truth

All JSON uses snake_case. Rates are decimals 0-1 (0.31 = 31%). Money is USD numbers. Missing values are `null`, never `"N/A"`. FIPS codes are strings with leading zeros: state `"48"`, county `"48215"`.

Topics (fixed ids, in this order): `fees`, `fraud_scams`, `transfers`, `account_closed`, `customer_service`, `distrust`.

---

## 1. Data files in `backend/app/data/`

### `areas.json` (P1) — exclusion layer
```json
{
  "generated_at": "2026-10-12T15:00:00Z",
  "is_demo_data": false,
  "sources": ["ACS 5-year 2020-2024", "FDIC 2023 National Survey of Unbanked and Underbanked Households", "FDIC BankFind locations", "Census Gazetteer"],
  "states": [ { "...": "Area, level = state" } ],
  "counties": [ { "...": "Area, level = county" } ]
}
```
`Area`:
```json
{
  "fips": "48215", "name": "Hidalgo County", "level": "county",
  "state_fips": "48", "state_abbr": "TX",
  "population": 880000, "households": 270000,
  "median_income": 52000, "poverty_rate": 0.27, "no_internet_rate": 0.18,
  "branches": 160, "branches_per_10k_hh": 5.9,
  "unbanked_rate": 0.05, "underbanked_rate": 0.16,
  "underserved_rate": 0.36, "est_underserved_hh": 97000,
  "exclusion_index": 91.2, "exclusion_rank": 14,
  "centroid": [26.39, -98.18]
}
```
- For counties, `unbanked_rate` / `underbanked_rate` are the **state's** FDIC rates (FDIC has no county data); say so in the UI.
- `underserved_rate`: state = unbanked + underbanked. County = clamp(state underserved × county poverty / state poverty, 0.05, 0.60). Modeled.
- `est_underserved_hh = round(households × underserved_rate)`.
- `exclusion_index` 0-100 = percentile of the mean z-score of the measures listed in the plan (states: FDIC unbanked, FDIC underbanked, poverty, no-internet, inverse income, inverse branches per 10k HH; counties: poverty, no-internet, inverse income, inverse branches per 10k HH, state FDIC underserved rate). Nulls get z = 0. `exclusion_rank` 1 = most excluded within its level.
- FORBIDDEN inputs anywhere: foreign-born, nativity, citizenship, language spoken, limited-English, race, ethnicity, religion.

### `benchmarks.json` (P1) — ROI inputs
Every value is sourced in a `sources` map inside the file (Federal Reserve Reg II 2023, PULSE 2024, FDIC QBP Q2 2026, SCF 2022, Moebs, FirstPage Sage, Mastercard FY2025 10-K, FDIC 2023 survey, Global Findex 2025). Churn is a labeled placeholder within the published 20-45% first-year attrition range. Values updated 2026-10-13 from the original input table where a source differed.
```json
{
  "transactions_per_month": 30.7, "avg_ticket": 46.89,
  "interchange_per_tx": { "community": 0.52, "large_bank": 0.23 },
  "avg_balance": 900, "deposit_margin": 0.0332,
  "fraud_rate": 0.00176, "issuer_fraud_share": 0.283,
  "servicing": { "community": 175, "large_bank": 400 },
  "cac": { "community": 428, "large_bank": 561 },
  "churn_observed": { "community": 0.40, "large_bank": 0.24 },
  "network_yield_placeholder": 0.0031,
  "us_underserved_hh": 24600000, "global_unbanked_adults": 1300000000,
  "roi_defaults": { "issuer_type": "community", "adoption_rate": 0.03, "fixed_program_cost": 75000 },
  "notes": {
    "network_yield_placeholder": "Approximate: Mastercard net revenue / gross dollar volume. Verify before quoting.",
    "adoption_rate": "Placeholder; the pilot replaces it.",
    "fixed_program_cost": "Placeholder; the pilot replaces it.",
    "servicing": "Older benchmark; rerun with partner issuer costs."
  }
}
```

### `frustration.json` (P2, Sahaj) — frustration layer
```json
{
  "generated_at": "2026-10-12T15:00:00Z",
  "is_demo_data": false,
  "window": { "from": "2024-10-01", "to": "2026-09-30" },
  "products": ["Checking or savings account", "Prepaid card", "Money transfer, virtual currency, or money service"],
  "classification": { "model": "gpt-5-mini", "narratives_classified": 1400, "topic_agreement": 0.81 },
  "national": {
    "complaints": 210000,
    "topic_shares": { "fees": 0.18, "fraud_scams": 0.27, "transfers": 0.12, "account_closed": 0.21, "customer_service": 0.15, "distrust": 0.07 },
    "mean_intensity": 3.4,
    "topic_intensity": { "fees": 3.1, "fraud_scams": 3.9, "transfers": 3.2, "account_closed": 3.8, "customer_service": 2.9, "distrust": 3.5 }
  },
  "states": { "48": { "...": "FrustrationArea" } },
  "counties": { "48215": { "...": "FrustrationArea" } }
}
```
`FrustrationArea`:
```json
{
  "fips": "48215", "level": "county",
  "complaints": 412, "complaints_per_100k": 46.8,
  "narratives_classified": 38,
  "mean_intensity": 3.7, "intensity_source": "area",
  "topic_counts": { "fees": 90, "fraud_scams": 120, "transfers": 70, "account_closed": 80, "customer_service": 40, "distrust": 12 },
  "topic_shares": { "fees": 0.22, "fraud_scams": 0.29, "transfers": 0.17, "account_closed": 0.19, "customer_service": 0.10, "distrust": 0.03 },
  "pain_scores": { "fees": 0.91, "fraud_scams": 0.80, "transfers": 1.12, "account_closed": 0.68, "customer_service": 0.39, "distrust": 0.31 },
  "top_topic": "transfers", "second_topic": "fees", "top_topic_lead": 1.23, "clear_lead": true,
  "frustration_score": 78.4,
  "status": "ok",
  "excerpts": [ { "topic": "transfers", "intensity": 4, "text": "Short scrubbed excerpt, max 40 words..." } ]
}
```
Rules (P2 implements):
- `complaints_per_100k` uses ACS population. Sahaj reads population from `areas.json` if present, else from his own ACS pull.
- `topic_shares` shrunk: `(n_t + 30 × national_share_t) / (n + 30)`.
- `intensity_source`: `"area"` if ≥ 10 classified narratives in the area, else `"state"`, else `"national"`. Topic intensity uses the area's topic mean if ≥ 5 classified in that topic, else `mean_intensity`.
- `pain_scores[t] = (topic_shares[t] / national.topic_shares[t]) × topic_intensity[t] / 5`.
- `top_topic_lead = pain(top) / pain(second)`; `clear_lead = lead ≥ 1.15`.
- `frustration_score` = percentile (0-100, within level) of `complaints_per_100k × mean_intensity / 5`, **only if `complaints ≥ 30`**, else `null`.
- `status`: `"ok"` (≥ 30 complaints), `"low_data"` (1-29), `"no_data"` (0). Areas with 0 complaints may be omitted from the dict; treat missing as `"no_data"`.
- `excerpts`: up to 3 per area, ≤ 40 words, from CFPB's already-scrubbed narratives, and never containing banned terms (see CLAUDE.md).

---

## 2. API — base `http://localhost:8000`

CORS allows `http://localhost:3000`. Errors are `{"detail": "message"}`. Unknown fips -> 404.

| Method | Path | Owner | Returns |
|---|---|---|---|
| GET | `/api/health` | P1 | `{"status":"ok","data_source":{"areas":"pipeline"\|"fixtures","frustration":"pipeline"\|"fixtures"},"ai_configured":true}` |
| GET | `/api/areas?level=state` | P1 | `AreaSummary[]` (all states) |
| GET | `/api/areas?level=county&state=48` | P1 | `AreaSummary[]` (counties of one state; omit `state` for all US counties) |
| GET | `/api/areas/{fips}` | P1 | `AreaProfile` |
| GET | `/api/areas/{fips}/lookalikes?n=5` | P1 | `Lookalike[]` |
| GET | `/api/recommendations?level=county&state=&topic=&limit=10` | P1 | `Recommendation[]` |
| GET | `/api/benefits` | P1 | `Benefit[]` |
| GET | `/api/assumptions` | P1 | `benchmarks.json` |
| POST | `/api/roi` | P1 | `RoiResult` |
| POST | `/api/chat` | P3 | `ChatResponse` |
| POST | `/api/plan` | P3 | `PilotPlan` |
| POST | `/api/plan/{id}/approve` | P3 | `PilotPlan` |

### `AreaSummary` (small, for map coloring)
```json
{ "fips": "48215", "name": "Hidalgo County", "level": "county", "state_fips": "48", "state_abbr": "TX",
  "exclusion_index": 91.2, "frustration_score": 78.4, "frustration_status": "ok",
  "top_topic": "transfers", "top_benefit_id": "low_cost_transfers", "pain_scores": { "...": "6 topics or null" },
  "est_underserved_hh": 97000, "priority_score": 84.8 }
```
`priority_score = 0.5 × exclusion_index + 0.5 × frustration_score` (null if frustration_score is null).

### `AreaProfile`
```json
{ "area": { "...": "full Area" }, "frustration": { "...": "FrustrationArea or null" },
  "benefit": { "...": "Benefit for top_topic, or null" }, "lookalikes": [ "...5 Lookalike" ],
  "labels": ["Underserved households are modeled from state FDIC rates and county poverty.", "..."] }
```

### `Benefit` (fixed catalog)
| id | topic | title |
|---|---|---|
| `no_fee_account` | fees | No-fee account (no overdraft, no minimum balance) |
| `fraud_protection` | fraud_scams | Fraud protection (alerts, scam warnings, fast reimbursement) |
| `low_cost_transfers` | transfers | Low-cost card-funded transfers |
| `second_chance_account` | account_closed | Second-chance account |
| `partner_support_line` | customer_service | Human support line run with the local partner |
| `trusted_partner_onboarding` | distrust | Onboarding through a trusted local partner |

Each: `{ "id", "topic", "title", "description", "pain_measure" }`. `pain_measure` is what the pilot tracks, e.g. "Fee complaints per 100k residents". The transfers description may cite the 1% federal excise tax on cash-funded remittances (since Jan 1, 2026; card- and account-funded transfers exempt). It must never target by origin or name countries.

### `Recommendation`
```json
{ "rank": 1, "fips": "48215", "name": "Hidalgo County", "state_abbr": "TX", "level": "county",
  "priority_score": 84.8, "exclusion_index": 91.2, "frustration_score": 78.4,
  "top_topic": "transfers", "benefit_id": "low_cost_transfers", "clear_lead": true,
  "est_underserved_hh": 97000,
  "reasons": ["Exclusion index 91 (top 9% of US counties)", "Transfers pain 1.12x national", "412 complaints in 24 months"] }
```
- Ranked by `priority_score` desc; only areas with `frustration_status == "ok"`.
- With `topic=`: score = 0.5 × exclusion_index + 0.5 × percentile of that topic's `pain_scores` within the level; `benefit_id` = that topic's benefit.
- `state=` filters counties to one state.

### `Lookalike`
```json
{ "fips": "06025", "name": "Imperial County", "state_abbr": "CA", "distance_km": 870, "similarity": 0.93,
  "exclusion_index": 89.0, "frustration_score": 74.1, "top_topic": "transfers" }
```
Nearest counties on standardized [poverty, no-internet, inverse income, inverse branches/10k, exclusion_index, 6 topic shares], `distance_km ≥ 150`, excluding itself, `frustration_status == "ok"` only. `similarity = 1 / (1 + euclidean distance)`.

### `POST /api/roi`
Request:
```json
{ "fips": "48215", "issuer_type": "community", "adoption_rate": 0.03,
  "churn": null, "cac": null, "fixed_program_cost": 75000, "network_yield": null }
```
`null` -> default from `benchmarks.json` for that issuer type.

Response `RoiResult` (example shows the shape; numbers are from the original input table. The current worked example on sourced benchmarks: Hidalgo at 97,000 households, community: annual_spend 17,274, annual_margin 38, ltv 95, breakeven_churn 0.088, accounts 2,910, issuer_net_lifetime -1,045,165, network_volume_y1 50,268,143; see `backend/tests/test_roi.py`):
```json
{
  "area": { "fips": "48215", "name": "Hidalgo County", "state_abbr": "TX", "est_underserved_hh": 97000 },
  "inputs": { "issuer_type": "community", "adoption_rate": 0.03, "churn": 0.40, "cac": 428, "fixed_program_cost": 75000, "network_yield": 0.0029 },
  "unit": { "annual_spend": 14830, "swipe_revenue": 208, "deposit_earnings": 42, "fraud_loss": 7, "servicing": 175,
            "annual_margin": 69, "ltv": 172, "net_per_account": -256, "breakeven_churn": 0.161 },
  "program": { "accounts": 2910, "issuer_net_lifetime": -819279, "network_volume_y1": 43154136, "network_revenue_y1_est": 125147 },
  "ltv_curve": [ { "churn": 0.10, "ltv": 689 } ],
  "scale": [
    { "level": "County", "base": 97000, "unit": "households", "accounts": 2910, "network_volume_y1": 43154136 },
    { "level": "State", "base": 3400000, "unit": "households", "accounts": 102000, "network_volume_y1": 1512619200 },
    { "level": "United States", "base": 24600000, "unit": "households", "accounts": 738000, "network_volume_y1": 10944244800 },
    { "level": "Global", "base": 1300000000, "unit": "adults", "accounts": 39000000, "network_volume_y1": 578354400000 }
  ],
  "labels": ["Benchmarks from industry and Federal Reserve sources; rerun with the partner issuer's costs.", "Network volume is spend on Mastercard's network, not Mastercard revenue."]
}
```
Math (round money to whole dollars only at output, keep full precision inside):
- `annual_spend = transactions_per_month × 12 × avg_ticket`
- `swipe_revenue = transactions_per_month × 12 × interchange_per_tx[issuer_type]`
- `deposit_earnings = avg_balance × deposit_margin`
- `fraud_loss = annual_spend × fraud_rate × issuer_fraud_share`
- `annual_margin = swipe_revenue + deposit_earnings − fraud_loss − servicing[issuer_type]`
- `ltv = annual_margin / churn`; `net_per_account = ltv − cac`
- `breakeven_churn = annual_margin / cac` if margin > 0 else `null` (3 decimals)
- `accounts = round(est_underserved_hh × adoption_rate)`
- `issuer_net_lifetime = accounts × net_per_account − fixed_program_cost`
- `network_volume_y1 = accounts × annual_spend`; `network_revenue_y1_est = network_volume_y1 × network_yield`
- `ltv_curve`: churn 0.10 to 0.45 step 0.01.
- Scale: County = area, State = sum of `est_underserved_hh` of that state's counties (or the state Area), US = `us_underserved_hh`, Global = `global_unbanked_adults`. Same adoption_rate.

### ROI audience (added after data/p3 FDIC inputs, additive)
- `RoiRequest.audience_basis`: `"underserved"` (default, unchanged math) | `"unbanked"` | `"interested_unbanked"`. Accounts = audience households x adoption. State and US bases come from FDIC 2023 rows in `data/p3/roi-inputs.json`; county unbanked = households x state unbanked rate, county interested = that x state interest share (modeled). The interested basis has no Global scale row.
- `RoiResult.audience`: `{ "basis", "area_households", "label" }`; `RoiResult.inputs.audience_basis` echoes the request.
- `GET /api/roi/context/{fips}` -> `RoiContext`: `{ fips, state: StateAudience | null, area_audience: {basis: households}, banks: BankBenchmark[], bank_quarter, labels }`. Read-only context: bank ratios are whole-bank averages and never feed the ROI math.

### Bank partners (FDIC Summary of Deposits, additive)
- `GET /api/areas/{fips}/banks?n=10` -> `BankLeaderboard`: `{ fips, as_of, total_deposits, banks_present, banks: BankEntry[], labels }`. Banks ranked by deposits at their branches in the area (the public proxy for customers). `BankEntry`: `{ rank, cert, name, deposits, deposit_share, branches, total_assets, issuer_type, fdic_community_bank, holding_company, hq_city, hq_state, specialization, net_interest_margin, efficiency_ratio, return_on_assets }`. `issuer_type` = "community" if bank assets < $10B (Regulation II exempt) else "large_bank". Ratios are whole-bank call-report context, never ROI inputs.
- `POST /api/banks/compare` `{ fips, certs: 2-5, adoption_rate?, churn?, cac?, fixed_program_cost?, audience_basis? }` -> `BankCompare`: `{ fips, area_name, rows: [{ bank, underserved_households_per_branch, roi: RoiResult }], labels }`. Each row's ROI uses that bank's pricing tier; a cert not in the area's top 10 -> 404.
- `PlanRequest.bank_cert` (optional): the plan becomes a pitch to that bank; its pricing tier overrides `roi.issuer_type` and its name replaces `partner_name`.

### `POST /api/chat` (P3)
Request:
```json
{ "messages": [ { "role": "user", "content": "Where should we pilot a no-fee account?" } ],
  "context": { "layer": "frustration", "state_fips": null, "selected_fips": null } }
```
Response `ChatResponse`:
```json
{ "reply": "markdown answer", "recommendations": [ "...Recommendation" ], "focus_fips": ["48215", "06025"],
  "tool_calls": [ { "name": "get_recommendations", "args": { "topic": "fees" } } ],
  "mode": "foundry", "warnings": [] }
```
`mode` is `"foundry"` or `"rules"` (fallback). `focus_fips` = areas the map should highlight.

### `POST /api/plan` (P3)
Request: `{ "fips": "48215", "roi": { "...": "RoiRequest" }, "partner_name": "Community credit union (TBD)", "notes": "" }`

Response `PilotPlan`:
```json
{ "id": "p_7f3a9c", "fips": "48215", "area_name": "Hidalgo County, TX", "status": "draft",
  "markdown": "## Pilot program plan: ...", "model": "gpt-5-mini", "mode": "foundry",
  "generated_at": "2026-10-12T16:10:00Z", "warnings": [], "facts_used": { "...": "flat dict" },
  "approved_by": null, "approved_at": null }
```
### `POST /api/plan/{id}/approve` (P3)
Request: `{ "reviewer": "Aadu", "markdown": "edited text", "checklist": { "compliance_review": true, "community_partner": true, "no_protected_attributes": true } }`
All three must be true, else 400 `"Complete the safe-outreach checklist before approving"`. Blank reviewer -> 400. Unknown id -> 404. Plans live in memory.

---

## 3. Frontend

- Env: `NEXT_PUBLIC_API_BASE` (default `http://localhost:8000`), `NEXT_PUBLIC_USE_MOCK` (`"1"` = read `/mock/*.json`).
- Mocks in `frontend/public/mock/`: P4 owns `areas_state.json`, `areas_county.json`, `profile.json`, `lookalikes.json`, `recommendations.json`, `benefits.json`, `assumptions.json`, `roi.json`, `health.json`. P5 owns `chat.json`, `plan.json`.
- Map shapes: npm `us-atlas` (`counties-albers-10m.json`, pre-projected, ids are 5-digit county FIPS strings; `states` object ids are 2-digit) + `topojson-client` + `d3-geo` (`geoPath()` with no projection). Known gap: Connecticut's 2022 planning regions won't match old county shapes; CT shows "no data".
- `lib/types.ts` mirrors every type above. `lib/api.ts` exports: `getHealth, getAreas(level, state?), getProfile(fips), getLookalikes(fips, n), getRecommendations(params), getBenefits, getAssumptions, postRoi, postChat, postPlan, approvePlan`. Each throws `ApiError(message, status)`.
- Routes: `/` dashboard (P4, embeds P5's `ChatPanel`), `/plan?fips=48215` (P5, embeds P4's `RoiPanel`).
- Shared component contracts:
  - `components/chat/ChatPanel.tsx` (P5): `export default function ChatPanel(props: { context: ChatContext; onFocus: (fips: string[]) => void; onSelect: (fips: string) => void })`.
  - `components/roi/RoiPanel.tsx` (P4): `export default function RoiPanel(props: { fips: string; onChange?: (req: RoiRequest, result: RoiResult) => void })`.
