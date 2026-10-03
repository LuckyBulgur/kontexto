"""Supporters from Ko-fi, shown by name beside the board for 30 days.

Ko-fi calls ``POST /api/kofi/webhook`` once per payment. The body is form-encoded
with one field, ``data``, whose value is a JSON object (``verification_token``,
``is_public``, ``from_name``, ``kofi_transaction_id``, ``type``, plus amount,
email and message, which this module never reads). The token is the one shown on
Ko-fi's API page and lives in ``KONTEXTO_KOFI_VERIFICATION_TOKEN``; without it the
endpoint is off.

What is kept, and why so little:

- Only a supporter who left "public" on in Ko-fi's checkout is stored at all. A
  private one leaves no row here, not even a count.
- Only the name, the transaction id (so Ko-fi's retries are idempotent), the
  time, the review status and the reason a name waits. No amount, because the
  player decided against anything that ranks givers, no message, no email.
- Rows older than ``SHOW_DAYS`` are deleted by the cleanup loop, whatever their
  status, so the table never holds more than the wall and its queue.

Names are moderated in three tiers, strict on purpose because children play
this (the player asked for it, with a manual say on anything suspicious). This
is the pre-moderation pattern: nothing questionable is ever public, not even for
the minutes before somebody looks.

1. Refused outright, never stored: anything the word filter flags in either
   reading (leetspeak, confusables and spacing are handled there), anything on
   the hint blocklist (sexual register, drugs and the like), email addresses,
   links, control characters, an over-long name.
2. Approved automatically only when every word is a known given or family name
   from the project's gazetteer (``german_names.txt``) or a single initial
   ("Lena", "Max M.", "Anna Lena").
3. Everything else waits as ``pending`` with a reason, until the operator
   approves or rejects it in the admin dashboard. A rejected row keeps its
   transaction id, so a retry of the same payment cannot bring the name back,
   and loses its name.
"""

from __future__ import annotations

import hmac
import json
import logging
import os
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal
from urllib.parse import parse_qs

import aiosqlite

import core_lexicon
from wordlists import find_profanity

logger = logging.getLogger(__name__)

TOKEN_ENV = "KONTEXTO_KOFI_VERIFICATION_TOKEN"

# How long a supporter stays on the wall (the player's decision), and therefore
# how long the row is kept.
SHOW_DAYS = 30
# Upper bound of names one response carries. Two rails of a dozen fit a
# 1280 pixel screen; the rest is a "plus N" line on the client.
MAX_NAMES = 60
# Ko-fi's payload is a few hundred bytes; anything far beyond that is not Ko-fi.
MAX_BODY_BYTES = 16_384
# Ko-fi lets a supporter type any name. The wall allows the nickname limit plus
# room for a first and a last name.
MAX_NAME_LENGTH = 32
# More words than a first, middle and last name is not a name.
MAX_WORDS = 3

Status = Literal["pending", "approved", "rejected"]

# Why a name waits for the operator. Stored as a code; the dashboard words it.
REASON_UNKNOWN_WORD = "unknown_word"
REASON_DIGITS = "digits"
REASON_SYMBOLS = "symbols"
REASON_SCRIPT = "script"
REASON_TOO_MANY_WORDS = "too_many_words"
REASON_SHOUTING = "shouting"

# What Ko-fi sends when a supporter leaves the name field empty.
_PLACEHOLDER_NAMES = frozenset({"someone", "anonymous", "anonym", "jemand", "supporter"})
_TLDS = (".com", ".de", ".net", ".org", ".io", ".at", ".ch", ".tv", ".gg", ".me")
_NAMES_FILE = Path(__file__).with_name("german_names.txt")
# A word of a name: Latin letters (with the German and common European
# diacritics), optionally joined by one hyphen or apostrophe ("Anna-Lena", "O'Neil").
_LATIN_WORD = re.compile(r"^[^\W\d_]+(?:['\-][^\W\d_]+)*$")
_INITIAL = re.compile(r"^[^\W\d_]\.?$")


class WebhookRejected(Exception):
    """The request is not a Ko-fi webhook this server accepts."""

    def __init__(self, status: int, reason: str) -> None:
        super().__init__(reason)
        self.status = status
        self.reason = reason


def configured_token() -> str | None:
    token = os.environ.get(TOKEN_ENV, "").strip()
    return token or None


def iso(ts: datetime) -> str:
    """Fixed-width UTC timestamp, so SQLite's string order is time order."""
    return ts.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@lru_cache(maxsize=1)
def _known_names() -> frozenset[str]:
    return frozenset(
        line.strip().casefold()
        for line in _NAMES_FILE.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#")
    )


@lru_cache(maxsize=1)
def _hint_blocklist() -> frozenset[str]:
    return core_lexicon.load_hint_blocklist()


def _is_latin(word: str) -> bool:
    return all(
        not ch.isalpha() or unicodedata.name(ch, "").startswith("LATIN")
        for ch in word
    )


def classify_name(raw: Any) -> tuple[str, Status, str | None] | None:
    """Decide what happens to a name: None (refused, never stored), or the cleaned
    name with its status and, for ``pending``, the reason it waits.
    """
    if not isinstance(raw, str):
        return None
    name = " ".join(unicodedata.normalize("NFKC", raw).split())
    if not name or len(name) > MAX_NAME_LENGTH:
        return None
    if any(unicodedata.category(ch) in ("Cc", "Cf", "Co", "Cs") for ch in name):
        return None
    lowered = name.casefold()
    if lowered in _PLACEHOLDER_NAMES:
        return None
    if "@" in name or "http" in lowered or "www." in lowered or "/" in name or any(
        lowered.endswith(tld) or f"{tld} " in lowered for tld in _TLDS
    ):
        return None
    if find_profanity(name, collapse_words=False) is not None:
        return None
    if find_profanity(name, collapse_words=True) is not None:
        return None
    words = name.split(" ")
    blocked = _hint_blocklist()
    if any(word.strip(".'-").casefold() in blocked for word in words):
        return None

    if len(words) > MAX_WORDS:
        return name, "pending", REASON_TOO_MANY_WORDS
    if any(ch.isdigit() for ch in name):
        return name, "pending", REASON_DIGITS
    if not all(_LATIN_WORD.match(w.rstrip(".")) or _INITIAL.match(w) for w in words):
        return name, "pending", REASON_SYMBOLS
    if not all(_is_latin(w) for w in words):
        return name, "pending", REASON_SCRIPT
    if len(name) > 3 and name.isupper():
        return name, "pending", REASON_SHOUTING

    known = _known_names()
    for word in words:
        if _INITIAL.match(word):
            continue
        parts = re.split(r"['\-]", word)
        if not all(part.casefold() in known for part in parts):
            return name, "pending", REASON_UNKNOWN_WORD
    if all(_INITIAL.match(word) for word in words):
        # Initials alone ("K.", "A. B.") say nothing about who it is, which is
        # harmless, but they also say nothing a person checked.
        return name, "pending", REASON_UNKNOWN_WORD
    return name, "approved", None


def parse_webhook(body: bytes, token: str) -> dict[str, Any]:
    """Validate the request and return Ko-fi's JSON object.

    Raises WebhookRejected with the status to answer. The token is compared in
    constant time and before anything else in the payload is looked at.
    """
    if len(body) > MAX_BODY_BYTES:
        raise WebhookRejected(413, "too_large")
    try:
        form = parse_qs(body.decode("utf-8"), keep_blank_values=True, strict_parsing=False)
    except UnicodeDecodeError as exc:
        raise WebhookRejected(400, "bad_encoding") from exc
    values = form.get("data")
    if not values or len(values) != 1:
        raise WebhookRejected(400, "no_data")
    try:
        data = json.loads(values[0])
    except json.JSONDecodeError as exc:
        raise WebhookRejected(400, "bad_json") from exc
    if not isinstance(data, dict):
        raise WebhookRejected(400, "bad_json")
    sent = data.get("verification_token")
    if not isinstance(sent, str) or not hmac.compare_digest(sent.encode(), token.encode()):
        raise WebhookRejected(401, "bad_token")
    return data


async def record_payment(db: aiosqlite.Connection, data: dict[str, Any], now: datetime) -> str:
    """Store a public supporter from a verified payload. Returns what happened.

    Idempotent on Ko-fi's transaction id: Ko-fi retries until it gets a 200, and
    every retry after the first is an ``INSERT OR IGNORE`` that changes nothing,
    including after the operator rejected the name.
    """
    if data.get("is_public") is not True:
        return "private"
    transaction = data.get("kofi_transaction_id")
    if not isinstance(transaction, str) or not 1 <= len(transaction) <= 128:
        return "no_transaction"
    verdict = classify_name(data.get("from_name"))
    if verdict is None:
        return "name_refused"
    name, status, reason = verdict
    cur = await db.execute(
        "INSERT OR IGNORE INTO supporters (transaction_id, name, created_at, status, reason) "
        "VALUES (?, ?, ?, ?, ?)",
        (transaction, name, iso(now), status, reason),
    )
    await db.commit()
    if cur.rowcount != 1:
        return "duplicate"
    return "stored" if status == "approved" else "pending"


async def recent_names(db: aiosqlite.Connection, now: datetime) -> list[str]:
    """Approved names of the last ``SHOW_DAYS`` days, newest first, each once."""
    since = iso(now - timedelta(days=SHOW_DAYS))
    cur = await db.execute(
        "SELECT name, MAX(created_at) AS last FROM supporters "
        "WHERE status = 'approved' AND created_at >= ? "
        "GROUP BY name COLLATE NOCASE ORDER BY last DESC LIMIT ?",
        (since, MAX_NAMES),
    )
    return [row[0] for row in await cur.fetchall()]


async def review_queue(db: aiosqlite.Connection, now: datetime) -> dict[str, list[dict[str, Any]]]:
    """What the operator sees: names waiting for a decision, and the approved ones
    on the wall (so one can still be taken down)."""
    since = iso(now - timedelta(days=SHOW_DAYS))
    cur = await db.execute(
        "SELECT transaction_id, name, created_at, status, reason FROM supporters "
        "WHERE status IN ('pending', 'approved') AND created_at >= ? ORDER BY created_at DESC",
        (since,),
    )
    rows = [
        {"id": r[0], "name": r[1], "created_at": r[2], "status": r[3], "reason": r[4]}
        for r in await cur.fetchall()
    ]
    return {
        "pending": [r for r in rows if r["status"] == "pending"],
        "approved": [r for r in rows if r["status"] == "approved"],
    }


async def review(db: aiosqlite.Connection, transaction_id: str, approve: bool) -> bool:
    """Approve a pending name, or reject a pending or approved one.

    A rejection clears the name, so nothing of it is kept. Returns False when the
    row does not exist or is not in a state the decision applies to.
    """
    if approve:
        cur = await db.execute(
            "UPDATE supporters SET status = 'approved', reason = NULL "
            "WHERE transaction_id = ? AND status = 'pending'",
            (transaction_id,),
        )
    else:
        cur = await db.execute(
            "UPDATE supporters SET status = 'rejected', name = '', reason = NULL "
            "WHERE transaction_id = ? AND status IN ('pending', 'approved')",
            (transaction_id,),
        )
    await db.commit()
    return cur.rowcount == 1


async def prune(db: aiosqlite.Connection, now: datetime) -> int:
    """Delete supporters older than the wall shows. Returns the rows removed."""
    cur = await db.execute(
        "DELETE FROM supporters WHERE created_at < ?",
        (iso(now - timedelta(days=SHOW_DAYS)),),
    )
    await db.commit()
    return cur.rowcount
