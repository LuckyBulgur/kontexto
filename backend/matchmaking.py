"""Random matchmaking for every multiplayer mode.

Until now a multiplayer round needed an invite link, which means it needed
somebody to invite. This queue is the other door: a player picks a mode, waits,
and is put into a room with strangers.

Three things follow from "with strangers" and are handled here rather than in
the individual modes:

* **The nickname is not free text.** A name that everyone in the room reads is
  a broadcast channel. The queue defaults to a generated German name and puts a
  typed one through ``nicknames.sanitize_nickname``, the same rule every room
  applies, including the invite-link ones.
* **Pairing is a single writer.** It runs in the WS worker, and every claim is
  still guarded by ``matched_room_id IS NULL`` so a repeated pass cannot put one
  ticket into two rooms.
* **A ticket expires.** A tab closed while waiting must not keep a phantom
  player in the queue forever.
* **Server players top up a room, never make one.** With a ``fill`` policy
  (``room_bots.FillPolicy``) a player alone in the queue gets company after a
  short wait, and a party of people sometimes gets one or two more. People are
  always paired with people first, and nothing here ever builds a room without
  at least one ticket in it.
"""

from __future__ import annotations

import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Protocol

import aiosqlite

from arena import iso_timestamp, parse_iso
from nicknames import sanitize_nickname

logger = logging.getLogger(__name__)

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


_PRODUCTION_PARTY_RULES: dict[str, PartyRule] = {
    "duel": PartyRule(2, 2, 0),
    "wordle_duel": PartyRule(2, 2, 0),
    "blitz": PartyRule(2, 8, 12),
    "koop": PartyRule(2, 4, 15),
    "timerush": PartyRule(2, 8, 15),
    "royale": PartyRule(3, 8, 25),
}

# Dev-only cap on every grace period, so the end-to-end suite does not sit out
# 12 to 25 real seconds per matchmaking test (frontend/playwright.config.ts sets
# it). It is honoured only together with KONTEXTO_DEV: production always plays
# with the rules above, and a stray value there is ignored with a warning.
GRACE_CAP_ENV = "KONTEXTO_MATCHMAKING_GRACE_CAP"


def _grace_cap_from_env() -> int | None:
    raw = os.environ.get(GRACE_CAP_ENV)
    if raw is None or raw.strip() == "":
        return None
    if not os.environ.get("KONTEXTO_DEV"):
        logger.warning("%s is set without KONTEXTO_DEV and is ignored", GRACE_CAP_ENV)
        return None
    try:
        cap = int(raw)
    except ValueError:
        raise ValueError(f"{GRACE_CAP_ENV} must be a whole number of seconds, got {raw!r}") from None
    if cap < 0:
        raise ValueError(f"{GRACE_CAP_ENV} must not be negative, got {cap}")
    return cap


def build_party_rules(grace_cap: int | None) -> dict[str, PartyRule]:
    """The production rules, with every grace period capped at ``grace_cap``."""
    if grace_cap is None:
        return dict(_PRODUCTION_PARTY_RULES)
    return {
        mode: PartyRule(rule.minimum, rule.maximum, min(rule.grace_seconds, grace_cap))
        for mode, rule in _PRODUCTION_PARTY_RULES.items()
    }


PARTY_RULES: dict[str, PartyRule] = build_party_rules(_grace_cap_from_env())

# A ticket nobody claimed by then is dropped: the tab is gone, the player is not.
TICKET_TTL_SECONDS = 300


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
    resolved = sanitize_nickname(nickname)
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


# How long a room without activity still counts as being played. `last_activity`
# is written on every guess, so a running round stays well inside this window;
# the bound exists for the opposite case, a room whose players are flagged as
# connected although their socket is long gone.
ACTIVE_ROOM_WINDOW = "-30 minutes"

# Every room table paired with its player table, so the playing count is one
# loop instead of four near-identical blocks. Arena is not in here: it carries
# three queue modes in one table and needs its own grouped query.
_ROOM_TABLES: tuple[tuple[str, str, str, str], ...] = (
    ("duel", "duels", "duel_players", "duel_id"),
    ("koop", "koops", "koop_players", "koop_id"),
    ("wordle_duel", "wordle_duels", "wordle_duel_players", "duel_id"),
)


# The seats the server fills itself. Kept out of every figure a player reads.
_SERVER_PLAYERS = "SELECT player_token FROM room_bots WHERE player_token IS NOT NULL"


async def playing_counts(db: aiosqlite.Connection) -> dict[str, int]:
    """How many players are in a live room per mode.

    Two signals, because neither is enough on its own. ``connected`` is exact
    while the WS worker is alive, and it is the only thing that knows a tab was
    closed. A recent ``last_activity`` bounds what a crashed or restarted worker
    leaves behind, since nothing clears the flag on the way out.

    Rooms from invite links count as well. The question this answers is how busy
    a mode is, not how many players came through the queue. Server players
    (``room_bots``) do not count: this is a figure about people.
    """
    counts: dict[str, int] = {mode: 0 for mode in QUEUE_MODES}

    for mode, rooms, players, fk in _ROOM_TABLES:
        cursor = await db.execute(
            f"SELECT COUNT(*) AS cnt FROM {players} p "
            f"JOIN {rooms} r ON r.id = p.{fk} "
            "WHERE p.connected = 1 AND r.last_activity > datetime('now', ?) "
            f"AND p.player_token NOT IN ({_SERVER_PLAYERS})",
            (ACTIVE_ROOM_WINDOW,),
        )
        row = await cursor.fetchone()
        counts[mode] = row["cnt"] if row else 0

    # A finished arena keeps its players connected on the result screen. They
    # are not playing, and counting them would inflate the number for as long as
    # the last tab stays open.
    cursor = await db.execute(
        "SELECT a.mode AS mode, COUNT(*) AS cnt FROM arena_players p "
        "JOIN arenas a ON a.id = p.arena_id "
        "WHERE p.connected = 1 AND a.status != 'finished' "
        "AND a.last_activity > datetime('now', ?) "
        f"AND p.player_token NOT IN ({_SERVER_PLAYERS}) GROUP BY a.mode",
        (ACTIVE_ROOM_WINDOW,),
    )
    for row in await cursor.fetchall():
        if row["mode"] in counts:
            counts[row["mode"]] = row["cnt"]

    return counts


async def live_counts(db: aiosqlite.Connection) -> dict[str, dict[str, int]]:
    """Queued and playing players per mode, for the picker before the queue.

    Every mode is present with a zero rather than omitted, so the caller never
    has to decide what a missing key means.
    """
    waiting = await waiting_counts(db)
    playing = await playing_counts(db)
    return {
        mode: {"waiting": waiting.get(mode, 0), "playing": playing.get(mode, 0)}
        for mode in QUEUE_MODES
    }


async def reset_connected_flags(db: aiosqlite.Connection) -> int:
    """Clear every connection flag. Runs once when the WS worker starts.

    No socket survives a process restart, so a flag that is still set is a
    ghost: it inflates the live figures and puts a player who left hours ago
    into the room's player list. Nothing else clears it, because the disconnect
    handler is exactly what a crash or a deploy skips.
    """
    cleared = 0
    for players in ("duel_players", "koop_players", "arena_players", "wordle_duel_players"):
        cursor = await db.execute(
            f"UPDATE {players} SET connected = 0 WHERE connected = 1"
        )
        cleared += cursor.rowcount
    await db.commit()
    return cleared


class Fill(Protocol):
    """What the queue asks of a server-player policy (``room_bots.FillPolicy``)."""

    def lone_delay(self, mode: str, ticket: str) -> float: ...
    def bots_for_lone(self, mode: str, humans: int, minimum: int, maximum: int, ticket: str) -> int: ...
    def bots_for_party(self, mode: str, humans: int, maximum: int, ticket: str) -> int: ...
    def joins_immediately(self, mode: str) -> bool: ...
    def names(self, count: int) -> list[str]: ...
    async def capacity(self, db: aiosqlite.Connection) -> int: ...
    async def attach(
        self, db: aiosqlite.Connection, mode: str, room_id: str,
        joined: list[tuple[str, str]], deferred: int, now: datetime,
    ) -> None: ...


async def run_matchmaking(
    db: aiosqlite.Connection,
    create_room,
    now: datetime | None = None,
    fill: Fill | None = None,
) -> list[dict]:
    """Form every party that can be formed right now.

    ``create_room(db, mode, nicknames)`` builds the actual room and returns
    ``(room_id, tokens)`` with one token per nickname, in the same order; this
    module deliberately knows nothing about duels, koops or arenas. Returns one
    entry per room created, with ``bots`` set to the server players it got.

    Without ``fill`` only people are paired, exactly as before. With it, a party
    that formed on its own may get server players on top, and a ticket that has
    waited alone for the policy's delay gets a room of its own.
    """
    now = now or datetime.now(timezone.utc)
    created: list[dict] = []

    for mode in QUEUE_MODES:
        rule = PARTY_RULES[mode]
        while True:
            party = await _next_party(db, mode, rule, now)
            bots = 0
            if party:
                if fill is not None:
                    bots = fill.bots_for_party(mode, len(party), rule.maximum, party[0]["ticket"])
            elif fill is not None:
                party, bots = await _lone_party(db, mode, rule, now, fill)
            if not party:
                break
            if bots and fill is not None:
                bots = min(bots, await fill.capacity(db))
                if len(party) + bots < rule.minimum:
                    # The server is at its cap. The ticket keeps waiting for a
                    # person, which is what it did before server players existed.
                    break
            room = await _claim(db, mode, party, create_room, bots, fill, now)
            if room is None:
                break
            created.append(room)

    return created


async def _lone_party(
    db: aiosqlite.Connection, mode: str, rule: PartyRule, now: datetime, fill: Fill
) -> tuple[list[aiosqlite.Row], int]:
    """The waiting tickets that get server players because nobody else came.

    Only reached when ``_next_party`` found no party of people, so a second
    person in the queue always wins the seat over a server player.
    """
    cursor = await db.execute(
        "SELECT ticket, nickname, enqueued_at FROM matchmaking_queue "
        "WHERE mode = ? AND matched_room_id IS NULL ORDER BY enqueued_at, rowid LIMIT ?",
        (mode, rule.maximum),
    )
    waiting = list(await cursor.fetchall())
    if not waiting:
        return [], 0
    oldest = parse_iso(waiting[0]["enqueued_at"])
    if oldest is None:
        return [], 0
    ticket = waiting[0]["ticket"]
    if now - oldest < timedelta(seconds=fill.lone_delay(mode, ticket)):
        return [], 0
    bots = fill.bots_for_lone(mode, len(waiting), rule.minimum, rule.maximum, ticket)
    return (waiting, bots) if bots > 0 else ([], 0)


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
    db: aiosqlite.Connection,
    mode: str,
    party: list[aiosqlite.Row],
    create_room,
    bots: int = 0,
    fill: Fill | None = None,
    now: datetime | None = None,
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

    rule = PARTY_RULES[mode]
    bots = max(0, min(bots, rule.maximum - len(claimed))) if fill is not None else 0
    if not claimed or len(claimed) + bots < rule.minimum:
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
    # Server players of a pair mode sit in the room from its first second; the
    # others arrive a few seconds later through the bot loop. Either way the
    # room is created by a person's ticket, which is always nicknames[0].
    seated = fill.names(bots) if fill is not None and bots and fill.joins_immediately(mode) else []
    # Tokens come back positionally, not keyed by nickname: two players in the
    # same room may well have typed the same name.
    room_id, tokens = await create_room(db, mode, nicknames + seated)

    stamp = iso_timestamp(datetime.now(timezone.utc))
    for row, token in zip(claimed, tokens):
        await db.execute(
            "UPDATE matchmaking_queue SET matched_room_id = ?, matched_token = ?, matched_at = ? "
            "WHERE ticket = ?",
            (room_id, token, stamp, row["ticket"]),
        )
    await db.commit()

    if fill is not None and bots:
        joined = list(zip(tokens[len(claimed):], seated))
        await fill.attach(
            db, mode, room_id, joined, bots - len(seated), now or datetime.now(timezone.utc)
        )

    return {
        "mode": mode,
        "room_id": room_id,
        "tickets": [row["ticket"] for row in claimed],
        "nicknames": nicknames,
        "bots": bots,
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
