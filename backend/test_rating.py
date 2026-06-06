"""Tests for the token-bound rating system.

Mirrors the sync style of test_duel.py: a ``db_path`` fixture (tempdir),
a ``db`` fixture that initialises the schema via the event loop, and sync
``def test_…`` functions that call async helpers through
``asyncio.get_event_loop().run_until_complete(…)``.
"""

import asyncio
import json
import os
import pickle  # nosec - needed for bloom filter serialization in test fixtures
import tempfile

import numpy as np
import pytest
from fastapi.testclient import TestClient
from pybloom_live import BloomFilter

from database import init_db
from rating import get_aggregate, record_rating


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def db_path():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield os.path.join(tmpdir, "ratings_test.db")


@pytest.fixture
def db(db_path):
    asyncio.get_event_loop().run_until_complete(init_db(db_path))
    return db_path


# Reuse the same game-data fixture pattern from test_duel.py so the TestClient
# has a fully valid GameState.
@pytest.fixture
def game_data_dir():
    with tempfile.TemporaryDirectory() as tmpdir:
        vocab = {"apfel": 0, "birne": 1, "kirsche": 2, "auto": 3, "haus": 4}
        with open(os.path.join(tmpdir, "vocabulary.json"), "w") as f:
            json.dump(vocab, f)

        lemma_map = {"aepfel": "apfel"}
        with open(os.path.join(tmpdir, "lemma_map.json"), "w") as f:
            json.dump(lemma_map, f)

        bf = BloomFilter(capacity=100, error_rate=0.01)
        for w in list(vocab.keys()) + list(lemma_map.keys()):
            bf.add(w)
        with open(os.path.join(tmpdir, "bloom.bin"), "wb") as f:  # nosec
            pickle.dump(bf, f)

        targets = ["apfel", "birne"]
        with open(os.path.join(tmpdir, "target_words.json"), "w") as f:
            json.dump(targets, f)

        metadata = {"start_date": "2026-01-01", "vocab_size": 5}
        with open(os.path.join(tmpdir, "metadata.json"), "w") as f:
            json.dump(metadata, f)

        games_dir = os.path.join(tmpdir, "games")
        os.makedirs(games_dir)
        ranks = np.array([1, 2, 3, 4, 5], dtype=np.uint16)
        np.savez_compressed(os.path.join(games_dir, "0001.npz"), ranks=ranks)

        yield tmpdir


@pytest.fixture
def api_client(game_data_dir):
    os.environ["KONTEXTO_DATA_DIR"] = game_data_dir
    os.environ["KONTEXTO_FORCE_GAME"] = "1"
    os.environ["KONTEXTO_DEV"] = "1"

    import main as main_module

    main_module._game_state = None

    from main import app

    with TestClient(app) as c:
        yield c

    del os.environ["KONTEXTO_DATA_DIR"]
    del os.environ["KONTEXTO_FORCE_GAME"]
    del os.environ["KONTEXTO_DEV"]
    main_module._game_state = None


# ---------------------------------------------------------------------------
# Unit tests (direct async helpers, no HTTP layer)
# ---------------------------------------------------------------------------


class TestRatingUnit:
    def _run(self, coro):
        return asyncio.get_event_loop().run_until_complete(coro)

    def test_two_distinct_tokens_aggregate(self, db):
        """Two ratings from different tokens → count 2, correct average."""
        self._run(record_rating(db, "token-a", 5))
        self._run(record_rating(db, "token-b", 3))
        agg = self._run(get_aggregate(db))
        assert agg["ratingCount"] == 2
        assert agg["ratingValue"] == 4.0

    def test_upsert_same_token(self, db):
        """Updating a token's rating replaces it (upsert); count stays 1."""
        self._run(record_rating(db, "token-x", 1))
        self._run(record_rating(db, "token-x", 5))
        agg = self._run(get_aggregate(db))
        assert agg["ratingCount"] == 1
        assert agg["ratingValue"] == 5.0

    def test_invalid_value_raises(self, db):
        """Values outside 1–5 must raise ValueError."""
        with pytest.raises(ValueError):
            self._run(record_rating(db, "token-bad", 6))

    def test_invalid_value_zero_raises(self, db):
        with pytest.raises(ValueError):
            self._run(record_rating(db, "token-bad", 0))

    def test_invalid_value_non_int_raises(self, db):
        with pytest.raises(ValueError):
            self._run(record_rating(db, "token-bad", 3.5))  # type: ignore[arg-type]

    def test_empty_db_aggregate(self, db):
        """Fresh DB → count 0, value 0.0."""
        agg = self._run(get_aggregate(db))
        assert agg["ratingCount"] == 0
        assert agg["ratingValue"] == 0.0


# ---------------------------------------------------------------------------
# Endpoint tests (TestClient, token obtained from /api/collect/token)
# ---------------------------------------------------------------------------


class TestRatingEndpoints:
    def test_get_rating_empty(self, api_client):
        """GET /api/rating on a fresh DB returns zero aggregate."""
        resp = api_client.get("/api/rating")
        assert resp.status_code == 200
        data = resp.json()
        assert data["ratingCount"] == 0
        assert data["ratingValue"] == 0.0

    def test_post_rating_valid(self, api_client):
        """POST /api/rating with a valid token → 200 + aggregate."""
        token_resp = api_client.get("/api/collect/token")
        assert token_resp.status_code == 200
        token = token_resp.json()["token"]

        resp = api_client.post("/api/rating", json={"token": token, "value": 4})
        assert resp.status_code == 200
        data = resp.json()
        assert data["ratingCount"] == 1
        assert data["ratingValue"] == 4.0

    def test_post_rating_invalid_token(self, api_client):
        """POST /api/rating with a forged token → 403."""
        resp = api_client.post("/api/rating", json={"token": "forged-token-xyz", "value": 4})
        assert resp.status_code == 403

    def test_get_rating_after_post(self, api_client):
        """GET /api/rating reflects previously submitted ratings."""
        token_resp = api_client.get("/api/collect/token")
        token = token_resp.json()["token"]
        api_client.post("/api/rating", json={"token": token, "value": 5})

        resp = api_client.get("/api/rating")
        assert resp.status_code == 200
        data = resp.json()
        assert data["ratingCount"] == 1
        assert data["ratingValue"] == 5.0
