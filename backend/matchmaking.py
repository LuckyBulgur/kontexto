"""Random matchmaking for every multiplayer mode.

Until now a multiplayer round needed an invite link, which means it needed
somebody to invite. This queue is the other door: a player picks a mode, waits,
and is put into a room with strangers.

Three things follow from "with strangers" and are handled here rather than in
the individual modes:

* **The nickname is not free text.** A name that everyone in the room reads is
  a broadcast channel. The queue defaults to a generated German name and only
  accepts a typed one after a profanity check. Invite-link rooms keep their free
  text: there the players already know each other.
* **Pairing is a single writer.** It runs in the WS worker, and every claim is
  still guarded by ``matched_room_id IS NULL`` so a repeated pass cannot put one
  ticket into two rooms.
* **A ticket expires.** A tab closed while waiting must not keep a phantom
  player in the queue forever.
"""

from __future__ import annotations

import random
import secrets
from datetime import datetime, timedelta, timezone

import aiosqlite

from arena import iso_timestamp, parse_iso
from wordlists import PROFANITY_BLOCKLIST

# Modes the queue serves. Kontexto duel and koop, Wordle duel, and the three
# arena modes; the arena ones cost nothing extra because a room is a room.
QUEUE_MODES: tuple[str, ...] = ("duel", "koop", "wordle_duel", "royale", "blitz", "timerush")


class PartyRule:
    """How many players a mode waits for, and how long it is willing to wait.

    ``grace_seconds`` is the point at which a party of ``minimum`` is better than
    a bigger party nobody is around for. A duel has nothing to gain from waiting,
    a Battle Royale does.
    """

    def __init__(self, minimum: int, maximum: int, grace_seconds: int) -> None:
        self.minimum = minimum
        self.maximum = maximum
        self.grace_seconds = grace_seconds


PARTY_RULES: dict[str, PartyRule] = {
    "duel": PartyRule(2, 2, 0),
    "wordle_duel": PartyRule(2, 2, 0),
    "blitz": PartyRule(2, 8, 12),
    "koop": PartyRule(2, 4, 15),
    "timerush": PartyRule(2, 8, 15),
    "royale": PartyRule(3, 8, 25),
}

# A ticket nobody claimed by then is dropped: the tab is gone, the player is not.
TICKET_TTL_SECONDS = 300

MAX_NICKNAME_LENGTH = 20


# --- Nicknames --------------------------------------------------------------

_ADJECTIVES = (
    "Flinke", "Stille", "Kluge", "Wache", "Kuehne", "Feine", "Ruhige", "Helle",
    "Rasche", "Zaehe", "Muntere", "Weise", "Frische", "Kesse", "Sanfte", "Freche",
)

_NOUNS = (
    "Eule", "Otter", "Elster", "Dohle", "Amsel", "Marder", "Luchs", "Gemse",
    "Robbe", "Biene", "Hummel", "Libelle", "Forelle", "Krabbe", "Kroete", "Meise",
)


def generate_nickname() -> str:
    """A neutral German name for a player who did not choose one.

    Two words plus a small number: short enough to read in a player list, varied
    enough that a room of eight rarely shows the same name twice.
    """
    return f"{random.choice(_ADJECTIVES)} {random.choice(_NOUNS)} {random.randint(2, 99)}"


def _normalize_for_check(name: str) -> str:
    lowered = name.lower()
    for source, target in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss")):
        lowered = lowered.replace(source, target)
    return "".join(ch if ch.isalnum() else " " for ch in lowered)


def is_nickname_acceptable(name: str) -> bool:
    """Whether a typed nickname may be shown to strangers.

    Substring matching, not word matching: "arschgeige1" and "xxfotzexx" are the
    shapes a word list is evaded with. The transliteration closes the other easy
    door, writing the same word without its umlaut.
    """
    stripped = name.strip()
    if not 1 <= len(stripped) <= MAX_NICKNAME_LENGTH:
        return False
    if any(ord(ch) < 32 for ch in stripped):
        return False

    haystack = _normalize_for_check(stripped).replace(" ", "")
    return not any(bad_word in haystack for bad_word in _PROFANITY_NORMALIZED)


_PROFANITY_NORMALIZED = frozenset(_normalize_for_check(w).replace(" ", "") for w in PROFANITY_BLOCKLIST)


def resolve_nickname(requested: str | None) -> str:
    """The name this player will carry into a room with strangers."""
    if requested and is_nickname_acceptable(requested):
        return requested.strip()
    return generate_nickname()


# --- Queue ------------------------------------------------------------------


async def enqueue(
    db: aiosqlite.Connection,
    mode: str,
    nickname: str | None,
    now: datetime | None = None,
) -> dict | None:
    """Put a player in line. Returns the ticket, or None for an unknown mode."""
    if mode not in QUEUE_MODES:
        return None
    now = now or datetime.now(timezone.utc)

    ticket = secrets.token_urlsafe(24)
    resolved = resolve_nickname(nickname)
    await db.execute(
        "INSERT INTO matchmaking_queue (ticket, mode, nickname, enqueued_at) VALUES (?, ?, ?, ?)",
        (ticket, mode, resolved, iso_timestamp(now)),
    )
    await db.commit()
    rule = PARTY_RULES[mode]
    return {
        "ticket": ticket,
        "mode": mode,
        "nickname": resolved,
        "min_players": rule.minimum,
        "max_players": rule.maximum,
        "grace_seconds": rule.grace_seconds,
    }


async def ticket_status(db: aiosqlite.Connection, ticket: str) -> dict | None:
    cursor = await db.execute(
        "SELECT mode, nickname, matched_room_id, matched_token FROM matchmaking_queue "
        "WHERE ticket = ?",
        (ticket,),
    )
    row = await cursor.fetchone()
    if not row:
        return None
    # matched_token is the honest signal: matched_room_id briefly holds a
    # reservation placeholder while the room is still being built, and a client
    # polling in that window must not be sent to a room that does not exist yet.
    matched = row["matched_token"] is not None
    rule = PARTY_RULES[row["mode"]]
    return {
        "mode": row["mode"],
        "nickname": row["nickname"],
        "matched": matched,
        "room_id": row["matched_room_id"] if matched else None,
        "player_token": row["matched_token"],
        # The waiting screen promises the player when the round will start, so
        # the promise comes from the same table the pairing loop reads.
        "min_players": rule.minimum,
        "max_players": rule.maximum,
        "grace_seconds": rule.grace_seconds,
    }


async def cancel(db: aiosqlite.Connection, ticket: str) -> bool:
    """Leave the queue. A ticket that already found a room cannot be withdrawn,
    because the room exists and the other players are waiting in it."""
    cursor = await db.execute(
        "DELETE FROM matchmaking_queue WHERE ticket = ? AND matched_room_id IS NULL",
        (ticket,),
    )
    await db.commit()
    return cursor.rowcount == 1


async def waiting_counts(db: aiosqlite.Connection) -> dict[str, int]:
    """How many players are queued per mode, for the waiting screen."""
    cursor = await db.execute(
        "SELECT mode, COUNT(*) AS cnt FROM matchmaking_queue "
        "WHERE matched_room_id IS NULL GROUP BY mode"
    )
    return {row["mode"]: row["cnt"] for row in await cursor.fetchall()}


async def run_matchmaking(
    db: aiosqlite.Connection, create_room, now: datetime | None = None
) -> list[dict]:
    """Form every party that can be formed right now.

    ``create_room(db, mode, nicknames)`` builds the actual room and returns
    ``(room_id, tokens)`` with one token per nickname, in the same order; this
    module deliberately knows nothing about duels, koops or arenas. Returns one
    entry per room created.
    """
    now = now or datetime.now(timezone.utc)
    created: list[dict] = []

    for mode in QUEUE_MODES:
        rule = PARTY_RULES[mode]
        while True:
            party = await _next_party(db, mode, rule, now)
            if not party:
                break
            room = await _claim(db, mode, party, create_room)
            if room is None:
                break
            created.append(room)

    return created


async def _next_party(
    db: aiosqlite.Connection, mode: str, rule: PartyRule, now: datetime
) -> list[aiosqlite.Row]:
    """The tickets that should be put into one room, oldest first, or nothing."""
    cursor = await db.execute(
        "SELECT ticket, nickname, enqueued_at FROM matchmaking_queue "
        # rowid breaks the tie, so two players who queued in the same second are
        # still served in the order they arrived. The ticket is a random token
        # and would have made that order a lottery.
        "WHERE mode = ? AND matched_room_id IS NULL ORDER BY enqueued_at, rowid LIMIT ?",
        (mode, rule.maximum),
    )
    waiting = list(await cursor.fetchall())
    if len(waiting) < rule.minimum:
        return []
    if len(waiting) >= rule.maximum:
        return waiting

    oldest = parse_iso(waiting[0]["enqueued_at"])
    if oldest is None or now - oldest >= timedelta(seconds=rule.grace_seconds):
        return waiting
    return []


async def _claim(
    db: aiosqlite.Connection, mode: str, party: list[aiosqlite.Row], create_room
) -> dict | None:
    """Reserve these tickets, then build the room they were reserved for.

    The reservation comes first and is guarded on ``matched_room_id IS NULL``. If
    another pass got there first the claim writes nothing, and no room is built
    for players who are already in one.
    """
    placeholder = f"pending:{secrets.token_urlsafe(8)}"
    tickets = [row["ticket"] for row in party]
    claimed: list[aiosqlite.Row] = []
    for row in party:
        cursor = await db.execute(
            "UPDATE matchmaking_queue SET matched_room_id = ? "
            "WHERE ticket = ? AND matched_room_id IS NULL",
            (placeholder, row["ticket"]),
        )
        if cursor.rowcount == 1:
            claimed.append(row)

    if len(claimed) < PARTY_RULES[mode].minimum:
        # Not enough of the party was still free. Release what was reserved so
        # the next pass can try again with whoever is actually waiting.
        for row in claimed:
            await db.execute(
                "UPDATE matchmaking_queue SET matched_room_id = NULL WHERE ticket = ?",
                (row["ticket"],),
            )
        await db.commit()
        return None

    nicknames = [row["nickname"] for row in claimed]
    # Tokens come back positionally, not keyed by nickname: two players in the
    # same room may well have typed the same name.
    room_id, tokens = await create_room(db, mode, nicknames)

    stamp = iso_timestamp(datetime.now(timezone.utc))
    for row, token in zip(claimed, tokens):
        await db.execute(
            "UPDATE matchmaking_queue SET matched_room_id = ?, matched_token = ?, matched_at = ? "
            "WHERE ticket = ?",
            (room_id, token, stamp, row["ticket"]),
        )
    await db.commit()

    return {
        "mode": mode,
        "room_id": room_id,
        "tickets": [row["ticket"] for row in claimed],
        "nicknames": nicknames,
        "skipped": [t for t in tickets if t not in {row["ticket"] for row in claimed}],
    }


async def prune_queue(db: aiosqlite.Connection, now: datetime | None = None) -> int:
    """Drop stale tickets: abandoned waits, and matches nobody picked up."""
    now = now or datetime.now(timezone.utc)
    cutoff = iso_timestamp(now - timedelta(seconds=TICKET_TTL_SECONDS))
    cursor = await db.execute(
        "DELETE FROM matchmaking_queue WHERE enqueued_at < ?", (cutoff,)
    )
    await db.commit()
    return cursor.rowcount
