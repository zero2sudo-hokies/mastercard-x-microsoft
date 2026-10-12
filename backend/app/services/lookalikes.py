"""Nearest look-alike areas on standardized economic + complaint-topic features, at least 150 km away."""
import math

import numpy as np

from app.models import TOPICS, Area, Lookalike
from app.store import store

MIN_KM = 150


def _features(area: Area) -> list:
    fr = store.frustration.get(area.fips)
    shares = fr.topic_shares if fr and fr.topic_shares else {}
    return [
        area.poverty_rate, area.no_internet_rate,
        None if area.median_income is None else -area.median_income,
        None if area.branches_per_10k_hh is None else -area.branches_per_10k_hh,
        area.exclusion_index, *(shares.get(t) for t in TOPICS),
    ]


def _matrix(rows):
    return np.array([[np.nan if v is None else v for v in r] for r in rows], dtype=float)


def _build_index(level):
    """Eligible areas (frustration ok), their standardized features, and the mean/std used. Nulls -> z = 0."""
    areas = [a for a in store.by_level[level] if (fr := store.frustration.get(a.fips)) and fr.status == "ok"]
    if not areas:
        return [], None, None, None
    raw = _matrix([_features(a) for a in areas])
    with np.errstate(all="ignore"):
        mean = np.nan_to_num(np.nanmean(raw, axis=0))
        std = np.nanstd(raw, axis=0)
    std = np.where((std == 0) | np.isnan(std), 1, std)
    return areas, np.nan_to_num((raw - mean) / std), mean, std


_INDEX = {level: _build_index(level) for level in ("state", "county")}


def haversine_km(a, b) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6371.0 * 2 * math.asin(math.sqrt(h))


def lookalikes(fips: str, n: int = 5) -> list[Lookalike]:
    target = store.areas[fips]
    areas, z, mean, std = _INDEX[target.level]
    if not areas or not target.centroid:
        return []
    tz = np.nan_to_num((_matrix([_features(target)])[0] - mean) / std)
    dist = np.sqrt(((z - tz) ** 2).sum(axis=1))
    out = []
    for i in np.argsort(dist, kind="stable"):
        other = areas[i]
        if other.fips == fips or not other.centroid:
            continue
        km = haversine_km(target.centroid, other.centroid)
        if km < MIN_KM:
            continue
        fr = store.frustration[other.fips]
        out.append(Lookalike(
            fips=other.fips, name=other.name, state_abbr=other.state_abbr, distance_km=round(km),
            similarity=round(1 / (1 + float(dist[i])), 3), exclusion_index=other.exclusion_index,
            frustration_score=fr.frustration_score, top_topic=fr.top_topic,
        ))
        if len(out) == n:
            break
    return out
