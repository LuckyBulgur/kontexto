"""Token-bound rating system for AggregateRating structured data.

One rating per beacon-token (INSERT … ON CONFLICT … DO UPDATE), validated
to the 1–5 integer range.  Aggregate is used at build time to inject an
AggregateRating into the JSON-LD game schema.

Structure mirrors analytics.record_action: own short-lived connection,
configure_connection PRAGMAs, lock-aware commit retry via
analytics._commit_with_retry.
"""

import logging

import aiosqlite

from analytics import _commit_with_retry
from database import configure_connection

logger = logging.getLogger(__name__)


async def record_rating(db_path: str, token: str, value: int) -> None:
    """Upsert a rating for *token*.

    Raises ``ValueError`` if *value* is not an integer in [1, 5].
    Uses its own short-lived connection; errors propagate to the caller (unlike
    analytics helpers, a rating write failure is never silently swallowed — the
    handler should surface it as a 500 rather than returning stale aggregate
    data that implies the rating was saved).
    """
    if not (isinstance(value, int) and 1 <= value <= 5):
        raise ValueError(f"Rating value must be an integer between 1 and 5, got {value!r}")

    async def _write(conn: aiosqlite.Connection) -> None:
        await conn.execute(
            """
            INSERT INTO ratings (token, value)
            VALUES (?, ?)
            ON CONFLICT(token) DO UPDATE
                SET value      = excluded.value,
                    updated_at = CURRENT_TIMESTAMP
            """,
            (token, value),
        )

    db = await aiosqlite.connect(db_path)
    try:
        await configure_connection(db)
        await _commit_with_retry(db, _write, description=f"record_rating:{token[:8]}")
    finally:
        await db.close()


async def get_aggregate(db_path: str) -> dict:
    """Return the current aggregate rating.

    Returns ``{"ratingCount": int, "ratingValue": float}`` where
    ``ratingValue`` is rounded to two decimal places, or ``0.0`` when no
    ratings exist yet.
    """
    db = await aiosqlite.connect(db_path)
    try:
        await configure_connection(db)
        cur = await db.execute("SELECT COUNT(*), AVG(value) FROM ratings")
        row = await cur.fetchone()
    finally:
        await db.close()

    count = row[0] if row else 0
    avg = row[1] if row else None
    return {
        "ratingCount": int(count or 0),
        "ratingValue": round(float(avg), 2) if count else 0.0,
    }
