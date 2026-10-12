You are my pair programmer for the LEAD ASPIRE build. Read CLAUDE.md and CONTRACTS.md in the repo root first; they are the source of truth. I am **P2 (Sahaj): the frustration layer**, on branch `p2-frustration`. I own `data/frustration/**` and write exactly one output file: `backend/app/data/frustration.json`. I never edit anything else.

## Goal
Turn CFPB consumer complaints into a frustration score, a top frustration and a matched benefit for every US state and county, using a Microsoft Foundry model for topic + intensity. This is the "voice of the customer" layer the judges will remember. Output must match CONTRACTS.md section 1 `frustration.json` exactly.

## Structure
```
data/frustration/
  requirements.txt     # requests, pandas, openai>=1.40, python-dotenv, tenacity
  README.md            # sources, topic mapping, rubric, scoring, limits, classification stats
  topics.py            # the 6 topic ids + definitions + intensity rubric (single source)
  fetch_cfpb.py        # complaints -> raw/complaints.parquet (or csv)
  fetch_crosswalk.py   # ZIP -> county
  map_issues.py        # CFPB Issue/Sub-issue -> topic (rule mapping, all complaints)
  classify.py          # Foundry topic + intensity on a narrative sample -> raw/classified.jsonl (resumable)
  score.py             # aggregates, shrinkage, pain scores, frustration score -> backend/app/data/frustration.json
  validate.py
  make_demo_frustration.py  # synthetic fallback, same schema, is_demo_data: true
  raw/                 # gitignored
```

## Data
- **CFPB Consumer Complaint Database API**: `https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/`. Read the field reference first (cfpb.github.io/api/ccdb) and verify parameter names against a real response. Filter: products "Checking or savings account", "Prepaid card", "Money transfer, virtual currency, or money service"; `date_received` in the last 24 months. Fields: complaint_id, date_received, product, sub_product, issue, sub_issue, state, zip_code, consumer_complaint_narrative. Page through results politely (sleep between pages, retry on 429/5xx). If the API is too slow, the bulk CSV at files.consumerfinance.gov is the fallback, but it is large: tell me before downloading it.
- **ZIP -> county**: Census 2020 ZCTA-to-county relationship file (www2.census.gov). Assign each ZIP to the county holding the largest share of its population. CFPB masks some ZIPs (e.g. "123XX"); those count at state level only.
- **Population** for per-100k rates: from P1's `backend/app/data/areas.json` (`population`) once it's pushed (~1:00). Before that, pull ACS `B01003_001E` for states and counties yourself (same endpoint P1 uses), no other ACS variables.
- Drop complaints with no state. Keep DC; drop territories.

## Topics (exact ids)
`fees` (overdraft, NSF, monthly, minimum-balance, ATM fees) · `fraud_scams` (unauthorized charges, payment-app scams, identity theft, account takeover) · `transfers` (sending money, transfer fees, exchange rates, held/delayed transfers) · `account_closed` (closed or frozen without notice, denied for past history, funds held after closure) · `customer_service` (can't reach anyone, unresolved disputes, passed between agents) · `distrust` (believes the institution acts in bad faith, fears losing money, won't bank again).

1. `map_issues.py`: map every distinct (product, issue, sub_issue) combination to one topic. Print the full combination list with counts first, write the mapping as a reviewable table in `README.md`. Anything ambiguous -> the closest topic, note it. This gives a topic for **every** complaint, no AI needed.
2. `classify.py` (Foundry, `gpt-5-mini`, keys from `backend/.env`):
   ```python
   from openai import OpenAI
   client = OpenAI(base_url=AZURE_OPENAI_ENDPOINT, api_key=AZURE_OPENAI_API_KEY, timeout=60, max_retries=2)
   client.chat.completions.create(model=AZURE_OPENAI_DEPLOYMENT, messages=[...], max_completion_tokens=2000)
   ```
   gpt-5-mini is a reasoning model: no `temperature`. Start with a 3-narrative smoke test.
   - Batch 10 narratives per call, each truncated to 1,200 characters. Ask for strict JSON: `[{"complaint_id", "topics": [...], "primary_topic", "intensity": 1-5}]`. Rubric: 1 = mild annoyance ... 5 = lost money needed for rent or food, or felt deceived. Every complaint is negative, so intensity measures severity, not direction.
   - Do NOT ask for or store the narrative's language or anything about the person.
   - Sample: up to 25 narratives per state (stratified random), then up to 40 more for each of the 40 counties with the highest P1 exclusion index that have >= 30 complaints (if `areas.json` isn't in yet, use the 40 counties with the most complaints). Target ~2,000 narratives max. Concurrency 4, exponential backoff on 429, append each result to `raw/classified.jsonl` so a crash can resume.
   - Quality check: `topic_agreement` = share where the model's `primary_topic` equals the Issue-mapped topic. Also hand-check 30 random results yourself and note the result in README. If agreement < 0.6, show me the confusion table before scoring.
3. `score.py`: everything in CONTRACTS.md "Rules (P2 implements)": per-100k rate, shrunk shares with the 30-complaint prior, intensity source fallback (area >= 10 classified -> state -> national), topic intensity (area topic >= 5 classified, else area mean), pain scores, top/second topic, lead, clear_lead (>= 1.15), frustration_score percentile within level only if complaints >= 30, status ok / low_data / no_data.
   - Excerpts: up to 3 per area from classified narratives on its top topic, highest intensity first, trimmed to 40 words, CFPB's "XXXX" replaced with "[redacted]", **skip any containing a banned term** from CLAUDE.md, skip anything with dollar amounts over $10,000 or names.
4. `validate.py`: schema + types, shares sum to ~1, scores in [0,100] or null exactly when complaints < 30, every fips is a valid 2/5-digit code, banned-term scan over all excerpts, print national topic mix, top 10 states and counties by frustration score, and Hidalgo (48215) and Texas (48) detail.

## Fallback (never block the team)
Write `make_demo_frustration.py` in the first 20 minutes: plausible values for all states and ~300 counties (fips from P1's fixtures or a Census county list), mix of ok / low_data, `is_demo_data: true`. Push it as `frustration.json` early so P1 and P4 see a real-shaped layer. Real data overwrites it later.

## Order of work
1. (0:00-0:20) topics.py, demo fallback pushed. Foundry smoke test with 3 narratives.
2. (0:20-0:50) fetch CFPB + crosswalk, issue mapping reviewed.
3. (0:50-1:20) classification running in the background (resumable); meanwhile build score.py on the mapped topics.
4. (1:20-1:30) score + validate on whatever is classified so far, push real `frustration.json` before the checkpoint. Let classification finish after, rescore, push again before 2:15.
5. README with the numbers judges will ask about: complaints used, narratives classified, topic agreement, hand-check result, share of counties with a score, known biases (complainants skew banked and online; we never rely on CFPB alone, exclusion is the base layer).

Pitch moment you own: "how we turned 200k+ complaints into a frustration map with Foundry, and how we checked the model."

Commit after each step. Ask me before downloading anything over 500 MB or changing a contract.
