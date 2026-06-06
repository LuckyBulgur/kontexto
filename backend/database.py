"""SQLite database setup for duel mode."""

import aiosqlite

# Production runs five uvicorn workers (4 API + 1 WS) that all write to this one
# SQLite file. WAL permits only a single writer at a time; with SQLite's default
# busy timeout of 0 a second concurrent writer fails immediately with SQLITE_BUSY.
# A non-zero timeout makes writers queue for the lock instead of dropping the write.
BUSY_TIMEOUT_MS = 5000

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

-- Analytics: server-authoritative per-game (per target word) difficulty stats.
-- One row per (mode, game_number, metric); metric in {guesses, solves, reveals, hints}.
-- Powers the dashboard ranking of target words by solve rate / avg guesses.
CREATE TABLE IF NOT EXISTS analytics_game_stats (
    mode TEXT NOT NULL,
    game_number INTEGER NOT NULL,
    metric TEXT NOT NULL,
    value INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (mode, game_number, metric)
);

-- Analytics: dedup ledger for the client-reported completion beacon. At most one
-- accepted completion per (fingerprint, mode, game, outcome) per day; pruned with
-- the raw-event retention window via prune_old_events().
CREATE TABLE IF NOT EXISTS analytics_completion_seen (
    fp_hash TEXT NOT NULL,
    mode TEXT NOT NULL,
    game_number INTEGER NOT NULL,
    outcome TEXT NOT NULL,
    date TEXT NOT NULL,
    ts TIMESTAMP NOT NULL,
    PRIMARY KEY (fp_hash, mode, game_number, outcome, date)
);
CREATE INDEX IF NOT EXISTS idx_analytics_completion_seen_ts ON analytics_completion_seen(ts);

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


async def configure_connection(db: aiosqlite.Connection) -> None:
    """Apply the connection-level PRAGMAs every connection must use.

    journal_mode=WAL is persisted in the database header (set once, on disk), but
    foreign_keys and busy_timeout are per-connection and must be re-applied on
    every open. Centralised here so every writer — request connections, the
    background loop, and ad-hoc analytics connections — shares the same settings.
    """
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    await db.execute(f"PRAGMA busy_timeout={BUSY_TIMEOUT_MS}")


async def init_db(db_path: str) -> None:
    """Create tables if they don't exist."""
    db = await aiosqlite.connect(db_path)
    try:
        await configure_connection(db)
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
    """Open a connection with WAL mode, foreign keys and a busy timeout enabled."""
    db = await aiosqlite.connect(db_path)
    db.row_factory = aiosqlite.Row
    await configure_connection(db)
    return db
