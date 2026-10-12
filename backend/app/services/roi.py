"""Pure ROI math from CONTRACTS.md. Full precision inside, whole dollars only at output."""
from app.models import LtvPoint, RoiArea, RoiAudience, RoiInputs, RoiProgram, RoiRequest, RoiResult, RoiUnit, ScaleRow

LABELS = [
    "Benchmarks from industry and Federal Reserve sources; rerun with the partner issuer's costs.",
    "Network volume is spend on Mastercard's network, not Mastercard revenue.",
]


AUDIENCE_LABEL = {
    "underserved": "Unbanked + underbanked households (modeled for counties from state FDIC rates and poverty).",
    "unbanked": "Unbanked households: FDIC 2023 for states; counties modeled as households x state unbanked rate.",
    "interested_unbanked": "Unbanked households interested in an account: FDIC 2023 stated interest, not a conversion rate. "
                           "Counties modeled with the state interest share.",
}


def compute_roi(area, state_hh: int, b: dict, req: RoiRequest, audience: dict | None = None) -> RoiResult:
    """area needs fips, name, state_abbr, est_underserved_hh. state_hh = underserved households in its state.
    audience (optional) = {"area": n, "state": n, "us": n} for req.audience_basis; default is the underserved basis."""
    t = req.issuer_type
    d = b["roi_defaults"]
    adoption = req.adoption_rate if req.adoption_rate is not None else d["adoption_rate"]
    churn = req.churn if req.churn is not None else b["churn_observed"][t]
    cac = req.cac if req.cac is not None else b["cac"][t]
    fixed = req.fixed_program_cost if req.fixed_program_cost is not None else d["fixed_program_cost"]
    yield_ = req.network_yield if req.network_yield is not None else b["network_yield_placeholder"]

    tx_year = b["transactions_per_month"] * 12
    annual_spend = tx_year * b["avg_ticket"]
    swipe = tx_year * b["interchange_per_tx"][t]
    deposit = b["avg_balance"] * b["deposit_margin"]
    fraud = annual_spend * b["fraud_rate"] * b["issuer_fraud_share"]
    servicing = b["servicing"][t]
    margin = swipe + deposit - fraud - servicing
    ltv = margin / churn
    net = ltv - cac

    aud = audience or {"area": area.est_underserved_hh, "state": state_hh, "us": b["us_underserved_hh"]}
    accounts = round(aud["area"] * adoption)
    volume = accounts * annual_spend

    def scale(level, base, unit):
        n = round(base * adoption)
        return ScaleRow(level=level, base=base, unit=unit, accounts=n, network_volume_y1=round(n * annual_spend))

    return RoiResult(
        area=RoiArea(fips=area.fips, name=area.name, state_abbr=area.state_abbr, est_underserved_hh=area.est_underserved_hh),
        inputs=RoiInputs(issuer_type=t, adoption_rate=adoption, churn=churn, cac=cac, fixed_program_cost=fixed,
                         network_yield=yield_, audience_basis=req.audience_basis),
        unit=RoiUnit(
            annual_spend=round(annual_spend), swipe_revenue=round(swipe), deposit_earnings=round(deposit),
            fraud_loss=round(fraud), servicing=round(servicing), annual_margin=round(margin), ltv=round(ltv),
            net_per_account=round(net), breakeven_churn=round(margin / cac, 3) if margin > 0 and cac > 0 else None,
        ),
        program=RoiProgram(
            accounts=accounts, issuer_net_lifetime=round(accounts * net - fixed),
            network_volume_y1=round(volume), network_revenue_y1_est=round(volume * yield_),
        ),
        ltv_curve=[LtvPoint(churn=c, ltv=round(margin / c)) for c in (round(0.10 + i / 100, 2) for i in range(36))],
        scale=[
            scale("County" if len(area.fips) == 5 else "State", aud["area"], "households"),
            *([scale("State", aud["state"], "households")] if len(area.fips) == 5 else []),
            scale("United States", aud["us"], "households"),
            # global base is unbanked adults, not "interested", so skip it for that basis
            *([scale("Global", b["global_unbanked_adults"], "adults")] if req.audience_basis != "interested_unbanked" else []),
        ],
        labels=LABELS,
        audience=RoiAudience(basis=req.audience_basis, area_households=aud["area"], label=AUDIENCE_LABEL[req.audience_basis]),
    )


def audience_bases(area, state_row: dict | None, all_states: list[dict], state_hh: int, b: dict) -> dict[str, dict]:
    """Households per basis for the area, its state and the US. County unbanked/interested counts are modeled
    from state FDIC rates; state and US counts come straight from the FDIC 2023 survey rows (data/p3)."""
    bases = {"underserved": {"area": area.est_underserved_hh, "state": state_hh, "us": b["us_underserved_hh"]}}
    if not state_row:
        return bases
    share = state_row.get("interested_share_of_unbanked")
    is_state = len(area.fips) == 2
    unbanked = round(state_row["unbanked_households"]) if is_state else round(area.households * (area.unbanked_rate or 0))
    bases["unbanked"] = {"area": unbanked, "state": round(state_row["unbanked_households"]),
                         "us": round(sum(r["unbanked_households"] for r in all_states))}
    if share is not None and state_row.get("interested_unbanked_households") is not None:
        bases["interested_unbanked"] = {
            "area": round(state_row["interested_unbanked_households"]) if is_state else round(unbanked * share),
            "state": round(state_row["interested_unbanked_households"]),
            "us": round(sum(r["interested_unbanked_households"] or 0 for r in all_states)),
        }
    return bases
