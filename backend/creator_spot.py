"""Reviewed creator clips and one immutable credit per daily puzzle."""

import hashlib
import hmac
import re
from datetime import date, timedelta
from urllib.parse import parse_qs, quote, urlsplit

import aiosqlite

from server_secret import server_secret


class SubmissionError(ValueError):
    pass


HOSTS = {
    "www.tiktok.com": "tiktok",
    "www.youtube.com": "youtube",
    "youtube.com": "youtube",
    "m.youtube.com": "youtube",
    "youtu.be": "youtube",
    "www.twitch.tv": "twitch",
    "twitch.tv": "twitch",
    "clips.twitch.tv": "twitch",
    "www.instagram.com": "instagram",
    "instagram.com": "instagram",
}


def social_url(raw: str, kind: str) -> tuple[str, str]:
    """Return a canonical HTTPS URL and platform; refuse every non-social host."""
    if not raw or len(raw) > 500 or any(ord(c) < 32 for c in raw):
        raise SubmissionError("invalid_url")
    try:
        url = urlsplit(raw.strip())
        host = (url.hostname or "").lower()
        port = url.port
    except ValueError as exc:
        raise SubmissionError("invalid_url") from exc
    if url.scheme.lower() != "https" or host not in HOSTS or port is not None or url.username or url.password or url.fragment:
        raise SubmissionError("invalid_url")
    platform = HOSTS[host]
    path = url.path.rstrip("/")
    parts = path.split("/")[1:]
    token = r"[A-Za-z0-9_-]+"
    handle = r"@[A-Za-z0-9._-]+"
    canonical_host = {
        "tiktok": "www.tiktok.com", "youtube": "www.youtube.com",
        "twitch": "www.twitch.tv", "instagram": "www.instagram.com",
    }[platform]
    query = ""
    if platform == "tiktok":
        valid = (len(parts) == 3 and re.fullmatch(handle, parts[0]) and parts[1] == "video" and parts[2].isdigit()) if kind == "clip" else (len(parts) == 1 and re.fullmatch(handle, parts[0]))
    elif platform == "youtube":
        if kind == "clip":
            if host == "youtu.be":
                valid = len(parts) == 1 and bool(re.fullmatch(token, parts[0]))
                if valid:
                    path = f"/watch"
                    query = f"?v={quote(parts[0])}"
            elif parts == ["watch"]:
                video = parse_qs(url.query).get("v", [""])[0]
                valid = bool(re.fullmatch(token, video))
                if valid:
                    query = f"?v={quote(video)}"
            else:
                valid = len(parts) == 2 and parts[0] in ("shorts", "live", "clip") and bool(re.fullmatch(token, parts[1]))
        else:
            valid = (len(parts) == 1 and bool(re.fullmatch(handle, parts[0]))) or (
                len(parts) == 2 and parts[0] in ("channel", "c", "user")
                and bool(re.fullmatch(token, parts[1]))
            )
    elif platform == "twitch":
        if kind == "clip":
            valid = (host == "clips.twitch.tv" and len(parts) == 1 and bool(re.fullmatch(token, parts[0]))) or (
                len(parts) == 2 and parts[0] == "videos" and parts[1].isdigit()
            ) or (
                len(parts) == 3 and parts[1] == "clip"
                and bool(re.fullmatch(token, parts[0])) and bool(re.fullmatch(token, parts[2]))
            )
        else:
            valid = host != "clips.twitch.tv" and len(parts) == 1 and bool(re.fullmatch(token, parts[0]))
        if host == "clips.twitch.tv":
            canonical_host = host
    else:
        valid = (len(parts) == 2 and parts[0] in ("reel", "tv") and bool(re.fullmatch(token, parts[1]))) if kind == "clip" else (len(parts) == 1 and bool(re.fullmatch(r"[A-Za-z0-9._]+", parts[0])) and parts[0] not in ("reel", "tv", "p"))
    if not valid:
        raise SubmissionError("invalid_url")
    return f"https://{canonical_host}{path}{query}", platform


async def submit(db: aiosqlite.Connection, *, clip_url: str, channel_url: str,
                 channel_name: str, email: str | None, ip: str) -> int:
    clip, platform = social_url(clip_url, "clip")
    channel, channel_platform = social_url(channel_url, "channel")
    if platform != channel_platform:
        raise SubmissionError("platform_mismatch")
    name = channel_name.strip()
    if not 2 <= len(name) <= 80 or any(ord(c) < 32 for c in name):
        raise SubmissionError("invalid_name")
    email = (email or "").strip() or None
    if email and (len(email) > 254 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email)):
        raise SubmissionError("invalid_email")
    ip_hash = hmac.new(server_secret(), ip.encode(), hashlib.sha256).hexdigest()
    await db.execute("BEGIN IMMEDIATE")
    try:
        async with db.execute(
            "SELECT COUNT(*) FROM creator_submissions WHERE ip_hash=? AND submitted_at > datetime('now', '-1 day')",
            (ip_hash,),
        ) as cursor:
            count = (await cursor.fetchone())[0]
        if count >= 3:
            raise SubmissionError("rate_limited")
        try:
            cursor = await db.execute(
                "INSERT INTO creator_submissions(platform, clip_url, channel_url, channel_name, email, ip_hash) VALUES (?, ?, ?, ?, ?, ?)",
                (platform, clip, channel, name, email, ip_hash),
            )
        except aiosqlite.IntegrityError as exc:
            raise SubmissionError("duplicate_clip") from exc
        await db.commit()
        return cursor.lastrowid
    except Exception:
        await db.rollback()
        raise


async def today(db: aiosqlite.Connection, game_number: int, game_date: date) -> dict | None:
    """Claim the earliest eligible approved entry once, even across API workers."""
    async with db.execute("SELECT submission_id FROM creator_days WHERE game_number=?", (game_number,)) as cursor:
        existing = await cursor.fetchone()
    if existing is not None:
        return await _public_spot(db, existing[0])

    await db.execute("BEGIN IMMEDIATE")
    try:
        await db.execute("UPDATE creator_submissions SET ip_hash=NULL WHERE ip_hash IS NOT NULL AND submitted_at < datetime('now', '-1 day')")
        await db.execute("DELETE FROM creator_submissions WHERE status='rejected' AND reviewed_at < datetime('now', '-30 days')")
        async with db.execute("SELECT submission_id FROM creator_days WHERE game_number=?", (game_number,)) as cursor:
            day = await cursor.fetchone()
        if day is None:
            async with db.execute(
                "SELECT id FROM creator_submissions WHERE status='approved' AND eligible_date<=? ORDER BY id LIMIT 1",
                (game_date.isoformat(),),
            ) as cursor:
                entry = await cursor.fetchone()
            submission_id = entry[0] if entry else None
            await db.execute("INSERT INTO creator_days(game_number, submission_id) VALUES (?, ?)", (game_number, submission_id))
            if submission_id is not None:
                await db.execute("UPDATE creator_submissions SET status='shown', email=NULL WHERE id=?", (submission_id,))
        else:
            submission_id = day[0]
        await db.commit()
        return await _public_spot(db, submission_id)
    except Exception:
        await db.rollback()
        raise


async def _public_spot(db: aiosqlite.Connection, submission_id: int | None) -> dict | None:
    if submission_id is None:
        return None
    async with db.execute("SELECT platform, channel_name, channel_url FROM creator_submissions WHERE id=?", (submission_id,)) as cursor:
        row = await cursor.fetchone()
    return {"platform": row[0], "channel_name": row[1], "channel_url": row[2]} if row else None


async def list_submissions(db: aiosqlite.Connection) -> list[dict]:
    async with db.execute(
        "SELECT id, platform, clip_url, channel_url, channel_name, email, status, submitted_at, eligible_date FROM creator_submissions WHERE status IN ('pending', 'approved') OR id IN (SELECT id FROM creator_submissions WHERE status IN ('shown', 'rejected') ORDER BY id DESC LIMIT 30) ORDER BY id DESC"
    ) as cursor:
        rows = await cursor.fetchall()
    return [dict(row) for row in rows]


async def review(db: aiosqlite.Connection, submission_id: int, approve: bool) -> bool:
    eligible = (date.today() + timedelta(days=1)).isoformat() if approve else None
    cursor = await db.execute(
        "UPDATE creator_submissions SET status=?, eligible_date=?, reviewed_at=CURRENT_TIMESTAMP, email=NULL WHERE id=? AND status='pending'",
        ("approved" if approve else "rejected", eligible, submission_id),
    )
    await db.commit()
    return cursor.rowcount == 1
