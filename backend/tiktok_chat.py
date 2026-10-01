"""Reading a TikTok LIVE chat, through the Euler Stream cloud WebSocket.

TikTok has no official chat API, and since 2026-09-09 it only serves the chat of a
live room to a browser-grade session from an IP with a good reputation. A
datacenter server gets nothing, so a self-hosted reader would need a real browser
behind paid residential proxies. Euler Stream runs exactly that and hands the
decoded events out over one JSON WebSocket per room:

    wss://ws.eulerstream.com?uniqueId=<handle>&apiKey=<key>
    <- {"timestamp": ..., "messages": [{"type": "WebcastChatMessage", "data": {...}}]}

The streamer needs no login and no app; the operator needs one free API key in
``KONTEXTO_EULER_API_KEY``. The reasoning, the licences of the alternatives and the
tier limits are in ``docs/plans/2026-09-23-tiktok-live-chat.md``.

This is only the reader. It has the same ``run(on_message, on_state)`` as
``twitch_chat.TwitchChatReader``, so ``live_ingest`` treats both alike, and it is
the seam where a self-hosted reader would replace it.

**The key never reaches a log.** It travels in the query string, as the provider
documents, so the URL is built at connect time, the socket gets a disabled logger
(``websockets`` logs the request line at debug level), and every exception text
that is logged passes through ``_redact`` first.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import time
from collections import deque
from urllib.parse import urlencode, urlsplit

import websockets
from websockets.exceptions import ConnectionClosed, InvalidStatus

import live_chat
from nicknames import MAX_TYPED_NICKNAME, is_nickname_shaped

logger = logging.getLogger(__name__)

EULER_WS_URL = "wss://ws.eulerstream.com"
API_KEY_ENV = "KONTEXTO_EULER_API_KEY"

# A logger that swallows everything, handed to the socket so that the request
# line with the key in it is never written, whatever level the process runs at.
_SOCKET_LOGGER = logging.getLogger(f"{__name__}.socket")
_SOCKET_LOGGER.disabled = True
_SOCKET_LOGGER.propagate = False

# The room info Euler sends first can be large; the default 1 MiB is too tight.
_MAX_FRAME_BYTES = 4 * 1024 * 1024

# Close codes from the provider (Euler-WebSocket-SDK, ClientCloseCode).
CLOSE_STREAM_END = 4005
CLOSE_NO_MESSAGES = 4006
CLOSE_INVALID_OPTIONS = 4400
CLOSE_INVALID_AUTH = 4401
CLOSE_NO_PERMISSION = 4403
CLOSE_NOT_LIVE = 4404
CLOSE_TOO_MANY = 4429

# A code that means "this will never work". Retrying these would be a loop
# against the provider and a status line that keeps promising it will work.
_FATAL: dict[int, str] = {
    CLOSE_INVALID_OPTIONS: "Diesen TikTok-Kanal gibt es nicht",
    CLOSE_INVALID_AUTH: "Die TikTok-Anbindung ist gerade nicht eingerichtet",
    CLOSE_NO_PERMISSION: "Die TikTok-Anbindung ist gerade nicht eingerichtet",
}

# The streamer is not live (yet, or any more). Normal before a stream starts and
# after it ends, so the room keeps waiting instead of giving up, but slowly: every
# connect is billed against the provider's daily request budget.
_WAITING = {CLOSE_NOT_LIVE, CLOSE_STREAM_END, CLOSE_NO_MESSAGES}
WAITING_TEXT = "Wartet auf deinen TikTok-Livestream"

NOT_CONFIGURED_TEXT = _FATAL[CLOSE_INVALID_AUTH]

# An HTTP refusal of the upgrade request, read as the close code it stands for.
_HTTP_TO_CLOSE = {
    400: CLOSE_INVALID_OPTIONS,
    401: CLOSE_INVALID_AUTH,
    403: CLOSE_NO_PERMISSION,
    404: CLOSE_NOT_LIVE,
    429: CLOSE_TOO_MANY,
}

_BACKOFF_START = 1.0
_BACKOFF_MAX = 60.0
# At 60 to 300 seconds a room that waits a whole day costs under 300 connects,
# against 2,500 requests a day on the free tier.
_WAIT_START = 60.0
_WAIT_MAX = 300.0
_RATE_LIMITED_MIN = 60.0


class ConnectBudget:
    """The provider's request limits, kept on our side of the wire.

    The Community tier allows 60 requests a minute, 500 an hour and 2,500 a day,
    and every connect costs one. Per room the backoff already keeps a waiting
    room near twelve connects an hour, but twenty rooms waiting at once would
    still spend the hour's budget, and the refusal would then hit a room that is
    live. So every reader asks here first and waits for a slot.

    Sliding windows, in-process: the readers all run in the single WS worker, so
    this has exactly one writer, and there is no await between the check and the
    booking in ``reserve``, so two readers cannot take the same slot.

    Defaults sit at 90% of the free tier. A paid tier raises them through
    ``KONTEXTO_EULER_BUDGET`` as ``minute,hour,day``.
    """

    WINDOWS = (60.0, 3600.0, 86400.0)
    DEFAULT_LIMITS = (54, 450, 2250)

    def __init__(self, limits: tuple[int, int, int] | None = None, clock=time.monotonic) -> None:
        self._limits = limits or self._limits_from_env()
        self._clock = clock
        self._stamps: deque[float] = deque()

    @classmethod
    def _limits_from_env(cls) -> tuple[int, int, int]:
        raw = os.environ.get("KONTEXTO_EULER_BUDGET", "").strip()
        if not raw:
            return cls.DEFAULT_LIMITS
        try:
            minute, hour, day = (int(part) for part in raw.split(","))
        except ValueError:
            logger.warning("KONTEXTO_EULER_BUDGET is not minute,hour,day; using the defaults")
            return cls.DEFAULT_LIMITS
        if min(minute, hour, day) < 1:
            logger.warning("KONTEXTO_EULER_BUDGET must be positive; using the defaults")
            return cls.DEFAULT_LIMITS
        return minute, hour, day

    def reserve(self) -> float:
        """Book a connect. Returns 0 when booked, else the seconds to wait."""
        now = self._clock()
        while self._stamps and now - self._stamps[0] >= self.WINDOWS[-1]:
            self._stamps.popleft()
        wait = 0.0
        for window, limit in zip(self.WINDOWS, self._limits):
            inside = [stamp for stamp in self._stamps if now - stamp < window]
            if len(inside) >= limit:
                # The slot frees when the oldest booking inside the window ages out.
                wait = max(wait, inside[-limit] + window - now)
        if wait > 0:
            return wait
        self._stamps.append(now)
        return 0.0


# The one budget every reader of this process shares.
_budget = ConnectBudget()


def api_key() -> str | None:
    key = os.environ.get(API_KEY_ENV, "").strip()
    return key or None


def is_configured() -> bool:
    return api_key() is not None


def build_url(channel: str, key: str) -> str:
    return f"{EULER_WS_URL}?{urlencode({'uniqueId': channel, 'apiKey': key})}"


def _redact(text: str) -> str:
    key = api_key()
    return text.replace(key, "***") if key else text


def classify_close(code: int | None) -> str:
    """One of 'fatal', 'waiting', 'rate_limited' or 'transient'."""
    if code in _FATAL:
        return "fatal"
    if code in _WAITING:
        return "waiting"
    if code == CLOSE_TOO_MANY:
        return "rate_limited"
    return "transient"


# --- Frames -------------------------------------------------------------------


def _display_name(nickname: str, unique_id: str) -> str:
    """The name a viewer is shown under, before the nickname rule runs.

    TikTok nicknames may be longer than a Kontexto name, and the nickname rule
    replaces an over-long name with a generated one. A viewer is better served by
    their handle, or their own name cut to length, than by a random animal.
    """
    for candidate in (nickname, unique_id):
        if candidate and is_nickname_shaped(candidate):
            return candidate.strip()
    base = (nickname or unique_id).strip()
    return base[:MAX_TYPED_NICKNAME].strip()


# The provider decodes TikTok's protobuf into JSON, and TikTok's schema has
# renamed fields between versions (userId/id, giftDetails/gift, giftName/name,
# giftImage/image, url/urlList). Every read below accepts both spellings, so a
# schema bump on the provider's side costs nothing, and a shape that matches
# neither is one ignored event, never an exception.


def _field(data: object, *names: str) -> object:
    if not isinstance(data, dict):
        return None
    for name in names:
        if name in data and data[name] is not None:
            return data[name]
    return None


def _as_int(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return None


def _as_str(value: object) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, int) and not isinstance(value, bool):
        return str(value)
    return ""


def _truthy(value: object) -> bool:
    """A proto boolean, which some encoders write as 0/1."""
    if isinstance(value, bool):
        return value
    return _as_int(value) not in (None, 0)


def _user(user: object) -> tuple[str, str, str] | None:
    """External id, display name and lowercased handle of a TikTok user."""
    if not isinstance(user, dict):
        return None
    # userId is a 64-bit number and arrives as a string; the handle can change,
    # the id cannot, and the cooldown and the leaderboard are keyed on it.
    user_id = _as_str(_field(user, "userId", "id"))
    unique_id = _as_str(_field(user, "uniqueId", "displayId"))
    nickname = _as_str(user.get("nickname"))
    external_id = user_id if user_id not in ("", "0") else unique_id
    if not external_id:
        return None
    display_name = _display_name(nickname, unique_id)
    if not display_name:
        return None
    return f"tt:{external_id}", display_name, unique_id.strip().lower()


def _fan_level(user: dict) -> int | None:
    club = _field(_field(user, "fansClub"), "data")
    level = _as_int(_field(club, "level"))
    if level is None:
        level = _as_int(_field(_field(user, "fansClubInfo"), "fansLevel"))
    return level if level and 0 < level <= 99 else None


def tiktok_badges(data: dict) -> tuple[live_chat.ChatBadge, ...]:
    """A TikTok author's roles as badge codes of our own.

    TikTok sends its badge pictures as signed, expiring CDN links, which do not
    survive in a column, so the roles are mapped to codes the host page draws
    with its own icons: host, moderator, subscriber, fan club with its level,
    and gift giver ("has sent this streamer a gift before").
    """
    user = data.get("user") if isinstance(data.get("user"), dict) else {}
    identity = _field(data, "userIdentity") or _field(user, "userIdentity") or {}
    badges: list[live_chat.ChatBadge] = []

    def add(set_id: str, version: str = "1") -> None:
        badge = live_chat.badge_from_parts(set_id, version)
        if badge is not None and badge not in badges:
            badges.append(badge)

    if _truthy(_field(identity, "isAnchor")):
        add("tt-host")
    if _truthy(_field(identity, "isModeratorOfAnchor")):
        add("tt-moderator")
    if _truthy(_field(identity, "isSubscriberOfAnchor")) or _truthy(
        _field(user, "isSubscribedToAnchor")
    ):
        add("tt-subscriber")
    level = _fan_level(user)
    if level is not None:
        add("tt-fan", str(level))
    if _truthy(_field(identity, "isGiftGiverOfAnchor")):
        add("tt-supporter")
    return tuple(badges[: live_chat.MAX_BADGES])


def _message_id(data: dict) -> str:
    return _as_str(_field(_field(data, "common"), "msgId"))


# Hosts a gift picture may come from. TikTok serves them from its own CDN; a
# URL anywhere else is not drawn, because the host page would load it.
_GIFT_IMAGE_HOSTS = ("tiktokcdn.com", "tiktokcdn-us.com", "tiktokcdn-eu.com", "ibyteimg.com")


def _gift_image(gift: object) -> str | None:
    image = _field(gift, "giftImage", "image", "icon")
    urls = _field(image, "url", "urlList", "url_list")
    if not isinstance(urls, list):
        return None
    for url in urls:
        if not isinstance(url, str) or len(url) > 1000:
            continue
        parts = urlsplit(url)
        host = (parts.hostname or "").lower()
        if parts.scheme == "https" and any(
            host == allowed or host.endswith(f".{allowed}") for allowed in _GIFT_IMAGE_HOSTS
        ):
            return url
    return None


def _gift_event(data: dict) -> live_chat.PaidEvent | None:
    """A finished gift, or None while a streak is still running.

    A streakable gift (type 1) sends one frame per tap with a growing
    ``repeatCount`` and ``repeatEnd`` set on the last; only that one is the
    gift. Any other gift is complete in its single frame.
    """
    gift = _field(data, "giftDetails", "gift")
    streakable = _as_int(_field(gift, "giftType", "type")) == 1
    if streakable and not _truthy(data.get("repeatEnd")):
        return None
    actor = _user(data.get("user"))
    diamonds = _as_int(_field(gift, "diamondCount"))
    count = _as_int(data.get("repeatCount")) or 1
    if actor is None or not diamonds or count < 1:
        return None
    name = _as_str(_field(gift, "giftName", "name")).strip()[:40] or None
    return live_chat.make_event(
        platform="tiktok", event_id=_message_id(data), kind="tiktok_gift",
        actor_external_id=actor[0], actor_name=actor[1],
        amount=diamonds * count, gift_name=name, gift_count=count,
        gift_image=_gift_image(gift), badges=tiktok_badges(data),
    )


def _sub_event(data: dict) -> live_chat.PaidEvent | None:
    # messageType SUB_SUCCESS (0) is a subscription; the other values are
    # reminders and goal notices about subscriptions, not one.
    message_type = data.get("messageType")
    if message_type not in (None, 0, "0", "SUB_SUCCESS"):
        return None
    actor = _user(data.get("user"))
    if actor is None:
        return None
    return live_chat.make_event(
        platform="tiktok", event_id=_message_id(data), kind="tiktok_sub",
        actor_external_id=actor[0], actor_name=actor[1],
        months=_as_int(data.get("subMonth")) or 1, badges=tiktok_badges(data),
    )


def _chest_event(data: dict) -> live_chat.PaidEvent | None:
    info = _field(data, "envelopeInfo")
    envelope_id = _as_str(_field(info, "envelopeId"))
    sender = _as_str(_field(info, "sendUserId"))
    name = _as_str(_field(info, "sendUserName"))
    diamonds = _as_int(_field(info, "diamondCount"))
    if not envelope_id or not diamonds:
        return None
    return live_chat.make_event(
        platform="tiktok", event_id=f"chest-{envelope_id}"[:64], kind="tiktok_chest",
        actor_external_id=f"tt:{sender}" if sender else "anonymous",
        actor_name=_display_name(name, "") or live_chat.ANONYMOUS_NAME,
        amount=diamonds,
    )


_EVENT_PARSERS = {
    "WebcastGiftMessage": _gift_event,
    "WebcastSubNotifyMessage": _sub_event,
    "WebcastEnvelopeMessage": _chest_event,
}


def _chat_message(event: object) -> live_chat.ChatMessage | None:
    if not isinstance(event, dict) or event.get("type") != "WebcastChatMessage":
        return None
    data = event.get("data")
    if not isinstance(data, dict):
        return None
    comment = data.get("comment")
    if not isinstance(comment, str):
        return None
    actor = _user(data.get("user"))
    if actor is None:
        return None
    return live_chat.ChatMessage(
        external_id=actor[0], display_name=actor[1], text=comment, login=actor[2],
        badges=tiktok_badges(data),
    )


def _paid_event(event: object) -> live_chat.PaidEvent | None:
    if not isinstance(event, dict):
        return None
    parser = _EVENT_PARSERS.get(event.get("type"))
    data = event.get("data")
    if parser is None or not isinstance(data, dict):
        return None
    return parser(data)


def _frame_events(raw: str | bytes) -> list:
    try:
        frame = json.loads(raw)
    except (ValueError, TypeError):
        return []
    if not isinstance(frame, dict):
        return []
    # Bundled frames are the provider's default; a single event is accepted too,
    # so a change of that default does not silently empty the board.
    events = frame.get("messages") if "messages" in frame else [frame]
    return events if isinstance(events, list) else []


def parse_euler_frame(raw: str | bytes) -> list[live_chat.ChatMessage]:
    """The chat lines in one provider frame. Anything else is ignored.

    Never raises: a frame the reader does not understand is one lost line, while
    an exception here would drop the connection and re-bill a connect.
    """
    return [m for m in (_chat_message(e) for e in _frame_events(raw)) if m is not None]


def parse_euler_frame_full(
    raw: str | bytes,
) -> tuple[list[live_chat.ChatMessage], list[live_chat.PaidEvent]]:
    """Chat lines and paid events of one frame, in one decode."""
    events = _frame_events(raw)
    messages = [m for m in (_chat_message(e) for e in events) if m is not None]
    paid = [p for p in (_paid_event(e) for e in events) if p is not None]
    return messages, paid


# --- Reader -------------------------------------------------------------------


class TikTokChatReader:
    """One provider connection to one TikTok LIVE room.

    ``connect``, ``sleep`` and ``budget`` are injected in tests, so the
    close-code rules can be exercised without a socket and without waiting.
    """

    def __init__(
        self, channel: str, connect=None, sleep=asyncio.sleep, budget: ConnectBudget | None = None,
    ) -> None:
        self.channel = channel
        self._connect = connect or self._default_connect
        self._sleep = sleep
        self._budget = budget or _budget

    def _default_connect(self):
        key = api_key()
        if key is None:
            raise _NotConfigured()
        return websockets.connect(
            build_url(self.channel, key),
            max_size=_MAX_FRAME_BYTES,
            open_timeout=20,
            logger=_SOCKET_LOGGER,
        )

    async def _session(
        self, socket, on_message, on_state, on_event
    ) -> tuple[int | None, bool]:
        """Read until the socket closes. Returns the close code and whether
        anything arrived.

        ``live`` is announced on the first frame rather than on open: the
        provider accepts the socket and only then closes it with 4404 when the
        streamer is offline, and announcing on open would flash "live" at them.
        """
        received = False
        try:
            async for raw in socket:
                if not received:
                    received = True
                    await on_state("live", None)
                messages, events = parse_euler_frame_full(raw)
                for message in messages:
                    await on_message(message)
                for event in events:
                    await on_event(event)
        except ConnectionClosed as closed:
            code = closed.rcvd.code if closed.rcvd is not None else None
            return code, received
        return getattr(socket, "close_code", None), received

    async def run(self, on_message, on_state, on_event=None) -> None:
        """Stay connected until cancelled, or until the room is hopeless."""
        on_event = on_event or _ignore_event
        backoff = _BACKOFF_START
        wait = _WAIT_START
        while True:
            code: int | None = None
            received = False
            while (slot_wait := self._budget.reserve()) > 0:
                await self._sleep(slot_wait)
            try:
                async with self._connect() as socket:
                    code, received = await self._session(
                        socket, on_message, on_state, on_event
                    )
            except asyncio.CancelledError:
                raise
            except _NotConfigured:
                await on_state("error", NOT_CONFIGURED_TEXT)
                return
            except InvalidStatus as exc:
                code = _HTTP_TO_CLOSE.get(exc.response.status_code)
                logger.info(
                    "tiktok chat %s refused with HTTP %s", self.channel, exc.response.status_code,
                )
            except Exception as exc:  # noqa: BLE001 - any transport failure retries
                logger.info(
                    "tiktok chat %s disconnected: %s", self.channel, _redact(str(exc)),
                )

            if received:
                # A connection that carried a stream resets the clocks, so one
                # hiccup in a long stream does not inherit an old backoff.
                backoff = _BACKOFF_START
                wait = _WAIT_START

            kind = classify_close(code)
            if kind == "fatal":
                if code == CLOSE_INVALID_AUTH:
                    logger.error("tiktok chat: the Euler Stream API key was refused")
                await on_state("error", _FATAL[code])
                return
            if kind == "waiting":
                await on_state("connecting", WAITING_TEXT)
                delay = wait
                wait = min(wait * 2, _WAIT_MAX)
            elif kind == "rate_limited":
                logger.warning("tiktok chat %s: provider connection limit reached", self.channel)
                await on_state("connecting", None)
                delay = max(backoff, _RATE_LIMITED_MIN)
                backoff = min(delay * 2, _WAIT_MAX)
            else:
                await on_state("connecting", None)
                delay = backoff
                backoff = min(backoff * 2, _BACKOFF_MAX)

            # A little jitter, so rooms that lost the provider at the same moment
            # do not all come back in the same second.
            await self._sleep(delay * random.uniform(0.9, 1.1))  # nosec B311


async def _ignore_event(_event) -> None:
    """The default for a caller that only wants chat lines."""


class _NotConfigured(Exception):
    """No API key. Raised inside the reader so it ends with a status line."""
