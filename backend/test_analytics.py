"""Tests for server-side analytics & admin auth."""

import asyncio
import hashlib
import os
import sqlite3
import tempfile
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import aiosqlite
import pytest

os.environ.setdefault("KONTEXTO_SERVER_SECRET", "test-secret")

import analytics
import auth
from database import init_db, get_db
from server_secret import MissingServerSecretError, server_secret


def run(coro):
    return asyncio.run(coro)


@pytest.fixture
def db_path():
    with tempfile.TemporaryDirectory() as tmpdir:
        path = os.path.join(tmpdir, "duels.db")
        run(init_db(path))
        yield path


JAN = datetime(2026, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
FEB = datetime(2026, 2, 15, 12, 0, 0, tzinfo=timezone.utc)


class TestFingerprint:
    def test_stable_within_month(self):
        a = analytics.compute_fingerprint("1.2.3.4", "Mozilla/5.0", JAN)
        b = analytics.compute_fingerprint("1.2.3.4", "Mozilla/5.0", JAN.replace(day=28))
        assert a == b  # monthly salt => stable within the month

    def test_rotates_across_months(self):
        a = analytics.compute_fingerprint("1.2.3.4", "Mozilla/5.0", JAN)
        b = analytics.compute_fingerprint("1.2.3.4", "Mozilla/5.0", FEB)
        assert a != b

    def test_distinct_ips_distinct_hashes(self):
        a = analytics.compute_fingerprint("1.2.3.4", "Mozilla/5.0", JAN)
        b = analytics.compute_fingerprint("9.9.9.9", "Mozilla/5.0", JAN)
        assert a != b

    def test_not_reversible_contains_no_ip(self):
        fp = analytics.compute_fingerprint("1.2.3.4", "Mozilla/5.0", JAN)
        assert "1.2.3.4" not in fp and len(fp) == 32


class TestBeaconToken:
    def test_valid_token_accepted(self):
        fp = analytics.compute_fingerprint("1.2.3.4", "UA", JAN)
        token = analytics.make_beacon_token(fp, JAN)
        assert analytics.verify_beacon_token(token, fp, JAN)

    def test_token_bound_to_fingerprint(self):
        fp1 = analytics.compute_fingerprint("1.2.3.4", "UA", JAN)
        fp2 = analytics.compute_fingerprint("5.6.7.8", "UA", JAN)
        token = analytics.make_beacon_token(fp1, JAN)
        assert not analytics.verify_beacon_token(token, fp2, JAN)

    def test_empty_token_rejected(self):
        fp = analytics.compute_fingerprint("1.2.3.4", "UA", JAN)
        assert not analytics.verify_beacon_token("", fp, JAN)


class TestUserAgentClassification:
    @pytest.mark.parametrize("ua", [
        "Googlebot/2.1", "python-requests/2.31", "curl/8.0",
        "HeadlessChrome/120", "", "Mozilla/5.0 (compatible; bingbot/2.0)",
    ])
    def test_bots_detected(self, ua):
        assert analytics.classify_user_agent(ua)[0] == "bot"

    def test_real_browser_human(self):
        ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36"
        ua_class, device, browser, os_name = analytics.classify_user_agent(ua)
        assert ua_class == "human" and device == "desktop" and browser == "Chrome"
        assert os_name == "Windows"

    def test_mobile_detected(self):
        ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148 Safari/604.1"
        ua_class, device, _, _ = analytics.classify_user_agent(ua)
        assert ua_class == "human" and device == "mobile"


class TestNormalizePage:
    @pytest.mark.parametrize("path,expected", [
        ("/", "/"), ("", "other"), ("/wordle", "/wordle"),
        ("/wordle/duel/abc", "/wordle/duel"), ("/duel/xyz", "/duel"),
        ("/?foo=bar", "/"), ("/random", "other"),
    ])
    def test_labels(self, path, expected):
        assert analytics.normalize_page(path) == expected


class TestRecordPageview:
    def _valid_token(self, ip="1.2.3.4", ua="Mozilla/5.0 Chrome/120", now=JAN):
        fp = analytics.compute_fingerprint(ip, ua, now)
        return analytics.make_beacon_token(fp, now)

    def test_invalid_token_rejected(self, db_path):
        async def go():
            db = await get_db(db_path)
            try:
                ok, reason = await analytics.record_pageview(
                    db, ip="1.2.3.4", user_agent="Mozilla/5.0 Chrome/120",
                    referrer=None, page="/", token="garbage", now=JAN)
                return ok, reason
            finally:
                await db.close()
        ok, reason = run(go())
        assert not ok and reason == "invalid_token"

    def test_bot_rejected_even_with_token(self, db_path):
        async def go():
            db = await get_db(db_path)
            try:
                fp = analytics.compute_fingerprint("1.2.3.4", "Googlebot/2.1", JAN)
                token = analytics.make_beacon_token(fp, JAN)
                return await analytics.record_pageview(
                    db, ip="1.2.3.4", user_agent="Googlebot/2.1",
                    referrer=None, page="/", token=token, now=JAN)
            finally:
                await db.close()
        ok, reason = run(go())
        assert not ok and reason == "bot"

    def test_valid_then_duplicate(self, db_path):
        ua = "Mozilla/5.0 Chrome/120"
        token = self._valid_token(ua=ua)

        async def go():
            db = await get_db(db_path)
            try:
                first = await analytics.record_pageview(
                    db, ip="1.2.3.4", user_agent=ua, referrer=None,
                    page="/", token=token, now=JAN)
                second = await analytics.record_pageview(
                    db, ip="1.2.3.4", user_agent=ua, referrer=None,
                    page="/", token=token, now=JAN)
                return first, second
            finally:
                await db.close()
        first, second = run(go())
        assert first == (True, "ok")
        assert second[0] is False and second[1] == "duplicate"


class TestPresence:
    def _token(self, ip="1.2.3.4", ua="Mozilla/5.0 Chrome/120", now=JAN):
        fp = analytics.compute_fingerprint(ip, ua, now)
        return analytics.make_beacon_token(fp, now)

    def test_invalid_token_rejected(self, db_path):
        async def go():
            db = await get_db(db_path)
            try:
                return await analytics.record_heartbeat(
                    db, ip="1.2.3.4", user_agent="Mozilla/5.0 Chrome/120",
                    page="/", token="garbage", now=JAN)
            finally:
                await db.close()
        ok, reason = run(go())
        assert not ok and reason == "invalid_token"

    def test_bot_rejected(self, db_path):
        async def go():
            db = await get_db(db_path)
            try:
                fp = analytics.compute_fingerprint("1.2.3.4", "Googlebot/2.1", JAN)
                token = analytics.make_beacon_token(fp, JAN)
                return await analytics.record_heartbeat(
                    db, ip="1.2.3.4", user_agent="Googlebot/2.1",
                    page="/", token=token, now=JAN)
            finally:
                await db.close()
        ok, reason = run(go())
        assert not ok and reason == "bot"

    def test_distinct_visitors_counted_once_each(self, db_path):
        ua = "Mozilla/5.0 Chrome/120"

        async def go():
            db = await get_db(db_path)
            try:
                # Same visitor heartbeats twice -> still one row (idempotent upsert).
                token_a = self._token(ip="1.1.1.1", ua=ua)
                await analytics.record_heartbeat(
                    db, ip="1.1.1.1", user_agent=ua, page="/", token=token_a, now=JAN)
                await analytics.record_heartbeat(
                    db, ip="1.1.1.1", user_agent=ua, page="/wordle", token=token_a, now=JAN)
                # A second, distinct visitor.
                token_b = self._token(ip="2.2.2.2", ua=ua)
                await analytics.record_heartbeat(
                    db, ip="2.2.2.2", user_agent=ua, page="/", token=token_b, now=JAN)
                return await analytics.get_live_visitors(db, JAN)
            finally:
                await db.close()
        live = run(go())
        assert live["active_now"] == 2
        # The first visitor's latest heartbeat (page "/wordle") wins the upsert.
        assert live["by_page"] == {"/": 1, "/wordle": 1}

    def test_stale_heartbeats_drop_out_of_window(self, db_path):
        ua = "Mozilla/5.0 Chrome/120"
        token = self._token(ua=ua)
        later = JAN + timedelta(seconds=analytics.PRESENCE_WINDOW_SECONDS + 30)

        async def go():
            db = await get_db(db_path)
            try:
                await analytics.record_heartbeat(
                    db, ip="1.2.3.4", user_agent=ua, page="/", token=token, now=JAN)
                live_then = await analytics.get_live_visitors(db, JAN)
                live_later = await analytics.get_live_visitors(db, later)
                return live_then, live_later
            finally:
                await db.close()
        live_then, live_later = run(go())
        assert live_then["active_now"] == 1
        assert live_later["active_now"] == 0

    def test_prune_presence_deletes_stale_rows(self, db_path):
        ua = "Mozilla/5.0 Chrome/120"
        token = self._token(ua=ua)
        later = JAN + timedelta(seconds=analytics.PRESENCE_WINDOW_SECONDS + 30)

        async def go():
            db = await get_db(db_path)
            try:
                await analytics.record_heartbeat(
                    db, ip="1.2.3.4", user_agent=ua, page="/", token=token, now=JAN)
                deleted = await analytics.prune_presence(db, later)
                cur = await db.execute("SELECT COUNT(*) FROM analytics_presence")
                remaining = (await cur.fetchone())[0]
                return deleted, remaining
            finally:
                await db.close()
        deleted, remaining = run(go())
        assert deleted == 1 and remaining == 0


class TestActionCountersAndManipulation:
    def test_record_action_increments(self, db_path):
        async def go():
            await analytics.record_action(db_path, "guesses", "kontexto", word="Hund", now=JAN)
            await analytics.record_action(db_path, "guesses", "kontexto", word="Hund", now=JAN)
            await analytics.record_action(db_path, "solves", "kontexto", now=JAN)
            db = await get_db(db_path)
            try:
                cur = await db.execute(
                    "SELECT SUM(value) FROM analytics_counters WHERE metric='guesses'")
                guesses = (await cur.fetchone())[0]
                cur = await db.execute(
                    "SELECT count FROM analytics_word_counts WHERE word='hund'")
                word_count = (await cur.fetchone())[0]
                return guesses, word_count
            finally:
                await db.close()
        guesses, word_count = run(go())
        assert guesses == 2 and word_count == 2

    def test_beacon_cannot_change_guess_count(self, db_path):
        """A pageview beacon must never touch authoritative action counters."""
        ua = "Mozilla/5.0 Chrome/120"
        fp = analytics.compute_fingerprint("1.2.3.4", ua, JAN)
        token = analytics.make_beacon_token(fp, JAN)

        async def go():
            db = await get_db(db_path)
            try:
                await analytics.record_pageview(
                    db, ip="1.2.3.4", user_agent=ua, referrer=None,
                    page="/", token=token, now=JAN)
                cur = await db.execute("SELECT COUNT(*) FROM analytics_counters")
                return (await cur.fetchone())[0]
            finally:
                await db.close()
        assert run(go()) == 0  # beacon wrote zero action counters


class TestWriteResilience:
    """Multi-process SQLite write integrity: no silent loss, no double-count."""

    def test_busy_timeout_configured(self, db_path):
        async def go():
            db = await get_db(db_path)
            try:
                cur = await db.execute("PRAGMA busy_timeout")
                return (await cur.fetchone())[0]
            finally:
                await db.close()
        assert run(go()) == 5000

    def test_concurrent_record_action_no_loss(self, db_path):
        """Many concurrent writers must all land, none dropped to SQLITE_BUSY."""
        async def go():
            await asyncio.gather(*[
                analytics.record_action(db_path, "guesses", "kontexto", now=JAN)
                for _ in range(50)
            ])
            db = await get_db(db_path)
            try:
                cur = await db.execute(
                    "SELECT SUM(value) FROM analytics_counters WHERE metric='guesses'")
                return (await cur.fetchone())[0]
            finally:
                await db.close()
        assert run(go()) == 50

    def test_commit_with_retry_recovers_without_double_count(self, db_path):
        """A first commit that hits a lock is retried; rollback prevents +2."""
        async def go():
            db = await get_db(db_path)
            calls = {"n": 0}
            real_commit = db.commit

            async def flaky_commit():
                calls["n"] += 1
                if calls["n"] == 1:
                    raise sqlite3.OperationalError("database is locked")
                await real_commit()

            db.commit = flaky_commit

            async def write(conn):
                await analytics._bump(conn, "analytics_counters",
                                      "2026-01-15", "guesses", "kontexto", 1)
            try:
                ok = await analytics._commit_with_retry(db, write, description="test")
                db.commit = real_commit
                cur = await db.execute(
                    "SELECT SUM(value) FROM analytics_counters WHERE metric='guesses'")
                return ok, (await cur.fetchone())[0]
            finally:
                await db.close()
        ok, total = run(go())
        assert ok is True and total == 1  # retried, counted exactly once

    def test_commit_with_retry_propagates_non_lock_errors(self, db_path):
        async def go():
            db = await get_db(db_path)
            try:
                async def write(conn):
                    raise sqlite3.OperationalError("no such table: nope")
                await analytics._commit_with_retry(db, write, description="test")
            finally:
                await db.close()
        with pytest.raises(sqlite3.OperationalError):
            run(go())

    def test_record_pageview_retries_on_lock(self, db_path):
        """A transient lock on the beacon insert is retried, not lost or duplicated."""
        ua = "Mozilla/5.0 Chrome/120"
        fp = analytics.compute_fingerprint("1.2.3.4", ua, JAN)
        token = analytics.make_beacon_token(fp, JAN)

        async def go():
            db = await get_db(db_path)
            calls = {"n": 0}
            real_commit = db.commit

            async def flaky_commit():
                calls["n"] += 1
                if calls["n"] == 1:
                    raise sqlite3.OperationalError("database is locked")
                await real_commit()

            db.commit = flaky_commit
            try:
                ok, reason = await analytics.record_pageview(
                    db, ip="1.2.3.4", user_agent=ua, referrer=None,
                    page="/", token=token, now=JAN)
                db.commit = real_commit
                cur = await db.execute("SELECT COUNT(*) FROM analytics_events")
                return ok, reason, (await cur.fetchone())[0]
            finally:
                await db.close()
        ok, reason, count = run(go())
        assert ok is True and reason == "ok" and count == 1


class TestStatsPageviews:
    def test_pageviews_by_page_includes_today_without_aggregation(self, db_path):
        """Today's pageviews must show up live, before aggregate_daily runs."""
        ua = "Mozilla/5.0 Chrome/120"
        fp = analytics.compute_fingerprint("1.2.3.4", ua, JAN)
        token = analytics.make_beacon_token(fp, JAN)

        async def go():
            db = await get_db(db_path)
            try:
                await analytics.record_pageview(
                    db, ip="1.2.3.4", user_agent=ua, referrer=None,
                    page="/wordle", token=token, now=JAN)
                # Intentionally NO aggregate_daily() call.
                return await analytics.get_stats(db, JAN)
            finally:
                await db.close()
        stats = run(go())
        assert stats["pageviews_by_page"].get("/wordle") == 1


class TestAggregation:
    def test_unique_visitors(self, db_path):
        async def go():
            db = await get_db(db_path)
            try:
                # 3 distinct human fingerprints, one repeats (different page).
                for ip, page in [("1.1.1.1", "/"), ("1.1.1.1", "/wordle"),
                                 ("2.2.2.2", "/"), ("3.3.3.3", "/")]:
                    ua = "Mozilla/5.0 Chrome/120"
                    fp = analytics.compute_fingerprint(ip, ua, JAN)
                    token = analytics.make_beacon_token(fp, JAN)
                    await analytics.record_pageview(
                        db, ip=ip, user_agent=ua, referrer=None,
                        page=page, token=token, now=JAN)
                await analytics.aggregate_daily(db, JAN)
                cur = await db.execute(
                    "SELECT value FROM analytics_daily "
                    "WHERE metric='unique_visitors' AND date='2026-01-15'")
                return (await cur.fetchone())[0]
            finally:
                await db.close()
        assert run(go()) == 3

    def test_prune_keeps_recent(self, db_path):
        async def go():
            db = await get_db(db_path)
            try:
                old = datetime(2025, 1, 1, tzinfo=timezone.utc)
                await db.execute(
                    "INSERT INTO analytics_events "
                    "(ts, event_type, page, fp_hash, ua_class) VALUES (?,?,?,?,?)",
                    (old.isoformat(), "pageview", "/", "x", "human"))
                await db.commit()
                deleted = await analytics.prune_old_events(db, JAN)
                cur = await db.execute("SELECT COUNT(*) FROM analytics_events")
                return deleted, (await cur.fetchone())[0]
            finally:
                await db.close()
        deleted, remaining = run(go())
        assert deleted == 1 and remaining == 0


class TestClientIp:
    def test_real_client_is_second_from_right(self):
        # Caddy appends real client (U), nginx appends Caddy (C): "U, C".
        assert analytics.client_ip_from_headers("203.0.113.7, 10.0.0.2", "10.0.0.2", "127.0.0.1", hops=2) == "203.0.113.7"

    def test_spoofed_left_entries_ignored(self):
        # Attacker prepends a fake hop; it must NOT be picked up.
        xff = "1.2.3.4, 203.0.113.7, 10.0.0.2"  # spoof, realclient, caddy
        assert analytics.client_ip_from_headers(xff, "10.0.0.2", "127.0.0.1", hops=2) == "203.0.113.7"

    def test_x_real_ip_not_used_when_xff_present(self):
        # X-Real-IP is Caddy's constant IP and must never be the identity.
        assert analytics.client_ip_from_headers("203.0.113.7, 10.0.0.2", "10.0.0.2", None, hops=2) != "10.0.0.2"

    def test_direct_access_falls_back_to_peer(self):
        assert analytics.client_ip_from_headers(None, None, "198.51.100.9", hops=2) == "198.51.100.9"

    def test_fewer_hops_than_expected_clamps(self):
        assert analytics.client_ip_from_headers("203.0.113.7", None, "127.0.0.1", hops=2) == "203.0.113.7"


class TestLoginBruteForceBackstop:
    def test_failures_counted_within_window(self, db_path):
        async def go():
            db = await get_db(db_path)
            try:
                for _ in range(5):
                    await analytics.record_login_failure(db, JAN)
                return await analytics.login_failures(db, JAN)
            finally:
                await db.close()
        assert run(go()) == 5

    def test_old_failures_outside_window_ignored(self, db_path):
        async def go():
            db = await get_db(db_path)
            try:
                await analytics.record_login_failure(db, JAN)
                later = datetime(2026, 1, 15, 12, 30, 0, tzinfo=timezone.utc)  # +30 min
                return await analytics.login_failures(db, later)  # window = 10 min
            finally:
                await db.close()
        assert run(go()) == 0


class TestSessionToken:
    def test_issue_and_verify(self):
        token = auth.issue_session_token()
        assert auth.verify_session_token(token) is True
        assert auth.verify_session_token("forged.token") is False

    def test_expiry(self):
        import time
        expired = auth.issue_session_token(now=time.time() - auth.SESSION_TTL - 10)
        assert auth.verify_session_token(expired) is False


class TestChallengeToken:
    def test_roundtrip(self):
        challenge = b"\x01\x02\x03 a random challenge"
        token = auth.make_challenge_token(challenge, "auth")
        assert auth.verify_challenge_token(token, "auth") == challenge

    def test_wrong_purpose_rejected(self):
        token = auth.make_challenge_token(b"abc", "auth")
        assert auth.verify_challenge_token(token, "reg") is None

    def test_expired_rejected(self):
        import time
        token = auth.make_challenge_token(b"abc", "auth", now=time.time() - auth.CHALLENGE_TTL - 5)
        assert auth.verify_challenge_token(token, "auth") is None

    def test_tampered_signature_rejected(self):
        token = auth.make_challenge_token(b"abc", "auth")
        payload, _, _sig = token.partition(".")
        assert auth.verify_challenge_token(payload + ".deadbeef", "auth") is None


class TestEnrollmentGating:
    def test_disabled_without_token(self, monkeypatch):
        monkeypatch.delenv("KONTEXTO_ADMIN_ENROLL_TOKEN", raising=False)
        assert auth.enrollment_enabled() is False
        assert auth.enroll_token_valid("anything") is False

    def test_requires_matching_token(self, monkeypatch):
        monkeypatch.setenv("KONTEXTO_ADMIN_ENROLL_TOKEN", "s3cret-enroll")
        assert auth.enrollment_enabled() is True
        assert auth.enroll_token_valid("s3cret-enroll") is True
        assert auth.enroll_token_valid("wrong") is False
        assert auth.enroll_token_valid("") is False


class TestCredentialStorage:
    def test_replace_keeps_single(self, db_path):
        async def go():
            db = await get_db(db_path)
            try:
                assert await auth.get_credential(db) is None
                await auth.replace_credential(db, credential_id="cred-a", public_key="pk-a", sign_count=0)
                await auth.replace_credential(db, credential_id="cred-b", public_key="pk-b", sign_count=3)
                cur = await db.execute("SELECT COUNT(*) FROM admin_credentials")
                count = (await cur.fetchone())[0]
                stored = await auth.get_credential(db)
                await auth.update_sign_count(db, "cred-b", 9)
                updated = await auth.get_credential(db)
                return count, stored, updated
            finally:
                await db.close()
        count, stored, updated = run(go())
        assert count == 1
        assert stored["credential_id"] == "cred-b" and stored["sign_count"] == 3
        assert updated["sign_count"] == 9


class TestServerSecret:
    def test_returns_configured_secret(self, monkeypatch):
        monkeypatch.setenv("KONTEXTO_SERVER_SECRET", "abc123")
        assert server_secret() == b"abc123"

    def test_raises_when_unset_in_prod(self, monkeypatch):
        monkeypatch.delenv("KONTEXTO_SERVER_SECRET", raising=False)
        monkeypatch.delenv("KONTEXTO_DEV", raising=False)
        with pytest.raises(MissingServerSecretError):
            server_secret()

    def test_empty_treated_as_unset(self, monkeypatch):
        monkeypatch.setenv("KONTEXTO_SERVER_SECRET", "   ")
        monkeypatch.delenv("KONTEXTO_DEV", raising=False)
        with pytest.raises(MissingServerSecretError):
            server_secret()

    def test_dev_fallback_allowed(self, monkeypatch):
        monkeypatch.delenv("KONTEXTO_SERVER_SECRET", raising=False)
        monkeypatch.setenv("KONTEXTO_DEV", "1")
        assert server_secret() == b"kontexto-dev-secret"


class TestRecordGameStat:
    def test_increments_per_game_and_metric(self, db_path):
        async def go():
            await analytics.record_game_stat(db_path, "kontexto", 42, "guesses", now=JAN)
            await analytics.record_game_stat(db_path, "kontexto", 42, "guesses", now=JAN)
            await analytics.record_game_stat(db_path, "kontexto", 42, "solves", now=JAN)
            await analytics.record_game_stat(db_path, "kontexto", 7, "reveals", now=JAN)
            db = await get_db(db_path)
            try:
                cur = await db.execute(
                    "SELECT value FROM analytics_game_stats "
                    "WHERE mode='kontexto' AND game_number=42 AND metric='guesses'")
                g42 = (await cur.fetchone())[0]
                cur = await db.execute(
                    "SELECT value FROM analytics_game_stats "
                    "WHERE mode='kontexto' AND game_number=42 AND metric='solves'")
                s42 = (await cur.fetchone())[0]
                cur = await db.execute(
                    "SELECT value FROM analytics_game_stats "
                    "WHERE mode='kontexto' AND game_number=7 AND metric='reveals'")
                r7 = (await cur.fetchone())[0]
                return g42, s42, r7
            finally:
                await db.close()
        assert run(go()) == (2, 1, 1)


class TestRecordCompletion:
    UA = "Mozilla/5.0 Chrome/120"

    def _token(self, ip="1.2.3.4", now=JAN):
        fp = analytics.compute_fingerprint(ip, self.UA, now)
        return analytics.make_beacon_token(fp, now)

    def _complete(self, db, *, token, mode="kontexto", game_number=42,
                  outcome="solved", guesses=7, tips=2, duration_seconds=180,
                  best_rank=1, ip="1.2.3.4"):
        return analytics.record_completion(
            db, ip=ip, user_agent=self.UA, token=token, mode=mode,
            game_number=game_number, outcome=outcome, guesses=guesses,
            tips=tips, duration_seconds=duration_seconds, best_rank=best_rank,
            now=JAN)

    def test_invalid_token_rejected(self, db_path):
        async def go():
            db = await get_db(db_path)
            try:
                return await self._complete(db, token="garbage")
            finally:
                await db.close()
        ok, reason = run(go())
        assert not ok and reason == "invalid_token"

    def test_bot_rejected(self, db_path):
        async def go():
            db = await get_db(db_path)
            try:
                bot_ua = "python-requests/2.31"
                fp = analytics.compute_fingerprint("1.2.3.4", bot_ua, JAN)
                token = analytics.make_beacon_token(fp, JAN)
                return await analytics.record_completion(
                    db, ip="1.2.3.4", user_agent=bot_ua, token=token,
                    mode="kontexto", game_number=1, outcome="solved",
                    guesses=3, tips=0, duration_seconds=10, best_rank=1, now=JAN)
            finally:
                await db.close()
        ok, reason = run(go())
        assert not ok and reason == "bot"

    def test_valid_records_distribution_buckets(self, db_path):
        token = self._token()

        async def go():
            db = await get_db(db_path)
            try:
                ok, reason = await self._complete(db, token=token, guesses=7)
                cur = await db.execute(
                    "SELECT dimension, value FROM analytics_counters "
                    "WHERE metric='dist_guesses_kontexto'")
                guesses_bucket = await cur.fetchone()
                cur = await db.execute(
                    "SELECT value FROM analytics_counters WHERE metric='dist_time_kontexto'")
                time_row = await cur.fetchone()
                return (ok, reason), tuple(guesses_bucket), time_row[0]
            finally:
                await db.close()
        result, bucket, time_count = run(go())
        assert result == (True, "ok")
        assert bucket == ("6-10", 1)  # 7 guesses falls in the 6-10 bucket
        assert time_count == 1

    def test_duplicate_deduplicated(self, db_path):
        token = self._token()

        async def go():
            db = await get_db(db_path)
            try:
                first = await self._complete(db, token=token)
                second = await self._complete(db, token=token)
                cur = await db.execute(
                    "SELECT SUM(value) FROM analytics_counters WHERE metric='dist_guesses_kontexto'")
                total = (await cur.fetchone())[0]
                return first, second, total
            finally:
                await db.close()
        first, second, total = run(go())
        assert first == (True, "ok")
        assert second == (False, "duplicate")
        assert total == 1  # the duplicate added nothing

    def test_values_are_clamped(self, db_path):
        token = self._token()

        async def go():
            db = await get_db(db_path)
            try:
                # Absurd guess count must clamp into the top bucket, never crash.
                await self._complete(db, token=token, guesses=10_000_000)
                cur = await db.execute(
                    "SELECT dimension FROM analytics_counters WHERE metric='dist_guesses_kontexto'")
                return (await cur.fetchone())[0]
            finally:
                await db.close()
        assert run(go()) == "100+"

    def test_giveup_records_rank_bucket_not_time(self, db_path):
        token = self._token()

        async def go():
            db = await get_db(db_path)
            try:
                await self._complete(db, token=token, outcome="gaveup", best_rank=120)
                cur = await db.execute(
                    "SELECT dimension FROM analytics_counters WHERE metric='dist_giveup_rank'")
                rank_bucket = await cur.fetchone()
                cur = await db.execute(
                    "SELECT COUNT(*) FROM analytics_counters WHERE metric='dist_time_kontexto'")
                time_rows = (await cur.fetchone())[0]
                return rank_bucket[0], time_rows
            finally:
                await db.close()
        rank_bucket, time_rows = run(go())
        assert rank_bucket == "51-200" and time_rows == 0

    def test_does_not_touch_authoritative_counters(self, db_path):
        """A completion beacon must never inflate solves/reveals/guesses."""
        token = self._token()

        async def go():
            db = await get_db(db_path)
            try:
                await self._complete(db, token=token, outcome="solved")
                cur = await db.execute(
                    "SELECT COUNT(*) FROM analytics_counters "
                    "WHERE metric IN ('solves', 'reveals', 'guesses')")
                return (await cur.fetchone())[0]
            finally:
                await db.close()
        assert run(go()) == 0


class TestExtendedStats:
    UA = "Mozilla/5.0 Chrome/120"

    def _pageview(self, db, ip, page, now=JAN):
        fp = analytics.compute_fingerprint(ip, self.UA, now)
        token = analytics.make_beacon_token(fp, now)
        return analytics.record_pageview(
            db, ip=ip, user_agent=self.UA, referrer=None, page=page,
            token=token, now=now)

    def test_new_fields_present_and_shaped(self, db_path):
        async def go():
            db = await get_db(db_path)
            try:
                await self._pageview(db, "1.1.1.1", "/")
                return await analytics.get_stats(db, JAN)
            finally:
                await db.close()
        stats = run(go())
        for key in ("pageviews_timeline", "solves_timeline", "solve_rate_timeline",
                    "hints_by_difficulty", "duels_created", "distributions",
                    "game_difficulty", "activity_heatmap", "today_hourly",
                    "visitor_loyalty", "stickiness"):
            assert key in stats, f"missing stats key: {key}"
        assert len(stats["peak_hours"]) == 24
        assert len(stats["activity_heatmap"]) == 7
        assert all(len(row) == 24 for row in stats["activity_heatmap"])

    def test_peak_hours_and_heatmap_use_local_time(self, db_path):
        """A 12:00 UTC pageview must land in the Berlin local hour (13:00 CET)."""
        local = JAN.astimezone(ZoneInfo("Europe/Berlin"))

        async def go():
            db = await get_db(db_path)
            try:
                await self._pageview(db, "1.1.1.1", "/")
                return await analytics.get_stats(db, JAN)
            finally:
                await db.close()
        stats = run(go())
        assert stats["peak_hours"][str(local.hour)] == 1
        assert stats["activity_heatmap"][local.weekday()][local.hour] == 1

    def test_today_hourly_uses_local_time_and_trims(self, db_path):
        """today_hourly buckets today's pageviews by local hour, trimmed to now."""
        local = JAN.astimezone(ZoneInfo("Europe/Berlin"))

        async def go():
            db = await get_db(db_path)
            try:
                await self._pageview(db, "1.1.1.1", "/")
                return await analytics.get_stats(db, JAN)
            finally:
                await db.close()
        stats = run(go())
        assert len(stats["today_hourly"]) == local.hour + 1
        assert stats["today_hourly"][local.hour] == 1
        assert sum(stats["today_hourly"]) == 1

    def test_visitor_loyalty_new_vs_returning(self, db_path):
        """One fp on two days = returning; one fp on a single day = new."""
        feb16 = datetime(2026, 2, 16, 12, 0, 0, tzinfo=timezone.utc)
        feb17 = datetime(2026, 2, 17, 12, 0, 0, tzinfo=timezone.utc)

        async def go():
            db = await get_db(db_path)
            try:
                # Returning visitor: same IP/UA (same monthly fp) on two days.
                await self._pageview(db, "1.1.1.1", "/", now=feb16)
                await self._pageview(db, "1.1.1.1", "/", now=feb17)
                # New visitor: a different IP, one day only.
                await self._pageview(db, "2.2.2.2", "/", now=feb16)
                return await analytics.get_stats(db, feb17)
            finally:
                await db.close()
        loyalty = run(go())["visitor_loyalty"]
        assert loyalty == {"new": 1, "returning": 1}

    def test_hints_by_difficulty_grouped(self, db_path):
        async def go():
            await analytics.record_action(db_path, "hints", "easy", now=JAN)
            await analytics.record_action(db_path, "hints", "easy", now=JAN)
            await analytics.record_action(db_path, "hints", "hard", now=JAN)
            db = await get_db(db_path)
            try:
                return await analytics.get_stats(db, JAN)
            finally:
                await db.close()
        hbd = run(go())["hints_by_difficulty"]
        assert hbd.get("easy") == 2 and hbd.get("hard") == 1

    def test_infinite_mode_surfaces_in_breakdowns(self, db_path):
        """Endless-mode finishes appear in games_by_mode and the monthly mode trend."""
        async def go():
            await analytics.record_action(db_path, "solves", "infinite", now=JAN)
            await analytics.record_action(db_path, "solves", "infinite", now=JAN)
            await analytics.record_action(db_path, "reveals", "infinite", now=JAN)
            await analytics.record_action(db_path, "solves", "kontexto", now=JAN)
            db = await get_db(db_path)
            try:
                return await analytics.get_stats(db, JAN)
            finally:
                await db.close()
        stats = run(go())
        assert stats["games_by_mode"].get("infinite") == 3
        jan = next(m for m in stats["mode_monthly"] if m["month"] == "2026-01")
        assert jan["infinite"] == 3 and jan["kontexto"] == 1


def _hll_registers_from_keys(keys):
    """Build a {register: max-rank} dict by folding distinct keys (like the DB)."""
    regs = {}
    for k in keys:
        h = int.from_bytes(hashlib.blake2b(str(k).encode(), digest_size=8).digest(), "big")
        reg, rank = analytics._hll_register_rank(h)
        if rank > regs.get(reg, 0):
            regs[reg] = rank
    return regs


class TestHyperLogLog:
    def test_empty_is_zero(self):
        assert analytics._hll_estimate({}) == 0

    def test_register_rank_deterministic(self):
        h = 0x1234_5678_9ABC_DEF0
        assert analytics._hll_register_rank(h) == analytics._hll_register_rank(h)

    def test_stable_fingerprint_stable_and_distinct(self):
        a = analytics.hll_register_rank_for("1.2.3.4", "UA")
        b = analytics.hll_register_rank_for("1.2.3.4", "UA")
        c = analytics.hll_register_rank_for("9.9.9.9", "UA")
        assert a == b          # stable for the same visitor (no monthly rotation)
        assert a != c          # different visitor => (almost surely) different slot

    def test_small_cardinality_linear_counting_accurate(self):
        regs = _hll_registers_from_keys(range(300))
        est = analytics._hll_estimate(regs)
        assert abs(est - 300) / 300 < 0.05      # LinearCounting is near-exact here

    def test_large_cardinality_within_error(self):
        n = 60_000                              # > 2.5*m => exercises the raw estimate
        regs = _hll_registers_from_keys(range(n))
        est = analytics._hll_estimate(regs)
        assert abs(est - n) / n < 0.04

    def test_idempotent_refold(self):
        once = _hll_registers_from_keys(range(500))
        twice = _hll_registers_from_keys(list(range(500)) * 2)
        assert once == twice                    # re-adding known keys changes nothing
        assert analytics._hll_estimate(once) == analytics._hll_estimate(twice)


class TestOperatingSystem:
    @pytest.mark.parametrize("ua,expected", [
        ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36", "Windows"),
        ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1", "macOS"),
        ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1", "iOS"),
        ("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Safari/604.1", "iOS"),
        ("Mozilla/5.0 (Linux; Android 13; Pixel 7) Chrome/120 Mobile Safari/537.36", "Android"),
        ("Mozilla/5.0 (X11; Linux x86_64) Firefox/121.0", "Linux"),
        ("Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) Chrome/120 Safari/537.36", "ChromeOS"),
    ])
    def test_os_detected(self, ua, expected):
        assert analytics.classify_user_agent(ua)[3] == expected

    def test_bot_os_unknown(self):
        assert analytics.classify_user_agent("Googlebot/2.1")[3] == "unknown"


class TestSinceBeginningStats:
    UA = "Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537.36"

    def _pageview(self, db, ip, page, now=JAN):
        fp = analytics.compute_fingerprint(ip, self.UA, now)
        token = analytics.make_beacon_token(fp, now)
        return analytics.record_pageview(
            db, ip=ip, user_agent=self.UA, referrer=None, page=page,
            token=token, now=now)

    def test_all_time_fields_present_and_shaped(self, db_path):
        async def go():
            db = await get_db(db_path)
            try:
                await self._pageview(db, "1.1.1.1", "/")
                return await analytics.get_stats(db, JAN)
            finally:
                await db.close()
        stats = run(go())
        for key in ("all_time", "records", "active_users", "os", "monthly", "mode_monthly"):
            assert key in stats, f"missing stats key: {key}"
        at = stats["all_time"]
        assert set(at) == {"unique_visitors", "pageviews", "visitor_days",
                           "data_since", "unique_since"}
        assert at["unique_since"] == "2026-01-15"        # stamped on first fold
        assert stats["active_users"]["dau"] == stats["visitors"]["today"]

    def test_all_time_unique_counts_distinct_visitors(self, db_path):
        async def go():
            db = await get_db(db_path)
            try:
                for ip in ("1.1.1.1", "2.2.2.2", "3.3.3.3", "4.4.4.4", "5.5.5.5"):
                    await self._pageview(db, ip, "/")
                return await analytics.get_stats(db, JAN)
            finally:
                await db.close()
        assert run(go())["all_time"]["unique_visitors"] == 5

    def test_all_time_unique_idempotent_for_repeat_visitor(self, db_path):
        """Same visitor on multiple pages must count once (idempotent HLL fold)."""
        async def go():
            db = await get_db(db_path)
            try:
                await self._pageview(db, "1.1.1.1", "/")
                await self._pageview(db, "1.1.1.1", "/wordle")   # 2nd page, same visitor
                return await analytics.get_stats(db, JAN)
            finally:
                await db.close()
        assert run(go())["all_time"]["unique_visitors"] == 1

    def test_monthly_buckets_and_all_time_union(self, db_path):
        """Per-month HLL counts each month; the all-time sketch dedups across months."""
        async def go():
            db = await get_db(db_path)
            try:
                for ip in ("1.1.1.1", "2.2.2.2", "3.3.3.3"):       # JAN: a, b, c
                    await self._pageview(db, ip, "/", now=JAN)
                for ip in ("3.3.3.3", "4.4.4.4"):                  # FEB: c (repeat), d
                    await self._pageview(db, ip, "/", now=FEB)
                return await analytics.get_stats(db, FEB)
            finally:
                await db.close()
        stats = run(go())
        by_month = {m["month"]: m for m in stats["monthly"]}
        assert by_month["2026-01"]["unique_visitors"] == 3
        assert by_month["2026-02"]["unique_visitors"] == 2
        assert stats["all_time"]["unique_visitors"] == 4          # union {a,b,c,d}

    def test_all_time_unique_floored_by_exact_windows(self, db_path):
        """All-time uniques must never fall below an exact windowed count.

        Reproduces the post-deploy state: the all-time HLL sketch was introduced
        empty -- and cannot be backfilled, since the raw IP/UA needed for its
        stable token is deliberately never stored -- while raw events for existing
        visitors already power the exact 30-day count and the daily rollups.
        Anyone unique in a sub-window is unique all-time, so the all-time figure
        must be floored by those exact counts; otherwise the dashboard shows the
        impossible "Gesamt (0) < 30 Tage (N)".
        """
        async def go():
            db = await get_db(db_path)
            try:
                for ip in ("1.1.1.1", "2.2.2.2", "3.3.3.3", "4.4.4.4", "5.5.5.5"):
                    await self._pageview(db, ip, "/")
                await analytics.aggregate_daily(db, JAN)
                # Sketch introduced AFTER these visitors: their events were never folded.
                await db.execute("DELETE FROM analytics_hll")
                await db.commit()
                return await analytics.get_stats(db, JAN)
            finally:
                await db.close()
        stats = run(go())
        mau = stats["active_users"]["mau"]
        best_day = stats["records"]["best_visitors_day"]["value"]
        assert mau == 5 and best_day == 5            # exact counts still see all 5
        assert stats["all_time"]["unique_visitors"] >= mau
        assert stats["all_time"]["unique_visitors"] >= best_day

    def test_monthly_unique_floored_by_exact_daily(self, db_path):
        """Per-month uniques must never fall below that month's exact daily peak.

        Same root cause as the all-time floor, applied to the monthly series that
        drives the month-over-month card: an empty current-month sketch would
        otherwise report 0 for a month that demonstrably had visitors.
        """
        async def go():
            db = await get_db(db_path)
            try:
                for ip in ("1.1.1.1", "2.2.2.2", "3.3.3.3"):
                    await self._pageview(db, ip, "/")
                await analytics.aggregate_daily(db, JAN)
                await db.execute("DELETE FROM analytics_hll_monthly")
                await db.commit()
                return await analytics.get_stats(db, JAN)
            finally:
                await db.close()
        stats = run(go())
        by_month = {m["month"]: m for m in stats["monthly"]}
        assert by_month["2026-01"]["unique_visitors"] >= 3

    def test_records_and_exact_pageviews_from_rollups(self, db_path):
        async def go():
            db = await get_db(db_path)
            try:
                await self._pageview(db, "1.1.1.1", "/")
                await self._pageview(db, "2.2.2.2", "/")
                await self._pageview(db, "2.2.2.2", "/wordle")
                await analytics.aggregate_daily(db, JAN)
                return await analytics.get_stats(db, JAN)
            finally:
                await db.close()
        stats = run(go())
        assert stats["all_time"]["pageviews"] == 3                # exact, from rollups
        assert stats["all_time"]["data_since"] == "2026-01-15"
        assert stats["records"]["best_visitors_day"]["date"] == "2026-01-15"
        assert stats["records"]["best_visitors_day"]["value"] == 2

    def test_os_breakdown_counts_visitors(self, db_path):
        win = "Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537.36"
        mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1"

        async def pv(db, ip, ua):
            fp = analytics.compute_fingerprint(ip, ua, JAN)
            token = analytics.make_beacon_token(fp, JAN)
            return await analytics.record_pageview(
                db, ip=ip, user_agent=ua, referrer=None, page="/",
                token=token, now=JAN)

        async def go():
            db = await get_db(db_path)
            try:
                await pv(db, "1.1.1.1", win)
                await pv(db, "2.2.2.2", win)
                await pv(db, "3.3.3.3", mac)
                return await analytics.get_stats(db, JAN)
            finally:
                await db.close()
        os_break = run(go())["os"]
        assert os_break.get("Windows") == 2 and os_break.get("macOS") == 1
