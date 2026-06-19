"""In-process coalescing writer for server-authoritative action counters.

Why this exists
---------------
Game handlers fire many counter increments per second: every guess bumps
``analytics_counters`` and ``analytics_game_stats`` (and ``analytics_word_counts``
for the guessed word). Originally each increment opened its own short-lived
SQLite connection and committed its own transaction. Under load that made the
single WAL write lock -- shared by all five worker processes -- the dominant
latency source: load testing showed the guess endpoint collapsing at ~70 req/s
with 15-30 s tail latency, almost entirely waiting on the write lock.

This batcher coalesces increments in memory and flushes them in ONE transaction
on a short interval. Memory is bounded by the number of DISTINCT keys (date x
metric x dimension, plus one entry per guessed word), never by event volume, so
a 10x traffic spike does not grow the buffer -- it only makes each flushed delta
larger. Thousands of per-request writes become a handful of batched upserts.

Correctness invariants
-----------------------
- Counters stay SERVER-AUTHORITATIVE: they are still computed in the real game
  handlers from real actions; only their *persistence* is deferred and batched.
  Nothing here is client-trusted.
- Writes are additive ``value = value + ?`` upserts, which are commutative. Each
  of the five worker processes runs its own batcher against the shared SQLite
  file; concurrent flushes therefore never lose an update (SQLite serialises the
  writes and each adds its own delta). This matches the existing idempotent
  multi-writer design.
- This batcher is PER WORKER (started in every uvicorn worker), unlike the
  singleton aggregation/cleanup/broadcast loops which run only in the WS worker.
  Each worker must persist the counts for the requests it served.

Durability tradeoff
-------------------
If a worker is killed un-gracefully, up to one flush interval (~100 ms) of
increments is lost. This is acceptable for best-effort analytics counters -- the
previous design already logged-and-dropped writes it could not commit under lock
contention -- and a graceful shutdown drains the buffer with a final flush. A
flush that fails (lock contention or transient error) folds its deltas back into
the live buffer so the counts are retried on the next interval rather than lost.
"""

import asyncio
import logging
import random
import sqlite3

import aiosqlite

from database import configure_connection

logger = logging.getLogger(__name__)

DEFAULT_FLUSH_INTERVAL = 0.1  # seconds
_FLUSH_RETRY_ATTEMPTS = 3
_FLUSH_RETRY_BASE_DELAY = 0.05  # seconds, multiplied by the attempt number


def _is_locked_error(exc: BaseException) -> bool:
    return isinstance(exc, sqlite3.OperationalError) and "lock" in str(exc).lower()


class CounterBatcher:
    """Coalesces additive counter increments and flushes them on an interval.

    All ``incr_*`` methods are synchronous and never await, so they are atomic
    with respect to the single-threaded asyncio event loop: an increment can
    never interleave with the buffer swap performed by the flusher.
    """

    def __init__(self, db_path: str, flush_interval: float = DEFAULT_FLUSH_INTERVAL):
        self._db_path = db_path
        self._interval = flush_interval
        self._counters: dict[tuple[str, str, str], int] = {}
        self._game_stats: dict[tuple[str, int, str], int] = {}
        self._words: dict[str, int] = {}
        self._db: aiosqlite.Connection | None = None
        self._task: asyncio.Task | None = None
        self._running = False
        # Serialises flushes so the interval timer and an on-demand flush (e.g. the
        # admin dashboard freshening before a read) never use the connection at once.
        self._flush_lock = asyncio.Lock()

    # --- producer API (sync, called from request handlers) ------------------
    def incr_counter(self, date_str: str, metric: str, dimension: str, amount: int = 1) -> None:
        k = (date_str, metric, dimension)
        self._counters[k] = self._counters.get(k, 0) + amount

    def incr_game_stat(self, mode: str, game_number: int, metric: str, amount: int = 1) -> None:
        k = (mode, int(game_number), metric)
        self._game_stats[k] = self._game_stats.get(k, 0) + amount

    def incr_word(self, word: str, amount: int = 1) -> None:
        self._words[word] = self._words.get(word, 0) + amount

    @property
    def running(self) -> bool:
        return self._running

    def _pending(self) -> int:
        return len(self._counters) + len(self._game_stats) + len(self._words)

    # --- lifecycle ----------------------------------------------------------
    async def start(self) -> None:
        if self._running:
            return
        db = await aiosqlite.connect(self._db_path)
        try:
            await configure_connection(db)
        except BaseException:
            await db.close()  # don't leak a half-configured connection on a failed start
            raise
        self._db = db
        self._running = True
        self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        """Stop the flush loop and drain the buffer (final flush)."""
        if not self._running:
            return
        self._running = False
        if self._task is not None:
            # No cancel: let the in-flight sleep/flush finish so a mid-flight
            # batch is never dropped. Worst case is one interval of delay.
            try:
                await self._task
            except Exception:
                logger.exception("counter batcher flush loop ended with an error")
            self._task = None
        await self._flush_once()  # drain whatever accumulated after the last loop flush
        if self._db is not None:
            await self._db.close()
            self._db = None

    # --- flush loop ---------------------------------------------------------
    async def _run(self) -> None:
        # Phase-shift this process's timer by a random fraction of the interval so
        # the (up to five) per-worker flushers don't all contend for the single
        # write lock on the same tick (thundering-herd mitigation).
        await asyncio.sleep(self._interval * random.random())
        while self._running:
            # +/-15% jitter keeps the flushers decorrelated over time, too.
            await asyncio.sleep(self._interval * (0.85 + 0.30 * random.random()))
            await self._flush_once()

    def _swap(self):
        counters, game_stats, words = self._counters, self._game_stats, self._words
        self._counters, self._game_stats, self._words = {}, {}, {}
        return counters, game_stats, words

    def _fold_back(self, counters, game_stats, words) -> None:
        for k, v in counters.items():
            self._counters[k] = self._counters.get(k, 0) + v
        for k, v in game_stats.items():
            self._game_stats[k] = self._game_stats.get(k, 0) + v
        for k, v in words.items():
            self._words[k] = self._words.get(k, 0) + v

    async def flush(self) -> None:
        """Flush buffered increments now (on-demand, e.g. freshen before a read)."""
        await self._flush_once()

    async def _flush_once(self) -> None:
        async with self._flush_lock:
            await self._flush_locked()

    async def _flush_locked(self) -> None:
        if self._pending() == 0 or self._db is None:
            return
        counters, game_stats, words = self._swap()
        last_exc: Exception | None = None
        for attempt in range(1, _FLUSH_RETRY_ATTEMPTS + 1):
            try:
                await self._write_batch(counters, game_stats, words)
                return
            except sqlite3.OperationalError as exc:
                if not _is_locked_error(exc):
                    self._fold_back(counters, game_stats, words)
                    logger.exception("counter flush failed (non-lock error); deltas retained")
                    return
                last_exc = exc
                try:
                    await self._db.rollback()
                except Exception:
                    pass
                if attempt < _FLUSH_RETRY_ATTEMPTS:
                    await asyncio.sleep(_FLUSH_RETRY_BASE_DELAY * attempt)
            except Exception:
                self._fold_back(counters, game_stats, words)
                logger.exception("counter flush failed unexpectedly; deltas retained")
                return
        # All attempts hit lock contention: keep the deltas for the next interval.
        self._fold_back(counters, game_stats, words)
        logger.warning(
            "counter flush deferred after %d locked attempts: %s", _FLUSH_RETRY_ATTEMPTS, last_exc)

    async def _write_batch(self, counters, game_stats, words) -> None:
        db = self._db
        assert db is not None
        try:
            # All statements are writes (no read-then-write upgrade), so the
            # implicit transaction acquires the write lock on the first INSERT
            # and cannot deadlock on a lock-upgrade.
            for (date_str, metric, dim), amount in counters.items():
                await db.execute(
                    "INSERT INTO analytics_counters (date, metric, dimension, value) "
                    "VALUES (?, ?, ?, ?) "
                    "ON CONFLICT(date, metric, dimension) DO UPDATE SET value = value + ?",
                    (date_str, metric, dim, amount, amount),
                )
            for (mode, game_number, metric), amount in game_stats.items():
                await db.execute(
                    "INSERT INTO analytics_game_stats (mode, game_number, metric, value) "
                    "VALUES (?, ?, ?, ?) "
                    "ON CONFLICT(mode, game_number, metric) DO UPDATE SET value = value + ?",
                    (mode, game_number, metric, amount, amount),
                )
            for word, amount in words.items():
                await db.execute(
                    "INSERT INTO analytics_word_counts (word, count) VALUES (?, ?) "
                    "ON CONFLICT(word) DO UPDATE SET count = count + ?",
                    (word, amount, amount),
                )
            await db.commit()
        except BaseException:
            await db.rollback()
            raise
