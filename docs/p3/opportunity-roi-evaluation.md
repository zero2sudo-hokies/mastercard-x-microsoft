# Opportunity and issuer benchmark evaluation

Use the new files as the sourced audience and issuer-reference inputs for the ROI panel. Their arithmetic is correct and improves the earlier market-sizing inputs by separating stated account interest from the overall unbanked audience. They still do not measure acquisition, activation, incremental account margins or pilot ROI. The attached inputs were inspected without modification.

`roi-inputs.json` packages all 51 state rows, 260 metro rows and two bank asset buckets. It retains source `_thousands` fields and provides normalized `_households` fields, records the survey year and independently verified bank reporting quarter, and leaves all financial scenario assumptions and ROI results null.

## Verification

All 612 state and 3,120 metro numeric cells checked reproduced from the FDIC 2023 household file. All 14 bank benchmark metrics reproduced from the live official API for June 30, 2026. Of 4,313 bank records returned, 17 missing the income/expense fields were excluded, leaving 4,137 banks below $10 billion in assets and 159 at/above it.

The official [FDIC field definitions](https://api.fdic.gov/banks/docs/risview_properties.yaml) identify `INTINCA`, `EINTEXPA`, `ISERCHGA` and `NONIXA` as annual measures. They do not need another multiplication by four. The source CSV lacked quarter/exclusion metadata; the packet now records the verified quarter and coverage.

## New York audience evidence

| Measure | Weighted household estimate | Respondents supporting the subset |
|---|---:|---:|
| Unbanked | 417,844 | 52 |
| Very/somewhat interested in an account | 139,497 | 18 |
| Interested and previously banked | 84,069 | 10 |
| Very interested | 83,508 | 10 |

The stated interest share is 33.3848% of unbanked households. It is not an adoption rate for a named partner, no-fee account or card. Previously banked and very-interested groups overlap within the interested audience. The omitted not-very-interested category means interested plus not-at-all-interested is not a complete partition.

Confidence intervals are not supplied. Small-subset warnings and sample counts must accompany the estimates. Syracuse and Rochester each report 100% interest based on one unbanked respondent; do not rank them as certain high-conversion markets. The New York–Newark–Jersey City metro spans NY, NJ and PA, and cannot be treated as a New York county or a NY-only audience.

A county's interested audience is not observed in these files. If a state interest share is applied to county-modeled unbanked households, that is a separate modeling assumption and must be labeled and sensitivity-tested. Do not apply it to all underbanked households, who already have an account and were not the interest question's population. Preserve the earlier discrepancy between county modeled totals and state FDIC household estimates rather than forcing them to reconcile silently.

## Bank benchmark interpretation

| Annual whole-bank ratio | Below $10B assets | At/above $10B assets |
|---|---:|---:|
| Net interest income per $1,000 deposits | $43.31 | $36.62 |
| Deposit-account fees per $1,000 deposits | $1.53 | $1.81 |
| All noninterest expense per $1,000 deposits | $35.83 | $30.77 |

These are aggregated portfolio ratios. Whole-bank net interest income includes lending/investment activity and funding other than deposits; expense includes business lines beyond checking-account servicing. Fifty-seven retained records have zero deposits but still contribute income/cost numerators. The asset-weighted average of bank NIM percentages is not an aggregate industry NIM, whose source definition uses average earning assets.

Consequently, do not automatically set account deposit margin to 4.331% or 3.662%, treat operating expense ratios as account servicing costs, or subtract the ratios to claim new-account profit. Do not add an overlapping lending margin to a whole-bank NII proxy. Deposit fee averages also do not establish fee revenue for a no-fee offer.

Label the groups as asset buckets rather than FDIC-defined community/noncommunity banks. FDIC's community-bank classification uses additional characteristics. [FDIC explanation](https://www.fdic.gov/news/speeches/2022/spsep2822.html). Regulation II exemption uses an issuer's assets together with affiliates and preceding year-end information, not the current bank-only asset split; use a verified issuer exemption status before selecting interchange assumptions. [Federal Reserve guidance](https://www.federalreserve.gov/paymentsystems/regii-interchange-fee-standards.htm).

## Financial scenario model

Keep separate audience bases: all unbanked, stated-interested unbanked, and underbanked product adoption. They are alternative or disjoint cohort definitions, not totals to add indiscriminately. One account per converting household is an explicit prototype assumption, not measured behavior.

```text
acquired_accounts = audience_households × partner_reach
                    × conversion_among_reached × accounts_per_household
active_accounts = acquired_accounts × activation

annual_contribution_per_active_account =
    transactions_per_month × 12 × net_issuer_revenue_per_transaction
  + average_balance × net_incremental_deposit_margin
  + supported_product_fee_revenue
  − servicing − fraud − benefits

year_1_incremental_net =
    active_account_years × annual_contribution_per_active_account
  − inactive_account_years × inactive_account_cost
  − acquired_accounts × acquisition_cost
  − fixed_program_cost
```

Use explicit account-year exposure for phased enrollment, not a full year of revenue for every acquired account. For a no-fee product, set relevant product fee revenue to zero. Account servicing, incremental funding benefit, transaction behavior and risk costs require partner data or clearly labeled scenario assumptions; they are not supplied by the aggregate bank table.

For multiple years, calculate retained active cohorts and cash flows with defined churn, subsequent acquisition if applicable and a discount rate. Report NPV, payback and an explicitly defined investment-return denominator/horizon. Keep Mastercard network spend and any net-yield revenue estimate separate from issuer economics.

## Implementation changes

The frontend plan now includes `roi-inputs.json`, a survey-opportunity context panel, a whole-bank benchmark reference panel and an independently usable issuer scenario calculator. The opportunity heatmap stays on its county modeled metrics. Financial outputs remain unavailable until required inputs are populated; the app can show source context immediately. This update was prepared locally and has not been pushed to GitHub.

The pasted `API = https://...` line is not valid Python without quotes. Preserve a runnable version and include reporting date, excluded-bank counts, numeric/denominator validation and API completeness checks in any refresh implementation.
