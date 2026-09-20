"""Tests for the random matchmaking queue.

Two things carry real risk here and are tested directly: a ticket must never end
up in two rooms, and a nickname that strangers will read must not be free text.
"""

import asyncio
import os
import tempfile
from datetime import datetime, timedelta, timezone

import pytest

from database import get_db, init_db
from matchmaking import (
    PARTY_RULES,
    QUEUE_MODES,
    TICKET_TTL_SECONDS,
    cancel,
    enqueue,
    generate_nickname,
    is_nickname_acceptable,
    prune_queue,
    resolve_nickname,
    run_matchmaking,
    ticket_status,
    waiting_counts,
)

T0 = datetime(2026, 9, 20, 12, 0, 0, tzinfo=timezone.utc)


@pytest.fixture
def db_path():
    with tempfile.TemporaryDirectory() as tmpdir:
        path = os.path.join(tmpdir, "duels.db")
        asyncio.run(init_db(path))
        yield path


def run(coro):
    return asyncio.run(coro)


class RecordingFactory:
    """A stand-in for the real room builder, so the queue can be tested alone."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, list[str]]] = []

    async def __call__(self, db, mode: str, nicknames: list[str]):
        self.calls.append((mode, list(nicknames)))
        room_id = f"{mode}-room-{len(self.calls)}"
        return room_id, [f"token-{room_id}-{i}" for i in range(len(nicknames))]


class TestNicknames:
    def test_a_plain_name_is_accepted(self):
        assert is_nickname_acceptable("Marlene")
        assert resolve_nickname("Marlene") == "Marlene"

    def test_an_insult_is_rejected(self):
        assert not is_nickname_acceptable("Hurensohn")

    def test_an_insult_hidden_in_a_longer_name_is_rejected(self):
        """A word list that only matches whole words is evaded in one keystroke."""
        assert not is_nickname_acceptable("xxWichserxx")
        assert not is_nickname_acceptable("arschgeige1")

    def test_the_umlaut_spelling_is_rejected_too(self):
        assert not is_nickname_acceptable("Möse")

    def test_an_empty_or_oversized_name_is_rejected(self):
        assert not is_nickname_acceptable("   ")
        assert not is_nickname_acceptable("x" * 21)

    def test_a_control_character_is_rejected(self):
        assert not is_nickname_acceptable("Anna\u0007")

    def test_a_rejected_name_becomes_a_generated_one(self):
        assert resolve_nickname("Hurensohn") != "Hurensohn"
        assert resolve_nickname(None)

    def test_a_generated_name_survives_its_own_filter(self):
        for _ in range(200):
            assert is_nickname_acceptable(generate_nickname())


class TestQueue:
    def test_enqueue_returns_a_ticket(self, db_path):
        async def scenario():
            db = await get_db(db_path)
            result = await enqueue(db, "duel", "Ada", now=T0)
            status = await ticket_status(db, result["ticket"])
            await db.close()
            return result, status

        result, status = run(scenario())
        assert result["mode"] == "duel"
        assert result["nickname"] == "Ada"
        assert status["matched"] is False
        assert status["room_id"] is None

    def test_an_unknown_mode_is_refused(self, db_path):
        async def scenario():
            db = await get_db(db_path)
            result = await enqueue(db, "schach", "Ada", now=T0)
            await db.close()
            return result

        assert run(scenario()) is None

    def test_every_queue_mode_has_a_party_rule(self):
        assert set(PARTY_RULES) == set(QUEUE_MODES)
        for mode, rule in PARTY_RULES.items():
            assert 2 <= rule.minimum <= rule.maximum, mode

    def test_cancelling_leaves_the_queue(self, db_path):
        async def scenario():
            db = await get_db(db_path)
            ticket = (await enqueue(db, "duel", "Ada", now=T0))["ticket"]
            cancelled = await cancel(db, ticket)
            status = await ticket_status(db, ticket)
            await db.close()
            return cancelled, status

        cancelled, status = run(scenario())
        assert cancelled is True
        assert status is None

    def test_waiting_counts_only_count_the_unmatched(self, db_path):
        factory = RecordingFactory()

        async def scenario():
            db = await get_db(db_path)
            await enqueue(db, "duel", "Ada", now=T0)
            await enqueue(db, "duel", "Bob", now=T0)
            await enqueue(db, "koop", "Cem", now=T0)
            before = await waiting_counts(db)
            await run_matchmaking(db, factory, now=T0)
            after = await waiting_counts(db)
            await db.close()
            return before, after

        before, after = run(scenario())
        assert before == {"duel": 2, "koop": 1}
        assert after == {"koop": 1}


class TestPairing:
    def test_two_duel_tickets_pair_at_once(self, db_path):
        factory = RecordingFactory()

        async def scenario():
            db = await get_db(db_path)
            a = (await enqueue(db, "duel", "Ada", now=T0))["ticket"]
            b = (await enqueue(db, "duel", "Bob", now=T0))["ticket"]
            rooms = await run_matchmaking(db, factory, now=T0)
            status_a = await ticket_status(db, a)
            status_b = await ticket_status(db, b)
            await db.close()
            return rooms, status_a, status_b

        rooms, status_a, status_b = run(scenario())
        assert len(rooms) == 1
        assert factory.calls == [("duel", ["Ada", "Bob"])]
        assert status_a["matched"] and status_b["matched"]
        assert status_a["room_id"] == status_b["room_id"]
        assert status_a["player_token"] != status_b["player_token"]

    def test_a_lone_ticket_waits(self, db_path):
        factory = RecordingFactory()

        async def scenario():
            db = await get_db(db_path)
            ticket = (await enqueue(db, "duel", "Ada", now=T0))["ticket"]
            rooms = await run_matchmaking(db, factory, now=T0)
            status = await ticket_status(db, ticket)
            await db.close()
            return rooms, status

        rooms, status = run(scenario())
        assert rooms == []
        assert status["matched"] is False

    def test_royale_waits_for_the_grace_period_before_starting_small(self, db_path):
        factory = RecordingFactory()
        rule = PARTY_RULES["royale"]

        async def scenario():
            db = await get_db(db_path)
            for name in ("Ada", "Bob", "Cem"):
                await enqueue(db, "royale", name, now=T0)
            too_early = await run_matchmaking(db, factory, now=T0 + timedelta(seconds=1))
            late = await run_matchmaking(
                db, factory, now=T0 + timedelta(seconds=rule.grace_seconds)
            )
            await db.close()
            return too_early, late

        too_early, late = run(scenario())
        assert too_early == [], "a small party must not start before the grace period"
        assert len(late) == 1
        assert factory.calls == [("royale", ["Ada", "Bob", "Cem"])]

    def test_a_full_royale_starts_without_waiting(self, db_path):
        factory = RecordingFactory()
        rule = PARTY_RULES["royale"]

        async def scenario():
            db = await get_db(db_path)
            for i in range(rule.maximum):
                await enqueue(db, "royale", f"Spieler{i}", now=T0)
            rooms = await run_matchmaking(db, factory, now=T0)
            await db.close()
            return rooms

        rooms = run(scenario())
        assert len(rooms) == 1
        assert len(factory.calls[0][1]) == rule.maximum

    def test_a_party_never_exceeds_the_maximum(self, db_path):
        factory = RecordingFactory()

        async def scenario():
            db = await get_db(db_path)
            for i in range(5):
                await enqueue(db, "duel", f"Spieler{i}", now=T0)
            rooms = await run_matchmaking(db, factory, now=T0)
            remaining = await waiting_counts(db)
            await db.close()
            return rooms, remaining

        rooms, remaining = run(scenario())
        assert len(rooms) == 2, "five duel tickets form two pairs"
        assert all(len(call[1]) == 2 for call in factory.calls)
        assert remaining == {"duel": 1}

    def test_oldest_first(self, db_path):
        factory = RecordingFactory()

        async def scenario():
            db = await get_db(db_path)
            await enqueue(db, "duel", "Erste", now=T0)
            await enqueue(db, "duel", "Zweite", now=T0 + timedelta(seconds=5))
            await enqueue(db, "duel", "Dritte", now=T0 + timedelta(seconds=10))
            await run_matchmaking(db, factory, now=T0 + timedelta(seconds=11))
            await db.close()

        run(scenario())
        assert factory.calls[0][1] == ["Erste", "Zweite"]

    def test_a_second_pass_does_not_rematch(self, db_path):
        """The claim is guarded on matched_room_id IS NULL, so a repeated pass
        must not put an already matched ticket into a second room."""
        factory = RecordingFactory()

        async def scenario_full():
            db = await get_db(db_path)
            a = (await enqueue(db, "duel", "Ada", now=T0))["ticket"]
            await enqueue(db, "duel", "Bob", now=T0)
            first = await run_matchmaking(db, factory, now=T0)
            room_after_first = (await ticket_status(db, a))["room_id"]
            second = await run_matchmaking(db, factory, now=T0)
            room_after_second = (await ticket_status(db, a))["room_id"]
            await db.close()
            return first, second, room_after_first, room_after_second

        first, second, room_a, room_b = run(scenario_full())
        assert len(first) == 1
        assert second == []
        assert room_a == room_b

    def test_two_players_with_the_same_name_still_get_separate_tokens(self, db_path):
        factory = RecordingFactory()

        async def scenario():
            db = await get_db(db_path)
            a = (await enqueue(db, "duel", "Alex", now=T0))["ticket"]
            b = (await enqueue(db, "duel", "Alex", now=T0))["ticket"]
            await run_matchmaking(db, factory, now=T0)
            status_a = await ticket_status(db, a)
            status_b = await ticket_status(db, b)
            await db.close()
            return status_a, status_b

        status_a, status_b = run(scenario())
        assert status_a["player_token"] != status_b["player_token"]

    def test_modes_do_not_mix(self, db_path):
        factory = RecordingFactory()

        async def scenario():
            db = await get_db(db_path)
            await enqueue(db, "duel", "Ada", now=T0)
            await enqueue(db, "koop", "Bob", now=T0)
            rooms = await run_matchmaking(db, factory, now=T0 + timedelta(seconds=60))
            await db.close()
            return rooms

        assert run(scenario()) == [], "one player per mode is nobody's party"


class TestPruning:
    def test_an_abandoned_ticket_is_dropped(self, db_path):
        async def scenario():
            db = await get_db(db_path)
            ticket = (await enqueue(db, "duel", "Ada", now=T0))["ticket"]
            removed = await prune_queue(db, now=T0 + timedelta(seconds=TICKET_TTL_SECONDS + 1))
            status = await ticket_status(db, ticket)
            await db.close()
            return removed, status

        removed, status = run(scenario())
        assert removed == 1
        assert status is None

    def test_a_fresh_ticket_survives(self, db_path):
        async def scenario():
            db = await get_db(db_path)
            ticket = (await enqueue(db, "duel", "Ada", now=T0))["ticket"]
            removed = await prune_queue(db, now=T0 + timedelta(seconds=10))
            status = await ticket_status(db, ticket)
            await db.close()
            return removed, status

        removed, status = run(scenario())
        assert removed == 0
        assert status is not None
