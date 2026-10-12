# Navigator API (P1 core)

FastAPI on :8000. Serves the exclusion layer, merges P2's frustration layer, and computes recommendations, look-alikes and ROI. Contracts: `../CONTRACTS.md`.

```bash
cd backend
pip install -r requirements.txt
cp ../.env.example .env      # only needed for P3's AI routes
uvicorn app.main:app --reload --port 8000
pytest -q
```
Open http://localhost:8000/docs.

## Data
`app/store.py` loads `app/data/{areas,benchmarks,frustration}.json` at startup. Each file falls back to `app/fixtures/` on its own (3 states, 12 counties, `is_demo_data: true`). `/api/health` reports which source each layer uses. Rebuild areas with `data/exclusion/` (see its README).

## Endpoints
| Path | What |
|---|---|
| `GET /api/health` | status, data source per layer, whether AI keys are set |
| `GET /api/areas?level=state\|county&state=48` | map summaries with `priority_score` |
| `GET /api/areas/{fips}` | full profile: area, frustration, benefit, 5 look-alikes, labels |
| `GET /api/areas/{fips}/lookalikes?n=5` | nearest areas 150 km or more away |
| `GET /api/recommendations?level=&state=&topic=&limit=` | ranked pilot areas (frustration status ok only) |
| `GET /api/benefits`, `GET /api/assumptions` | benefit catalog, ROI benchmarks |
| `POST /api/roi` | unit economics, program totals, LTV curve, county to global scale |

P3's `chat` and `plan` routers are included automatically once `app/routers/chat.py` and `plan.py` exist.

## Logic
- `priority_score = 0.5 x exclusion_index + 0.5 x frustration_score` (null without a score).
- Topic recommendations: `0.5 x exclusion_index + 0.5 x` percentile of that topic's pain score within the level.
- Look-alikes: z-scored [poverty, no internet, inverse income, inverse branches per 10k, exclusion index, 6 topic shares], euclidean distance, at least 150 km (haversine), `similarity = 1 / (1 + d)`.
- ROI: exact math from CONTRACTS.md in `app/services/roi.py`, whole dollars only at output. Network volume is spend on Mastercard's network, not Mastercard revenue.

Errors are always `{"detail": "message"}`. Unknown fips is 404, bad input is 422, and any crash is a plain 500 with no stack trace. Logs show method, path, status and ms only.
