"""Server-side players for matchmaking rooms.

The random queue only works when enough people queue at the same moment, and
most of the time they do not: a lone player waited out the whole ticket. So a
matchmaking room is topped up with players the server runs itself. They join
through the same ``join_*`` functions a person uses, write their guesses through
the same ``record_*`` functions, and reach the other players through the same
database-polling broadcast, so a room cannot tell them apart from a person.

What they are allowed to do is narrow, and every limit is deliberate:

* **Only matchmaking rooms, and only with a person in them.** No invite-link
  room, no live-stream room, no room made of bots alone, no queue ticket.
* **They count nowhere.** No analytics counter, no guess log, no live figure
  (``matchmaking.playing_counts`` excludes them). The guess log is evidence the
  lexicon build reads ("guessed at least ten times on production"), and a
  server that types into it would be measuring itself.
* **They play fair.** A Kontexto player never looks at more than the ranks the
  room already shows it and its own guesses, never takes a tip, never gives up
  and never presses "Nächstes Spiel". In an arena lobby one of them presses
  start after a while, because any stranger may, and a person alone with them
  would otherwise wait for a button nobody else presses. A Wordle player sees only its own colours.
  The words it types come from the handout-safe hint list
  (``GameState.word_near_rank``), so nothing it writes into a koop feed is a
  word the game would refuse to name.
* **They play a little worse than a person.** The model below was calibrated
  with ``scripts/simulate-bots.py`` against the measured production median of
  about 35 guesses; see the constants for the numbers it produced.

Everything runs in the WS worker, which is the single writer for every other
loop too (``main._bots_loop``). State lives in ``room_bots``, so a deploy picks
up where the last process stopped. The switch is ``KONTEXTO_BOTS=0``.
"""

from __future__ import annotations

import hashlib
import logging
import math
import os
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal, Protocol

import aiosqlite

from arena import (
    ArenaGuessRefused,
    iso_timestamp,
    join_arena,
    parse_iso,
    record_arena_guess,
    set_player_connected as set_arena_connected,
    start_arena,
)
from duel import record_guess as record_duel_guess, set_player_connected as set_duel_connected
from koop import join_koop, record_koop_guess, set_player_connected as set_koop_connected
from nicknames import generate_nickname, sanitize_nickname
from wordle import evaluate
from wordle_duel import (
    MAX_GUESSES as WORDLE_MAX_GUESSES,
    get_wordle_player_history,
    record_wordle_guess,
    set_wordle_player_connected,
)

logger = logging.getLogger(__name__)

BOTS_ENV = "KONTEXTO_BOTS"

# Bounds on what the server spends on this. Sixty players cost a few thousand
# cheap queries a minute; past that a real surge is filling the rooms anyway.
MAX_ACTIVE_BOTS = 60
# Moves per loop pass. A pass that runs behind catches up on the next one,
# because a due move stays due.
MAX_MOVES_PER_PASS = 120
# A server player that has been in one room this long leaves, whatever happens.
MAX_LIFETIME = timedelta(hours=3)
# Seconds an arena lobby with a person in it stays open before a server player
# presses start, drawn per player and round.
LOBBY_START_AFTER = (15.0, 40.0)
# A staggered join that could not happen by then is dropped.
PENDING_JOIN_TTL = timedelta(minutes=5)


def bots_enabled() -> bool:
    """On unless ``KONTEXTO_BOTS`` is set to 0, false or off."""
    return os.environ.get(BOTS_ENV, "1").strip().lower() not in {"0", "false", "off", "no"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _seeded(*parts: object) -> random.Random:
    """A generator that gives the same draws for the same key, in every worker."""
    digest = hashlib.sha256(":".join(str(p) for p in parts).encode()).digest()
    return random.Random(int.from_bytes(digest[:8], "big"))


# --- Names --------------------------------------------------------------------

# About a third of the people in the queue type a name. A room where every
# stranger carries a generated one would be a room that looks generated.
_TYPED_NAMES = (
    "Lena", "Mia", "Emma", "Hannah", "Lea", "Sophie", "Marie", "Anna", "Laura",
    "Julia", "Lara", "Nele", "Clara", "Jana", "Paula", "Ida", "Frieda", "Greta",
    "Max", "Paul", "Leon", "Lukas", "Jonas", "Tim", "Finn", "Felix", "Ben",
    "Noah", "Elias", "Jan", "Nico", "Tobi", "Basti", "Flo", "Moritz", "Emil",
    "Oskar", "Anton", "Jakob", "Mats", "Kai", "Tom", "Ole", "Linus", "Henri",
)


def bot_nickname(rng: random.Random | None = None) -> str:
    """A name in one of the shapes people actually use in the queue."""
    rng = rng or random.Random()
    roll = rng.random()
    if roll < 0.62:
        return generate_nickname()
    base = rng.choice(_TYPED_NAMES)
    if roll < 0.78:
        name = base
    elif roll < 0.90:
        name = f"{base}{rng.randint(1, 99)}"
    else:
        name = base.lower()
    return sanitize_nickname(name)


# --- Filling rooms ------------------------------------------------------------


@dataclass(frozen=True)
class FillRule:
    """When a mode gets server players, and how many.

    ``lone_after`` is the wait in seconds before a player alone in the queue
    gets company; the value for one ticket is drawn inside the range from the
    ticket itself, so every pass of the loop agrees on it. ``sizes`` is the room
    size the fill aims for. ``party_chance`` is how often a party of people that
    formed on its own gets one to three more players on top.
    """

    lone_after: tuple[int, int]
    sizes: tuple[int, int]
    party_chance: float


FILL_RULES: dict[str, FillRule] = {
    "duel": FillRule(lone_after=(8, 15), sizes=(2, 2), party_chance=0.0),
    "wordle_duel": FillRule(lone_after=(8, 15), sizes=(2, 2), party_chance=0.0),
    # The group modes wait at least their own grace period first, so a second
    # person who is about to arrive is never beaten to the seat.
    "koop": FillRule(lone_after=(16, 24), sizes=(2, 3), party_chance=0.4),
    "blitz": FillRule(lone_after=(13, 20), sizes=(3, 5), party_chance=0.4),
    "timerush": FillRule(lone_after=(16, 23), sizes=(3, 5), party_chance=0.4),
    "royale": FillRule(lone_after=(26, 34), sizes=(4, 7), party_chance=0.4),
}

# Modes whose server players are in the room from its first second, because the
# room is a pair and a pair with an empty seat is not a game. The others join a
# few seconds later, one by one, the way people drop into a lobby.
IMMEDIATE_MODES = frozenset({"duel", "wordle_duel"})
STAGGER_SECONDS = (1.0, 6.0)


class FillPolicy:
    """Decides the server players of a party. Handed to ``run_matchmaking``.

    Every draw is keyed on the oldest ticket of the party, so the decision is
    the same on every pass until the party is actually built.
    """

    def __init__(self, rules: dict[str, FillRule] | None = None, cap: int = MAX_ACTIVE_BOTS) -> None:
        self.rules = rules or FILL_RULES
        self.cap = cap

    def lone_delay(self, mode: str, ticket: str) -> float:
        low, high = self.rules[mode].lone_after
        return _seeded("lone", mode, ticket).uniform(low, high)

    def bots_for_lone(self, mode: str, humans: int, minimum: int, maximum: int, ticket: str) -> int:
        rule = self.rules[mode]
        target = _seeded("size", mode, ticket).randint(*rule.sizes)
        target = min(max(target, minimum), maximum)
        return max(0, target - humans)

    def bots_for_party(self, mode: str, humans: int, maximum: int, ticket: str) -> int:
        rule = self.rules[mode]
        rng = _seeded("party", mode, ticket)
        if humans >= maximum or rng.random() >= rule.party_chance:
            return 0
        target = max(humans + 1, rng.randint(*rule.sizes))
        return max(0, min(target, maximum, humans + 3) - humans)

    def joins_immediately(self, mode: str) -> bool:
        return mode in IMMEDIATE_MODES

    def names(self, count: int) -> list[str]:
        return [bot_nickname() for _ in range(count)]

    async def capacity(self, db: aiosqlite.Connection) -> int:
        cursor = await db.execute("SELECT COUNT(*) AS cnt FROM room_bots")
        row = await cursor.fetchone()
        return max(0, self.cap - (row["cnt"] if row else 0))

    async def attach(
        self,
        db: aiosqlite.Connection,
        mode: str,
        room_id: str,
        joined: list[tuple[str, str]],
        deferred: int,
        now: datetime,
    ) -> None:
        """Register the server players of a room that was just built.

        ``joined`` holds ``(token, nickname)`` for players already in the room;
        ``deferred`` is how many more join on their own a few seconds later.
        """
        rng = random.Random()
        for token, name in joined:
            await _insert_bot(db, mode, room_id, token, name, now, now, rng)
            await _set_connected(db, mode, room_id, token, True)
        offset = 0.0
        for _ in range(deferred):
            offset += rng.uniform(*STAGGER_SECONDS)
            await _insert_bot(
                db, mode, room_id, None, bot_nickname(rng), now + timedelta(seconds=offset), now, rng
            )
        await db.commit()


async def _insert_bot(
    db: aiosqlite.Connection,
    mode: str,
    room_id: str,
    token: str | None,
    nickname: str,
    due: datetime,
    now: datetime,
    rng: random.Random,
) -> None:
    await db.execute(
        "INSERT INTO room_bots (mode, room_id, player_token, nickname, skill, openers, "
        "patience_seconds, rounds_left, round, next_action_at, human_seen_at, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)",
        (
            mode, room_id, token, nickname, draw_skill(rng), rng.randint(1, 3),
            rng.randint(20, 60), draw_rounds(rng), iso_timestamp(due),
            iso_timestamp(now), iso_timestamp(now),
        ),
    )


def draw_skill(rng: random.Random) -> float:
    """Per player, 0 is weak and 1 is strong. Centred low on purpose."""
    return min(0.95, max(0.05, rng.gauss(SKILL_MEAN, SKILL_SD)))


def draw_rounds(rng: random.Random) -> int:
    """How many rounds a server player stays for. Most people play one or two."""
    return rng.choices((1, 2, 3, 4, 5), weights=(30, 30, 20, 12, 8))[0]


# --- Kontexto: the guess model ------------------------------------------------

# Calibrated with scripts/simulate-bots.py (synthetic scale of 50.908 words at
# the production hint density, 4.000 rounds, seed 20260930, 2026-09-30):
# median 43 guesses, p10 26, p90 68, 4,2% over 80, every round solved. A person
# drawn from the production curve (median 35, 4% over 80) wins 62,7% of duels
# against one server player. The first draft improved twice as fast and played
# at median 16, which no person does.
SKILL_MEAN = 0.42
SKILL_SD = 0.18
# Chance of a guess that is worse than the best so far, falling with skill.
REGRESS_BASE = 0.50
REGRESS_SKILL = 0.14
# An improving guess lands at best * U(IMPROVE_LOW, high), high falling with skill.
IMPROVE_LOW = 0.65
IMPROVE_HIGH_WEAK = 1.05
IMPROVE_HIGH_STRONG = 0.90
# Chance of naming the solution outright, by best rank so far.
SOLVE_BANDS: tuple[tuple[int, float], ...] = (
    (2, 0.50), (5, 0.26), (10, 0.12), (25, 0.05), (60, 0.018), (200, 0.004),
)
# A round that runs this long has the server player close in regardless: a
# person who is stuck starts using the words the others have shown.
GUESS_SOFT_CAP = 110

OPENERS = (
    "haus", "wasser", "mensch", "tier", "stadt", "essen", "auto", "baum",
    "arbeit", "kind", "musik", "farbe", "körper", "maschine", "kleidung",
    "sport", "tisch", "papier", "wetter", "schule", "liebe", "zeit", "geld",
    "natur", "familie", "reise", "buch", "himmel", "licht", "spiel",
)


@dataclass(frozen=True)
class KontextoMove:
    kind: Literal["opener", "solve", "near"]
    rank: int = 0


def solve_chance(skill: float, best: int) -> float:
    for bound, chance in SOLVE_BANDS:
        if best <= bound:
            return chance * (0.6 + 0.8 * skill)
    return 0.0


def plan_kontexto_move(
    rng: random.Random, skill: float, best: int | None, own_guesses: int, openers: int
) -> KontextoMove:
    """The next move, from the best rank so far and nothing else."""
    if best is None or own_guesses < openers:
        return KontextoMove("opener")
    if rng.random() < solve_chance(skill, best):
        return KontextoMove("solve")
    stuck = own_guesses >= GUESS_SOFT_CAP
    if not stuck and rng.random() < REGRESS_BASE - REGRESS_SKILL * skill:
        return KontextoMove("near", int(best * rng.uniform(1.3, 8.0)) + 1)
    high = IMPROVE_HIGH_WEAK - (IMPROVE_HIGH_WEAK - IMPROVE_HIGH_STRONG) * skill
    if stuck:
        high = IMPROVE_HIGH_STRONG
    return KontextoMove("near", max(2, int(best * rng.uniform(IMPROVE_LOW, high))))


# --- Wordle: the guess model --------------------------------------------------

WORDLE_STARTERS = (
    "arien", "tiere", "reise", "seite", "liebe", "raten", "leser", "nasen",
    "meter", "ernte", "stein", "hose", "adler", "tante", "regen",
)


def consistent(word: str, history: list[tuple[str, list[str]]]) -> bool:
    return all(evaluate(guess, word) == result for guess, result in history)


def plan_wordle_guess(
    rng: random.Random,
    skill: float,
    history: list[tuple[str, list[str]]],
    solutions: list[str],
    valid: set[str],
) -> str:
    """A guess that fits every colour so far, drawn the way a person draws one.

    A strong player picks among the words that could be the answer; a weaker one
    reaches more often for any word that fits, which wastes a row now and then.
    """
    used = {guess for guess, _ in history}
    if not history:
        starters = [w for w in WORDLE_STARTERS if w in valid]
        if starters and rng.random() < 0.6:
            return rng.choice(starters)
        return rng.choice(solutions)
    candidates = [w for w in solutions if w not in used and consistent(w, history)]
    if rng.random() < 0.45 * (1.0 - skill):
        pool = [w for w in valid if w not in used and consistent(w, history)]
        if pool:
            return rng.choice(pool)
    if candidates:
        return rng.choice(candidates)
    fallback = [w for w in solutions if w not in used]
    return rng.choice(fallback or solutions)


# --- Pace -----------------------------------------------------------------------

# Median seconds between two guesses, and the spread of a log-normal around it.
# Arena clocks push people, and a Wordle row takes thought.
_PACE: dict[str, tuple[float, float, float, float]] = {
    # mode: (median, sigma, floor, ceiling)
    "duel": (9.0, 0.55, 2.5, 45.0),
    "koop": (11.0, 0.6, 3.0, 50.0),
    "blitz": (5.5, 0.45, 2.0, 20.0),
    "timerush": (5.5, 0.45, 2.0, 18.0),
    "royale": (6.5, 0.5, 2.0, 25.0),
    "wordle_duel": (20.0, 0.5, 6.0, 70.0),
}


def think_seconds(mode: str, rng: random.Random) -> float:
    median, sigma, floor, ceiling = _PACE[mode]
    return min(ceiling, max(floor, rng.lognormvariate(math.log(median), sigma)))


def first_move_seconds(mode: str, rng: random.Random) -> float:
    """A person reads the board before the first word."""
    if mode == "wordle_duel":
        return rng.uniform(8.0, 20.0)
    if mode in ("blitz", "timerush", "royale"):
        return rng.uniform(2.5, 7.0)
    return rng.uniform(4.0, 14.0)


# --- Rooms --------------------------------------------------------------------

_PLAYER_TABLES: dict[str, tuple[str, str]] = {
    "duel": ("duel_players", "duel_id"),
    "koop": ("koop_players", "koop_id"),
    "wordle_duel": ("wordle_duel_players", "duel_id"),
    "royale": ("arena_players", "arena_id"),
    "blitz": ("arena_players", "arena_id"),
    "timerush": ("arena_players", "arena_id"),
}

BOT_TOKENS_SQL = "SELECT player_token FROM room_bots WHERE player_token IS NOT NULL"


@dataclass
class RoomView:
    """What a server player may know about its room, and nothing more."""

    round: int
    game_number: int
    can_guess: bool
    humans_connected: int
    used_ranks: set[int]
    best: int | None
    own_guesses: int
    wordle_history: list[tuple[str, list[str]]]
    # Arena only: seconds the lobby has been open, None outside a lobby.
    lobby_age: float | None = None


async def _humans_connected(db: aiosqlite.Connection, mode: str, room_id: str) -> int:
    table, fk = _PLAYER_TABLES[mode]
    cursor = await db.execute(
        f"SELECT COUNT(*) AS cnt FROM {table} WHERE {fk} = ? AND connected = 1 "
        f"AND player_token NOT IN ({BOT_TOKENS_SQL})",
        (room_id,),
    )
    row = await cursor.fetchone()
    return row["cnt"] if row else 0


async def _set_connected(
    db: aiosqlite.Connection, mode: str, room_id: str, token: str, connected: bool
) -> None:
    if mode == "duel":
        await set_duel_connected(db, token, connected)
    elif mode == "koop":
        await set_koop_connected(db, token, connected)
    elif mode == "wordle_duel":
        await set_wordle_player_connected(db, room_id, token, connected)
    else:
        await set_arena_connected(db, token, connected)


async def _ranks(db: aiosqlite.Connection, sql: str, params: tuple) -> list[int]:
    cursor = await db.execute(sql, params)
    return [row["rank"] for row in await cursor.fetchall()]


async def room_view(
    db: aiosqlite.Connection, mode: str, room_id: str, token: str, now: datetime | None = None
) -> RoomView | None:
    """The room as this player sees it, or None when the room or seat is gone."""
    humans = await _humans_connected(db, mode, room_id)

    if mode == "duel":
        cursor = await db.execute("SELECT game_number, round FROM duels WHERE id = ?", (room_id,))
        room = await cursor.fetchone()
        cursor = await db.execute(
            "SELECT solved FROM duel_players WHERE duel_id = ? AND player_token = ?",
            (room_id, token),
        )
        me = await cursor.fetchone()
        if room is None or me is None:
            return None
        own = await _ranks(
            db, "SELECT rank FROM duel_guesses WHERE duel_id = ? AND player_token = ?",
            (room_id, token),
        )
        return RoomView(room["round"], room["game_number"], not me["solved"], humans,
                        set(own), min(own) if own else None, len(own), [])

    if mode == "koop":
        cursor = await db.execute(
            "SELECT game_number, round, solved, gave_up, best_rank FROM koops WHERE id = ?",
            (room_id,),
        )
        room = await cursor.fetchone()
        cursor = await db.execute(
            "SELECT 1 FROM koop_players WHERE koop_id = ? AND player_token = ?", (room_id, token)
        )
        if room is None or await cursor.fetchone() is None:
            return None
        cursor = await db.execute(
            "SELECT rank, player_token FROM koop_guesses WHERE koop_id = ?", (room_id,)
        )
        rows = await cursor.fetchall()
        # The shared list is the one thing a koop player sees of the others,
        # and a teammate builds on it, which is what makes this a team.
        team = {row["rank"] for row in rows}
        own_count = sum(1 for row in rows if row["player_token"] == token)
        open_round = not room["solved"] and not room["gave_up"]
        return RoomView(room["round"], room["game_number"], open_round, humans,
                        team, room["best_rank"], own_count, [])

    if mode == "wordle_duel":
        cursor = await db.execute(
            "SELECT game_number, round FROM wordle_duels WHERE id = ?", (room_id,)
        )
        room = await cursor.fetchone()
        cursor = await db.execute(
            "SELECT guesses_used, solved FROM wordle_duel_players "
            "WHERE duel_id = ? AND player_token = ?",
            (room_id, token),
        )
        me = await cursor.fetchone()
        if room is None or me is None:
            return None
        history = [
            (entry["word"], entry["result"])
            for entry in await get_wordle_player_history(db, room_id, token)
        ]
        can_guess = not me["solved"] and (me["guesses_used"] or 0) < WORDLE_MAX_GUESSES
        return RoomView(room["round"], room["game_number"], can_guess, humans,
                        set(), None, len(history), history)

    # last_activity is written by CURRENT_TIMESTAMP when the lobby opens (the
    # room is created or a rematch puts it back), so its age is the lobby's.
    stamp = (now or _now()).strftime("%Y-%m-%d %H:%M:%S")
    cursor = await db.execute(
        "SELECT game_number, round, status, "
        "(julianday(?) - julianday(last_activity)) * 86400.0 AS lobby_age "
        "FROM arenas WHERE id = ?",
        (stamp, room_id),
    )
    room = await cursor.fetchone()
    cursor = await db.execute(
        "SELECT solved, eliminated_at FROM arena_players WHERE arena_id = ? AND player_token = ?",
        (room_id, token),
    )
    me = await cursor.fetchone()
    if room is None or me is None:
        return None
    own = await _ranks(
        db, "SELECT rank FROM arena_guesses WHERE arena_id = ? AND player_token = ?",
        (room_id, token),
    )
    can_guess = room["status"] == "running" and me["eliminated_at"] is None and not me["solved"]
    lobby_age = float(room["lobby_age"]) if room["status"] == "lobby" else None
    return RoomView(room["round"], room["game_number"], can_guess, humans,
                    set(own), min(own) if own else None, len(own), [], lobby_age)


# --- The loop -------------------------------------------------------------------


class GameSource(Protocol):
    """The slice of ``game.GameState`` a server player needs."""

    def guess(self, word: str, game_number: int, correct_typos: bool = True) -> dict | None: ...
    def word_near_rank(self, game_number: int, rank: int, used_ranks: set[int]) -> dict | None: ...
    def get_target_word(self, game_number: int) -> str: ...


class WordleSource(Protocol):
    solutions: list[str]
    all_valid: set[str]

    def get_solution(self, game_number: int) -> str: ...


async def restore_connections(db: aiosqlite.Connection) -> int:
    """Mark every seated server player connected again after a restart.

    ``matchmaking.reset_connected_flags`` clears every flag when the WS worker
    starts, because no socket survives a restart. A server player has no socket
    and would stay "disconnected" for good, so it is set back right after.
    """
    restored = 0
    for table in {t for t, _ in _PLAYER_TABLES.values()}:
        cursor = await db.execute(
            f"UPDATE {table} SET connected = 1 WHERE player_token IN ({BOT_TOKENS_SQL})"
        )
        restored += cursor.rowcount
    await db.commit()
    return restored


async def prune_orphans(db: aiosqlite.Connection, now: datetime | None = None) -> int:
    """Drop server players whose seat is gone, and joins that never happened."""
    now = now or _now()
    removed = 0
    seated = " UNION ".join(
        f"SELECT player_token FROM {t}" for t in sorted({t for t, _ in _PLAYER_TABLES.values()})
    )
    cursor = await db.execute(
        f"DELETE FROM room_bots WHERE player_token IS NOT NULL AND player_token NOT IN ({seated})"
    )
    removed += cursor.rowcount
    cursor = await db.execute(
        "DELETE FROM room_bots WHERE player_token IS NULL AND created_at < ?",
        (iso_timestamp(now - PENDING_JOIN_TTL),),
    )
    removed += cursor.rowcount
    await db.commit()
    return removed


async def run_bots(
    db: aiosqlite.Connection,
    games: GameSource,
    wordle: WordleSource | None,
    now: datetime | None = None,
    rng: random.Random | None = None,
) -> int:
    """Make every move that is due. Returns how many server players acted."""
    now = now or _now()
    rng = rng or random.Random()
    cursor = await db.execute(
        "SELECT * FROM room_bots WHERE next_action_at <= ? ORDER BY next_action_at LIMIT ?",
        (iso_timestamp(now), MAX_MOVES_PER_PASS),
    )
    acted = 0
    for row in await cursor.fetchall():
        try:
            await _step(db, dict(row), games, wordle, now, rng)
            acted += 1
        except Exception:
            # One room in a bad state must not stop every other one. The move is
            # pushed back so a persistent fault costs a log line a minute, not a
            # log line a second.
            logger.exception("server player %s in %s failed", row["id"], row["room_id"])
            await db.execute(
                "UPDATE room_bots SET next_action_at = ? WHERE id = ?",
                (iso_timestamp(now + timedelta(seconds=60)), row["id"]),
            )
            await db.commit()
    return acted


async def _schedule(db: aiosqlite.Connection, bot_id: int, when: datetime, **fields: object) -> None:
    sets = ", ".join(f"{name} = ?" for name in fields)
    values = list(fields.values())
    sql = f"UPDATE room_bots SET next_action_at = ?{', ' + sets if sets else ''} WHERE id = ?"
    await db.execute(sql, (iso_timestamp(when), *values, bot_id))
    await db.commit()


async def _leave(db: aiosqlite.Connection, bot: dict) -> None:
    if bot["player_token"] is not None:
        await _set_connected(db, bot["mode"], bot["room_id"], bot["player_token"], False)
    await db.execute("DELETE FROM room_bots WHERE id = ?", (bot["id"],))
    await db.commit()


async def _join(db: aiosqlite.Connection, bot: dict, now: datetime, rng: random.Random) -> None:
    """A staggered join: take a seat now, or give up when there is none."""
    mode, room_id = bot["mode"], bot["room_id"]
    if mode == "koop":
        joined = await join_koop(db, room_id, bot["nickname"])
    elif mode in ("royale", "blitz", "timerush"):
        # Refused once the round runs or the lobby is full, exactly like a person.
        joined = await join_arena(db, room_id, bot["nickname"])
    else:
        joined = None
    if not joined:
        await db.execute("DELETE FROM room_bots WHERE id = ?", (bot["id"],))
        await db.commit()
        return
    token = joined["player_token"]
    await db.execute(
        "UPDATE room_bots SET player_token = ?, nickname = ? WHERE id = ?",
        (token, joined.get("nickname", bot["nickname"]), bot["id"]),
    )
    await _set_connected(db, mode, room_id, token, True)
    await _schedule(db, bot["id"], now + timedelta(seconds=rng.uniform(1.0, 3.0)))


async def _step(
    db: aiosqlite.Connection,
    bot: dict,
    games: GameSource,
    wordle: WordleSource | None,
    now: datetime,
    rng: random.Random,
) -> None:
    if bot["player_token"] is None:
        await _join(db, bot, now, rng)
        return

    mode, room_id, token = bot["mode"], bot["room_id"], bot["player_token"]
    view = await room_view(db, mode, room_id, token, now)
    if view is None:
        await db.execute("DELETE FROM room_bots WHERE id = ?", (bot["id"],))
        await db.commit()
        return

    human_seen = parse_iso(bot["human_seen_at"]) or now
    if view.humans_connected > 0:
        human_seen = now
    elif (now - human_seen).total_seconds() > bot["patience_seconds"]:
        # Everybody left. A person would close the tab too.
        await _leave(db, bot)
        return
    created = parse_iso(bot["created_at"]) or now
    if now - created > MAX_LIFETIME:
        await _leave(db, bot)
        return

    if view.round != bot["round"]:
        rounds_left = bot["rounds_left"]
        if bot["round"] != 0:
            # "Nächstes Spiel" was pressed. Whether to stay for it is decided
            # here, the way a person decides when the next board appears.
            rounds_left -= 1
            if rounds_left <= 0:
                await _leave(db, bot)
                return
        await _schedule(
            db, bot["id"], now + timedelta(seconds=first_move_seconds(mode, rng)),
            round=view.round, rounds_left=rounds_left, human_seen_at=iso_timestamp(human_seen),
        )
        return

    if view.humans_connected > 0 and view.lobby_age is not None:
        patience = _seeded("start", bot["id"], view.round).uniform(*LOBBY_START_AFTER)
        if view.lobby_age >= patience:
            # Guarded on status = 'lobby' inside, so two server players reaching
            # this in the same pass start the round once.
            await start_arena(db, room_id, now)

    if view.humans_connected == 0 or not view.can_guess:
        # Nobody to play against yet, the lobby has not started, or this
        # player's round is over. Look again after a person's reaction time.
        await _schedule(
            db, bot["id"], now + timedelta(seconds=rng.uniform(2.5, 7.0)),
            human_seen_at=iso_timestamp(human_seen),
        )
        return

    if mode == "wordle_duel":
        if wordle is None:
            await _leave(db, bot)
            return
        await _wordle_move(db, bot, view, wordle, rng)
    else:
        await _kontexto_move(db, bot, view, games, now, rng)

    await _schedule(
        db, bot["id"], now + timedelta(seconds=think_seconds(mode, rng)),
        human_seen_at=iso_timestamp(human_seen),
    )


def _pick_kontexto_word(
    bot: dict, view: RoomView, games: GameSource, rng: random.Random
) -> dict | None:
    move = plan_kontexto_move(rng, bot["skill"], view.best, view.own_guesses, bot["openers"])
    game = view.game_number
    if move.kind == "opener":
        for word in rng.sample(OPENERS, len(OPENERS)):
            scored = games.guess(word, game, correct_typos=False)
            if scored is not None and scored["rank"] not in view.used_ranks:
                return scored
        # Every opener is on the board already (a busy koop): carry on from it.
        best = view.best or 1000
        return games.word_near_rank(game, best * 2, view.used_ranks)
    if move.kind == "solve":
        return games.guess(games.get_target_word(game), game, correct_typos=False)
    return games.word_near_rank(game, move.rank, view.used_ranks)


async def _kontexto_move(
    db: aiosqlite.Connection,
    bot: dict,
    view: RoomView,
    games: GameSource,
    now: datetime,
    rng: random.Random,
) -> None:
    choice = _pick_kontexto_word(bot, view, games, rng)
    if choice is None:
        return
    word, rank = choice["word"], int(choice["rank"])
    mode, room_id, token = bot["mode"], bot["room_id"], bot["player_token"]
    if mode == "duel":
        await record_duel_guess(db, room_id, token, word, rank)
    elif mode == "koop":
        await record_koop_guess(db, room_id, token, word, rank)
    else:
        try:
            await record_arena_guess(db, room_id, token, word, rank, now=now)
        except ArenaGuessRefused:
            # The buzzer went between the look and the guess. A person's guess
            # would have been refused the same way.
            pass


async def _wordle_move(
    db: aiosqlite.Connection,
    bot: dict,
    view: RoomView,
    wordle: WordleSource,
    rng: random.Random,
) -> None:
    word = plan_wordle_guess(rng, bot["skill"], view.wordle_history, wordle.solutions, wordle.all_valid)
    solution = wordle.get_solution(view.game_number)
    await record_wordle_guess(
        db, duel_id=bot["room_id"], player_token=bot["player_token"],
        word=word, result=evaluate(word, solution),
    )
