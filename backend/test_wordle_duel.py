import asyncio
import os
import tempfile

import pytest
import aiosqlite

from database import init_db
from wordle_duel import (
    create_wordle_duel,
    join_wordle_duel,
    record_wordle_guess,
    get_wordle_duel_state,
)


@pytest.fixture
def db_path():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield os.path.join(tmpdir, "duels.db")


@pytest.fixture
def db(db_path):
    asyncio.get_event_loop().run_until_complete(init_db(db_path))
    return db_path


async def _get_conn(db_path):
    conn = await aiosqlite.connect(db_path)
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA foreign_keys = ON")
    return conn


class TestCreateDuel:
    def test_creates_duel_and_player(self, db):
        async def _test():
            conn = await _get_conn(db)
            try:
                result = await create_wordle_duel(conn, nickname="Max", game_number=42)
                assert "duel_id" in result
                assert "player_token" in result
                assert len(result["duel_id"]) == 6
            finally:
                await conn.close()
        asyncio.get_event_loop().run_until_complete(_test())


class TestJoinDuel:
    def test_join_returns_state(self, db):
        async def _test():
            conn = await _get_conn(db)
            try:
                created = await create_wordle_duel(conn, nickname="Max", game_number=42)
                joined = await join_wordle_duel(conn, duel_id=created["duel_id"], nickname="Anna")
                assert "player_token" in joined
                assert len(joined["players"]) == 2
                assert joined["game_number"] == 42
            finally:
                await conn.close()
        asyncio.get_event_loop().run_until_complete(_test())


class TestRecordGuess:
    def test_records_and_updates_count(self, db):
        async def _test():
            conn = await _get_conn(db)
            try:
                created = await create_wordle_duel(conn, nickname="Max", game_number=42)
                await record_wordle_guess(
                    conn, duel_id=created["duel_id"], player_token=created["player_token"],
                    word="stern", result=["GRAY", "GRAY", "GREEN", "GRAY", "GRAY"],
                )
                state = await get_wordle_duel_state(conn, created["duel_id"])
                assert state["players"][0]["guesses_used"] == 1
                assert state["players"][0]["solved"] is False
            finally:
                await conn.close()
        asyncio.get_event_loop().run_until_complete(_test())

    def test_marks_solved(self, db):
        async def _test():
            conn = await _get_conn(db)
            try:
                created = await create_wordle_duel(conn, nickname="Max", game_number=42)
                await record_wordle_guess(
                    conn, duel_id=created["duel_id"], player_token=created["player_token"],
                    word="hallo", result=["GREEN", "GREEN", "GREEN", "GREEN", "GREEN"],
                )
                state = await get_wordle_duel_state(conn, created["duel_id"])
                assert state["players"][0]["solved"] is True
            finally:
                await conn.close()
        asyncio.get_event_loop().run_until_complete(_test())
