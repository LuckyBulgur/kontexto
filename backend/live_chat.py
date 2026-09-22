"""Live chat mode: a livestream chat plays one koop round together.

A streamer names their channel, the server reads that chat, and every message
that looks like a single word becomes a guess on one shared koop list. Viewers
need no account, no invite link and no client; they type where they already are.

Three decisions shape this module.

**It is koop, not a seventh game.** A live room *is* a koop room: the round, the
de-duplicated guess list, the rank scale, the reveal boundary and the whole
poll-and-broadcast path are koop's. What lives here is the binding of one room to
one channel, the rule that turns a chat line into a guess, and the throttle. Two
tables (``live_rooms``, ``live_viewers``) hang off ``koops``.

**Viewers are not players.** A live room has two ``koop_players`` rows and never
more: the host, and one that stands for the whole chat. A chat with a few
thousand people would otherwise produce a few thousand player rows and one
``player_joined`` frame per row out of the koop poll loop, which would drown the
host's socket in the first minute. A viewer's guess is written under the chat's
token with the viewer's own display name, and their standing lives in
``live_viewers``, keyed by the platform's immutable user id.

**Nothing here talks to the network.** Reading a chat is
``backend/twitch_chat.py``; this module is pure logic plus SQLite, so the rules
that decide what counts as a guess can be tested without a socket.
"""

from __future__ import annotations

import re
import secrets
import time
from dataclasses import dataclass

import aiosqlite

from nicknames import sanitize_nickname
from wordlists import contains_profanity

# The platforms a room may be bound to. Only Twitch reads a chat today; the
# column exists so YouTube (OAuth plus a quota budget) and TikTok (no official
# chat API) can be added next to it instead of through it.
PLATFORMS: tuple[str, ...] = ("twitch",)

# Twitch login rules: 4 to 25 characters, letters, digits and underscore. Checked
# before a reader task is ever started, so a typo fails at the create call
# instead of as a connection that never joins anything.
_CHANNEL = re.compile(r"^[a-z0-9_]{4,25}$")

# What a chat line may contribute. One token, German letters only, because a
# guess is one word and everything else is conversation. The upper bound is the
# same 30 characters the game's own input field allows.
_WORD = re.compile(r"^[a-zA-ZäöüÄÖÜß]{2,30}$")

# The opt-in prefix. Free guessing is the default; a streamer with a busy chat
# turns this on and only prefixed lines count.
_PREFIX = "!k"

# How long a viewer waits between two accepted guesses, and how many guesses one
# room accepts per second. The rank lookup is O(1) and could take far more, the
# reason for the cap is the board: a list that scrolls faster than it reads is
# worth nothing on a stream, and the koop broadcast ships every new row.
VIEWER_COOLDOWN_SECONDS = 2.0
ROOM_GUESSES_PER_SECOND = 20

# Chat states a room can be in, written by the reader task and read by the host
# view. 'error' is terminal and carries a sentence in `chat_error`.
CHAT_STATES: tuple[str, ...] = ("connecting", "live", "error")

# The name the chat's own koop player row carries. Visible only if somebody opens
# a live room on the plain koop route, where the ordinary player list is shown.
CHAT_PLAYER_NAME = "Der Chat"


@dataclass(frozen=True)
class ChatMessage:
    """One chat line, reduced to what the game needs.

    ``external_id`` is the platform's user id and never the display name: a name
    can change between two messages, the id cannot, and the id is what the
    cooldown and the leaderboard are keyed on.
    """

    external_id: str
    display_name: str
    text: str


def normalise_channel(raw: str | None) -> str | None:
    """Lowercase a channel name and accept it only if the platform could have it.

    Returns None for anything that is not a possible Twitch login, including the
    two spellings people paste most often: a full URL and a leading ``@``.
    """
    if not raw:
        return None
    name = raw.strip().lower()
    if name.startswith("@"):
        name = name[1:]
    # twitch.tv/name, www.twitch.tv/name, https://twitch.tv/name?foo
    if "twitch.tv/" in name:
        name = name.split("twitch.tv/", 1)[1]
    name = name.split("?", 1)[0].split("/", 1)[0].strip()
    if not _CHANNEL.match(name):
        return None
    # The channel name is printed on the overlay and kept forever on the admin
    # board, so it passes the nickname rule. A refusal here is the ordinary
    # bad_channel error: the host is a streamer setting up a room, not a
    # prober, and a silent rename cannot apply to a login that must match.
    if contains_profanity(name, collapse_words=True):
        return None
    return name


# --- IRC parsing ------------------------------------------------------------

# IRCv3 tag escapes. Decoded in one left-to-right scan and never by a sequence
# of replaces: `\\s` is an escaped backslash followed by an s, and a pass that
# replaced `\s` first would turn it into a space.
_TAG_UNESCAPE = {":": ";", "s": " ", "r": "\r", "n": "\n", "\\": "\\"}


def _unescape_tag(value: str) -> str:
    out: list[str] = []
    i = 0
    while i < len(value):
        char = value[i]
        if char != "\\":
            out.append(char)
            i += 1
            continue
        if i + 1 >= len(value):
            # A lone trailing backslash is dropped, per the spec.
            break
        nxt = value[i + 1]
        out.append(_TAG_UNESCAPE.get(nxt, nxt))
        i += 2
    return "".join(out)


def parse_tags(raw: str) -> dict[str, str]:
    """Split the ``@a=1;b=2`` prefix of an IRCv3 line into a dict."""
    tags: dict[str, str] = {}
    for part in raw.split(";"):
        if not part:
            continue
        key, _, value = part.partition("=")
        tags[key] = _unescape_tag(value)
    return tags


def parse_irc_line(line: str) -> ChatMessage | None:
    """Turn one raw IRC line into a ChatMessage, or None if it is not chat.

    Only PRIVMSG is chat. PING, JOIN, NOTICE, ROOMSTATE and the rest are protocol
    and are handled by the reader, not here.
    """
    line = line.rstrip("\r\n")
    tags: dict[str, str] = {}
    if line.startswith("@"):
        raw_tags, _, line = line[1:].partition(" ")
        tags = parse_tags(raw_tags)
    if not line.startswith(":"):
        return None
    prefix, _, rest = line[1:].partition(" ")
    if not rest.startswith("PRIVMSG "):
        return None
    # "PRIVMSG #channel :text"; the text is everything after the first colon that
    # follows the channel, and it may itself contain colons.
    _, _, after_channel = rest.partition(" ")
    _, sep, text = after_channel.partition(" :")
    if not sep:
        return None

    login = prefix.split("!", 1)[0]
    external_id = tags.get("user-id") or login
    display_name = tags.get("display-name") or login
    if not external_id or not display_name:
        return None
    return ChatMessage(external_id=external_id, display_name=display_name, text=text)


def extract_word(text: str, require_prefix: bool) -> str | None:
    """The word a chat line contributes, or None if it contributes nothing.

    In prefix mode only ``!k wort`` counts, which keeps an ordinary conversation
    out of the game. In free mode a message counts when it is exactly one word,
    which is what makes the mode feel alive: people type the word, not a command.
    Either way a message with two or more words is never a guess, so nobody
    guesses by accident while talking.
    """
    text = text.strip()
    if not text:
        return None
    if require_prefix:
        head, _, rest = text.partition(" ")
        if head.lower() != _PREFIX:
            return None
        text = rest.strip()
    return text.lower() if _WORD.match(text) else None


def is_showable_guess(typed: str, scored: str, rank: int) -> bool:
    """Whether a resolved chat guess may appear on the stream overlay.

    The invited rooms show every guessable word, because the players chose each
    other. A live room writes what anonymous viewers type onto a public stream,
    so a word the user-text filter flags is dropped there, silently, like any
    other line that does not count.

    The solution always counts. ``Idiot`` and ``Kamel`` are solutions
    and flagged words at once, and a chat that could never enter the answer
    could never finish the round. Both spellings are checked, because the scored
    form is the folded lemma and the typed one may be the worse of the two.
    """
    if rank == 1:
        return True
    return not (
        contains_profanity(typed, collapse_words=True)
        or contains_profanity(scored, collapse_words=True)
    )


class GuessGate:
    """Per-viewer cooldown and per-room rate cap for accepted guesses.

    In-process state, and that is correct here: the ingest runs in the single WS
    worker, so this dict has exactly one writer. Putting it in SQLite would add a
    write per dropped chat line, which is the opposite of what a throttle is for.

    Dropping is silent. A chat cannot read an error, and a message explaining the
    cooldown would be worse than the flood it prevents.
    """

    def __init__(
        self,
        cooldown: float = VIEWER_COOLDOWN_SECONDS,
        per_second: int = ROOM_GUESSES_PER_SECOND,
        clock=time.monotonic,
    ) -> None:
        self._cooldown = cooldown
        self._per_second = per_second
        self._clock = clock
        self._last_guess: dict[tuple[str, str], float] = {}
        self._bucket: dict[str, tuple[float, float]] = {}

    def allow(self, koop_id: str, external_id: str) -> bool:
        now = self._clock()
        key = (koop_id, external_id)
        last = self._last_guess.get(key)
        if last is not None and now - last < self._cooldown:
            return False

        # Token bucket, refilled continuously: a burst of 20 passes at once and
        # then the room drains at 20 per second, instead of 20 per wall-clock
        # second with a cliff at every boundary.
        tokens, stamp = self._bucket.get(koop_id, (float(self._per_second), now))
        tokens = min(float(self._per_second), tokens + (now - stamp) * self._per_second)
        if tokens < 1.0:
            self._bucket[koop_id] = (tokens, now)
            return False

        self._bucket[koop_id] = (tokens - 1.0, now)
        self._last_guess[key] = now
        return True

    def forget_room(self, koop_id: str) -> None:
        """Drop a closed room's state so a long-running worker does not grow."""
        self._bucket.pop(koop_id, None)
        for key in [k for k in self._last_guess if k[0] == koop_id]:
            del self._last_guess[key]


def viewer_nickname(display_name: str) -> str:
    """The name a viewer appears under, through the game's one nickname rule.

    ``sanitize_nickname`` guards every other door in this codebase, and this is
    the most exposed of them: the name lands on a public stream overlay, typed by
    someone who was never asked to agree to anything.
    """
    return sanitize_nickname(display_name)


# --- Rooms ------------------------------------------------------------------


class ChannelBusy(Exception):
    """This channel already has a live room. One chat, one game."""


def _token() -> str:
    return secrets.token_urlsafe(32)


async def create_live_room(
    db: aiosqlite.Connection,
    koop_id: str,
    platform: str,
    channel: str,
    host_token: str,
    require_prefix: bool,
    chat_player_name: str = CHAT_PLAYER_NAME,
) -> dict:
    """Bind an existing koop room to a chat channel.

    Raises ChannelBusy when that channel is already bound. The unique index does
    the deciding, not a prior SELECT, because two create calls can race.

    The chat gets a koop player row of its own. Not for the player list, which
    the live view replaces anyway, but because the koop broadcast excludes the
    author of a guess from the frame it sends: a guess written with the host's
    token would reach every socket except the host's, and in a live room theirs
    is usually the only one.
    """
    overlay_token = _token()
    chat_token = _token()
    try:
        await db.execute(
            "INSERT INTO live_rooms "
            "(koop_id, platform, channel, host_token, chat_token, overlay_token, "
            "require_prefix) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                koop_id, platform, channel, host_token, chat_token, overlay_token,
                int(require_prefix),
            ),
        )
    except aiosqlite.IntegrityError as exc:
        raise ChannelBusy(channel) from exc
    await db.execute(
        "INSERT INTO koop_players (koop_id, nickname, player_token) VALUES (?, ?, ?)",
        (koop_id, chat_player_name, chat_token),
    )
    await db.commit()
    return {
        "koop_id": koop_id,
        "platform": platform,
        "channel": channel,
        "chat_token": chat_token,
        "overlay_token": overlay_token,
        "require_prefix": require_prefix,
        "chat_state": "connecting",
    }


def _room_row(row: aiosqlite.Row | None) -> dict | None:
    if row is None:
        return None
    return {
        "koop_id": row["koop_id"],
        "platform": row["platform"],
        "channel": row["channel"],
        "host_token": row["host_token"],
        "chat_token": row["chat_token"],
        "overlay_token": row["overlay_token"],
        "require_prefix": bool(row["require_prefix"]),
        "chat_state": row["chat_state"],
        "chat_error": row["chat_error"],
        "last_chat_at": row["last_chat_at"],
    }


async def get_live_room(db: aiosqlite.Connection, koop_id: str) -> dict | None:
    cursor = await db.execute("SELECT * FROM live_rooms WHERE koop_id = ?", (koop_id,))
    return _room_row(await cursor.fetchone())


async def get_live_room_by_overlay(db: aiosqlite.Connection, token: str) -> dict | None:
    cursor = await db.execute(
        "SELECT * FROM live_rooms WHERE overlay_token = ?", (token,)
    )
    return _room_row(await cursor.fetchone())


async def list_live_rooms(db: aiosqlite.Connection) -> list[dict]:
    """Every bound room plus its round, for the reader supervisor.

    The round rides along because the supervisor is what notices a new one: it
    already reads this table on a timer, and counting rounds there works whether
    or not the chat happens to be talking at the moment the host clicks on.
    """
    cursor = await db.execute(
        "SELECT lr.*, k.round AS round FROM live_rooms lr "
        "JOIN koops k ON k.id = lr.koop_id ORDER BY lr.created_at"
    )
    rooms = []
    for raw in await cursor.fetchall():
        row = _room_row(raw)
        if row is not None:
            row["round"] = raw["round"]
            rooms.append(row)
    return rooms


async def stop_live_room(db: aiosqlite.Connection, koop_id: str, host_token: str) -> bool:
    """Unbind a room. Only the host may, and the koop room itself stays alive.

    The reader task disappears on the supervisor's next pass, and the koop room
    then ages out through the ordinary one-hour rule, so a streamer who stops
    mid-round can still read the board and reveal the word.
    """
    cursor = await db.execute(
        "DELETE FROM live_rooms WHERE koop_id = ? AND host_token = ?",
        (koop_id, host_token),
    )
    await db.commit()
    return cursor.rowcount > 0


async def set_chat_state(
    db: aiosqlite.Connection,
    koop_id: str,
    state: str,
    error: str | None = None,
) -> bool:
    """Record what the reader is doing, for the host's status line.

    Writes only on a real change, and says whether it wrote. A status line is
    read by one person and changes a handful of times per stream, so repeating
    the same UPDATE on every pass of the supervisor buys nothing and costs a
    write lock on a file that five workers share. It showed up as
    "database is locked" under load before this guard existed.
    """
    if state not in CHAT_STATES:
        raise ValueError(f"unknown chat state: {state}")
    cursor = await db.execute(
        "UPDATE live_rooms SET chat_state = ?, chat_error = ? "
        "WHERE koop_id = ? AND (chat_state IS NOT ? OR chat_error IS NOT ?)",
        (state, error, koop_id, state, error),
    )
    if cursor.rowcount:
        await db.commit()
        return True
    return False


async def record_viewer(
    db: aiosqlite.Connection,
    koop_id: str,
    platform: str,
    external_id: str,
    nickname: str,
    rank: int,
    commit: bool = True,
) -> bool:
    """Count one accepted guess for a viewer. True when this viewer is new here.

    Split into an insert and an update rather than one upsert, because the caller
    needs to know whether a new person just joined in: that is the only moment
    the permanent per-channel viewer count may be raised, and an upsert cannot
    tell the two cases apart through rowcount.
    """
    cursor = await db.execute(
        "INSERT OR IGNORE INTO live_viewers "
        "(koop_id, platform, external_id, nickname, hits, best_rank) "
        "VALUES (?, ?, ?, ?, 0, NULL)",
        (koop_id, platform, external_id, nickname),
    )
    is_new = cursor.rowcount == 1

    # Commutative, no read-modify-write, like the koop rollup: correct today with
    # one writer and still correct if the ingest is ever split.
    await db.execute(
        "UPDATE live_viewers SET hits = hits + 1, nickname = ?, "
        "best_rank = CASE WHEN best_rank IS NULL OR ? < best_rank THEN ? ELSE best_rank END "
        "WHERE koop_id = ? AND platform = ? AND external_id = ?",
        (nickname, rank, rank, koop_id, platform, external_id),
    )
    await db.execute(
        "UPDATE koops SET last_activity = CURRENT_TIMESTAMP WHERE id = ?", (koop_id,)
    )
    if commit:
        await db.commit()
    return is_new


# --- Per-channel statistics (the part that outlives the room) ---------------

# What may be counted per channel. A closed set, so a caller cannot invent a
# column name and a typo cannot silently create a dimension nobody reads.
STREAM_METRICS: tuple[str, ...] = ("sessions", "rounds", "guesses", "solves", "viewers")


async def record_stream_event(
    db: aiosqlite.Connection,
    platform: str,
    channel: str,
    metric: str,
    amount: int = 1,
    rank: int | None = None,
    commit: bool = True,
) -> None:
    """Raise one permanent per-channel counter.

    The channel name is kept forever on purpose: it is the unit these figures are
    about, and it is a public broadcast name, not a person's. The chatters behind
    the numbers stay anonymous, exactly as everywhere else in the analytics.

    Written with SQLite's own clock and an additive upsert, so the four API
    workers and the WS worker can all raise it without a read-modify-write.

    ``commit=False`` lets a caller that raises several of these in a row pay for
    one transaction instead of one per counter. The chat ingest does exactly
    that: at twenty accepted guesses a second, a commit per counter is five
    write locks per chat line on a file that five workers share.
    """
    if metric not in STREAM_METRICS:
        raise ValueError(f"unknown stream metric: {metric}")
    await db.execute(
        f"INSERT INTO live_stream_stats "
        f"(platform, channel, first_seen, last_seen, {metric}, best_rank) "
        f"VALUES (?, ?, datetime('now'), datetime('now'), ?, ?) "
        f"ON CONFLICT(platform, channel) DO UPDATE SET "
        f"last_seen = datetime('now'), {metric} = {metric} + excluded.{metric}, "
        f"best_rank = CASE WHEN live_stream_stats.best_rank IS NULL "
        f"OR (excluded.best_rank IS NOT NULL "
        f"AND excluded.best_rank < live_stream_stats.best_rank) "
        f"THEN excluded.best_rank ELSE live_stream_stats.best_rank END",
        (platform, channel, amount, rank),
    )
    if commit:
        await db.commit()


async def stream_stats(db: aiosqlite.Connection, limit: int = 100) -> list[dict]:
    """Every channel that ever played, busiest first. Read by the admin board."""
    cursor = await db.execute(
        "SELECT platform, channel, first_seen, last_seen, sessions, rounds, "
        "guesses, solves, viewers, best_rank FROM live_stream_stats "
        "ORDER BY guesses DESC, last_seen DESC LIMIT ?",
        (limit,),
    )
    return [dict(row) for row in await cursor.fetchall()]


async def stream_totals(db: aiosqlite.Connection) -> dict:
    """One line for the dashboard header: how big is this mode overall."""
    cursor = await db.execute(
        "SELECT COUNT(*) AS channels, COALESCE(SUM(sessions), 0) AS sessions, "
        "COALESCE(SUM(rounds), 0) AS rounds, COALESCE(SUM(guesses), 0) AS guesses, "
        "COALESCE(SUM(solves), 0) AS solves, COALESCE(SUM(viewers), 0) AS viewers "
        "FROM live_stream_stats"
    )
    row = await cursor.fetchone()
    return dict(row) if row else {
        "channels": 0, "sessions": 0, "rounds": 0,
        "guesses": 0, "solves": 0, "viewers": 0,
    }


async def active_streams(db: aiosqlite.Connection) -> list[dict]:
    """The rooms bound right now, for the live section of the dashboard."""
    cursor = await db.execute(
        "SELECT lr.platform, lr.channel, lr.chat_state, lr.created_at, k.round, "
        "k.best_rank, (SELECT COUNT(*) FROM live_viewers lv WHERE lv.koop_id = lr.koop_id) "
        "AS viewers FROM live_rooms lr JOIN koops k ON k.id = lr.koop_id "
        "ORDER BY lr.created_at DESC"
    )
    return [dict(row) for row in await cursor.fetchall()]


async def reset_viewers(db: aiosqlite.Connection, koop_id: str) -> None:
    """Clear the leaderboard. Not called per round, see top_viewers."""
    await db.execute("DELETE FROM live_viewers WHERE koop_id = ?", (koop_id,))
    await db.commit()


async def top_viewers(
    db: aiosqlite.Connection, koop_id: str, limit: int = 5
) -> list[dict]:
    """The leaderboard, counted over the whole stream and not per round.

    A stream plays many rounds in one sitting, and the interesting question
    there is who carried the evening, not who carried the last eight minutes.
    Hits first, best rank as the tie-break.
    """
    cursor = await db.execute(
        "SELECT nickname, hits, best_rank FROM live_viewers WHERE koop_id = ? "
        "ORDER BY hits DESC, (best_rank IS NULL), best_rank ASC LIMIT ?",
        (koop_id, limit),
    )
    return [
        {
            "nickname": row["nickname"],
            "hits": row["hits"],
            "best_rank": row["best_rank"],
        }
        for row in await cursor.fetchall()
    ]


async def overlay_snapshot(
    db: aiosqlite.Connection, koop_id: str, guess_limit: int = 12
) -> dict | None:
    """Everything the OBS overlay shows, in one read.

    Carries no game number and no target word. The overlay sits on a public
    stream, so it is held to the same boundary as every other room response
    (``backend/rooms.py``): the number is the answer, and it leaves the server
    only through the reveal endpoint, once the round is over.
    """
    cursor = await db.execute(
        "SELECT round, best_rank, solved, solved_by, gave_up FROM koops WHERE id = ?",
        (koop_id,),
    )
    koop = await cursor.fetchone()
    if koop is None:
        return None

    cursor = await db.execute(
        "SELECT nickname, word, rank, is_tip FROM koop_guesses "
        "WHERE koop_id = ? ORDER BY id DESC LIMIT ?",
        (koop_id, guess_limit),
    )
    recent = [
        {
            "nickname": row["nickname"],
            "word": row["word"],
            "rank": row["rank"],
            "is_tip": bool(row["is_tip"]),
        }
        for row in await cursor.fetchall()
    ]

    room = await get_live_room(db, koop_id)
    return {
        "round": koop["round"],
        "best_rank": koop["best_rank"],
        "solved": bool(koop["solved"]),
        "solved_by": koop["solved_by"],
        "gave_up": bool(koop["gave_up"]),
        "chat_state": room["chat_state"] if room else "error",
        "channel": room["channel"] if room else None,
        "recent": recent,
        "top": await top_viewers(db, koop_id),
    }
