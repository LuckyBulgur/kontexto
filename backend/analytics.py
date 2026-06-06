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
import os
import re
import sqlite3
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import aiosqlite

from database import configure_connection
from server_secret import server_secret as _server_secret

logger = logging.getLogger(__name__)

# Local timezone for human-friendly time breakdowns (peak hours, weekday/hour
# heatmap). Raw event timestamps are stored in UTC; we project them to this zone
# for display so "20 Uhr" means 20:00 for the (predominantly German) audience.
DISPLAY_TZ = ZoneInfo("Europe/Berlin")

# --- Configuration -----------------------------------------------------------

# Window for beacon tokens and pageview de-duplication (seconds).
BEACON_WINDOW_SECONDS = 1800  # 30 minutes
# Raw events older than this are pruned; rollups are kept forever.
EVENT_RETENTION_DAYS = 35
# Hard ceiling of accepted pageviews per fingerprint per day (flood protection).
MAX_EVENTS_PER_FP_PER_DAY = 300

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

def classify_user_agent(user_agent: str) -> tuple[str, str, str]:
    """Return (ua_class, device, browser). ua_class is 'human' or 'bot'."""
    ua = (user_agent or "").lower()
    if not ua or any(marker in ua for marker in _BOT_MARKERS):
        return "bot", "unknown", "unknown"

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
    return "human", device, browser


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


async def record_pageview(
    db: aiosqlite.Connection,
    *,
    ip: str,
    user_agent: str,
    referrer: str | None,
    page: str,
    token: str,
    country: str = "",
    now: datetime | None = None,
) -> tuple[bool, str]:
    """Validate and store a pageview beacon.

    Returns (accepted, reason). Rejected calls never raise and never count.
    """
    now = now or datetime.now(timezone.utc)
    fp_hash = compute_fingerprint(ip, user_agent, now)

    if not verify_beacon_token(token, fp_hash, now):
        return False, "invalid_token"

    ua_class, device, browser = classify_user_agent(user_agent)
    if ua_class == "bot":
        return False, "bot"

    label = normalize_page(page)
    window_start = now - timedelta(seconds=BEACON_WINDOW_SECONDS)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

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

    async def _insert(conn: aiosqlite.Connection) -> None:
        await conn.execute(
            "INSERT INTO analytics_events "
            "(ts, event_type, page, fp_hash, ua_class, device, browser, country, referrer_domain) "
            "VALUES (?, 'pageview', ?, ?, ?, ?, ?, ?, ?)",
            (now.isoformat(), label, fp_hash, ua_class, device, browser,
             country, referrer_domain(referrer)),
        )

    accepted = await _commit_with_retry(db, _insert, description="record_pageview")
    return (True, "ok") if accepted else (False, "write_failed")


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
    if mode not in ("kontexto", "wordle") or outcome not in ("solved", "gaveup"):
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
                    f"dist_guesses_{mode}", _bucket_guesses(guesses), 1)
        await _bump(conn, "analytics_counters", date_str,
                    f"dist_tips_{mode}", _bucket_tips(tips), 1)
        if outcome == "solved":
            await _bump(conn, "analytics_counters", date_str,
                        f"dist_time_{mode}", _bucket_duration(duration_seconds), 1)
        elif mode == "kontexto":
            await _bump(conn, "analytics_counters", date_str,
                        "dist_giveup_rank", _bucket_rank(best_rank), 1)

    try:
        accepted = await _commit_with_retry(db, _write, description=f"record_completion:{mode}")
    except sqlite3.IntegrityError:
        await db.rollback()
        return False, "duplicate"
    return (True, "ok") if accepted else (False, "write_failed")


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
    events.
    """
    now = now or datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=EVENT_RETENTION_DAYS)).isoformat()
    cur = await db.execute("DELETE FROM analytics_events WHERE ts < ?", (cutoff,))
    await db.execute("DELETE FROM analytics_completion_seen WHERE ts < ?", (cutoff,))
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


async def get_stats(db: aiosqlite.Connection, now: datetime | None = None) -> dict:
    """Assemble the full statistics payload for the admin dashboard."""
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

    # Per-day unique-visitor timeline (last 30 days) from permanent rollups.
    cur = await db.execute(
        "SELECT date, value FROM analytics_daily "
        "WHERE metric = 'unique_visitors' AND dimension = '*' "
        "ORDER BY date DESC LIMIT 30"
    )
    visitors_timeline = [{"date": d, "value": v} for d, v in reversed(await cur.fetchall())]

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
        "WHERE metric = 'guesses' GROUP BY date ORDER BY date DESC LIMIT 30"
    )
    guesses_timeline = [{"date": d, "value": v} for d, v in reversed(await cur.fetchall())]

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

    # Pageviews timeline (last 30 days) -- live from raw events, like pageviews_by_page.
    cur = await db.execute(
        "SELECT substr(ts, 1, 10) AS d, COUNT(*) FROM analytics_events "
        "WHERE event_type = 'pageview' AND ua_class = 'human' AND ts >= ? GROUP BY d ORDER BY d",
        (pageviews_since,),
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
    recent_dates = sorted(by_date)[-30:]
    solves_timeline = [{"date": d, "value": by_date[d].get("solves", 0)} for d in recent_dates]
    solve_rate_timeline = []
    for d in recent_dates:
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

    return {
        "generated_at": now.isoformat(),
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
        "referrers": referrers,
        "peak_hours": peak_hours,
        "activity_heatmap": activity_heatmap,
        "visitor_loyalty": visitor_loyalty,
        "stickiness": stickiness,
        "bots_filtered": bots_filtered,
        "note": (
            "Unique-User cookieless via monatlich rotierendem Hash (IP+Browser, kein PII). "
            "Guess-, Lösungs-, Hint- und Reveal-Zahlen sind server-seitig erhoben und nicht "
            "durch Beacons fälschbar. Verteilungen (Versuche, Zeit bis Lösung, Aufgabe-Rang) "
            "werden clientseitig gemeldet, sind token-gesichert, entdupliziert und gedeckelt. "
            "Zeitangaben in lokaler Zeit (Europe/Berlin)."
        ),
    }
