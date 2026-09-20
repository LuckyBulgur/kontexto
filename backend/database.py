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
    round INTEGER NOT NULL DEFAULT 1,
    played_games TEXT NOT NULL DEFAULT '',
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

-- Koop (cooperative Kontexto): one shared, de-duplicated guess list per game.
-- The whole team wins together the moment anyone lands rank 1. Mirrors the duel
-- tables but the guess list is shared (UNIQUE(koop_id, word)) instead of
-- per-player, and the solved/best_rank state lives on the koop row.
CREATE TABLE IF NOT EXISTS koops (
    id TEXT PRIMARY KEY,
    game_number INTEGER NOT NULL,
    created_by TEXT NOT NULL,
    tips_allowed BOOLEAN NOT NULL DEFAULT 1,
    solved BOOLEAN NOT NULL DEFAULT 0,
    solved_by TEXT,
    gave_up BOOLEAN NOT NULL DEFAULT 0,
    best_rank INTEGER,
    round INTEGER NOT NULL DEFAULT 1,
    played_games TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS koop_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    koop_id TEXT NOT NULL REFERENCES koops(id) ON DELETE CASCADE,
    nickname TEXT NOT NULL,
    player_token TEXT NOT NULL UNIQUE,
    contribution_count INTEGER NOT NULL DEFAULT 0,
    connected BOOLEAN NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS koop_guesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    koop_id TEXT NOT NULL REFERENCES koops(id) ON DELETE CASCADE,
    player_token TEXT NOT NULL,
    nickname TEXT NOT NULL,
    word TEXT NOT NULL,
    rank INTEGER NOT NULL,
    is_tip BOOLEAN NOT NULL DEFAULT 0,
    guessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(koop_id, word)
);

-- Arenas: the three timed multiplayer modes (Battle Royale, Blitz-Duell,
-- Zeitbonus-Jagd). One table triple for all three rather than a fourth copy of
-- the duel tables: they differ only in how a deadline is set and what happens
-- when it passes.
--
-- Every deadline is an absolute UTC timestamp written by the server
-- (arena._iso, fixed width so SQLite's string comparison is a time comparison).
-- A duration plus a client start time would be unverifiable and would drift.
CREATE TABLE IF NOT EXISTS arenas (
    id TEXT PRIMARY KEY,
    mode TEXT NOT NULL,                       -- royale | blitz | timerush
    game_number INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'lobby',     -- lobby | running | finished
    -- royale: how many elimination phases have already passed.
    phase INTEGER NOT NULL DEFAULT 0,
    -- The shared clock (royale, blitz). timerush runs a clock per player.
    deadline_at TEXT,
    started_at TEXT,
    finished_at TEXT,
    winner TEXT,
    round INTEGER NOT NULL DEFAULT 1,
    played_games TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS arena_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    arena_id TEXT NOT NULL REFERENCES arenas(id) ON DELETE CASCADE,
    nickname TEXT NOT NULL,
    player_token TEXT NOT NULL UNIQUE,
    best_rank INTEGER,
    guess_count INTEGER NOT NULL DEFAULT 0,
    solved BOOLEAN NOT NULL DEFAULT 0,
    connected BOOLEAN NOT NULL DEFAULT 0,
    -- timerush only: this player's own clock.
    deadline_at TEXT,
    eliminated_at TEXT,
    -- Final standing, 1 = winner. Filled as players drop out.
    place INTEGER
);

CREATE TABLE IF NOT EXISTS arena_guesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    arena_id TEXT NOT NULL REFERENCES arenas(id) ON DELETE CASCADE,
    player_token TEXT NOT NULL,
    word TEXT NOT NULL,
    rank INTEGER NOT NULL,
    guessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_arena_players_arena ON arena_players(arena_id);
CREATE INDEX IF NOT EXISTS idx_arena_guesses_arena ON arena_guesses(arena_id, player_token);
-- The deadline evaluator scans running arenas once a second.
CREATE INDEX IF NOT EXISTS idx_arenas_running ON arenas(status, deadline_at);

-- Random matchmaking. One queue in front of every multiplayer mode, so a player
-- with nobody to invite can still get a game.
--
-- It is a table, not process memory: the five uvicorn workers share nothing but
-- this file, so an in-memory queue would only ever pair two players who happened
-- to hit the same worker. Pairing itself runs in the single WS worker.
CREATE TABLE IF NOT EXISTS matchmaking_queue (
    ticket TEXT PRIMARY KEY,
    mode TEXT NOT NULL,
    nickname TEXT NOT NULL,
    enqueued_at TEXT NOT NULL,
    -- Filled the moment the ticket is matched; the client polls for these.
    matched_room_id TEXT,
    matched_token TEXT,
    matched_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_matchmaking_waiting
    ON matchmaking_queue(mode, matched_room_id, enqueued_at);

CREATE TABLE IF NOT EXISTS wordle_duels (
    id TEXT PRIMARY KEY,
    game_number INTEGER NOT NULL,
    created_by TEXT NOT NULL,
    round INTEGER NOT NULL DEFAULT 1,
    played_games TEXT NOT NULL DEFAULT '',
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
    os TEXT,
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

-- Analytics: all-time unique-visitor HyperLogLog sketch (register -> max rank).
-- Privacy-preserving cardinality: stores only register maxima, never an identifier,
-- so it is non-reversible and cannot answer "was person X ever here?". Folded at
-- pageview time via an idempotent MAX-upsert (commutative => concurrency-safe across
-- the 5 SQLite writers; no read-modify-write race, no stored fingerprint).
CREATE TABLE IF NOT EXISTS analytics_hll (
    register INTEGER PRIMARY KEY,
    rank INTEGER NOT NULL
);

-- Analytics: per-calendar-month unique-visitor HLL sketches. Permanent (never
-- pruned), so monthly unique counts survive the 35-day raw-event retention and
-- power an honest month-over-month visitor comparison.
CREATE TABLE IF NOT EXISTS analytics_hll_monthly (
    month TEXT NOT NULL,         -- 'YYYY-MM'
    register INTEGER NOT NULL,
    rank INTEGER NOT NULL,
    PRIMARY KEY (month, register)
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

-- Analytics: dedup ledger for "a game was started". One row per visitor, mode
-- and game per day, so the start counter cannot be inflated by a client that
-- flags every guess as the first one. Pruned with the raw-event window.
CREATE TABLE IF NOT EXISTS analytics_start_seen (
    fp_hash TEXT NOT NULL,
    mode TEXT NOT NULL,
    game_number INTEGER NOT NULL,
    date TEXT NOT NULL,
    ts TIMESTAMP NOT NULL,
    PRIMARY KEY (fp_hash, mode, game_number, date)
);
CREATE INDEX IF NOT EXISTS idx_analytics_start_seen_ts ON analytics_start_seen(ts);

-- Analytics: dedup ledger for the attribution survey ("Woher kennst du Kontexto?").
-- One accepted answer per (fingerprint, survey version); detail_done caps the
-- optional free text at one per answer. Retention is longer than the raw-event
-- window (SURVEY_SEEN_RETENTION_DAYS) because the survey runs for months and the
-- ledger is the only thing preventing a repeat answer from the same visitor.
CREATE TABLE IF NOT EXISTS analytics_survey_seen (
    fp_hash TEXT NOT NULL,
    survey TEXT NOT NULL,
    detail_done INTEGER NOT NULL DEFAULT 0,
    ts TIMESTAMP NOT NULL,
    PRIMARY KEY (fp_hash, survey)
);
CREATE INDEX IF NOT EXISTS idx_analytics_survey_seen_ts ON analytics_survey_seen(ts);

-- Analytics: the optional free text of a survey answer, deliberately stored
-- without fp_hash so a comment can never be linked back to a visitor. The
-- countable answer itself lives in analytics_counters (metric survey_source_v1),
-- so this table is purely qualitative. Permanent, never pruned.
CREATE TABLE IF NOT EXISTS analytics_survey_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    survey TEXT NOT NULL,
    source TEXT NOT NULL,
    detail TEXT NOT NULL,
    date TEXT NOT NULL,
    ts TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_survey_details_ts ON analytics_survey_details(ts);

-- Analytics: live-presence heartbeats (one row per active visitor fingerprint).
-- Each open page upserts its fp_hash + last_seen on a short interval; the live
-- "currently online" count is COUNT(*) of rows whose last_seen is within the
-- presence window. fp_hash is the PRIMARY KEY, so the upsert is idempotent and
-- concurrency-safe across the 5 SQLite writers, and the count is inherently
-- de-duplicated per visitor. Rows are transient (pruned on the cleanup loop);
-- no identifier beyond the same monthly-rotating, non-reversible fingerprint
-- the rest of analytics already uses is stored.
CREATE TABLE IF NOT EXISTS analytics_presence (
    fp_hash TEXT PRIMARY KEY,
    last_seen TIMESTAMP NOT NULL,
    page TEXT
);
CREATE INDEX IF NOT EXISTS idx_analytics_presence_last_seen ON analytics_presence(last_seen);

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
    the rest are per-connection and must be re-applied on every open. Centralised
    here so that every writer shares the same settings: request connections, the
    background loop, and ad-hoc analytics connections.

    synchronous=NORMAL is the recommended companion to WAL: under WAL the only
    durability it sacrifices is that the last few committed transactions may be
    rolled back after an OS crash or power loss; the database can NEVER be
    corrupted (per the SQLite docs). In exchange it drops the per-commit fsync
    that, under FULL, serialises every one of the five writers behind a disk flush
    and was the dominant cause of multi-second write latency under load. WAL is
    still checkpointed (and fsync'd) periodically, so committed data reaches disk.
    temp_store=MEMORY keeps transient indices/sorts off disk.
    """
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA synchronous=NORMAL")
    await db.execute("PRAGMA temp_store=MEMORY")
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
        # Migration: add per-event OS class for the operating-system breakdown.
        try:
            await db.execute("ALTER TABLE analytics_events ADD COLUMN os TEXT")
        except Exception:
            pass  # column already exists
        # Migration "Nächstes Spiel": round counter + per-room played-game history
        # so a multiplayer room can advance to a fresh game on the same link.
        for table in ("duels", "koops", "wordle_duels"):
            try:
                await db.execute(f"ALTER TABLE {table} ADD COLUMN round INTEGER NOT NULL DEFAULT 1")
            except Exception:
                pass  # column already exists
            try:
                await db.execute(f"ALTER TABLE {table} ADD COLUMN played_games TEXT NOT NULL DEFAULT ''")
            except Exception:
                pass  # column already exists
        # Migration koop "Aufgeben": team-wide give-up flag.
        try:
            await db.execute("ALTER TABLE koops ADD COLUMN gave_up BOOLEAN NOT NULL DEFAULT 0")
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
