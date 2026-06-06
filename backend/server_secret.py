"""Single source of truth for the server-wide HMAC secret.

All HMACs (admin session tokens, beacon tokens, monthly fingerprint salt) MUST
derive from the SAME secret, so it lives here; auth.py and analytics.py import it.

Fail-closed: a missing/empty KONTEXTO_SERVER_SECRET is a hard error in production.
A known dev fallback is permitted ONLY when KONTEXTO_DEV is explicitly set -- local
development is never a production deployment, and the fallback value is public.
"""

import os

_DEV_FALLBACK = "kontexto-dev-secret"


class MissingServerSecretError(RuntimeError):
    """Raised when KONTEXTO_SERVER_SECRET is unset/empty outside dev mode."""


def server_secret() -> bytes:
    """Return the configured HMAC secret as bytes.

    Evaluated at call time (not import time) so test/env setup that runs before
    importing the consumers still takes effect. Empty/whitespace is treated as
    unset. Raises MissingServerSecretError in production when no real secret is
    configured, rather than silently falling back to a known default.
    """
    secret = os.environ.get("KONTEXTO_SERVER_SECRET", "").strip()
    if secret:
        return secret.encode()
    if os.environ.get("KONTEXTO_DEV"):
        return _DEV_FALLBACK.encode()
    raise MissingServerSecretError(
        "KONTEXTO_SERVER_SECRET is not set. Refusing to use a known default secret "
        "outside of dev mode. Set KONTEXTO_SERVER_SECRET (prod) or KONTEXTO_DEV (local)."
    )
