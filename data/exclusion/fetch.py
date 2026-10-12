"""Download raw inputs for the exclusion layer into data/exclusion/raw/ (gitignored).

No API keys needed. The Census API now requires a key, so ACS comes from the
keyless table-based summary files on www2.census.gov instead.
"""
import csv
import io
import json
import re
import urllib.request
import zipfile
from pathlib import Path

RAW = Path(__file__).parent / "raw"
UA = {"User-Agent": "Mozilla/5.0 (navigator data pipeline)"}
ACS_TABLES = ["b01003", "b11001", "b19013", "b17001", "b28002"]
ACS_BASE = "https://www2.census.gov/programs-surveys/acs/summary_file/{y}/table-based-SF"
# keep only state (040) and county (050) rows
KEEP = ("GEO_ID", "FILEID", "0400000US", "0500000US")
FDIC_LOCATIONS = "https://api.fdic.gov/banks/locations?fields=UNINUM,STCNTY,STALP&limit=10000&offset={o}&format=json"
FDIC_APPENDIX = "https://www.fdic.gov/household-survey/2023-fdic-national-survey-unbanked-and-underbanked-households-appendix-tables"
GAZETTEER = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/{y}_Gazetteer/{y}_Gaz_counties_national.zip"


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
        return r.read()


def stream_filtered(url, out):
    """Stream a big pipe-delimited file and keep only state and county rows."""
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r, open(out, "w", encoding="utf-8") as f:
        for line in io.TextIOWrapper(r, encoding="utf-8", errors="replace"):
            if line.startswith(KEEP) or "|0400000US" in line or "|0500000US" in line:
                f.write(line)


def fetch_acs():
    for year in (2024, 2023):
        try:
            get(f"{ACS_BASE.format(y=year)}/data/5YRData/acsdt5y{year}-b01003.dat")
        except Exception:
            continue
        for t in ACS_TABLES:
            print(f"ACS {year} {t}")
            stream_filtered(f"{ACS_BASE.format(y=year)}/data/5YRData/acsdt5y{year}-{t}.dat", RAW / f"acs_{t}.psv")
        print(f"ACS {year} geos")
        stream_filtered(f"{ACS_BASE.format(y=year)}/documentation/Geos{year}5YR.txt", RAW / "acs_geos.psv")
        (RAW / "acs_year.txt").write_text(str(year))
        return
    raise SystemExit("No ACS 5-year summary file found for 2024 or 2023")


def fetch_branches():
    counts, offset = {}, 0
    while True:
        rows = json.loads(get(FDIC_LOCATIONS.format(o=offset)))["data"]
        for row in rows:
            fips = row["data"].get("STCNTY")
            if fips:
                counts[fips] = counts.get(fips, 0) + 1
        print(f"FDIC branches {offset + len(rows)}")
        if len(rows) < 10000:
            break
        offset += 10000
    (RAW / "fdic_branches.json").write_text(json.dumps(counts))


def fetch_fdic_state_rates():
    """Parse Table G.2 (fully banked, underbanked, unbanked by state, 2023) from the appendix PDF."""
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(get(FDIC_APPENDIX)))
    row = re.compile(r"^([A-Z]{2}) [\d,]+ 100\.0 ([\d.]+) ([\d.]+) ([\d.]+)\s*$")
    rates = {}
    for page in reader.pages:
        text = page.extract_text() or ""
        if "G.2" not in text or "by State" not in text:
            continue
        for line in text.splitlines():
            m = row.match(line.strip())
            if m:
                rates[m[1]] = {"underbanked": float(m[3]) / 100, "unbanked": float(m[4]) / 100}
    if len(rates) != 51:
        raise SystemExit(f"Expected 51 state rows in FDIC table G.2, got {len(rates)}")
    with open(RAW / "fdic_state_rates_2023.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["state_abbr", "unbanked_rate", "underbanked_rate"])
        for abbr, r in sorted(rates.items()):
            w.writerow([abbr, r["unbanked"], r["underbanked"]])
    print("FDIC state rates 51")


def fetch_gazetteer():
    for year in (2025, 2024, 2023):
        try:
            z = zipfile.ZipFile(io.BytesIO(get(GAZETTEER.format(y=year))))
        except Exception:
            continue
        (RAW / "gazetteer_counties.txt").write_bytes(z.read(z.namelist()[0]))
        print(f"Gazetteer {year}")
        return
    raise SystemExit("No Census Gazetteer counties file found")


if __name__ == "__main__":
    RAW.mkdir(exist_ok=True)
    fetch_acs()
    fetch_branches()
    fetch_fdic_state_rates()
    fetch_gazetteer()
