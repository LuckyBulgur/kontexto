"""Arena modes: Battle Royale, Blitz-Duell and Zeitbonus-Jagd.

All three are the same room with a different clock, so they share one table
triple instead of getting a fourth copy of the duel tables.

* **royale** eliminates the worst standing player on a shrinking schedule.
* **blitz** gives everyone one shared countdown; best rank at the end wins.
* **timerush** gives every player their own clock, which a closer guess extends.

Two rules hold for all of them:

1. **The server owns time.** Every deadline is an absolute UTC timestamp written
   here and only here. The client renders a countdown against it but never
   decides that time is up. A late guess is refused by the guess path itself, so
   an arena cannot be won by a request that arrives after the buzzer.
2. **Transitions are idempotent.** ``advance_due_arenas`` runs in the single WS
   worker, but every write is still guarded by the state it expects to find
   (``WHERE status = 'running' AND deadline_at <= ?``). A second pass over the
   same second changes nothing.
"""

from __future__ import annotations

import secrets
import string
from datetime import datetime, timedelta, timezone

import aiosqlite

from nicknames import sanitize_nickname
from rooms import RoomRevealRefused

# --- Rules ------------------------------------------------------------------

ARENA_MODES: tuple[str, ...] = ("royale", "blitz", "timerush")

# Battle Royale. The schedule starts long enough that the first round is played
# rather than panicked through, and ends short enough that the last two players
# cannot settle in. Past the last entry the final value repeats.
ROYALE_PHASE_SECONDS: tuple[int, ...] = (180, 120, 90, 60, 45, 30)
ROYALE_MAX_PLAYERS = 8

# Blitz: one shared countdown for the whole room.
BLITZ_SECONDS = 120
BLITZ_MAX_PLAYERS = 8

# Zeitbonus-Jagd: a short clock per player that only a closer guess extends. The
# cap stops a lucky streak from turning the round into an untimed game.
TIMERUSH_START_SECONDS = 60
TIMERUSH_BONUS_SECONDS = 8
TIMERUSH_MAX_SECONDS = 180
TIMERUSH_MAX_PLAYERS = 8

MAX_PLAYERS: dict[str, int] = {
    "royale": ROYALE_MAX_PLAYERS,
    "blitz": BLITZ_MAX_PLAYERS,
    "timerush": TIMERUSH_MAX_PLAYERS,
}

MIN_PLAYERS = 2

# Written to every timestamp column, fixed width so that SQLite's plain string
# comparison is a correct time comparison. datetime.isoformat() drops the
# microseconds when they are zero, which would silently break that ordering.
_TS_FORMAT = "%Y-%m-%dT%H:%M:%S.%fZ"


def iso_timestamp(moment: datetime) -> str:
    """Render a moment in the fixed-width format every timestamp column uses."""
    return moment.astimezone(timezone.utc).strftime(_TS_FORMAT)


def parse_iso(raw: str | None) -> datetime | None:
    if not raw:
        return None
    return datetime.strptime(raw, _TS_FORMAT).replace(tzinfo=timezone.utc)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _generate_id(length: int = 6) -> str:
    chars = string.ascii_letters + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))


def _generate_token() -> str:
    return secrets.token_urlsafe(32)


def _parse_played(raw: str) -> set[int]:
    return {int(p) for p in raw.split(",") if p.strip().lstrip("-").isdigit()}


def _format_played(games: set[int]) -> str:
    return ",".join(str(n) for n in sorted(games))


def royale_phase_seconds(phase: int) -> int:
    """Seconds granted for the given elimination phase (0-based)."""
    index = min(max(phase, 0), len(ROYALE_PHASE_SECONDS) - 1)
    return ROYALE_PHASE_SECONDS[index]


# --- CRUD -------------------------------------------------------------------


async def create_arena(
    db: aiosqlite.Connection,
    mode: str,
    game_number: int,
    nickname: str,
) -> dict | None:
    if mode not in ARENA_MODES:
        return None

    # One rule for every room, invite links included: an abusive name is not
    # rejected, it comes back masked and pointed at its author.
    nickname = sanitize_nickname(nickname)
    arena_id = _generate_id()
    player_token = _generate_token()
    await db.execute(
        "INSERT INTO arenas (id, mode, game_number, created_by) VALUES (?, ?, ?, ?)",
        (arena_id, mode, game_number, nickname),
    )
    await db.execute(
        "INSERT INTO arena_players (arena_id, nickname, player_token) VALUES (?, ?, ?)",
        (arena_id, nickname, player_token),
    )
    await db.commit()
    return {"arena_id": arena_id, "player_token": player_token, "mode": mode}


async def join_arena(db: aiosqlite.Connection, arena_id: str, nickname: str) -> dict | None:
    """Add a player to a lobby. Returns None when the arena cannot take them.

    Refused once the round is running: joining a Blitz countdown at second 110
    is not a game, and dropping into a Royale after two eliminations is worse.
    """
    cursor = await db.execute("SELECT mode, status FROM arenas WHERE id = ?", (arena_id,))
    arena = await cursor.fetchone()
    if not arena or arena["status"] != "lobby":
        return None

    cursor = await db.execute(
        "SELECT COUNT(*) AS cnt FROM arena_players WHERE arena_id = ?", (arena_id,)
    )
    if (await cursor.fetchone())["cnt"] >= MAX_PLAYERS[arena["mode"]]:
        return None

    # One rule for every room, invite links included: an abusive name is not
    # rejected, it comes back masked and pointed at its author.
    nickname = sanitize_nickname(nickname)
    player_token = _generate_token()
    await db.execute(
        "INSERT INTO arena_players (arena_id, nickname, player_token) VALUES (?, ?, ?)",
        (arena_id, nickname, player_token),
    )
    await db.commit()

    state = await get_arena_state(db, arena_id)
    return {"player_token": player_token, **(state or {})}


async def get_arena_state(db: aiosqlite.Connection, arena_id: str) -> dict | None:
    cursor = await db.execute("SELECT * FROM arenas WHERE id = ?", (arena_id,))
    arena = await cursor.fetchone()
    if not arena:
        return None

    cursor = await db.execute(
        "SELECT nickname, best_rank, guess_count, solved, connected, deadline_at, "
        "eliminated_at, place FROM arena_players WHERE arena_id = ? ORDER BY id",
        (arena_id,),
    )
    players = [
        {
            "nickname": row["nickname"],
            "best_rank": row["best_rank"],
            "guess_count": row["guess_count"],
            "solved": bool(row["solved"]),
            "connected": bool(row["connected"]),
            "deadline_at": row["deadline_at"],
            "eliminated": row["eliminated_at"] is not None,
            "place": row["place"],
        }
        for row in await cursor.fetchall()
    ]

    # game_number rides along for the handlers, which need it to score a guess.
    # ArenaStateResponse strips it from the HTTP answer, and the socket frame in
    # main.py strips it by hand. See rooms.py.
    return {
        "arena_id": arena_id,
        "mode": arena["mode"],
        "game_number": arena["game_number"],
        "status": arena["status"],
        "phase": arena["phase"],
        "deadline_at": arena["deadline_at"],
        "winner": arena["winner"],
        "round": arena["round"],
        # The server's own clock, shipped with every state read. A countdown
        # rendered against a deadline alone is only as correct as the device's
        # clock, and a phone that is two minutes fast would show a round that
        # ended before it began.
        "server_time": iso_timestamp(_now()),
        "players": players,
    }


async def reveal_context(
    db: aiosqlite.Connection, arena_id: str, player_token: str
) -> dict:
    """What an arena player may be told about the puzzle, or a refusal.

    An arena is still running for the others while one player is out, and an
    eliminated player sits in the same room as the survivors. So the word is
    served once the arena itself is finished, or to a player who has already
    landed rank 1 and therefore knows it anyway.
    """
    cursor = await db.execute(
        "SELECT game_number, round, status FROM arenas WHERE id = ?", (arena_id,)
    )
    arena = await cursor.fetchone()
    if not arena:
        raise RoomRevealRefused("room_not_found")

    cursor = await db.execute(
        "SELECT solved FROM arena_players WHERE arena_id = ? AND player_token = ?",
        (arena_id, player_token),
    )
    player = await cursor.fetchone()
    if not player:
        raise RoomRevealRefused("player_not_found")
    if arena["status"] != "finished" and not player["solved"]:
        raise RoomRevealRefused("round_open")

    return {"game_number": arena["game_number"], "round": arena["round"]}


async def get_player_info(db: aiosqlite.Connection, player_token: str) -> dict | None:
    cursor = await db.execute(
        "SELECT arena_id, nickname, best_rank, guess_count, solved, eliminated_at, place "
        "FROM arena_players WHERE player_token = ?",
        (player_token,),
    )
    row = await cursor.fetchone()
    return dict(row) if row else None


# --- Starting ---------------------------------------------------------------


async def start_arena(
    db: aiosqlite.Connection, arena_id: str, now: datetime | None = None
) -> dict | None:
    """Move a lobby into its running state and write the first deadline.

    Guarded on ``status = 'lobby'`` so that two players pressing start at the
    same moment cannot restart the clock on each other.
    """
    now = now or _now()
    cursor = await db.execute("SELECT mode, status FROM arenas WHERE id = ?", (arena_id,))
    arena = await cursor.fetchone()
    if not arena or arena["status"] != "lobby":
        return None

    cursor = await db.execute(
        "SELECT COUNT(*) AS cnt FROM arena_players WHERE arena_id = ?", (arena_id,)
    )
    if (await cursor.fetchone())["cnt"] < MIN_PLAYERS:
        return None

    mode = arena["mode"]
    shared_deadline: str | None = None
    if mode == "royale":
        shared_deadline = iso_timestamp(now + timedelta(seconds=royale_phase_seconds(0)))
    elif mode == "blitz":
        shared_deadline = iso_timestamp(now + timedelta(seconds=BLITZ_SECONDS))

    cursor = await db.execute(
        "UPDATE arenas SET status = 'running', started_at = ?, deadline_at = ?, "
        "last_activity = CURRENT_TIMESTAMP WHERE id = ? AND status = 'lobby'",
        (iso_timestamp(now), shared_deadline, arena_id),
    )
    if cursor.rowcount != 1:
        await db.commit()
        return None

    if mode == "timerush":
        await db.execute(
            "UPDATE arena_players SET deadline_at = ? WHERE arena_id = ?",
            (iso_timestamp(now + timedelta(seconds=TIMERUSH_START_SECONDS)), arena_id),
        )
    await db.commit()
    return await get_arena_state(db, arena_id)


# --- Guessing ---------------------------------------------------------------


class ArenaGuessRefused(Exception):
    """Why a guess was not accepted. ``code`` is what the API returns."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


async def record_arena_guess(
    db: aiosqlite.Connection,
    arena_id: str,
    player_token: str,
    word: str,
    rank: int,
    now: datetime | None = None,
) -> dict:
    """Book a guess and apply the mode's clock rule.

    Raises ArenaGuessRefused for every reason a guess must not count: the round
    is not running, the player is out, or the buzzer has already gone. The last
    one is the reason this check lives here and not only in the WS worker: the
    worker notices a passed deadline within a second, and a guess must not slip
    through that second.
    """
    now = now or _now()
    cursor = await db.execute(
        "SELECT mode, status, deadline_at FROM arenas WHERE id = ?", (arena_id,)
    )
    arena = await cursor.fetchone()
    if not arena:
        raise ArenaGuessRefused("arena_not_found")
    if arena["status"] != "running":
        raise ArenaGuessRefused("not_running")

    cursor = await db.execute(
        "SELECT id, nickname, best_rank, guess_count, eliminated_at, deadline_at "
        "FROM arena_players WHERE arena_id = ? AND player_token = ?",
        (arena_id, player_token),
    )
    player = await cursor.fetchone()
    if not player:
        raise ArenaGuessRefused("player_not_found")
    if player["eliminated_at"] is not None:
        raise ArenaGuessRefused("eliminated")

    own_deadline = player["deadline_at"] if arena["mode"] == "timerush" else arena["deadline_at"]
    if own_deadline is not None and iso_timestamp(now) >= own_deadline:
        raise ArenaGuessRefused("time_up")

    improved = player["best_rank"] is None or rank < player["best_rank"]
    new_best = rank if player["best_rank"] is None else min(player["best_rank"], rank)
    solved = rank == 1

    await db.execute(
        "INSERT INTO arena_guesses (arena_id, player_token, word, rank) VALUES (?, ?, ?, ?)",
        (arena_id, player_token, word, rank),
    )
    await db.execute(
        "UPDATE arena_players SET best_rank = ?, guess_count = ?, solved = ? WHERE id = ?",
        (new_best, player["guess_count"] + 1, solved, player["id"]),
    )

    # The deadline this player now runs against: their own clock in timerush,
    # the room's shared one otherwise. Returning it with the guess saves the
    # client a round trip and keeps its countdown on the server's clock.
    new_deadline = own_deadline
    if arena["mode"] == "timerush" and improved and not solved:
        new_deadline = iso_timestamp(_timerush_extend(parse_iso(player["deadline_at"]), now))
        await db.execute(
            "UPDATE arena_players SET deadline_at = ? WHERE id = ?",
            (new_deadline, player["id"]),
        )

    finished = False
    if solved:
        # Rank 1 ends every arena mode at once. Waiting out the clock after the
        # word is found would only make the winner sit and watch.
        finished = await _finish(db, arena_id, winner=player["nickname"], now=now)

    await db.execute(
        "UPDATE arenas SET last_activity = CURRENT_TIMESTAMP WHERE id = ?", (arena_id,)
    )
    await db.commit()

    return {
        "nickname": player["nickname"],
        "best_rank": new_best,
        "guess_count": player["guess_count"] + 1,
        "solved": solved,
        "deadline_at": new_deadline,
        "finished": finished,
    }


def _timerush_extend(deadline: datetime | None, now: datetime) -> datetime:
    """Add the bonus, capped at TIMERUSH_MAX_SECONDS from now.

    The cap is measured from now rather than from the round start, so banking
    time early cannot be used to sit out the endgame.
    """
    base = deadline if deadline and deadline > now else now
    extended = base + timedelta(seconds=TIMERUSH_BONUS_SECONDS)
    ceiling = now + timedelta(seconds=TIMERUSH_MAX_SECONDS)
    return min(extended, ceiling)


# --- The clock --------------------------------------------------------------


async def advance_due_arenas(
    db: aiosqlite.Connection, now: datetime | None = None
) -> list[dict]:
    """Apply every deadline that has passed. Returns events to broadcast.

    Runs once a second in the WS worker. Each transition is guarded by the state
    it expects, so running it twice for the same second is a no-op.
    """
    now = now or _now()
    stamp = iso_timestamp(now)
    events: list[dict] = []

    cursor = await db.execute(
        "SELECT id, mode, phase FROM arenas "
        "WHERE status = 'running' AND deadline_at IS NOT NULL AND deadline_at <= ?",
        (stamp,),
    )
    for row in await cursor.fetchall():
        if row["mode"] == "royale":
            events.extend(await _royale_deadline(db, row["id"], row["phase"], now))
        elif row["mode"] == "blitz":
            events.extend(await _blitz_deadline(db, row["id"], now))

    events.extend(await _timerush_deadlines(db, now))
    await db.commit()
    return events


async def _royale_deadline(
    db: aiosqlite.Connection, arena_id: str, phase: int, now: datetime
) -> list[dict]:
    """Drop the worst standing player, then open the next, shorter phase."""
    alive = await _alive_players(db, arena_id)
    if not alive:
        await _finish(db, arena_id, winner=None, now=now)
        return [{"arena_id": arena_id, "type": "arena_finished", "winner": None}]

    # Worst standing first: no guess at all is worse than any rank, and among
    # equal ranks the player who needed more guesses goes.
    victim = max(alive, key=lambda p: (p["best_rank"] is None, p["best_rank"] or 0, p["guess_count"]))
    remaining = [p for p in alive if p["id"] != victim["id"]]

    await db.execute(
        "UPDATE arena_players SET eliminated_at = ?, place = ? WHERE id = ? AND eliminated_at IS NULL",
        (iso_timestamp(now), len(remaining) + 1, victim["id"]),
    )
    events = [
        {"arena_id": arena_id, "type": "player_eliminated", "nickname": victim["nickname"],
         "place": len(remaining) + 1}
    ]

    if len(remaining) <= 1:
        winner = remaining[0]["nickname"] if remaining else None
        if remaining:
            await db.execute(
                "UPDATE arena_players SET place = 1 WHERE id = ?", (remaining[0]["id"],)
            )
        await _finish(db, arena_id, winner=winner, now=now)
        events.append({"arena_id": arena_id, "type": "arena_finished", "winner": winner})
        return events

    next_phase = phase + 1
    next_deadline = iso_timestamp(now + timedelta(seconds=royale_phase_seconds(next_phase)))
    await db.execute(
        "UPDATE arenas SET phase = ?, deadline_at = ? WHERE id = ? AND status = 'running' AND phase = ?",
        (next_phase, next_deadline, arena_id, phase),
    )
    events.append({
        "arena_id": arena_id,
        "type": "phase_started",
        "phase": next_phase,
        "deadline_at": next_deadline,
    })
    return events


async def _blitz_deadline(db: aiosqlite.Connection, arena_id: str, now: datetime) -> list[dict]:
    """The shared countdown ran out: the best rank in the room wins."""
    players = await _alive_players(db, arena_id)
    ranked = [p for p in players if p["best_rank"] is not None]
    winner = min(ranked, key=lambda p: (p["best_rank"], p["guess_count"]))["nickname"] if ranked else None
    if winner:
        await db.execute(
            "UPDATE arena_players SET place = 1 WHERE arena_id = ? AND nickname = ?",
            (arena_id, winner),
        )
    await _finish(db, arena_id, winner=winner, now=now)
    return [{"arena_id": arena_id, "type": "arena_finished", "winner": winner}]


async def _timerush_deadlines(db: aiosqlite.Connection, now: datetime) -> list[dict]:
    """Retire every player whose own clock has run out, and close empty arenas."""
    stamp = iso_timestamp(now)
    cursor = await db.execute(
        "SELECT p.id, p.arena_id, p.nickname FROM arena_players p "
        "JOIN arenas a ON a.id = p.arena_id "
        "WHERE a.mode = 'timerush' AND a.status = 'running' "
        "AND p.eliminated_at IS NULL AND p.deadline_at IS NOT NULL AND p.deadline_at <= ?",
        (stamp,),
    )
    expired = await cursor.fetchall()

    events: list[dict] = []
    touched: set[str] = set()
    for row in expired:
        await db.execute(
            "UPDATE arena_players SET eliminated_at = ? WHERE id = ? AND eliminated_at IS NULL",
            (stamp, row["id"]),
        )
        events.append({"arena_id": row["arena_id"], "type": "player_eliminated",
                       "nickname": row["nickname"], "place": None})
        touched.add(row["arena_id"])

    for arena_id in touched:
        alive = await _alive_players(db, arena_id)
        if len(alive) > 1:
            continue
        winner = alive[0]["nickname"] if alive else None
        if alive:
            await db.execute("UPDATE arena_players SET place = 1 WHERE id = ?", (alive[0]["id"],))
        await _finish(db, arena_id, winner=winner, now=now)
        events.append({"arena_id": arena_id, "type": "arena_finished", "winner": winner})

    return events


async def _alive_players(db: aiosqlite.Connection, arena_id: str) -> list[aiosqlite.Row]:
    cursor = await db.execute(
        "SELECT id, nickname, best_rank, guess_count FROM arena_players "
        "WHERE arena_id = ? AND eliminated_at IS NULL ORDER BY id",
        (arena_id,),
    )
    return list(await cursor.fetchall())


async def _finish(
    db: aiosqlite.Connection, arena_id: str, winner: str | None, now: datetime
) -> bool:
    """Close a running arena. Returns True when this call was the one that closed it."""
    cursor = await db.execute(
        "UPDATE arenas SET status = 'finished', winner = ?, finished_at = ?, deadline_at = NULL "
        "WHERE id = ? AND status = 'running'",
        (winner, iso_timestamp(now), arena_id),
    )
    return cursor.rowcount == 1


# --- Rematch and cleanup ----------------------------------------------------


async def advance_arena_game(db: aiosqlite.Connection, arena_id: str, pick_next) -> int | None:
    """Put a finished arena back into its lobby on a fresh game."""
    cursor = await db.execute(
        "SELECT game_number, played_games, status FROM arenas WHERE id = ?", (arena_id,)
    )
    row = await cursor.fetchone()
    if not row or row["status"] != "finished":
        return None

    current = row["game_number"]
    new_game = pick_next(current, _parse_played(row["played_games"]))
    if new_game is None:
        return None

    await db.execute(
        "UPDATE arenas SET game_number = ?, round = round + 1, played_games = ?, "
        "status = 'lobby', phase = 0, deadline_at = NULL, started_at = NULL, "
        "finished_at = NULL, winner = NULL, last_activity = CURRENT_TIMESTAMP "
        "WHERE id = ? AND status = 'finished'",
        (new_game, _format_played(_parse_played(row["played_games"]) | {current}), arena_id),
    )
    await db.execute("DELETE FROM arena_guesses WHERE arena_id = ?", (arena_id,))
    await db.execute(
        "UPDATE arena_players SET best_rank = NULL, guess_count = 0, solved = 0, "
        "deadline_at = NULL, eliminated_at = NULL, place = NULL WHERE arena_id = ?",
        (arena_id,),
    )
    await db.commit()
    return new_game


async def get_player_history(
    db: aiosqlite.Connection, arena_id: str, player_token: str
) -> list[dict]:
    cursor = await db.execute(
        "SELECT word, rank, guessed_at FROM arena_guesses "
        "WHERE arena_id = ? AND player_token = ? ORDER BY id",
        (arena_id, player_token),
    )
    return [dict(row) for row in await cursor.fetchall()]


async def set_player_connected(
    db: aiosqlite.Connection, player_token: str, connected: bool
) -> str | None:
    cursor = await db.execute(
        "SELECT arena_id FROM arena_players WHERE player_token = ?", (player_token,)
    )
    row = await cursor.fetchone()
    if not row:
        return None

    arena_id = row["arena_id"]
    await db.execute(
        "UPDATE arena_players SET connected = ? WHERE player_token = ?",
        (connected, player_token),
    )
    if not connected:
        await db.execute(
            "UPDATE arenas SET last_activity = CURRENT_TIMESTAMP WHERE id = ?", (arena_id,)
        )
    await db.commit()
    return arena_id


async def cleanup_stale_arenas(db: aiosqlite.Connection) -> int:
    """Delete arenas with nobody connected and no activity for an hour."""
    cursor = await db.execute(
        "SELECT a.id FROM arenas a "
        "LEFT JOIN arena_players p ON a.id = p.arena_id AND p.connected = 1 "
        "WHERE p.id IS NULL AND a.last_activity < datetime('now', '-1 hour')"
    )
    stale = [row["id"] for row in await cursor.fetchall()]
    for arena_id in stale:
        await db.execute("DELETE FROM arena_guesses WHERE arena_id = ?", (arena_id,))
        await db.execute("DELETE FROM arena_players WHERE arena_id = ?", (arena_id,))
        await db.execute("DELETE FROM arenas WHERE id = ?", (arena_id,))
    await db.commit()
    return len(stale)
