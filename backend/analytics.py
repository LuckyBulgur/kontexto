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

import hashlib
import hmac
import os
import re
from datetime import datetime, timedelta, timezone

import aiosqlite

from server_secret import server_secret as _server_secret

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

    await db.execute(
        "INSERT INTO analytics_events "
        "(ts, event_type, page, fp_hash, ua_class, device, browser, country, referrer_domain) "
        "VALUES (?, 'pageview', ?, ?, ?, ?, ?, ?, ?)",
        (now.isoformat(), label, fp_hash, ua_class, device, browser,
         country, referrer_domain(referrer)),
    )
    await db.commit()
    return True, "ok"


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
    try:
        db = await aiosqlite.connect(db_path)
        try:
            await db.execute("PRAGMA journal_mode=WAL")
            await _bump(db, "analytics_counters", date_str, metric, dimension, 1)
            if metric == "guesses" and word:
                w = word.strip().lower()[:60]
                if w:
                    await db.execute(
                        "INSERT INTO analytics_word_counts (word, count) VALUES (?, 1) "
                        "ON CONFLICT(word) DO UPDATE SET count = count + 1",
                        (w,),
                    )
            await db.commit()
        finally:
            await db.close()
    except Exception:
        pass


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
    """Delete raw events older than the retention window. Returns rows deleted."""
    now = now or datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=EVENT_RETENTION_DAYS)).isoformat()
    cur = await db.execute("DELETE FROM analytics_events WHERE ts < ?", (cutoff,))
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

    # Pageviews per page over last 30 days (from rollups + today's live events).
    cur = await db.execute(
        "SELECT dimension, SUM(value) FROM analytics_daily "
        "WHERE metric = 'pageviews' GROUP BY dimension ORDER BY 2 DESC"
    )
    pageviews_by_page = {dim: total for dim, total in await cur.fetchall()}

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
    cur = await db.execute(
        "SELECT CAST(substr(ts, 12, 2) AS INTEGER) AS hour, COUNT(*) FROM analytics_events "
        "WHERE ua_class = 'human' AND event_type = 'pageview' GROUP BY hour ORDER BY hour"
    )
    peak_hours = {str(h): c for h, c in await cur.fetchall()}

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
        "counters_total": counters_total,
        "counters_today": counters_today,
        "guesses_timeline": guesses_timeline,
        "games_by_mode": games_by_mode,
        "engagement": engagement,
        "top_words": top_words,
        "devices": devices,
        "browsers": browsers,
        "referrers": referrers,
        "peak_hours": peak_hours,
        "bots_filtered": bots_filtered,
        "note": (
            "Unique-User cookieless via monatlich rotierendem Hash (IP+Browser, kein PII). "
            "Guess-/Lösungs-/Hint-Zahlen sind server-seitig und nicht durch Beacons fälschbar."
        ),
    }
