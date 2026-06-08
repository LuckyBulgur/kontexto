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
