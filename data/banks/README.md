# Bank partner leaderboard (FDIC)

Builds `backend/app/data/banks.json`: the top 10 FDIC-insured banks in every county and state, for the area profile leaderboard, the bank comparison and the target-bank pilot pitch.

```bash
cd data/banks
pip install -r requirements.txt
python build_banks.py     # fetch cached in raw/ (gitignored)
```

## Sources
- **FDIC Summary of Deposits 2026** (as of June 30, 2026), https://api.fdic.gov/banks/sod : every insured branch with its deposits. 75,859 branches.
- **FDIC call reports, Q2 2026**, https://api.fdic.gov/banks/financials : per-bank net interest margin, efficiency ratio, return on assets.

## Method
- Banks ranked by deposits held at their branches in the area. Share = bank deposits / all insured deposits in the area. States add up every branch in the state.
- Debit pricing tier from bank-level total assets: under $10B = exempt from the Regulation II cap (the ROI's "community" tier), else covered ("large bank").

## Limits
- Deposits are a proxy for customers; no public source counts customers by county.
- Banks can book online or headquarters deposits at one branch (for example Goldman Sachs and BNY Mellon in New York state), inflating their share there. Branch counts show local reach.
- Credit unions (NCUA) are not included.
- Regulation II exemption uses consolidated (holding company) assets; confirm the tier with the issuer.
- Card network (Mastercard or other) per bank is not public.
- Call-report ratios are whole-bank figures, shown as context only; they never feed the ROI math.

Bank logos use official website addresses (`WEBADDR`) from the FDIC BankFind `institutions` endpoint, matched by `CERT`. The pipeline caches active institutions' websites in `raw/websites.json`; delete that cache to refresh them. Missing websites remain null and the frontend shows initials. Financial and deposit figures keep their original reporting dates.
