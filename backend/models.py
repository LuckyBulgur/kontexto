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
