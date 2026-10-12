"""Output checks. They return warnings for a human reviewer; they never silently edit text."""
import re

# CLAUDE.md banned terms. Word-start match so "race" doesn't fire on "embrace" or "trace".
BANNED = ["immigra", "undocumented", "illegal alien", "citizen", "itin", "ssn", "foreign-born", "nativity",
          "national origin", "race", "ethnic", "hispanic", "latino", "religion", "deport"]
_BANNED_RE = [(t, re.compile(rf"\b{re.escape(t)}" + (r"\b" if t in ("race", "itin", "ssn") else ""), re.I)) for t in BANNED]

# design constants and small integers the plan may use without a matching fact
ALLOWED = {33.4, 12, 6, 90, 30, 1000, 10000, 150, 1.15, 100, 100000, 5, 10, 2}
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
    known = fact_numbers(facts)
    warnings = []
    for raw, unit in _NUM_RE.findall(text):
        v = _parse(raw, unit)
        if v is None:
            continue
        plain = float(raw.replace("$", "").replace(",", ""))
        if (2020 <= plain <= 2030 and not unit and "$" not in raw) or (plain.is_integer() and abs(plain) < 13 and not unit) or plain in ALLOWED:
            continue
        if not any(abs(v - k) <= max(abs(k) * 0.01, 0.5 if abs(k) >= 50 else 0.005) for k in known):
            warnings.append(f"Number {raw.strip()}{unit or ''} does not match any provided fact.")
    return list(dict.fromkeys(warnings))[:10]


def revenue_wording(text: str) -> list[str]:
    """Warn when 'revenue' sits within 10 words of a network volume mention."""
    words = re.findall(r"\S+", text.lower())
    vol = [i for i in range(len(words) - 1) if words[i].startswith("network") and words[i + 1].startswith("volume")]
    rev = [i for i, w in enumerate(words) if w.startswith("revenue")]
    if any(abs(r - v) <= 10 for r in rev for v in vol) and "not mastercard revenue" not in text.lower():
        return ["Network volume is described near 'revenue'. Volume is spend on the network, not Mastercard revenue."]
    return []


def length(text: str, limit: int, kind: str) -> list[str]:
    n = len(text.split())
    return [f"{kind} is {n} words (limit {limit})."] if n > limit else []


def check(text: str, facts=None, limit: int = 250, kind: str = "Answer") -> list[str]:
    warnings = banned_terms(text) + revenue_wording(text) + length(text, limit, kind)
    if facts is not None:
        warnings += unmatched_numbers(text, facts)
    return warnings
