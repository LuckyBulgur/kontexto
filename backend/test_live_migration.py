"""The move of a live room's chat binding from live_rooms into live_channels.

A room that is on air during the deploy must keep its chat, with its state, and
all five workers run init_db at the same moment, so the move has to happen once
and leave the others nothing to do.
"""

import asyncio
import os
import tempfile

import aiosqlite
import pytest

from database import get_db, init_db

# live_rooms as it stood while a room could read only one chat.
_OLD_SCHEMA = (
    "CREATE TABLE koops (id TEXT PRIMARY KEY, game_number INTEGER);"
    "CREATE TABLE live_rooms (koop_id TEXT PRIMARY KEY REFERENCES koops(id) ON DELETE CASCADE,"
    " platform TEXT NOT NULL, channel TEXT NOT NULL, host_token TEXT NOT NULL,"
    " chat_token TEXT NOT NULL DEFAULT '', overlay_token TEXT NOT NULL UNIQUE,"
    " require_prefix BOOLEAN NOT NULL DEFAULT 0,"
    " chat_state TEXT NOT NULL DEFAULT 'connecting', chat_error TEXT,"
    " last_chat_at TIMESTAMP, host_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
    " created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);"
    "CREATE UNIQUE INDEX idx_live_rooms_channel ON live_rooms(platform, channel);"
    "INSERT INTO koops (id, game_number) VALUES ('a', 1), ('b', 1);"
    "INSERT INTO live_rooms (koop_id, platform, channel, host_token, chat_token,"
    " overlay_token, require_prefix, chat_state, chat_error) VALUES"
    " ('a', 'twitch', 'kontexto', 'h1', 'c1', 'o1', 1, 'live', NULL),"
    " ('b', 'tiktok', 'kontexto.de', 'h2', 'c2', 'o2', 0, 'connecting', 'wartet');"
)


@pytest.fixture
def old_db():
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        path = os.path.join(tmpdir, "old.db")

        async def build():
            conn = await aiosqlite.connect(path)
            # Production has been in WAL mode for a long time; switching a
            # rollback-journal file concurrently is a different question.
            await conn.execute("PRAGMA journal_mode=WAL")
            await conn.executescript(_OLD_SCHEMA)
            await conn.commit()
            await conn.close()

        asyncio.run(build())
        yield path


async def _columns(path: str) -> set[str]:
    conn = await aiosqlite.connect(path)
    try:
        cursor = await conn.execute("PRAGMA table_info(live_rooms)")
        return {row[1] for row in await cursor.fetchall()}
    finally:
        await conn.close()


async def _indexes(path: str) -> set[str]:
    conn = await aiosqlite.connect(path)
    try:
        cursor = await conn.execute("SELECT name FROM sqlite_master WHERE type = 'index'")
        return {row[0] for row in await cursor.fetchall()}
    finally:
        await conn.close()


def test_a_bound_room_keeps_its_chat(old_db):
    from live_chat import get_live_room

    async def run():
        await init_db(old_db)
        conn = await get_db(old_db)
        try:
            twitch = await get_live_room(conn, "a")
            tiktok = await get_live_room(conn, "b")
        finally:
            await conn.close()
        assert twitch["channels"] == [{
            "platform": "twitch", "channel": "kontexto",
            "chat_state": "live", "chat_error": None, "paused": False,
        }]
        assert twitch["require_prefix"] is True
        assert twitch["chat_token"] == "c1"
        assert tiktok["channels"][0]["chat_error"] == "wartet"

    asyncio.run(run())


def test_the_old_columns_and_index_are_gone(old_db):
    async def run():
        await init_db(old_db)
        columns = await _columns(old_db)
        assert not columns & {"platform", "channel", "chat_state", "chat_error", "last_chat_at"}
        assert {"host_token", "chat_token", "overlay_token", "host_seen_at"} <= columns
        indexes = await _indexes(old_db)
        assert "idx_live_rooms_channel" not in indexes
        assert "idx_live_channels_channel" in indexes

    asyncio.run(run())


def test_a_second_run_changes_nothing(old_db):
    async def run():
        await init_db(old_db)
        await init_db(old_db)
        conn = await get_db(old_db)
        try:
            cursor = await conn.execute("SELECT COUNT(*) FROM live_channels")
            assert (await cursor.fetchone())[0] == 2
        finally:
            await conn.close()

    asyncio.run(run())


def test_workers_starting_together_migrate_once(old_db):
    async def run():
        await asyncio.gather(*(init_db(old_db) for _ in range(5)))
        conn = await get_db(old_db)
        try:
            cursor = await conn.execute("SELECT koop_id, platform FROM live_channels ORDER BY koop_id")
            assert [tuple(row) for row in await cursor.fetchall()] == [
                ("a", "twitch"), ("b", "tiktok"),
            ]
        finally:
            await conn.close()

    asyncio.run(run())


def test_the_one_chat_rule_survives(old_db):
    from live_chat import ChannelBusy, create_live_room

    async def run():
        await init_db(old_db)
        conn = await get_db(old_db)
        try:
            await conn.execute("INSERT INTO koops (id, game_number) VALUES ('c', 1)")
            await conn.commit()
            with pytest.raises(ChannelBusy):
                await create_live_room(conn, "c", "h3", False, [("twitch", "kontexto")])
        finally:
            await conn.close()

    asyncio.run(run())
