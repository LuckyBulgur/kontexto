"""Tests for koop (cooperative Kontexto) mode."""

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
    asyncio.run(init_db(db_path))
    return db_path


class TestDatabase:
    def test_init_db_creates_koop_tables(self, db_path):
        asyncio.run(init_db(db_path))

        async def check():
            conn = await aiosqlite.connect(db_path)
            cursor = await conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
            )
            tables = [row[0] for row in await cursor.fetchall()]
            await conn.close()
            assert "koops" in tables
            assert "koop_players" in tables
            assert "koop_guesses" in tables

        asyncio.run(check())


class TestKoopCRUD:
    def _run(self, coro):
        return asyncio.run(coro)

    def test_create_koop(self, db):
        from koop import create_koop
        async def run():
            conn = await get_db(db)
            try:
                result = await create_koop(conn, game_number=1, nickname="Alice", tips_allowed=True)
                assert "koop_id" in result
                assert "player_token" in result
                assert len(result["koop_id"]) == 6
            finally:
                await conn.close()
        self._run(run())

    def test_join_koop(self, db):
        from koop import create_koop, join_koop
        async def run():
            conn = await get_db(db)
            try:
                created = await create_koop(conn, game_number=1, nickname="Alice", tips_allowed=True)
                joined = await join_koop(conn, created["koop_id"], "Bob")
                assert joined is not None
                assert "player_token" in joined
                assert len(joined["players"]) == 2
            finally:
                await conn.close()
        self._run(run())

    def test_join_duplicate_nickname_disambiguated(self, db):
        from koop import create_koop, join_koop
        async def run():
            conn = await get_db(db)
            try:
                created = await create_koop(conn, game_number=1, nickname="Alice", tips_allowed=True)
                joined = await join_koop(conn, created["koop_id"], "Alice")
                assert joined["nickname"] == "Alice (2)"
            finally:
                await conn.close()
        self._run(run())

    def test_join_nonexistent_koop(self, db):
        from koop import join_koop
        async def run():
            conn = await get_db(db)
            try:
                result = await join_koop(conn, "XXXXXX", "Bob")
                assert result is None
            finally:
                await conn.close()
        self._run(run())

    def test_shared_list_dedup_across_players(self, db):
        """The same word from two members lands in the list exactly once."""
        from koop import create_koop, join_koop, record_koop_guess, get_koop_guesses, get_koop_state
        async def run():
            conn = await get_db(db)
            try:
                created = await create_koop(conn, game_number=1, nickname="Alice", tips_allowed=True)
                joined = await join_koop(conn, created["koop_id"], "Bob")
                koop_id = created["koop_id"]

                first = await record_koop_guess(conn, koop_id, created["player_token"], "apfel", 42)
                assert first["already_guessed"] is False
                assert first["best_rank"] == 42

                # Bob guesses the same word → recognised as already guessed.
                dup = await record_koop_guess(conn, koop_id, joined["player_token"], "apfel", 42)
                assert dup["already_guessed"] is True

                guesses = await get_koop_guesses(conn, koop_id)
                assert len(guesses) == 1
                assert guesses[0]["word"] == "apfel"
                assert guesses[0]["nickname"] == "Alice"

                # Only Alice's contribution counted.
                state = await get_koop_state(conn, koop_id)
                by_nick = {p["nickname"]: p["contribution_count"] for p in state["players"]}
                assert by_nick["Alice"] == 1
                assert by_nick["Bob"] == 0
            finally:
                await conn.close()
        self._run(run())

    def test_best_rank_is_team_minimum(self, db):
        from koop import create_koop, join_koop, record_koop_guess, get_koop_state
        async def run():
            conn = await get_db(db)
            try:
                created = await create_koop(conn, game_number=1, nickname="Alice", tips_allowed=True)
                joined = await join_koop(conn, created["koop_id"], "Bob")
                koop_id = created["koop_id"]
                await record_koop_guess(conn, koop_id, created["player_token"], "apfel", 42)
                r = await record_koop_guess(conn, koop_id, joined["player_token"], "birne", 10)
                assert r["best_rank"] == 10
                state = await get_koop_state(conn, koop_id)
                assert state["best_rank"] == 10
            finally:
                await conn.close()
        self._run(run())

    def test_team_solved(self, db):
        from koop import create_koop, record_koop_guess, get_koop_state
        async def run():
            conn = await get_db(db)
            try:
                created = await create_koop(conn, game_number=1, nickname="Alice", tips_allowed=True)
                koop_id = created["koop_id"]
                r = await record_koop_guess(conn, koop_id, created["player_token"], "ziel", 1)
                assert r["solved"] is True
                state = await get_koop_state(conn, koop_id)
                assert state["solved"] is True
                assert state["solved_by"] == "Alice"
            finally:
                await conn.close()
        self._run(run())

    def test_record_unknown_player(self, db):
        from koop import create_koop, record_koop_guess
        async def run():
            conn = await get_db(db)
            try:
                created = await create_koop(conn, game_number=1, nickname="Alice", tips_allowed=True)
                r = await record_koop_guess(conn, created["koop_id"], "bogus-token", "apfel", 42)
                assert r is None
            finally:
                await conn.close()
        self._run(run())

    def test_cleanup_stale_koops(self, db):
        from koop import create_koop, cleanup_stale_koops, get_koop_state
        async def run():
            conn = await get_db(db)
            try:
                created = await create_koop(conn, game_number=1, nickname="Alice", tips_allowed=True)
                await conn.execute(
                    "UPDATE koops SET last_activity = datetime('now', '-2 hours') WHERE id = ?",
                    (created["koop_id"],),
                )
                await conn.commit()
                await cleanup_stale_koops(conn)
                assert await get_koop_state(conn, created["koop_id"]) is None
            finally:
                await conn.close()
        self._run(run())

    def test_cleanup_keeps_connected_koops(self, db):
        from koop import create_koop, cleanup_stale_koops, set_player_connected, get_koop_state
        async def run():
            conn = await get_db(db)
            try:
                created = await create_koop(conn, game_number=1, nickname="Alice", tips_allowed=True)
                await set_player_connected(conn, created["player_token"], True)
                await conn.execute(
                    "UPDATE koops SET last_activity = datetime('now', '-2 hours') WHERE id = ?",
                    (created["koop_id"],),
                )
                await conn.commit()
                await cleanup_stale_koops(conn)
                assert await get_koop_state(conn, created["koop_id"]) is not None
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


class TestKoopEndpoints:
    def _create(self, api_client, tips_allowed=True):
        return api_client.post("/api/koop", json={
            "game_number": 1, "nickname": "Alice", "tips_allowed": tips_allowed,
        }).json()

    def test_create_koop(self, api_client):
        resp = api_client.post("/api/koop", json={
            "game_number": 1, "nickname": "Alice", "tips_allowed": True,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "koop_id" in data
        assert "player_token" in data

    def test_join_koop(self, api_client):
        created = self._create(api_client)
        resp = api_client.post(f"/api/koop/{created['koop_id']}/join", json={"nickname": "Bob"})
        assert resp.status_code == 200
        data = resp.json()
        assert "player_token" in data
        assert len(data["players"]) == 2

    def test_join_nonexistent_koop(self, api_client):
        resp = api_client.post("/api/koop/XXXXXX/join", json={"nickname": "Bob"})
        assert resp.status_code == 404

    def test_get_koop_state(self, api_client):
        created = self._create(api_client)
        resp = api_client.get(f"/api/koop/{created['koop_id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["game_number"] == 1
        assert data["solved"] is False
        assert data["total"] == 5
        assert len(data["players"]) == 1

    def test_koop_guess_shared_and_dedup(self, api_client):
        created = self._create(api_client)
        joined = api_client.post(
            f"/api/koop/{created['koop_id']}/join", json={"nickname": "Bob"}
        ).json()

        r1 = api_client.post(f"/api/koop/{created['koop_id']}/guess", json={
            "word": "birne", "player_token": created["player_token"],
        })
        assert r1.status_code == 200
        assert r1.json()["already_guessed"] is False

        # Bob guesses the same word → shared list recognises it.
        r2 = api_client.post(f"/api/koop/{created['koop_id']}/guess", json={
            "word": "birne", "player_token": joined["player_token"],
        })
        assert r2.status_code == 200
        assert r2.json()["already_guessed"] is True

        guesses = api_client.get(f"/api/koop/{created['koop_id']}/guesses").json()["guesses"]
        assert len(guesses) == 1
        assert guesses[0]["word"] == "birne"

    def test_koop_guess_unknown_word(self, api_client):
        created = self._create(api_client)
        resp = api_client.post(f"/api/koop/{created['koop_id']}/guess", json={
            "word": "xyz123", "player_token": created["player_token"],
        })
        assert resp.status_code == 404

    def test_koop_solved_marks_team(self, api_client):
        created = self._create(api_client)
        # "apfel" is target_words[0] → rank 1 for game 1.
        resp = api_client.post(f"/api/koop/{created['koop_id']}/guess", json={
            "word": "apfel", "player_token": created["player_token"],
        })
        assert resp.status_code == 200
        assert resp.json()["rank"] == 1
        state = api_client.get(f"/api/koop/{created['koop_id']}").json()
        assert state["solved"] is True
        assert state["solved_by"] == "Alice"

    def test_koop_tip_allowed(self, api_client):
        created = self._create(api_client)
        resp = api_client.get(
            f"/api/koop/{created['koop_id']}/tip?token={created['player_token']}&difficulty=easy"
        )
        assert resp.status_code == 200

    def test_koop_tip_not_allowed(self, api_client):
        created = self._create(api_client, tips_allowed=False)
        resp = api_client.get(
            f"/api/koop/{created['koop_id']}/tip?token={created['player_token']}&difficulty=easy"
        )
        assert resp.status_code == 403

    def test_koop_player_info(self, api_client):
        created = self._create(api_client)
        resp = api_client.get(f"/api/koop/player-info?token={created['player_token']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["nickname"] == "Alice"
        assert data["koop_id"] == created["koop_id"]
