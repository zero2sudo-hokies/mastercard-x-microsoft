"""Build backend/app/data/areas.json and benchmarks.json from data/exclusion/raw/, then validate.

Formulas follow CONTRACTS.md section 1. Inputs are economic access only:
no foreign-born, nativity, citizenship, language, race, ethnicity or religion tables.
"""
import csv
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
RAW = HERE / "raw"
OUT = HERE.parent.parent / "backend" / "app" / "data"

BENCHMARKS = {
    "transactions_per_month": 33.4, "avg_ticket": 37,
    "interchange_per_tx": {"community": 0.52, "large_bank": 0.23},
    "avg_balance": 1273, "deposit_margin": 0.0332,
    "fraud_rate": 0.00176, "issuer_fraud_share": 0.26,
    "servicing": {"community": 175, "large_bank": 400},
    "cac": {"community": 428, "large_bank": 561},
    "churn_observed": {"community": 0.40, "large_bank": 0.24},
    "network_yield_placeholder": 0.0029,
    "us_underserved_hh": 24600000, "global_unbanked_adults": 1300000000,
    "roi_defaults": {"issuer_type": "community", "adoption_rate": 0.03, "fixed_program_cost": 75000},
    "notes": {
        "network_yield_placeholder": "Approximate: Mastercard net revenue / gross dollar volume. Verify before quoting.",
        "adoption_rate": "Placeholder; the pilot replaces it.",
        "fixed_program_cost": "Placeholder; the pilot replaces it.",
        "servicing": "Older benchmark; rerun with partner issuer costs.",
    },
}


def read_psv(path):
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter="|"))


def num(v):
    """ACS estimate -> float, or None for blanks and negative sentinels (-666666666 etc)."""
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return None if x < 0 else x


def ratio(a, b):
    return a / b if a is not None and b else None


def load_acs():
    """GEO_ID -> {var: value} for every state and county row across the five tables."""
    acs = {}
    for t in ["b01003", "b11001", "b19013", "b17001", "b28002"]:
        for row in read_psv(RAW / f"acs_{t}.psv"):
            acs.setdefault(row["GEO_ID"], {}).update(row)
    return acs


def zscores(values):
    """Standardize, with nulls -> z = 0."""
    arr = np.array([np.nan if v is None else v for v in values], dtype=float)
    mean, std = np.nanmean(arr), np.nanstd(arr)
    z = (arr - mean) / std if std else np.zeros_like(arr)
    return np.nan_to_num(z, nan=0.0)


def percentile_rank(scores):
    """0-100 percentile within the list (100 = highest score) and rank (1 = highest)."""
    scores = np.asarray(scores, dtype=float)
    order = np.argsort(-scores, kind="stable")
    rank = np.empty(len(scores), dtype=int)
    rank[order] = np.arange(1, len(scores) + 1)
    pct = 100 * (len(scores) - rank) / max(len(scores) - 1, 1)
    return pct, rank


def add_index(areas, measures):
    """measures: list of (key, sign). Mean z-score -> exclusion_index percentile + exclusion_rank."""
    z = np.mean([sign * zscores([a[k] for a in areas]) for k, sign in measures], axis=0)
    pct, rank = percentile_rank(z)
    for a, p, r in zip(areas, pct, rank):
        a["exclusion_index"] = round(float(p), 1)
        a["exclusion_rank"] = int(r)


def r4(x):
    return None if x is None else round(x, 4)


def build():
    year = int((RAW / "acs_year.txt").read_text())
    acs = load_acs()
    geos = {g["GEO_ID"]: g for g in read_psv(RAW / "acs_geos.psv")}
    branches = json.loads((RAW / "fdic_branches.json").read_text())
    with open(RAW / "fdic_state_rates_2023.csv") as f:
        fdic = {r["state_abbr"]: r for r in csv.DictReader(f)}
    with open(RAW / "gazetteer_counties.txt", encoding="latin-1") as f:
        delim = "|" if "|" in f.readline() else "\t"  # 2025 file is pipe-delimited, older years tab
        f.seek(0)
        gaz = {r["GEOID"].strip(): r for r in csv.DictReader(f, delimiter=delim)}

    def base(geo_id, fips, level):
        v = acs[geo_id]
        g = geos[geo_id]
        hh = num(v.get("B11001_E001"))
        return {
            "fips": fips, "name": g["NAME"].rsplit(", ", 1)[0] if level == "county" else g["NAME"], "level": level,
            "state_fips": fips[:2], "state_abbr": g["STUSAB"],
            "population": int(num(v.get("B01003_E001")) or 0), "households": int(hh or 0),
            "median_income": num(v.get("B19013_E001")),
            "poverty_rate": ratio(num(v.get("B17001_E002")), num(v.get("B17001_E001"))),
            "no_internet_rate": ratio(num(v.get("B28002_E013")), num(v.get("B28002_E001"))),
        }

    # states: 50 + DC (FIPS <= 56), no Puerto Rico or territories
    states = {}
    for geo_id in acs:
        if geo_id.startswith("0400000US") and int(geo_id[-2:]) <= 56:
            s = base(geo_id, geo_id[-2:], "state")
            rates = fdic[s["state_abbr"]]
            s["unbanked_rate"] = float(rates["unbanked_rate"])
            s["underbanked_rate"] = float(rates["underbanked_rate"])
            s["underserved_rate"] = s["unbanked_rate"] + s["underbanked_rate"]
            s["branches"] = sum(n for f, n in branches.items() if f[:2] == s["fips"])
            states[s["fips"]] = s

    counties = []
    for geo_id in acs:
        if geo_id.startswith("0500000US") and geo_id[-5:-3] in states:
            c = base(geo_id, geo_id[-5:], "county")
            if c["households"] > 0:
                counties.append(c)

    # A state whose ACS county codes never appear in FDIC data (Connecticut planning regions) gets null branches.
    matched_states = {c["state_fips"] for c in counties if c["fips"] in branches}
    for c in counties:
        s = states[c["state_fips"]]
        c["branches"] = branches.get(c["fips"], 0) if c["state_fips"] in matched_states else None
        c["unbanked_rate"] = s["unbanked_rate"]
        c["underbanked_rate"] = s["underbanked_rate"]
        if c["poverty_rate"] is not None and s["poverty_rate"]:
            c["underserved_rate"] = min(max(s["underserved_rate"] * c["poverty_rate"] / s["poverty_rate"], 0.05), 0.60)
        else:
            c["underserved_rate"] = s["underserved_rate"]
        g = gaz.get(c["fips"])
        c["centroid"] = [round(float(g["INTPTLAT"]), 4), round(float(g["INTPTLONG"].strip()), 4)] if g else None

    for a in [*states.values(), *counties]:
        a["branches_per_10k_hh"] = None if a["branches"] is None else round(a["branches"] / a["households"] * 10000, 2)
        a["est_underserved_hh"] = round(a["households"] * a["underserved_rate"])
        a["inv_income"] = None if a["median_income"] is None else -a["median_income"]
        a["inv_branches"] = None if a["branches_per_10k_hh"] is None else -a["branches_per_10k_hh"]

    # state centroid = household-weighted mean of its counties
    for s in states.values():
        pts = [(c["households"], c["centroid"]) for c in counties if c["state_fips"] == s["fips"] and c["centroid"]]
        w = sum(h for h, _ in pts)
        s["centroid"] = [round(sum(h * p[0] for h, p in pts) / w, 4), round(sum(h * p[1] for h, p in pts) / w, 4)]

    state_list = sorted(states.values(), key=lambda a: a["fips"])
    counties.sort(key=lambda a: a["fips"])
    add_index(state_list, [("unbanked_rate", 1), ("underbanked_rate", 1), ("poverty_rate", 1),
                           ("no_internet_rate", 1), ("inv_income", 1), ("inv_branches", 1)])
    for c in counties:
        c["state_underserved_rate"] = states[c["state_fips"]]["underserved_rate"]
    add_index(counties, [("poverty_rate", 1), ("no_internet_rate", 1), ("inv_income", 1),
                         ("inv_branches", 1), ("state_underserved_rate", 1)])
    return year, state_list, counties


KEYS = ["fips", "name", "level", "state_fips", "state_abbr", "population", "households", "median_income",
        "poverty_rate", "no_internet_rate", "branches", "branches_per_10k_hh", "unbanked_rate", "underbanked_rate",
        "underserved_rate", "est_underserved_hh", "exclusion_index", "exclusion_rank", "centroid"]


def clean(a):
    out = {k: a[k] for k in KEYS}
    for k in ("poverty_rate", "no_internet_rate", "unbanked_rate", "underbanked_rate", "underserved_rate"):
        out[k] = r4(out[k])
    if out["median_income"] is not None:
        out["median_income"] = int(out["median_income"])
    return out


def main():
    year, states, counties = build()
    OUT.mkdir(parents=True, exist_ok=True)
    areas = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "is_demo_data": False,
        "sources": [f"ACS 5-year {year - 4}-{year}", "FDIC 2023 National Survey of Unbanked and Underbanked Households",
                    "FDIC BankFind locations", "Census Gazetteer"],
        "states": [clean(a) for a in states],
        "counties": [clean(a) for a in counties],
    }
    (OUT / "areas.json").write_text(json.dumps(areas, separators=(",", ":")))
    (OUT / "benchmarks.json").write_text(json.dumps(BENCHMARKS, indent=2))
    print(f"wrote {len(states)} states, {len(counties)} counties")

    import validate
    validate.main()


if __name__ == "__main__":
    main()
