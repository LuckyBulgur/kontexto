"""Tests for duel mode."""

import asyncio
import json
import os
import pickle  # nosec - needed for bloom filter serialization in test fixtures
import tempfile

import numpy as np
import pytest
import aiosqlite
from pybloom_live import BloomFilter
from fastapi.testclient import TestClient

from database import init_db, get_db


@pytest.fixture
def db_path():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield os.path.join(tmpdir, "duels.db")


@pytest.fixture
def db(db_path):
    asyncio.get_event_loop().run_until_complete(init_db(db_path))
    return db_path


class TestDatabase:
    def test_init_db_creates_tables(self, db_path):
        asyncio.get_event_loop().run_until_complete(init_db(db_path))

        async def check():
            conn = await aiosqlite.connect(db_path)
            cursor = await conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
            )
            tables = [row[0] for row in await cursor.fetchall()]
            await conn.close()
            assert "duels" in tables
            assert "duel_players" in tables
            assert "duel_guesses" in tables

        asyncio.get_event_loop().run_until_complete(check())

    def test_init_db_idempotent(self, db_path):
        loop = asyncio.get_event_loop()
        loop.run_until_complete(init_db(db_path))
        loop.run_until_complete(init_db(db_path))


class TestDuelCRUD:
    def _run(self, coro):
        return asyncio.get_event_loop().run_until_complete(coro)

    def test_create_duel(self, db):
        from duel import create_duel
        async def run():
            conn = await get_db(db)
            try:
                result = await create_duel(conn, game_number=1, nickname="Alice", tips_allowed=True)
                assert "duel_id" in result
                assert "player_token" in result
                assert len(result["duel_id"]) == 6
            finally:
                await conn.close()
        self._run(run())

    def test_join_duel(self, db):
        from duel import create_duel, join_duel
        async def run():
            conn = await get_db(db)
            try:
                created = await create_duel(conn, game_number=1, nickname="Alice", tips_allowed=True)
                joined = await join_duel(conn, created["duel_id"], "Bob")
                assert joined is not None
                assert "player_token" in joined
                assert len(joined["players"]) == 2
            finally:
                await conn.close()
        self._run(run())

    def test_join_nonexistent_duel(self, db):
        from duel import join_duel
        async def run():
            conn = await get_db(db)
            try:
                result = await join_duel(conn, "XXXXXX", "Bob")
                assert result is None
            finally:
                await conn.close()
        self._run(run())

    def test_record_guess(self, db):
        from duel import create_duel, record_guess
        async def run():
            conn = await get_db(db)
            try:
                created = await create_duel(conn, game_number=1, nickname="Alice", tips_allowed=True)
                result = await record_guess(conn, created["duel_id"], created["player_token"], "apfel", 42)
                assert result is not None
                assert result["best_rank"] == 42
                assert result["guess_count"] == 1
                assert result["solved"] is False
                result2 = await record_guess(conn, created["duel_id"], created["player_token"], "birne", 10)
                assert result2["best_rank"] == 10
                assert result2["guess_count"] == 2
            finally:
                await conn.close()
        self._run(run())

    def test_record_guess_solved(self, db):
        from duel import create_duel, record_guess
        async def run():
            conn = await get_db(db)
            try:
                created = await create_duel(conn, game_number=1, nickname="Alice", tips_allowed=True)
                result = await record_guess(conn, created["duel_id"], created["player_token"], "ziel", 1)
                assert result["solved"] is True
            finally:
                await conn.close()
        self._run(run())

    def test_get_player_history(self, db):
        from duel import create_duel, record_guess, get_player_history
        async def run():
            conn = await get_db(db)
            try:
                created = await create_duel(conn, game_number=1, nickname="Alice", tips_allowed=True)
                await record_guess(conn, created["duel_id"], created["player_token"], "apfel", 42)
                await record_guess(conn, created["duel_id"], created["player_token"], "birne", 10)
                history = await get_player_history(conn, created["duel_id"], created["player_token"])
                assert len(history) == 2
                assert history[0]["word"] == "apfel"
                assert history[1]["word"] == "birne"
            finally:
                await conn.close()
        self._run(run())

    def test_get_duel_state(self, db):
        from duel import create_duel, get_duel_state
        async def run():
            conn = await get_db(db)
            try:
                created = await create_duel(conn, game_number=1, nickname="Alice", tips_allowed=True)
                state = await get_duel_state(conn, created["duel_id"])
                assert state is not None
                assert state["game_number"] == 1
                assert state["tips_allowed"] is True
                assert len(state["players"]) == 1
                assert state["players"][0]["nickname"] == "Alice"
            finally:
                await conn.close()
        self._run(run())

    def test_cleanup_stale_duels(self, db):
        from duel import create_duel, cleanup_stale_duels, get_duel_state
        async def run():
            conn = await get_db(db)
            try:
                created = await create_duel(conn, game_number=1, nickname="Alice", tips_allowed=True)
                await conn.execute(
                    "UPDATE duels SET last_activity = datetime('now', '-2 hours') WHERE id = ?",
                    (created["duel_id"],),
                )
                await conn.commit()
                await cleanup_stale_duels(conn)
                state = await get_duel_state(conn, created["duel_id"])
                assert state is None
            finally:
                await conn.close()
        self._run(run())

    def test_cleanup_keeps_active_duels(self, db):
        from duel import create_duel, cleanup_stale_duels, set_player_connected, get_duel_state
        async def run():
            conn = await get_db(db)
            try:
                created = await create_duel(conn, game_number=1, nickname="Alice", tips_allowed=True)
                await set_player_connected(conn, created["player_token"], True)
                await conn.execute(
                    "UPDATE duels SET last_activity = datetime('now', '-2 hours') WHERE id = ?",
                    (created["duel_id"],),
                )
                await conn.commit()
                await cleanup_stale_duels(conn)
                state = await get_duel_state(conn, created["duel_id"])
                assert state is not None
            finally:
                await conn.close()
        self._run(run())


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

    import main as main_module
    main_module._game_state = None

    from main import app
    with TestClient(app) as c:
        yield c

    del os.environ["KONTEXTO_DATA_DIR"]
    del os.environ["KONTEXTO_FORCE_GAME"]
    main_module._game_state = None


class TestDuelEndpoints:
    def test_create_duel(self, api_client):
        resp = api_client.post("/api/duel", json={
            "game_number": 1, "nickname": "Alice", "tips_allowed": True,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "duel_id" in data
        assert "player_token" in data

    def test_join_duel(self, api_client):
        created = api_client.post("/api/duel", json={
            "game_number": 1, "nickname": "Alice", "tips_allowed": True,
        }).json()
        resp = api_client.post(f"/api/duel/{created['duel_id']}/join", json={"nickname": "Bob"})
        assert resp.status_code == 200
        data = resp.json()
        assert "player_token" in data
        assert len(data["players"]) == 2

    def test_join_nonexistent_duel(self, api_client):
        resp = api_client.post("/api/duel/XXXXXX/join", json={"nickname": "Bob"})
        assert resp.status_code == 404

    def test_get_duel_state(self, api_client):
        created = api_client.post("/api/duel", json={
            "game_number": 1, "nickname": "Alice", "tips_allowed": True,
        }).json()
        resp = api_client.get(f"/api/duel/{created['duel_id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["game_number"] == 1
        assert len(data["players"]) == 1

    def test_duel_guess(self, api_client):
        created = api_client.post("/api/duel", json={
            "game_number": 1, "nickname": "Alice", "tips_allowed": True,
        }).json()
        resp = api_client.post(f"/api/duel/{created['duel_id']}/guess", json={
            "word": "birne", "player_token": created["player_token"],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["word"] == "birne"
        assert "rank" in data

    def test_duel_guess_unknown_word(self, api_client):
        created = api_client.post("/api/duel", json={
            "game_number": 1, "nickname": "Alice", "tips_allowed": True,
        }).json()
        resp = api_client.post(f"/api/duel/{created['duel_id']}/guess", json={
            "word": "xyz123", "player_token": created["player_token"],
        })
        assert resp.status_code == 404

    def test_duel_history(self, api_client):
        created = api_client.post("/api/duel", json={
            "game_number": 1, "nickname": "Alice", "tips_allowed": True,
        }).json()
        api_client.post(f"/api/duel/{created['duel_id']}/guess", json={
            "word": "birne", "player_token": created["player_token"],
        })
        resp = api_client.get(
            f"/api/duel/{created['duel_id']}/history?token={created['player_token']}"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["guesses"]) == 1
        assert data["guesses"][0]["word"] == "birne"

    def test_duel_tip_allowed(self, api_client):
        created = api_client.post("/api/duel", json={
            "game_number": 1, "nickname": "Alice", "tips_allowed": True,
        }).json()
        resp = api_client.get(
            f"/api/duel/{created['duel_id']}/tip?difficulty=easy&best_rank=5"
        )
        assert resp.status_code == 200

    def test_duel_tip_not_allowed(self, api_client):
        created = api_client.post("/api/duel", json={
            "game_number": 1, "nickname": "Alice", "tips_allowed": False,
        }).json()
        resp = api_client.get(
            f"/api/duel/{created['duel_id']}/tip?difficulty=easy&best_rank=5"
        )
        assert resp.status_code == 403

    def test_player_info(self, api_client):
        created = api_client.post("/api/duel", json={
            "game_number": 1, "nickname": "Alice", "tips_allowed": True,
        }).json()
        resp = api_client.get(f"/api/duel/player-info?token={created['player_token']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["nickname"] == "Alice"
        assert data["duel_id"] == created["duel_id"]
