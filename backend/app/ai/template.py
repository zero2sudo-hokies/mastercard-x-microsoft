"""No-AI pilot plan: the same 10 sections filled from the facts."""
from app.ai.prompts import PLAN_FOOTER


def _pct(x, d=1):
    return "not available" if x is None else f"{x * 100:.{d}f}%"


def _usd(x):
    if x is None:
        return "not available"
    sign = "-" if x < 0 else ""
    x = abs(x)
    return f"{sign}${x / 1e6:.1f}M" if x >= 1e6 else f"{sign}${x:,.0f}"


def render(f: dict) -> str:
    name = f["area_name"]
    top = f.get("top_topic") or "not yet classified"
    benefit = f.get("benefit_title") or "a benefit to be chosen once complaint topics are classified"
    breakeven = _pct(f.get("breakeven_churn")) if f.get("breakeven_churn") is not None else "never (margin is negative)"
    looks = ", ".join(l["name"] for l in f.get("lookalikes", [])) or "look-alike areas to be selected"
    return f"""## Pilot program plan: {name}

## 1. Executive summary
{name} has an exclusion index of {f['exclusion_index']} (rank {f['exclusion_rank']}) and about {f['est_underserved_households_modeled']:,} underserved households (modeled). The top complaint frustration is {top}. We propose a 12-month pilot of {benefit} with {f.get('partner_name', 'a community issuer partner')}.

## 2. Why this area
- Poverty rate {_pct(f.get('poverty_rate'))}, no internet at home {_pct(f.get('no_internet_rate'))}, {f.get('branches_per_10k_households', 'n/a')} bank branches per 10k households.
- State FDIC rates: unbanked {_pct(f.get('state_fdic_unbanked_rate'))}, underbanked {_pct(f.get('state_fdic_underbanked_rate'))} (state-level).
- {f.get('complaints', 0):,} CFPB complaints, {f.get('complaints_per_100k', 'n/a')} per 100k residents; frustration score {f.get('frustration_score', 'not available')}.

## 3. What frustrates people here and the benefit
Top frustration: {top} (pain {f.get('top_topic_pain', 'n/a')}); second: {f.get('second_topic') or 'n/a'}. Matched benefit: {benefit}. {f.get('benefit_description', '')}
Pilot tracks: {f.get('benefit_pain_measure', 'target-topic complaints per 100k residents')}.

## 4. Offer design
A low-cost card account issued by the partner on Mastercard's network, built around {benefit}, with clear fees and fast dispute handling.

## 5. Outreach plan
Outreach only through trusted community organizations, with the issuer's compliance review of every message. No targeting by any protected attribute; eligibility and outreach follow economic access only.

## 6. Why Mastercard
Network reach, fraud tools and partner programs let a community issuer offer the benefit at low cost. Network volume is spend on Mastercard's network, not Mastercard revenue.

## 7. Economics and the two levers
{f['issuer_type'].replace('_', ' ')} issuer, adoption {_pct(f['adoption_rate_placeholder'])} (placeholder): {f['pilot_accounts_modeled']:,} accounts (modeled). Annual margin {_usd(f['annual_margin_per_account'])} per account, lifetime value {_usd(f['lifetime_value_per_account'])} at {_pct(f['yearly_churn'], 0)} churn, acquisition cost {_usd(f['acquisition_cost_per_account'])}. Breakeven churn: {breakeven}. Issuer net lifetime {_usd(f['issuer_net_lifetime_modeled'])} (modeled). Year 1 network volume {_usd(f['network_volume_year1_modeled'])} (modeled).
Levers: bring churn toward breakeven, and cut acquisition cost through partner-led onboarding.

## 8. Pilot design and success measures
Launch in {name}; compare with {looks}. 12-month baseline, 12-month pilot with a 6-month read, difference-in-differences.
Usage: new accounts per 1,000 adults, 90-day active, transactions per account per month vs 33.4, yearly churn vs breakeven. Pain: target-topic complaints per 100k vs look-alikes.
Read: usage up + pain down = scale; usage up + pain flat = rework benefit; usage flat + pain down = fix outreach; both flat = drop.

## 9. Risks and safeguards
Complaint data skews toward banked, online consumers. Household counts are modeled. Servicing cost is an older benchmark. Mastercard does not hold accounts, so an issuer partner is required.

## 10. Decision needed
Approve a partner search in {name} and a 12-month pilot budget, subject to compliance review.""" + PLAN_FOOTER
