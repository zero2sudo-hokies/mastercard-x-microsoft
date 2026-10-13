"""Output checks. They return warnings for a human reviewer; they never silently edit text."""
import re

# CLAUDE.md banned terms. Word-start match so "race" doesn't fire on "embrace" or "trace".
BANNED = ["immigra", "undocumented", "illegal alien", "citizen", "itin", "ssn", "foreign-born", "nativity",
          "national origin", "race", "ethnic", "hispanic", "latino", "religion", "deport"]
_BANNED_RE = [(t, re.compile(rf"\b{re.escape(t)}" + (r"\b" if t in ("race", "itin", "ssn") else ""), re.I)) for t in BANNED]

# design constants and small integers the plan may use without a matching fact
ALLOWED = {12, 6, 90, 30, 1000, 10000, 150, 1.15, 100, 100000, 5, 10, 2}
_NUM_RE = re.compile(r"(?<![\w.])(-?\$?\d[\d,]*(?:\.\d+)?)\s*(%|[kKmMbB](?:n|illion)?\b)?")


def banned_terms(text: str) -> list[str]:
    return [f"Mentions a protected attribute: {t}" for t, rx in _BANNED_RE if rx.search(text)]


def _parse(raw: str, unit: str | None) -> float | None:
    try:
        v = float(raw.replace("$", "").replace(",", ""))
    except ValueError:
        return None
    u = (unit or "").lower()
    if u.startswith("k"):
        v *= 1e3
    elif u.startswith("m"):
        v *= 1e6
    elif u.startswith("b"):
        v *= 1e9
    elif u == "%":
        v /= 100
    return v


def fact_numbers(facts) -> list[float]:
    """Every number in the facts, plus x100 and /100 forms so 0.267 matches '26.7%' and '0.27'."""
    out = []

    def walk(x):
        if isinstance(x, bool):
            return
        if isinstance(x, (int, float)):
            out.extend([float(x), float(x) * 100, float(x) / 100])
        elif isinstance(x, dict):
            for v in x.values():
                walk(v)
        elif isinstance(x, (list, tuple)):
            for v in x:
                walk(v)
        elif isinstance(x, str):
            for raw, unit in _NUM_RE.findall(x):
                v = _parse(raw, unit)
                if v is not None:
                    out.extend([v, v * 100, v / 100])

    walk(facts)
    return out


def unmatched_numbers(text: str, facts) -> list[str]:
    known = [abs(k) for k in fact_numbers(facts)]
    text = text.replace("\u2212", "-").replace("\u2013", "-")  # unicode minus / en dash
    warnings = []
    for raw, unit in _NUM_RE.findall(text):
        v = _parse(raw, unit)
        if v is None:
            continue
        v = abs(v)
        plain = abs(float(raw.replace("$", "").replace(",", "")))
        if (2020 <= plain <= 2030 and not unit and "$" not in raw) or (plain.is_integer() and abs(plain) < 13 and not unit) or plain in ALLOWED:
            continue
        # "$1.7M" is rounded to its last shown digit, so allow half of that place too
        decimals = len(raw.split(".")[1]) if "." in raw else 0
        shown = 0.5 * 10 ** -decimals * (abs(v / plain) if plain else 1)
        if not any(abs(v - k) <= max(abs(k) * 0.01, shown, 0.5 if abs(k) >= 50 else 0.005) for k in known):
            warnings.append(f"Number {raw.strip()}{unit or ''} does not match any provided fact.")
    return list(dict.fromkeys(warnings))[:10]


def revenue_wording(text: str) -> list[str]:
    """Warn when a sentence presents network volume as revenue. Fine: 'network revenue ... (placeholder)' stated
    separately, or 'not Mastercard revenue'. Flagged: 'network volume of $27.7M is new revenue'."""
    for sentence in re.split(r"(?<=[.!?;])\s+|\n", text):
        low = sentence.lower()
        if "network volume" not in low or "revenue" not in low:
            continue
        for m in re.finditer(r"revenue", low):
            before, after = low[max(0, m.start() - 40):m.start()], low[m.end():m.end() + 30]
            if re.search(r"\b(not|never|isn't)\b", before) or before.rstrip().endswith("network") or "placeholder" in after:
                continue
            return ["Network volume is described as revenue. Volume is spend on the network, not Mastercard revenue."]
    return []


def length(text: str, limit: int, kind: str) -> list[str]:
    n = len(text.split())
    return [f"{kind} is {n} words (limit {limit})."] if n > limit else []


def check(text: str, facts=None, limit: int = 250, kind: str = "Answer") -> list[str]:
    warnings = banned_terms(text) + revenue_wording(text) + length(text, limit, kind)
    if facts is not None:
        warnings += unmatched_numbers(text, facts)
    return warnings
