"""SQLite database setup for duel mode."""

import aiosqlite

# Production runs five uvicorn workers (4 API + 1 WS) that all write to this one
# SQLite file. WAL permits only a single writer at a time; with SQLite's default
# busy timeout of 0 a second concurrent writer fails immediately with SQLITE_BUSY.
# A non-zero timeout makes writers queue for the lock instead of dropping the write.
BUSY_TIMEOUT_MS = 5000

_SCHEMA = """
CREATE TABLE IF NOT EXISTS creator_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    clip_url TEXT NOT NULL UNIQUE,
    channel_url TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    email TEXT,
    ip_hash TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    eligible_date TEXT,
    reviewed_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_creator_queue ON creator_submissions(status, eligible_date, id);
CREATE INDEX IF NOT EXISTS idx_creator_rate ON creator_submissions(ip_hash, submitted_at);
CREATE TABLE IF NOT EXISTS creator_days (
    game_number INTEGER PRIMARY KEY,
    submission_id INTEGER UNIQUE REFERENCES creator_submissions(id),
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS duels (
    id TEXT PRIMARY KEY,
    game_number INTEGER NOT NULL,
    created_by TEXT NOT NULL,
    tips_allowed BOOLEAN NOT NULL DEFAULT 1,
    round INTEGER NOT NULL DEFAULT 1,
    played_games TEXT NOT NULL DEFAULT '',
    -- Category filter (categories.py): ids in catalogue order, comma joined,
    -- empty for every field; show_category puts the round's field on screen.
    categories TEXT NOT NULL DEFAULT '',
    show_category BOOLEAN NOT NULL DEFAULT 0,
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
    -- Category filter (categories.py): ids in catalogue order, comma joined,
    -- empty for every field; show_category puts the round's field on screen.
    categories TEXT NOT NULL DEFAULT '',
    show_category BOOLEAN NOT NULL DEFAULT 0,
    -- NULL for an invited koop, whose id is the invitation. A live room sets
    -- it: its id stands in the streamer's address bar, on stream, so joining
    -- takes this secret, which only the host's guest link carries.
    join_secret TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS koop_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    koop_id TEXT NOT NULL REFERENCES koops(id) ON DELETE CASCADE,
    nickname TEXT NOT NULL,
    player_token TEXT NOT NULL UNIQUE,
    contribution_count INTEGER NOT NULL DEFAULT 0,
    connected BOOLEAN NOT NULL DEFAULT 0,
    -- Joined a live room through the host's guest link. A guest only guesses:
    -- tips, giving up and the next round stay with the streamer.
    guest BOOLEAN NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS koop_guesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    koop_id TEXT NOT NULL REFERENCES koops(id) ON DELETE CASCADE,
    player_token TEXT NOT NULL,
    nickname TEXT NOT NULL,
    word TEXT NOT NULL,
    rank INTEGER NOT NULL,
    is_tip BOOLEAN NOT NULL DEFAULT 0,
    -- Where a guess came from: NULL for a person at a keyboard, the platform
    -- name ('twitch', 'tiktok') for a line out of a live room's chat. The host
    -- page puts the platform logo next to every chat name.
    source TEXT,
    -- The chat badges the author carried when the line was read, as
    -- `set/version` pairs joined by commas (`moderator/1,subscriber/12`). NULL
    -- for a person at a keyboard. See live_chat.encode_badges.
    badges TEXT,
    guessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(koop_id, word)
);

-- Live chat mode: a koop room whose second input channel is a livestream chat.
-- Deliberately a binding table next to `koops` rather than a fourth table
-- triple, because the round, the shared guess list and the whole broadcast path
-- are koop's and stay koop's. What is new is only the binding of one room to
-- its chats (live_channels, one per platform).
--
-- A live room has two koop_players rows for its own: the host, and one that
-- stands for every chat it reads. Viewers do not become players, because a chat
-- with a few thousand people would produce a few thousand rows and a
-- player_joined frame per row out of the koop poll loop. Their guesses are
-- written under the chat's token with the chatter's display name, and their
-- standing lives in live_viewers. The only other rows are guests the host
-- invited through the guest link (koop_players.guest, koop.MAX_LIVE_GUESTS).
CREATE TABLE IF NOT EXISTS live_rooms (
    koop_id TEXT PRIMARY KEY REFERENCES koops(id) ON DELETE CASCADE,
    host_token TEXT NOT NULL,
    -- The chat writes its guesses as its own koop player, not as the host.
    -- The koop broadcast excludes the author of a guess from the frame it
    -- sends, so a guess written with the host's token would reach every socket
    -- except the host's, which is the only one there is.
    chat_token TEXT NOT NULL DEFAULT '',
    -- Retired with the OBS overlay (2026-10-01). Still written with a random
    -- value because the column is NOT NULL UNIQUE, which SQLite cannot drop.
    -- Nothing reads it.
    overlay_token TEXT NOT NULL UNIQUE,
    require_prefix BOOLEAN NOT NULL DEFAULT 0,
    -- The last time the host page asked for this room, raised at most every
    -- 30 s. A room nobody has had open for HOST_ABSENT_SECONDS is unbound by
    -- the ingest in the WS worker (live_chat.unbind_absent_rooms).
    host_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- The chats a live room reads, at most one per platform, so a streamer who
-- multistreams lets Twitch and TikTok guess on the same board. A bound room
-- always has at least one row here (live_chat.remove_live_channel refuses the
-- last one); the rows go with the room.
CREATE TABLE IF NOT EXISTS live_channels (
    koop_id TEXT NOT NULL REFERENCES live_rooms(koop_id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    -- Lowercased channel login, never the display name.
    channel TEXT NOT NULL,
    -- connecting | live | error, written by the reader task in the WS worker.
    chat_state TEXT NOT NULL DEFAULT 'connecting',
    chat_error TEXT,
    -- Set by the host: the reader stays connected, its lines stop counting
    -- until the host resumes.
    paused BOOLEAN NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (koop_id, platform)
);

-- One room per channel at a time. Anybody may open a room by typing a channel
-- name, so without this two people could bind two rooms to one chat and every
-- message would be counted twice, in two different games.
CREATE UNIQUE INDEX IF NOT EXISTS idx_live_channels_channel
    ON live_channels(platform, channel);

-- Ko-fi supporters who chose to be public, shown by name beside the board
-- (supporters.py). Name, Ko-fi's transaction id for idempotent retries, time,
-- and the review state: only 'approved' is public, 'pending' waits for the
-- operator with a reason code, 'rejected' keeps the id with an empty name.
-- No amount, no message, no email. Pruned after 30 days by the cleanup loop.
CREATE TABLE IF NOT EXISTS supporters (
    transaction_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_supporters_created ON supporters(created_at);

-- A short note from the operator to the streamer ("thanks for the stream"),
-- delivered through the host's own poll and shown only on the host page.
-- seen_at is set by the
-- host page once the note is on screen, so a lost poll response cannot swallow
-- it. The rows go with the binding (stop) or with the koop room (cleanup).
CREATE TABLE IF NOT EXISTS live_host_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    koop_id TEXT NOT NULL REFERENCES koops(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    seen_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_live_host_messages_room
    ON live_host_messages(koop_id, id);

-- Permanent, per-channel rollup: which streams played, how much, how well. This
-- is the one part of live chat mode that outlives the room.
--
-- The streamer's channel name is kept, because the channel is the unit the
-- figures are about and it is a public broadcast name. The chatters' names are
-- not: they live in live_viewers for the length of the round and go with it.
-- What survives of a chat is a count, which is the same posture the rest of the
-- analytics takes (see analytics.py: permanent rollups, no raw identities).
CREATE TABLE IF NOT EXISTS live_stream_stats (
    platform TEXT NOT NULL,
    channel TEXT NOT NULL,
    first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    -- Rooms opened for this channel, all time.
    sessions INTEGER NOT NULL DEFAULT 0,
    rounds INTEGER NOT NULL DEFAULT 0,
    guesses INTEGER NOT NULL DEFAULT 0,
    solves INTEGER NOT NULL DEFAULT 0,
    -- Distinct chatters who ever landed a guess here, counted at the moment a
    -- new one appears. A number, never a list.
    viewers INTEGER NOT NULL DEFAULT 0,
    best_rank INTEGER,
    -- Paid support, all time, raised once per event (live_events decides
    -- "once"). Bits are Twitch Bits, subs counts own subscriptions and
    -- resubscriptions, gift_subs the subscriptions bought for others, and
    -- tiktok_diamonds the diamond value of every finished gift streak.
    bits INTEGER NOT NULL DEFAULT 0,
    subs INTEGER NOT NULL DEFAULT 0,
    gift_subs INTEGER NOT NULL DEFAULT 0,
    tiktok_diamonds INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (platform, channel)
);

CREATE TABLE IF NOT EXISTS live_viewers (
    koop_id TEXT NOT NULL REFERENCES koops(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    -- The platform's immutable user id (Twitch: the `user-id` tag), not the
    -- display name, which the viewer can change between two messages.
    external_id TEXT NOT NULL,
    nickname TEXT NOT NULL,
    hits INTEGER NOT NULL DEFAULT 0,
    best_rank INTEGER,
    -- Accepted guesses in the near band (rank <= live_chat.NEAR_RANK) and
    -- rounds this viewer solved: the "Treffsicher" and "Wortfinder" boards.
    near_hits INTEGER NOT NULL DEFAULT 0,
    solves INTEGER NOT NULL DEFAULT 0,
    -- The badges seen on this viewer's latest counted line, encoded like
    -- koop_guesses.badges.
    badges TEXT,
    PRIMARY KEY (koop_id, platform, external_id)
);

-- Paid support read out of a live room's chats (Bits, subscriptions, gifted
-- subscriptions, TikTok gifts), shown on the host page and nowhere else. It is
-- celebrated, never played: nothing here changes a rank, a tip or a cooldown.
--
-- event_id is the platform's own message id (the IRC `id` tag, TikTok's
-- `common.msgId`), so a duplicate frame or a replay after a reconnect is an
-- INSERT OR IGNORE that changes nothing, and the per-channel totals in
-- live_stream_stats are raised only when the insert actually inserted. The
-- actor is the display name after the nickname rule; no free text of the event
-- (a resub message, a gift comment) is kept. Rows go with the binding and are
-- pruned after a day.
CREATE TABLE IF NOT EXISTS live_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    koop_id TEXT NOT NULL REFERENCES koops(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    event_id TEXT NOT NULL,
    -- live_chat.EVENT_KINDS
    kind TEXT NOT NULL,
    actor TEXT NOT NULL,
    badges TEXT,
    -- Bits for a cheer, subscriptions for a gift or a bomb, diamonds for a
    -- TikTok gift, 1 for an own subscription and for a TikTok follow, which is
    -- free and kept here only so the host page can thank for it.
    amount INTEGER NOT NULL DEFAULT 1,
    -- Twitch sub plan: 'prime', '1000', '2000', '3000'. NULL elsewhere.
    tier TEXT,
    months INTEGER,
    -- TikTok only: the gift's name, how many were sent, and its picture.
    gift_name TEXT,
    gift_count INTEGER,
    gift_image TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (koop_id, platform, event_id)
);

CREATE INDEX IF NOT EXISTS idx_live_events_room ON live_events(koop_id, id);

-- Twitch's own badge pictures, fetched from Helix by the WS worker
-- (twitch_badges.py) and resolved server side, so a browser never talks to
-- Twitch's API. scope is 'global' or a broadcaster id, whose channel badges
-- (the streamer's own subscriber and bits badges) win over the global ones.
CREATE TABLE IF NOT EXISTS twitch_badges (
    scope TEXT NOT NULL,
    set_id TEXT NOT NULL,
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    image_1x TEXT NOT NULL,
    image_2x TEXT NOT NULL,
    image_4x TEXT NOT NULL,
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (scope, set_id, version)
);

-- Which Twitch broadcaster id a bound channel has, read from the ROOMSTATE
-- line the reader receives on join. The host page's poll needs it to pick the
-- channel's own badges, and it runs on an API worker that never sees IRC.
CREATE TABLE IF NOT EXISTS twitch_channel_ids (
    channel TEXT PRIMARY KEY,
    broadcaster_id TEXT NOT NULL,
    seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    -- Category filter (categories.py): ids in catalogue order, comma joined,
    -- empty for every field; show_category puts the round's field on screen.
    categories TEXT NOT NULL DEFAULT '',
    show_category BOOLEAN NOT NULL DEFAULT 0,
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

-- Server-side players in matchmaking rooms (room_bots.py). A side table and
-- not a flag on the four player tables, so no existing SELECT on a player
-- table can carry the distinction into a response or a socket frame.
-- player_token is NULL while a staggered join is still pending; the join is
-- then due at next_action_at like any other move.
CREATE TABLE IF NOT EXISTS room_bots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mode TEXT NOT NULL,
    room_id TEXT NOT NULL,
    player_token TEXT UNIQUE,
    nickname TEXT NOT NULL,
    skill REAL NOT NULL,
    openers INTEGER NOT NULL,
    patience_seconds INTEGER NOT NULL,
    rounds_left INTEGER NOT NULL,
    round INTEGER NOT NULL DEFAULT 0,
    next_action_at TEXT NOT NULL,
    human_seen_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_room_bots_due ON room_bots(next_action_at);
CREATE INDEX IF NOT EXISTS idx_room_bots_room ON room_bots(room_id);

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

-- The live figures in the matchmaking picker count connected players across all
-- four room types on every cache miss. Partial indexes, because the interesting
-- rows are the few that are currently connected, not the whole table.
CREATE INDEX IF NOT EXISTS idx_duel_players_connected
    ON duel_players(connected) WHERE connected = 1;
CREATE INDEX IF NOT EXISTS idx_koop_players_connected
    ON koop_players(connected) WHERE connected = 1;
CREATE INDEX IF NOT EXISTS idx_arena_players_connected
    ON arena_players(connected) WHERE connected = 1;
CREATE INDEX IF NOT EXISTS idx_wordle_duel_players_connected
    ON wordle_duel_players(connected) WHERE connected = 1;

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

-- Analytics: dedup ledger for the post-round word rating. One vote per visitor
-- per solution word, which is what makes the tally a count of people rather
-- than a count of rounds: the random modes let the same person meet the same
-- word again, and a second opinion from the same person is not new evidence.
--
-- Keyed by the word and not by the game number, because a pool rebuild hands
-- the numbers out again: game 1091 was the word for dummy on 2026-09-22 and a
-- meeting three days later. The table replaced analytics_rating_seen, which was
-- keyed by number and is dropped in init_db.
--
-- verdict and reason are held here so the follow-up calls can be checked
-- against the vote they complete: a reason is only taken next to a "hard"
-- verdict of the same visitor, and a free text is filed under the verdict that
-- was counted, not under whatever the client sends with it. Retention matches
-- the survey ledger (RATING_SEEN_RETENTION_DAYS): by then the monthly
-- fingerprint salt has rotated so often that the row cannot match anybody.
CREATE TABLE IF NOT EXISTS analytics_rating_votes (
    fp_hash TEXT NOT NULL,
    word TEXT NOT NULL,
    verdict TEXT NOT NULL,
    reason TEXT,
    detail_done INTEGER NOT NULL DEFAULT 0,
    ts TIMESTAMP NOT NULL,
    PRIMARY KEY (fp_hash, word)
);
CREATE INDEX IF NOT EXISTS idx_analytics_rating_votes_ts ON analytics_rating_votes(ts);

-- Analytics: the optional free text of a word rating, stored without fp_hash so
-- a comment can never be linked back to a visitor, exactly like the survey
-- details above. The countable vote lives in analytics_counters (metric
-- word_rating_v2), so this table is purely qualitative and read by a human when
-- a word looks wrong in the dashboard. Permanent, never pruned.
--
-- word is the solution the comment is about; game_number is only the number it
-- had when the comment was written. Rows from before the column existed have no
-- word, and their number cannot be trusted to name one (see
-- analytics_rating_votes), so the dashboard leaves them out.
CREATE TABLE IF NOT EXISTS analytics_rating_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_number INTEGER NOT NULL,
    word TEXT,
    verdict TEXT NOT NULL,
    reason TEXT,
    detail TEXT NOT NULL,
    date TEXT NOT NULL,
    ts TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_rating_details_game
    ON analytics_rating_details(game_number);

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


# The columns a live room carried while it could read only one chat. They moved
# to live_channels (2026-09-30); last_chat_at was never written and goes too.
_LEGACY_LIVE_ROOM_COLUMNS = ("platform", "channel", "chat_state", "chat_error", "last_chat_at")


async def _live_room_columns(db: aiosqlite.Connection) -> set[str]:
    cursor = await db.execute("PRAGMA table_info(live_rooms)")
    return {row[1] for row in await cursor.fetchall()}


async def _migrate_live_channels(db: aiosqlite.Connection) -> None:
    """Move a single-chat live room's binding into live_channels.

    Every worker runs init_db at startup, all five at once after a deploy, so
    the move happens under BEGIN IMMEDIATE and the column check is repeated
    inside it: the first worker migrates, the others wait on the busy timeout
    and then find nothing left to do. A room that is on air during the deploy
    keeps its chat, with its state, because the rows are copied, not rebuilt.
    DROP COLUMN needs SQLite 3.35 and refuses an indexed column, hence the
    index goes first.
    """
    if "platform" not in await _live_room_columns(db):
        return
    await db.execute("BEGIN IMMEDIATE")
    try:
        columns = await _live_room_columns(db)
        if "platform" in columns:
            await db.execute(
                "INSERT OR IGNORE INTO live_channels "
                "(koop_id, platform, channel, chat_state, chat_error, created_at) "
                "SELECT koop_id, platform, channel, chat_state, chat_error, created_at "
                "FROM live_rooms"
            )
            await db.execute("DROP INDEX IF EXISTS idx_live_rooms_channel")
            for column in _LEGACY_LIVE_ROOM_COLUMNS:
                if column in columns:
                    await db.execute(f"ALTER TABLE live_rooms DROP COLUMN {column}")
        await db.commit()
    except BaseException:
        await db.rollback()
        raise


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
        # Migration: the supporters table shipped to development databases for a
        # day without review columns. A row from then is unreviewed, so the
        # default 'pending' is the safe reading of it.
        for column in (
            "status TEXT NOT NULL DEFAULT 'pending'",
            "reason TEXT",
        ):
            try:
                await db.execute(f"ALTER TABLE supporters ADD COLUMN {column}")
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
        # Migration live chat: the chat's own player token. A room created before
        # this column existed wrote its guesses as the host, which meant the koop
        # broadcast excluded the one socket that needed them.
        try:
            await db.execute(
                "ALTER TABLE live_rooms ADD COLUMN chat_token TEXT NOT NULL DEFAULT ''"
            )
        except Exception:
            pass  # column already exists
        # Migration live chat presence: when the host page last asked for its
        # room. SQLite refuses a non-constant default on ADD COLUMN, so the rows
        # that exist at the moment of the migration are stamped "now": a room
        # that is on air during a deploy must not look abandoned afterwards.
        try:
            await db.execute("ALTER TABLE live_rooms ADD COLUMN host_seen_at TIMESTAMP")
            await db.execute(
                "UPDATE live_rooms SET host_seen_at = CURRENT_TIMESTAMP WHERE host_seen_at IS NULL"
            )
        except Exception:
            pass  # column already exists
        # Migration koop "Herkunft": which chat a guess came from.
        try:
            await db.execute("ALTER TABLE koop_guesses ADD COLUMN source TEXT")
        except Exception:
            pass  # column already exists
        # Migration live badges and paid support (2026-10-01).
        for table, column in (
            ("koop_guesses", "badges TEXT"),
            ("live_viewers", "badges TEXT"),
            ("live_viewers", "near_hits INTEGER NOT NULL DEFAULT 0"),
            ("live_viewers", "solves INTEGER NOT NULL DEFAULT 0"),
            ("live_stream_stats", "bits INTEGER NOT NULL DEFAULT 0"),
            ("live_stream_stats", "subs INTEGER NOT NULL DEFAULT 0"),
            ("live_stream_stats", "gift_subs INTEGER NOT NULL DEFAULT 0"),
            ("live_stream_stats", "tiktok_diamonds INTEGER NOT NULL DEFAULT 0"),
        ):
            try:
                await db.execute(f"ALTER TABLE {table} ADD COLUMN {column}")
            except Exception:
                pass  # column already exists
        await db.commit()
        await _migrate_live_channels(db)
        # Migration word rating v2: comments name their word, and the ledger keyed
        # by game number is gone, because a pool rebuild renumbers the games.
        try:
            await db.execute("ALTER TABLE analytics_rating_details ADD COLUMN word TEXT")
        except Exception:
            pass  # column already exists
        await db.execute("DROP TABLE IF EXISTS analytics_rating_seen")
        # Migration: the Adcash consent banner is gone (2026-09-25). Its dedup
        # ledger held rotating fingerprints and its counters feed no dashboard.
        await db.execute("DROP TABLE IF EXISTS analytics_consent_seen")
        await db.execute("DELETE FROM analytics_counters WHERE metric = 'ad_consent'")
        # Migration koop "Aufgeben": team-wide give-up flag.
        try:
            await db.execute("ALTER TABLE koops ADD COLUMN gave_up BOOLEAN NOT NULL DEFAULT 0")
        except Exception:
            pass  # column already exists
        # Migration categories (2026-10-01): a room's field filter and whether it
        # shows the round's field. Constant defaults, so every room that exists
        # keeps drawing from every field and shows none, which is what it did.
        for table in ("duels", "koops", "arenas"):
            try:
                await db.execute(f"ALTER TABLE {table} ADD COLUMN categories TEXT NOT NULL DEFAULT ''")
            except Exception:
                pass  # column already exists
            try:
                await db.execute(
                    f"ALTER TABLE {table} ADD COLUMN show_category BOOLEAN NOT NULL DEFAULT 0"
                )
            except Exception:
                pass  # column already exists
        # Migration live guest link (2026-10-03): a live room's join secret and
        # the guest flag on its players.
        for table, column in (
            ("koops", "join_secret TEXT"),
            ("koop_players", "guest BOOLEAN NOT NULL DEFAULT 0"),
        ):
            try:
                await db.execute(f"ALTER TABLE {table} ADD COLUMN {column}")
            except Exception:
                pass  # column already exists
        # A live room on air during the deploy gets a secret of its own now,
        # because until then its id alone was enough to join, and the id is on
        # stream. randomblob is evaluated per row; IS NULL makes a second worker's
        # pass a no-op.
        await db.execute(
            "UPDATE koops SET join_secret = lower(hex(randomblob(24))) "
            "WHERE join_secret IS NULL AND id IN (SELECT koop_id FROM live_rooms)"
        )
        await db.commit()
    finally:
        await db.close()


async def get_db(db_path: str) -> aiosqlite.Connection:
    """Open a connection with WAL mode, foreign keys and a busy timeout enabled."""
    db = await aiosqlite.connect(db_path)
    db.row_factory = aiosqlite.Row
    await configure_connection(db)
    return db
