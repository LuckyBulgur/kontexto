"""Twitch badge pictures: token handling, parsing, storage and resolution.

No request leaves the process: the HTTP layer is a fake that records what was
asked and answers from a script, so the token cache, the 401 retry and the
secret's absence from every log line can be asserted directly.
"""

import asyncio
import logging
import os
import tempfile

import pytest

from database import get_db, init_db

SECRET = "s3cr3t-value-never-logged"
TOKEN = "app-token-never-logged"


@pytest.fixture
def db():
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        path = os.path.join(tmpdir, "badges.db")
        asyncio.run(init_db(path))
        yield path


def _version(version, title, base="https://static-cdn.jtvnw.net/badges/v1/x"):
    return {
        "id": version, "title": title,
        "image_url_1x": f"{base}/1", "image_url_2x": f"{base}/2", "image_url_4x": f"{base}/3",
    }


GLOBAL = {"data": [
    {"set_id": "moderator", "versions": [_version("1", "Moderator")]},
    {"set_id": "subscriber", "versions": [_version("12", "1-Year Subscriber")]},
]}
CHANNEL = {"data": [
    {"set_id": "subscriber", "versions": [
        _version("12", "Channel Sub", base="https://static-cdn.jtvnw.net/badges/v1/chan"),
    ]},
]}


class FakeHttp:
    def __init__(self, answers):
        self.answers = list(answers)
        self.calls = []

    def __call__(self, method, url, headers, body=None):
        from twitch_badges import HelixError

        self.calls.append((method, url, headers, body))
        answer = self.answers.pop(0)
        if isinstance(answer, int):
            raise HelixError(answer, f"HTTP {answer}")
        return answer


def _client(http, clock=lambda: 0.0):
    from twitch_badges import Credentials, HelixClient

    return HelixClient(Credentials("client-id", SECRET), http=http, clock=clock)


def _token(expires_in=3600):
    return {"access_token": TOKEN, "expires_in": expires_in, "token_type": "bearer"}


class TestCredentials:
    def test_both_values_are_needed(self, monkeypatch):
        import twitch_badges

        monkeypatch.setenv(twitch_badges.CLIENT_ID_ENV, "id")
        monkeypatch.delenv(twitch_badges.CLIENT_SECRET_ENV, raising=False)
        assert twitch_badges.credentials() is None
        monkeypatch.setenv(twitch_badges.CLIENT_SECRET_ENV, "  ")
        assert twitch_badges.credentials() is None
        monkeypatch.setenv(twitch_badges.CLIENT_SECRET_ENV, "x")
        assert twitch_badges.credentials().client_id == "id"


class TestParse:
    def test_only_twitch_pictures_are_kept(self):
        from twitch_badges import parse_badge_sets

        payload = {"data": [
            {"set_id": "vip", "versions": [_version("1", "VIP")]},
            {"set_id": "evil", "versions": [_version("1", "Evil", base="https://evil.example")]},
            {"set_id": "broken", "versions": [{"id": "1"}]},
            "nonsense",
        ]}
        rows = parse_badge_sets(payload)
        assert [(r[0], r[1], r[2]) for r in rows] == [("vip", "1", "VIP")]
        assert parse_badge_sets({"data": "x"}) == []
        assert parse_badge_sets(None) == []


class TestHelixClient:
    def _run(self, coro):
        return asyncio.run(coro)

    def test_the_token_is_cached_until_it_nearly_expires(self):
        from twitch_badges import TOKEN_MARGIN_SECONDS

        now = [0.0]
        http = FakeHttp([_token(3600), GLOBAL, GLOBAL, _token(3600), GLOBAL])
        client = _client(http, clock=lambda: now[0])
        self._run(client.badges(None))
        self._run(client.badges(None))
        assert [c[0] for c in http.calls] == ["POST", "GET", "GET"]
        now[0] = 3600 - TOKEN_MARGIN_SECONDS + 1
        self._run(client.badges(None))
        assert [c[0] for c in http.calls][-2:] == ["POST", "GET"]

    def test_a_401_renews_the_token_once(self):
        http = FakeHttp([_token(), 401, _token(), CHANNEL])
        rows = self._run(_client(http).badges("123"))
        assert rows[0][2] == "Channel Sub"
        assert "broadcaster_id=123" in http.calls[-1][1]

    def test_a_second_401_gives_up(self):
        from twitch_badges import HelixError

        http = FakeHttp([_token(), 401, _token(), 401])
        with pytest.raises(HelixError):
            self._run(_client(http).badges(None))

    def test_the_request_carries_client_id_and_bearer(self):
        http = FakeHttp([_token(), GLOBAL])
        self._run(_client(http).badges(None))
        _, url, headers, _ = http.calls[1]
        assert url.endswith("/chat/badges/global")
        assert headers == {"Client-Id": "client-id", "Authorization": f"Bearer {TOKEN}"}


class TestCatalog:
    def _run(self, coro):
        return asyncio.run(coro)

    def test_fetches_store_and_resolve_channel_first(self, db):
        import twitch_badges

        async def run():
            http = FakeHttp([_token(), GLOBAL, CHANNEL])
            catalog = twitch_badges.BadgeCatalog(db, _client(http))
            await catalog.ensure()
            await catalog.ensure("123")
            # Fresh inside the window: no second fetch.
            await catalog.ensure()
            assert len(http.calls) == 3

            conn = await get_db(db)
            try:
                await twitch_badges.remember_channel(conn, "kontexto", "123")
                found = await twitch_badges.resolve(
                    conn, "kontexto", {("subscriber", "12"), ("moderator", "1"), ("vip", "1")}
                )
                plain = await twitch_badges.resolve(conn, "fremd", {("subscriber", "12")})
            finally:
                await conn.close()
            assert found["subscriber/12"]["title"] == "Channel Sub"
            assert found["moderator/1"]["title"] == "Moderator"
            assert "vip/1" not in found
            assert plain["subscriber/12"]["title"] == "1-Year Subscriber"

        self._run(run())

    def test_without_credentials_nothing_is_fetched(self, db):
        import twitch_badges

        async def run():
            catalog = twitch_badges.BadgeCatalog(db, None)
            assert catalog.enabled is False
            await catalog.ensure()

        self._run(run())

    def test_a_failure_waits_and_never_logs_the_secret(self, db, caplog):
        import twitch_badges

        async def run():
            now = [0.0]
            http = FakeHttp([500, 500])
            catalog = twitch_badges.BadgeCatalog(db, _client(http), clock=lambda: now[0])
            with caplog.at_level(logging.DEBUG):
                await catalog.ensure()
                await catalog.ensure()
            # The second call waits out the retry window instead of asking again.
            assert len(http.calls) == 1
            now[0] = twitch_badges.BadgeCatalog.RETRY_SECONDS + 1
            await catalog.ensure()
            assert len(http.calls) == 2

        self._run(run())
        assert SECRET not in caplog.text
        assert TOKEN not in caplog.text
        assert "could not be fetched" in caplog.text

    def test_remember_channel_writes_only_on_change(self, db):
        import twitch_badges

        async def run():
            conn = await get_db(db)
            try:
                await twitch_badges.remember_channel(conn, "kontexto", "1")
                await twitch_badges.remember_channel(conn, "kontexto", "1")
                await twitch_badges.remember_channel(conn, "kontexto", "2")
                cursor = await conn.execute("SELECT broadcaster_id FROM twitch_channel_ids")
                assert [r["broadcaster_id"] for r in await cursor.fetchall()] == ["2"]
            finally:
                await conn.close()

        self._run(run())
