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
