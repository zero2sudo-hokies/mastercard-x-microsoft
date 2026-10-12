"""Frustration layer for New York (pilot-first) -> backend/app/data/frustration.json.

CFPB complaints Aug 2024 - Jul 2026 for the three contract products. Topics come from CFPB's own issue and
sub-issue fields (rule mapping, every complaint). County = p3's method: exact 5-digit ZIP read as a 2020 ZCTA,
kept only when that ZCTA sits in exactly one county nationally. Narratives are not in the public API for this
window, so intensity is not classified yet: pain = topic share vs national, and frustration_score ranks
complaints per 100k. Run: python build_ny.py   (fetch is cached in raw/)
"""
import csv
import json
import time
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

import httpx

HERE = Path(__file__).parent
RAW = HERE / "raw"
ROOT = HERE.parent.parent
OUT = ROOT / "backend" / "app" / "data" / "frustration.json"
AREAS = ROOT / "backend" / "app" / "data" / "areas.json"

API = "https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/"
PRODUCTS = ["Checking or savings account", "Prepaid card", "Money transfer, virtual currency, or money service"]
WINDOW = ("2024-08-01", "2026-07-31")
STATE = "NY"
UA = {"User-Agent": "Mozilla/5.0"}
CROSSWALK = "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt"
TOPICS = ["fees", "fraud_scams", "transfers", "account_closed", "customer_service", "distrust"]
PRIOR = 30  # shrinkage weight toward national shares, from CONTRACTS.md
MIN_TOPIC = 5
BANNED = ("immigra", "undocumented", "citizen", "itin", "ssn", "foreign-born", "nativity", "national origin",
          "race", "ethnic", "hispanic", "latino", "religion", "deport")


def get_json(params: dict):
    # httpx, not urllib: the CFPB site's firewall rejects urllib requests with 403
    query = [(k, v) for k, vals in params.items() for v in (vals if isinstance(vals, list) else [vals])]
    for attempt in range(4):
        try:
            r = httpx.get(API, params=query, headers=UA, timeout=180)
            r.raise_for_status()
            return r.json()
        except httpx.HTTPError:
            if attempt == 3:
                raise
            time.sleep(5 * (attempt + 1))


def months(start: str, end: str):
    d, last = date.fromisoformat(start), date.fromisoformat(end)
    while d <= last:
        nxt = date(d.year + (d.month == 12), d.month % 12 + 1, 1)
        yield d.isoformat(), min(nxt.fromordinal(nxt.toordinal() - 1), last).isoformat()
        d = nxt


def fetch_range(lo: str, hi: str) -> list[dict]:
    """All complaints received lo..hi. The API ignores offsets, so split any range over 1,000 in half."""
    d = get_json({"state": STATE, "product": PRODUCTS, "date_received_min": lo, "date_received_max": hi,
                  "size": 1000, "no_aggs": "true"})
    total = d["hits"]["total"]["value"]
    if total <= 1000:
        time.sleep(0.5)
        return [{k: h["_source"].get(k) for k in ("complaint_id", "zip_code", "product", "issue", "sub_issue")} for h in d["hits"]["hits"]]
    a, b = date.fromisoformat(lo), date.fromisoformat(hi)
    if a == b:
        raise SystemExit(f"{lo}: {total} complaints in one day, more than one page")
    mid = a.fromordinal((a.toordinal() + b.toordinal()) // 2)
    return fetch_range(lo, mid.isoformat()) + fetch_range(mid.fromordinal(mid.toordinal() + 1).isoformat(), hi)


def fetch_complaints():
    """NY complaints month by month; each month is cached in raw/ny_months so a rerun resumes."""
    cache = RAW / "ny_months"
    cache.mkdir(exist_ok=True)
    rows = []
    for lo, hi in months(*WINDOW):
        path = cache / f"{lo}.json"
        if not path.exists():
            month = fetch_range(lo, hi)
            path.write_text(json.dumps(month))
            print(f"{lo} {len(month)}")
        rows += json.loads(path.read_text())
    return rows


def fetch_national():
    """National issue/sub-issue counts for the same products and window (aggregations, one call)."""
    path = RAW / "national_issues.json"
    if path.exists():
        return json.loads(path.read_text())
    d = get_json({"product": PRODUCTS, "date_received_min": WINDOW[0], "date_received_max": WINDOW[1], "size": 0})
    rows = []
    for ib in d["aggregations"]["issue"]["issue"]["buckets"]:
        subs = ib.get("sub_issue.raw", {}).get("buckets", [])
        rest = ib["doc_count"] - sum(s["doc_count"] for s in subs)
        rows += [{"issue": ib["key"], "sub_issue": s["key"], "n": s["doc_count"]} for s in subs]
        if rest:
            rows.append({"issue": ib["key"], "sub_issue": None, "n": rest})
    out = {"total": d["hits"]["total"]["value"], "rows": rows}
    path.write_text(json.dumps(out))
    return out


def fetch_crosswalk() -> dict[str, str]:
    """ZCTA -> county, only for ZCTAs that touch exactly one county nationally."""
    path = RAW / "zcta_county.txt"
    if not path.exists():
        path.write_bytes(httpx.get(CROSSWALK, headers=UA, timeout=300).raise_for_status().content)
    counties = defaultdict(set)
    with open(path, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f, delimiter="|"):
            if row["GEOID_ZCTA5_20"] and row["GEOID_COUNTY_20"]:
                counties[row["GEOID_ZCTA5_20"]].add(row["GEOID_COUNTY_20"])
    return {z: next(iter(c)) for z, c in counties.items() if len(c) == 1}


def topic_of(issue: str | None, sub_issue: str | None) -> str:
    """CFPB issue/sub-issue -> one of the six topics. First matching rule wins; README lists the full table.
    Uses only issue fields (not product) so NY complaints and the national baseline are mapped the same way."""
    text = f"{issue or ''} | {sub_issue or ''}".lower()
    rules = [
        ("fraud_scams", ("not authorized", "unauthorized", "fraud", "scam", "identity theft", "without my consent",
                         "lender or other company charging")),
        ("fees", ("fee", "overdraft", "nsf", "minimum balance", "interest", "charged")),
        ("distrust", ("advertis", "marketing", "misleading", "privacy", "threat", "confusing")),
        ("account_closed", ("clos", "frozen", "freez", "opening an account", "unable to open", "accessing account", "denied")),
        ("transfers", ("transfer", "sending money", "money was not available", "disbursed", "making or receiving payments",
                       "exchange rate", "wrong amount", "wrong day", "deposits", "withdrawal", "cashing a check", "wallet")),
    ]
    for topic, words in rules:
        if any(w in text for w in words):
            return topic
    return "customer_service"


def percentiles(values: dict[str, float]) -> dict[str, float]:
    ordered = sorted(values.values())
    if len(ordered) == 1:
        return {k: 100.0 for k in values}
    from bisect import bisect_left
    return {k: round(100 * bisect_left(ordered, v) / (len(ordered) - 1), 1) for k, v in values.items()}


def area_record(fips, level, counts: Counter, population, national_shares):
    n = sum(counts.values())
    status = "ok" if n >= 30 else ("low_data" if n else "no_data")
    rec = {"fips": fips, "level": level, "complaints": n,
           "complaints_per_100k": round(n / population * 1e5, 1) if population else None,
           "narratives_classified": 0, "mean_intensity": None, "intensity_source": None,
           "topic_counts": {t: counts.get(t, 0) for t in TOPICS}, "frustration_score": None, "status": status, "excerpts": []}
    if n:
        shares = {t: (counts.get(t, 0) + PRIOR * national_shares[t]) / (n + PRIOR) for t in TOPICS}
        pain = {t: shares[t] / national_shares[t] for t in TOPICS}
        # a topic needs MIN_TOPIC complaints here to lead, so a rare topic can't win on one or two complaints
        eligible = [t for t in TOPICS if counts.get(t, 0) >= MIN_TOPIC] or TOPICS
        ranked = sorted(eligible, key=lambda t: -pain[t]) + sorted(set(TOPICS) - set(eligible), key=lambda t: -pain[t])
        top, second = ranked[:2]
        lead = pain[top] / pain[second]
        rec.update(topic_shares={t: round(v, 4) for t, v in shares.items()}, pain_scores={t: round(v, 3) for t, v in pain.items()},
                   top_topic=top, second_topic=second, top_topic_lead=round(lead, 3), clear_lead=lead >= 1.15)
    return rec


def main():
    RAW.mkdir(exist_ok=True)
    complaints = fetch_complaints()
    national = fetch_national()
    zcta = fetch_crosswalk()
    areas = json.loads(AREAS.read_text(encoding="utf-8"))
    pop = {a["fips"]: a["population"] for a in areas["states"] + areas["counties"]}
    state_fips = next(a["fips"] for a in areas["states"] if a["state_abbr"] == STATE)

    nat_counts = Counter()
    for r in national["rows"]:
        nat_counts[topic_of(r["issue"], r["sub_issue"])] += r["n"]
    nat_total = sum(nat_counts.values())
    national_shares = {t: nat_counts[t] / nat_total for t in TOPICS}

    state_counts, county_counts = Counter(), defaultdict(Counter)
    mapping, unmatched = Counter(), Counter()
    for c in complaints:
        t = topic_of(c["issue"], c["sub_issue"])
        mapping[(c["issue"], c["sub_issue"], t)] += 1
        state_counts[t] += 1
        z = (c["zip_code"] or "").strip()
        county = zcta.get(z) if len(z) == 5 and z.isdigit() else None
        if county and county.startswith(state_fips) and county in pop:
            county_counts[county][t] += 1
        else:
            unmatched["masked_or_missing_zip" if not (len(z) == 5 and z.isdigit()) else "multi_county_or_outside_state"] += 1

    counties = {f: area_record(f, "county", cnt, pop.get(f), national_shares) for f, cnt in county_counts.items()}
    ok = {f: r["complaints_per_100k"] for f, r in counties.items() if r["status"] == "ok" and r["complaints_per_100k"]}
    for f, p in percentiles(ok).items():
        counties[f]["frustration_score"] = p
    state = area_record(state_fips, "state", state_counts, pop[state_fips], national_shares)
    if state["status"] == "ok":
        state["frustration_score"] = 100.0  # the only state scored so far

    out = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "is_demo_data": False,
        "window": {"from": WINDOW[0], "to": WINDOW[1]},
        "products": PRODUCTS,
        "coverage": {"states": [STATE], "note": "New York pilot-first; other states have no complaint layer yet."},
        "classification": {"model": None, "narratives_classified": 0, "topic_agreement": None,
                           "topic_method": "CFPB issue and sub-issue mapped to six topics by rules",
                           "intensity": "not classified: narratives are not in the public API for this window",
                           "frustration_score_basis": "percentile of complaints per 100k residents among NY counties with 30+ complaints",
                           "county_method": "exact ZIP as 2020 ZCTA, singleton-county ZCTAs only (same as data/p3)"},
        "national": {"complaints": national["total"], "topic_shares": {t: round(v, 4) for t, v in national_shares.items()},
                     "mean_intensity": None, "topic_intensity": None},
        "quality": {"state_complaints": len(complaints), "county_mapped": sum(sum(c.values()) for c in county_counts.values()),
                    "unmatched": dict(unmatched), "counties_with_complaints": len(counties),
                    "counties_ok": sum(r["status"] == "ok" for r in counties.values())},
        "states": {state_fips: state},
        "counties": dict(sorted(counties.items())),
    }
    text = json.dumps(out, ensure_ascii=False)
    assert not [b for b in BANNED if b in text.lower()], "banned term in output"
    OUT.write_text(text, encoding="utf-8")
    (RAW / "topic_mapping.csv").write_text(
        "issue,sub_issue,topic,ny_complaints\n" + "".join(f'"{i}","{s or ""}",{t},{n}\n' for (i, s, t), n in mapping.most_common()),
        encoding="utf-8")

    print(f"NY complaints {len(complaints)}, mapped to a county {out['quality']['county_mapped']}, unmatched {dict(unmatched)}")
    print(f"counties with complaints {len(counties)}, ok (30+) {out['quality']['counties_ok']}")
    print("national topic shares", out["national"]["topic_shares"])
    print("NY state topic shares", state.get("topic_shares"), "top", state.get("top_topic"))
    for f, r in sorted(counties.items(), key=lambda kv: -(kv[1]["frustration_score"] or -1))[:10]:
        print(f"  {f} {r['complaints']:>5} per100k {r['complaints_per_100k']} score {r['frustration_score']} top {r.get('top_topic')} lead {r.get('top_topic_lead')}")


if __name__ == "__main__":
    main()
