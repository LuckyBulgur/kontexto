"""Admin authentication: TOTP (2FA) login + signed, short-lived session tokens.

The admin stores the TOTP secret in a password manager (e.g. 1Password) as a
2FA entry. Login verifies a 6-digit TOTP code and issues an HMAC-signed session
token; protected endpoints validate that token. No password DB, no cookies.
"""

import base64
import hashlib
import hmac
import json
import os
import time

import pyotp

from server_secret import server_secret as _server_secret

# Session token validity (seconds).
SESSION_TTL = 12 * 60 * 60  # 12 hours


def _totp_secret() -> str | None:
    """Base32 TOTP secret. If unset, admin auth is disabled (login always fails)."""
    return os.environ.get("KONTEXTO_ADMIN_TOTP_SECRET")


def verify_totp(code: str) -> bool:
    """Validate a 6-digit TOTP code (with +/-1 step drift tolerance)."""
    secret = _totp_secret()
    if not secret or not code:
        return False
    code = code.strip().replace(" ", "")
    if not code.isdigit():
        return False
    try:
        return pyotp.TOTP(secret).verify(code, valid_window=1)
    except Exception:
        return False


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _b64url_decode(data: str) -> bytes:
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


def issue_session_token(now: float | None = None) -> str:
    """Create a signed session token: <payload>.<signature>."""
    now = time.time() if now is None else now
    payload = _b64url(json.dumps({"exp": int(now) + SESSION_TTL}).encode())
    sig = _b64url(hmac.new(_server_secret(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{sig}"


def verify_session_token(token: str, now: float | None = None) -> bool:
    """Validate signature and expiry of a session token."""
    now = time.time() if now is None else now
    if not token or "." not in token:
        return False
    payload, _, sig = token.partition(".")
    expected = _b64url(hmac.new(_server_secret(), payload.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(sig, expected):
        return False
    try:
        data = json.loads(_b64url_decode(payload))
        return float(data.get("exp", 0)) > now
    except Exception:
        return False
