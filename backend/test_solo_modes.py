"""Tests for the solo modes (Leiter, Limitierte Versuche, Doppelziel, Sudden Death).

These need a bigger fixture than test_api.py's two games: Doppelziel draws two
distinct games that are neither of them the daily, which is impossible in a pool
of two.
"""

import json
import os
import pickle
import tempfile

import numpy as np
import pytest
from pybloom_live import BloomFilter
from fastapi.testclient import TestClient

VOCAB = ["apfel", "birne", "kirsche", "auto", "haus", "baum"]

# One rank permutation per game. Game N's target (rank 1) is VOCAB[N-1], so the
# targets stay easy to assert against.
RANKS = [
    [1, 2, 3, 4, 5, 6],
    [2, 1, 3, 4, 5, 6],
    [3, 2, 1, 4, 5, 6],
    [4, 2, 3, 1, 5, 6],
    [5, 2, 3, 4, 1, 6],
]


@pytest.fixture
def data_dir():
    with tempfile.TemporaryDirectory() as tmpdir:
        vocab = {w: i for i, w in enumerate(VOCAB)}
        with open(os.path.join(tmpdir, "vocabulary.json"), "w", encoding="utf-8") as f:
            json.dump(vocab, f)

        lemma_map = {"äpfel": "apfel"}
        with open(os.path.join(tmpdir, "lemma_map.json"), "w", encoding="utf-8") as f:
            json.dump(lemma_map, f)

        bf = BloomFilter(capacity=100, error_rate=0.01)
        for w in list(vocab) + list(lemma_map):
            bf.add(w)
        with open(os.path.join(tmpdir, "bloom.bin"), "wb") as f:
            pickle.dump(bf, f)

        with open(os.path.join(tmpdir, "target_words.json"), "w", encoding="utf-8") as f:
            json.dump(VOCAB[: len(RANKS)], f)

        metadata = {"start_date": "2026-01-01", "vocab_size": len(VOCAB), "total_games": len(RANKS)}
        with open(os.path.join(tmpdir, "metadata.json"), "w", encoding="utf-8") as f:
            json.dump(metadata, f)

        games_dir = os.path.join(tmpdir, "games")
        os.makedirs(games_dir)
        for i, ranks in enumerate(RANKS, start=1):
            np.savez_compressed(
                os.path.join(games_dir, f"{i:04d}.npz"),
                ranks=np.array(ranks, dtype=np.uint16),
            )

        yield tmpdir


@pytest.fixture
def client(data_dir):
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


class TestWordAtRank:
    def test_returns_the_word_at_that_rank(self, client):
        resp = client.get("/api/word-at-rank?rank=3&game=2&infinite=true")
        assert resp.status_code == 200
        data = resp.json()
        assert data["rank"] == 3
        assert data["gameNumber"] == 2
        # Game 2 ranks: apfel=2, birne=1, kirsche=3 -> rank 3 is kirsche.
        assert data["word"] == "kirsche"

    def test_rank_one_is_refused(self, client):
        """The solution must not be readable through this endpoint."""
        resp = client.get("/api/word-at-rank?rank=1&game=2&infinite=true")
        assert resp.status_code == 422

    def test_rank_beyond_the_vocabulary(self, client):
        resp = client.get("/api/word-at-rank?rank=9999&game=2&infinite=true")
        assert resp.status_code == 404
        assert resp.json()["error"] == "rank_out_of_range"


class TestDualNext:
    def test_two_distinct_games_and_never_the_daily(self, client):
        for _ in range(20):
            resp = client.get("/api/dual/next")
            assert resp.status_code == 200
            games = resp.json()["gameNumbers"]
            assert len(games) == 2
            assert games[0] != games[1]
            assert 1 not in games, "the daily game must never be handed to Doppelziel"

    def test_exclusion_is_honoured_while_the_pool_allows_it(self, client):
        # Daily is 1, excluding 2 and 3 leaves exactly {4, 5}.
        resp = client.get("/api/dual/next?exclude=2,3")
        assert resp.status_code == 200
        assert sorted(resp.json()["gameNumbers"]) == [4, 5]

    def test_exhausted_pool_relaxes_instead_of_failing(self, client):
        resp = client.get("/api/dual/next?exclude=2,3,4,5")
        assert resp.status_code == 200
        games = resp.json()["gameNumbers"]
        assert len(games) == 2 and 1 not in games


class TestDualGuess:
    def test_returns_both_ranks(self, client):
        resp = client.post("/api/dual/guess?games=2,3", json={"word": "apfel"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["word"] == "apfel"
        assert data["ranks"] == [
            {"gameNumber": 2, "rank": 2},
            {"gameNumber": 3, "rank": 3},
        ]
        assert data["total"] == len(VOCAB)

    def test_lemma_is_normalized_once_for_both(self, client):
        resp = client.post("/api/dual/guess?games=2,3", json={"word": "Äpfel"})
        assert resp.status_code == 200
        assert resp.json()["word"] == "apfel"

    def test_identical_games_are_refused(self, client):
        resp = client.post("/api/dual/guess?games=2,2", json={"word": "apfel"})
        assert resp.status_code == 400
        assert resp.json()["error"] == "invalid_game"

    def test_single_game_is_refused(self, client):
        resp = client.post("/api/dual/guess?games=2", json={"word": "apfel"})
        assert resp.status_code == 400

    def test_game_out_of_range_is_refused(self, client):
        resp = client.post("/api/dual/guess?games=2,99", json={"word": "apfel"})
        assert resp.status_code == 400

    def test_unknown_word(self, client):
        resp = client.post("/api/dual/guess?games=2,3", json={"word": "xyz123"})
        assert resp.status_code == 404
        assert resp.json()["error"] == "unknown_word"


class TestSuddenDeath:
    def test_serves_runners_up_without_the_solution(self, client):
        resp = client.get("/api/sudden-death")
        assert resp.status_code == 200
        data = resp.json()
        assert data["gameNumber"] != 1, "the daily game must never be handed out here"
        ranks = [h["rank"] for h in data["hints"]]
        assert ranks == [2, 3, 4, 5, 6]
        assert 1 not in ranks

        # The words handed out must not include the game's target word.
        target = VOCAB[data["gameNumber"] - 1]
        assert target not in [h["word"] for h in data["hints"]]

    def test_exclusion_is_honoured(self, client):
        resp = client.get("/api/sudden-death?exclude=2,3,4")
        assert resp.status_code == 200
        assert resp.json()["gameNumber"] == 5

    def test_a_game_with_a_blocked_runner_up_is_not_dealt(self, client, monkeypatch):
        # kirsche is a runner-up everywhere except in game 3, where it is the
        # solution, so game 3 is the only one left to deal.
        import main as main_module
        from game import GameState

        monkeypatch.setattr(GameState, "is_handout_blocked", lambda self, word: word == "kirsche")
        main_module._game_state = None
        for _ in range(10):
            resp = client.get("/api/sudden-death")
            assert resp.status_code == 200
            assert resp.json()["gameNumber"] == 3
        main_module._game_state = None

    def test_no_clean_game_is_a_404(self, client, monkeypatch):
        # apfel or kirsche is a runner-up in every game but the daily one.
        import main as main_module
        from game import GameState

        monkeypatch.setattr(GameState, "is_handout_blocked", lambda self, word: word in {"apfel", "kirsche"})
        main_module._game_state = None
        resp = client.get("/api/sudden-death")
        assert resp.status_code == 404
        main_module._game_state = None


class TestSoloModeAttribution:
    def test_guess_counts_under_the_requested_solo_mode(self, client):
        import asyncio

        import analytics
        import main as main_module

        resp = client.post("/api/guess?game=2&infinite=true&mode=leiter", json={"word": "apfel"})
        assert resp.status_code == 200
        asyncio.run(analytics.flush_counters())

        counters = _counters(main_module._db_path)
        assert counters.get(("guesses", "leiter")) == 1

    def test_an_unknown_mode_falls_back_instead_of_creating_a_dimension(self, client):
        import asyncio

        import analytics
        import main as main_module

        resp = client.post(
            "/api/guess?game=2&infinite=true&mode=../evil", json={"word": "apfel"}
        )
        assert resp.status_code == 200
        asyncio.run(analytics.flush_counters())

        counters = _counters(main_module._db_path)
        assert ("guesses", "../evil") not in counters
        assert counters.get(("guesses", "infinite")) == 1


def _counters(db_path: str) -> dict[tuple[str, str], int]:
    import sqlite3

    con = sqlite3.connect(db_path)
    try:
        rows = con.execute(
            "SELECT metric, dimension, SUM(value) FROM analytics_counters GROUP BY metric, dimension"
        ).fetchall()
    finally:
        con.close()
    return {(m, d): v for m, d, v in rows}
