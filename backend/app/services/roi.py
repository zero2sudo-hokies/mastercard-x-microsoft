"""Pure ROI math from CONTRACTS.md. Full precision inside, whole dollars only at output."""
from app.models import RoiArea, RoiInputs, RoiProgram, RoiRequest, RoiResult, RoiUnit, ScaleRow, LtvPoint

LABELS = [
    "Benchmarks from industry and Federal Reserve sources; rerun with the partner issuer's costs.",
    "Network volume is spend on Mastercard's network, not Mastercard revenue.",
]


def compute_roi(area, state_hh: int, b: dict, req: RoiRequest) -> RoiResult:
    """area needs fips, name, state_abbr, est_underserved_hh. state_hh = underserved households in its state."""
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

    accounts = round(area.est_underserved_hh * adoption)
    volume = accounts * annual_spend

    def scale(level, base, unit):
        n = round(base * adoption)
        return ScaleRow(level=level, base=base, unit=unit, accounts=n, network_volume_y1=round(n * annual_spend))

    return RoiResult(
        area=RoiArea(fips=area.fips, name=area.name, state_abbr=area.state_abbr, est_underserved_hh=area.est_underserved_hh),
        inputs=RoiInputs(issuer_type=t, adoption_rate=adoption, churn=churn, cac=cac, fixed_program_cost=fixed, network_yield=yield_),
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
            scale("County" if len(area.fips) == 5 else "State", area.est_underserved_hh, "households"),
            *([scale("State", state_hh, "households")] if len(area.fips) == 5 else []),
            scale("United States", b["us_underserved_hh"], "households"),
            scale("Global", b["global_unbanked_adults"], "adults"),
        ],
        labels=LABELS,
    )
