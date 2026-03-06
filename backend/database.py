"""SQLite database setup for duel mode."""

import aiosqlite

_SCHEMA = """
CREATE TABLE IF NOT EXISTS duels (
    id TEXT PRIMARY KEY,
    game_number INTEGER NOT NULL,
    created_by TEXT NOT NULL,
    tips_allowed BOOLEAN NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS duel_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    duel_id TEXT NOT NULL REFERENCES duels(id) ON DELETE CASCADE,
    nickname TEXT NOT NULL,
    player_token TEXT NOT NULL UNIQUE,
    best_rank INTEGER,
    guess_count INTEGER NOT NULL DEFAULT 0,
    solved BOOLEAN NOT NULL DEFAULT 0,
    connected BOOLEAN NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS duel_guesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    duel_id TEXT NOT NULL REFERENCES duels(id) ON DELETE CASCADE,
    player_token TEXT NOT NULL,
    word TEXT NOT NULL,
    rank INTEGER NOT NULL,
    guessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


async def init_db(db_path: str) -> None:
    """Create tables if they don't exist."""
    db = await aiosqlite.connect(db_path)
    try:
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute("PRAGMA foreign_keys=ON")
        await db.executescript(_SCHEMA)
        await db.commit()
    finally:
        await db.close()


async def get_db(db_path: str) -> aiosqlite.Connection:
    """Open a connection with WAL mode and foreign keys enabled."""
    db = await aiosqlite.connect(db_path)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db
