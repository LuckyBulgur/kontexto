"""Tests for FastAPI endpoints."""

import json
import os
import pickle
import tempfile

import numpy as np
import pytest
from pybloom_live import BloomFilter
from fastapi.testclient import TestClient


@pytest.fixture
def data_dir():
    """Create a temporary data directory with all required files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        vocab = {"apfel": 0, "birne": 1, "kirsche": 2, "auto": 3, "haus": 4}
        with open(os.path.join(tmpdir, "vocabulary.json"), "w", encoding="utf-8") as f:
            json.dump(vocab, f)

        lemma_map = {"äpfel": "apfel", "häuser": "haus"}
        with open(os.path.join(tmpdir, "lemma_map.json"), "w", encoding="utf-8") as f:
            json.dump(lemma_map, f)

        bf = BloomFilter(capacity=100, error_rate=0.01)
        for w in list(vocab.keys()) + list(lemma_map.keys()):
            bf.add(w)
        with open(os.path.join(tmpdir, "bloom.bin"), "wb") as f:
            pickle.dump(bf, f)

        targets = ["apfel", "birne"]
        with open(os.path.join(tmpdir, "target_words.json"), "w", encoding="utf-8") as f:
            json.dump(targets, f)

        metadata = {"start_date": "2026-01-01", "vocab_size": 5, "total_games": 2}
        with open(os.path.join(tmpdir, "metadata.json"), "w", encoding="utf-8") as f:
            json.dump(metadata, f)

        games_dir = os.path.join(tmpdir, "games")
        os.makedirs(games_dir)

        # Game 1: apfel is the target (rank 1). Game 2: birne is the target.
        np.savez_compressed(
            os.path.join(games_dir, "0001.npz"),
            ranks=np.array([1, 2, 3, 4, 5], dtype=np.uint16),
        )
        np.savez_compressed(
            os.path.join(games_dir, "0002.npz"),
            ranks=np.array([2, 1, 3, 4, 5], dtype=np.uint16),
        )

        yield tmpdir


@pytest.fixture
def client(data_dir):
    """Create a test client with mocked data."""
    os.environ["KONTEXTO_DATA_DIR"] = data_dir
    os.environ["KONTEXTO_FORCE_GAME"] = "1"

    import main as main_module
    main_module._game_state = None

    from main import app
    with TestClient(app) as c:
        yield c

    del os.environ["KONTEXTO_DATA_DIR"]
    del os.environ["KONTEXTO_FORCE_GAME"]
    main_module._game_state = None


class TestGuessEndpoint:
    def test_valid_guess(self, client):
        resp = client.post("/api/guess", json={"word": "apfel"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["word"] == "apfel"
        assert data["rank"] == 1
        assert data["total"] == 5

    def test_unknown_word(self, client):
        resp = client.post("/api/guess", json={"word": "xyz123"})
        assert resp.status_code == 404
        assert resp.json()["error"] == "unknown_word"

    def test_lemmatized_word(self, client):
        resp = client.post("/api/guess", json={"word": "Äpfel"})
        assert resp.status_code == 200
        assert resp.json()["word"] == "apfel"

    def test_empty_word(self, client):
        resp = client.post("/api/guess", json={"word": ""})
        assert resp.status_code == 422

    def test_typo_is_scored_as_the_corrected_word(self, client):
        resp = client.post("/api/guess", json={"word": "birnne"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["word"] == "birne"
        assert data["corrected_from"] == "birnne"
        assert data["rank"] == 2

    def test_valid_guess_reports_no_correction(self, client):
        assert client.post("/api/guess", json={"word": "apfel"}).json()["corrected_from"] is None

    def test_ambiguous_typo_is_offered_instead_of_applied(self, client):
        # Four letters: too little evidence to rewrite the guess by itself.
        resp = client.post("/api/guess", json={"word": "haas"})
        assert resp.status_code == 404
        body = resp.json()
        assert body["error"] == "unknown_word"
        assert body["suggestions"] == ["haus"]

    def test_unknown_word_without_candidates_has_no_suggestions(self, client):
        assert client.post("/api/guess", json={"word": "xyz123"}).json()["suggestions"] == []


class TestTipEndpoint:
    def test_easy_tip(self, client):
        resp = client.get("/api/tip?difficulty=easy&best_rank=5")
        assert resp.status_code == 200
        data = resp.json()
        assert "word" in data
        assert "rank" in data

    def test_medium_tip(self, client):
        resp = client.get("/api/tip?difficulty=medium&best_rank=5")
        assert resp.status_code == 200

    def test_invalid_difficulty(self, client):
        resp = client.get("/api/tip?difficulty=invalid")
        assert resp.status_code == 422


class TestGameInfoEndpoint:
    def test_game_info(self, client):
        resp = client.get("/api/game")
        assert resp.status_code == 200
        data = resp.json()
        assert data["gameNumber"] == 1
        assert data["total"] == 5
        assert "date" in data
        # The fixture has no first_curated_game key, so every game is curated.
        assert data["firstCuratedGame"] == 1


class TestRevealEndpoint:
    def test_reveal(self, client):
        resp = client.get("/api/reveal")
        assert resp.status_code == 200
        data = resp.json()
        assert data["word"] == "apfel"


class TestInfiniteEndpoint:
    def test_next_never_returns_daily(self, client):
        # Daily is forced to game 1; the pool has games {1, 2}, so next must be 2.
        for _ in range(30):
            resp = client.get("/api/infinite/next")
            assert resp.status_code == 200
            data = resp.json()
            assert data["gameNumber"] == 2
            assert data["total"] == 5
            assert data["totalGames"] == 2

    def test_next_404_when_pool_drained(self, client):
        # Pool is {1, 2}; daily (1) and the current game (2) are both excluded,
        # leaving nothing to hand out -> a clean 404 the client can surface.
        resp = client.get("/api/infinite/next?current=2")
        assert resp.status_code == 404
        assert resp.json()["error"] == "no_games"

    def test_played_exclusion_relaxes_when_exhausted(self, client):
        # current is unset, daily is 1, game 2 already "played": excluding the
        # played set drains the pool, so the exclusion relaxes back to {daily}
        # and game 2 is returned again (the mode never ends).
        resp = client.get("/api/infinite/next?exclude=2")
        assert resp.status_code == 200
        assert resp.json()["gameNumber"] == 2

    def test_guess_infinite_uses_requested_game(self, client):
        # Game 2's target is "birne"; without the infinite flag the daily (game 1)
        # would rank "birne" at 2, not 1.
        resp = client.post("/api/guess?game=2&infinite=true", json={"word": "birne"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["word"] == "birne"
        assert data["rank"] == 1

    def test_reveal_infinite(self, client):
        resp = client.get("/api/reveal?game=2&infinite=true")
        assert resp.status_code == 200
        assert resp.json()["word"] == "birne"


class TestAdminStatsGameDifficulty:
    def test_kontexto_and_infinite_merge_per_word(self, client):
        """The endless mode shares Kontexto's word pool, so per-word difficulty
        merges both modes into one figure (same target word, one row)."""
        import asyncio

        import analytics
        import auth
        import main as main_module

        db_path = main_module._db_path

        async def seed():
            # Game 1's target is "apfel"; play it in both modes so the merged
            # figure has 2 solves + 1 reveal (= 3 finished, the display threshold).
            await analytics.record_game_stat(db_path, "kontexto", 1, "solves")
            await analytics.record_game_stat(db_path, "kontexto", 1, "guesses")
            await analytics.record_game_stat(db_path, "infinite", 1, "solves")
            await analytics.record_game_stat(db_path, "infinite", 1, "reveals")
            await analytics.record_game_stat(db_path, "infinite", 1, "guesses")

        asyncio.run(seed())

        token = auth.issue_session_token()
        resp = client.get("/api/admin/stats", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        diff = resp.json()["game_difficulty"]
        rows = [e for e in (diff["hardest"] + diff["easiest"]) if e["word"] == "apfel"]
        assert rows, "merged Kontexto/Unendlich word missing from difficulty ranking"
        e = rows[0]
        assert e["mode"] == "kontexto"
        assert e["solves"] == 2 and e["reveals"] == 1 and e["finished"] == 3
        assert e["guesses"] == 2


class TestMatchmakingLive:
    """The picker's load figures, the one matchmaking endpoint without a ticket."""

    def test_every_queue_mode_is_present_with_zeros(self, client):
        import main as main_module
        from matchmaking import QUEUE_MODES

        # The payload is cached per process, so a run that touched it earlier
        # would otherwise leak into this assertion.
        main_module._live_cache = None

        resp = client.get("/api/matchmaking/live")
        assert resp.status_code == 200
        data = resp.json()
        assert set(data["modes"]) == set(QUEUE_MODES)
        assert all(
            entry == {"waiting": 0, "playing": 0} for entry in data["modes"].values()
        )
        assert data["waiting_total"] == 0 and data["playing_total"] == 0

    def test_a_queued_player_shows_up_in_the_totals(self, client):
        import main as main_module

        main_module._live_cache = None
        client.post("/api/matchmaking/enqueue", json={"mode": "koop", "nickname": "Ada"})

        main_module._live_cache = None
        data = client.get("/api/matchmaking/live").json()
        assert data["modes"]["koop"]["waiting"] == 1
        assert data["waiting_total"] == 1
        assert data["modes"]["duel"]["waiting"] == 0

    def test_the_answer_is_cached_for_a_few_seconds(self, client):
        import main as main_module

        main_module._live_cache = None
        first = client.get("/api/matchmaking/live").json()
        client.post("/api/matchmaking/enqueue", json={"mode": "duel", "nickname": "Bob"})
        second = client.get("/api/matchmaking/live").json()
        assert first == second, "a new ticket must not invalidate the cache early"

        main_module._live_cache = None
        assert client.get("/api/matchmaking/live").json()["modes"]["duel"]["waiting"] == 1



class TestPopularModesEndpoint:
    """The picker's badge, as the client sees it."""

    def test_an_empty_site_names_nobody(self, client):
        import main as main_module
        # The answer is cached per worker for five minutes, which would
        # otherwise carry an answer from a previous test into this one.
        main_module._popular_cache = None

        res = client.get("/api/modes/popular")
        assert res.status_code == 200
        body = res.json()
        # Every group is a key, so the client never has to tell "no leader"
        # apart from "this tab was forgotten".
        assert body["solo"] is None
        assert body["friends"] is None
        assert body["strangers"] is None
        assert body["window_days"] > 0

    def test_no_figures_leave_the_server(self, client):
        import main as main_module
        main_module._popular_cache = None

        body = client.get("/api/modes/popular").json()
        # The dialog asks which mode is popular. How much traffic this site has
        # is a different question and is not answered here.
        assert set(body) == {"solo", "friends", "strangers", "window_days"}


class TestWordRatingEndpoint:
    """The tally endpoint, and the one gate that reads differently from reveal.

    ``_resolve_game_number`` refuses a game named by number once its date is
    today or later, which is right for reveal: naming today would hand out the
    answer the daily player is still looking for. A tally of three numbers hands
    out nothing, and today's puzzle is the one everybody is voting on, so it has
    to be readable. It was not, and the first local run found it.
    """

    def test_todays_game_is_readable_by_number(self, client):
        # KONTEXTO_FORCE_GAME pins the daily to 1, so this is today's puzzle.
        resp = client.get("/api/rating?game=1")
        assert resp.status_code == 200
        assert resp.json()["game_number"] == 1

    def test_todays_game_is_readable_without_a_number(self, client):
        resp = client.get("/api/rating")
        assert resp.status_code == 200
        assert resp.json()["game_number"] == 1

    def test_a_game_the_resolver_refuses_is_refused_here_too(self, client):
        """Everything except today still goes through _resolve_game_number.

        The fixture pool starts on 2026-01-01 and holds two games, so it cannot
        produce a game whose date is in the future; the out-of-range case is the
        one this fixture can state. The date gate itself belongs to
        _resolve_game_number and is held where that is tested.
        """
        resp = client.get("/api/rating?game=9999")
        assert resp.status_code == 400
        assert resp.json()["error"] == "invalid_game"

    def test_the_tally_starts_silent(self, client):
        data = client.get("/api/rating").json()
        assert data["total"] == 0
        assert data["enough"] is False

    def test_a_vote_without_a_token_is_not_an_error(self, client):
        resp = client.post("/api/rating",
                           json={"token": "garbage", "game_number": 1, "verdict": "hard"})
        assert resp.status_code == 200
        assert resp.json() == {"ok": False}

    def test_an_unknown_verdict_is_a_validation_error(self, client):
        resp = client.post("/api/rating",
                           json={"token": "x", "game_number": 1, "verdict": "grandios"})
        assert resp.status_code == 422



class TestRetiredConsentEndpoint:
    def test_collect_consent_is_gone(self, client):
        resp = client.post("/api/collect/consent", json={"token": "x", "kind": "shown"})
        assert resp.status_code in (404, 405)
