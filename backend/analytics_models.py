"""Request/response models for analytics & admin endpoints."""

from typing import Literal

from pydantic import BaseModel, Field


class BeaconTokenResponse(BaseModel):
    token: str


class BeaconRequest(BaseModel):
    # Only the page path and the signed token are accepted from the client.
    # Everything else (identity, device, geo, referrer) is derived server-side.
    page: str = Field(..., max_length=200)
    token: str = Field(..., max_length=64)
    referrer: str | None = Field(default=None, max_length=300)
    # Marker of a shared result link (?s=<game>), counted per page only.
    share: str | None = Field(default=None, max_length=8)


class BeaconResponse(BaseModel):
    ok: bool


class HeartbeatRequest(BaseModel):
    # Live-presence ping: only the page path and the signed token are accepted;
    # identity is derived server-side from IP+UA, exactly like the pageview beacon.
    page: str = Field(..., max_length=200)
    token: str = Field(..., max_length=64)
    # Only a heartbeat from a visible tab earns attention time.
    visible: bool = False


class LiveStatsResponse(BaseModel):
    active_now: int
    by_page: dict[str, int]
    window_seconds: int
    generated_at: str


class CompletionRequest(BaseModel):
    """Client-reported game completion (feeds the distribution histograms only).

    Strict enums + bounds; identity is still derived server-side from IP+UA, and
    the signed token binds the report to the requesting fingerprint. The server
    additionally clamps every value defensively.
    """

    token: str = Field(..., max_length=64)
    mode: Literal["kontexto", "wordle"]
    game_number: int = Field(..., ge=0, le=1_000_000)
    outcome: Literal["solved", "gaveup"]
    guesses: int = Field(..., ge=0, le=100_000)
    tips: int = Field(default=0, ge=0, le=100_000)
    duration_seconds: int = Field(default=0, ge=0, le=10_000_000)
    best_rank: int = Field(default=1, ge=1, le=100_000_000)


class ShareClickRequest(BaseModel):
    """The share button was pressed. Client-reported by necessity: copying to the
    clipboard produces no server hit."""

    token: str = Field(..., max_length=64)
    mode: Literal["kontexto", "infinite", "wordle"]


class SurveyAnswerRequest(BaseModel):
    """One answer to the attribution survey ("Woher kennst du Kontexto?").

    Sent twice at most: once on the chip tap (no detail), once more if the user
    fills the optional free-text field afterwards. The server dedups both halves
    per fingerprint, so a replay adds nothing.
    """

    token: str = Field(..., max_length=64)
    survey: Literal["source_v1"] = "source_v1"
    source: Literal[
        "search", "friends", "tiktok", "instagram", "youtube", "twitch",
        "reddit", "other_game", "random", "other",
    ]
    detail: str | None = Field(default=None, max_length=80)


class WordRatingRequest(BaseModel):
    """One vote on how a solution word played.

    Sent twice at most, exactly like the attribution survey: once on the tap, and
    once more if the optional free text gets filled in afterwards. The server
    dedups both halves per fingerprint and game, so a replay adds nothing.

    `reason` only means anything next to the "hard" verdict; sent with any other
    it is dropped server-side rather than rejected, because a client that sends
    it is confused and not hostile.
    """

    token: str = Field(..., max_length=64)
    game_number: int = Field(..., ge=1, le=1_000_000)
    verdict: Literal["easy", "right", "hard"]
    reason: Literal["unknown_word", "no_idea", "bad_neighbours"] | None = None
    detail: str | None = Field(default=None, max_length=80)


class WordRatingSummary(BaseModel):
    """The tally handed back after a vote.

    `enough` is false below the threshold and the counts are then all zero, so a
    client cannot render a percentage out of four votes even by mistake.
    """

    game_number: int
    total: int
    enough: bool
    counts: dict[str, int]


class AdminSessionResponse(BaseModel):
    token: str


class WebAuthnVerifyRequest(BaseModel):
    credential: dict
    challenge_token: str = Field(..., max_length=4096)


class RegisterOptionsRequest(BaseModel):
    enroll_token: str = Field(..., max_length=256)


class RegisterVerifyRequest(BaseModel):
    credential: dict
    challenge_token: str = Field(..., max_length=4096)
    enroll_token: str = Field(..., max_length=256)
