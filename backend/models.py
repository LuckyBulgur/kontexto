from pydantic import BaseModel, Field


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
    game_number: int
    total: int


class CreateDuelRequest(BaseModel):
    game_number: int = Field(..., ge=1)
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
    game_number: int
    tips_allowed: bool
    players: list[DuelPlayerInfo]


class JoinDuelResponse(BaseModel):
    player_token: str
    duel_id: str
    game_number: int
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
    game_number: int = Field(..., ge=1)
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
    game_number: int
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
    word: str


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




# --- Arenas (Battle Royale, Blitz-Duell, Zeitbonus-Jagd) ---


class CreateArenaRequest(BaseModel):
    mode: str = Field(..., pattern="^(royale|blitz|timerush)$")
    game_number: int = Field(..., ge=1)
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
    game_number: int
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


class MatchmakingLiveResponse(BaseModel):
    """The picker's answer to "is anybody there", before a ticket exists.

    Every queue mode is a key, so a mode nobody is playing reads as a zero
    rather than as a gap the client has to interpret.
    """
    modes: dict[str, ModeLoad]
    waiting_total: int
    playing_total: int
