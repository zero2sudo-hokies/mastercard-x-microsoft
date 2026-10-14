import time

from fastapi.testclient import TestClient

from app.main import app
from app.services.lookalikes import haversine_km
from app.store import store

client = TestClient(app)
FIPS = "48215"


def test_health():
    body = client.get("/api/health").json()
    assert body["status"] == "ok" and set(body["data_source"]) == {"areas", "frustration"}


def test_gets_are_fast_and_ok():
    for url in ["/api/areas?level=state", "/api/areas?level=county", f"/api/areas?level=county&state={FIPS[:2]}",
                f"/api/areas/{FIPS}", f"/api/areas/{FIPS}/lookalikes?n=5", "/api/recommendations",
                "/api/benefits", "/api/assumptions"]:
        client.get(url)  # warm
        start = time.perf_counter()
        r = client.get(url)
        assert r.status_code == 200, url
        assert (time.perf_counter() - start) * 1000 < 100, url


def test_errors_are_plain_detail():
    assert client.get("/api/areas/99999").json() == {"detail": "Unknown fips 99999"}
    r = client.get("/api/areas?level=city")
    assert r.status_code == 422 and isinstance(r.json()["detail"], str)
    assert client.post("/api/roi", json={"fips": "99999"}).status_code == 404
    assert client.post("/api/roi", json={"fips": FIPS, "churn": 2}).status_code == 422


def test_lookalikes_far_enough_and_not_self():
    target = store.areas[FIPS]
    for la in client.get(f"/api/areas/{FIPS}/lookalikes?n=5").json():
        assert la["fips"] != FIPS
        assert haversine_km(target.centroid, store.areas[la["fips"]].centroid) >= 150
        assert 0 < la["similarity"] <= 1


def test_profile_and_roi_shapes():
    p = client.get(f"/api/areas/{FIPS}").json()
    assert set(p) == {"area", "frustration", "benefit", "lookalikes", "labels"}
    r = client.post("/api/roi", json={"fips": FIPS, "issuer_type": "community", "adoption_rate": 0.03,
                                      "churn": None, "cac": None, "fixed_program_cost": 75000, "network_yield": None}).json()
    assert r["area"]["est_underserved_hh"] == store.areas[FIPS].est_underserved_hh
    assert r["labels"][1].startswith("Network volume is spend on Mastercard's network")


def test_no_protected_words_in_responses():
    banned = ("immigra", "undocumented", "citizen", "itin", "foreign-born", "nativity", "national origin",
              "race", "ethnic", "hispanic", "latino", "religion", "deport")
    text = " ".join(client.get(u).text.lower() for u in
                    [f"/api/areas/{FIPS}", "/api/recommendations?limit=50", "/api/benefits"])
    assert not [w for w in banned if w in text]


def test_ai_routes_are_rate_limited(monkeypatch):
    from app import main
    from app.config import settings
    monkeypatch.setattr(type(settings), "ai_requests_per_hour", property(lambda self: 2))
    monkeypatch.setattr(type(settings), "ai_configured", property(lambda self: False))
    main._ai_calls.clear()
    body = {"messages": [{"role": "user", "content": "where to pilot?"}]}
    headers = {"x-forwarded-for": "203.0.113.9"}
    codes = [client.post("/api/chat", json=body, headers=headers).status_code for _ in range(3)]
    assert codes[:2] != [429, 429] and codes[2] == 429
    assert client.get("/api/health", headers=headers).status_code == 200  # reads are never limited
    main._ai_calls.clear()


def test_bank_leaderboard_and_compare():
    if not store.banks:
        import pytest
        pytest.skip("banks.json not built")
    fips = next(f for f in ("36005", "48215") if f in store.areas)
    lb = client.get(f"/api/areas/{fips}/banks?n=5").json()
    banks = lb["banks"]
    assert banks and [b["rank"] for b in banks] == list(range(1, len(banks) + 1))
    shares = [b["deposit_share"] for b in banks]
    assert shares == sorted(shares, reverse=True) and sum(shares) <= 1.0001
    assert all(b["issuer_type"] == ("community" if b["total_assets"] < 10e9 else "large_bank") for b in banks)
    certs = [b["cert"] for b in banks[:3]]
    cmp = client.post("/api/banks/compare", json={"fips": fips, "certs": certs, "churn": 0.2}).json()
    assert [r["bank"]["cert"] for r in cmp["rows"]] == certs
    for r in cmp["rows"]:
        assert r["roi"]["inputs"]["issuer_type"] == r["bank"]["issuer_type"] and r["roi"]["inputs"]["churn"] == 0.2
    assert client.post("/api/banks/compare", json={"fips": fips, "certs": certs[:1]}).status_code == 422
    assert client.post("/api/banks/compare", json={"fips": fips, "certs": ["0", certs[0]]}).status_code == 404


def test_branch_pins():
    if not store.branches:
        import pytest
        pytest.skip("branches.json not built")
    fips = next(f for f in ("36005", "48215") if f in store.areas)
    pins = client.get(f"/api/areas/{fips}/branches").json()["branches"]
    assert pins and all(-180 < p["lon"] < -60 and 15 < p["lat"] < 72 for p in pins)
    top = client.get(f"/api/areas/{fips}/banks?n=1").json()["banks"][0]
    ranked = [p for p in pins if p["rank"] == 1]
    assert len(ranked) == top["branches"] and all(p["bank"] == top["name"] for p in ranked)
    assert client.get("/api/areas/36/branches").status_code == 400
