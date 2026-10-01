from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

import categories as category_catalogue

# Which puzzle a new room is opened on. The client picks the kind, never the
# number: handing the number in would hand the creator the answer, because
# /api/reveal serves it to anybody who asks. See rooms.py.
RoomGameSource = Literal["today", "random"]


class CategoryInfo(BaseModel):
    """A field as a response names it: the id for code, the name for people."""
    id: str
    name: str


class CategoryEntry(CategoryInfo):
    # Playable games a filter on this field can draw.
    count: int


class CategoriesResponse(BaseModel):
    categories: list[CategoryEntry]


class RoomCategoryOptions(BaseModel):
    """The category part of every room a player creates (categories.py).

    ``categories`` narrows the draw to those fields, empty means every field.
    ``show_category`` puts the round's field above the board for everybody in
    the room, which is what keeps it fair: one player cannot see it alone.

    Neither goes with the daily. Its puzzle is the same for everyone and is
    drawn from no field, and the daily never shows one.
    """

    categories: list[str] = Field(default_factory=list, max_length=64)
    show_category: bool = False

    @field_validator("categories")
    @classmethod
    def _known_fields(cls, value: list[str]) -> list[str]:
        try:
            chosen = category_catalogue.get_categories().parse(value)
        except category_catalogue.CategoryError as exc:
            raise ValueError(str(exc)) from exc
        return category_catalogue.get_categories().ordered(chosen)

    @model_validator(mode="after")
    def _not_with_the_daily(self):
        source = getattr(self, "game_source", "random")
        if source == "today" and (self.categories or self.show_category):
            raise ValueError("categories apply to a random game, never to the daily")
        return self


class RoomCategoryState(BaseModel):
    """What every room state says about its fields. Never the game number."""
    categories: list[str] = []
    show_category: bool = False
    # The round's field, only when the room shows it, else None.
    category: CategoryInfo | None = None


class GuessRequest(BaseModel):
    word: str = Field(..., min_length=1, max_length=100)
    # Set on the first guess of a game so the server can count a started game.
    # A hint only: the count is deduplicated per visitor, mode and game anyway.
    first: bool = False


class GuessResponse(BaseModel):
    word: str
    rank: int
    total: int
    # Set when the guess was a typo that had exactly one plausible correction:
    # what the player typed, so the client can say which word was actually scored.
    corrected_from: str | None = None


class ErrorResponse(BaseModel):
    error: str
    message: str
    # Only on "unknown_word": words the guess might have meant, for the player
    # to pick from when the correction was too ambiguous to apply by itself.
    suggestions: list[str] = []


class TipResponse(BaseModel):
    word: str
    rank: int


class GameInfoResponse(BaseModel):
    gameNumber: int
    date: str
    total: int
    # Lowest game number that follows the current pool rules. The archive still
    # serves the games below it, the post-round rating does not ask about them.
    firstCuratedGame: int


class RevealResponse(BaseModel):
    word: str


class PastGameEntry(BaseModel):
    gameNumber: int
    date: str


class PastGamesResponse(BaseModel):
    games: list[PastGameEntry]
    todayGame: int


class ClosestWordEntry(BaseModel):
    word: str
    rank: int


class ClosestWordsResponse(BaseModel):
    words: list[ClosestWordEntry]
    gameNumber: int


class InfiniteNextResponse(BaseModel):
    gameNumber: int
    total: int
    totalGames: int
    # The field of the drawn game, or None when it has none. The solo number
    # is already open (reveal, closest), so naming its field opens nothing.
    category: CategoryInfo | None = None


# --- Solo modes (Leiter, Limitierte Versuche, Doppelziel, Sudden Death) ---


class WordAtRankResponse(BaseModel):
    """The word at one exact rank. Rank 1 is never served here."""
    word: str
    rank: int
    gameNumber: int


class DualNextResponse(BaseModel):
    """The two independent targets of a Doppelziel round."""
    gameNumbers: list[int]
    total: int
    totalGames: int


class DualRankEntry(BaseModel):
    gameNumber: int
    rank: int


class DualGuessResponse(BaseModel):
    word: str
    ranks: list[DualRankEntry]
    total: int
    # Set when the guess was a typo that had exactly one plausible correction:
    # what the player typed, so the client can say which word was actually scored.
    corrected_from: str | None = None


class SuddenDeathResponse(BaseModel):
    """A game plus its runners-up. The player gets one attempt at rank 1."""
    gameNumber: int
    total: int
    hints: list[ClosestWordEntry]


class NextGameRequest(BaseModel):
    """Body for the multiplayer "Nächstes Spiel" endpoints (koop/duel/wordle-duel)."""
    player_token: str


class NextGameResponse(BaseModel):
    """The answer to the rematch button. It names the round, not the puzzle.

    The client needs a signal to wipe its board on, and the round counter is
    that signal. The new game number stays on the server until the round is
    over, for the reason in rooms.py.
    """
    round: int
    total: int
    # The new round's field, when the room shows it.
    category: CategoryInfo | None = None


class RoomRevealRequest(BaseModel):
    player_token: str


class RoomRevealResponse(BaseModel):
    """The solution of a finished round, plus the number it was played on."""
    word: str
    game_number: int
    round: int


class CreateDuelRequest(RoomCategoryOptions):
    # extra="forbid" so a stale client that still sends game_number is told no,
    # rather than being quietly served a server-picked game it cannot explain.
    model_config = ConfigDict(extra="forbid")

    game_source: RoomGameSource = "random"
    nickname: str = Field(..., min_length=1, max_length=20)
    tips_allowed: bool = True


class CreateDuelResponse(BaseModel):
    duel_id: str
    player_token: str


class JoinDuelRequest(BaseModel):
    nickname: str = Field(..., min_length=1, max_length=20)


class DuelPlayerInfo(BaseModel):
    nickname: str
    best_rank: int | None
    guess_count: int
    tip_count: int
    solved: bool
    connected: bool


class DuelStateResponse(RoomCategoryState):
    duel_id: str
    # No game_number: see rooms.py. The round counter is what the client keys
    # its board resets on.
    round: int
    tips_allowed: bool
    players: list[DuelPlayerInfo]


class JoinDuelResponse(RoomCategoryState):
    player_token: str
    duel_id: str
    round: int
    tips_allowed: bool
    players: list[DuelPlayerInfo]


class DuelGuessRequest(BaseModel):
    word: str = Field(..., min_length=1, max_length=100)
    player_token: str


class DuelGuessHistoryEntry(BaseModel):
    word: str
    rank: int
    guessed_at: str


class DuelGuessHistoryResponse(BaseModel):
    guesses: list[DuelGuessHistoryEntry]


# --- Koop (cooperative Kontexto) ---


class CreateKoopRequest(RoomCategoryOptions):
    model_config = ConfigDict(extra="forbid")

    game_source: RoomGameSource = "random"
    nickname: str = Field(..., min_length=1, max_length=20)
    tips_allowed: bool = True


class CreateKoopResponse(BaseModel):
    koop_id: str
    player_token: str


class JoinKoopRequest(BaseModel):
    nickname: str = Field(..., min_length=1, max_length=20)


class KoopPlayerInfo(BaseModel):
    nickname: str
    contribution_count: int
    connected: bool


class KoopStateResponse(RoomCategoryState):
    koop_id: str
    # No game_number while the round is open: see rooms.py.
    round: int
    tips_allowed: bool
    solved: bool
    solved_by: str | None
    gave_up: bool
    best_rank: int | None
    total: int
    players: list[KoopPlayerInfo]


class JoinKoopResponse(KoopStateResponse):
    player_token: str
    nickname: str


class KoopGuessRequest(BaseModel):
    word: str = Field(..., min_length=1, max_length=100)
    player_token: str


class KoopGiveUpRequest(BaseModel):
    player_token: str


class KoopGiveUpResponse(BaseModel):
    """Giving up ends the round for the whole team, so the number comes too."""
    word: str
    game_number: int
    round: int


class KoopGuessResponse(BaseModel):
    word: str
    rank: int
    total: int
    already_guessed: bool
    # Set when the guess was a typo that had exactly one plausible correction:
    # what the player typed, so the client can say which word was actually scored.
    corrected_from: str | None = None


class LiveBadge(BaseModel):
    """One chat badge as the platform names it (``moderator``, ``1``)."""

    set_id: str
    version: str


class KoopGuessEntry(BaseModel):
    nickname: str
    word: str
    rank: int
    is_tip: bool
    guessed_at: str
    # Live rooms only: the chat a guess came from and its author's badges.
    source: str | None = None
    badges: list[LiveBadge] = []


class KoopGuessesResponse(BaseModel):
    guesses: list[KoopGuessEntry]


# --- Live chat (a stream chat plays a koop round) ---


LivePlatformName = Literal["twitch", "tiktok"]


class LiveChannelRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    platform: LivePlatformName
    # A channel name, a handle or a pasted URL; the server normalises it and
    # refuses anything the platform could not have as a login.
    channel: str = Field(..., min_length=1, max_length=120)


class CreateLiveRequest(RoomCategoryOptions):
    model_config = ConfigDict(extra="forbid")

    # The chats this room reads, at most one per platform (two platforms).
    channels: list[LiveChannelRequest] | None = Field(default=None, min_length=1, max_length=2)
    # The single-chat form. A create page loaded before rooms could read two
    # chats still sends it, so it is folded into `channels` instead of refused.
    platform: LivePlatformName | None = None
    channel: str | None = Field(default=None, min_length=1, max_length=120)
    game_source: RoomGameSource = "random"
    # Optional, and normally absent. The streamer already has a name on screen,
    # their channel, and asking for a second one would be a field that exists
    # only to be filled in. It stays available for the rare host who wants to
    # appear under something else than the channel they are streaming to.
    nickname: str | None = Field(default=None, min_length=1, max_length=20)
    tips_allowed: bool = True
    # Free guessing is the default: every word of every chat line counts. A
    # streamer with a busy chat turns this on and only lines after `!k` count.
    require_prefix: bool = False

    @model_validator(mode="after")
    def _one_channel_list(self) -> "CreateLiveRequest":
        if self.channels is None:
            if self.channel is None:
                raise ValueError("channels is required")
            self.channels = [
                LiveChannelRequest(platform=self.platform or "twitch", channel=self.channel)
            ]
        elif self.platform is not None or self.channel is not None:
            raise ValueError("send either channels or platform and channel, not both")
        platforms = [entry.platform for entry in self.channels]
        if len(set(platforms)) != len(platforms):
            raise ValueError("one channel per platform")
        return self

    def channel_list(self) -> list[LiveChannelRequest]:
        """The chats as the validator left them: never None past validation."""
        return self.channels or []


class LiveChannelAddRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    player_token: str = Field(..., min_length=1, max_length=128)
    platform: LivePlatformName
    channel: str = Field(..., min_length=1, max_length=120)


class LiveChannelRemoveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    player_token: str = Field(..., min_length=1, max_length=128)
    platform: LivePlatformName


class LiveChannelPauseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    player_token: str = Field(..., min_length=1, max_length=128)
    platform: LivePlatformName
    paused: bool


class LiveViewer(BaseModel):
    # Which chat this viewer plays in. The same name on two platforms is two
    # people as far as the game can know.
    platform: str
    nickname: str
    hits: int
    near_hits: int = 0
    solves: int = 0
    best_rank: int | None
    badges: list[LiveBadge] = []


class LiveViewerBoards(BaseModel):
    """The three leaderboards, counted over the whole stream."""

    busy: list[LiveViewer] = []
    sharp: list[LiveViewer] = []
    finders: list[LiveViewer] = []


class LiveEvent(BaseModel):
    """Paid support read out of a chat. Celebrated on the host page, never played."""

    id: int
    platform: str
    kind: str
    actor: str
    badges: list[LiveBadge] = []
    amount: int
    tier: str | None = None
    months: int | None = None
    gift_name: str | None = None
    gift_count: int | None = None
    gift_image: str | None = None
    created_at: str | None = None


class LiveBadgePicture(BaseModel):
    """Twitch's own picture for one badge code, resolved server side."""

    title: str
    image: str
    image_2x: str


class LiveChannelState(BaseModel):
    """One chat of a room as the host sees it."""

    platform: str
    channel: str
    chat_state: str
    chat_error: str | None = None
    paused: bool = False


class LiveHostMessage(BaseModel):
    """A note from the operator, waiting to be shown on the host page."""

    id: int
    text: str
    sent_at: str


class LiveRoomResponse(BaseModel):
    """What the host sees about the chat connections. No puzzle data at all."""

    koop_id: str
    # Every chat the room reads, oldest first.
    channels: list[LiveChannelState]
    # The oldest chat once more, flat. A host page loaded before rooms could
    # read two chats keeps polling for hours, through a deploy, and reads these.
    platform: str
    channel: str
    chat_state: str
    chat_error: str | None = None
    require_prefix: bool
    # The "busy" board once more, flat, for host pages loaded before there
    # were three.
    top: list[LiveViewer] = []
    boards: LiveViewerBoards = LiveViewerBoards()
    # Unseen operator notes, oldest first.
    messages: list[LiveHostMessage] = []
    # Paid support newer than the poll's `events_after`, oldest first.
    events: list[LiveEvent] = []
    # Twitch pictures for every badge code this room has shown, keyed
    # `set/version`. Codes without a picture are absent; the page draws its own.
    badge_catalog: dict[str, LiveBadgePicture] = {}


class CreateLiveResponse(LiveRoomResponse):
    player_token: str


class LivePlatformsResponse(BaseModel):
    """Which platforms can be bound right now. TikTok needs the operator's key."""

    platforms: list[str]


class LiveStopRequest(BaseModel):
    player_token: str


class LiveStopResponse(BaseModel):
    stopped: bool


class LiveMessagesSeenRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    player_token: str = Field(..., min_length=1, max_length=128)
    up_to_id: int = Field(..., ge=1)


class LiveMessagesSeenResponse(BaseModel):
    marked: int


class AdminHostMessageRequest(BaseModel):
    """A note to a streamer. Length is checked after normalisation, in live_chat."""

    model_config = ConfigDict(extra="forbid")

    text: str = Field(..., min_length=1, max_length=2000)


class AdminHostMessageResponse(BaseModel):
    id: int


class AdminHostMessageEntry(BaseModel):
    id: int
    text: str
    sent_at: str
    seen_at: str | None


class AdminStreamGuess(BaseModel):
    nickname: str
    word: str
    rank: int


class AdminStreamChannel(BaseModel):
    platform: str
    channel: str
    chat_state: str
    paused: bool


class AdminLiveStream(BaseModel):
    """One bound room as the operator reads along. No game number, no target."""

    koop_id: str
    channels: list[AdminStreamChannel]
    created_at: str | None
    # The koop room's own clock: raised by every guess, chat or host.
    last_activity: str | None
    round: int
    best_rank: int | None
    solved: bool
    gave_up: bool
    viewers: int
    guesses: int
    recent_guesses: list[AdminStreamGuess]
    messages: list[AdminHostMessageEntry]


class AdminLiveStreamsResponse(BaseModel):
    server_time: str
    streams: list[AdminLiveStream]


class LiveDebugMessageRequest(BaseModel):
    """One faked chat line, for the end-to-end suite. See main.py."""

    model_config = ConfigDict(extra="forbid")

    external_id: str = Field(..., min_length=1, max_length=64)
    display_name: str = Field(..., min_length=1, max_length=64)
    text: str = Field(..., min_length=1, max_length=500)
    # Which chat the line arrives on. Absent means the room's oldest chat.
    platform: LivePlatformName | None = None
    # The author's platform login. Set it to the bound channel to speak as the
    # streamer, which is what the stop command needs.
    login: str = Field("", max_length=64)
    # The author's badges in the IRC form, `moderator/1,subscriber/12`.
    badges: str = Field("", max_length=200)


class LiveDebugEventRequest(BaseModel):
    """One faked paid event, for the end-to-end suite. See main.py."""

    model_config = ConfigDict(extra="forbid")

    kind: str = Field(..., min_length=1, max_length=20)
    event_id: str = Field(..., min_length=1, max_length=64)
    display_name: str = Field(..., min_length=1, max_length=64)
    external_id: str = Field("debug", min_length=1, max_length=64)
    amount: int = Field(1, ge=1, le=10_000_000)
    tier: str | None = Field(None, max_length=10)
    months: int | None = Field(None, ge=1, le=1200)
    gift_name: str | None = Field(None, max_length=40)
    gift_count: int | None = Field(None, ge=1)
    platform: LivePlatformName | None = None
    badges: str = Field("", max_length=200)


# --- Arenas (Battle Royale, Blitz-Duell, Zeitbonus-Jagd) ---


class CreateArenaRequest(RoomCategoryOptions):
    model_config = ConfigDict(extra="forbid")

    mode: str = Field(..., pattern="^(royale|blitz|timerush)$")
    # An arena has always drawn a random game rather than the daily, so that an
    # invited friend is not spoiled. The selector keeps that the default.
    game_source: RoomGameSource = "random"
    nickname: str = Field(..., min_length=1, max_length=20)


class CreateArenaResponse(BaseModel):
    arena_id: str
    player_token: str
    mode: str


class JoinArenaRequest(BaseModel):
    nickname: str = Field(..., min_length=1, max_length=20)


class ArenaPlayerInfo(BaseModel):
    nickname: str
    best_rank: int | None
    guess_count: int
    solved: bool
    connected: bool
    # The personal clock of this player; only Zeitbonus-Jagd fills it.
    deadline_at: str | None
    eliminated: bool
    place: int | None


class ArenaStateResponse(RoomCategoryState):
    arena_id: str
    mode: str
    # No game_number while the round is open: see rooms.py.
    status: str
    phase: int
    # Absolute UTC deadline of the shared clock, or null when there is none.
    deadline_at: str | None
    winner: str | None
    round: int
    # The server's clock at the moment of this read, so a client can correct its
    # own before rendering a countdown.
    server_time: str
    players: list[ArenaPlayerInfo]


class JoinArenaResponse(ArenaStateResponse):
    player_token: str


class ArenaTokenRequest(BaseModel):
    player_token: str


class ArenaGuessRequest(BaseModel):
    word: str = Field(..., min_length=1, max_length=100)
    player_token: str


class ArenaGuessResponse(BaseModel):
    word: str
    rank: int
    total: int
    deadline_at: str | None
    finished: bool
    # Set when the guess was a typo that had exactly one plausible correction:
    # what the player typed, so the client can say which word was actually scored.
    corrected_from: str | None = None


# --- Matchmaking ---


class MatchmakingEnqueueRequest(BaseModel):
    mode: str = Field(..., pattern="^(duel|koop|wordle_duel|royale|blitz|timerush)$")
    # Optional: without one, or with one the filter rejects, the server assigns a
    # neutral generated name. Strangers read this, so it is not free text.
    nickname: str | None = Field(None, max_length=40)


class PartyRuleFields(BaseModel):
    """When a round of this mode starts. Read straight from PARTY_RULES, so the
    waiting screen can state the rule instead of guessing at it."""
    # Below this many players nothing starts.
    min_players: int
    # At this many it starts at once, without waiting out the grace period.
    max_players: int
    # How long a party smaller than max_players waits for more before starting.
    grace_seconds: int


class MatchmakingTicketResponse(PartyRuleFields):
    ticket: str
    mode: str
    nickname: str


class MatchmakingStatusResponse(PartyRuleFields):
    mode: str
    nickname: str
    matched: bool
    room_id: str | None
    player_token: str | None
    # How many players are queued for this mode right now.
    waiting: int


class MatchmakingCancelRequest(BaseModel):
    ticket: str = Field(..., min_length=8, max_length=200)


class ModeLoad(BaseModel):
    """How busy one mode is right now."""
    # Players queued for this mode and not yet matched.
    waiting: int
    # Players connected to a live room of this mode, invite links included.
    playing: int


class PopularModesResponse(BaseModel):
    """Which mode leads each tab of the picker over the last `window_days`.

    A group is null while too few people have picked anything there, and while
    its leader is tied with the runner-up. The client shows no badge then, which
    is the whole point of the field being nullable rather than a best guess.
    """
    solo: str | None = None
    friends: str | None = None
    strangers: str | None = None
    window_days: int


class MatchmakingLiveResponse(BaseModel):
    """The picker's answer to "is anybody there", before a ticket exists.

    Every queue mode is a key, so a mode nobody is playing reads as a zero
    rather than as a gap the client has to interpret.
    """
    modes: dict[str, ModeLoad]
    waiting_total: int
    playing_total: int
