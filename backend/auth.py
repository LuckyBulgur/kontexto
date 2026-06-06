"""Admin authentication via WebAuthn / passkey + signed session tokens.

A single passkey (one device) protects /admin/stats. The server stores only the
*public* key -- there is no shared login secret, and the ceremony is phishing-
resistant (cryptographically bound to the RP ID / origin).

Registration is gated by a break-glass enrollment token (KONTEXTO_ADMIN_ENROLL_TOKEN)
that is normally unset -> registration disabled, zero attack surface. It is set
only briefly to enroll (or re-enroll, e.g. after losing the device) one passkey.

Session tokens stay HMAC-signed via the shared server secret.
"""

import base64
import hashlib
import hmac
import json
import os
import time

import aiosqlite
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from server_secret import server_secret as _server_secret

# Session token validity (seconds).
SESSION_TTL = 12 * 60 * 60  # 12 hours
# WebAuthn challenge token validity (seconds).
CHALLENGE_TTL = 300  # 5 minutes

# Fixed user handle/name for the single admin (WebAuthn requires a user entity).
_ADMIN_USER_ID = b"kontexto-admin"
_ADMIN_USER_NAME = "admin"
_RP_NAME = "Kontexto Admin"


# --- Configuration -----------------------------------------------------------

def _is_dev() -> bool:
    return bool(os.environ.get("KONTEXTO_DEV"))


def rp_id() -> str:
    """WebAuthn Relying Party ID (the registrable domain)."""
    return os.environ.get("KONTEXTO_WEBAUTHN_RP_ID") or ("localhost" if _is_dev() else "kontexto.de")


def origin() -> str:
    """Expected origin of the ceremony (scheme + host [+ port])."""
    return os.environ.get("KONTEXTO_WEBAUTHN_ORIGIN") or (
        "http://localhost:3000" if _is_dev() else "https://kontexto.de"
    )


def _enroll_token() -> str:
    return os.environ.get("KONTEXTO_ADMIN_ENROLL_TOKEN", "").strip()


def enrollment_enabled() -> bool:
    """Registration is only possible while a non-empty enroll token is configured."""
    return bool(_enroll_token())


def enroll_token_valid(token: str) -> bool:
    expected = _enroll_token()
    if not expected:
        return False
    return hmac.compare_digest((token or "").strip(), expected)


# --- Session token (HMAC-signed, unchanged) ----------------------------------

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


# --- Stateless challenge token -----------------------------------------------
# Carries the ceremony challenge between the options and verify steps without
# server-side state (4 uvicorn workers). HMAC-signed; bound to a purpose + expiry.

def make_challenge_token(challenge: bytes, purpose: str, now: float | None = None) -> str:
    now = time.time() if now is None else now
    payload = _b64url(json.dumps({
        "c": bytes_to_base64url(challenge),
        "p": purpose,
        "exp": int(now) + CHALLENGE_TTL,
    }).encode())
    sig = _b64url(hmac.new(_server_secret(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{sig}"


def verify_challenge_token(token: str, purpose: str, now: float | None = None) -> bytes | None:
    """Return the embedded challenge bytes if the token is valid, else None."""
    now = time.time() if now is None else now
    if not token or "." not in token:
        return None
    payload, _, sig = token.partition(".")
    expected = _b64url(hmac.new(_server_secret(), payload.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(sig, expected):
        return None
    try:
        data = json.loads(_b64url_decode(payload))
    except Exception:
        return None
    if data.get("p") != purpose or float(data.get("exp", 0)) <= now:
        return None
    try:
        return base64url_to_bytes(data["c"])
    except Exception:
        return None


# --- Credential storage (single credential) ----------------------------------

async def get_credential(db: aiosqlite.Connection) -> dict | None:
    cur = await db.execute(
        "SELECT credential_id, public_key, sign_count, transports FROM admin_credentials LIMIT 1")
    row = await cur.fetchone()
    if not row:
        return None
    return {"credential_id": row[0], "public_key": row[1], "sign_count": row[2], "transports": row[3]}


async def replace_credential(db: aiosqlite.Connection, *, credential_id: str, public_key: str,
                             sign_count: int, transports: str | None = None) -> None:
    """Store exactly one credential, replacing any existing one (1 passkey/1 device)."""
    await db.execute("DELETE FROM admin_credentials")
    await db.execute(
        "INSERT INTO admin_credentials (credential_id, public_key, sign_count, transports) "
        "VALUES (?, ?, ?, ?)",
        (credential_id, public_key, sign_count, transports),
    )
    await db.commit()


async def update_sign_count(db: aiosqlite.Connection, credential_id: str, sign_count: int) -> None:
    await db.execute(
        "UPDATE admin_credentials SET sign_count = ? WHERE credential_id = ?",
        (sign_count, credential_id))
    await db.commit()


# --- WebAuthn ceremonies ------------------------------------------------------

def registration_options() -> tuple[str, bytes]:
    """Return (options_json, challenge_bytes) for navigator.credentials.create."""
    opts = generate_registration_options(
        rp_id=rp_id(),
        rp_name=_RP_NAME,
        user_name=_ADMIN_USER_NAME,
        user_id=_ADMIN_USER_ID,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
    )
    return options_to_json(opts), opts.challenge


def verify_registration(credential: dict, challenge: bytes) -> dict:
    """Verify the attestation; return fields to store. Raises on failure."""
    v = verify_registration_response(
        credential=credential,
        expected_challenge=challenge,
        expected_rp_id=rp_id(),
        expected_origin=origin(),
    )
    return {
        "credential_id": bytes_to_base64url(v.credential_id),
        "public_key": bytes_to_base64url(v.credential_public_key),
        "sign_count": v.sign_count,
    }


def authentication_options(stored: dict) -> tuple[str, bytes]:
    """Return (options_json, challenge_bytes) for navigator.credentials.get."""
    opts = generate_authentication_options(
        rp_id=rp_id(),
        allow_credentials=[
            PublicKeyCredentialDescriptor(id=base64url_to_bytes(stored["credential_id"]))
        ],
        user_verification=UserVerificationRequirement.PREFERRED,
    )
    return options_to_json(opts), opts.challenge


def verify_authentication(credential: dict, challenge: bytes, stored: dict) -> int:
    """Verify the assertion; return the new sign count. Raises on failure."""
    v = verify_authentication_response(
        credential=credential,
        expected_challenge=challenge,
        expected_rp_id=rp_id(),
        expected_origin=origin(),
        credential_public_key=base64url_to_bytes(stored["public_key"]),
        credential_current_sign_count=stored["sign_count"],
    )
    return v.new_sign_count
