"""The post-round word rating: one vote per person per word, and nothing else.

This is the only figure the project takes from the player rather than from a
request handler, so the posture is the one the distribution histograms already
use and these tests hold it from the outside: a fingerprint-bound token, a bot
filter, a validated enum payload, a dedup ledger, and no authoritative counter
touched.

The tally shown back to the player has its own rule, and it has a reason: below
the threshold a percentage is noise, and shown to the next voter it would anchor
them on it. A survey that reports its own majority stops measuring opinion and
starts measuring itself.
"""

import asyncio
import os
import tempfile
from datetime import datetime, timedelta, timezone

import pytest

os.environ.setdefault("KONTEXTO_SERVER_SECRET", "test-secret")

import analytics
from database import init_db, get_db


def run(coro):
    return asyncio.run(coro)


@pytest.fixture
def db_path():
    with tempfile.TemporaryDirectory() as tmpdir:
        path = os.path.join(tmpdir, "duels.db")
        run(init_db(path))
        yield path


NOW = datetime(2026, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
UA = "Mozilla/5.0 Chrome/120"


def token(ip="1.2.3.4", now=NOW):
    return analytics.make_beacon_token(analytics.compute_fingerprint(ip, UA, now), now)


def vote(db, *, game=42, verdict="hard", reason=None, detail=None,
         ip="1.2.3.4", ua=UA, tok=None, now=NOW):
    return analytics.record_word_rating(
        db, ip=ip, user_agent=ua, token=tok if tok is not None else token(ip, now),
        game_number=game, verdict=verdict, reason=reason, detail=detail, now=now)


def with_db(path, fn):
    async def go():
        db = await get_db(path)
        try:
            return await fn(db)
        finally:
            await db.close()
    return run(go())


class TestAcceptance:
    def test_a_vote_is_recorded(self, db_path):
        ok, reason = with_db(db_path, lambda db: vote(db, verdict="right"))
        assert ok and reason == "ok"

    def test_invalid_token_is_refused_and_writes_nothing(self, db_path):
        ok, reason = with_db(db_path, lambda db: vote(db, tok="garbage"))
        assert not ok and reason == "invalid_token"
        summary = with_db(db_path, lambda db: analytics.get_rating_summary(db, 42))
        assert summary["total"] == 0

    def test_a_bot_is_refused(self, db_path):
        ok, reason = with_db(db_path, lambda db: vote(
            db, ua="Googlebot/2.1", tok=analytics.make_beacon_token(
                analytics.compute_fingerprint("1.2.3.4", "Googlebot/2.1", NOW), NOW)))
        assert not ok and reason == "bot"

    def test_an_unknown_verdict_is_a_clean_refusal(self, db_path):
        ok, reason = with_db(db_path, lambda db: vote(db, verdict="grandios"))
        assert not ok and reason == "bad_payload"

    def test_an_unknown_reason_is_a_clean_refusal(self, db_path):
        ok, reason = with_db(db_path, lambda db: vote(db, reason="weil"))
        assert not ok and reason == "bad_payload"

    def test_a_game_number_below_one_is_refused(self, db_path):
        ok, reason = with_db(db_path, lambda db: vote(db, game=0))
        assert not ok and reason == "bad_payload"


class TestDedup:
    def test_the_same_person_votes_once_per_word(self, db_path):
        async def go(db):
            first = await vote(db, game=7, verdict="hard")
            second = await vote(db, game=7, verdict="easy")
            return first, second
        first, second = with_db(db_path, go)
        assert first == (True, "ok")
        assert second == (False, "duplicate")
        summary = with_db(db_path, lambda db: analytics.get_rating_summary(db, 7))
        assert summary["total"] == 1

    def test_the_same_person_may_vote_on_another_word(self, db_path):
        async def go(db):
            return await vote(db, game=7), await vote(db, game=8)
        first, second = with_db(db_path, go)
        assert first == (True, "ok") and second == (True, "ok")

    def test_two_people_both_count(self, db_path):
        async def go(db):
            await vote(db, game=9, ip="1.1.1.1")
            await vote(db, game=9, ip="2.2.2.2")
            return await analytics.get_rating_summary(db, 9)
        assert with_db(db_path, go)["total"] == 2


class TestReason:
    def test_a_reason_only_survives_next_to_the_hard_verdict(self, db_path):
        """It carries no information elsewhere, so it is dropped, not refused.

        A client that sends it is confused rather than hostile, and refusing the
        whole vote over it would throw away the part that was fine.
        """
        async def go(db):
            ok, _ = await vote(db, game=11, verdict="easy", reason="unknown_word")
            stats = await analytics.get_rating_stats(db, min_votes=1)
            return ok, stats
        ok, stats = with_db(db_path, go)
        assert ok
        assert stats["reasons"]["unknown_word"] == 0
        assert stats["verdicts"]["easy"] == 1

    def test_the_reason_is_kept_with_the_hard_verdict(self, db_path):
        async def go(db):
            await vote(db, game=12, verdict="hard", reason="unknown_word")
            return await analytics.get_rating_stats(db, min_votes=1)
        stats = with_db(db_path, go)
        assert stats["reasons"]["unknown_word"] == 1


class TestSummary:
    def test_it_stays_silent_below_the_threshold(self, db_path):
        async def go(db):
            for i in range(analytics.RATING_MIN_VOTES - 1):
                await vote(db, game=20, verdict="right", ip=f"10.0.0.{i}")
            return await analytics.get_rating_summary(db, 20)
        summary = with_db(db_path, go)
        assert summary["total"] == analytics.RATING_MIN_VOTES - 1
        assert summary["enough"] is False
        # Counts are zeroed, so a client cannot render a percentage by mistake.
        assert set(summary["counts"].values()) == {0}

    def test_it_speaks_at_the_threshold(self, db_path):
        async def go(db):
            for i in range(analytics.RATING_MIN_VOTES):
                await vote(db, game=21, verdict="right", ip=f"10.0.1.{i}")
            return await analytics.get_rating_summary(db, 21)
        summary = with_db(db_path, go)
        assert summary["enough"] is True
        assert summary["counts"]["right"] == analytics.RATING_MIN_VOTES

    def test_one_word_does_not_leak_into_another(self, db_path):
        async def go(db):
            await vote(db, game=3, verdict="hard")
            await vote(db, game=33, verdict="hard", ip="5.5.5.5")
            # 3 is a prefix of 33 as a string; the dimension is parsed, not matched.
            return await analytics.get_rating_stats(db, min_votes=1)
        stats = with_db(db_path, go)
        by_game = {e["game_number"]: e["votes"] for e in stats["rated"]}
        assert by_game == {3: 1, 33: 1}


class TestDetail:
    def test_the_free_text_is_stored_without_a_fingerprint(self, db_path):
        async def go(db):
            await vote(db, game=50, verdict="hard", reason="unknown_word")
            ok, _ = await vote(db, game=50, verdict="hard", reason="unknown_word",
                               detail="Das Wort kennt niemand")
            async with db.execute(
                "SELECT game_number, detail FROM analytics_rating_details") as cur:
                rows = await cur.fetchall()
            async with db.execute("PRAGMA table_info(analytics_rating_details)") as cur:
                columns = [c[1] for c in await cur.fetchall()]
            return ok, [tuple(r) for r in rows], columns
        ok, rows, columns = with_db(db_path, go)
        assert ok
        assert rows == [(50, "Das Wort kennt niemand")]
        assert "fp_hash" not in columns

    def test_only_one_comment_per_person_and_word(self, db_path):
        async def go(db):
            await vote(db, game=51, detail=None)
            first = await vote(db, game=51, detail="erster")
            second = await vote(db, game=51, detail="zweiter")
            async with db.execute("SELECT COUNT(*) FROM analytics_rating_details") as cur:
                (count,) = await cur.fetchone()
            return first, second, count
        first, second, count = with_db(db_path, go)
        assert first == (True, "ok")
        assert second == (False, "duplicate")
        assert count == 1

    def test_an_insult_is_dropped_and_still_reported_as_accepted(self, db_path):
        """Nothing tells the writer the filter fired.

        A rejection with a message is a probe: type, read the error, adjust. The
        ledger still burns the one comment, so it cannot be resent in a milder
        spelling until it lands.
        """
        async def go(db):
            await vote(db, game=52)
            ok, _ = await vote(db, game=52, detail="du hurensohn")
            async with db.execute("SELECT COUNT(*) FROM analytics_rating_details") as cur:
                (count,) = await cur.fetchone()
            return ok, count
        ok, count = with_db(db_path, go)
        assert ok is True
        assert count == 0


class TestDashboard:
    def test_coverage_comes_with_the_numbers(self, db_path):
        async def go(db):
            for i in range(6):
                await vote(db, game=100, verdict="hard", reason="unknown_word",
                           ip=f"10.1.0.{i}")
            for i in range(6):
                await vote(db, game=101, verdict="easy", ip=f"10.2.0.{i}")
            words = ["w%d" % n for n in range(1, 201)]
            return await analytics.get_rating_stats(db, target_words=words, min_votes=5)
        stats = with_db(db_path, go)
        assert stats["pool_size"] == 200
        assert stats["games_with_any_vote"] == 2
        assert stats["games_rated"] == 2
        assert stats["removal_candidates"][0]["game_number"] == 100
        assert stats["removal_candidates"][0]["word"] == "w100"
        assert stats["removal_candidates"][0]["share_unknown"] == 1.0
        assert stats["too_easy"][0]["game_number"] == 101

    def test_a_thin_word_is_counted_but_not_ranked(self, db_path):
        async def go(db):
            await vote(db, game=110, verdict="hard")
            return await analytics.get_rating_stats(db, min_votes=5)
        stats = with_db(db_path, go)
        assert stats["games_with_any_vote"] == 1
        assert stats["games_rated"] == 0
        assert stats["removal_candidates"] == []

    def test_the_play_figures_ride_along(self, db_path):
        async def go(db):
            await db.execute(
                "INSERT INTO analytics_game_stats (mode, game_number, metric, value) "
                "VALUES ('kontexto', 120, 'guesses', 900)")
            await db.commit()
            for i in range(5):
                await vote(db, game=120, verdict="right", ip=f"10.3.0.{i}")
            return await analytics.get_rating_stats(db, min_votes=5)
        stats = with_db(db_path, go)
        assert stats["rated"][0]["played_guesses"] == 900


class TestRetention:
    def test_the_ledger_expires_and_the_votes_do_not(self, db_path):
        """The count is permanent, the row that links it to a person is not."""
        async def go(db):
            await vote(db, game=200, verdict="right")
            later = NOW + timedelta(days=analytics.RATING_SEEN_RETENTION_DAYS + 1)
            await analytics.prune_old_events(db, now=later)
            async with db.execute("SELECT COUNT(*) FROM analytics_rating_seen") as cur:
                (ledger,) = await cur.fetchone()
            summary = await analytics.get_rating_summary(db, 200)
            return ledger, summary
        ledger, summary = with_db(db_path, go)
        assert ledger == 0
        assert summary["total"] == 1
