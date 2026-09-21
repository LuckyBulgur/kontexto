"""Pydantic request/response models for Wordle API."""

from typing import Literal

from pydantic import BaseModel, ConfigDict


class PreviousGuess(BaseModel):
    word: str
    result: list[str]


class WordleGuessRequest(BaseModel):
    word: str
    game_number: int
    hard_mode: bool = False
    previous: list[PreviousGuess] = []
    # Set on the first guess of a game so the server can count a started game.
    first: bool = False


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
    # The client picks the kind of puzzle, never its number: the number is the
    # answer, because /api/wordle/reveal serves it to anybody. See rooms.py.
    model_config = ConfigDict(extra="forbid")

    nickname: str
    # "random" as the default for the same reason the Kontexto rooms use it: a
    # request that omits the field must not spoil the daily for the guest.
    game_source: Literal["today", "random"] = "random"


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
    nickname: str
    players: list[WordleDuelPlayerInfo]
    round: int


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
    # No game_number while the round is open: see rooms.py.
    round: int
    players: list[WordleDuelPlayerInfo]
