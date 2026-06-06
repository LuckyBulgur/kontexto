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


class BeaconResponse(BaseModel):
    ok: bool


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
