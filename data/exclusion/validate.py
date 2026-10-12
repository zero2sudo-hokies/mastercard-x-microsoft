"""Check backend/app/data/areas.json against CONTRACTS.md and print where key areas land."""
import json
from pathlib import Path

PATH = Path(__file__).parent.parent.parent / "backend" / "app" / "data" / "areas.json"
FORBIDDEN = ("immigra", "citizen", "foreign", "nativ", "language", "english", "race", "ethnic", "hispanic")
TYPES = {
    "fips": str, "name": str, "level": str, "state_fips": str, "state_abbr": str,
    "population": int, "households": int, "median_income": (int, type(None)),
    "poverty_rate": (float, int, type(None)), "no_internet_rate": (float, int, type(None)),
    "branches": (int, type(None)), "branches_per_10k_hh": (float, int, type(None)),
    "unbanked_rate": (float, int), "underbanked_rate": (float, int), "underserved_rate": (float, int),
    "est_underserved_hh": int, "exclusion_index": (float, int), "exclusion_rank": int, "centroid": (list, type(None)),
}
RATES = ("poverty_rate", "no_internet_rate", "unbanked_rate", "underbanked_rate", "underserved_rate")


def keys_deep(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield k
            yield from keys_deep(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from keys_deep(v)


def check(data):
    errors = []
    for k in keys_deep(data):
        if any(f in k.lower() for f in FORBIDDEN):
            errors.append(f"forbidden key {k}")
    seen = set()
    for level, fips_len in (("states", 2), ("counties", 5)):
        for a in data[level]:
            fips = a.get("fips", "?")
            if set(a) != set(TYPES):
                errors.append(f"{fips} keys mismatch: {set(a) ^ set(TYPES)}")
                continue
            for k, t in TYPES.items():
                if not isinstance(a[k], t) or isinstance(a[k], bool):
                    errors.append(f"{fips} {k} bad type {type(a[k]).__name__}")
            if len(fips) != fips_len or fips in seen:
                errors.append(f"{fips} bad or duplicate fips")
            seen.add(fips)
            for k in RATES:
                if a[k] is not None and not 0 <= a[k] <= 1:
                    errors.append(f"{fips} {k} out of [0,1]: {a[k]}")
            if not 0 <= a["exclusion_index"] <= 100:
                errors.append(f"{fips} exclusion_index out of [0,100]")
    if len(data["states"]) != 51:
        errors.append(f"expected 51 states (50 + DC), got {len(data['states'])}")
    return errors


def main():
    data = json.loads(PATH.read_text())
    errors = check(data)
    for e in errors[:50]:
        print("ERROR", e)
    for level in ("states", "counties"):
        print(f"\nTop 10 {level} by exclusion index:")
        for a in sorted(data[level], key=lambda a: a["exclusion_rank"])[:10]:
            print(f"  {a['exclusion_rank']:>4} {a['exclusion_index']:>5} {a['fips']} {a['name']}, {a['state_abbr']}")
    for a in data["states"] + data["counties"]:
        if a["fips"] in ("48", "48215"):
            n = len(data["states" if a["level"] == "state" else "counties"])
            print(f"{a['name']}: rank {a['exclusion_rank']} of {n}, index {a['exclusion_index']}, "
                  f"underserved {a['underserved_rate']}, est households {a['est_underserved_hh']}")
    if errors:
        raise SystemExit(f"{len(errors)} validation errors")
    print("\nvalidate: OK")


if __name__ == "__main__":
    main()
