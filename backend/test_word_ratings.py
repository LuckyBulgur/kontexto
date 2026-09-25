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

Two failures of the first version are held here as well. The reason asked after
"too hard" arrives in a second call, and that call was refused as a duplicate
vote, so production collected 527 "too hard" votes and not one reason. And the
tally was keyed by game number, which a pool rebuild hands out again, so votes
on different words ended up in one row.
"""

import asyncio
import os
import sqlite3
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
WORDS = ["w%d" % n for n in range(1, 401)]


def token(ip="1.2.3.4", now=NOW):
    return analytics.make_beacon_token(analytics.compute_fingerprint(ip, UA, now), now)


def vote(db, *, game=42, verdict="hard", reason=None, detail=None,
         ip="1.2.3.4", ua=UA, tok=None, now=NOW, first_game=1, words=WORDS):
    return analytics.record_word_rating(
        db, ip=ip, user_agent=ua, token=tok if tok is not None else token(ip, now),
        game_number=game, verdict=verdict, reason=reason, detail=detail,
        target_words=words, first_game=first_game, now=now)


def summary(db, game, words=WORDS):
    return analytics.get_rating_summary(db, game, words[game - 1])


def stats(db, words=WORDS, **kwargs):
    kwargs.setdefault("min_votes", 1)
    return analytics.get_rating_stats(db, target_words=words, **kwargs)


def with_db(path, fn):
    async def go():
        db = await get_db(path)
        try:
            return await fn(db)
        finally:
            await db.close()
    return run(go())


async def count(db, table):
    async with db.execute(f"SELECT COUNT(*) FROM {table}") as cur:
        (value,) = await cur.fetchone()
    return value


class TestAcceptance:
    def test_a_vote_is_recorded(self, db_path):
        ok, reason = with_db(db_path, lambda db: vote(db, verdict="right"))
        assert ok and reason == "ok"

    def test_invalid_token_is_refused_and_writes_nothing(self, db_path):
        ok, reason = with_db(db_path, lambda db: vote(db, tok="garbage"))
        assert not ok and reason == "invalid_token"
        assert with_db(db_path, lambda db: summary(db, 42))["total"] == 0

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

    def test_a_game_number_past_the_pool_is_refused_and_writes_nothing(self, db_path):
        """Without a word there is nothing to count the vote against."""
        async def go(db):
            result = await vote(db, game=len(WORDS) + 1)
            return result, await count(db, "analytics_rating_votes")
        result, ledger = with_db(db_path, go)
        assert result == (False, "bad_payload")
        assert ledger == 0


class TestLegacyGames:
    """The games before the core-lexicon rebuild are not rated.

    They kept the old pool's words, verbs among them, and the archive still
    serves them. A vote on one says nothing about the pool the ratings judge,
    and the dashboard would print it next to a word no current rule admitted.
    """

    def test_a_vote_below_the_floor_is_refused_and_writes_nothing(self, db_path):
        async def go(db):
            result = await vote(db, game=107, first_game=108)
            return result, await count(db, "analytics_rating_votes"), await summary(db, 107)
        result, ledger, tally = with_db(db_path, go)
        assert result == (False, "legacy_game")
        assert ledger == 0
        assert tally["total"] == 0

    def test_the_floor_itself_is_rated(self, db_path):
        ok, reason = with_db(db_path, lambda db: vote(db, game=108, first_game=108))
        assert ok and reason == "ok"

    def test_the_dashboard_drops_words_below_the_floor(self, db_path):
        """Votes on legacy words recorded before the floor existed."""
        async def go(db):
            await vote(db, game=107, verdict="hard", reason="unknown_word")
            await vote(db, game=107, detail="Ein Verb als Lösung")
            await vote(db, game=108, verdict="right", ip="5.5.5.5")
            await vote(db, game=108, verdict="right", ip="5.5.5.5", detail="passt")
            return await stats(db, first_game=108)
        result = with_db(db_path, go)
        assert result["words_with_any_vote"] == 1
        assert result["votes_total"] == 1
        assert result["reasons"]["unknown_word"] == 0
        assert [e["word"] for e in result["rated"]] == ["w108"]
        assert [d["word"] for d in result["details"]] == ["w108"]
        assert result["pool_size"] == len(WORDS) - 107


class TestDedup:
    def test_the_same_person_votes_once_per_word(self, db_path):
        async def go(db):
            first = await vote(db, game=7, verdict="hard")
            second = await vote(db, game=7, verdict="easy")
            return first, second, await summary(db, 7)
        first, second, tally = with_db(db_path, go)
        assert first == (True, "ok")
        assert second == (False, "duplicate")
        assert tally["total"] == 1

    def test_the_same_person_may_vote_on_another_word(self, db_path):
        async def go(db):
            return await vote(db, game=7), await vote(db, game=8)
        first, second = with_db(db_path, go)
        assert first == (True, "ok") and second == (True, "ok")

    def test_two_people_both_count(self, db_path):
        async def go(db):
            await vote(db, game=9, ip="1.1.1.1")
            await vote(db, game=9, ip="2.2.2.2")
            return await summary(db, 9)
        assert with_db(db_path, go)["total"] == 2


class TestReason:
    def test_the_reason_arrives_in_a_second_call_and_is_counted(self, db_path):
        """The client's own sequence: verdict on the first tap, reason on the second.

        This call used to be refused as a duplicate vote.
        """
        async def go(db):
            first = await vote(db, game=12, verdict="hard")
            second = await vote(db, game=12, verdict="hard", reason="unknown_word")
            return first, second, await stats(db), await summary(db, 12)
        first, second, result, tally = with_db(db_path, go)
        assert first == (True, "ok")
        assert second == (True, "ok")
        assert result["reasons"]["unknown_word"] == 1
        # The follow-up completes the vote, it is not a second one.
        assert result["verdicts"]["hard"] == 1
        assert tally["total"] == 1

    def test_the_reason_is_taken_once(self, db_path):
        async def go(db):
            await vote(db, game=13, verdict="hard")
            await vote(db, game=13, verdict="hard", reason="no_idea")
            again = await vote(db, game=13, verdict="hard", reason="unknown_word")
            return again, await stats(db)
        again, result = with_db(db_path, go)
        assert again == (False, "duplicate")
        assert result["reasons"] == {"unknown_word": 0, "no_idea": 1, "bad_neighbours": 0}

    def test_a_reason_sent_with_the_vote_is_counted_and_closes_the_follow_up(self, db_path):
        async def go(db):
            first = await vote(db, game=14, verdict="hard", reason="bad_neighbours")
            again = await vote(db, game=14, verdict="hard", reason="unknown_word")
            return first, again, await stats(db)
        first, again, result = with_db(db_path, go)
        assert first == (True, "ok")
        assert again == (False, "duplicate")
        assert result["reasons"]["bad_neighbours"] == 1
        assert result["reasons"]["unknown_word"] == 0

    def test_a_reason_cannot_be_hung_on_a_vote_that_was_not_hard(self, db_path):
        """The ledger decides, not the verdict the follow-up claims."""
        async def go(db):
            await vote(db, game=15, verdict="easy")
            forged = await vote(db, game=15, verdict="hard", reason="unknown_word")
            return forged, await stats(db)
        forged, result = with_db(db_path, go)
        assert forged == (False, "duplicate")
        assert result["reasons"]["unknown_word"] == 0
        assert result["verdicts"] == {"easy": 1, "right": 0, "hard": 0}

    def test_a_reason_only_survives_next_to_the_hard_verdict(self, db_path):
        """It carries no information elsewhere, so it is dropped, not refused.

        A client that sends it is confused rather than hostile, and refusing the
        whole vote over it would throw away the part that was fine.
        """
        async def go(db):
            ok, _ = await vote(db, game=11, verdict="easy", reason="unknown_word")
            return ok, await stats(db)
        ok, result = with_db(db_path, go)
        assert ok
        assert result["reasons"]["unknown_word"] == 0
        assert result["verdicts"]["easy"] == 1

    def test_the_share_unknown_reads_the_follow_up(self, db_path):
        async def go(db):
            for i in range(4):
                await vote(db, game=16, verdict="hard", ip=f"10.9.0.{i}")
            await vote(db, game=16, verdict="hard", reason="unknown_word", ip="10.9.0.0")
            return await stats(db)
        entry = with_db(db_path, go)["rated"][0]
        assert entry["share_unknown"] == 0.25


class TestRenumbering:
    """A pool rebuild hands the game numbers out again; the vote stays with its word."""

    def test_a_vote_follows_its_word_to_the_new_number(self, db_path):
        old = ["alpha", "beta", "gamma"]
        new = ["gamma", "delta", "alpha"]

        async def go(db):
            await vote(db, game=1, verdict="easy", words=old)
            return (await summary(db, 3, new), await summary(db, 1, new),
                    await stats(db, words=new))
        alpha_now, gamma_now, result = with_db(db_path, go)
        assert alpha_now["total"] == 1
        assert gamma_now["total"] == 0
        assert [(e["word"], e["game_number"]) for e in result["rated"]] == [("alpha", 3)]

    def test_the_same_word_under_another_number_is_still_one_vote(self, db_path):
        async def go(db):
            first = await vote(db, game=1, words=["alpha", "beta"])
            second = await vote(db, game=2, words=["beta", "alpha"])
            return first, second
        first, second = with_db(db_path, go)
        assert first == (True, "ok")
        assert second == (False, "duplicate")

    def test_a_word_struck_from_the_pool_leaves_the_dashboard(self, db_path):
        async def go(db):
            await vote(db, game=1, words=["alpha", "beta"])
            return await stats(db, words=["beta"])
        result = with_db(db_path, go)
        assert result["votes_total"] == 0
        assert result["rated"] == []

    def test_one_word_does_not_leak_into_another_sharing_its_prefix(self, db_path):
        words = ["tee", "teekanne", "tee-ei"]

        async def go(db):
            for game in (1, 2, 3):
                await vote(db, game=game, words=words, ip=f"10.4.0.{game}")
            return [await summary(db, game, words) for game in (1, 2, 3)]
        assert [s["total"] for s in with_db(db_path, go)] == [1, 1, 1]


class TestSummary:
    def test_it_stays_silent_below_the_threshold(self, db_path):
        async def go(db):
            for i in range(analytics.RATING_MIN_VOTES - 1):
                await vote(db, game=20, verdict="right", ip=f"10.0.0.{i}")
            return await summary(db, 20)
        tally = with_db(db_path, go)
        assert tally["total"] == analytics.RATING_MIN_VOTES - 1
        assert tally["enough"] is False
        # Counts are zeroed, so a client cannot render a percentage by mistake.
        assert set(tally["counts"].values()) == {0}

    def test_it_speaks_at_the_threshold(self, db_path):
        async def go(db):
            for i in range(analytics.RATING_MIN_VOTES):
                await vote(db, game=21, verdict="right", ip=f"10.0.1.{i}")
            return await summary(db, 21)
        tally = with_db(db_path, go)
        assert tally["enough"] is True
        assert tally["counts"]["right"] == analytics.RATING_MIN_VOTES
        assert tally["game_number"] == 21


class TestDetail:
    def test_the_free_text_is_stored_without_a_fingerprint(self, db_path):
        async def go(db):
            await vote(db, game=50, verdict="hard", reason="unknown_word")
            ok, _ = await vote(db, game=50, verdict="hard", detail="Das Wort kennt niemand")
            async with db.execute(
                "SELECT game_number, word, detail FROM analytics_rating_details") as cur:
                rows = await cur.fetchall()
            async with db.execute("PRAGMA table_info(analytics_rating_details)") as cur:
                columns = [c[1] for c in await cur.fetchall()]
            return ok, [tuple(r) for r in rows], columns
        ok, rows, columns = with_db(db_path, go)
        assert ok
        assert rows == [(50, "w50", "Das Wort kennt niemand")]
        assert "fp_hash" not in columns

    def test_the_comment_is_filed_under_the_counted_vote(self, db_path):
        """The client repeats only the verdict; what counted is in the ledger."""
        async def go(db):
            await vote(db, game=55, verdict="hard")
            await vote(db, game=55, verdict="hard", reason="bad_neighbours")
            await vote(db, game=55, verdict="easy", detail="Wolle hat nichts damit zu tun")
            return await stats(db)
        (detail,) = with_db(db_path, go)["details"]
        assert (detail["verdict"], detail["reason"]) == ("hard", "bad_neighbours")

    def test_only_one_comment_per_person_and_word(self, db_path):
        async def go(db):
            await vote(db, game=51, detail=None)
            first = await vote(db, game=51, detail="erster")
            second = await vote(db, game=51, detail="zweiter")
            return first, second, await count(db, "analytics_rating_details")
        first, second, rows = with_db(db_path, go)
        assert first == (True, "ok")
        assert second == (False, "duplicate")
        assert rows == 1

    def test_a_comment_without_a_vote_is_refused(self, db_path):
        async def go(db):
            result = await vote(db, game=56, detail="ohne Stimme")
            return result, await count(db, "analytics_rating_details")
        result, rows = with_db(db_path, go)
        assert result == (False, "duplicate")
        assert rows == 0

    def test_an_insult_is_dropped_and_still_reported_as_accepted(self, db_path):
        """Nothing tells the writer the filter fired.

        A rejection with a message is a probe: type, read the error, adjust. The
        ledger still burns the one comment, so it cannot be resent in a milder
        spelling until it lands.
        """
        async def go(db):
            await vote(db, game=52)
            ok, _ = await vote(db, game=52, detail="du hurensohn")
            return ok, await count(db, "analytics_rating_details")
        ok, rows = with_db(db_path, go)
        assert ok is True
        assert rows == 0

    @pytest.mark.parametrize("detail", [
        "Hitler war besser", "Sieg Heil", "h i t l e r", "1488", "fuck this word",
    ])
    def test_extremist_and_english_detail_is_dropped(self, db_path, detail):
        async def go(db):
            await vote(db, game=53)
            ok, _ = await vote(db, game=53, detail=detail)
            return ok, await count(db, "analytics_rating_details")
        ok, rows = with_db(db_path, go)
        assert ok is True
        assert rows == 0

    def test_ordinary_detail_with_numbers_is_kept(self, db_path):
        async def go(db):
            await vote(db, game=54)
            await vote(db, game=54, detail="Nach 88 Versuchen, Jahrgang 1988")
            return await count(db, "analytics_rating_details")
        assert with_db(db_path, go) == 1

    def test_a_comment_from_before_the_word_column_is_not_shown(self, db_path):
        """Its game number may name another word by now."""
        async def go(db):
            await db.execute(
                "INSERT INTO analytics_rating_details (game_number, verdict, reason, detail, "
                "date, ts) VALUES (60, 'hard', NULL, 'Was hat Schnuller damit zu tun', "
                "'2026-09-22', '2026-09-22T12:00:00+00:00')")
            await db.commit()
            return await stats(db)
        assert with_db(db_path, go)["details"] == []


class TestDashboard:
    def test_coverage_comes_with_the_numbers(self, db_path):
        async def go(db):
            for i in range(6):
                await vote(db, game=100, verdict="hard", reason="unknown_word",
                           ip=f"10.1.0.{i}")
            for i in range(6):
                await vote(db, game=101, verdict="easy", ip=f"10.2.0.{i}")
            return await stats(db, words=WORDS[:200], min_votes=5)
        result = with_db(db_path, go)
        assert result["pool_size"] == 200
        assert result["words_with_any_vote"] == 2
        assert result["words_rated"] == 2
        assert result["removal_candidates"][0]["game_number"] == 100
        assert result["removal_candidates"][0]["word"] == "w100"
        assert result["removal_candidates"][0]["share_unknown"] == 1.0
        assert result["too_easy"][0]["game_number"] == 101

    def test_a_thin_word_is_counted_but_not_ranked(self, db_path):
        async def go(db):
            await vote(db, game=110, verdict="hard")
            return await stats(db, min_votes=5)
        result = with_db(db_path, go)
        assert result["words_with_any_vote"] == 1
        assert result["words_rated"] == 0
        assert result["removal_candidates"] == []

    def test_the_play_figures_ride_along(self, db_path):
        async def go(db):
            await db.execute(
                "INSERT INTO analytics_game_stats (mode, game_number, metric, value) "
                "VALUES ('kontexto', 120, 'guesses', 900)")
            await db.commit()
            for i in range(5):
                await vote(db, game=120, verdict="right", ip=f"10.3.0.{i}")
            return await stats(db, min_votes=5)
        assert with_db(db_path, go)["rated"][0]["played_guesses"] == 900

    def test_the_first_version_counters_are_not_read(self, db_path):
        """v1 rows are keyed by a number that no longer names a word."""
        async def go(db):
            await db.execute(
                "INSERT INTO analytics_counters (date, metric, dimension, value) "
                "VALUES ('2026-09-22', 'word_rating_v1', '42:hard:none', 30)")
            await db.commit()
            return await stats(db), await summary(db, 42)
        result, tally = with_db(db_path, go)
        assert result["votes_total"] == 0
        assert tally["total"] == 0


class TestRetention:
    def test_the_ledger_expires_and_the_votes_do_not(self, db_path):
        """The count is permanent, the row that links it to a person is not."""
        async def go(db):
            await vote(db, game=200, verdict="right")
            later = NOW + timedelta(days=analytics.RATING_SEEN_RETENTION_DAYS + 1)
            await analytics.prune_old_events(db, now=later)
            return await count(db, "analytics_rating_votes"), await summary(db, 200)
        ledger, tally = with_db(db_path, go)
        assert ledger == 0
        assert tally["total"] == 1


class TestMigration:
    def test_a_database_from_the_first_version_is_brought_forward(self):
        """Production has the number-keyed ledger and comments without a word."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "duels.db")
            conn = sqlite3.connect(path)
            conn.executescript("""
                CREATE TABLE analytics_rating_seen (
                    fp_hash TEXT NOT NULL, game_number INTEGER NOT NULL,
                    detail_done INTEGER NOT NULL DEFAULT 0, ts TIMESTAMP NOT NULL,
                    PRIMARY KEY (fp_hash, game_number));
                CREATE TABLE analytics_rating_details (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, game_number INTEGER NOT NULL,
                    verdict TEXT NOT NULL, reason TEXT, detail TEXT NOT NULL,
                    date TEXT NOT NULL, ts TIMESTAMP NOT NULL);
                INSERT INTO analytics_rating_details (game_number, verdict, detail, date, ts)
                    VALUES (107, 'hard', 'alt', '2026-09-22', '2026-09-22T12:00:00');
            """)
            conn.commit()
            conn.close()

            run(init_db(path))

            conn = sqlite3.connect(path)
            try:
                tables = {r[0] for r in conn.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table'")}
                columns = [c[1] for c in conn.execute(
                    "PRAGMA table_info(analytics_rating_details)")]
                kept = conn.execute(
                    "SELECT game_number, word, detail FROM analytics_rating_details").fetchall()
            finally:
                conn.close()
            assert "analytics_rating_seen" not in tables
            assert "analytics_rating_votes" in tables
            assert "word" in columns
            assert kept == [(107, None, "alt")]
