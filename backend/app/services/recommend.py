"""Pilot recommendations ranked by priority score, or by a single topic's pain."""
from bisect import bisect_left
from datetime import date
from typing import Optional

from app.models import TOPICS, AreaSummary, Recommendation
from app.services.benefits import BY_TOPIC
from app.services.merge import SUMMARIES
from app.store import store

TOPIC_LABEL = {"fees": "Fees", "fraud_scams": "Fraud and scams", "transfers": "Transfers",
               "account_closed": "Account closure", "customer_service": "Customer service", "distrust": "Distrust"}
LEVEL_PLURAL = {"state": "states", "county": "counties"}


def percentiles(values: dict[str, float]) -> dict[str, float]:
    """0-100 within the group, highest value = 100, ties share a percentile."""
    ordered = sorted(values.values())
    n = len(ordered)
    if n == 1:
        return {k: 100.0 for k in values}
    return {k: 100 * bisect_left(ordered, v) / (n - 1) for k, v in values.items()}


def _eligible(level) -> list[AreaSummary]:
    return [s for s in SUMMARIES[level] if s.frustration_status == "ok" and s.frustration_score is not None]


# topic pain percentile within each level, among eligible areas
TOPIC_PCT = {
    level: {t: percentiles({s.fips: s.pain_scores[t] for s in _eligible(level) if s.pain_scores and t in s.pain_scores})
            for t in TOPICS}
    for level in ("state", "county")
}


def _window_months() -> int:
    w = store.frustration_meta.get("window") or {}
    try:
        a, b = date.fromisoformat(w["from"]), date.fromisoformat(w["to"])
        return (b.year - a.year) * 12 + b.month - a.month + 1
    except (KeyError, ValueError, TypeError):
        return 24


def _reasons(s: AreaSummary, topic: str) -> list[str]:
    reasons = [f"Exclusion index {round(s.exclusion_index)} "
               f"(top {max(1, round(100 - s.exclusion_index))}% of US {LEVEL_PLURAL[s.level]})"]
    if s.pain_scores and topic in s.pain_scores:
        reasons.append(f"{TOPIC_LABEL[topic]} pain {s.pain_scores[topic]:.2f}x national")
    fr = store.frustration[s.fips]
    reasons.append(f"{fr.complaints:,} complaints in {_window_months()} months")
    return reasons


def recommendations(level: str = "county", state: Optional[str] = None, topic: Optional[str] = None,
                    limit: int = 10) -> list[Recommendation]:
    rows = _eligible(level)
    if topic:
        pct = TOPIC_PCT[level][topic]
        rows = [s for s in rows if s.fips in pct]
        scored = [(round(0.5 * s.exclusion_index + 0.5 * pct[s.fips], 1), s) for s in rows]
    else:
        scored = [(s.priority_score, s) for s in rows]
    if state:
        scored = [(p, s) for p, s in scored if s.state_fips == state]
    scored.sort(key=lambda ps: -ps[0])

    out = []
    for rank, (score, s) in enumerate(scored[:limit], start=1):
        t = topic or s.top_topic
        out.append(Recommendation(
            rank=rank, fips=s.fips, name=s.name, state_abbr=s.state_abbr, level=s.level,
            priority_score=score, exclusion_index=s.exclusion_index, frustration_score=s.frustration_score,
            top_topic=s.top_topic, benefit_id=BY_TOPIC[t].id if t else None,
            clear_lead=store.frustration[s.fips].clear_lead, est_underserved_hh=s.est_underserved_hh,
            reasons=_reasons(s, t),
        ))
    return out
