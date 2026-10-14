"""Agent tools. Each calls the Monopoly HTTP API (never the Python internals) and returns compact JSON."""
import json

import httpx

from app.config import settings

_cache: dict[str, object] = {}


def _request(method: str, path: str, body: dict | None = None):
    """One API call. GETs are cached for the process; tests monkeypatch this function."""
    key = f"{method} {path} {json.dumps(body, sort_keys=True)}"
    if method == "GET" and key in _cache:
        return _cache[key]
    r = httpx.request(method, settings.api_base + path, json=body, timeout=15)
    if r.status_code >= 400:
        try:
            detail = r.json().get("detail", r.text)
        except ValueError:
            detail = r.text
        return {"error": detail, "status": r.status_code}
    data = r.json()
    if method == "GET":
        _cache[key] = data
    return data


def _pick(d: dict, keys) -> dict:
    return {k: d.get(k) for k in keys if d.get(k) is not None}


SUMMARY_KEYS = ("fips", "name", "state_abbr", "level", "exclusion_index", "frustration_score", "frustration_status",
                "top_topic", "est_underserved_hh", "priority_score")


def get_recommendations(level="county", state_fips=None, topic=None, limit=5):
    q = {"level": level, "state": state_fips, "topic": topic, "limit": min(int(limit or 5), 10)}
    query = "&".join(f"{k}={v}" for k, v in q.items() if v)
    recs = _request("GET", f"/api/recommendations?{query}")
    if isinstance(recs, list):
        titles = {b["id"]: b["title"] for b in _request("GET", "/api/benefits")}
        recs = [{**r, "benefit_title": titles.get(r.get("benefit_id"))} for r in recs]
    return recs


def rank_underserved(level="county", state_fips=None, limit=5):
    """Top areas by exclusion index alone, for when complaint data is thin."""
    rows = _request("GET", f"/api/areas?level={level}" + (f"&state={state_fips}" if state_fips else ""))
    if isinstance(rows, dict):
        return rows
    rows = sorted(rows, key=lambda r: -r["exclusion_index"])[: min(int(limit or 5), 10)]
    return [_pick(r, SUMMARY_KEYS) for r in rows]


def get_area_profile(fips):
    p = _request("GET", f"/api/areas/{fips}")
    if "error" in p:
        return p
    a, fr, b = p["area"], p.get("frustration") or {}, p.get("benefit") or {}
    return {
        "area": _pick(a, ("fips", "name", "state_abbr", "level", "households", "est_underserved_hh", "underserved_rate",
                          "poverty_rate", "no_internet_rate", "branches_per_10k_hh", "median_income", "unbanked_rate",
                          "underbanked_rate", "exclusion_index", "exclusion_rank")),
        "frustration": _pick(fr, ("status", "complaints", "complaints_per_100k", "frustration_score", "top_topic",
                                  "second_topic", "pain_scores", "clear_lead", "mean_intensity")) or {"status": "no_data"},
        "benefit": _pick(b, ("id", "title", "pain_measure")) or None,
        "lookalikes": [_pick(l, ("fips", "name", "state_abbr", "similarity", "frustration_score", "top_topic")) for l in p.get("lookalikes", [])],
        "labels": p.get("labels", []),
    }


def search_areas(query, level=None):
    q = (query or "").strip().lower().removesuffix(" county").removesuffix(" state")
    if not q:
        return []
    states = _request("GET", "/api/areas?level=state")
    hits = [s for s in states if q in (s["name"].lower(), s["state_abbr"].lower())]
    if level != "state":
        counties = _request("GET", "/api/areas?level=county")
        hits += [c for c in counties if q in c["name"].lower()]
    return [_pick(h, SUMMARY_KEYS) for h in hits[:8]]


def compute_roi(fips, issuer_type="community", adoption_rate=None, churn=None, cac=None):
    r = _request("POST", "/api/roi", {"fips": fips, "issuer_type": issuer_type, "adoption_rate": adoption_rate,
                                       "churn": churn, "cac": cac})
    if "error" in r:
        return r
    p = r["program"]
    return {"area": r["area"], "inputs": r["inputs"], "unit_per_account_per_year": r["unit"],
            "program": {"accounts_modeled": p["accounts"], "issuer_net_lifetime_modeled": p["issuer_net_lifetime"],
                        "network_volume_year1_modeled_spend_not_revenue": p["network_volume_y1"],
                        "network_revenue_year1_placeholder_estimate": p["network_revenue_y1_est"]},
            "audience": r.get("audience")}


def list_benefits():
    return [_pick(b, ("id", "topic", "title", "pain_measure")) for b in _request("GET", "/api/benefits")]


EXECUTORS = {f.__name__: f for f in (get_recommendations, rank_underserved, get_area_profile, search_areas, compute_roi, list_benefits)}

_TOPIC = {"type": "string", "enum": ["fees", "fraud_scams", "transfers", "account_closed", "customer_service", "distrust"]}
_LEVEL = {"type": "string", "enum": ["state", "county"]}
_FIPS = {"type": "string", "description": "2-digit state or 5-digit county FIPS code, as a string"}


def _fn(name, description, properties, required=()):
    return {"type": "function", "function": {"name": name, "description": description,
            "parameters": {"type": "object", "properties": properties, "required": list(required)}}}


TOOLS = [
    _fn("get_recommendations", "Rank pilot areas by priority score (exclusion + complaint frustration). Only areas with enough "
        "complaint data appear. Optional topic ranks by that frustration's pain instead.",
        {"level": _LEVEL, "state_fips": _FIPS, "topic": _TOPIC, "limit": {"type": "integer", "minimum": 1, "maximum": 10}}),
    _fn("rank_underserved", "Top areas by exclusion index only (FDIC + ACS + branch density). Use when complaint data is thin "
        "or the user asks where people are most left out of banking.",
        {"level": _LEVEL, "state_fips": _FIPS, "limit": {"type": "integer", "minimum": 1, "maximum": 10}}),
    _fn("get_area_profile", "Full facts for one area: exclusion, complaints, top frustration, matched benefit, look-alikes.",
        {"fips": _FIPS}, ["fips"]),
    _fn("search_areas", "Find a state or county FIPS code by name, e.g. 'Hidalgo' or 'Texas'.",
        {"query": {"type": "string"}, "level": _LEVEL}, ["query"]),
    _fn("compute_roi", "Pilot economics for an area: unit margin, lifetime value, breakeven churn, accounts, network volume.",
        {"fips": _FIPS, "issuer_type": {"type": "string", "enum": ["community", "large_bank"]},
         "adoption_rate": {"type": "number", "description": "0-1, e.g. 0.03"}, "churn": {"type": "number", "description": "0-1 yearly"},
         "cac": {"type": "number", "description": "acquisition cost per account, USD"}}, ["fips"]),
    _fn("list_benefits", "The six pilot benefits, one per complaint topic.", {}),
]


def run(name: str, args: dict):
    fn = EXECUTORS.get(name)
    if not fn:
        return {"error": f"Unknown tool {name}"}
    try:
        return fn(**{k: v for k, v in (args or {}).items() if v is not None})
    except (TypeError, ValueError) as e:
        return {"error": f"Bad arguments: {e}"}
    except httpx.HTTPError:
        return {"error": "Monopoly API unreachable"}
