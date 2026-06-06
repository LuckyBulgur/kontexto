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
    tip_count INTEGER NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS wordle_duels (
    id TEXT PRIMARY KEY,
    game_number INTEGER NOT NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wordle_duel_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    duel_id TEXT NOT NULL REFERENCES wordle_duels(id) ON DELETE CASCADE,
    nickname TEXT NOT NULL,
    player_token TEXT UNIQUE NOT NULL,
    guesses_used INTEGER DEFAULT 0,
    solved BOOLEAN DEFAULT 0,
    connected BOOLEAN DEFAULT 0
);

CREATE TABLE IF NOT EXISTS wordle_duel_guesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    duel_id TEXT NOT NULL REFERENCES wordle_duels(id) ON DELETE CASCADE,
    player_token TEXT NOT NULL,
    word TEXT NOT NULL,
    result TEXT NOT NULL,
    guessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics: raw pageview/beacon events (short retention, pruned by background job)
CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TIMESTAMP NOT NULL,
    event_type TEXT NOT NULL,
    page TEXT NOT NULL,
    fp_hash TEXT NOT NULL,
    ua_class TEXT NOT NULL,
    device TEXT,
    browser TEXT,
    country TEXT,
    referrer_domain TEXT
);
CREATE INDEX IF NOT EXISTS idx_analytics_events_ts ON analytics_events(ts);
CREATE INDEX IF NOT EXISTS idx_analytics_events_fp ON analytics_events(fp_hash, ts);

-- Analytics: permanent per-day rollups derived from events (unique_visitors, pageviews)
CREATE TABLE IF NOT EXISTS analytics_daily (
    date TEXT NOT NULL,
    metric TEXT NOT NULL,
    dimension TEXT NOT NULL DEFAULT '*',
    value INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (date, metric, dimension)
);

-- Analytics: server-authoritative action counters (guesses, solves, hints, reveals, games)
CREATE TABLE IF NOT EXISTS analytics_counters (
    date TEXT NOT NULL,
    metric TEXT NOT NULL,
    dimension TEXT NOT NULL DEFAULT '*',
    value INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (date, metric, dimension)
);

-- Analytics: aggregate count of guessed words across all users (top words)
CREATE TABLE IF NOT EXISTS analytics_word_counts (
    word TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0
);

-- Analytics: misc key/value metadata (e.g. last aggregation run)
CREATE TABLE IF NOT EXISTS analytics_meta (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Admin: global failed-login timestamps (cross-worker brute-force backstop)
CREATE TABLE IF NOT EXISTS admin_login_failures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_login_failures_ts ON admin_login_failures(ts);

-- Admin: the single registered WebAuthn/passkey credential (public key only).
CREATE TABLE IF NOT EXISTS admin_credentials (
    credential_id TEXT PRIMARY KEY,   -- base64url
    public_key    TEXT NOT NULL,      -- base64url (COSE public key)
    sign_count    INTEGER NOT NULL DEFAULT 0,
    transports    TEXT,               -- JSON array, optional
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


async def init_db(db_path: str) -> None:
    """Create tables if they don't exist."""
    db = await aiosqlite.connect(db_path)
    try:
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute("PRAGMA foreign_keys=ON")
        await db.executescript(_SCHEMA)
        # Migration: add tip_count column if missing
        try:
            await db.execute("ALTER TABLE duel_players ADD COLUMN tip_count INTEGER NOT NULL DEFAULT 0")
        except Exception:
            pass  # column already exists
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
