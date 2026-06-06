"""Request/response models for analytics & admin endpoints."""

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
