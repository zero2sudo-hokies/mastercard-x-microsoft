"""Bank leaderboard per county and state -> backend/app/data/banks.json.

Source: FDIC Summary of Deposits (every insured bank branch, deposits as of June 30), via the FDIC BankFind API.
Deposits are the public proxy for customers: no public source counts a bank's customers by county.
Run: python build_banks.py   (fetch cached in raw/)
"""
import json
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import httpx

HERE = Path(__file__).parent
RAW = HERE / "raw"
ROOT = HERE.parent.parent
OUT = ROOT / "backend" / "app" / "data" / "banks.json"
BRANCHES_OUT = ROOT / "backend" / "app" / "data" / "branches.json"  # county -> [cert, lat, lon, branch name] for map pins
AREAS = ROOT / "backend" / "app" / "data" / "areas.json"

API = "https://api.fdic.gov/banks/sod"
YEAR = 2026
FIELDS = "CERT,NAMEFULL,DEPSUMBR,ASSET,CB,STCNTYBR,NAMEHCR,SPECDESC,STALP,CITY,NAMEBR,SIMS_LATITUDE,SIMS_LONGITUDE"
TOP_N = 10
CALL_REPORT = "20260630"  # quarterly call report used for per-bank ratios
REG_II_THRESHOLD = 10_000_000  # $ thousands: under $10B in assets = exempt from the Regulation II interchange cap


def _pct(v):
    """FDIC reports ratios in percent; store as decimals like the rest of the app."""
    return None if v is None else round(v / 100, 5)


def fetch() -> list[dict]:
    path = RAW / f"sod_{YEAR}_v2.json"  # v2 adds branch names and coordinates
    if path.exists():
        return json.loads(path.read_text())
    rows, offset = [], 0
    while True:
        r = httpx.get(API, params={"filters": f"YEAR:{YEAR}", "fields": FIELDS, "limit": 10000, "offset": offset,
                                   "format": "json"}, timeout=180)
        r.raise_for_status()
        page = [d["data"] for d in r.json()["data"]]
        rows += page
        print(f"SOD {YEAR}: {len(rows)}")
        if len(page) < 10000:
            break
        offset += 10000
        time.sleep(1)
    RAW.mkdir(exist_ok=True)
    path.write_text(json.dumps(rows))
    return rows


def fetch_ratios() -> dict[str, dict]:
    """Per-bank ratios from the call report (context only: whole-bank figures, not per-account economics)."""
    path = RAW / f"financials_{CALL_REPORT}.json"
    if not path.exists():
        r = httpx.get("https://api.fdic.gov/banks/financials", params={"filters": f"REPDTE:{CALL_REPORT}",
                      "fields": "CERT,NIMY,EEFFR,ROA", "limit": 10000, "format": "json"}, timeout=180)
        r.raise_for_status()
        path.write_text(json.dumps([d["data"] for d in r.json()["data"]]))
    return {str(d["CERT"]): d for d in json.loads(path.read_text())}


def fetch_websites() -> dict[str, str | None]:
    """Official bank websites, matched by FDIC certificate rather than bank name."""
    path = RAW / "websites.json"
    if not path.exists():
        r = httpx.get("https://api.fdic.gov/banks/institutions", params={"filters": "ACTIVE:1",
                      "fields": "CERT,WEBADDR", "limit": 10000, "format": "json"}, timeout=180)
        r.raise_for_status()
        payload = r.json()
        assert len(payload["data"]) == payload["meta"]["total"], "Bank website response was truncated"
        path.write_text(json.dumps({str(d["data"]["CERT"]): d["data"].get("WEBADDR") or None for d in payload["data"]}))
    return json.loads(path.read_text())


def main():
    rows = fetch()
    ratios = fetch_ratios()
    websites = fetch_websites()
    known = {a["fips"] for a in json.loads(AREAS.read_text(encoding="utf-8"))["counties"]}
    institutions, by_area = {}, defaultdict(lambda: defaultdict(lambda: {"deposits": 0, "branches": 0}))
    pins = defaultdict(list)
    skipped = 0
    for r in rows:
        county = str(r.get("STCNTYBR") or "").zfill(5)
        cert = str(r["CERT"])
        if county not in known:  # territories, unmatched codes
            skipped += 1
            continue
        institutions.setdefault(cert, {
            "cert": cert, "name": r["NAMEFULL"], "holding_company": r.get("NAMEHCR") or None,
            "website": websites.get(cert),
            "hq_city": r.get("CITY"), "hq_state": r.get("STALP"),
            "total_assets": (r.get("ASSET") or 0) * 1000,
            "fdic_community_bank": r.get("CB") == 1,
            "specialization": r.get("SPECDESC"),
            # bank-level assets; Regulation II actually uses consolidated (holding company) assets, so confirm
            "issuer_type": "community" if (r.get("ASSET") or 0) < REG_II_THRESHOLD else "large_bank",
            "net_interest_margin": _pct(ratios.get(cert, {}).get("NIMY")),
            "efficiency_ratio": _pct(ratios.get(cert, {}).get("EEFFR")),
            "return_on_assets": _pct(ratios.get(cert, {}).get("ROA")),
        })
        lat, lon = r.get("SIMS_LATITUDE"), r.get("SIMS_LONGITUDE")
        if lat and lon:
            pins[county].append([cert, round(lat, 5), round(lon, 5), r.get("NAMEBR") or ""])
        dep = (r.get("DEPSUMBR") or 0) * 1000
        for area in (county, county[:2]):  # county and its state
            by_area[area][cert]["deposits"] += dep
            by_area[area][cert]["branches"] += 1

    areas = {}
    for fips, banks in by_area.items():
        total = sum(b["deposits"] for b in banks.values())
        ranked = sorted(banks.items(), key=lambda kv: -kv[1]["deposits"])
        areas[fips] = {
            "total_deposits": total, "banks_present": len(banks),
            "banks": [{"cert": c, "deposits": b["deposits"], "deposit_share": round(b["deposits"] / total, 4) if total else 0,
                       "branches": b["branches"]} for c, b in ranked[:TOP_N]],
        }
    used = {b["cert"] for a in areas.values() for b in a["banks"]}
    out = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "FDIC Summary of Deposits and Q2 2026 call reports (BankFind API)", "as_of": f"{YEAR}-06-30",
        "labels": [
            "Ranked by deposits held at branches in the area, the public proxy for customers. No public source counts customers by county.",
            "Banks can book online or headquarters deposits at one branch, which inflates their share in that county.",
            "FDIC-insured banks only: credit unions (NCUA) are not included.",
            "Net interest margin, efficiency ratio and return on assets are whole-bank call-report figures (context, not per-account economics).",
            "Debit pricing tier is estimated from bank-level assets (under $10B = exempt). Regulation II uses consolidated assets; confirm with the issuer.",
        ],
        "institutions": {c: i for c, i in institutions.items() if c in used},
        "areas": dict(sorted(areas.items())),
    }
    OUT.write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    BRANCHES_OUT.write_text(json.dumps({"as_of": f"{YEAR}-06-30", "counties": dict(sorted(pins.items()))},
                                       separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"branch pins: {sum(len(v) for v in pins.values())} in {len(pins)} counties, {BRANCHES_OUT.stat().st_size / 1e6:.1f} MB")
    counties = sum(1 for f in areas if len(f) == 5)
    print(f"branches {len(rows)}, skipped {skipped}; areas: {counties} counties, {len(areas) - counties} states; "
          f"institutions kept {len(out['institutions'])}; {OUT.stat().st_size / 1e6:.1f} MB")
    for fips in ("36005", "48215", "36"):
        a = areas.get(fips)
        if a:
            top = [(out["institutions"][b["cert"]]["name"], f"{b['deposit_share']:.1%}", b["branches"]) for b in a["banks"][:5]]
            print(fips, f"{a['banks_present']} banks, ${a['total_deposits'] / 1e9:.1f}B:", top)


if __name__ == "__main__":
    main()
