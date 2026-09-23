"""Server-side, cookieless, tamper-resistant analytics.

Design principles (see docs/superpowers/specs/2026-06-06-server-side-analytics-design.md):

- Authoritative metrics (guesses, solves, hints, reveals, games) are incremented
  server-side from real handler actions -- never trusted from the client. A bot
  cannot inflate them via forged beacon calls.
- Visitor identity is derived server-side from the real client IP + User-Agent,
  hashed with a secret, monthly-rotating salt. No IP / PII is stored, only a
  non-reversible hash. Monthly rotation => exact daily AND monthly unique users.
- Only pageviews need a client beacon (static pages produce no server hit). The
  beacon is hardened with a signed token, per-fingerprint dedup/caps, and a bot
  User-Agent blocklist.
"""

import asyncio
import hashlib
import hmac
import logging
import math
import os
import re
import sqlite3
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import aiosqlite

import counter_batcher
from database import configure_connection
from server_secret import server_secret as _server_secret
from wordlists import contains_profanity

logger = logging.getLogger(__name__)

# Local timezone for human-friendly time breakdowns (peak hours, weekday/hour
# heatmap). Raw event timestamps are stored in UTC; we project them to this zone
# for display so "20 Uhr" means 20:00 for the (predominantly German) audience.
DISPLAY_TZ = ZoneInfo("Europe/Berlin")

# --- Configuration -----------------------------------------------------------

# Window for beacon tokens and pageview de-duplication (seconds).
BEACON_WINDOW_SECONDS = 1800  # 30 minutes
# A visitor counts as "currently online" if their last heartbeat is within this
# window. The client sends a heartbeat every ~20 s; the window is wide enough to
# tolerate a couple of missed beats (e.g. a briefly backgrounded/throttled tab)
# without flickering the live count, while still dropping closed tabs quickly.
PRESENCE_WINDOW_SECONDS = 90
# Raw events older than this are pruned; rollups are kept forever.
EVENT_RETENTION_DAYS = 35
# Hard ceiling of accepted pageviews per fingerprint per day (flood protection).
MAX_EVENTS_PER_FP_PER_DAY = 300

# Attribution survey ("Woher kennst du Kontexto?"). The version lives in the key
# so a future question is a new survey and not a migration of this one.
SURVEY_SOURCE_VERSION = "source_v1"
SURVEY_SOURCE_METRIC = "survey_source_v1"
SURVEY_SOURCES = (
    "search", "friends", "tiktok", "instagram", "youtube", "twitch",
    "reddit", "other_game", "random", "other",
)
# The dedup ledger has to outlive the raw-event window: a visitor who answered in
# March must not be asked again in May. 180 days is the point where the monthly
# fingerprint salt has rotated so often that the row cannot match anyone anyway.
SURVEY_SEEN_RETENTION_DAYS = 180
# Hard cap for the optional free text (also enforced by the request model).
SURVEY_DETAIL_MAX_LEN = 80

# Ad consent banner (components/AdConsent.tsx). Counted so the dashboard can show
# how many visitors allow ads, and how many never answer at all.
#
# - shown: the first ask was on screen. The denominator: shown minus decided is
#   the share that ignored the banner, which a split of the answers alone hides.
# - required: a returning player who had not answered got the ask as a dialog
#   that needs a choice (components/AdConsent.tsx). Answers given there count as
#   granted / denied like any other; this kind says how often it happened.
# - granted / denied: the answer to that first ask.
# - regranted / revoked: a later change through "Cookie-Einstellungen".
#
# Each kind counts once per fingerprint (analytics_consent_seen), so a replayed
# beacon adds nothing. The fingerprint rotates monthly, and a visitor asked again
# in a later month (expiry, a new banner version, cleared storage) is a new ask.
# Nothing here reads or writes the visitor's device: the banner sends the beacon
# after the decision is made, and the row holds no identifier but the rotating
# hash, which the retention below removes.
AD_CONSENT_METRIC = "ad_consent"
AD_CONSENT_KINDS = ("shown", "required", "granted", "denied", "regranted", "revoked")
AD_CONSENT_SEEN_RETENTION_DAYS = 45
# Days of daily history the dashboard gets for the consent trend.
AD_CONSENT_TIMELINE_DAYS = 90

# Post-round word rating ("was this word fair?"). The version lives in the metric
# name for the same reason the survey's does: a future question is a new survey
# and not a migration of this one.
RATING_METRIC = "word_rating_v1"
#: How the round felt. Deliberately three, because a scale invites the middle and
#: the middle is the answer that carries no decision.
RATING_VERDICTS = ("easy", "right", "hard")
#: Only asked after "hard", and the reason it is asked at all: the guess count
#: already measures how far a word was, and cannot tell "nobody knows this word"
#: from "I could not find it". The first is a word that has to leave the pool,
#: the second is a good hard round.
RATING_REASONS = ("unknown_word", "no_idea", "bad_neighbours")
#: Stands in for "no reason given" inside the counter dimension, which is a flat
#: string and has no room for NULL.
RATING_NO_REASON = "none"
#: Below this the tally is not shown back to the player. A percentage out of four
#: votes is noise dressed as a measurement, and it would anchor the next voter.
RATING_MIN_VOTES = 20
RATING_SEEN_RETENTION_DAYS = SURVEY_SEEN_RETENTION_DAYS
RATING_DETAIL_MAX_LEN = SURVEY_DETAIL_MAX_LEN

# Interval the client heartbeats on (components/Analytics.tsx). Each heartbeat
# that reports a visible tab is worth this many seconds of attention. Changing
# the client interval without changing this constant skews the attention figure,
# hence the comment on both sides.
HEARTBEAT_SECONDS = 20
# Counter metrics that belong to the growth funnel.
START_METRIC = "starts"                   # a game was actually begun
SHARE_METRIC = "shares"                   # the share button was pressed
SHARE_ARRIVAL_METRIC = "share_arrivals"   # somebody came in through a shared link
ATTENTION_METRIC = "attention"            # heartbeats on a visible tab, per page

# Every game mode that may appear as a counter dimension. Kept in one place so a
# request can never invent a dimension: the endpoints validate against these
# tuples instead of forwarding whatever string arrived. Solo modes are the ones
# a single player finishes alone, and they are the only ones that report a
# give-up rank, because a multiplayer room ends for reasons other than giving up.
SOLO_MODES: tuple[str, ...] = (
    "kontexto", "infinite", "leiter", "limit", "doppel", "suddendeath",
)
MULTI_MODES: tuple[str, ...] = (
    "duel", "koop", "wordle", "wordle_duel", "royale", "blitz", "timerush",
    # A stream chat playing a koop round. Its own dimension, because one room can
    # produce thousands of guesses in an evening and would otherwise drown the
    # koop figures it has nothing to do with.
    "live",
)
GAME_MODES: tuple[str, ...] = SOLO_MODES + MULTI_MODES

# --- "Beliebt" in the mode picker -------------------------------------------
# One metric, dimension "<group>:<mode>", counted where a player commits to a
# mode: the first guess of a solo round, a created room, a queue ticket. The
# group is part of the dimension because the same mode is offered on two tabs
# (a duel against a friend and a duel against a stranger are different
# decisions), and a single ranking over both would let one tab decide the
# other's badge.
MODE_PICK_METRIC = "mode_picks"
# The daily Kontexto game is not in the list: it is the board the dialog opens
# on, not a row a player can pick, and its starts would outrank every other
# solo mode by an order of magnitude.
SOLO_PICK_MODES: tuple[str, ...] = ("infinite", "leiter", "limit", "doppel", "suddendeath")
FRIENDS_PICK_MODES: tuple[str, ...] = (
    "duel", "koop", "royale", "blitz", "timerush", "wordle_duel", "live",
)
STRANGERS_PICK_MODES: tuple[str, ...] = (
    "duel", "koop", "royale", "blitz", "timerush", "wordle_duel",
)
PICK_GROUPS: dict[str, tuple[str, ...]] = {
    "solo": SOLO_PICK_MODES,
    "friends": FRIENDS_PICK_MODES,
    "strangers": STRANGERS_PICK_MODES,
}
# A month is long enough to survive a quiet week and short enough that the badge
# follows what people do now rather than what they did after a launch post.
POPULAR_WINDOW_DAYS = 30
# Below this many picks in the window a group has no leader. Without the floor
# the badge would name whichever mode happened to be chosen three times on a
# Tuesday, which is a claim the data does not carry.
POPULAR_MIN_PICKS = 20
# Marker appended to a shared link (`?s=412`, `?s=u` for the endless mode).
_SHARE_MARKER = re.compile(r"^(?:[0-9]{1,6}|u)$")

# Number of trusted reverse-proxy hops in front of the app. Production chain is
# Caddy -> nginx (each appends one X-Forwarded-For entry), so the real client IP
# is the entry at position -HOPS. Configurable in case the topology changes.
TRUSTED_PROXY_HOPS = int(os.environ.get("KONTEXTO_TRUSTED_PROXY_HOPS", "2"))

# Admin login brute-force backstop (global, across all workers).
LOGIN_FAIL_WINDOW = 600  # 10 minutes
GLOBAL_LOGIN_FAIL_MAX = 100  # block all login attempts past this many failures/window

# Write resilience: even with a connection busy_timeout, a commit can still surface
# a transient SQLITE_BUSY (e.g. against a concurrent WAL checkpoint). Retry a few
# times with a short, growing backoff before giving up; a dropped write is then
# logged, never swallowed silently.
WRITE_RETRY_ATTEMPTS = 3
WRITE_RETRY_BASE_DELAY = 0.05  # seconds, multiplied by the attempt number

# Known crawler / non-human User-Agent markers (lowercased substring match).
_BOT_MARKERS = (
    "bot", "spider", "crawl", "slurp", "headless", "phantom", "puppeteer",
    "playwright", "selenium", "curl", "wget", "python-requests", "python-httpx",
    "go-http-client", "axios", "okhttp", "java/", "scrapy", "lighthouse",
    "pingdom", "uptime", "monitor", "preview", "facebookexternalhit",
    "embedly", "feedfetcher", "apache-httpclient",
)

# Accepted normalized page labels for pageview events. Anything else -> "other".
_PAGE_PATTERNS = (
    (re.compile(r"^/?$"), "/"),
    (re.compile(r"^/wordle/duel(/|$)"), "/wordle/duel"),
    (re.compile(r"^/wordle(/|$)"), "/wordle"),
    (re.compile(r"^/duel(/|$)"), "/duel"),
)


# --- Secrets & identity ------------------------------------------------------

def _salt_period(now: datetime) -> str:
    """Salt rotates monthly => stable per-month fingerprints."""
    return now.strftime("%Y-%m")


def _monthly_salt(now: datetime) -> bytes:
    return hmac.new(_server_secret(), _salt_period(now).encode(), hashlib.sha256).digest()


def client_ip_from_headers(
    x_forwarded_for: str | None,
    x_real_ip: str | None,
    peer: str | None,
    hops: int | None = None,
) -> str:
    """Resolve the real, non-spoofable client IP behind trusted proxies.

    Each trusted proxy appends the IP it received the connection from, so the
    real client is at position -HOPS in the X-Forwarded-For chain. Entries to
    the left of that are attacker-controlled and ignored. Falls back to the
    raw peer for direct (non-proxied / dev) access.

    NOTE: X-Real-IP is intentionally NOT trusted for identity here -- in the
    Caddy->nginx chain nginx sets it to Caddy's IP (constant for all visitors),
    which would collapse every visitor into one fingerprint.
    """
    hops = TRUSTED_PROXY_HOPS if hops is None else hops
    if x_forwarded_for:
        parts = [p.strip() for p in x_forwarded_for.split(",") if p.strip()]
        if parts:
            idx = len(parts) - hops
            return parts[idx if idx >= 0 else 0]
    if x_real_ip:
        return x_real_ip.strip()
    return peer or "0.0.0.0"


def compute_fingerprint(ip: str, user_agent: str, now: datetime) -> str:
    """Anonymous, non-reversible per-visitor hash. Stable within a calendar month.

    The same (ip, user_agent) yields the same hash across all workers for the
    whole month, and a different hash next month (salt rotation).
    """
    salt = _monthly_salt(now)
    material = f"{ip}|{user_agent}".encode()
    return hmac.new(salt, material, hashlib.sha256).hexdigest()[:32]


# --- All-time unique visitors (HyperLogLog) ----------------------------------
#
# A privacy-preserving estimator for "unique visitors since counting began".
# Unlike the monthly fingerprint -- which deliberately rotates so nobody can be
# tracked across months -- an all-time counter needs a STABLE per-visitor token.
# We never persist that token: it is hashed, folded into the sketch's registers,
# and discarded. The sketch stores only per-register maxima => non-reversible, no
# membership test ("was person X ever here?" is unanswerable), constant ~16 KB.
# Registers only ever increase, so folding is an idempotent MAX-upsert: safe across
# all five SQLite writers without a lock, and safe to repeat (re-adding a known
# visitor changes nothing).

HLL_PRECISION = 14                                  # 2^14 = 16384 registers
HLL_REGISTERS = 1 << HLL_PRECISION                  # ~0.81% standard error
_HLL_RANK_BITS = 64 - HLL_PRECISION                 # bits left for the rank (50)
# Bias constant alpha_m for the raw HyperLogLog estimate (Flajolet et al., 2007).
_HLL_ALPHA = 0.7213 / (1 + 1.079 / HLL_REGISTERS)


def _stable_fingerprint(ip: str, user_agent: str) -> int:
    """64-bit, non-rotating, non-reversible per-visitor hash for the all-time HLL.

    Uses a fixed (never-rotating) salt derived from the server secret, distinct
    from the monthly fingerprint salt. Returned as an int and never stored.
    """
    salt = hmac.new(_server_secret(), b"alltime-hll-v1", hashlib.sha256).digest()
    digest = hashlib.blake2b(f"{ip}|{user_agent}".encode(), key=salt, digest_size=8).digest()
    return int.from_bytes(digest, "big")


def _hll_register_rank(h: int) -> tuple[int, int]:
    """Map a 64-bit hash to its (register index, rank).

    The top HLL_PRECISION bits select the register; the rank is 1 + the number of
    leading zeros in the remaining bits (capped by the available bit width).
    """
    register = h >> _HLL_RANK_BITS
    w = h & ((1 << _HLL_RANK_BITS) - 1)
    rank = (_HLL_RANK_BITS - w.bit_length() + 1) if w else (_HLL_RANK_BITS + 1)
    return register, rank


def _hll_estimate(ranks: dict[int, int]) -> int:
    """Cardinality estimate from a {register: rank} mapping (absent register => 0).

    Raw HyperLogLog estimate with the small-range LinearCounting correction. The
    64-bit hash makes the large-range (hash-collision) correction unnecessary.
    """
    m = HLL_REGISTERS
    nonzero = 0
    inv_sum = 0.0
    for rank in ranks.values():
        if rank > 0:
            inv_sum += 2.0 ** (-rank)
            nonzero += 1
    zeros = m - nonzero
    inv_sum += zeros  # absent / zero registers each contribute 2^0 = 1
    if inv_sum <= 0:
        return 0
    estimate = _HLL_ALPHA * m * m / inv_sum
    if estimate <= 2.5 * m and zeros > 0:
        estimate = m * math.log(m / zeros)  # LinearCounting for small cardinalities
    return int(round(estimate))


def hll_register_rank_for(ip: str, user_agent: str) -> tuple[int, int]:
    """Public helper: (register, rank) for a visitor's stable token. For tests."""
    return _hll_register_rank(_stable_fingerprint(ip, user_agent))


# --- Beacon token (anti-spam) ------------------------------------------------

def _token_for_window(fp_hash: str, window: int) -> str:
    material = f"{fp_hash}|{window}".encode()
    return hmac.new(_server_secret(), material, hashlib.sha256).hexdigest()[:32]


def make_beacon_token(fp_hash: str, now: datetime) -> str:
    """Short-lived token bound to the requesting fingerprint (and thus IP+UA)."""
    window = int(now.timestamp()) // BEACON_WINDOW_SECONDS
    return _token_for_window(fp_hash, window)


def verify_beacon_token(token: str, fp_hash: str, now: datetime) -> bool:
    """Accept tokens from the current or previous window (~30-60 min validity)."""
    if not token:
        return False
    window = int(now.timestamp()) // BEACON_WINDOW_SECONDS
    for w in (window, window - 1):
        if hmac.compare_digest(token, _token_for_window(fp_hash, w)):
            return True
    return False


# --- Classification helpers --------------------------------------------------

def classify_user_agent(user_agent: str) -> tuple[str, str, str, str]:
    """Return (ua_class, device, browser, os). ua_class is 'human' or 'bot'."""
    ua = (user_agent or "").lower()
    if not ua or any(marker in ua for marker in _BOT_MARKERS):
        return "bot", "unknown", "unknown", "unknown"

    if "ipad" in ua or "tablet" in ua:
        device = "tablet"
    elif "mobi" in ua or "android" in ua or "iphone" in ua:
        device = "mobile"
    else:
        device = "desktop"

    if "edg" in ua:
        browser = "Edge"
    elif "firefox" in ua or "fxios" in ua:
        browser = "Firefox"
    elif "chrome" in ua or "crios" in ua:
        browser = "Chrome"
    elif "safari" in ua:
        browser = "Safari"
    else:
        browser = "other"

    # Operating system. Order matters: Android UA strings contain "linux" and iOS
    # strings contain "like mac os x", so the mobile OSes are matched first.
    if "android" in ua:
        os_name = "Android"
    elif "iphone" in ua or "ipad" in ua or "ipod" in ua:
        os_name = "iOS"
    elif "windows" in ua:
        os_name = "Windows"
    elif "mac os x" in ua or "macintosh" in ua:
        os_name = "macOS"
    elif "cros" in ua:
        os_name = "ChromeOS"
    elif "linux" in ua:
        os_name = "Linux"
    else:
        os_name = "other"
    return "human", device, browser, os_name


def normalize_page(path: str) -> str:
    """Collapse a request path to a small fixed set of page labels."""
    if not path:
        return "other"
    path = path.split("?", 1)[0].split("#", 1)[0].strip()
    for pattern, label in _PAGE_PATTERNS:
        if pattern.match(path):
            return label
    return "other"


def referrer_domain(referrer: str | None) -> str:
    """Extract a bare host from a referrer URL; '' for direct/self/empty."""
    if not referrer:
        return ""
    m = re.match(r"^[a-zA-Z]+://([^/:?#]+)", referrer)
    host = (m.group(1) if m else referrer).lower()
    if host.startswith("www."):
        host = host[4:]
    if host in ("kontexto.de", "localhost", "127.0.0.1", ""):
        return ""
    return host[:100]


# --- Recording ---------------------------------------------------------------

def _is_locked_error(exc: BaseException) -> bool:
    """True for the transient SQLITE_BUSY / 'database is locked' family."""
    return isinstance(exc, sqlite3.OperationalError) and "lock" in str(exc).lower()


async def _commit_with_retry(db: aiosqlite.Connection, write, *, description: str) -> bool:
    """Run ``await write(db)`` then commit, retrying on lock contention.

    Between attempts the transaction is rolled back so a retried write is never
    applied twice. Returns True on success; on exhaustion the loss is logged and
    False is returned (never silently swallowed). Non-lock errors propagate.
    """
    last_exc: sqlite3.OperationalError | None = None
    for attempt in range(1, WRITE_RETRY_ATTEMPTS + 1):
        try:
            await write(db)
            await db.commit()
            return True
        except sqlite3.OperationalError as exc:
            if not _is_locked_error(exc):
                raise
            last_exc = exc
            await db.rollback()
            if attempt < WRITE_RETRY_ATTEMPTS:
                await asyncio.sleep(WRITE_RETRY_BASE_DELAY * attempt)
    logger.warning(
        "analytics write '%s' dropped after %d attempts: %s",
        description, WRITE_RETRY_ATTEMPTS, last_exc,
    )
    return False


# --- Coalescing counter writer ------------------------------------------------
#
# Action counters (analytics_counters / analytics_game_stats / analytics_word_counts)
# are written through a per-worker in-memory batcher (counter_batcher.py) so that a
# burst of guesses no longer means a burst of individual fsync'd transactions all
# serialising on the single SQLite write lock. record_action/record_game_stat below
# enqueue into it when it is running, and fall back to an immediate write otherwise
# (tests, scripts, any context that did not start the batcher).
_batcher: counter_batcher.CounterBatcher | None = None


async def start_counter_batcher(
    db_path: str, flush_interval: float = counter_batcher.DEFAULT_FLUSH_INTERVAL
) -> None:
    """Start the per-worker counter batcher. Call once at worker startup."""
    global _batcher
    if _batcher is not None and _batcher.running:
        return
    _batcher = counter_batcher.CounterBatcher(db_path, flush_interval)
    await _batcher.start()


async def stop_counter_batcher() -> None:
    """Stop the batcher and flush any buffered increments. Call at shutdown."""
    global _batcher
    if _batcher is not None:
        await _batcher.stop()
        _batcher = None


async def flush_counters() -> None:
    """Flush this worker's buffered counters immediately (no-op if not batching).

    Used to freshen the serving worker's own contributions before an analytics
    read (the admin dashboard). Other workers' sub-flush-interval buffers are not
    visible, but everything older than one interval is already in SQLite, so the
    dashboard is effectively current.
    """
    if _batcher is not None and _batcher.running:
        await _batcher.flush()


async def record_pageview(
    db: aiosqlite.Connection,
    *,
    ip: str,
    user_agent: str,
    referrer: str | None,
    page: str,
    token: str,
    country: str = "",
    share: str | None = None,
    now: datetime | None = None,
) -> tuple[bool, str]:
    """Validate and store a pageview beacon.

    `share` is the marker of a shared result link (`?s=<game>`), the only way to
    see word of mouth that no referrer header ever reports: a link pasted into a
    messenger arrives without one. It is counted per page, never stored per
    visitor.

    Returns (accepted, reason). Rejected calls never raise and never count.
    """
    now = now or datetime.now(timezone.utc)
    fp_hash = compute_fingerprint(ip, user_agent, now)

    if not verify_beacon_token(token, fp_hash, now):
        return False, "invalid_token"

    ua_class, device, browser, os_name = classify_user_agent(user_agent)
    if ua_class == "bot":
        return False, "bot"

    label = normalize_page(page)
    window_start = now - timedelta(seconds=BEACON_WINDOW_SECONDS)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Arrivals through a shared link are counted before the pageview dedup: the
    # marker is stripped from the address bar on arrival, so it cannot be sent
    # twice, while the dedup window would silently drop the arrival of somebody
    # who had the page open half an hour ago.
    if share and _SHARE_MARKER.match(share):
        async def _bump_share(conn: aiosqlite.Connection) -> None:
            await _bump(conn, "analytics_counters", now.strftime("%Y-%m-%d"),
                        SHARE_ARRIVAL_METRIC, label, 1)

        await _commit_with_retry(db, _bump_share, description="share_arrival")

    # De-dup: at most one pageview per (fp, page) per window.
    cur = await db.execute(
        "SELECT 1 FROM analytics_events "
        "WHERE fp_hash = ? AND page = ? AND event_type = 'pageview' AND ts >= ? LIMIT 1",
        (fp_hash, label, window_start.isoformat()),
    )
    if await cur.fetchone():
        return False, "duplicate"

    # Flood cap: hard ceiling of events per fingerprint per day.
    cur = await db.execute(
        "SELECT COUNT(*) FROM analytics_events WHERE fp_hash = ? AND ts >= ?",
        (fp_hash, day_start.isoformat()),
    )
    if (await cur.fetchone())[0] >= MAX_EVENTS_PER_FP_PER_DAY:
        return False, "rate_limited"

    # Stable (never-stored) visitor token for the all-time + monthly HLL sketches.
    register, rank = _hll_register_rank(_stable_fingerprint(ip, user_agent))
    month = now.strftime("%Y-%m")
    day_iso = now.strftime("%Y-%m-%d")

    async def _insert(conn: aiosqlite.Connection) -> None:
        await conn.execute(
            "INSERT INTO analytics_events "
            "(ts, event_type, page, fp_hash, ua_class, device, browser, os, country, referrer_domain) "
            "VALUES (?, 'pageview', ?, ?, ?, ?, ?, ?, ?, ?)",
            (now.isoformat(), label, fp_hash, ua_class, device, browser, os_name,
             country, referrer_domain(referrer)),
        )
        # Fold the stable token into the all-time and current-month HLL sketches.
        # MAX-upsert => idempotent and safe under concurrent writers (no lock).
        await conn.execute(
            "INSERT INTO analytics_hll (register, rank) VALUES (?, ?) "
            "ON CONFLICT(register) DO UPDATE SET rank = MAX(rank, excluded.rank)",
            (register, rank),
        )
        await conn.execute(
            "INSERT INTO analytics_hll_monthly (month, register, rank) VALUES (?, ?, ?) "
            "ON CONFLICT(month, register) DO UPDATE SET rank = MAX(rank, excluded.rank)",
            (month, register, rank),
        )
        # Stamp the day the all-time counter began (set once, never overwritten).
        await conn.execute(
            "INSERT OR IGNORE INTO analytics_meta (key, value) VALUES ('hll_since', ?)",
            (day_iso,),
        )

    accepted = await _commit_with_retry(db, _insert, description="record_pageview")
    return (True, "ok") if accepted else (False, "write_failed")


# --- Live presence (currently-online visitors) -------------------------------
#
# A separate, lightweight signal from the pageview beacon: while a page is open
# the client sends a small heartbeat every ~20 s. Each heartbeat upserts the
# visitor's (monthly-rotating, non-reversible) fingerprint with the current time.
# "Currently online" is then COUNT of fingerprints whose last_seen is inside the
# presence window. The fp_hash primary key makes the upsert idempotent and
# concurrency-safe across all SQLite writers and de-duplicates the count per
# visitor; nothing beyond the existing analytics fingerprint is stored.

async def record_heartbeat(
    db: aiosqlite.Connection,
    *,
    ip: str,
    user_agent: str,
    page: str,
    token: str,
    visible: bool = False,
    now: datetime | None = None,
) -> tuple[bool, str]:
    """Validate and store a live-presence heartbeat.

    Hardened like the pageview beacon: requires a valid, fingerprint-bound token
    and rejects bots. Returns (accepted, reason); rejected calls never raise.

    A heartbeat from a *visible* tab additionally counts HEARTBEAT_SECONDS of
    attention for that page. A backgrounded tab still keeps the visitor in the
    live count (they have the site open) but earns no attention, so the figure
    stays a reading time and not a tab-left-open time.
    """
    now = now or datetime.now(timezone.utc)
    fp_hash = compute_fingerprint(ip, user_agent, now)

    if not verify_beacon_token(token, fp_hash, now):
        return False, "invalid_token"
    if classify_user_agent(user_agent)[0] == "bot":
        return False, "bot"

    label = normalize_page(page)

    date_str = now.strftime("%Y-%m-%d")

    async def _write(conn: aiosqlite.Connection) -> None:
        await conn.execute(
            "INSERT INTO analytics_presence (fp_hash, last_seen, page) VALUES (?, ?, ?) "
            "ON CONFLICT(fp_hash) DO UPDATE SET last_seen = excluded.last_seen, page = excluded.page",
            (fp_hash, now.isoformat(), label),
        )
        if visible:
            await _bump(conn, "analytics_counters", date_str, ATTENTION_METRIC, label, 1)

    accepted = await _commit_with_retry(db, _write, description="record_heartbeat")
    return (True, "ok") if accepted else (False, "write_failed")


async def get_live_visitors(
    db: aiosqlite.Connection,
    now: datetime | None = None,
    window: int = PRESENCE_WINDOW_SECONDS,
) -> dict:
    """Currently-online visitor count (+ per-page split) from recent heartbeats."""
    now = now or datetime.now(timezone.utc)
    cutoff = (now - timedelta(seconds=window)).isoformat()
    cur = await db.execute(
        "SELECT COUNT(*) FROM analytics_presence WHERE last_seen >= ?", (cutoff,))
    active_now = (await cur.fetchone())[0]
    cur = await db.execute(
        "SELECT page, COUNT(*) FROM analytics_presence WHERE last_seen >= ? "
        "GROUP BY page ORDER BY 2 DESC",
        (cutoff,))
    by_page = {(page or "other"): count for page, count in await cur.fetchall()}
    return {
        "active_now": active_now,
        "by_page": by_page,
        "window_seconds": window,
        "generated_at": now.isoformat(),
    }


async def prune_presence(
    db: aiosqlite.Connection,
    now: datetime | None = None,
    window: int = PRESENCE_WINDOW_SECONDS,
) -> int:
    """Delete presence rows whose last heartbeat is outside the window."""
    now = now or datetime.now(timezone.utc)
    cutoff = (now - timedelta(seconds=window)).isoformat()
    cur = await db.execute("DELETE FROM analytics_presence WHERE last_seen < ?", (cutoff,))
    await db.commit()
    return cur.rowcount


async def _bump(db: aiosqlite.Connection, table: str, date_str: str, metric: str, dimension: str, amount: int) -> None:
    await db.execute(
        f"INSERT INTO {table} (date, metric, dimension, value) VALUES (?, ?, ?, ?) "
        f"ON CONFLICT(date, metric, dimension) DO UPDATE SET value = value + ?",
        (date_str, metric, dimension, amount, amount),
    )


async def record_action(
    db_path: str,
    metric: str,
    dimension: str = "*",
    *,
    word: str | None = None,
    now: datetime | None = None,
) -> None:
    """Increment a server-authoritative action counter.

    Called from inside game handlers. Uses its own short-lived connection and
    swallows all errors so analytics can never break a gameplay request.
    """
    now = now or datetime.now(timezone.utc)
    date_str = now.strftime("%Y-%m-%d")
    w = word.strip().lower()[:60] if (metric == "guesses" and word and word.strip()) else None

    # Fast path: coalesce in memory, off the request's critical path. The batcher
    # flushes additive upserts in batches, so a guess no longer waits on the write
    # lock. Falls through to an immediate write when the batcher isn't running.
    if _batcher is not None and _batcher.running:
        _batcher.incr_counter(date_str, metric, dimension, 1)
        if w:
            _batcher.incr_word(w, 1)
        return

    async def _write(conn: aiosqlite.Connection) -> None:
        await _bump(conn, "analytics_counters", date_str, metric, dimension, 1)
        if w:
            await conn.execute(
                "INSERT INTO analytics_word_counts (word, count) VALUES (?, 1) "
                "ON CONFLICT(word) DO UPDATE SET count = count + 1",
                (w,),
            )

    try:
        db = await aiosqlite.connect(db_path)
        try:
            await configure_connection(db)
            await _commit_with_retry(db, _write, description=f"record_action:{metric}/{dimension}")
        finally:
            await db.close()
    except Exception:
        # Analytics must never break a gameplay request, but the failure is logged
        # (not silently swallowed) so lost counts are observable in the logs.
        logger.exception(
            "analytics record_action failed unexpectedly (metric=%s dimension=%s)",
            metric, dimension,
        )


async def record_game_stat(
    db_path: str,
    mode: str,
    game_number: int,
    metric: str,
    now: datetime | None = None,
) -> None:
    """Increment a server-authoritative per-game counter (analytics_game_stats).

    Mirrors record_action's resilience (own short-lived connection, lock-aware
    commit retry, never breaks a gameplay request). ``metric`` is one of
    {guesses, solves, reveals, hints}; this powers the dashboard's "hardest /
    easiest target words" ranking (solve rate, avg guesses per word).
    """
    if _batcher is not None and _batcher.running:
        _batcher.incr_game_stat(mode, game_number, metric, 1)
        return

    async def _write(conn: aiosqlite.Connection) -> None:
        await conn.execute(
            "INSERT INTO analytics_game_stats (mode, game_number, metric, value) VALUES (?, ?, ?, 1) "
            "ON CONFLICT(mode, game_number, metric) DO UPDATE SET value = value + 1",
            (mode, int(game_number), metric),
        )

    try:
        db = await aiosqlite.connect(db_path)
        try:
            await configure_connection(db)
            await _commit_with_retry(
                db, _write, description=f"record_game_stat:{mode}/{game_number}/{metric}")
        finally:
            await db.close()
    except Exception:
        logger.exception(
            "analytics record_game_stat failed unexpectedly (mode=%s game=%s metric=%s)",
            mode, game_number, metric,
        )


# --- Completion beacon (client-reported distributions) -----------------------

# The server is stateless across a single player's guesses, so attempt-count,
# time-to-solve and give-up-rank distributions can only come from the client.
# These are bucketed (never raw values), token-gated, deduplicated and clamped,
# and clearly labelled "clientseitig gemeldet" in the dashboard. They feed ONLY
# the distribution histograms -- the authoritative solve/reveal totals come from
# the real handlers and are unaffected by this path.

def _bucket_guesses(n: int) -> str:
    for lo, hi, label in (
        (1, 1, "1"), (2, 3, "2-3"), (4, 5, "4-5"), (6, 10, "6-10"),
        (11, 20, "11-20"), (21, 50, "21-50"), (51, 100, "51-100"),
    ):
        if lo <= n <= hi:
            return label
    return "100+"


def _bucket_duration(seconds: int) -> str:
    minutes = seconds / 60
    for hi, label in (
        (1, "<1 Min"), (2, "1-2 Min"), (5, "2-5 Min"),
        (10, "5-10 Min"), (20, "10-20 Min"), (45, "20-45 Min"),
    ):
        if minutes < hi:
            return label
    return "45+ Min"


def _bucket_tips(n: int) -> str:
    if n <= 0:
        return "0"
    if n <= 3:
        return str(n)
    if n <= 5:
        return "4-5"
    return "6+"


def _bucket_rank(rank: int) -> str:
    for hi, label in (
        (10, "1-10"), (50, "11-50"), (200, "51-200"),
        (1000, "201-1000"), (5000, "1001-5000"),
    ):
        if rank <= hi:
            return label
    return "5000+"


async def record_completion(
    db: aiosqlite.Connection,
    *,
    ip: str,
    user_agent: str,
    token: str,
    mode: str,
    game_number: int,
    outcome: str,
    guesses: int,
    tips: int,
    duration_seconds: int,
    best_rank: int,
    now: datetime | None = None,
) -> tuple[bool, str]:
    """Record a client-reported game completion into the distribution histograms.

    Hardened like the pageview beacon: requires a valid, fingerprint-bound token,
    rejects bots, validates the enum payload, clamps every number, and dedups via
    the analytics_completion_seen primary key (one accepted completion per
    fingerprint / mode / game / outcome per day). Returns (accepted, reason).
    """
    now = now or datetime.now(timezone.utc)
    fp_hash = compute_fingerprint(ip, user_agent, now)

    if not verify_beacon_token(token, fp_hash, now):
        return False, "invalid_token"
    if classify_user_agent(user_agent)[0] == "bot":
        return False, "bot"
    if mode not in GAME_MODES or outcome not in ("solved", "gaveup"):
        return False, "bad_payload"

    guesses = max(1, min(int(guesses), 1000))
    tips = max(0, min(int(tips), 1000))
    duration_seconds = max(0, min(int(duration_seconds), 86400))
    best_rank = max(1, min(int(best_rank), 10_000_000))
    date_str = now.strftime("%Y-%m-%d")

    async def _write(conn: aiosqlite.Connection) -> None:
        # The primary key enforces dedup atomically; a duplicate raises
        # IntegrityError (handled below) before any histogram is touched.
        await conn.execute(
            "INSERT INTO analytics_completion_seen "
            "(fp_hash, mode, game_number, outcome, date, ts) VALUES (?, ?, ?, ?, ?, ?)",
            (fp_hash, mode, int(game_number), outcome, date_str, now.isoformat()),
        )
        await _bump(conn, "analytics_counters", date_str,
                    f"dist_tips_{mode}", _bucket_tips(tips), 1)
        if outcome == "solved":
            # "Attempts until solution" only counts solved games (matches its label).
            await _bump(conn, "analytics_counters", date_str,
                        f"dist_guesses_{mode}", _bucket_guesses(guesses), 1)
            await _bump(conn, "analytics_counters", date_str,
                        f"dist_time_{mode}", _bucket_duration(duration_seconds), 1)
        elif mode in SOLO_MODES:
            await _bump(conn, "analytics_counters", date_str,
                        "dist_giveup_rank", _bucket_rank(best_rank), 1)

    try:
        accepted = await _commit_with_retry(db, _write, description=f"record_completion:{mode}")
    except sqlite3.IntegrityError:
        await db.rollback()
        return False, "duplicate"
    return (True, "ok") if accepted else (False, "write_failed")


# --- Growth funnel: game starts and sharing ----------------------------------

async def record_game_start(
    db_path: str,
    *,
    ip: str,
    user_agent: str,
    mode: str,
    game_number: int,
    now: datetime | None = None,
) -> bool:
    """Count that a visitor actually began this game. Returns True if counted.

    Without it the dashboard only knows finished games, so an abandoned puzzle is
    invisible and the completion rate is unknowable.

    The client marks its first guess of a game, which keeps this off the hot path
    (one write per game instead of one per guess). That flag is a hint, not the
    authority: the ledger's primary key caps the count at one per fingerprint,
    mode and game per day, so a client that flags every guess still counts once.
    """
    now = now or datetime.now(timezone.utc)
    if classify_user_agent(user_agent)[0] == "bot":
        return False
    fp_hash = compute_fingerprint(ip, user_agent, now)
    date_str = now.strftime("%Y-%m-%d")

    try:
        db = await aiosqlite.connect(db_path)
        try:
            await configure_connection(db)
            cur = await db.execute(
                "INSERT OR IGNORE INTO analytics_start_seen "
                "(fp_hash, mode, game_number, date, ts) VALUES (?, ?, ?, ?, ?)",
                (fp_hash, mode, int(game_number), date_str, now.isoformat()),
            )
            await db.commit()
            if cur.rowcount != 1:
                return False
        finally:
            await db.close()
    except Exception:
        logger.exception("record_game_start failed (mode=%s, game=%s)", mode, game_number)
        return False

    await record_action(db_path, START_METRIC, mode, now=now)
    # The same event answers "which solo mode do people choose": it is deduped
    # per fingerprint, mode and game, so a long round counts once, exactly like
    # a created room or a queue ticket does on the other two tabs.
    await record_mode_pick(db_path, "solo", mode, now=now)
    return True


async def record_mode_pick(db_path: str, group: str, mode: str, now: datetime | None = None) -> bool:
    """Count that a player chose this mode on this tab of the picker.

    Returns False for a group or mode this project does not offer, so a handler
    can pass whatever it has without the counter growing a dimension nobody
    reads. Like every counter here it must never break the request it hangs off,
    which `record_action` already guarantees.
    """
    modes = PICK_GROUPS.get(group)
    if modes is None or mode not in modes:
        return False
    await record_action(db_path, MODE_PICK_METRIC, f"{group}:{mode}", now=now)
    return True


async def popular_modes(
    db: aiosqlite.Connection,
    now: datetime | None = None,
    window_days: int = POPULAR_WINDOW_DAYS,
    min_picks: int = POPULAR_MIN_PICKS,
) -> dict[str, str | None]:
    """The most-picked mode per group over the window, or None where unclear.

    None is the honest answer twice over: while a group has fewer than
    `min_picks` behind it, and when its leader is tied with the runner-up. The
    picker shows no badge then rather than a badge that means nothing. No
    absolute figures leave this function; the caller gets a name, because the
    dialog asks which mode is popular and not how busy the site is.
    """
    now = now or datetime.now(timezone.utc)
    since = (now - timedelta(days=window_days)).strftime("%Y-%m-%d")
    cur = await db.execute(
        "SELECT dimension, SUM(value) FROM analytics_counters "
        "WHERE metric = ? AND date >= ? GROUP BY dimension",
        (MODE_PICK_METRIC, since),
    )
    totals = {dim: int(value or 0) for dim, value in await cur.fetchall()}

    leaders: dict[str, str | None] = {}
    for group, modes in PICK_GROUPS.items():
        counts = sorted(
            ((mode, totals.get(f"{group}:{mode}", 0)) for mode in modes),
            key=lambda pair: (-pair[1], pair[0]),
        )
        if sum(count for _, count in counts) < min_picks:
            leaders[group] = None
            continue
        best, runner_up = counts[0], counts[1] if len(counts) > 1 else (None, 0)
        leaders[group] = best[0] if best[1] > runner_up[1] else None
    return leaders


async def record_share_click(
    db: aiosqlite.Connection,
    *,
    ip: str,
    user_agent: str,
    token: str,
    mode: str,
    now: datetime | None = None,
) -> tuple[bool, str]:
    """Count a press of the share button. Token-gated and bot-filtered.

    Deliberately client-reported: a copy to the clipboard produces no server hit,
    and there is no other way to see it. Paired with SHARE_ARRIVAL_METRIC it gives
    the only honest reading of word of mouth, shares against arrivals. It counts
    an intention, never a delivered visitor, and the dashboard says so.
    """
    now = now or datetime.now(timezone.utc)
    fp_hash = compute_fingerprint(ip, user_agent, now)

    if not verify_beacon_token(token, fp_hash, now):
        return False, "invalid_token"
    if classify_user_agent(user_agent)[0] == "bot":
        return False, "bot"
    if mode not in GAME_MODES:
        return False, "bad_payload"

    date_str = now.strftime("%Y-%m-%d")

    async def _write(conn: aiosqlite.Connection) -> None:
        await _bump(conn, "analytics_counters", date_str, SHARE_METRIC, mode, 1)

    accepted = await _commit_with_retry(db, _write, description="record_share_click")
    return (True, "ok") if accepted else (False, "write_failed")


# --- Ad consent ---------------------------------------------------------------

async def record_ad_consent(
    db: aiosqlite.Connection,
    *,
    ip: str,
    user_agent: str,
    token: str,
    kind: str,
    now: datetime | None = None,
) -> tuple[bool, str]:
    """Count one event of the ad consent banner. Returns (accepted, reason).

    Client-reported by necessity, because the decision is stored in the browser
    and produces no server hit. So it gets the posture of every client-reported
    figure here: a fingerprint-bound token, the bot filter, a closed enum and a
    dedup ledger whose primary key is the gate. It touches no authoritative
    counter.
    """
    now = now or datetime.now(timezone.utc)
    fp_hash = compute_fingerprint(ip, user_agent, now)

    if not verify_beacon_token(token, fp_hash, now):
        return False, "invalid_token"
    if classify_user_agent(user_agent)[0] == "bot":
        return False, "bot"
    if kind not in AD_CONSENT_KINDS:
        return False, "bad_payload"

    date_str = now.strftime("%Y-%m-%d")

    async def _write(conn: aiosqlite.Connection) -> None:
        # A repeat raises IntegrityError before the counter is touched.
        await conn.execute(
            "INSERT INTO analytics_consent_seen (fp_hash, kind, ts) VALUES (?, ?, ?)",
            (fp_hash, kind, now.isoformat()),
        )
        await _bump(conn, "analytics_counters", date_str, AD_CONSENT_METRIC, kind, 1)

    try:
        accepted = await _commit_with_retry(db, _write, description="record_ad_consent")
    except sqlite3.IntegrityError:
        await db.rollback()
        return False, "duplicate"
    return (True, "ok") if accepted else (False, "write_failed")


async def get_ad_consent_stats(db: aiosqlite.Connection, now: datetime) -> dict:
    """Ad consent payload for the admin dashboard.

    `totals` is all-time per kind, `last_30_days` the same over the trailing 30
    UTC days, `daily` one row per day of the last AD_CONSENT_TIMELINE_DAYS with
    every kind present, so the chart does not lose a series on a quiet day.
    """
    cur = await db.execute(
        "SELECT dimension, SUM(value) FROM analytics_counters "
        "WHERE metric = ? GROUP BY dimension",
        (AD_CONSENT_METRIC,),
    )
    found = {dim: value for dim, value in await cur.fetchall()}
    totals = {kind: found.get(kind, 0) for kind in AD_CONSENT_KINDS}

    first_day = (now - timedelta(days=AD_CONSENT_TIMELINE_DAYS - 1)).date()
    cur = await db.execute(
        "SELECT date, dimension, value FROM analytics_counters "
        "WHERE metric = ? AND date >= ?",
        (AD_CONSENT_METRIC, first_day.isoformat()),
    )
    by_day: dict[str, dict[str, int]] = {}
    for date_str, dim, value in await cur.fetchall():
        by_day.setdefault(date_str, {})[dim] = value
    daily = []
    for offset in range(AD_CONSENT_TIMELINE_DAYS):
        day = (first_day + timedelta(days=offset)).isoformat()
        row = by_day.get(day, {})
        daily.append({"date": day, **{kind: row.get(kind, 0) for kind in AD_CONSENT_KINDS}})

    recent = daily[-30:]
    last_30_days = {kind: sum(row[kind] for row in recent) for kind in AD_CONSENT_KINDS}

    return {"totals": totals, "last_30_days": last_30_days, "daily": daily}


# --- Attribution survey ------------------------------------------------------

def sanitize_survey_detail(detail: str | None) -> str | None:
    """Normalise the optional free text, or return None if nothing is left.

    Control characters are dropped, whitespace collapsed and the result capped at
    SURVEY_DETAIL_MAX_LEN. The text is otherwise kept verbatim (a creator handle
    or a link is exactly the useful part) and only ever rendered by React, which
    escapes it. Whether it is worth storing at all is decided separately, in
    record_survey_answer, because that is where the ledger lives.
    """
    if detail is None:
        return None
    cleaned = re.sub(r"[\x00-\x1f\x7f]", " ", detail)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if not cleaned:
        return None
    return cleaned[:SURVEY_DETAIL_MAX_LEN]


async def record_survey_answer(
    db: aiosqlite.Connection,
    *,
    ip: str,
    user_agent: str,
    token: str,
    source: str,
    detail: str | None = None,
    survey: str = SURVEY_SOURCE_VERSION,
    now: datetime | None = None,
) -> tuple[bool, str]:
    """Record one answer to the attribution survey. Returns (accepted, reason).

    Hardened exactly like the completion beacon: a valid, fingerprint-bound token
    is required, bots are rejected and the source must be a known enum member.

    The call comes in two shapes and the same function serves both:

    - Without `detail`: the first answer. The ledger insert is the dedup gate (its
      primary key raises IntegrityError on a repeat), and only a successful insert
      bumps the permanent counter.
    - With `detail`: the optional enrichment sent after the chip tap. A single
      conditional UPDATE flips detail_done, so exactly one free text per answer
      survives even if several workers process the call at once. Free text goes
      to a dashboard nobody asked to be insulted from, so it passes the same
      profanity blocklist as a matchmaking nickname.
    """
    now = now or datetime.now(timezone.utc)
    fp_hash = compute_fingerprint(ip, user_agent, now)

    if not verify_beacon_token(token, fp_hash, now):
        return False, "invalid_token"
    if classify_user_agent(user_agent)[0] == "bot":
        return False, "bot"
    if source not in SURVEY_SOURCES or survey != SURVEY_SOURCE_VERSION:
        return False, "bad_payload"

    date_str = now.strftime("%Y-%m-%d")
    clean_detail = sanitize_survey_detail(detail)

    if clean_detail is None:
        async def _write_answer(conn: aiosqlite.Connection) -> None:
            # The primary key enforces dedup atomically; a duplicate raises
            # IntegrityError before the counter is touched.
            await conn.execute(
                "INSERT INTO analytics_survey_seen (fp_hash, survey, ts) VALUES (?, ?, ?)",
                (fp_hash, survey, now.isoformat()),
            )
            await _bump(conn, "analytics_counters", date_str,
                        SURVEY_SOURCE_METRIC, source, 1)

        try:
            accepted = await _commit_with_retry(
                db, _write_answer, description="record_survey_answer")
        except sqlite3.IntegrityError:
            await db.rollback()
            return False, "duplicate"
        return (True, "ok") if accepted else (False, "write_failed")

    # An insult is dropped, not rejected. The ledger still burns this visitor's
    # one comment, so the text cannot be resent in a milder spelling until it
    # lands, and the caller still gets "ok", so nobody can probe the filter by
    # watching the response. The countable answer was already recorded by the
    # first call and stays untouched either way.
    keep_detail = not contains_profanity(clean_detail)
    stored = False

    async def _write_detail(conn: aiosqlite.Connection) -> None:
        nonlocal stored
        cur = await conn.execute(
            "UPDATE analytics_survey_seen SET detail_done = 1 "
            "WHERE fp_hash = ? AND survey = ? AND detail_done = 0",
            (fp_hash, survey),
        )
        if cur.rowcount != 1:
            stored = False
            return
        if keep_detail:
            await conn.execute(
                "INSERT INTO analytics_survey_details (survey, source, detail, date, ts) "
                "VALUES (?, ?, ?, ?, ?)",
                (survey, source, clean_detail, date_str, now.isoformat()),
            )
        stored = True

    accepted = await _commit_with_retry(
        db, _write_detail, description="record_survey_detail")
    if not accepted:
        return False, "write_failed"
    return (True, "ok") if stored else (False, "duplicate")



# --- Post-round word rating --------------------------------------------------
#
# The one metric that comes from the player rather than from a handler, and the
# reason the exception is worth making. Every gate this project built to judge a
# solution word failed the same way: the simulated player struck out the words
# for camera, clock and Christmas, the concreteness norms let in the words for
# ash tree and moth, and corpus frequency lost the words for body part and
# weekday just under its floor. None of them can answer "did anybody know this
# word", and the guess count cannot either, because a word nobody knows and a
# word that is simply far away both read as a long round.
#
# So it is asked. The posture is the one the distribution histograms already
# use, which is the only client-reported data this project accepts: a
# fingerprint-bound beacon token, a bot filter, a validated enum payload and a
# dedup ledger. It touches no authoritative counter.


def _rating_dimension(game_number: int, verdict: str, reason: str | None) -> str:
    """One counter dimension per (game, verdict, reason).

    A flat string because analytics_counters is (date, metric, dimension); the
    same shape mode_picks uses. Reading it back is a split on the colon, so the
    parts may not contain one, which the enums guarantee.
    """
    return f"{int(game_number)}:{verdict}:{reason or RATING_NO_REASON}"


def parse_rating_dimension(dimension: str) -> tuple[int, str, str] | None:
    """The inverse, tolerant of a row written by a future version."""
    parts = dimension.split(":")
    if len(parts) != 3 or not parts[0].isdigit():
        return None
    game, verdict, reason = int(parts[0]), parts[1], parts[2]
    if verdict not in RATING_VERDICTS:
        return None
    if reason != RATING_NO_REASON and reason not in RATING_REASONS:
        return None
    return game, verdict, reason


async def record_word_rating(
    db: aiosqlite.Connection,
    *,
    ip: str,
    user_agent: str,
    token: str,
    game_number: int,
    verdict: str,
    reason: str | None = None,
    detail: str | None = None,
    first_game: int = 1,
    now: datetime | None = None,
) -> tuple[bool, str]:
    """Record one vote on how a solution word played. Returns (accepted, reason).

    Two calls make one answer, exactly like the attribution survey: the first
    carries the verdict and books the ledger row, the second may add the free
    text. A vote without ``detail`` is the first call; a vote with it is the
    second, and it is only accepted once per visitor and game.

    A ``reason`` only means anything next to the "hard" verdict. Sent with any
    other it is dropped rather than rejected, because it carries no information
    there and a client that sends it is confused, not hostile.

    ``first_game`` is the lowest game number a vote may name, the caller passes
    ``GameState.first_curated_game()``. The games below it kept the words of the
    pool before the core-lexicon rebuild, verbs among them, and the archive
    still serves them. A vote on one of those says nothing about the pool the
    ratings exist to judge, and the dashboard would print it next to a word no
    rule of the current pool admitted.
    """
    now = now or datetime.now(timezone.utc)
    fp_hash = compute_fingerprint(ip, user_agent, now)

    if not verify_beacon_token(token, fp_hash, now):
        return False, "invalid_token"
    if classify_user_agent(user_agent)[0] == "bot":
        return False, "bot"
    if verdict not in RATING_VERDICTS:
        return False, "bad_payload"
    if reason is not None and reason not in RATING_REASONS:
        return False, "bad_payload"
    try:
        game = int(game_number)
    except (TypeError, ValueError):
        return False, "bad_payload"
    if game < 1:
        return False, "bad_payload"
    if game < first_game:
        return False, "legacy_game"
    if verdict != "hard":
        reason = None

    date_str = now.strftime("%Y-%m-%d")
    clean_detail = sanitize_survey_detail(detail)

    if clean_detail is None:
        async def _write_vote(conn: aiosqlite.Connection) -> None:
            # The primary key enforces dedup atomically; a duplicate raises
            # IntegrityError before the counter is touched.
            await conn.execute(
                "INSERT INTO analytics_rating_seen (fp_hash, game_number, ts) "
                "VALUES (?, ?, ?)",
                (fp_hash, game, now.isoformat()),
            )
            await _bump(conn, "analytics_counters", date_str, RATING_METRIC,
                        _rating_dimension(game, verdict, reason), 1)

        try:
            accepted = await _commit_with_retry(
                db, _write_vote, description="record_word_rating")
        except sqlite3.IntegrityError:
            await db.rollback()
            return False, "duplicate"
        return (True, "ok") if accepted else (False, "write_failed")

    # An insult is dropped, not rejected, for the reason written at the survey:
    # the ledger still burns this visitor's one comment, so the text cannot be
    # resent in a milder spelling, and the caller still gets "ok", so nobody can
    # probe the filter by watching the response.
    keep_detail = not contains_profanity(clean_detail)
    stored = False

    async def _write_detail(conn: aiosqlite.Connection) -> None:
        nonlocal stored
        cur = await conn.execute(
            "UPDATE analytics_rating_seen SET detail_done = 1 "
            "WHERE fp_hash = ? AND game_number = ? AND detail_done = 0",
            (fp_hash, game),
        )
        if cur.rowcount != 1:
            stored = False
            return
        if keep_detail:
            await conn.execute(
                "INSERT INTO analytics_rating_details "
                "(game_number, verdict, reason, detail, date, ts) VALUES (?, ?, ?, ?, ?, ?)",
                (game, verdict, reason, clean_detail, date_str, now.isoformat()),
            )
        stored = True

    accepted = await _commit_with_retry(
        db, _write_detail, description="record_word_rating_detail")
    if not accepted:
        return False, "write_failed"
    return (True, "ok") if stored else (False, "duplicate")


async def get_rating_summary(db: aiosqlite.Connection, game_number: int) -> dict:
    """The tally shown back to a player who has just voted.

    Silent below RATING_MIN_VOTES: a percentage out of four votes is noise
    dressed as a measurement, and the client would show it to the next voter,
    who would then be anchored on it.
    """
    prefix = f"{int(game_number)}:"
    counts = {verdict: 0 for verdict in RATING_VERDICTS}
    async with db.execute(
        "SELECT dimension, SUM(value) FROM analytics_counters "
        "WHERE metric = ? AND dimension LIKE ? GROUP BY dimension",
        (RATING_METRIC, prefix + "%"),
    ) as cursor:
        for dimension, value in await cursor.fetchall():
            parsed = parse_rating_dimension(dimension)
            if parsed is None or parsed[0] != int(game_number):
                continue
            counts[parsed[1]] += int(value or 0)

    total = sum(counts.values())
    return {
        "game_number": int(game_number),
        "total": total,
        "enough": total >= RATING_MIN_VOTES,
        "counts": counts if total >= RATING_MIN_VOTES else {v: 0 for v in RATING_VERDICTS},
    }


async def get_rating_stats(
    db: aiosqlite.Connection,
    *,
    target_words: list[str] | None = None,
    first_game: int = 1,
    min_votes: int = 5,
    limit: int = 40,
    detail_limit: int = 120,
) -> dict:
    """Word-quality payload for the admin dashboard.

    Coverage comes first on purpose. Without it every list below reads as if it
    stood for the pool, when in truth only words that ran as the daily puzzle
    collect a usable sample: the random modes spread roughly one round per game
    number over thousands of them.

    `min_votes` is deliberately lower than RATING_MIN_VOTES. The player-facing
    tally must not mislead; a dashboard read by one person who knows what a thin
    sample looks like is better served seeing it, and every row carries its own
    vote count.

    Games below ``first_game`` are left out everywhere, counts, lists and free
    text alike. They are the legacy games that ``record_word_rating`` refuses
    now, and the votes they collected before that refusal existed describe
    words the current pool never admitted.
    """
    per_game: dict[int, dict] = {}
    async with db.execute(
        "SELECT dimension, SUM(value) FROM analytics_counters "
        "WHERE metric = ? GROUP BY dimension",
        (RATING_METRIC,),
    ) as cursor:
        for dimension, value in await cursor.fetchall():
            parsed = parse_rating_dimension(dimension)
            if parsed is None:
                continue
            game, verdict, reason = parsed
            if game < first_game:
                continue
            entry = per_game.setdefault(game, {
                "game_number": game,
                "word": None,
                "votes": 0,
                "verdicts": {v: 0 for v in RATING_VERDICTS},
                "reasons": {r: 0 for r in RATING_REASONS},
            })
            count = int(value or 0)
            entry["votes"] += count
            entry["verdicts"][verdict] += count
            if reason in RATING_REASONS:
                entry["reasons"][reason] += count

    # The played word next to its number, so the dashboard can be read without
    # a second lookup. It is the answer to a past puzzle, which reveal() already
    # serves to anybody, so nothing is disclosed that was not public.
    if target_words:
        for game, entry in per_game.items():
            if 1 <= game <= len(target_words):
                entry["word"] = target_words[game - 1]

    # Play figures that already exist, so the dashboard can ask whether the vote
    # says anything the guess count does not.
    async with db.execute(
        "SELECT game_number, metric, value FROM analytics_game_stats WHERE mode = 'kontexto'"
    ) as cursor:
        for game, metric, value in await cursor.fetchall():
            entry = per_game.get(int(game))
            if entry is not None:
                entry[f"played_{metric}"] = int(value or 0)

    rated = [e for e in per_game.values() if e["votes"] >= min_votes]

    def share(entry: dict, verdict: str) -> float:
        return entry["verdicts"][verdict] / entry["votes"] if entry["votes"] else 0.0

    for entry in rated:
        entry["share_hard"] = round(share(entry, "hard"), 4)
        entry["share_easy"] = round(share(entry, "easy"), 4)
        entry["share_right"] = round(share(entry, "right"), 4)
        # The whole point of the follow-up question: a word nobody knew has to
        # leave the pool, a word that was merely far away is a good hard round.
        unknown = entry["reasons"]["unknown_word"]
        entry["share_unknown"] = round(unknown / entry["votes"], 4)

    details = []
    async with db.execute(
        "SELECT game_number, verdict, reason, detail, date FROM analytics_rating_details "
        "WHERE game_number >= ? ORDER BY id DESC LIMIT ?",
        (first_game, detail_limit),
    ) as cursor:
        for game, verdict, reason, detail, date in await cursor.fetchall():
            word = None
            if target_words and 1 <= int(game) <= len(target_words):
                word = target_words[int(game) - 1]
            details.append({"game_number": int(game), "word": word, "verdict": verdict,
                            "reason": reason, "detail": detail, "date": date})

    totals = {v: sum(e["verdicts"][v] for e in per_game.values()) for v in RATING_VERDICTS}
    reason_totals = {r: sum(e["reasons"][r] for e in per_game.values()) for r in RATING_REASONS}
    return {
        "min_votes": min_votes,
        "player_min_votes": RATING_MIN_VOTES,
        "pool_size": len(target_words or []),
        "games_with_any_vote": len(per_game),
        "games_rated": len(rated),
        "votes_total": sum(totals.values()),
        "verdicts": totals,
        "reasons": reason_totals,
        "removal_candidates": sorted(
            rated, key=lambda e: (-e["share_unknown"], -e["share_hard"]))[:limit],
        "too_easy": sorted(rated, key=lambda e: -e["share_easy"])[:limit],
        "rated": sorted(rated, key=lambda e: -e["votes"]),
        "details": details,
    }

async def get_survey_stats(db: aiosqlite.Connection, detail_limit: int = 100) -> dict:
    """Attribution-survey payload for the admin dashboard.

    `sources` is the all-time split, `sources_monthly` the same split per calendar
    month (both from the permanent counter rollups), `recent_details` the newest
    free texts. None of it can be traced to a visitor.
    """
    cur = await db.execute(
        "SELECT dimension, SUM(value) FROM analytics_counters "
        "WHERE metric = ? GROUP BY dimension",
        (SURVEY_SOURCE_METRIC,),
    )
    sources = {dim: value for dim, value in await cur.fetchall()}

    cur = await db.execute(
        "SELECT substr(date, 1, 7) AS m, dimension, SUM(value) FROM analytics_counters "
        "WHERE metric = ? GROUP BY m, dimension",
        (SURVEY_SOURCE_METRIC,),
    )
    monthly_map: dict[str, dict[str, int]] = {}
    for month, dim, value in await cur.fetchall():
        monthly_map.setdefault(month, {})[dim] = value
    sources_monthly = [
        {"month": month, "sources": monthly_map[month]} for month in sorted(monthly_map)
    ]

    cur = await db.execute(
        "SELECT source, detail, date FROM analytics_survey_details "
        "ORDER BY id DESC LIMIT ?",
        (detail_limit,),
    )
    recent_details = [
        {"source": source, "detail": detail, "date": date}
        for source, detail, date in await cur.fetchall()
    ]

    return {
        "sources": sources,
        "sources_monthly": sources_monthly,
        "recent_details": recent_details,
        "total": sum(sources.values()),
    }


# --- Admin login brute-force backstop ----------------------------------------

async def login_failures(db: aiosqlite.Connection, now: datetime | None = None,
                         window: int = LOGIN_FAIL_WINDOW) -> int:
    """Count global failed admin logins within the trailing window."""
    now = now or datetime.now(timezone.utc)
    cutoff = (now - timedelta(seconds=window)).isoformat()
    cur = await db.execute(
        "SELECT COUNT(*) FROM admin_login_failures WHERE ts >= ?", (cutoff,))
    return (await cur.fetchone())[0]


async def record_login_failure(db: aiosqlite.Connection, now: datetime | None = None) -> None:
    """Record one failed admin login and opportunistically prune old rows."""
    now = now or datetime.now(timezone.utc)
    await db.execute("INSERT INTO admin_login_failures (ts) VALUES (?)", (now.isoformat(),))
    await db.execute(
        "DELETE FROM admin_login_failures WHERE ts < ?",
        ((now - timedelta(hours=1)).isoformat(),))
    await db.commit()


# --- Aggregation & pruning (run in the single WS worker) ---------------------

async def aggregate_daily(db: aiosqlite.Connection, now: datetime | None = None) -> None:
    """Roll raw events into permanent per-day rollups (idempotent upsert)."""
    now = now or datetime.now(timezone.utc)
    # Aggregate every day still present in raw events (cheap; retention is small).
    cur = await db.execute(
        "SELECT DISTINCT substr(ts, 1, 10) FROM analytics_events"
    )
    days = [row[0] for row in await cur.fetchall()]
    for day in days:
        lo, hi = f"{day}T00:00:00", f"{day}T23:59:59.999999"
        # Unique human visitors that day.
        cur = await db.execute(
            "SELECT COUNT(DISTINCT fp_hash) FROM analytics_events "
            "WHERE ua_class = 'human' AND ts >= ? AND ts <= ?",
            (lo, hi),
        )
        uniques = (await cur.fetchone())[0]
        await db.execute(
            "INSERT INTO analytics_daily (date, metric, dimension, value) VALUES (?, 'unique_visitors', '*', ?) "
            "ON CONFLICT(date, metric, dimension) DO UPDATE SET value = excluded.value",
            (day, uniques),
        )
        # Pageviews per page label that day.
        cur = await db.execute(
            "SELECT page, COUNT(*) FROM analytics_events "
            "WHERE event_type = 'pageview' AND ua_class = 'human' AND ts >= ? AND ts <= ? "
            "GROUP BY page",
            (lo, hi),
        )
        for page, count in await cur.fetchall():
            await db.execute(
                "INSERT INTO analytics_daily (date, metric, dimension, value) VALUES (?, 'pageviews', ?, ?) "
                "ON CONFLICT(date, metric, dimension) DO UPDATE SET value = excluded.value",
                (day, page, count),
            )
    await db.execute(
        "INSERT INTO analytics_meta (key, value) VALUES ('last_aggregation', ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (now.isoformat(),),
    )
    await db.commit()


async def prune_old_events(db: aiosqlite.Connection, now: datetime | None = None) -> int:
    """Delete raw events older than the retention window. Returns rows deleted.

    Also prunes the completion-beacon dedup ledger on the same schedule -- those
    rows only exist to block same-day duplicates and need not outlive the raw
    events. The survey ledger has its own, longer window (see
    SURVEY_SEEN_RETENTION_DAYS); its aggregated answers live in the permanent
    counter rollups and are untouched by either sweep.
    """
    now = now or datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=EVENT_RETENTION_DAYS)).isoformat()
    survey_cutoff = (now - timedelta(days=SURVEY_SEEN_RETENTION_DAYS)).isoformat()
    cur = await db.execute("DELETE FROM analytics_events WHERE ts < ?", (cutoff,))
    await db.execute("DELETE FROM analytics_completion_seen WHERE ts < ?", (cutoff,))
    await db.execute("DELETE FROM analytics_start_seen WHERE ts < ?", (cutoff,))
    await db.execute("DELETE FROM analytics_survey_seen WHERE ts < ?", (survey_cutoff,))
    await db.execute(
        "DELETE FROM analytics_consent_seen WHERE ts < ?",
        ((now - timedelta(days=AD_CONSENT_SEEN_RETENTION_DAYS)).isoformat(),),
    )
    await db.execute(
        "DELETE FROM analytics_rating_seen WHERE ts < ?",
        ((now - timedelta(days=RATING_SEEN_RETENTION_DAYS)).isoformat(),),
    )
    await db.commit()
    return cur.rowcount


# --- Stats query (admin dashboard) -------------------------------------------

async def _unique_visitors_since(db: aiosqlite.Connection, start: datetime) -> int:
    cur = await db.execute(
        "SELECT COUNT(DISTINCT fp_hash) FROM analytics_events "
        "WHERE ua_class = 'human' AND ts >= ?",
        (start.isoformat(),),
    )
    return (await cur.fetchone())[0]


async def get_stats(db: aiosqlite.Connection, now: datetime | None = None,
                    target_words: list[str] | None = None,
                    first_rated_game: int = 1) -> dict:
    """Assemble the full statistics payload for the admin dashboard.

    ``target_words`` lets the word-quality section name the played word next
    to its number, and ``first_rated_game`` is the floor below which that
    section ignores votes (see ``get_rating_stats``). Both are optional because
    every other section works without the game data, and the analytics module
    has no business loading it.
    """
    now = now or datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    # Unique visitors (exact within retention window, which covers week & month).
    visitors = {
        "today": await _unique_visitors_since(db, today),
        "week": await _unique_visitors_since(db, week_start),
        "month": await _unique_visitors_since(db, month_start),
    }

    # Per-day unique-visitor timeline over the full history (from permanent
    # rollups). The frontend slices it to the selected range (today / 7 / 30 / all).
    cur = await db.execute(
        "SELECT date, value FROM analytics_daily "
        "WHERE metric = 'unique_visitors' AND dimension = '*' "
        "ORDER BY date"
    )
    visitors_timeline = [{"date": d, "value": v} for d, v in await cur.fetchall()]

    # Pageviews per page over the last 30 days, computed live from raw events so
    # the current (not-yet-aggregated) day is always included. The 30-day window
    # sits inside the raw-event retention window (EVENT_RETENTION_DAYS), so this is
    # exact and consistent with the live unique-visitor figures above.
    pageviews_since = (today - timedelta(days=30)).isoformat()
    cur = await db.execute(
        "SELECT page, COUNT(*) FROM analytics_events "
        "WHERE event_type = 'pageview' AND ua_class = 'human' AND ts >= ? "
        "GROUP BY page ORDER BY 2 DESC",
        (pageviews_since,),
    )
    pageviews_by_page = {page: count for page, count in await cur.fetchall()}

    # Action counters (server-authoritative): totals + today + per-day timeline.
    cur = await db.execute(
        "SELECT metric, SUM(value) FROM analytics_counters GROUP BY metric"
    )
    counters_total = {m: t for m, t in await cur.fetchall()}
    today_str = today.strftime("%Y-%m-%d")
    cur = await db.execute(
        "SELECT metric, SUM(value) FROM analytics_counters WHERE date = ? GROUP BY metric",
        (today_str,),
    )
    counters_today = {m: v for m, v in await cur.fetchall()}
    cur = await db.execute(
        "SELECT date, SUM(value) FROM analytics_counters "
        "WHERE metric = 'guesses' GROUP BY date ORDER BY date"
    )
    guesses_timeline = [{"date": d, "value": v} for d, v in await cur.fetchall()]

    # Completed games per mode (a game ends on a solve or a reveal/give-up).
    cur = await db.execute(
        "SELECT dimension, SUM(value) FROM analytics_counters "
        "WHERE metric IN ('solves', 'reveals') GROUP BY dimension"
    )
    games_by_mode = {dim: total for dim, total in await cur.fetchall()}

    # Engagement rates derived from authoritative counters.
    guesses_total = counters_total.get("guesses", 0)
    solves_total = counters_total.get("solves", 0)
    reveals_total = counters_total.get("reveals", 0)
    finished = solves_total + reveals_total
    engagement = {
        "guesses_total": guesses_total,
        "solves_total": solves_total,
        "reveals_total": reveals_total,
        "hints_total": counters_total.get("hints", 0),
        "solve_rate": round(solves_total / finished, 3) if finished else None,
        "avg_guesses_per_solve": round(guesses_total / solves_total, 1) if solves_total else None,
    }

    # Growth funnel: started vs. finished games, sharing, attention per page.
    cur = await db.execute(
        "SELECT dimension, SUM(value) FROM analytics_counters WHERE metric = ? GROUP BY dimension",
        (START_METRIC,))
    starts_by_mode = {dim: total for dim, total in await cur.fetchall()}
    starts_total = sum(starts_by_mode.values())
    # Finished games of the modes that report a start, so the rate compares like
    # with like (duel and koop have their own funnel and no start signal).
    finished_started_modes = sum(games_by_mode.get(m, 0) for m in starts_by_mode)
    funnel = {
        "starts_by_mode": starts_by_mode,
        "starts_total": starts_total,
        "finished_total": finished_started_modes,
        "completion_rate": (
            round(min(finished_started_modes / starts_total, 1.0), 3) if starts_total else None
        ),
        "abandoned_total": max(starts_total - finished_started_modes, 0),
    }

    cur = await db.execute(
        "SELECT dimension, SUM(value) FROM analytics_counters WHERE metric = ? GROUP BY dimension",
        (SHARE_METRIC,))
    shares_by_mode = {dim: total for dim, total in await cur.fetchall()}
    cur = await db.execute(
        "SELECT dimension, SUM(value) FROM analytics_counters WHERE metric = ? GROUP BY dimension",
        (SHARE_ARRIVAL_METRIC,))
    share_arrivals_by_page = {dim: total for dim, total in await cur.fetchall()}
    shares_total = sum(shares_by_mode.values())
    arrivals_total = sum(share_arrivals_by_page.values())
    sharing = {
        "shares_by_mode": shares_by_mode,
        "shares_total": shares_total,
        "arrivals_by_page": share_arrivals_by_page,
        "arrivals_total": arrivals_total,
        # Visitors brought in per share. Below 1 by nature: one pasted link can
        # reach many people, but most of them never click.
        "arrivals_per_share": round(arrivals_total / shares_total, 2) if shares_total else None,
    }

    cur = await db.execute(
        "SELECT dimension, SUM(value) FROM analytics_counters WHERE metric = ? GROUP BY dimension",
        (ATTENTION_METRIC,))
    attention_by_page = {
        dim: total * HEARTBEAT_SECONDS for dim, total in await cur.fetchall()
    }
    attention = {
        "seconds_by_page": attention_by_page,
        "seconds_total": sum(attention_by_page.values()),
        "sample_seconds": HEARTBEAT_SECONDS,
    }

    # Top guessed words across all users.
    cur = await db.execute(
        "SELECT word, count FROM analytics_word_counts ORDER BY count DESC LIMIT 20"
    )
    top_words = [{"word": w, "count": c} for w, c in await cur.fetchall()]

    # Technical breakdowns + peak hours (last 35 days of raw events).
    async def _breakdown(column: str) -> dict:
        cur = await db.execute(
            f"SELECT {column}, COUNT(DISTINCT fp_hash) FROM analytics_events "
            f"WHERE ua_class = 'human' GROUP BY {column} ORDER BY 2 DESC"
        )
        return {(k or "unknown"): v for k, v in await cur.fetchall()}

    devices = await _breakdown("device")
    browsers = await _breakdown("browser")
    os_breakdown = await _breakdown("os")
    cur = await db.execute(
        "SELECT referrer_domain, COUNT(*) FROM analytics_events "
        "WHERE ua_class = 'human' AND referrer_domain != '' GROUP BY referrer_domain ORDER BY 2 DESC LIMIT 15"
    )
    referrers = {k: v for k, v in await cur.fetchall()}
    # Peak hours + weekday/hour heatmap, projected to local (Berlin) time. Event
    # timestamps are UTC; bucketing in SQL would report UTC hours, so we fetch the
    # raw timestamps once and convert. Heatmap is [weekday 0=Mon..6=Sun][hour 0..23].
    cur = await db.execute(
        "SELECT ts FROM analytics_events "
        "WHERE ua_class = 'human' AND event_type = 'pageview'"
    )
    peak_hours = {str(h): 0 for h in range(24)}
    activity_heatmap = [[0] * 24 for _ in range(7)]
    # Today's pageviews per local hour, for the "Heute nach Stunde" chart.
    now_aware = now if now.tzinfo is not None else now.replace(tzinfo=timezone.utc)
    now_local = now_aware.astimezone(DISPLAY_TZ)
    today_hourly_full = [0] * 24
    for (ts,) in await cur.fetchall():
        try:
            dt = datetime.fromisoformat(ts)
        except (ValueError, TypeError):
            continue
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        local = dt.astimezone(DISPLAY_TZ)
        peak_hours[str(local.hour)] += 1
        activity_heatmap[local.weekday()][local.hour] += 1
        if local.date() == now_local.date():
            today_hourly_full[local.hour] += 1
    # Trim to the hours that have already elapsed today, so the chart ends at
    # "now" instead of dropping to zero for the rest of the day.
    today_hourly = today_hourly_full[: now_local.hour + 1]

    # Loyalty: visitors seen on >1 distinct day (within retention) are "returning".
    cur = await db.execute(
        "SELECT COUNT(DISTINCT substr(ts, 1, 10)) AS days FROM analytics_events "
        "WHERE ua_class = 'human' GROUP BY fp_hash"
    )
    day_counts = [row[0] for row in await cur.fetchall()]
    visitor_loyalty = {
        "new": sum(1 for d in day_counts if d == 1),
        "returning": sum(1 for d in day_counts if d > 1),
    }
    stickiness = round(visitors["today"] / visitors["month"], 3) if visitors["month"] else None

    # Pageviews timeline over the full history, summed across pages from permanent
    # rollups (the current day appears once aggregate_daily next runs, ~5 min lag).
    cur = await db.execute(
        "SELECT date, SUM(value) FROM analytics_daily "
        "WHERE metric = 'pageviews' GROUP BY date ORDER BY date"
    )
    pageviews_timeline = [{"date": d, "value": v} for d, v in await cur.fetchall()]

    # Solves + solve-rate timelines from authoritative counters.
    cur = await db.execute(
        "SELECT date, metric, SUM(value) FROM analytics_counters "
        "WHERE metric IN ('solves', 'reveals') GROUP BY date, metric"
    )
    by_date: dict[str, dict[str, int]] = {}
    for d, m, v in await cur.fetchall():
        by_date.setdefault(d, {})[m] = v
    all_dates = sorted(by_date)
    solves_timeline = [{"date": d, "value": by_date[d].get("solves", 0)} for d in all_dates]
    solve_rate_timeline = []
    for d in all_dates:
        s, r = by_date[d].get("solves", 0), by_date[d].get("reveals", 0)
        fin = s + r
        solve_rate_timeline.append({"date": d, "value": round(s / fin, 3) if fin else 0})

    # Hint usage by difficulty, duels created by mode.
    cur = await db.execute(
        "SELECT dimension, SUM(value) FROM analytics_counters WHERE metric = 'hints' GROUP BY dimension"
    )
    hints_by_difficulty = {dim: v for dim, v in await cur.fetchall()}
    cur = await db.execute(
        "SELECT dimension, SUM(value) FROM analytics_counters WHERE metric = 'duels_created' GROUP BY dimension"
    )
    duels_created = {dim: v for dim, v in await cur.fetchall()}

    # Client-reported distributions (attempts / time-to-solve / give-up rank / tips).
    distributions: dict[str, dict[str, int]] = {}
    cur = await db.execute(
        "SELECT metric, dimension, SUM(value) FROM analytics_counters "
        "WHERE metric LIKE 'dist%' GROUP BY metric, dimension"
    )
    for metric, dim, val in await cur.fetchall():
        distributions.setdefault(metric, {})[dim] = val

    # Per-game (per target word) difficulty -- raw aggregation; the admin handler
    # attaches the real target word and trims to hardest/easiest.
    cur = await db.execute(
        "SELECT mode, game_number, metric, value FROM analytics_game_stats"
    )
    per_game: dict[tuple[str, int], dict[str, int]] = {}
    for mode, gn, metric, val in await cur.fetchall():
        per_game.setdefault((mode, gn), {})[metric] = val
    game_difficulty = []
    for (mode, gn), m in per_game.items():
        solves, reveals = m.get("solves", 0), m.get("reveals", 0)
        guesses, hints = m.get("guesses", 0), m.get("hints", 0)
        fin = solves + reveals
        game_difficulty.append({
            "mode": mode, "game_number": gn,
            "guesses": guesses, "solves": solves, "reveals": reveals, "hints": hints,
            "finished": fin,
            "solve_rate": round(solves / fin, 3) if fin else None,
            "avg_guesses": round(guesses / solves, 1) if solves else None,
        })

    # Honesty note for the dashboard.
    cur = await db.execute(
        "SELECT COUNT(*) FROM analytics_events WHERE ua_class = 'bot'"
    )
    bots_filtered = (await cur.fetchone())[0]

    # --- "Since the beginning" figures ---------------------------------------
    # All-time unique visitors (HLL estimate); exact cumulative pageviews and
    # visitor-days from permanent rollups; the two "counting since" dates.
    cur = await db.execute("SELECT register, rank FROM analytics_hll")
    all_time_unique_hll = _hll_estimate({reg: rk for reg, rk in await cur.fetchall()})
    # The all-time sketch only counts forward from its introduction and CANNOT be
    # backfilled: the raw IP+UA needed for its stable token is deliberately never
    # stored. So early on -- and for visitors who predate the sketch -- it can sit
    # below a windowed count, rendering the impossible "Gesamt (all-time) < 30 Tage".
    # Floor it so the total always dominates every windowed unique the dashboard
    # shows (today / 7d / 30d / month-to-date / best rollup day). Those windowed
    # counts use the same monthly-rotating-hash distinct counting as the active-user
    # cards, so flooring by them keeps the all-time card consistent with the rest of
    # the dashboard while the (cross-month-deduping) HLL fills in; the HLL takes over
    # once it grows past the floor. NB: we floor by per-window counts, NOT by a single
    # COUNT(DISTINCT fp_hash) over the whole raw window -- the latter double-counts a
    # visitor who recurs across the monthly salt rotation and could exceed even a
    # correct HLL. Each windowed count below lives within counting that the matching
    # dashboard card also uses, so the total never contradicts a figure we display.
    cur = await db.execute(
        "SELECT COALESCE(MAX(value), 0) FROM analytics_daily "
        "WHERE metric = 'unique_visitors' AND dimension = '*'")
    best_day_unique = (await cur.fetchone())[0]
    # >= the displayed 30-day MAU (which starts at now-30d; the midnight floor here is
    # a superset window, so this count can only be >=, guaranteeing Gesamt >= 30 Tage).
    mau_unique = await _unique_visitors_since(db, today - timedelta(days=30))
    all_time_unique = max(
        all_time_unique_hll, best_day_unique, mau_unique,
        visitors["today"], visitors["week"], visitors["month"],
    )
    cur = await db.execute(
        "SELECT COALESCE(SUM(value), 0) FROM analytics_daily WHERE metric = 'pageviews'")
    all_time_pageviews = (await cur.fetchone())[0]
    cur = await db.execute(
        "SELECT COALESCE(SUM(value), 0) FROM analytics_daily "
        "WHERE metric = 'unique_visitors' AND dimension = '*'")
    visitor_days = (await cur.fetchone())[0]
    cur = await db.execute("SELECT MIN(date) FROM analytics_daily")
    data_since = (await cur.fetchone())[0]
    cur = await db.execute("SELECT value FROM analytics_meta WHERE key = 'hll_since'")
    row = await cur.fetchone()
    all_time = {
        "unique_visitors": all_time_unique,
        "pageviews": all_time_pageviews,
        "visitor_days": visitor_days,
        "data_since": data_since,
        "unique_since": row[0] if row else None,
    }

    # Record days (all-time best single day) from permanent data.
    cur = await db.execute(
        "SELECT date, value FROM analytics_daily "
        "WHERE metric = 'unique_visitors' AND dimension = '*' "
        "ORDER BY value DESC, date DESC LIMIT 1")
    row = await cur.fetchone()
    best_visitors_day = {"date": row[0], "value": row[1]} if row else None
    cur = await db.execute(
        "SELECT date, SUM(value) AS v FROM analytics_counters "
        "WHERE metric = 'guesses' GROUP BY date ORDER BY v DESC, date DESC LIMIT 1")
    row = await cur.fetchone()
    best_guesses_day = {"date": row[0], "value": row[1]} if row else None
    records = {"best_visitors_day": best_visitors_day, "best_guesses_day": best_guesses_day}

    # Active visitors over rolling windows (DAU / WAU / MAU). "Active" = unique
    # visitors; per-fingerprint distinct-player tracking is deliberately not done.
    active_users = {
        "dau": visitors["today"],
        "wau": await _unique_visitors_since(db, now - timedelta(days=7)),
        "mau": await _unique_visitors_since(db, now - timedelta(days=30)),
    }

    # Monthly series: exact additive metrics from permanent tables + a per-month
    # HLL unique-visitor estimate (survives raw-event retention => honest MoM).
    cur = await db.execute(
        "SELECT substr(date, 1, 7) AS m, SUM(value) FROM analytics_daily "
        "WHERE metric = 'pageviews' GROUP BY m")
    month_pageviews = {m: v for m, v in await cur.fetchall()}
    cur = await db.execute(
        "SELECT substr(date, 1, 7) AS m, SUM(value) FROM analytics_daily "
        "WHERE metric = 'unique_visitors' AND dimension = '*' GROUP BY m")
    month_visitor_days = {m: v for m, v in await cur.fetchall()}
    cur = await db.execute(
        "SELECT substr(date, 1, 7) AS m, metric, SUM(value) FROM analytics_counters "
        "WHERE metric IN ('guesses', 'solves', 'reveals') GROUP BY m, metric")
    month_actions: dict[str, dict[str, int]] = {}
    for m, metric, v in await cur.fetchall():
        month_actions.setdefault(m, {})[metric] = v
    cur = await db.execute("SELECT month, register, rank FROM analytics_hll_monthly")
    month_hll: dict[str, dict[int, int]] = {}
    for mo, reg, rk in await cur.fetchall():
        month_hll.setdefault(mo, {})[reg] = rk
    # Same floor rationale as the all-time figure: a month's unique count must not
    # fall below that month's exact single-day peak (a subset of the month, hence a
    # valid lower bound), so a not-yet-filled monthly sketch never reports 0 for a
    # month that demonstrably had visitors.
    cur = await db.execute(
        "SELECT substr(date, 1, 7) AS m, COALESCE(MAX(value), 0) FROM analytics_daily "
        "WHERE metric = 'unique_visitors' AND dimension = '*' GROUP BY m")
    month_peak_daily_unique = {m: v for m, v in await cur.fetchall()}
    months_set = (set(month_pageviews) | set(month_visitor_days)
                  | set(month_actions) | set(month_hll) | set(month_peak_daily_unique))
    monthly = []
    for m in sorted(months_set):
        acts = month_actions.get(m, {})
        month_unique = _hll_estimate(month_hll[m]) if m in month_hll else 0
        monthly.append({
            "month": m,
            "pageviews": month_pageviews.get(m, 0),
            "visitor_days": month_visitor_days.get(m, 0),
            "guesses": acts.get("guesses", 0),
            "solves": acts.get("solves", 0),
            "games": acts.get("solves", 0) + acts.get("reveals", 0),
            "unique_visitors": max(month_unique, month_peak_daily_unique.get(m, 0)),
        })

    # Finished games (solves + reveals) per month, split by mode -> popularity trend.
    cur = await db.execute(
        "SELECT substr(date, 1, 7) AS m, dimension, SUM(value) FROM analytics_counters "
        "WHERE metric IN ('solves', 'reveals') GROUP BY m, dimension")
    mode_monthly_map: dict[str, dict[str, int]] = {}
    for m, dim, v in await cur.fetchall():
        bucket = mode_monthly_map.setdefault(m, {})
        bucket[dim] = bucket.get(dim, 0) + v
    # Every known mode gets a key, present or not, so the dashboard's series do
    # not appear and disappear as a mode gains its first finished game.
    mode_monthly = [
        {"month": m, **{mode: mode_monthly_map[m].get(mode, 0) for mode in GAME_MODES}}
        for m in sorted(mode_monthly_map)
    ]

    # Live presence snapshot (currently-online visitors). Cheap; lets the
    # dashboard show a value immediately before its own live poll kicks in.
    live = await get_live_visitors(db, now)

    # Self-reported attribution ("Woher kennst du Kontexto?"), the one channel
    # signal that dark social and offline word of mouth ever produce.
    survey = await get_survey_stats(db)
    ad_consent = await get_ad_consent_stats(db, now)
    ratings = await get_rating_stats(db, target_words=target_words,
                                     first_game=first_rated_game)

    return {
        "generated_at": now.isoformat(),
        "live": live,
        "visitors": visitors,
        "visitors_timeline": visitors_timeline,
        "pageviews_by_page": pageviews_by_page,
        "pageviews_timeline": pageviews_timeline,
        "counters_total": counters_total,
        "counters_today": counters_today,
        "guesses_timeline": guesses_timeline,
        "solves_timeline": solves_timeline,
        "solve_rate_timeline": solve_rate_timeline,
        "games_by_mode": games_by_mode,
        "duels_created": duels_created,
        "engagement": engagement,
        "hints_by_difficulty": hints_by_difficulty,
        "distributions": distributions,
        "game_difficulty": game_difficulty,
        "top_words": top_words,
        "devices": devices,
        "browsers": browsers,
        "os": os_breakdown,
        "referrers": referrers,
        "peak_hours": peak_hours,
        "activity_heatmap": activity_heatmap,
        "today_hourly": today_hourly,
        "visitor_loyalty": visitor_loyalty,
        "stickiness": stickiness,
        "all_time": all_time,
        "records": records,
        "active_users": active_users,
        "monthly": monthly,
        "mode_monthly": mode_monthly,
        "survey": survey,
        "ad_consent": ad_consent,
        "word_ratings": ratings,
        "funnel": funnel,
        "sharing": sharing,
        "attention": attention,
        "bots_filtered": bots_filtered,
        "note": (
            "Unique-User cookieless via monatlich rotierendem Hash (IP+Browser, kein PII). "
            "Eindeutige Besucher „seit Beginn“ werden über einen HyperLogLog-Schätzer "
            "ermittelt (cookieless, nicht umkehrbar, ±~1 %); er zählt ab Einbau vorwärts. "
            "Gesamt-Seitenaufrufe und Besuchertage decken die volle Historie ab. "
            "Guess-, Lösungs-, Hint- und Reveal-Zahlen sind server-seitig erhoben und nicht "
            "durch Beacons fälschbar. Verteilungen (Versuche, Zeit bis Lösung, Aufgabe-Rang) "
            "werden clientseitig gemeldet, sind token-gesichert, entdupliziert und gedeckelt. "
            "Die Herkunftsumfrage ist freiwillig, eine Antwort je Besucher, token-gesichert; "
            "der optionale Freitext wird ohne Besucherkennung gespeichert. "
            "Geräte-, Browser-, Betriebssystem- und Aktive-Nutzer-Zahlen beziehen sich auf die "
            "letzten 35 Tage (Rohdaten-Fenster). Zeitangaben in lokaler Zeit (Europe/Berlin)."
        ),
    }
