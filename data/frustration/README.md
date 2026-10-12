# Frustration layer: New York pilot (CFPB complaints)

Builds `backend/app/data/frustration.json` (CONTRACTS.md section 1 shape) for New York, the pilot-first state from `data/p3/`.

```bash
cd data/frustration
pip install -r requirements.txt
python build_ny.py      # fetch is cached in raw/ (gitignored); a rerun only rescores
```

## Sources
- **CFPB Consumer Complaint Database API**, https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/ . Products: Checking or savings account, Prepaid card, Money transfer / virtual currency / money service. Received Aug 1 2024 to Jul 31 2026 (the target window in `data/p3/README.md`). 20,811 NY complaints. The API ignores page offsets, so any date range over 1,000 complaints is split in half until it fits.
- **National baseline**: the same products and window, all states, from the API's issue and sub-issue aggregations (288k complaints).
- **ZIP to county**: Census 2020 ZCTA to county relationship file. Same rule as `data/p3`: an exact 5-digit ZIP is read as a ZCTA and kept only if that ZCTA sits in exactly one county nationally. 17,244 complaints mapped. 2,639 had masked or missing ZIPs and 928 were multi-county or outside NY; both still count at state level.
- **Population** for per-100k rates: `backend/app/data/areas.json` (ACS 5-year 2020-2024).

## Method
- **Topic** for every complaint from CFPB's own `issue` and `sub_issue` fields, by rules in `topic_of()` (first match wins): fraud_scams (unauthorized, fraud, scam, identity theft, opened without consent, company charging your account) → fees (fee, overdraft, interest) → distrust (advertising, misleading, privacy, threats) → account_closed (closing, frozen, opening or unable to open, accessing account) → transfers (transfers, funds not available or disbursed, payments, deposits and withdrawals, wallets) → otherwise customer_service. The same rules map the national baseline. `raw/topic_mapping.csv` lists every issue and sub-issue pair with its topic and NY count for review.
- **Shares** shrunk toward national: `(n_t + 30 x national_t) / (n + 30)`.
- **Pain** = topic share / national share. A topic needs 5 or more complaints in the county to be the top topic. `clear_lead` = top pain / second pain ≥ 1.15.
- **Frustration score** = percentile of complaints per 100k residents among NY counties with 30 or more complaints. Status: ok (30+), low_data (1-29), no_data (0).

## Limits (say these out loud)
- **No intensity yet.** The public API does not return complaint narratives for this window, so the Foundry topic and intensity classification in the original plan could not run. `mean_intensity` is null and pain is share vs national only. The score measures complaint volume, not severity.
- **NY only.** Other states show "not enough data" on the frustration layer.
- Complainants skew toward banked, online consumers, which is why exclusion (FDIC + ACS) is the base layer.
- ZIPs approximate ZCTAs, so county assignment is approximate. Multi-county ZIPs are excluded, not split.

## Results (this build)
55 NY counties have complaints and 21 have 30 or more. NY top topics: transfers 6 counties, account closures 5, fraud and scams 4, customer service 3, distrust 2, fees 1. Highest complaint rates: New York County (163 per 100k), Kings (158), Bronx (151), Queens (124).
