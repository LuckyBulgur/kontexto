"""Tests for the coalescing action-counter batcher (counter_batcher.py) and its
integration with analytics.record_action / record_game_stat."""

import asyncio
import sqlite3

import aiosqlite
import pytest

import analytics
import counter_batcher
from counter_batcher import CounterBatcher
from database import init_db


@pytest.fixture
def db_path(tmp_path):
    path = str(tmp_path / "test.db")
    asyncio.run(init_db(path))
    return path


async def _counter(path, date_str, metric, dimension="*"):
    db = await aiosqlite.connect(path)
    try:
        cur = await db.execute(
            "SELECT value FROM analytics_counters WHERE date=? AND metric=? AND dimension=?",
            (date_str, metric, dimension),
        )
        row = await cur.fetchone()
        return row[0] if row else None
    finally:
        await db.close()


async def _game_stat(path, mode, game_number, metric):
    db = await aiosqlite.connect(path)
    try:
        cur = await db.execute(
            "SELECT value FROM analytics_game_stats WHERE mode=? AND game_number=? AND metric=?",
            (mode, game_number, metric),
        )
        row = await cur.fetchone()
        return row[0] if row else None
    finally:
        await db.close()


async def _word(path, word):
    db = await aiosqlite.connect(path)
    try:
        cur = await db.execute("SELECT count FROM analytics_word_counts WHERE word=?", (word,))
        row = await cur.fetchone()
        return row[0] if row else None
    finally:
        await db.close()


def test_coalesces_and_flushes_sum(db_path):
    async def run():
        b = CounterBatcher(db_path)
        await b.start()
        try:
            for _ in range(100):
                b.incr_counter("2026-06-19", "guesses", "kontexto")
            b.incr_game_stat("kontexto", 1, "guesses", 5)
            b.incr_word("hund", 3)
            # one explicit flush rather than waiting on the timer
            await b._flush_once()
        finally:
            await b.stop()
        assert await _counter(db_path, "2026-06-19", "guesses", "kontexto") == 100
        assert await _game_stat(db_path, "kontexto", 1, "guesses") == 5
        assert await _word(db_path, "hund") == 3

    asyncio.run(run())


def test_multiple_flushes_accumulate(db_path):
    """Each flush must ADD its delta (value = value + ?), not overwrite."""
    async def run():
        b = CounterBatcher(db_path)
        await b.start()
        try:
            b.incr_counter("2026-06-19", "solves", "duel", 4)
            await b._flush_once()
            b.incr_counter("2026-06-19", "solves", "duel", 6)
            await b._flush_once()
        finally:
            await b.stop()
        assert await _counter(db_path, "2026-06-19", "solves", "duel") == 10

    asyncio.run(run())


def test_empty_flush_is_noop(db_path):
    async def run():
        b = CounterBatcher(db_path)
        await b.start()
        try:
            await b._flush_once()  # nothing buffered
        finally:
            await b.stop()
        assert await _counter(db_path, "2026-06-19", "guesses", "kontexto") is None

    asyncio.run(run())


def test_stop_drains_remaining(db_path):
    """A graceful stop must flush whatever is still buffered."""
    async def run():
        b = CounterBatcher(db_path, flush_interval=100)  # timer effectively never fires
        await b.start()
        b.incr_counter("2026-06-19", "hints", "easy", 7)
        await b.stop()  # final drain happens here
        assert await _counter(db_path, "2026-06-19", "hints", "easy") == 7

    asyncio.run(run())


def test_failed_flush_folds_back(db_path, monkeypatch):
    """If a flush write fails, its deltas must be retained (not lost) and applied
    on a subsequent successful flush."""
    async def run():
        b = CounterBatcher(db_path)
        await b.start()
        try:
            b.incr_counter("2026-06-19", "guesses", "kontexto", 9)

            calls = {"n": 0}
            real_write = b._write_batch

            async def flaky(counters, game_stats, words):
                calls["n"] += 1
                # Fail every attempt of the FIRST flush (3 retries), then succeed.
                if calls["n"] <= counter_batcher._FLUSH_RETRY_ATTEMPTS:
                    raise sqlite3.OperationalError("database is locked")
                await real_write(counters, game_stats, words)

            monkeypatch.setattr(b, "_write_batch", flaky)

            await b._flush_once()  # all attempts raise locked -> folded back
            assert await _counter(db_path, "2026-06-19", "guesses", "kontexto") is None

            await b._flush_once()  # now succeeds with the retained delta
            assert await _counter(db_path, "2026-06-19", "guesses", "kontexto") == 9
        finally:
            await b.stop()

    asyncio.run(run())


def test_record_action_routes_through_batcher(db_path):
    """When the batcher is running, record_action/record_game_stat enqueue into it;
    the values land after a flush. Cleans up the module global afterwards."""
    async def run():
        await analytics.start_counter_batcher(db_path, flush_interval=0.05)
        try:
            await analytics.record_action(db_path, "guesses", "kontexto", word="Katze")
            await analytics.record_action(db_path, "guesses", "kontexto", word="Katze")
            await analytics.record_game_stat(db_path, "kontexto", 3, "guesses")
            assert analytics._batcher is not None
            await analytics._batcher._flush_once()
            assert await _counter(db_path, analytics_date(), "guesses", "kontexto") == 2
            assert await _word(db_path, "katze") == 2
            assert await _game_stat(db_path, "kontexto", 3, "guesses") == 1
        finally:
            await analytics.stop_counter_batcher()
        assert analytics._batcher is None

    asyncio.run(run())


def test_record_action_immediate_when_batcher_off(db_path):
    """Without a running batcher, record_action writes immediately (test/script path)."""
    async def run():
        assert analytics._batcher is None
        await analytics.record_action(db_path, "reveals", "wordle")
        assert await _counter(db_path, analytics_date(), "reveals", "wordle") == 1

    asyncio.run(run())


def analytics_date():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")
