"""Join the exclusion layer (P1) with the frustration layer (P2) into AreaSummary / AreaProfile."""
from typing import Optional

from app.models import Area, AreaProfile, AreaSummary
from app.services.benefits import BY_TOPIC
from app.services.lookalikes import lookalikes
from app.store import store


def priority_score(exclusion_index: float, frustration_score: Optional[float]) -> Optional[float]:
    return None if frustration_score is None else round(0.5 * exclusion_index + 0.5 * frustration_score, 1)


def _summary(area: Area) -> AreaSummary:
    fr = store.frustration.get(area.fips)
    top = fr.top_topic if fr else None
    score = fr.frustration_score if fr else None
    return AreaSummary(
        fips=area.fips, name=area.name, level=area.level, state_fips=area.state_fips, state_abbr=area.state_abbr,
        exclusion_index=area.exclusion_index, frustration_score=score,
        frustration_status=fr.status if fr else "no_data",
        top_topic=top, top_benefit_id=BY_TOPIC[top].id if top else None,
        pain_scores=fr.pain_scores if fr else None,
        est_underserved_hh=area.est_underserved_hh, priority_score=priority_score(area.exclusion_index, score),
    )


SUMMARIES = {level: [_summary(a) for a in areas] for level, areas in store.by_level.items()}
SUMMARY_BY_FIPS = {s.fips: s for group in SUMMARIES.values() for s in group}


def summaries(level: str, state: Optional[str] = None) -> list[AreaSummary]:
    rows = SUMMARIES[level]
    return [s for s in rows if s.state_fips == state] if state else rows


def profile(fips: str) -> AreaProfile:
    area = store.areas[fips]
    fr = store.frustration.get(fips)
    labels = []
    if area.level == "county":
        labels += ["Unbanked and underbanked rates are state-level FDIC 2023 estimates (FDIC has no county data).",
                   "Underserved households are modeled from state FDIC rates and county poverty."]
    else:
        labels.append("Unbanked and underbanked rates are FDIC 2023 state estimates.")
    if not fr or fr.status != "ok":
        labels.append("Not enough data: fewer than 30 CFPB complaints, so no frustration score.")
    if fr and fr.complaints and fr.mean_intensity is None:
        labels.append("Complaint topics come from CFPB issue categories; intensity is not classified yet, "
                      "so pain = topic share vs national.")
    if store.areas_meta.get("is_demo_data") or store.frustration_meta.get("is_demo_data"):
        labels.append("Demo data: some values are fixtures, not pipeline output.")
    return AreaProfile(
        area=area, frustration=fr,
        benefit=BY_TOPIC.get(fr.top_topic) if fr and fr.top_topic else None,
        lookalikes=lookalikes(fips, 5), labels=labels,
    )
