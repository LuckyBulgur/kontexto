from pydantic import BaseModel, Field


class GuessRequest(BaseModel):
    word: str = Field(..., min_length=1, max_length=100)


class GuessResponse(BaseModel):
    word: str
    rank: int
    total: int


class ErrorResponse(BaseModel):
    error: str
    message: str


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
    best_rank: int | None
    players: list[KoopPlayerInfo]


class JoinKoopResponse(KoopStateResponse):
    player_token: str
    nickname: str


class KoopGuessRequest(BaseModel):
    word: str = Field(..., min_length=1, max_length=100)
    player_token: str


class KoopGuessResponse(BaseModel):
    word: str
    rank: int
    total: int
    already_guessed: bool


class KoopGuessEntry(BaseModel):
    nickname: str
    word: str
    rank: int
    is_tip: bool
    guessed_at: str


class KoopGuessesResponse(BaseModel):
    guesses: list[KoopGuessEntry]


