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
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

import aiosqlite

from arena import iso_timestamp, parse_iso
from nicknames import sanitize_nickname

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


async def playing_counts(db: aiosqlite.Connection) -> dict[str, int]:
    """How many players are in a live room per mode.

    Two signals, because neither is enough on its own. ``connected`` is exact
    while the WS worker is alive, and it is the only thing that knows a tab was
    closed. A recent ``last_activity`` bounds what a crashed or restarted worker
    leaves behind, since nothing clears the flag on the way out.

    Rooms from invite links count as well. The question this answers is how busy
    a mode is, not how many players came through the queue.
    """
    counts: dict[str, int] = {mode: 0 for mode in QUEUE_MODES}

    for mode, rooms, players, fk in _ROOM_TABLES:
        cursor = await db.execute(
            f"SELECT COUNT(*) AS cnt FROM {players} p "
            f"JOIN {rooms} r ON r.id = p.{fk} "
            "WHERE p.connected = 1 AND r.last_activity > datetime('now', ?)",
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
        "AND a.last_activity > datetime('now', ?) GROUP BY a.mode",
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
