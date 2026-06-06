"""Pydantic request/response models for Wordle API."""

from pydantic import BaseModel


class PreviousGuess(BaseModel):
    word: str
    result: list[str]


class WordleGuessRequest(BaseModel):
    word: str
    game_number: int
    hard_mode: bool = False
    previous: list[PreviousGuess] = []


class WordleGuessResponse(BaseModel):
    valid: bool
    result: list[str] | None = None
    error: str | None = None
    message: str | None = None


class WordleGameResponse(BaseModel):
    game_number: int


class WordleRevealResponse(BaseModel):
    word: str


class WordleCreateDuelRequest(BaseModel):
    nickname: str
    game_number: int


class WordleCreateDuelResponse(BaseModel):
    duel_id: str
    player_token: str


class WordleJoinDuelRequest(BaseModel):
    nickname: str


class WordleDuelPlayerInfo(BaseModel):
    nickname: str
    guesses_used: int
    solved: bool
    connected: bool
    results: list[list[str]] = []


class WordleJoinDuelResponse(BaseModel):
    player_token: str
    players: list[WordleDuelPlayerInfo]
    game_number: int


class WordleDuelGuessRequest(BaseModel):
    word: str
    player_token: str


class WordleDuelGuessEntry(BaseModel):
    word: str
    result: list[str]
    guessed_at: str


class WordleDuelHistoryResponse(BaseModel):
    guesses: list[WordleDuelGuessEntry]


class WordleDuelStateResponse(BaseModel):
    game_number: int
    players: list[WordleDuelPlayerInfo]
