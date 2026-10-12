You are my pair programmer for the LEAD ASPIRE build. Read CLAUDE.md and CONTRACTS.md in the repo root first; they are the source of truth. I am **P1: exclusion data + core API**, on branch `p1-core`. I own `data/exclusion/**` and `backend/**` EXCEPT P2's `data/frustration/**` + `backend/app/data/frustration.json` and P3's `backend/app/ai/**`, `backend/app/routers/chat.py`, `backend/app/routers/plan.py`, `backend/tests/test_ai.py`. Never create or edit those.

## Goal
1. **First 30 minutes:** a running FastAPI app on :8000 serving every P1 endpoint in CONTRACTS.md from **fixtures**, so P3, P4 and P5 are unblocked. Push and tell the team "API stubs live".
2. Then the real **exclusion layer** (`areas.json`) and **benchmarks** (`benchmarks.json`) for all US states and counties.
3. Then the real logic: merging P2's `frustration.json`, recommendations, look-alikes, ROI.

## Backend structure
```
backend/
  requirements.txt     # fastapi, uvicorn[standard], pydantic>=2, python-dotenv, openai>=1.40, httpx, numpy, pytest
  app/
    main.py            # app, CORS http://localhost:3000, request logging (method, path, status, ms), global 500 handler {"detail":"Something went wrong"}, routers
    config.py          # settings from backend/.env: azure_openai_endpoint, azure_openai_api_key, azure_openai_deployment (default gpt-5-mini), ai_configured, api_base (default http://localhost:8000)
    models.py          # pydantic models for every contract type
    store.py           # loads areas.json, benchmarks.json, frustration.json at startup; each falls back to fixtures/ independently; exposes data_source per file
    services/merge.py      # AreaSummary / AreaProfile building, priority_score
    services/recommend.py  # recommendations, topic mode
    services/lookalikes.py # nearest neighbours with >= 150 km rule (haversine on centroids)
    services/roi.py        # pure compute_roi(area, state_hh, benchmarks, req) -> RoiResult
    services/benefits.py   # the fixed 6-benefit catalog from CONTRACTS.md
    routers/areas.py  routers/recommend.py  routers/roi.py  routers/meta.py (health, benefits, assumptions)
    fixtures/          # areas.json (3 states incl. TX, ~12 counties incl. 48215), frustration.json (same areas, mix of ok / low_data), benchmarks.json (real values). is_demo_data: true
  tests/  test_roi.py  test_recommend.py  test_api.py
```
P3's routers: include defensively so the app runs before P3 merges:
```python
for name in ("chat", "plan"):
    try:
        module = __import__(f"app.routers.{name}", fromlist=["router"])
        app.include_router(module.router)
    except ImportError:
        pass  # P3 not merged yet
```
Keep `app.config.settings` and `app.models` names stable; P3 may import them.

## Exclusion pipeline (`data/exclusion/`)
```
data/exclusion/
  requirements.txt  README.md
  fetch.py      # ACS, FDIC branches, FDIC state rates, Gazetteer -> data/exclusion/raw/ (gitignored)
  build.py      # writes backend/app/data/areas.json + benchmarks.json, then runs validate
  validate.py
```
Sources (no keys needed at this volume; check real field names in each response before relying on them):
- **ACS 5-year** `https://api.census.gov/data/{year}/acs/acs5` (try 2024, fall back to 2023): `for=state:*` and `for=county:*&in=state:*`. Variables: `B01003_001E` population, `B11001_001E` households, `B19013_001E` median income (negative sentinels -> null), `B17001_001E`/`_002E` poverty, `B28002_001E`/`_013E` no internet. Verify labels at `/variables/<VAR>.json`. **Forbidden:** foreign-born, nativity, citizenship, language/limited-English, race, ethnicity tables.
- **FDIC branches** `https://api.fdic.gov/banks/locations?fields=UNINUM,STCNTYBR,STALP&limit=10000&offset=N&format=json`, page through all US branches, count per county FIPS -> `branches`, `branches_per_10k_hh`.
- **FDIC 2023 state unbanked + underbanked rates**: find the 2023 FDIC survey's state-level estimates (economicinclusion.gov / fdic.gov household survey appendix tables). If you can't get a machine-readable state table in ~20 minutes, use national 4.2% unbanked and 14.2% underbanked scaled by state poverty / national poverty, and mark `"fdic_state_rates": "modeled"` in `sources`. Tell me which path you took.
- **Census Gazetteer** counties file (latest year) for county centroids `[lat, lng]`; states centroid = household-weighted mean of its counties.
- Exclusion index, underserved rate and est. households exactly as CONTRACTS.md section 1. Drop counties with 0/null households. Puerto Rico and territories out.
- `benchmarks.json`: copy the values in CONTRACTS.md exactly (they are Sahaj's input table).
- validate.py: schema + types, rates in [0,1], index in [0,100], unique FIPS, forbidden-key scan (immigra, citizen, foreign, nativ, language, english, race, ethnic, hispanic), prints top 10 states and counties by exclusion and where Texas / Hidalgo (48215) land.

## Service logic (exact, from CONTRACTS.md)
- `AreaSummary.priority_score` = 0.5 × exclusion + 0.5 × frustration_score, null without a score. Missing frustration entry = `frustration_status: "no_data"`.
- Recommendations: only `frustration_status == "ok"`; topic mode uses percentile of that topic's pain within the level; `reasons` = 2-3 short plain sentences built from the numbers (e.g. "Exclusion index 91 (top 9% of US counties)", "Transfers pain 1.12x national", "412 complaints in 24 months"). Never mention protected attributes.
- Look-alikes: standardize features across eligible counties, euclidean distance, exclude < 150 km and itself, `similarity = 1/(1+d)`.
- ROI: implement the math exactly. Unit test with the worked example: Hidalgo with 97,000 households, community, defaults -> annual_margin ≈ 68.89, ltv ≈ 172.23, breakeven_churn 0.161, accounts 2910, issuer_net_lifetime -819,279, network_volume_y1 43,154,136. Large bank annual_margin ≈ -272.34, breakeven null.
- Validation: unknown fips 404; `adoption_rate` and `churn` in (0,1]; money >= 0; issuer_type enum. `/api/areas?level=` must be state|county.
- Performance: precompute summaries, recommendations base and look-alike features at startup; every GET under 100 ms.

## Order of work
1. (0:00-0:30) requirements, config, models, fixtures, store, all routes on fixtures, CORS, health. `uvicorn app.main:app --reload --port 8000` from `backend/`, check `/docs`. Commit + push.
2. (0:30-1:00) exclusion pipeline -> real `areas.json` + `benchmarks.json`, validate passes. Commit + push, tell P2 "areas.json is in" (Sahaj uses population from it).
3. (1:00-1:30) ROI, recommendations, look-alikes with tests green. Merge-ready by the 1:30 checkpoint.
4. After checkpoint: pull P2's `frustration.json`, confirm `data_source` shows pipeline for both, sanity-check top 10 recommendations with Sahaj, fix integration bugs. Write `backend/README.md` and `data/exclusion/README.md` (sources with URLs, ACS year, measures, formulas, limits).

Commit after each step. Ask me before changing any contract shape.
