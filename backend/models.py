from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Which puzzle a new room is opened on. The client picks the kind, never the
# number: handing the number in would hand the creator the answer, because
# /api/reveal serves it to anybody who asks. See rooms.py.
RoomGameSource = Literal["today", "random"]


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


class RoomRevealRequest(BaseModel):
    player_token: str


class RoomRevealResponse(BaseModel):
    """The solution of a finished round, plus the number it was played on."""
    word: str
    game_number: int
    round: int


class CreateDuelRequest(BaseModel):
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


class DuelStateResponse(BaseModel):
    duel_id: str
    # No game_number: see rooms.py. The round counter is what the client keys
    # its board resets on.
    round: int
    tips_allowed: bool
    players: list[DuelPlayerInfo]


class JoinDuelResponse(BaseModel):
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


class CreateKoopRequest(BaseModel):
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


class KoopStateResponse(BaseModel):
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


class KoopGuessEntry(BaseModel):
    nickname: str
    word: str
    rank: int
    is_tip: bool
    guessed_at: str


class KoopGuessesResponse(BaseModel):
    guesses: list[KoopGuessEntry]


# --- Live chat (a stream chat plays a koop round) ---


class CreateLiveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    platform: Literal["twitch"] = "twitch"
    # A channel name, a handle or a pasted URL; the server normalises it and
    # refuses anything the platform could not have as a login.
    channel: str = Field(..., min_length=1, max_length=120)
    game_source: RoomGameSource = "random"
    # Optional, and normally absent. The streamer already has a name on screen,
    # their channel, and asking for a second one would be a field that exists
    # only to be filled in. It stays available for the rare host who wants to
    # appear under something else than the channel they are streaming to.
    nickname: str | None = Field(default=None, min_length=1, max_length=20)
    tips_allowed: bool = True
    # Free guessing is the default: a single word in chat counts. A streamer with
    # a busy chat turns this on and only `!k wort` counts.
    require_prefix: bool = False


class LiveViewer(BaseModel):
    nickname: str
    hits: int
    best_rank: int | None


class LiveRoomResponse(BaseModel):
    """What the host sees about the chat connection. No puzzle data at all."""

    koop_id: str
    platform: str
    channel: str
    require_prefix: bool
    chat_state: str
    chat_error: str | None = None
    overlay_token: str
    top: list[LiveViewer] = []


class CreateLiveResponse(LiveRoomResponse):
    player_token: str


class LiveStopRequest(BaseModel):
    player_token: str


class LiveStopResponse(BaseModel):
    stopped: bool


class LiveOverlayGuess(BaseModel):
    nickname: str
    word: str
    rank: int
    is_tip: bool


class LiveOverlayResponse(BaseModel):
    """The OBS overlay's whole world.

    Deliberately without `game_number` and without the target word: this view is
    on a public stream, and the number is the answer (see rooms.py).
    """

    round: int
    best_rank: int | None
    total: int
    solved: bool
    solved_by: str | None
    gave_up: bool
    chat_state: str
    channel: str | None
    recent: list[LiveOverlayGuess]
    top: list[LiveViewer]


class LiveDebugMessageRequest(BaseModel):
    """One faked chat line, for the end-to-end suite. See main.py."""

    model_config = ConfigDict(extra="forbid")

    external_id: str = Field(..., min_length=1, max_length=64)
    display_name: str = Field(..., min_length=1, max_length=64)
    text: str = Field(..., min_length=1, max_length=500)


# --- Arenas (Battle Royale, Blitz-Duell, Zeitbonus-Jagd) ---


class CreateArenaRequest(BaseModel):
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


class ArenaStateResponse(BaseModel):
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
