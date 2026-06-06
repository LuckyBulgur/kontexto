"""Tests for server-side analytics & admin auth."""

import asyncio
import os
import tempfile
from datetime import datetime, timezone

import aiosqlite
import pytest

os.environ.setdefault("KONTEXTO_SERVER_SECRET", "test-secret")

import analytics
import auth
from database import init_db, get_db
from server_secret import MissingServerSecretError, server_secret


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


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
        ua_class, device, browser = analytics.classify_user_agent(ua)
        assert ua_class == "human" and device == "desktop" and browser == "Chrome"

    def test_mobile_detected(self):
        ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148 Safari/604.1"
        ua_class, device, _ = analytics.classify_user_agent(ua)
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
