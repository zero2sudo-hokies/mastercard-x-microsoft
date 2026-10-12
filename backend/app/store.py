"""Loads areas.json, benchmarks.json and frustration.json once at startup.

Each file falls back to app/fixtures/ on its own, so the API runs before the pipelines do.
"""
import json
import logging
from pathlib import Path

from app.models import Area, FrustrationArea

log = logging.getLogger("navigator")
APP = Path(__file__).parent
ROI_INPUTS = APP.parent.parent / "data" / "p3" / "roi-inputs.json"  # P3's verified FDIC audience + bank benchmarks


def _load(name):
    for folder, source in (("data", "pipeline"), ("fixtures", "fixtures")):
        path = APP / folder / name
        if path.exists():
            try:
                return json.loads(path.read_text(encoding="utf-8")), source
            except (OSError, ValueError):
                log.warning("could not read %s, trying fixtures", path)
    raise RuntimeError(f"{name} missing from data/ and fixtures/")


class Store:
    def __init__(self):
        areas_raw, self.areas_source = _load("areas.json")
        self.benchmarks, self.benchmarks_source = _load("benchmarks.json")
        frustration_raw, self.frustration_source = _load("frustration.json")

        self.areas_meta = {k: v for k, v in areas_raw.items() if k not in ("states", "counties")}
        self.areas: dict[str, Area] = {}
        self.by_level: dict[str, list[Area]] = {"state": [], "county": []}
        for a in [*areas_raw["states"], *areas_raw["counties"]]:
            area = Area(**a)
            self.areas[area.fips] = area
            self.by_level[area.level].append(area)

        self.frustration_meta = {k: v for k, v in frustration_raw.items() if k not in ("states", "counties")}
        self.national = frustration_raw.get("national", {})
        self.frustration: dict[str, FrustrationArea] = {
            fips: FrustrationArea(**f)
            for group in ("states", "counties")
            for fips, f in frustration_raw.get(group, {}).items()
        }

        # optional: the ROI still works on benchmarks.json alone if this file is missing
        self.roi_inputs = None
        if ROI_INPUTS.exists():
            try:
                self.roi_inputs = json.loads(ROI_INPUTS.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                log.warning("could not read %s", ROI_INPUTS)
        self.state_audience = {r["state"]: r for r in (self.roi_inputs or {}).get("state_opportunities", [])}

    def state_households(self, state_fips: str) -> int:
        """Underserved households for a state: the state Area if present, else the sum of its counties."""
        state = self.areas.get(state_fips)
        if state:
            return state.est_underserved_hh
        return sum(c.est_underserved_hh for c in self.by_level["county"] if c.state_fips == state_fips)


store = Store()
