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


class AdminLoginRequest(BaseModel):
    code: str = Field(..., max_length=16)


class AdminLoginResponse(BaseModel):
    token: str
