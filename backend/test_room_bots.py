"""Tests for the server players in matchmaking rooms (room_bots.py).

What must hold, in order of how much it would cost to get wrong: a server
player is never counted anywhere a person reads a figure, it only ever sits in a
room a person's ticket created, people are paired with people first, and it
plays through the same functions a person's request goes through.
"""

import asyncio
import os
import random
import tempfile
from datetime import datetime, timedelta, timezone

import pytest

import room_bots
from arena import create_arena, join_arena
from database import get_db, init_db
from duel import advance_duel_game, create_duel, join_duel, set_player_connected
from koop import create_koop, join_koop
from matchmaking import enqueue, playing_counts, reset_connected_flags, run_matchmaking
from room_bots import FillPolicy, FillRule, plan_kontexto_move, plan_wordle_guess
from wordle import evaluate

# Real wall-clock time: the arena lobby age is measured against SQLite's
# CURRENT_TIMESTAMP, which a fixed date in the past would turn negative.
NOW = datetime.now(timezone.utc).replace(microsecond=0)


def run(coro):
    return asyncio.run(coro)


@pytest.fixture
def db_path():
    with tempfile.TemporaryDirectory() as tmpdir:
        path = os.path.join(tmpdir, "duels.db")
        asyncio.run(init_db(path))
        yield path


class FakeGames:
    """A game of 2.000 counted words: ``w<n>`` sits at rank n, ``ziel`` is 1."""

    SIZE = 2000

    def __init__(self) -> None:
        self.words = {f"w{n}": n for n in range(2, self.SIZE + 1)}
        self.words["ziel"] = 1
        # The openers exist too, spread over the far half of the scale.
        for i, word in enumerate(room_bots.OPENERS):
            self.words[word] = 1000 + i * 7
        self.by_rank = {rank: word for word, rank in self.words.items()}

    def guess(self, word, game_number, correct_typos=True):
        rank = self.words.get(word)
        return None if rank is None else {"word": word, "rank": rank, "total": self.SIZE}

    def word_near_rank(self, game_number, rank, used_ranks):
        for distance in range(self.SIZE):
            for candidate in (rank - distance, rank + distance):
                if 2 <= candidate <= self.SIZE and candidate not in used_ranks:
                    return {"word": self.by_rank[candidate], "rank": candidate}
        return None

    def get_target_word(self, game_number):
        return "ziel"


async def room_factory(db, mode, nicknames):
    """The shape of main._matchmaking_room, for the room types under test."""
    if mode == "duel":
        created = await create_duel(db, 7, nicknames[0], True)
        room_id, tokens = created["duel_id"], [created["player_token"]]
        for name in nicknames[1:]:
            tokens.append((await join_duel(db, room_id, name))["player_token"])
        return room_id, tokens
    if mode == "koop":
        created = await create_koop(db, 7, nicknames[0], True)
        room_id, tokens = created["koop_id"], [created["player_token"]]
        for name in nicknames[1:]:
            tokens.append((await join_koop(db, room_id, name))["player_token"])
        return room_id, tokens
    created = await create_arena(db, mode, 7, nicknames[0])
    room_id, tokens = created["arena_id"], [created["player_token"]]
    for name in nicknames[1:]:
        tokens.append((await join_arena(db, room_id, name))["player_token"])
    return room_id, tokens


FAST = {
    mode: FillRule(lone_after=(5, 5), sizes=rule.sizes, party_chance=rule.party_chance)
    for mode, rule in room_bots.FILL_RULES.items()
}


async def count(db, sql, params=()):
    cursor = await db.execute(sql, params)
    return (await cursor.fetchone())[0]


async def match_lone_duel(db, fill=None):
    """One person queues for a duel and waits past the fill delay."""
    ticket = (await enqueue(db, "duel", "Ada", now=NOW))["ticket"]
    rooms = await run_matchmaking(db, room_factory, now=NOW + timedelta(seconds=6),
                                  fill=fill or FillPolicy(FAST))
    cursor = await db.execute(
        "SELECT matched_room_id, matched_token FROM matchmaking_queue WHERE ticket = ?", (ticket,)
    )
    row = await cursor.fetchone()
    return rooms, row["matched_room_id"], row["matched_token"]


async def tick(db, games, start, seconds, rng=None):
    rng = rng or random.Random(3)
    for second in range(seconds):
        await room_bots.run_bots(db, games, None, now=start + timedelta(seconds=second), rng=rng)


class TestFilling:
    def test_a_lone_duel_player_gets_no_company_before_the_delay(self, db_path):
        async def scenario():
            db = await get_db(db_path)
            await enqueue(db, "duel", "Ada", now=NOW)
            rooms = await run_matchmaking(db, room_factory, now=NOW + timedelta(seconds=4),
                                          fill=FillPolicy(FAST))
            bots = await count(db, "SELECT COUNT(*) FROM room_bots")
            await db.close()
            return rooms, bots

        rooms, bots = run(scenario())
        assert rooms == []
        assert bots == 0

    def test_a_lone_duel_player_gets_a_seated_opponent_after_the_delay(self, db_path):
        async def scenario():
            db = await get_db(db_path)
            rooms, room_id, token = await match_lone_duel(db)
            players = await count(db, "SELECT COUNT(*) FROM duel_players WHERE duel_id = ?", (room_id,))
            cursor = await db.execute("SELECT player_token FROM room_bots")
            bot_tokens = [r[0] for r in await cursor.fetchall()]
            cursor = await db.execute(
                "SELECT connected FROM duel_players WHERE player_token = ?", (bot_tokens[0],)
            )
            connected = (await cursor.fetchone())[0]
            await db.close()
            return rooms, token, players, bot_tokens, connected

        rooms, token, players, bot_tokens, connected = run(scenario())
        assert len(rooms) == 1 and rooms[0]["bots"] == 1
        assert token is not None
        assert players == 2
        assert len(bot_tokens) == 1 and bot_tokens[0] != token
        assert connected == 1

    def test_two_people_are_paired_with_each_other_not_with_the_server(self, db_path):
        async def scenario():
            db = await get_db(db_path)
            await enqueue(db, "duel", "Ada", now=NOW)
            await enqueue(db, "duel", "Bob", now=NOW)
            rooms = await run_matchmaking(db, room_factory, now=NOW + timedelta(seconds=30),
                                          fill=FillPolicy(FAST))
            bots = await count(db, "SELECT COUNT(*) FROM room_bots")
            await db.close()
            return rooms, bots

        rooms, bots = run(scenario())
        assert len(rooms) == 1
        assert rooms[0]["nicknames"] == ["Ada", "Bob"]
        assert rooms[0]["bots"] == 0
        assert bots == 0

    def test_a_server_at_its_cap_leaves_the_ticket_waiting(self, db_path):
        async def scenario():
            db = await get_db(db_path)
            rooms, room_id, token = await match_lone_duel(db, fill=FillPolicy(FAST, cap=0))
            await db.close()
            return rooms, room_id, token

        rooms, room_id, token = run(scenario())
        assert rooms == []
        assert room_id is None and token is None

    def test_without_a_policy_nobody_is_filled_in(self, db_path):
        async def scenario():
            db = await get_db(db_path)
            await enqueue(db, "duel", "Ada", now=NOW)
            rooms = await run_matchmaking(db, room_factory, now=NOW + timedelta(minutes=4))
            await db.close()
            return rooms

        assert run(scenario()) == []

    def test_group_mode_players_join_the_lobby_one_by_one(self, db_path):
        async def scenario():
            db = await get_db(db_path)
            await enqueue(db, "koop", "Ada", now=NOW)
            rooms = await run_matchmaking(db, room_factory, now=NOW + timedelta(seconds=6),
                                          fill=FillPolicy(FAST))
            room_id = rooms[0]["room_id"]
            pending = await count(db, "SELECT COUNT(*) FROM room_bots WHERE player_token IS NULL")
            before = await count(db, "SELECT COUNT(*) FROM koop_players WHERE koop_id = ?", (room_id,))
            await tick(db, FakeGames(), NOW + timedelta(seconds=6), 40)
            after = await count(db, "SELECT COUNT(*) FROM koop_players WHERE koop_id = ?", (room_id,))
            await db.close()
            return rooms[0]["bots"], pending, before, after

        bots, pending, before, after = run(scenario())
        assert bots >= 1
        assert pending == bots
        assert before == 1
        assert after == 1 + bots

    def test_the_fill_decision_is_stable_across_passes(self):
        policy = FillPolicy()
        first = [policy.lone_delay("royale", "t-1"), policy.bots_for_lone("royale", 1, 3, 8, "t-1")]
        second = [policy.lone_delay("royale", "t-1"), policy.bots_for_lone("royale", 1, 3, 8, "t-1")]
        assert first == second
        low, high = room_bots.FILL_RULES["royale"].lone_after
        assert low <= first[0] <= high
        assert 3 <= 1 + first[1] <= 8

    def test_a_party_is_never_topped_up_past_its_maximum(self):
        policy = FillPolicy()
        for i in range(200):
            assert policy.bots_for_party("blitz", 7, 8, f"t-{i}") <= 1
            assert policy.bots_for_party("blitz", 8, 8, f"t-{i}") == 0
            assert policy.bots_for_party("duel", 2, 2, f"t-{i}") == 0

    def test_every_queue_mode_has_a_fill_rule_that_waits_out_its_grace(self):
        from matchmaking import PARTY_RULES, QUEUE_MODES

        assert set(room_bots.FILL_RULES) == set(QUEUE_MODES)
        for mode, rule in room_bots.FILL_RULES.items():
            # A second person arriving inside the grace must win the seat.
            assert rule.lone_after[0] > PARTY_RULES[mode].grace_seconds, mode


class TestCountingNowhere:
    def test_server_players_are_not_in_the_playing_figure(self, db_path):
        async def scenario():
            db = await get_db(db_path)
            _, room_id, token = await match_lone_duel(db)
            await set_player_connected(db, token, True)
            figures = await playing_counts(db)
            await db.close()
            return figures

        assert run(scenario())["duel"] == 1

    def test_their_guesses_reach_no_counter_and_no_guess_log(self, db_path):
        async def scenario():
            db = await get_db(db_path)
            _, room_id, token = await match_lone_duel(db)
            await set_player_connected(db, token, True)
            await tick(db, FakeGames(), NOW + timedelta(seconds=6), 150)
            cursor = await db.execute("SELECT player_token FROM room_bots")
            bot_token = (await cursor.fetchone())[0]
            guesses = await count(
                db, "SELECT COUNT(*) FROM duel_guesses WHERE player_token = ?", (bot_token,)
            )
            counters = await count(db, "SELECT COUNT(*) FROM analytics_counters")
            words = await count(db, "SELECT COUNT(*) FROM analytics_word_counts")
            await db.close()
            return guesses, counters, words

        guesses, counters, words = run(scenario())
        assert guesses >= 3
        assert counters == 0
        assert words == 0

    def test_the_room_state_looks_the_same_for_both_seats(self, db_path):
        from duel import get_duel_state

        async def scenario():
            db = await get_db(db_path)
            _, room_id, _ = await match_lone_duel(db)
            state = await get_duel_state(db, room_id)
            await db.close()
            return state

        state = run(scenario())
        human, bot = state["players"]
        assert set(human) == set(bot)
        assert "bot" not in repr(state).lower()


class TestPlaying:
    def test_nobody_moves_before_a_person_has_connected(self, db_path):
        async def scenario():
            db = await get_db(db_path)
            await match_lone_duel(db)
            await tick(db, FakeGames(), NOW + timedelta(seconds=6), 15)
            guesses = await count(db, "SELECT COUNT(*) FROM duel_guesses")
            await db.close()
            return guesses

        assert run(scenario()) == 0

    def test_it_leaves_once_the_people_are_gone(self, db_path):
        async def scenario():
            db = await get_db(db_path)
            _, room_id, token = await match_lone_duel(db)
            # The person never opens the room.
            await tick(db, FakeGames(), NOW + timedelta(seconds=6), 75)
            bots = await count(db, "SELECT COUNT(*) FROM room_bots")
            connected = await count(
                db, "SELECT COUNT(*) FROM duel_players WHERE duel_id = ? AND connected = 1", (room_id,)
            )
            await db.close()
            return bots, connected

        bots, connected = run(scenario())
        assert bots == 0
        assert connected == 0

    def test_it_follows_a_rematch_and_leaves_when_its_rounds_are_spent(self, db_path):
        async def scenario():
            db = await get_db(db_path)
            _, room_id, token = await match_lone_duel(db)
            await set_player_connected(db, token, True)
            await db.execute("UPDATE room_bots SET rounds_left = 2")
            await db.commit()
            start = NOW + timedelta(seconds=6)
            await tick(db, FakeGames(), start, 30)
            await advance_duel_game(db, room_id, lambda current, played: current + 1)
            await tick(db, FakeGames(), start + timedelta(seconds=30), 60)
            second_round = await count(db, "SELECT COUNT(*) FROM duel_guesses")
            stayed = await count(db, "SELECT COUNT(*) FROM room_bots")
            await advance_duel_game(db, room_id, lambda current, played: current + 1)
            await tick(db, FakeGames(), start + timedelta(seconds=90), 60)
            left = await count(db, "SELECT COUNT(*) FROM room_bots")
            await db.close()
            return second_round, stayed, left

        second_round, stayed, left = run(scenario())
        assert second_round >= 1
        assert stayed == 1
        assert left == 0

    def test_a_restart_puts_it_back_in_its_seat(self, db_path):
        async def scenario():
            db = await get_db(db_path)
            await match_lone_duel(db)
            await reset_connected_flags(db)
            before = await count(db, "SELECT COUNT(*) FROM duel_players WHERE connected = 1")
            restored = await room_bots.restore_connections(db)
            after = await count(db, "SELECT COUNT(*) FROM duel_players WHERE connected = 1")
            await db.close()
            return before, restored, after

        assert run(scenario()) == (0, 1, 1)

    def test_a_row_without_a_seat_is_pruned(self, db_path):
        async def scenario():
            db = await get_db(db_path)
            _, room_id, _ = await match_lone_duel(db)
            await db.execute("DELETE FROM duel_players WHERE duel_id = ?", (room_id,))
            await db.commit()
            removed = await room_bots.prune_orphans(db, now=NOW)
            left = await count(db, "SELECT COUNT(*) FROM room_bots")
            await db.close()
            return removed, left

        assert run(scenario()) == (1, 0)

    def test_it_starts_an_arena_lobby_a_person_is_waiting_in(self, db_path):
        from arena import set_player_connected as set_arena_connected

        async def scenario():
            db = await get_db(db_path)
            await enqueue(db, "blitz", "Ada", now=NOW)
            rooms = await run_matchmaking(db, room_factory, now=NOW, fill=FillPolicy(
                {**FAST, "blitz": FillRule(lone_after=(0, 0), sizes=(3, 3), party_chance=0.0)}
            ))
            room_id = rooms[0]["room_id"]
            cursor = await db.execute(
                "SELECT matched_token FROM matchmaking_queue WHERE matched_room_id = ?", (room_id,)
            )
            await set_arena_connected(db, (await cursor.fetchone())[0], True)
            await tick(db, FakeGames(), NOW, 90)
            cursor = await db.execute("SELECT status FROM arenas WHERE id = ?", (room_id,))
            status = (await cursor.fetchone())[0]
            guesses = await count(db, "SELECT COUNT(*) FROM arena_guesses WHERE arena_id = ?", (room_id,))
            await db.close()
            return status, guesses

        status, guesses = run(scenario())
        assert status in ("running", "finished")
        assert guesses >= 1

    def test_a_late_arena_guess_is_refused_quietly(self, db_path):
        async def scenario():
            db = await get_db(db_path)
            created = await create_arena(db, "blitz", 7, "Ada")
            room_id = created["arena_id"]
            policy = FillPolicy()
            token = (await join_arena(db, room_id, "Flinke Eule 4"))["player_token"]
            await policy.attach(db, "blitz", room_id, [(token, "Flinke Eule 4")], 0, NOW)
            from arena import set_player_connected as set_arena_connected

            await set_arena_connected(db, created["player_token"], True)
            past = (NOW - timedelta(seconds=5)).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
            await db.execute(
                "UPDATE arenas SET status = 'running', deadline_at = ? WHERE id = ?", (past, room_id)
            )
            await db.execute("UPDATE room_bots SET round = 1")
            await db.commit()
            await tick(db, FakeGames(), NOW, 20)
            guesses = await count(db, "SELECT COUNT(*) FROM arena_guesses")
            alive = await count(db, "SELECT COUNT(*) FROM room_bots")
            await db.close()
            return guesses, alive

        guesses, alive = run(scenario())
        assert guesses == 0
        assert alive == 1


class TestKontextoModel:
    def test_it_opens_before_it_steers(self):
        rng = random.Random(1)
        assert plan_kontexto_move(rng, 0.5, None, 0, 2).kind == "opener"
        assert plan_kontexto_move(rng, 0.5, 900, 1, 2).kind == "opener"

    def test_a_steered_guess_is_never_the_solution_by_rank(self):
        rng = random.Random(2)
        for best in (2, 3, 10, 400, 30000):
            for _ in range(300):
                move = plan_kontexto_move(rng, 0.5, best, 10, 1)
                if move.kind == "near":
                    assert move.rank >= 2

    def test_it_solves_more_often_the_closer_it_is(self):
        assert room_bots.solve_chance(0.5, 2) > room_bots.solve_chance(0.5, 20)
        assert room_bots.solve_chance(0.5, 20) > room_bots.solve_chance(0.5, 5000)
        assert room_bots.solve_chance(0.5, 5000) == 0.0


class TestWordleModel:
    SOLUTIONS = ["tisch", "stuhl", "birne", "apfel", "insel", "kanne", "tasse", "nadel"]

    def test_every_guess_fits_the_colours_so_far(self):
        rng = random.Random(4)
        valid = set(self.SOLUTIONS)
        for solution in self.SOLUTIONS:
            history = []
            for _ in range(6):
                guess = plan_wordle_guess(rng, 0.9, history, self.SOLUTIONS, valid)
                assert all(evaluate(g, guess) == r for g, r in history)
                result = evaluate(guess, solution)
                history.append((guess, result))
                if guess == solution:
                    break
            assert history[-1][0] == solution

    def test_names_come_in_the_shapes_people_use(self):
        rng = random.Random(5)
        names = {room_bots.bot_nickname(rng) for _ in range(300)}
        assert any(" " in n for n in names)
        assert any(" " not in n for n in names)
        assert all(0 < len(n) <= 24 for n in names)
