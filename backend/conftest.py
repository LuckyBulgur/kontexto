"""Shared pytest setup.

The HMAC secret is fail-closed (``server_secret.py``): importing anything that
touches it without a configured secret raises. Until now only test_analytics.py
set one, at import time, so every other test file depended on pytest collecting
that file first. Running a single file on its own then failed for a reason that
had nothing to do with the test. Setting it here makes the suite order
independent.
"""

import os

os.environ.setdefault("KONTEXTO_SERVER_SECRET", "test-secret")
