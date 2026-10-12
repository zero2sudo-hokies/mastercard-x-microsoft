# Merged New York county data

`ny_county_pilot_data.csv` preserves the supplied 62 New York county persona rows and appends aggregated complaint-tone evidence. `ny_county_pilot_data.json` packages the same county data in a typed frontend shape, six aggregate persona reference profiles and source/method/coverage metadata. The input files were not modified.

The merge uses July 2026 complaints only. It is not the completed August 2024–July 2026 analysis and does not contain validated complaint topics or severity.

## Geography method

Exact five-digit CFPB ZIPs are interpreted as 2020 Census ZCTA proxies. Assign a county only when that ZCTA intersects exactly one county nationally and the county is one of the 62 NY records. Exclude multi-county ZCTAs and unmatched codes rather than allocating them by land area or inventing population weights. ZCTAs approximate postal ZIP areas, so the mapped county remains a geographic approximation.

Source crosswalk: [Census 2020 ZCTA–county relationship file](https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt). [Official explanation](https://www2.census.gov/geo/pdfs/maps-data/data/rel2020/zcta520/explanation_tab20_zcta520_county20_natl.pdf).

## Coverage reconciliation

| Stage | Complaints | Scored narratives |
|---|---:|---:|
| July NY selected products in raw archive | 865 | 194 |
| Exact five-digit ZIP preparation input | 768 | 160 |
| Assigned to one NY county using ZCTA proxy | 730 | 148 |
| Excluded after exact-ZIP matching | 38 | 12 |

Of the 38 exact-ZIP exclusions, 37 have multiple county candidates and one has no matching ZCTA. The raw archive also contains 97 selected NY complaints excluded before matching because the ZIP is missing/masked/other. No complaint was assigned to multiple counties. Weighted county sentiment means are calculated from complaint-level scores, not unweighted ZIP means.

All 62 county rows remain present. Thirty-one have mapped complaints: five have at least 30 mapped complaints and ten scored narratives; eight have some scored text below that screen; and 18 have complaints but no scored text. The other 31 have no mapped complaints. These are sample-coverage categories, not conclusions about consumer harm or statistical validity.

## Important field meanings

- Household and persona figures are modeled estimates from the supplied county file, not direct observed county FDIC rates; generation method, source year and uncertainty remain unknown.
- Sentiment is VADER 3.3.2 baseline tone, not Foundry-generated severity. `negative_share_of_scored` has scored narratives as its denominator, not households or residents.
- Zero complaint counts mean no complaints mapped in this snapshot, not no frustration. Means and shares are null/blank when there is no scored narrative.
- `frustration_score`, `priority_score`, `primary_complaint_topic`, `mean_frustration_intensity`, and `complaints_per_100k` remain null/blank because required inputs or validation are absent.
- Aggregate persona reference barriers are not county observations. Underbanked persona barrier fields are null in the frontend JSON where the source encodes unbanked-only items as zero; applicability needs source-code confirmation.
- The frontend JSON contains only selected financial-access persona fields. Removing other profile attributes does not verify which predictors generated the county estimates.

Checks completed: unique string FIPS; 62-row left join; complaint-ID uniqueness in the preparation input; count and scored-narrative reconciliation; label counts sum to narrative counts; null means/shares for no narratives; persona share/count preservation; and CSV/JSON agreement.
