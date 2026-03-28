import pytest
import pytest_asyncio
import aiosqlite

from database import init_db
from wordle_duel import (
    create_wordle_duel,
    join_wordle_duel,
    record_wordle_guess,
    get_wordle_duel_state,
)


@pytest_asyncio.fixture
async def db(tmp_path):
    db_path = str(tmp_path / "test.db")
    await init_db(db_path)
    conn = await aiosqlite.connect(db_path)
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA foreign_keys = ON")
    yield conn
    await conn.close()


@pytest.mark.asyncio
class TestCreateDuel:
    async def test_creates_duel_and_player(self, db):
        result = await create_wordle_duel(db, nickname="Max", game_number=42)
        assert "duel_id" in result
        assert "player_token" in result
        assert len(result["duel_id"]) == 6


@pytest.mark.asyncio
class TestJoinDuel:
    async def test_join_returns_state(self, db):
        created = await create_wordle_duel(db, nickname="Max", game_number=42)
        joined = await join_wordle_duel(
            db, duel_id=created["duel_id"], nickname="Anna"
        )
        assert "player_token" in joined
        assert len(joined["players"]) == 2
        assert joined["game_number"] == 42


@pytest.mark.asyncio
class TestRecordGuess:
    async def test_records_and_updates_count(self, db):
        created = await create_wordle_duel(db, nickname="Max", game_number=42)
        await record_wordle_guess(
            db,
            duel_id=created["duel_id"],
            player_token=created["player_token"],
            word="stern",
            result=["GRAY", "GRAY", "GREEN", "GRAY", "GRAY"],
        )
        state = await get_wordle_duel_state(db, created["duel_id"])
        assert state["players"][0]["guesses_used"] == 1
        assert state["players"][0]["solved"] is False

    async def test_marks_solved(self, db):
        created = await create_wordle_duel(db, nickname="Max", game_number=42)
        await record_wordle_guess(
            db,
            duel_id=created["duel_id"],
            player_token=created["player_token"],
            word="hallo",
            result=["GREEN", "GREEN", "GREEN", "GREEN", "GREEN"],
        )
        state = await get_wordle_duel_state(db, created["duel_id"])
        assert state["players"][0]["solved"] is True
