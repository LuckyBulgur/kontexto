"""Tests for the arena modes: Battle Royale, Blitz-Duell and Zeitbonus-Jagd.

The clock is the part worth testing hardest, so every deadline here is passed in
explicitly rather than slept through. That also pins the property the modes rest
on: the server decides when time is up, from an absolute timestamp it wrote.
"""

import asyncio
import os
import tempfile
from datetime import datetime, timedelta, timezone

import pytest

import arena
from arena import (
    ArenaGuessRefused,
    BLITZ_SECONDS,
    ROYALE_PHASE_SECONDS,
    TIMERUSH_BONUS_SECONDS,
    TIMERUSH_MAX_SECONDS,
    TIMERUSH_START_SECONDS,
    advance_arena_game,
    advance_due_arenas,
    cleanup_stale_arenas,
    create_arena,
    get_arena_state,
    join_arena,
    parse_iso,
    record_arena_guess,
    royale_phase_seconds,
    start_arena,
)
from database import get_db, init_db

T0 = datetime(2026, 9, 20, 12, 0, 0, tzinfo=timezone.utc)


@pytest.fixture
def db_path():
    with tempfile.TemporaryDirectory() as tmpdir:
        path = os.path.join(tmpdir, "duels.db")
        asyncio.run(init_db(path))
        yield path


def run(coro):
    return asyncio.run(coro)


async def _open(db_path):
    return await get_db(db_path)


async def _room(db_path, mode: str, nicknames: list[str]):
    """Create an arena and add every nickname after the first one."""
    db = await _open(db_path)
    created = await create_arena(db, mode, 1, nicknames[0])
    tokens = {nicknames[0]: created["player_token"]}
    for name in nicknames[1:]:
        joined = await join_arena(db, created["arena_id"], name)
        tokens[name] = joined["player_token"]
    return db, created["arena_id"], tokens


class TestLobby:
    def test_create_and_join(self, db_path):
        async def scenario():
            db, arena_id, tokens = await _room(db_path, "royale", ["Ada", "Bob"])
            state = await get_arena_state(db, arena_id)
            await db.close()
            return state

        state = run(scenario())
        assert state["status"] == "lobby"
        assert state["mode"] == "royale"
        assert [p["nickname"] for p in state["players"]] == ["Ada", "Bob"]
        assert state["deadline_at"] is None

    def test_an_abusive_name_is_reflected_back_in_both_doors(self, db_path):
        """Invite rooms run the same nickname rule as the matchmaking queue."""
        async def scenario():
            db, arena_id, _ = await _room(db_path, "royale", ["Hurensohn", "xxWichserxx"])
            state = await get_arena_state(db, arena_id)
            await db.close()
            return state

        state = run(scenario())
        assert [p["nickname"] for p in state["players"]] == [
            "Ich bin H*******n", "Ich bin W*****r"]

    def test_an_unknown_mode_is_refused(self, db_path):
        async def scenario():
            db = await _open(db_path)
            result = await create_arena(db, "schach", 1, "Ada")
            await db.close()
            return result

        assert run(scenario()) is None

    def test_a_full_royale_takes_nobody_else(self, db_path):
        async def scenario():
            names = [f"Spieler{i}" for i in range(arena.ROYALE_MAX_PLAYERS)]
            db, arena_id, _ = await _room(db_path, "royale", names)
            overflow = await join_arena(db, arena_id, "ZuSpaet")
            await db.close()
            return overflow

        assert run(scenario()) is None

    def test_a_running_arena_takes_nobody_else(self, db_path):
        async def scenario():
            db, arena_id, _ = await _room(db_path, "blitz", ["Ada", "Bob"])
            await start_arena(db, arena_id, now=T0)
            late = await join_arena(db, arena_id, "ZuSpaet")
            await db.close()
            return late

        assert run(scenario()) is None

    def test_a_single_player_cannot_start(self, db_path):
        async def scenario():
            db, arena_id, _ = await _room(db_path, "royale", ["Ada"])
            started = await start_arena(db, arena_id, now=T0)
            await db.close()
            return started

        assert run(scenario()) is None

    def test_starting_twice_does_not_move_the_deadline(self, db_path):
        async def scenario():
            db, arena_id, _ = await _room(db_path, "blitz", ["Ada", "Bob"])
            first = await start_arena(db, arena_id, now=T0)
            second = await start_arena(db, arena_id, now=T0 + timedelta(seconds=30))
            state = await get_arena_state(db, arena_id)
            await db.close()
            return first, second, state

        first, second, state = run(scenario())
        assert second is None, "a second start must not restart the clock"
        assert state["deadline_at"] == first["deadline_at"]


class TestDeadlines:
    def test_blitz_deadline_is_the_shared_countdown(self, db_path):
        async def scenario():
            db, arena_id, _ = await _room(db_path, "blitz", ["Ada", "Bob"])
            state = await start_arena(db, arena_id, now=T0)
            await db.close()
            return state

        state = run(scenario())
        assert parse_iso(state["deadline_at"]) == T0 + timedelta(seconds=BLITZ_SECONDS)

    def test_royale_opens_on_the_longest_phase(self, db_path):
        async def scenario():
            db, arena_id, _ = await _room(db_path, "royale", ["Ada", "Bob", "Cem"])
            state = await start_arena(db, arena_id, now=T0)
            await db.close()
            return state

        state = run(scenario())
        assert parse_iso(state["deadline_at"]) == T0 + timedelta(seconds=ROYALE_PHASE_SECONDS[0])

    def test_royale_phases_shrink_and_then_hold(self):
        assert [royale_phase_seconds(i) for i in range(len(ROYALE_PHASE_SECONDS))] == list(
            ROYALE_PHASE_SECONDS
        )
        # Past the schedule the shortest phase repeats rather than reaching zero.
        assert royale_phase_seconds(99) == ROYALE_PHASE_SECONDS[-1]
        assert royale_phase_seconds(-5) == ROYALE_PHASE_SECONDS[0]

    def test_timerush_gives_every_player_their_own_clock(self, db_path):
        async def scenario():
            db, arena_id, _ = await _room(db_path, "timerush", ["Ada", "Bob"])
            state = await start_arena(db, arena_id, now=T0)
            await db.close()
            return state

        state = run(scenario())
        assert state["deadline_at"] is None, "timerush has no shared clock"
        for player in state["players"]:
            assert parse_iso(player["deadline_at"]) == T0 + timedelta(
                seconds=TIMERUSH_START_SECONDS
            )


class TestGuessing:
    def test_a_guess_before_the_buzzer_counts(self, db_path):
        async def scenario():
            db, arena_id, tokens = await _room(db_path, "blitz", ["Ada", "Bob"])
            await start_arena(db, arena_id, now=T0)
            booked = await record_arena_guess(
                db, arena_id, tokens["Ada"], "auto", 42, now=T0 + timedelta(seconds=5)
            )
            await db.close()
            return booked

        booked = run(scenario())
        assert booked["best_rank"] == 42
        assert booked["finished"] is False

    def test_a_guess_after_the_buzzer_is_refused(self, db_path):
        async def scenario():
            db, arena_id, tokens = await _room(db_path, "blitz", ["Ada", "Bob"])
            await start_arena(db, arena_id, now=T0)
            late = T0 + timedelta(seconds=BLITZ_SECONDS + 1)
            with pytest.raises(ArenaGuessRefused) as exc:
                await record_arena_guess(db, arena_id, tokens["Ada"], "auto", 42, now=late)
            await db.close()
            return exc.value.code

        assert run(scenario()) == "time_up"

    def test_a_guess_before_the_start_is_refused(self, db_path):
        async def scenario():
            db, arena_id, tokens = await _room(db_path, "blitz", ["Ada", "Bob"])
            with pytest.raises(ArenaGuessRefused) as exc:
                await record_arena_guess(db, arena_id, tokens["Ada"], "auto", 42, now=T0)
            await db.close()
            return exc.value.code

        assert run(scenario()) == "not_running"

    def test_rank_one_ends_the_arena_immediately(self, db_path):
        async def scenario():
            db, arena_id, tokens = await _room(db_path, "royale", ["Ada", "Bob", "Cem"])
            await start_arena(db, arena_id, now=T0)
            booked = await record_arena_guess(
                db, arena_id, tokens["Bob"], "treffer", 1, now=T0 + timedelta(seconds=9)
            )
            state = await get_arena_state(db, arena_id)
            await db.close()
            return booked, state

        booked, state = run(scenario())
        assert booked["finished"] is True
        assert state["status"] == "finished"
        assert state["winner"] == "Bob"
        assert state["deadline_at"] is None

    def test_an_eliminated_player_cannot_guess(self, db_path):
        async def scenario():
            db, arena_id, tokens = await _room(db_path, "royale", ["Ada", "Bob", "Cem"])
            await start_arena(db, arena_id, now=T0)
            await record_arena_guess(db, arena_id, tokens["Ada"], "auto", 10, now=T0)
            await record_arena_guess(db, arena_id, tokens["Bob"], "haus", 20, now=T0)
            # Cem never guessed, so Cem is the one who goes.
            await advance_due_arenas(db, now=T0 + timedelta(seconds=ROYALE_PHASE_SECONDS[0]))
            with pytest.raises(ArenaGuessRefused) as exc:
                await record_arena_guess(
                    db, arena_id, tokens["Cem"], "baum", 5, now=T0 + timedelta(seconds=190)
                )
            await db.close()
            return exc.value.code

        assert run(scenario()) == "eliminated"


class TestRoyaleElimination:
    def test_the_worst_standing_player_goes_first(self, db_path):
        async def scenario():
            db, arena_id, tokens = await _room(db_path, "royale", ["Ada", "Bob", "Cem"])
            await start_arena(db, arena_id, now=T0)
            await record_arena_guess(db, arena_id, tokens["Ada"], "auto", 10, now=T0)
            await record_arena_guess(db, arena_id, tokens["Bob"], "haus", 900, now=T0)
            events = await advance_due_arenas(
                db, now=T0 + timedelta(seconds=ROYALE_PHASE_SECONDS[0])
            )
            state = await get_arena_state(db, arena_id)
            await db.close()
            return events, state

        events, state = run(scenario())
        eliminated = [e for e in events if e["type"] == "player_eliminated"]
        assert len(eliminated) == 1
        # Cem has no rank at all, which is worse than Bob's 900.
        assert eliminated[0]["nickname"] == "Cem"
        assert eliminated[0]["place"] == 3
        assert state["status"] == "running"
        assert state["phase"] == 1

    def test_the_next_phase_is_shorter(self, db_path):
        async def scenario():
            db, arena_id, tokens = await _room(db_path, "royale", ["Ada", "Bob", "Cem"])
            await start_arena(db, arena_id, now=T0)
            await record_arena_guess(db, arena_id, tokens["Ada"], "auto", 10, now=T0)
            await record_arena_guess(db, arena_id, tokens["Bob"], "haus", 20, now=T0)
            due = T0 + timedelta(seconds=ROYALE_PHASE_SECONDS[0])
            events = await advance_due_arenas(db, now=due)
            await db.close()
            return events, due

        events, due = run(scenario())
        phase = next(e for e in events if e["type"] == "phase_started")
        assert phase["phase"] == 1
        assert parse_iso(phase["deadline_at"]) == due + timedelta(seconds=ROYALE_PHASE_SECONDS[1])

    def test_the_last_one_standing_wins(self, db_path):
        async def scenario():
            db, arena_id, tokens = await _room(db_path, "royale", ["Ada", "Bob"])
            await start_arena(db, arena_id, now=T0)
            await record_arena_guess(db, arena_id, tokens["Ada"], "auto", 10, now=T0)
            events = await advance_due_arenas(
                db, now=T0 + timedelta(seconds=ROYALE_PHASE_SECONDS[0])
            )
            state = await get_arena_state(db, arena_id)
            await db.close()
            return events, state

        events, state = run(scenario())
        assert any(e["type"] == "arena_finished" and e["winner"] == "Ada" for e in events)
        assert state["status"] == "finished"
        assert state["winner"] == "Ada"
        places = {p["nickname"]: p["place"] for p in state["players"]}
        assert places == {"Ada": 1, "Bob": 2}

    def test_running_the_clock_twice_changes_nothing(self, db_path):
        """The evaluator is guarded by the state it expects, so a repeated pass
        over the same second must not eliminate a second player."""

        async def scenario():
            db, arena_id, tokens = await _room(db_path, "royale", ["Ada", "Bob", "Cem"])
            await start_arena(db, arena_id, now=T0)
            await record_arena_guess(db, arena_id, tokens["Ada"], "auto", 10, now=T0)
            await record_arena_guess(db, arena_id, tokens["Bob"], "haus", 20, now=T0)
            due = T0 + timedelta(seconds=ROYALE_PHASE_SECONDS[0])
            first = await advance_due_arenas(db, now=due)
            second = await advance_due_arenas(db, now=due)
            state = await get_arena_state(db, arena_id)
            await db.close()
            return first, second, state

        first, second, state = run(scenario())
        assert len([e for e in first if e["type"] == "player_eliminated"]) == 1
        assert second == [], "the second pass must find nothing left to do"
        assert sum(1 for p in state["players"] if p["eliminated"]) == 1


class TestBlitz:
    def test_the_best_rank_in_the_room_wins_at_the_buzzer(self, db_path):
        async def scenario():
            db, arena_id, tokens = await _room(db_path, "blitz", ["Ada", "Bob"])
            await start_arena(db, arena_id, now=T0)
            await record_arena_guess(db, arena_id, tokens["Ada"], "auto", 400, now=T0)
            await record_arena_guess(db, arena_id, tokens["Bob"], "haus", 120, now=T0)
            events = await advance_due_arenas(db, now=T0 + timedelta(seconds=BLITZ_SECONDS))
            state = await get_arena_state(db, arena_id)
            await db.close()
            return events, state

        events, state = run(scenario())
        assert any(e["type"] == "arena_finished" and e["winner"] == "Bob" for e in events)
        assert state["winner"] == "Bob"

    def test_a_round_nobody_played_ends_without_a_winner(self, db_path):
        async def scenario():
            db, arena_id, _ = await _room(db_path, "blitz", ["Ada", "Bob"])
            await start_arena(db, arena_id, now=T0)
            events = await advance_due_arenas(db, now=T0 + timedelta(seconds=BLITZ_SECONDS))
            state = await get_arena_state(db, arena_id)
            await db.close()
            return events, state

        events, state = run(scenario())
        assert any(e["type"] == "arena_finished" and e["winner"] is None for e in events)
        assert state["status"] == "finished"


class TestTimerush:
    def test_an_improving_guess_buys_time(self, db_path):
        async def scenario():
            db, arena_id, tokens = await _room(db_path, "timerush", ["Ada", "Bob"])
            await start_arena(db, arena_id, now=T0)
            booked = await record_arena_guess(
                db, arena_id, tokens["Ada"], "auto", 900, now=T0 + timedelta(seconds=10)
            )
            await db.close()
            return booked

        booked = run(scenario())
        assert parse_iso(booked["deadline_at"]) == T0 + timedelta(
            seconds=TIMERUSH_START_SECONDS + TIMERUSH_BONUS_SECONDS
        )

    def test_a_guess_that_does_not_improve_buys_nothing(self, db_path):
        async def scenario():
            db, arena_id, tokens = await _room(db_path, "timerush", ["Ada", "Bob"])
            await start_arena(db, arena_id, now=T0)
            await record_arena_guess(db, arena_id, tokens["Ada"], "auto", 400, now=T0)
            booked = await record_arena_guess(
                db, arena_id, tokens["Ada"], "haus", 900, now=T0 + timedelta(seconds=2)
            )
            await db.close()
            return booked

        booked = run(scenario())
        assert parse_iso(booked["deadline_at"]) == T0 + timedelta(
            seconds=TIMERUSH_START_SECONDS + TIMERUSH_BONUS_SECONDS
        )

    def test_the_bonus_is_capped(self, db_path):
        async def scenario():
            db, arena_id, tokens = await _room(db_path, "timerush", ["Ada", "Bob"])
            await start_arena(db, arena_id, now=T0)
            rank = 5000
            booked = None
            for i in range(40):
                rank -= 10
                booked = await record_arena_guess(
                    db, arena_id, tokens["Ada"], f"wort{i}", rank, now=T0 + timedelta(seconds=1)
                )
            await db.close()
            return booked

        booked = run(scenario())
        ceiling = T0 + timedelta(seconds=1 + TIMERUSH_MAX_SECONDS)
        assert parse_iso(booked["deadline_at"]) <= ceiling

    def test_an_expired_clock_retires_that_player_only(self, db_path):
        async def scenario():
            db, arena_id, tokens = await _room(db_path, "timerush", ["Ada", "Bob", "Cem"])
            await start_arena(db, arena_id, now=T0)
            # Ada buys time, the other two do not.
            await record_arena_guess(
                db, arena_id, tokens["Ada"], "auto", 900, now=T0 + timedelta(seconds=5)
            )
            events = await advance_due_arenas(
                db, now=T0 + timedelta(seconds=TIMERUSH_START_SECONDS + 1)
            )
            state = await get_arena_state(db, arena_id)
            await db.close()
            return events, state

        events, state = run(scenario())
        gone = sorted(e["nickname"] for e in events if e["type"] == "player_eliminated")
        assert gone == ["Bob", "Cem"]
        assert any(e["type"] == "arena_finished" and e["winner"] == "Ada" for e in events)
        assert state["status"] == "finished"

    def test_everyone_running_out_ends_without_a_winner(self, db_path):
        async def scenario():
            db, arena_id, _ = await _room(db_path, "timerush", ["Ada", "Bob"])
            await start_arena(db, arena_id, now=T0)
            events = await advance_due_arenas(
                db, now=T0 + timedelta(seconds=TIMERUSH_START_SECONDS + 1)
            )
            state = await get_arena_state(db, arena_id)
            await db.close()
            return events, state

        events, state = run(scenario())
        assert any(e["type"] == "arena_finished" and e["winner"] is None for e in events)
        assert state["status"] == "finished"


class TestRematchAndCleanup:
    def test_a_rematch_reopens_the_lobby_on_a_fresh_game(self, db_path):
        async def scenario():
            db, arena_id, tokens = await _room(db_path, "blitz", ["Ada", "Bob"])
            await start_arena(db, arena_id, now=T0)
            await record_arena_guess(db, arena_id, tokens["Ada"], "treffer", 1, now=T0)
            new_game = await advance_arena_game(db, arena_id, lambda current, played: 7)
            state = await get_arena_state(db, arena_id)
            await db.close()
            return new_game, state

        new_game, state = run(scenario())
        assert new_game == 7
        assert state["status"] == "lobby"
        assert state["round"] == 2
        assert state["winner"] is None
        assert all(p["best_rank"] is None and not p["eliminated"] for p in state["players"])

    def test_a_running_arena_cannot_be_rematched(self, db_path):
        async def scenario():
            db, arena_id, _ = await _room(db_path, "blitz", ["Ada", "Bob"])
            await start_arena(db, arena_id, now=T0)
            result = await advance_arena_game(db, arena_id, lambda current, played: 7)
            await db.close()
            return result

        assert run(scenario()) is None

    def test_cleanup_removes_an_abandoned_arena(self, db_path):
        async def scenario():
            db, arena_id, _ = await _room(db_path, "blitz", ["Ada", "Bob"])
            await db.execute(
                "UPDATE arenas SET last_activity = datetime('now', '-2 hours') WHERE id = ?",
                (arena_id,),
            )
            await db.commit()
            removed = await cleanup_stale_arenas(db)
            state = await get_arena_state(db, arena_id)
            await db.close()
            return removed, state

        removed, state = run(scenario())
        assert removed == 1
        assert state is None
