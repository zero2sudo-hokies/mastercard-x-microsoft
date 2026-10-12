# Exclusion layer pipeline (P1)

Builds `backend/app/data/areas.json` (51 states incl. DC, 3,144 counties) and `backend/app/data/benchmarks.json`.

```bash
cd data/exclusion
pip install -r requirements.txt
python fetch.py     # downloads into raw/ (gitignored), about 350 MB streamed, no keys needed
python build.py     # writes areas.json + benchmarks.json, then runs validate.py
```

## Sources
| Input | Source | Notes |
|---|---|---|
| Population, households, median income, poverty, no internet | ACS 5-year 2020-2024 table-based summary files, https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/ | Tables B01003, B11001, B19013, B17001 (`_002` / `_001`), B28002 (`_013` / `_001`). The Census API now needs a key, so we read the keyless bulk files. Falls back to 2023 if 2024 is missing. Negative sentinels become `null`. |
| Area names, state abbreviations | ACS `Geos20245YR.txt` from the same folder | |
| Unbanked and underbanked rates by state | FDIC 2023 National Survey of Unbanked and Underbanked Households, appendix Table G.2, https://www.fdic.gov/household-survey | Real state estimates parsed from the PDF (not modeled). FDIC has no county data. |
| Bank branches | FDIC BankFind locations API, https://api.fdic.gov/banks/locations | All 78k US branches, counted by `STCNTY`. |
| County centroids | Census Gazetteer counties file (latest year), https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html | State centroid = household-weighted mean of its counties. |

Forbidden inputs (never pulled): foreign-born, nativity, citizenship, language, limited-English, race, ethnicity, religion.

## Formulas (CONTRACTS.md section 1)
- `poverty_rate = B17001_002 / B17001_001`, `no_internet_rate = B28002_013 / B28002_001`
- `branches_per_10k_hh = branches / households x 10,000`
- State `underserved_rate = unbanked + underbanked` (FDIC).
- County `underserved_rate = clamp(state underserved x county poverty / state poverty, 0.05, 0.60)`. **Modeled.** County unbanked and underbanked rates are the state's.
- `est_underserved_hh = round(households x underserved_rate)`
- `exclusion_index` = percentile (0-100 within level) of the mean z-score of:
  - states: unbanked, underbanked, poverty, no internet, inverse median income, inverse branches per 10k HH
  - counties: poverty, no internet, inverse median income, inverse branches per 10k HH, state FDIC underserved rate
  - null z = 0. `exclusion_rank` 1 = most excluded.

## Limits
- County unbanked and underbanked rates are state rates. County underserved share is modeled from poverty.
- Connecticut uses 2022 planning regions in ACS and FDIC data, which don't match the old county shapes in `us-atlas`, so CT shows no data on the map.
- Puerto Rico and territories are out. Counties with 0 households are dropped.
- ACS 5-year estimates carry margins of error, which are large for small counties.
