"""Twitch's own badge pictures, fetched from Helix.

The IRC ``badges`` tag names a badge (``subscriber/12``) but carries no picture.
The pictures come from two Helix endpoints, ``chat/badges/global`` and
``chat/badges?broadcaster_id=``, the second holding a channel's own subscriber
and bits badges. Both take an **app access token** (OAuth client credentials):
the operator registers one free Twitch application, no streamer logs in, and
nothing can ever be posted as anybody.

    KONTEXTO_TWITCH_CLIENT_ID      the application's client id
    KONTEXTO_TWITCH_CLIENT_SECRET  its secret, never logged

Everything here runs in the **single WS worker**, next to the chat readers that
learn the broadcaster ids. The result goes into the ``twitch_badges`` table, and
the API workers resolve badge codes from there, so a browser never talks to
Helix and an API worker never needs the secret's token.

Without credentials nothing is fetched. The host page then draws its own icons
for the common roles and leaves the rest out (``frontend/lib/live-badges.ts``).

Standard library only (``urllib`` in a thread): two small JSON calls a day per
channel do not justify an HTTP client dependency in the runtime image.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass

import aiosqlite

logger = logging.getLogger(__name__)

CLIENT_ID_ENV = "KONTEXTO_TWITCH_CLIENT_ID"
CLIENT_SECRET_ENV = "KONTEXTO_TWITCH_CLIENT_SECRET"

TOKEN_URL = "https://id.twitch.tv/oauth2/token"
HELIX_URL = "https://api.twitch.tv/helix"

# How long a fetched badge set is trusted. Twitch changes global badges a few
# times a year and a streamer changes their sub badges rarely; a day keeps a
# change visible by the next stream and costs two calls a day per channel.
REFRESH_SECONDS = 24 * 3600

# A token is renewed this long before Twitch says it expires, so a call in
# flight never carries one that runs out on the way.
TOKEN_MARGIN_SECONDS = 60

HTTP_TIMEOUT_SECONDS = 10

# Only Twitch's own CDN is accepted as a picture source. The host page loads
# whatever URL ends up in the table, so this is the trust boundary.
IMAGE_PREFIX = "https://static-cdn.jtvnw.net/"

GLOBAL_SCOPE = "global"


@dataclass(frozen=True)
class Credentials:
    client_id: str
    client_secret: str


def credentials() -> Credentials | None:
    client_id = os.environ.get(CLIENT_ID_ENV, "").strip()
    secret = os.environ.get(CLIENT_SECRET_ENV, "").strip()
    if not client_id or not secret:
        return None
    return Credentials(client_id, secret)


def is_configured() -> bool:
    return credentials() is not None


class HelixError(Exception):
    """A Helix call failed. ``status`` is the HTTP status, 0 for transport."""

    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status


def _http(method: str, url: str, headers: dict[str, str], body: bytes | None = None) -> dict:
    """One blocking HTTP call returning JSON. Run through asyncio.to_thread."""
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:  # nosec B310 - fixed https URLs
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise HelixError(exc.code, f"HTTP {exc.code}") from None
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        # The exception text of a URLError can carry the request; only its
        # class name is kept, so neither the secret nor a token can reach a log.
        raise HelixError(0, type(exc).__name__) from None


def parse_badge_sets(payload: object) -> list[tuple[str, str, str, str, str, str]]:
    """Rows ``(set_id, version, title, 1x, 2x, 4x)`` from a Helix badge response.

    Anything not shaped like a badge, or pointing anywhere but Twitch's CDN, is
    left out rather than stored.
    """
    rows: list[tuple[str, str, str, str, str, str]] = []
    data = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(data, list):
        return rows
    for badge_set in data:
        if not isinstance(badge_set, dict):
            continue
        set_id = badge_set.get("set_id")
        versions = badge_set.get("versions")
        if not isinstance(set_id, str) or not isinstance(versions, list):
            continue
        for version in versions:
            if not isinstance(version, dict):
                continue
            images = [version.get(f"image_url_{size}") for size in ("1x", "2x", "4x")]
            title = version.get("title")
            version_id = version.get("id")
            if (
                not isinstance(version_id, str)
                or not isinstance(title, str)
                or not all(isinstance(i, str) and i.startswith(IMAGE_PREFIX) for i in images)
            ):
                continue
            rows.append((set_id, version_id, title[:80], images[0], images[1], images[2]))
    return rows


class HelixClient:
    """App access token plus the two badge calls.

    ``http`` is injected in tests. The token lives in memory only: it is
    cheap to get and lives about two months, and storing it would put a
    credential into a file that backups copy.
    """

    def __init__(self, creds: Credentials, http=_http, clock=time.monotonic) -> None:
        self._creds = creds
        self._http = http
        self._clock = clock
        self._token: str | None = None
        self._expires_at = 0.0
        self._lock = asyncio.Lock()

    async def _token_now(self, force: bool = False) -> str:
        async with self._lock:
            if not force and self._token and self._clock() < self._expires_at:
                return self._token
            body = urllib.parse.urlencode({
                "client_id": self._creds.client_id,
                "client_secret": self._creds.client_secret,
                "grant_type": "client_credentials",
            }).encode("ascii")
            payload = await asyncio.to_thread(
                self._http, "POST", TOKEN_URL,
                {"Content-Type": "application/x-www-form-urlencoded"}, body,
            )
            token = payload.get("access_token") if isinstance(payload, dict) else None
            expires_in = payload.get("expires_in") if isinstance(payload, dict) else None
            if not isinstance(token, str) or not token:
                raise HelixError(0, "no access token in the response")
            lifetime = expires_in if isinstance(expires_in, int) and expires_in > 0 else 3600
            self._token = token
            self._expires_at = self._clock() + max(lifetime - TOKEN_MARGIN_SECONDS, 1)
            return token

    async def get(self, path: str, params: dict[str, str] | None = None) -> dict:
        """A Helix GET. A 401 renews the token once and repeats the call."""
        query = f"?{urllib.parse.urlencode(params)}" if params else ""
        url = f"{HELIX_URL}/{path}{query}"
        for attempt in (0, 1):
            token = await self._token_now(force=attempt == 1)
            headers = {"Client-Id": self._creds.client_id, "Authorization": f"Bearer {token}"}
            try:
                return await asyncio.to_thread(self._http, "GET", url, headers)
            except HelixError as exc:
                if exc.status == 401 and attempt == 0:
                    continue
                raise
        raise HelixError(401, "unauthorized after a fresh token")  # pragma: no cover

    async def badges(self, broadcaster_id: str | None) -> list[tuple]:
        if broadcaster_id is None:
            return parse_badge_sets(await self.get("chat/badges/global"))
        return parse_badge_sets(
            await self.get("chat/badges", {"broadcaster_id": broadcaster_id})
        )


async def store_badges(db: aiosqlite.Connection, scope: str, rows: list[tuple]) -> None:
    """Replace one scope's badges in one transaction."""
    await db.execute("DELETE FROM twitch_badges WHERE scope = ?", (scope,))
    await db.executemany(
        "INSERT INTO twitch_badges (scope, set_id, version, title, image_1x, image_2x, image_4x) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        [(scope, *row) for row in rows],
    )
    await db.commit()


async def remember_channel(db: aiosqlite.Connection, channel: str, broadcaster_id: str) -> None:
    """Note which broadcaster id a channel has. Writes only on a change."""
    cursor = await db.execute(
        "INSERT INTO twitch_channel_ids (channel, broadcaster_id) VALUES (?, ?) "
        "ON CONFLICT(channel) DO UPDATE SET broadcaster_id = excluded.broadcaster_id, "
        "seen_at = CURRENT_TIMESTAMP WHERE twitch_channel_ids.broadcaster_id "
        "IS NOT excluded.broadcaster_id",
        (channel, broadcaster_id),
    )
    if cursor.rowcount:
        await db.commit()


async def _fetched_at(db: aiosqlite.Connection, scope: str) -> bool:
    """Whether a scope was fetched inside the refresh window."""
    cursor = await db.execute(
        "SELECT 1 FROM twitch_badges WHERE scope = ? AND fetched_at > datetime('now', ?) LIMIT 1",
        (scope, f"-{REFRESH_SECONDS} seconds"),
    )
    return await cursor.fetchone() is not None


class BadgeCatalog:
    """Keeps the stored badges fresh. One per WS worker, owned by the ingest.

    ``ensure`` is called whenever a reader learns a broadcaster id and on every
    reconcile pass for the global set; it fetches only what is missing or
    older than a day, and never two fetches of one scope at once. A failure is
    logged once per scope and retried after ``RETRY_SECONDS``, so a Twitch
    outage or a revoked secret neither floods the log nor stops the chat.
    """

    RETRY_SECONDS = 15 * 60

    def __init__(self, db_path: str, client: HelixClient | None, clock=time.monotonic) -> None:
        self._db_path = db_path
        self._client = client
        self._clock = clock
        self._failed_at: dict[str, float] = {}
        self._running: set[str] = set()

    @classmethod
    def from_env(cls, db_path: str) -> "BadgeCatalog":
        creds = credentials()
        if creds is None:
            logger.info("twitch badges: no app credentials, the host page draws its own icons")
            return cls(db_path, None)
        return cls(db_path, HelixClient(creds))

    @property
    def enabled(self) -> bool:
        return self._client is not None

    async def ensure(self, broadcaster_id: str | None = None) -> None:
        if self._client is None:
            return
        scope = broadcaster_id or GLOBAL_SCOPE
        if scope in self._running:
            return
        failed = self._failed_at.get(scope)
        if failed is not None and self._clock() - failed < self.RETRY_SECONDS:
            return
        self._running.add(scope)
        try:
            from database import get_db

            db = await get_db(self._db_path)
            try:
                if await _fetched_at(db, scope):
                    return
                rows = await self._client.badges(broadcaster_id)
                await store_badges(db, scope, rows)
                self._failed_at.pop(scope, None)
            finally:
                await db.close()
        except HelixError as exc:
            if scope not in self._failed_at:
                logger.warning("twitch badges for %s could not be fetched: %s", scope, exc)
            self._failed_at[scope] = self._clock()
        except Exception:  # noqa: BLE001 - pictures are decoration, never fatal
            logger.warning("twitch badges for %s failed", scope, exc_info=True)
            self._failed_at[scope] = self._clock()
        finally:
            self._running.discard(scope)


async def resolve(
    db: aiosqlite.Connection, channel: str | None, codes: set[tuple[str, str]]
) -> dict[str, dict]:
    """``{"set/version": {"title", "image", "image_2x"}}`` for the codes given.

    The channel's own badges win over the global ones, which is how Twitch
    draws a channel's subscriber badge instead of the default star. Codes
    nobody has a picture for are absent; the client falls back to its icons.
    """
    if not codes:
        return {}
    scopes = [GLOBAL_SCOPE]
    if channel:
        cursor = await db.execute(
            "SELECT broadcaster_id FROM twitch_channel_ids WHERE channel = ?", (channel,)
        )
        row = await cursor.fetchone()
        if row is not None:
            scopes.append(row["broadcaster_id"])
    set_ids = sorted({set_id for set_id, _ in codes})
    marks = ",".join("?" for _ in set_ids)
    scope_marks = ",".join("?" for _ in scopes)
    cursor = await db.execute(
        f"SELECT scope, set_id, version, title, image_1x, image_2x FROM twitch_badges "
        f"WHERE scope IN ({scope_marks}) AND set_id IN ({marks})",
        (*scopes, *set_ids),
    )
    found: dict[str, dict] = {}
    for row in await cursor.fetchall():
        key = (row["set_id"], row["version"])
        if key not in codes:
            continue
        code = f"{row['set_id']}/{row['version']}"
        # A channel row replaces a global one, never the reverse.
        if code in found and row["scope"] == GLOBAL_SCOPE:
            continue
        found[code] = {
            "title": row["title"], "image": row["image_1x"], "image_2x": row["image_2x"],
        }
    return found
