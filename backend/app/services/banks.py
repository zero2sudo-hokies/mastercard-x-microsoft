"""Bank partner leaderboard and side-by-side ROI comparison, from the FDIC Summary of Deposits."""
from fastapi import HTTPException

from app.models import BankCompare, BankCompareRequest, BankCompareRow, BankEntry, BankLeaderboard, BranchPin, BranchPins, RoiRequest
from app.services.roi import compute_roi
from app.store import store

COMPARE_LABELS = [
    "Each bank's ROI uses its own debit pricing tier (interchange, servicing and acquisition benchmarks); other inputs are shared.",
    "Pilot accounts are the same for every bank: the area audience x adoption. The difference is the issuer's economics and branch reach.",
    "Which network a bank issues on (Mastercard or another) is not public; confirm before outreach.",
]


def _entry(rank: int, row: dict) -> BankEntry:
    inst = store.banks["institutions"][row["cert"]]
    return BankEntry(rank=rank, cert=row["cert"], name=inst["name"], website=inst.get("website"), deposits=row["deposits"], deposit_share=row["deposit_share"],
                     branches=row["branches"], total_assets=inst["total_assets"], issuer_type=inst["issuer_type"],
                     fdic_community_bank=inst["fdic_community_bank"], holding_company=inst.get("holding_company"),
                     hq_city=inst.get("hq_city"), hq_state=inst.get("hq_state"), specialization=inst.get("specialization"),
                     net_interest_margin=inst.get("net_interest_margin"), efficiency_ratio=inst.get("efficiency_ratio"),
                     return_on_assets=inst.get("return_on_assets"))


def leaderboard(fips: str, n: int = 10) -> BankLeaderboard:
    data = store.banks
    area = (data.get("areas") or {}).get(fips)
    labels = list(data.get("labels", []))
    if len(fips) == 2:
        labels.insert(0, "State totals add up every branch, so banks that book national deposits at one branch rank high; branch counts show local reach.")
    if not area:
        return BankLeaderboard(fips=fips, as_of=data.get("as_of"),
                               labels=["No FDIC-insured bank branches recorded in this area."] if data else ["Bank data not loaded."])
    return BankLeaderboard(fips=fips, as_of=data.get("as_of"), total_deposits=area["total_deposits"], banks_present=area["banks_present"],
                           banks=[_entry(i, b) for i, b in enumerate(area["banks"][:n], start=1)], labels=labels)


def branch_pins(fips: str) -> BranchPins:
    """Every insured branch in a county with coordinates, tagged with its bank's rank in the area's top 10."""
    rows = (store.branches.get("counties") or {}).get(fips, [])
    ranks = {b["cert"]: i for i, b in enumerate(((store.banks.get("areas") or {}).get(fips) or {}).get("banks", []), start=1)}
    names = store.banks.get("institutions") or {}
    return BranchPins(fips=fips, as_of=store.branches.get("as_of"), branches=[
        BranchPin(cert=c, bank=names.get(c, {}).get("name"), website=names.get(c, {}).get("website"), branch=b, lat=lat, lon=lon, rank=ranks.get(c))
        for c, lat, lon, b in rows])


def find_bank(fips: str, cert: str) -> BankEntry | None:
    area = (store.banks.get("areas") or {}).get(fips) or {}
    for i, row in enumerate(area.get("banks", []), start=1):
        if row["cert"] == cert:
            return _entry(i, row)
    return None


def compare(req: BankCompareRequest, audience: dict, state_hh: int) -> BankCompare:
    area = store.areas[req.fips]
    rows = []
    for cert in dict.fromkeys(req.certs):  # keep order, drop duplicates
        bank = find_bank(req.fips, cert)
        if not bank:
            raise HTTPException(404, f"Bank {cert} is not among the top banks in {area.name}")
        roi_req = RoiRequest(fips=req.fips, issuer_type=bank.issuer_type, adoption_rate=req.adoption_rate, churn=req.churn,
                             cac=req.cac, fixed_program_cost=req.fixed_program_cost, audience_basis=req.audience_basis)
        roi = compute_roi(area, state_hh, store.benchmarks, roi_req, audience)
        per_branch = round(area.est_underserved_hh / bank.branches) if bank.branches else None
        rows.append(BankCompareRow(bank=bank, underserved_households_per_branch=per_branch, roi=roi))
    name = f"{area.name}, {area.state_abbr}" if area.level == "county" else area.name
    return BankCompare(fips=req.fips, area_name=name, rows=rows, labels=COMPARE_LABELS + list(store.banks.get("labels", []))[:1])
