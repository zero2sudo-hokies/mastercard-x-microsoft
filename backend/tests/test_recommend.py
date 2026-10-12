from app.services.merge import SUMMARIES, priority_score
from app.services.recommend import percentiles, recommendations
from app.store import store


def test_priority_score():
    assert priority_score(91.2, 78.4) == 84.8
    assert priority_score(91.2, None) is None


def test_percentiles():
    assert percentiles({"a": 1, "b": 2, "c": 3}) == {"a": 0, "b": 50, "c": 100}
    assert percentiles({"a": 5}) == {"a": 100}


def test_only_ok_areas_ranked_by_priority():
    recs = recommendations("county", limit=100)
    assert recs, "fixtures or pipeline should give at least one ok county"
    assert all(store.frustration[r.fips].status == "ok" for r in recs)
    scores = [r.priority_score for r in recs]
    assert scores == sorted(scores, reverse=True)
    assert [r.rank for r in recs] == list(range(1, len(recs) + 1))
    assert all(2 <= len(r.reasons) <= 3 for r in recs)


def test_topic_mode_uses_topic_benefit_and_state_filter():
    recs = recommendations("county", topic="fees", limit=100)
    assert all(r.benefit_id == "no_fee_account" for r in recs)
    state = recs[0].fips[:2]
    assert all(r.fips.startswith(state) for r in recommendations("county", state=state, topic="fees"))


def test_missing_frustration_is_no_data():
    for s in SUMMARIES["county"]:
        if s.fips not in store.frustration:
            assert s.frustration_status == "no_data" and s.priority_score is None
