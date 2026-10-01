"""Live chat mode: a livestream chat plays one koop round together.

A streamer names their channel, the server reads that chat, and every message
that looks like a single word becomes a guess on one shared koop list. Viewers
need no account, no invite link and no client; they type where they already are.

Three decisions shape this module.

**It is koop, not a seventh game.** A live room *is* a koop room: the round, the
de-duplicated guess list, the rank scale, the reveal boundary and the whole
poll-and-broadcast path are koop's. What lives here is the binding of one room to
its chats (one per platform, so Twitch and TikTok can play the same round), the
rule that turns a chat line into a guess, and the throttle. Three tables
(``live_rooms``, ``live_channels``, ``live_viewers``) hang off ``koops``.

**Viewers are not players.** A live room has two ``koop_players`` rows and never
more: the host, and one that stands for the whole chat. A chat with a few
thousand people would otherwise produce a few thousand player rows and one
``player_joined`` frame per row out of the koop poll loop, which would drown the
host's socket in the first minute. A viewer's guess is written under the chat's
token with the viewer's own display name, and their standing lives in
``live_viewers``, keyed by the platform's immutable user id.

**Nothing here talks to the network.** Reading a chat is ``twitch_chat.py``
(anonymous IRC) and ``tiktok_chat.py`` (the Euler Stream socket), and
``live_ingest.py`` decides which room gets a reader; this module is pure logic
plus SQLite, so the rules that decide what counts as a guess can be tested
without a socket.
"""

from __future__ import annotations

import re
import secrets
import time
import unicodedata
from dataclasses import dataclass

import aiosqlite

from nicknames import sanitize_nickname
from wordlists import contains_profanity

# The platforms a room may be bound to. YouTube (OAuth plus a quota budget) is
# the one still missing, and it is added next to these, not through them.
PLATFORMS: tuple[str, ...] = ("twitch", "tiktok")

# Login rules per platform, checked before a reader task is ever started, so a
# typo fails at the create call instead of as a connection that never joins
# anything. Twitch: 4 to 25 characters, letters, digits and underscore. TikTok:
# 2 to 24 characters, letters, digits, underscore and dot, never ending in a dot.
_CHANNEL = {
    "twitch": re.compile(r"^[a-z0-9_]{4,25}$"),
    "tiktok": re.compile(r"^[a-z0-9_.]{1,23}[a-z0-9_]$"),
}

# Where each platform puts the channel in a pasted URL. TikTok writes the handle
# with an @ in the path (tiktok.com/@name/live), Twitch without.
_URL_MARKER = {
    "twitch": "twitch.tv/",
    "tiktok": "tiktok.com/",
}

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


# --- Badges -----------------------------------------------------------------

# How a badge is written: the platform's own set id and version, the form the
# Twitch `badges` tag uses (`moderator/1`, `subscriber/3012`). TikTok has no such
# tag, so its reader maps the roles it is told about onto codes of our own, all
# under a `tt-` prefix that no Twitch set id carries. The pattern is the whole
# trust boundary for a value that ends up in a column and in an image lookup.
_BADGE_SET = re.compile(r"^[a-z0-9_-]{1,40}$")
_BADGE_VERSION = re.compile(r"^[A-Za-z0-9_-]{1,20}$")

# Twitch shows at most three badges in front of a name; a line carries more
# only in odd cases. Six leaves room for both platforms and caps a hostile tag.
MAX_BADGES = 6


@dataclass(frozen=True)
class ChatBadge:
    """One badge as the platform names it."""

    set_id: str
    version: str


def badge_from_parts(set_id: str, version: str) -> ChatBadge | None:
    if not _BADGE_SET.match(set_id) or not _BADGE_VERSION.match(version):
        return None
    return ChatBadge(set_id, version)


def parse_badge_tag(raw: str | None) -> tuple[ChatBadge, ...]:
    """The ``badges`` tag of an IRC line (or the column form), in display order."""
    if not raw:
        return ()
    badges: list[ChatBadge] = []
    for part in raw.split(","):
        set_id, sep, version = part.partition("/")
        badge = badge_from_parts(set_id, version) if sep else None
        if badge is not None and badge not in badges:
            badges.append(badge)
        if len(badges) >= MAX_BADGES:
            break
    return tuple(badges)


def encode_badges(badges: tuple[ChatBadge, ...]) -> str | None:
    """The column form, ``set/version`` joined by commas. None for no badge."""
    if not badges:
        return None
    return ",".join(f"{badge.set_id}/{badge.version}" for badge in badges[:MAX_BADGES])


@dataclass(frozen=True)
class ChatMessage:
    """One chat line, reduced to what the game needs.

    ``external_id`` is the platform's user id and never the display name: a name
    can change between two messages, the id cannot, and the id is what the
    cooldown and the leaderboard are keyed on.

    ``login`` is the author's platform handle, lowercased, as the platform's own
    server reports it (the IRC prefix on Twitch, ``uniqueId`` on TikTok). It is
    compared with the bound channel to recognise the streamer, which is the one
    person who may end the round from the chat. Empty when unknown, and an empty
    login is never the streamer.
    """

    external_id: str
    display_name: str
    text: str
    login: str = ""
    badges: tuple[ChatBadge, ...] = ()


# --- Paid support -------------------------------------------------------------

# What a chat can do with real money, per platform. A closed set, because the
# kind is stored and the host page picks its sentence by it.
EVENT_KINDS: tuple[str, ...] = (
    "cheer",         # Twitch Bits; amount = bits
    "sub",           # Twitch first subscription
    "resub",         # Twitch resubscription; months = cumulative months
    "gift_sub",      # Twitch, one subscription bought for one other viewer
    "gift_bomb",     # Twitch, several at once for the community; amount = count
    "upgrade",       # Twitch, a gifted or Prime subscription continued as paid
    "tiktok_gift",   # TikTok gift, a finished streak; amount = diamonds
    "tiktok_sub",    # TikTok subscription; months = subscribed months
    "tiktok_chest",  # TikTok treasure chest; amount = diamonds
)

# Twitch sub plans as the `msg-param-sub-plan` tag spells them, lowercased.
SUB_PLANS: dict[str, str] = {
    "prime": "prime", "1000": "1000", "2000": "2000", "3000": "3000",
}

# The name an anonymous gifter is shown under.
ANONYMOUS_NAME = "Anonym"

# A platform message id: Twitch uses UUIDs and TikTok 19-digit numbers. Anything
# else is not an id, and an event without one cannot be deduplicated.
_EVENT_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")

# An amount above this is a broken or hostile frame, not an event. A Twitch
# cheer tops out at 1,000,000 Bits per message, a TikTok Universe is 44,999
# diamonds and a streak multiplies it.
MAX_EVENT_AMOUNT = 10_000_000


@dataclass(frozen=True)
class PaidEvent:
    """One act of paid support, reduced to what the host page celebrates.

    ``actor_name`` is the raw display name; the ingest runs it through the
    nickname rule before it is stored, like every other name a chat supplies.
    No free text of the event (a resub message, a gift comment) is carried.
    """

    platform: str
    event_id: str
    kind: str
    actor_external_id: str
    actor_name: str
    amount: int = 1
    tier: str | None = None
    months: int | None = None
    gift_name: str | None = None
    gift_count: int | None = None
    gift_image: str | None = None
    badges: tuple[ChatBadge, ...] = ()


def make_event(**fields) -> PaidEvent | None:
    """A PaidEvent, or None when a field is outside what a real event carries."""
    event_id = fields.get("event_id") or ""
    amount = fields.get("amount", 1)
    if (
        fields.get("kind") not in EVENT_KINDS
        or not _EVENT_ID.match(event_id)
        or isinstance(amount, bool)
        or not isinstance(amount, int)
        or not 1 <= amount <= MAX_EVENT_AMOUNT
        or not fields.get("actor_name")
    ):
        return None
    months = fields.get("months")
    if months is not None and (not isinstance(months, int) or not 1 <= months <= 1200):
        fields["months"] = None
    count = fields.get("gift_count")
    if count is not None and (not isinstance(count, int) or not 1 <= count <= MAX_EVENT_AMOUNT):
        fields["gift_count"] = None
    return PaidEvent(**fields)


def _int_tag(tags: dict[str, str], key: str) -> int | None:
    raw = tags.get(key, "")
    return int(raw) if raw.isdigit() else None


class GiftBombFolder:
    """Folds the single gift lines of a Twitch sub bomb into the bomb.

    A community gift of ten arrives as one ``submysterygift`` line followed by
    ten ``subgift`` lines, one per recipient. The host should read "verschenkt
    10 Abos" once, not eleven banners. Two signals, because either alone can be
    missing: the ``msg-param-community-gift-id`` the lines share, and a
    per-gifter count of single lines still expected.

    In-process and per reader, which is right: one reader reads one channel,
    in the one WS worker. Entries expire, so a bomb whose single lines never
    come cannot swallow an ordinary gift later.
    """

    EXPIRE_SECONDS = 60.0

    def __init__(self, clock=time.monotonic) -> None:
        self._clock = clock
        self._by_id: dict[str, float] = {}
        self._by_gifter: dict[str, tuple[int, float]] = {}

    def _expire(self, now: float) -> None:
        for key in [k for k, t in self._by_id.items() if now - t > self.EXPIRE_SECONDS]:
            del self._by_id[key]
        for key in [
            k for k, (_, t) in self._by_gifter.items() if now - t > self.EXPIRE_SECONDS
        ]:
            del self._by_gifter[key]

    def bomb(self, gifter: str, community_id: str | None, count: int) -> None:
        now = self._clock()
        self._expire(now)
        if community_id:
            self._by_id[community_id] = now
        left, _ = self._by_gifter.get(gifter, (0, now))
        self._by_gifter[gifter] = (left + count, now)

    def is_part_of_bomb(self, gifter: str, community_id: str | None) -> bool:
        now = self._clock()
        self._expire(now)
        folded = bool(community_id) and community_id in self._by_id
        left, stamp = self._by_gifter.get(gifter, (0, now))
        if left > 0:
            folded = True
            if left == 1:
                del self._by_gifter[gifter]
            else:
                self._by_gifter[gifter] = (left - 1, stamp)
        return folded


def normalise_channel(raw: str | None, platform: str = "twitch") -> str | None:
    """Lowercase a channel name and accept it only if the platform could have it.

    Returns None for anything that is not a possible login on that platform,
    including an unknown platform. Accepts the spellings people paste most often:
    a full URL and a leading ``@``.
    """
    if not raw or platform not in _CHANNEL:
        return None
    name = raw.strip().lower()
    marker = _URL_MARKER[platform]
    # twitch.tv/name, https://www.tiktok.com/@name/live?foo
    if marker in name:
        name = name.split(marker, 1)[1]
    if name.startswith("@"):
        name = name[1:]
    name = name.split("?", 1)[0].split("/", 1)[0].strip()
    if not _CHANNEL[platform].match(name):
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
    if tags.get("bits"):
        text = strip_cheermotes(text)
    return ChatMessage(
        external_id=external_id, display_name=display_name, text=text,
        login=login.lower(), badges=parse_badge_tag(tags.get("badges")),
    )


# A cheermote is a word followed by the number of Bits, `Cheer100`, `Kappa50`.
# Twitch has dozens of prefixes and channels add their own, so the shape is the
# test, not a list: no German guess ends in digits.
_CHEERMOTE = re.compile(r"^[A-Za-z]+\d+$")


def strip_cheermotes(text: str) -> str:
    """A cheer line without its cheermotes, so `Cheer100 apfel` still guesses."""
    return " ".join(token for token in text.split() if not _CHEERMOTE.match(token))


def _split_irc(line: str) -> tuple[dict[str, str], str, str] | None:
    """Tags, prefix login and command of an IRC line."""
    line = line.rstrip("\r\n")
    tags: dict[str, str] = {}
    if line.startswith("@"):
        raw_tags, _, line = line[1:].partition(" ")
        tags = parse_tags(raw_tags)
    if not line.startswith(":"):
        return None
    prefix, _, rest = line[1:].partition(" ")
    command = rest.partition(" ")[0]
    return tags, prefix.split("!", 1)[0], command


def parse_roomstate(line: str) -> str | None:
    """The broadcaster id a ROOMSTATE line carries, or None."""
    parts = _split_irc(line)
    if parts is None or parts[2] != "ROOMSTATE":
        return None
    room_id = parts[0].get("room-id", "")
    return room_id if room_id.isdigit() else None


def _actor(tags: dict[str, str], login: str, anonymous: bool) -> tuple[str, str]:
    """External id and display name of the person behind a notice."""
    sender = tags.get("login") or login
    if anonymous or sender == "ananonymousgifter":
        return "anonymous", ANONYMOUS_NAME
    return tags.get("user-id") or sender, tags.get("display-name") or sender


def parse_twitch_event(line: str, folder: GiftBombFolder) -> PaidEvent | None:
    """The paid support one IRC line carries, or None.

    A PRIVMSG with a ``bits`` tag is a cheer (and may be a guess as well, which
    ``parse_irc_line`` decides on its own). A USERNOTICE carries the rest. The
    single gift lines of a sub bomb are folded into the bomb here.
    """
    parts = _split_irc(line)
    if parts is None:
        return None
    tags, login, command = parts
    event_id = tags.get("id", "")
    badges = parse_badge_tag(tags.get("badges"))

    if command == "PRIVMSG":
        bits = _int_tag(tags, "bits")
        if not bits:
            return None
        external, name = _actor(tags, login, anonymous=False)
        return make_event(
            platform="twitch", event_id=event_id, kind="cheer",
            actor_external_id=external, actor_name=name, amount=bits, badges=badges,
        )

    if command != "USERNOTICE":
        return None
    msg_id = tags.get("msg-id", "")
    plan = SUB_PLANS.get(tags.get("msg-param-sub-plan", "").lower())
    community_id = tags.get("msg-param-community-gift-id") or None
    external, name = _actor(tags, login, anonymous=msg_id.startswith("anon"))

    if msg_id in ("sub", "resub"):
        months = _int_tag(tags, "msg-param-cumulative-months") or 1
        return make_event(
            platform="twitch", event_id=event_id,
            kind="resub" if msg_id == "resub" and months > 1 else "sub",
            actor_external_id=external, actor_name=name, tier=plan, months=months,
            badges=badges,
        )
    if msg_id in ("submysterygift", "anonsubmysterygift"):
        count = _int_tag(tags, "msg-param-mass-gift-count") or 1
        folder.bomb(external, community_id, count)
        return make_event(
            platform="twitch", event_id=event_id, kind="gift_bomb",
            actor_external_id=external, actor_name=name, amount=count, tier=plan,
            badges=badges,
        )
    if msg_id in ("subgift", "anonsubgift"):
        if folder.is_part_of_bomb(external, community_id):
            return None
        return make_event(
            platform="twitch", event_id=event_id, kind="gift_sub",
            actor_external_id=external, actor_name=name, tier=plan,
            months=_int_tag(tags, "msg-param-gift-months"), badges=badges,
        )
    if msg_id in ("giftpaidupgrade", "anongiftpaidupgrade", "primepaidupgrade"):
        return make_event(
            platform="twitch", event_id=event_id, kind="upgrade",
            actor_external_id=external, actor_name=name, tier=plan, badges=badges,
        )
    return None


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


# What the streamer types into their own chat to end the bound round. Both
# spellings, because German writes "Stopp" and the command reads as English, and
# with or without the bang streamers know from chat bots.
STOP_COMMANDS: frozenset[str] = frozenset({"stop", "stopp", "!stop", "!stopp"})


def is_stop_command(text: str) -> bool:
    """Whether a chat line is the stop command, alone on its line.

    ``!k stop`` counts too, so a streamer who turned the prefix on does not have
    to remember that the command is the one line without it. Whether the author
    may stop the round is decided by the caller, this only reads the text.
    """
    words = text.strip().casefold().split()
    if len(words) == 2 and words[0] == _PREFIX:
        words = words[1:]
    return len(words) == 1 and words[0] in STOP_COMMANDS


def is_streamer(message: ChatMessage, channel: str) -> bool:
    """Whether a line was written by the owner of the channel it was read from."""
    return bool(message.login) and message.login == channel


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
        self._last_guess: dict[tuple[str, str, str], float] = {}
        self._bucket: dict[str, tuple[float, float]] = {}

    def allow(self, koop_id: str, platform: str, external_id: str) -> bool:
        """The cooldown is per viewer and platform, the bucket per room.

        Two chats share one board, and the reason for the cap is the board, so
        they share one bucket too.
        """
        now = self._clock()
        key = (koop_id, platform, external_id)
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

    def __init__(self, platform: str, channel: str) -> None:
        super().__init__(f"{platform}/{channel}")
        self.platform = platform
        self.channel = channel


class PlatformBound(Exception):
    """The room already reads a chat on this platform. One chat per platform."""


def _token() -> str:
    return secrets.token_urlsafe(32)


async def create_live_room(
    db: aiosqlite.Connection,
    koop_id: str,
    host_token: str,
    require_prefix: bool,
    channels: list[tuple[str, str]],
    chat_player_name: str = CHAT_PLAYER_NAME,
) -> dict:
    """Bind an existing koop room to one or more chats, one per platform.

    Raises ChannelBusy when one of the channels is already bound, and then
    nothing of this call remains: the room row and every channel row go back
    together. The unique index does the deciding, not a prior SELECT, because
    two create calls can race.

    Every chat the room reads writes under one koop player row of its own. Not
    for the player list, which the live view replaces anyway, but because the
    koop broadcast excludes the author of a guess from the frame it sends: a
    guess written with the host's token would reach every socket except the
    host's, and in a live room theirs is usually the only one.
    """
    if not channels:
        raise ValueError("a live room reads at least one chat")
    # The overlay token is retired with the OBS overlay; the column is NOT NULL
    # UNIQUE and cannot be dropped, so it still gets a random value.
    overlay_token = _token()
    chat_token = _token()
    await db.execute(
        # host_seen_at is written explicitly: on a database that got the
        # column through the migration it has no default.
        "INSERT INTO live_rooms "
        "(koop_id, host_token, chat_token, overlay_token, require_prefix, host_seen_at) "
        "VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
        (koop_id, host_token, chat_token, overlay_token, int(require_prefix)),
    )
    for platform, channel in channels:
        try:
            await db.execute(
                "INSERT INTO live_channels (koop_id, platform, channel) VALUES (?, ?, ?)",
                (koop_id, platform, channel),
            )
        except aiosqlite.IntegrityError as exc:
            await db.rollback()
            raise ChannelBusy(platform, channel) from exc
    await db.execute(
        "INSERT INTO koop_players (koop_id, nickname, player_token) VALUES (?, ?, ?)",
        (koop_id, chat_player_name, chat_token),
    )
    await db.commit()
    room = await get_live_room(db, koop_id)
    if room is None:
        # Committed a line above on this connection; only a concurrent delete
        # of a room id nobody else knows yet could get here.
        raise RuntimeError(f"live room {koop_id} vanished after its insert")
    return room


def _channel_row(row: aiosqlite.Row) -> dict:
    return {
        "platform": row["platform"],
        "channel": row["channel"],
        "chat_state": row["chat_state"],
        "chat_error": row["chat_error"],
        "paused": bool(row["paused"]),
    }


async def _channels_of(db: aiosqlite.Connection, koop_id: str) -> list[dict]:
    """The chats of one room, oldest first. The oldest is the room's first."""
    cursor = await db.execute(
        "SELECT platform, channel, chat_state, chat_error, paused FROM live_channels "
        "WHERE koop_id = ? ORDER BY created_at, rowid",
        (koop_id,),
    )
    return [_channel_row(row) for row in await cursor.fetchall()]


def _room_fields(row: aiosqlite.Row) -> dict:
    return {
        "koop_id": row["koop_id"],
        "host_token": row["host_token"],
        "chat_token": row["chat_token"],
        "require_prefix": bool(row["require_prefix"]),
    }


async def get_live_room(db: aiosqlite.Connection, koop_id: str) -> dict | None:
    cursor = await db.execute("SELECT * FROM live_rooms WHERE koop_id = ?", (koop_id,))
    row = await cursor.fetchone()
    if row is None:
        return None
    return {**_room_fields(row), "channels": await _channels_of(db, koop_id)}


async def list_live_rooms(db: aiosqlite.Connection) -> list[dict]:
    """Every bound room plus its round and chats, for the reader supervisor.

    The round rides along because the supervisor is what notices a new one: it
    already reads this table on a timer, and counting rounds there works whether
    or not the chat happens to be talking at the moment the host clicks on.
    Two reads in all rather than one per room, because this runs every few
    seconds.
    """
    cursor = await db.execute(
        "SELECT lr.*, k.round AS round FROM live_rooms lr "
        "JOIN koops k ON k.id = lr.koop_id ORDER BY lr.created_at"
    )
    rooms: dict[str, dict] = {}
    for raw in await cursor.fetchall():
        rooms[raw["koop_id"]] = {**_room_fields(raw), "round": raw["round"], "channels": []}
    cursor = await db.execute(
        "SELECT koop_id, platform, channel, chat_state, chat_error, paused "
        "FROM live_channels ORDER BY created_at, rowid"
    )
    for row in await cursor.fetchall():
        room = rooms.get(row["koop_id"])
        if room is not None:
            room["channels"].append(_channel_row(row))
    return list(rooms.values())


def aggregate_chat_state(channels: list[dict]) -> str:
    """One state for a room that reads several chats.

    Live as soon as one chat is read, because the round is being played; an
    error only when no chat can be read at all.
    """
    states = {channel["chat_state"] for channel in channels}
    if "live" in states:
        return "live"
    if "connecting" in states:
        return "connecting"
    return "error"


async def _reads_platform(db: aiosqlite.Connection, koop_id: str, platform: str) -> bool:
    cursor = await db.execute(
        "SELECT 1 FROM live_channels WHERE koop_id = ? AND platform = ?",
        (koop_id, platform),
    )
    return await cursor.fetchone() is not None


async def add_live_channel(
    db: aiosqlite.Connection, koop_id: str, platform: str, channel: str
) -> bool:
    """Bind one more chat to a running room. False when the room is not bound.

    Raises PlatformBound when the room already reads this platform and
    ChannelBusy when the channel plays in another room. The insert carries its
    own existence check, so a stop racing the add cannot leave a channel behind
    for a room that no longer exists.
    """
    if await _reads_platform(db, koop_id, platform):
        raise PlatformBound(platform)
    try:
        cursor = await db.execute(
            "INSERT INTO live_channels (koop_id, platform, channel) "
            "SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM live_rooms WHERE koop_id = ?)",
            (koop_id, platform, channel, koop_id),
        )
    except aiosqlite.IntegrityError as exc:
        await db.rollback()
        # Two adds from the same host can race for the platform; the one that
        # lost is told what actually stands in its way.
        if await _reads_platform(db, koop_id, platform):
            raise PlatformBound(platform) from exc
        raise ChannelBusy(platform, channel) from exc
    added = cursor.rowcount == 1
    await db.commit()
    return added


async def remove_live_channel(
    db: aiosqlite.Connection, koop_id: str, platform: str
) -> str:
    """Unbind one chat of a room: ``removed``, ``last_channel`` or ``not_found``.

    A bound room always reads at least one chat; ending the chat altogether is
    the stop. The count is inside the DELETE, so two removes racing for the two
    chats of one room cannot both pass and leave it reading nothing.
    """
    cursor = await db.execute(
        "DELETE FROM live_channels WHERE koop_id = ? AND platform = ? "
        "AND (SELECT COUNT(*) FROM live_channels WHERE koop_id = ?) > 1",
        (koop_id, platform, koop_id),
    )
    if cursor.rowcount:
        await db.commit()
        return "removed"
    return "last_channel" if await _reads_platform(db, koop_id, platform) else "not_found"


async def set_channel_paused(
    db: aiosqlite.Connection, koop_id: str, platform: str, paused: bool
) -> bool:
    """Pause or resume one chat. False when the room does not read that platform.

    The reader stays connected while paused: resuming is then instant, costs no
    reconnect and no TikTok connect budget, and the TikTok cap counts bindings,
    not open sockets. Pausing every chat is allowed, a stream takes breaks.
    Idempotent, and it commits only when it changed a row.
    """
    cursor = await db.execute(
        "UPDATE live_channels SET paused = ? "
        "WHERE koop_id = ? AND platform = ? AND paused IS NOT ?",
        (int(paused), koop_id, platform, int(paused)),
    )
    if cursor.rowcount:
        await db.commit()
        return True
    return await _reads_platform(db, koop_id, platform)


async def _delete_binding_rest(db: aiosqlite.Connection, koop_id: str) -> None:
    """What goes with a room row. Explicit, like the koop cleanup, rather than
    trusting the foreign keys of a file that may predate a REFERENCES clause.
    A note belongs to the binding, not to the koop room that outlives it."""
    await db.execute("DELETE FROM live_channels WHERE koop_id = ?", (koop_id,))
    await db.execute("DELETE FROM live_host_messages WHERE koop_id = ?", (koop_id,))
    await db.execute("DELETE FROM live_events WHERE koop_id = ?", (koop_id,))


async def stop_live_room(db: aiosqlite.Connection, koop_id: str, host_token: str) -> bool:
    """Unbind a room. Only the host may, and the koop room itself stays alive.

    The readers disappear on the supervisor's next pass, and the koop room then
    ages out through the ordinary one-hour rule, so a streamer who stops
    mid-round can still read the board and reveal the word.
    """
    cursor = await db.execute(
        "DELETE FROM live_rooms WHERE koop_id = ? AND host_token = ?",
        (koop_id, host_token),
    )
    stopped = cursor.rowcount > 0
    if stopped:
        await _delete_binding_rest(db, koop_id)
    await db.commit()
    return stopped


async def end_live_room(db: aiosqlite.Connection, koop_id: str) -> bool:
    """Unbind a room on the operator's behalf. No host token, the caller is admin.

    Same effect as the host's own stop: the readers go on the supervisor's
    next pass (which also frees any TikTok socket slot), and the koop room
    stays so the streamer can still reveal the word. False when the room was not bound, so a second click is a no-op.
    """
    cursor = await db.execute("DELETE FROM live_rooms WHERE koop_id = ?", (koop_id,))
    ended = cursor.rowcount > 0
    if ended:
        await _delete_binding_rest(db, koop_id)
    await db.commit()
    return ended


# --- Host presence ----------------------------------------------------------

# How long a bound room may go without its host page before the chat is
# unbound. The page polls every 3 s and a hidden tab still polls about once a
# minute (browsers throttle background timers to that), so five minutes of
# silence means the page is closed, not merely in the background.
HOST_ABSENT_SECONDS = 300

# How often the presence stamp is raised. The host polls every 3 s; writing on
# every poll would take the write lock of a file five workers share twenty
# times a minute per room for a value that only has to be right to the minute.
HOST_TOUCH_SECONDS = 30


async def touch_host(db: aiosqlite.Connection, koop_id: str) -> bool:
    """Record that the host page is open. True when the stamp was raised.

    Guarded in SQL by the stamp's own age, so four API workers that each let a
    call through still write at most once per window between them.
    """
    cursor = await db.execute(
        "UPDATE live_rooms SET host_seen_at = CURRENT_TIMESTAMP WHERE koop_id = ? "
        "AND (host_seen_at IS NULL OR host_seen_at < datetime('now', ?))",
        (koop_id, f"-{HOST_TOUCH_SECONDS} seconds"),
    )
    if cursor.rowcount:
        await db.commit()
        return True
    return False


async def unbind_absent_rooms(
    db: aiosqlite.Connection, absent_seconds: int = HOST_ABSENT_SECONDS
) -> list[dict]:
    """Unbind every room whose host page has not been open for `absent_seconds`.

    The same unbinding as a stop: the chats stop counting, the readers and any
    TikTok socket slot go on the supervisor's next pass, and the koop room stays, so a host who comes back can still reveal the word
    and start a new round. Read first and deleted only when there is something
    to delete, because this runs on every pass of the supervisor and an empty
    DELETE would still take the write lock. The DELETE repeats the age check,
    so a host whose poll lands between the two statements keeps the room.
    """
    window = f"-{int(absent_seconds)} seconds"
    stale = "COALESCE(host_seen_at, created_at) < datetime('now', ?)"
    cursor = await db.execute(f"SELECT koop_id FROM live_rooms WHERE {stale}", (window,))
    candidates = [row["koop_id"] for row in await cursor.fetchall()]
    if not candidates:
        return []
    unbound = []
    for koop_id in candidates:
        channels = await _channels_of(db, koop_id)
        cursor = await db.execute(
            f"DELETE FROM live_rooms WHERE koop_id = ? AND {stale}",
            (koop_id, window),
        )
        if cursor.rowcount:
            await _delete_binding_rest(db, koop_id)
            unbound.append({"koop_id": koop_id, "channels": channels})
    await db.commit()
    return unbound


async def set_chat_state(
    db: aiosqlite.Connection,
    koop_id: str,
    platform: str,
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
        "UPDATE live_channels SET chat_state = ?, chat_error = ? "
        "WHERE koop_id = ? AND platform = ? "
        "AND (chat_state IS NOT ? OR chat_error IS NOT ?)",
        (state, error, koop_id, platform, state, error),
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
    badges: str | None = None,
    solved: bool = False,
) -> bool:
    """Count one accepted guess for a viewer. True when this viewer is new here.

    Three counters per viewer feed the three boards: every accepted guess
    (``hits``), every guess in the near band (``near_hits``) and every round
    this viewer finished (``solves``).

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
        "UPDATE live_viewers SET hits = hits + 1, nickname = ?, badges = ?, "
        "near_hits = near_hits + ?, solves = solves + ?, "
        "best_rank = CASE WHEN best_rank IS NULL OR ? < best_rank THEN ? ELSE best_rank END "
        "WHERE koop_id = ? AND platform = ? AND external_id = ?",
        (
            nickname, badges, int(rank <= NEAR_RANK), int(solved),
            rank, rank, koop_id, platform, external_id,
        ),
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
STREAM_METRICS: tuple[str, ...] = (
    "sessions", "rounds", "guesses", "solves", "viewers",
    "bits", "subs", "gift_subs", "tiktok_diamonds",
)


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
        "guesses, solves, viewers, best_rank, bits, subs, gift_subs, tiktok_diamonds "
        "FROM live_stream_stats "
        "ORDER BY guesses DESC, last_seen DESC LIMIT ?",
        (limit,),
    )
    return [dict(row) for row in await cursor.fetchall()]


async def stream_totals(db: aiosqlite.Connection) -> dict:
    """One line for the dashboard header: how big is this mode overall."""
    cursor = await db.execute(
        "SELECT COUNT(*) AS channels, COALESCE(SUM(sessions), 0) AS sessions, "
        "COALESCE(SUM(rounds), 0) AS rounds, COALESCE(SUM(guesses), 0) AS guesses, "
        "COALESCE(SUM(solves), 0) AS solves, COALESCE(SUM(viewers), 0) AS viewers, "
        "COALESCE(SUM(bits), 0) AS bits, COALESCE(SUM(subs), 0) AS subs, "
        "COALESCE(SUM(gift_subs), 0) AS gift_subs, "
        "COALESCE(SUM(tiktok_diamonds), 0) AS tiktok_diamonds "
        "FROM live_stream_stats"
    )
    row = await cursor.fetchone()
    return dict(row) if row else {
        "channels": 0, "sessions": 0, "rounds": 0, "guesses": 0, "solves": 0,
        "viewers": 0, "bits": 0, "subs": 0, "gift_subs": 0, "tiktok_diamonds": 0,
    }


async def active_streams(
    db: aiosqlite.Connection, guess_limit: int = 5
) -> list[dict]:
    """The rooms bound right now, for the live sections of the dashboard.

    Carries the last few guesses so the operator can read along, but never the
    game number or the target word: nothing on the admin side needs them, and a
    payload that does not hold the answer cannot leak it.
    """
    cursor = await db.execute(
        "SELECT lr.koop_id, lr.created_at, "
        "k.last_activity, k.round, k.best_rank, k.solved, k.gave_up, "
        "(SELECT COUNT(*) FROM live_viewers lv WHERE lv.koop_id = lr.koop_id) AS viewers, "
        "(SELECT COUNT(*) FROM koop_guesses kg WHERE kg.koop_id = lr.koop_id) AS guesses "
        "FROM live_rooms lr JOIN koops k ON k.id = lr.koop_id "
        "ORDER BY lr.created_at DESC"
    )
    streams = []
    for row in await cursor.fetchall():
        stream = dict(row)
        stream["created_at"] = sqlite_utc(stream["created_at"])
        stream["last_activity"] = sqlite_utc(stream["last_activity"])
        stream["solved"] = bool(stream["solved"])
        stream["gave_up"] = bool(stream["gave_up"])
        guesses = await db.execute(
            "SELECT nickname, word, rank FROM koop_guesses WHERE koop_id = ? "
            "ORDER BY id DESC LIMIT ?",
            (stream["koop_id"], guess_limit),
        )
        stream["recent_guesses"] = [dict(g) for g in await guesses.fetchall()]
        stream["channels"] = [
            {
                "platform": channel["platform"],
                "channel": channel["channel"],
                "chat_state": channel["chat_state"],
                "paused": channel["paused"],
            }
            for channel in await _channels_of(db, stream["koop_id"])
        ]
        streams.append(stream)
    return streams


# --- Notes from the operator to the streamer --------------------------------


def sqlite_utc(raw: str | None) -> str | None:
    """SQLite's CURRENT_TIMESTAMP (``YYYY-MM-DD HH:MM:SS``, UTC) as ISO 8601.

    The stored form carries no zone, and a browser parses a zoneless date-time
    as local time, which would put every time on the dashboard two hours off
    in summer. The marker is added here, once, on the way out.
    """
    if not raw:
        return None
    return f"{raw.replace(' ', 'T', 1)}Z" if not raw.endswith("Z") else raw

# One short line, the length of a chat message: a thank-you, not a letter.
HOST_MESSAGE_MAX_CHARS = 280

# Unseen notes one room may hold. The host page shows them one after another,
# so a double-clicked send or a stuck host tab cannot pile up a queue that then
# plays for a minute.
HOST_MESSAGE_MAX_PENDING = 5

# Control characters become a space (a pasted line break or tab separates two
# words). The invisible ones (zero-width space and joiners, word joiner, bidi
# overrides, BOM) are removed outright, because they sit inside a word and
# would let a pasted line render differently from what the operator saw.
_CONTROL = re.compile(r"[\x00-\x1f\x7f-\x9f]")
_INVISIBLE = re.compile(r"[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]")


class TooManyPending(Exception):
    """The room already holds HOST_MESSAGE_MAX_PENDING unseen notes."""


def normalise_host_message(raw: str | None) -> str | None:
    """The note as it will be shown, or None when there is nothing to send.

    NFC first, so the length cap counts what a reader sees and not how the
    input method composed it. Line breaks collapse into spaces: the banner is
    one short paragraph.
    """
    if raw is None:
        return None
    text = unicodedata.normalize("NFC", raw)
    text = _INVISIBLE.sub("", _CONTROL.sub(" ", text))
    text = " ".join(text.split())
    if not text or len(text) > HOST_MESSAGE_MAX_CHARS:
        return None
    return text


async def send_host_message(
    db: aiosqlite.Connection, koop_id: str, body: str
) -> int | None:
    """Queue a note for the host of a bound room. None when the room is not bound.

    The existence check and the insert are one statement, so a stop racing the
    send cannot leave a note behind for a binding that no longer exists. The
    pending cap is read first and is advisory: two sends racing for the last
    slot both pass, which costs one note over a cap that only exists to stop a
    runaway.
    """
    cursor = await db.execute(
        "SELECT COUNT(*) AS n FROM live_host_messages WHERE koop_id = ? AND seen_at IS NULL",
        (koop_id,),
    )
    row = await cursor.fetchone()
    if row["n"] >= HOST_MESSAGE_MAX_PENDING:
        raise TooManyPending(koop_id)
    cursor = await db.execute(
        "INSERT INTO live_host_messages (koop_id, body) "
        "SELECT ?, ? WHERE EXISTS (SELECT 1 FROM live_rooms WHERE koop_id = ?)",
        (koop_id, body, koop_id),
    )
    await db.commit()
    return cursor.lastrowid if cursor.rowcount == 1 else None


async def pending_host_messages(db: aiosqlite.Connection, koop_id: str) -> list[dict]:
    """The unseen notes of a room, oldest first, in the order they are shown."""
    cursor = await db.execute(
        "SELECT id, body, created_at FROM live_host_messages "
        "WHERE koop_id = ? AND seen_at IS NULL ORDER BY id",
        (koop_id,),
    )
    return [
        {"id": row["id"], "text": row["body"], "sent_at": sqlite_utc(row["created_at"])}
        for row in await cursor.fetchall()
    ]


async def mark_host_messages_seen(
    db: aiosqlite.Connection, koop_id: str, up_to_id: int
) -> int:
    """Mark every note of this room up to ``up_to_id`` as shown.

    Guarded by ``seen_at IS NULL``, so a repeated ack (a retry, a second host
    tab) changes nothing and keeps the first time stamp. Commits only when it
    wrote, for the same reason ``set_chat_state`` does.
    """
    cursor = await db.execute(
        "UPDATE live_host_messages SET seen_at = CURRENT_TIMESTAMP "
        "WHERE koop_id = ? AND id <= ? AND seen_at IS NULL",
        (koop_id, up_to_id),
    )
    if cursor.rowcount:
        await db.commit()
    return cursor.rowcount


async def recent_host_messages(
    db: aiosqlite.Connection, koop_ids: list[str], limit: int = 5
) -> dict[str, list[dict]]:
    """The latest notes per room with their delivery state, for the dashboard."""
    result: dict[str, list[dict]] = {koop_id: [] for koop_id in koop_ids}
    for koop_id in koop_ids:
        cursor = await db.execute(
            "SELECT id, body, created_at, seen_at FROM live_host_messages "
            "WHERE koop_id = ? ORDER BY id DESC LIMIT ?",
            (koop_id, limit),
        )
        result[koop_id] = [
            {
                "id": row["id"],
                "text": row["body"],
                "sent_at": sqlite_utc(row["created_at"]),
                "seen_at": sqlite_utc(row["seen_at"]),
            }
            for row in await cursor.fetchall()
        ]
    return result


async def reset_viewers(db: aiosqlite.Connection, koop_id: str) -> None:
    """Clear the leaderboard. Not called per round, see top_viewers."""
    await db.execute("DELETE FROM live_viewers WHERE koop_id = ?", (koop_id,))
    await db.commit()


# The rank up to which a guess counts as near, the green band of the colour
# scale (frontend/lib/types.ts). The "Treffsicher" board counts these.
NEAR_RANK = 300

# The three leaderboards and what orders them. Hits break every tie, then the
# best rank, so two viewers with one solve each are told apart by who played
# more. A closed map, because the key reaches an ORDER BY.
VIEWER_BOARDS: dict[str, str] = {
    "busy": "hits DESC, (best_rank IS NULL), best_rank ASC",
    "sharp": "near_hits DESC, (best_rank IS NULL), best_rank ASC, hits DESC",
    "finders": "solves DESC, near_hits DESC, (best_rank IS NULL), best_rank ASC",
}


async def top_viewers(
    db: aiosqlite.Connection, koop_id: str, limit: int = 5, board: str = "busy"
) -> list[dict]:
    """One leaderboard, counted over the whole stream and not per round.

    A stream plays many rounds in one sitting, and the interesting question
    there is who carried the evening, not who carried the last eight minutes.
    ``busy`` asks who played most, ``sharp`` who guessed close most often and
    ``finders`` who found the most words; the last two leave out anybody with
    nothing to show on them. Somebody who plays on two platforms is two
    entries, because the platforms share no identity; the platform rides
    along so the views can tell the two apart.
    """
    order = VIEWER_BOARDS[board]
    where = {"busy": "", "sharp": " AND near_hits > 0", "finders": " AND solves > 0"}[board]
    cursor = await db.execute(
        "SELECT platform, nickname, hits, near_hits, solves, best_rank, badges "
        f"FROM live_viewers WHERE koop_id = ?{where} ORDER BY {order} LIMIT ?",
        (koop_id, limit),
    )
    return [
        {
            "platform": row["platform"],
            "nickname": row["nickname"],
            "hits": row["hits"],
            "near_hits": row["near_hits"],
            "solves": row["solves"],
            "best_rank": row["best_rank"],
            "badges": row["badges"],
        }
        for row in await cursor.fetchall()
    ]


async def viewer_boards(db: aiosqlite.Connection, koop_id: str, limit: int = 5) -> dict:
    """All three boards, keyed like VIEWER_BOARDS."""
    return {board: await top_viewers(db, koop_id, limit, board) for board in VIEWER_BOARDS}


# --- Paid support, stored -----------------------------------------------------

# Per-channel totals an event raises, by kind.
_EVENT_METRIC: dict[str, str] = {
    "cheer": "bits",
    "sub": "subs",
    "resub": "subs",
    "upgrade": "subs",
    "gift_sub": "gift_subs",
    "gift_bomb": "gift_subs",
    "tiktok_gift": "tiktok_diamonds",
    "tiktok_chest": "tiktok_diamonds",
    "tiktok_sub": "subs",
}

# How long an event stays readable. The host page shows the last twenty; a
# day covers the longest stream and keeps the table small.
EVENT_RETENTION_HOURS = 24

# The most events one poll returns. The page shows twenty, and a host whose
# tab slept through a sub train should not get a thousand banners on return.
EVENTS_PER_POLL = 20


async def record_paid_event(
    db: aiosqlite.Connection, koop_id: str, channel: str, event: PaidEvent, actor: str
) -> int | None:
    """Store one paid event for a room. Returns its id, None for a duplicate.

    The unique key is the platform's own message id, so a frame seen twice is
    an INSERT OR IGNORE that changes nothing, and the channel's totals are
    raised only when the row was new. One transaction for both, because a
    total without its row (or the reverse) would count a gift twice after a
    retry. ``actor`` is the display name after the nickname rule.
    """
    cursor = await db.execute(
        "INSERT OR IGNORE INTO live_events "
        "(koop_id, platform, event_id, kind, actor, badges, amount, tier, months, "
        "gift_name, gift_count, gift_image) "
        "SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? "
        "WHERE EXISTS (SELECT 1 FROM live_rooms WHERE koop_id = ?)",
        (
            koop_id, event.platform, event.event_id, event.kind, actor,
            encode_badges(event.badges), event.amount, event.tier, event.months,
            event.gift_name, event.gift_count, event.gift_image, koop_id,
        ),
    )
    if cursor.rowcount != 1:
        return None
    event_row_id = cursor.lastrowid
    amount = event.amount if event.kind in ("cheer", "gift_bomb", "tiktok_gift", "tiktok_chest") else 1
    await record_stream_event(
        db, event.platform, channel, _EVENT_METRIC[event.kind], amount=amount, commit=False,
    )
    await db.commit()
    return event_row_id


async def events_after(
    db: aiosqlite.Connection, koop_id: str, after_id: int, limit: int = EVENTS_PER_POLL
) -> list[dict]:
    """The events of a room newer than ``after_id``, oldest first.

    ``after_id = 0`` is a page that just opened: it gets the newest ``limit``,
    which fill the feed, and the page decides which of them it still
    celebrates.
    """
    cursor = await db.execute(
        "SELECT * FROM (SELECT id, platform, kind, actor, badges, amount, tier, months, "
        "gift_name, gift_count, gift_image, created_at FROM live_events "
        "WHERE koop_id = ? AND id > ? ORDER BY id DESC LIMIT ?) ORDER BY id",
        (koop_id, after_id, limit),
    )
    return [
        {**dict(row), "created_at": sqlite_utc(row["created_at"])}
        for row in await cursor.fetchall()
    ]


async def prune_events(db: aiosqlite.Connection) -> int:
    """Drop events older than the retention window. Commits only when it wrote."""
    cursor = await db.execute(
        "DELETE FROM live_events WHERE created_at < datetime('now', ?)",
        (f"-{EVENT_RETENTION_HOURS} hours",),
    )
    if cursor.rowcount:
        await db.commit()
    return cursor.rowcount
