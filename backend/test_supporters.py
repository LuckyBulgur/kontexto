"""Ko-fi supporters: the webhook, the three moderation tiers, the operator's review
and what the rails show."""

import asyncio
import json
import os
import tempfile
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import pytest

import auth
import supporters
from database import get_db, init_db
from test_live_api import client, game_data_dir  # noqa: F401  (fixtures)

TOKEN = "kofi-test-token"
NOW = datetime(2026, 10, 3, 12, 0, 0, tzinfo=timezone.utc)


def run(coro):
    return asyncio.run(coro)


def payload(**overrides):
    data = {
        "verification_token": TOKEN,
        "message_id": "m-1",
        "timestamp": "2026-10-03T12:00:00Z",
        "type": "Donation",
        "is_public": True,
        "from_name": "Lena",
        "message": "Tolles Spiel",
        "amount": "3.00",
        "email": "lena@example.org",
        "currency": "EUR",
        "kofi_transaction_id": "tx-1",
    }
    data.update(overrides)
    return data


def form(data) -> bytes:
    return urlencode({"data": json.dumps(data)}).encode()


@pytest.fixture
def db_path():
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        path = os.path.join(tmpdir, "duels.db")
        run(init_db(path))
        yield path


async def _with_db(path, fn):
    db = await get_db(path)
    try:
        return await fn(db)
    finally:
        await db.close()


class TestClassifyName:
    @pytest.mark.parametrize("name", ["Lena", "Max M.", "Anna Lena", "Jürgen", "Anna-Lena", "Björn K"])
    def test_known_names_are_approved(self, name):
        assert supporters.classify_name(name) == (name, "approved", None)

    def test_whitespace_is_collapsed(self):
        assert supporters.classify_name("  Lena   Maier ")[0] == "Lena Maier"

    @pytest.mark.parametrize("name", [
        None, 42, "", "   ", "x" * 33, "Someone", "anonymous",
        "lena@example.org", "www.spam.example", "https://example.org", "kauf.de", "a/b",
        "Hurensohn", "arsch1", "Hitler", "H1tl3r", "Lena\u0007", "Lena​",
        "f.i.c.k.e.r",
    ])
    def test_unfit_names_are_refused(self, name):
        assert supporters.classify_name(name) is None

    def test_hint_blocklist_words_are_refused(self):
        blocked = sorted(supporters._hint_blocklist())
        assert blocked, "hint blocklist is empty"
        assert supporters.classify_name(f"Lena {blocked[0]}") is None

    @pytest.mark.parametrize("name, reason", [
        ("xXGamerXx", supporters.REASON_UNKNOWN_WORD),
        ("Kaffeeliebhaber", supporters.REASON_UNKNOWN_WORD),
        ("K.", supporters.REASON_UNKNOWN_WORD),
        ("Lena2010", supporters.REASON_DIGITS),
        ("Lena :)", supporters.REASON_SYMBOLS),
        ("Lena_M", supporters.REASON_SYMBOLS),
        ("Лена", supporters.REASON_SCRIPT),
        ("LENA", supporters.REASON_SHOUTING),
        ("Anna Lena Maria Sophie", supporters.REASON_TOO_MANY_WORDS),
    ])
    def test_everything_else_waits_for_the_operator(self, name, reason):
        assert supporters.classify_name(name) == (name, "pending", reason)


class TestParseWebhook:
    def test_valid_payload(self):
        assert supporters.parse_webhook(form(payload()), TOKEN)["from_name"] == "Lena"

    def test_wrong_token(self):
        with pytest.raises(supporters.WebhookRejected) as exc:
            supporters.parse_webhook(form(payload(verification_token="nope")), TOKEN)
        assert exc.value.status == 401

    def test_missing_token(self):
        data = payload()
        del data["verification_token"]
        with pytest.raises(supporters.WebhookRejected) as exc:
            supporters.parse_webhook(form(data), TOKEN)
        assert exc.value.status == 401

    @pytest.mark.parametrize("body", [b"", b"other=1", b"data=not-json", b"data=%5B1%5D"])
    def test_malformed(self, body):
        with pytest.raises(supporters.WebhookRejected) as exc:
            supporters.parse_webhook(body, TOKEN)
        assert exc.value.status == 400

    def test_too_large(self):
        with pytest.raises(supporters.WebhookRejected) as exc:
            supporters.parse_webhook(b"data=" + b"x" * supporters.MAX_BODY_BYTES, TOKEN)
        assert exc.value.status == 413


class TestRecordAndReview:
    def test_known_name_is_public_at_once_and_stored_once(self, db_path):
        async def go(db):
            first = await supporters.record_payment(db, payload(), NOW)
            retry = await supporters.record_payment(db, payload(), NOW)
            names = await supporters.recent_names(db, NOW)
            cur = await db.execute("SELECT * FROM supporters")
            return first, retry, names, [tuple(r) for r in await cur.fetchall()]

        first, retry, names, rows = run(_with_db(db_path, go))
        assert (first, retry) == ("stored", "duplicate")
        assert names == ["Lena"]
        # Only the name, the transaction id, the time and the review state.
        assert rows == [("tx-1", "Lena", "2026-10-03T12:00:00Z", "approved", None)]

    def test_suspicious_name_waits_and_is_not_public(self, db_path):
        async def go(db):
            outcome = await supporters.record_payment(db, payload(from_name="xXGamerXx"), NOW)
            return outcome, await supporters.recent_names(db, NOW), await supporters.review_queue(db, NOW)

        outcome, names, queue = run(_with_db(db_path, go))
        assert outcome == "pending"
        assert names == []
        assert [(r["name"], r["reason"]) for r in queue["pending"]] == [("xXGamerXx", "unknown_word")]

    def test_operator_approves_and_takes_down(self, db_path):
        async def go(db):
            await supporters.record_payment(db, payload(from_name="xXGamerXx"), NOW)
            approved = await supporters.review(db, "tx-1", True)
            again = await supporters.review(db, "tx-1", True)
            shown = await supporters.recent_names(db, NOW)
            taken_down = await supporters.review(db, "tx-1", False)
            after = await supporters.recent_names(db, NOW)
            # Ko-fi retrying the same payment cannot bring a rejected name back.
            retry = await supporters.record_payment(db, payload(from_name="xXGamerXx"), NOW)
            cur = await db.execute("SELECT name, status FROM supporters")
            return approved, again, shown, taken_down, after, retry, [tuple(r) for r in await cur.fetchall()]

        approved, again, shown, taken_down, after, retry, rows = run(_with_db(db_path, go))
        assert (approved, again) == (True, False)
        assert shown == ["xXGamerXx"]
        assert taken_down is True
        assert after == []
        assert retry == "duplicate"
        assert rows == [("", "rejected")]

    def test_unknown_id_is_not_reviewable(self, db_path):
        assert run(_with_db(db_path, lambda db: supporters.review(db, "nope", True))) is False

    def test_private_supporter_leaves_no_row(self, db_path):
        async def go(db):
            outcome = await supporters.record_payment(db, payload(is_public=False), NOW)
            cur = await db.execute("SELECT COUNT(*) FROM supporters")
            return outcome, (await cur.fetchone())[0]

        assert run(_with_db(db_path, go)) == ("private", 0)

    def test_refused_name_leaves_no_row(self, db_path):
        async def go(db):
            outcome = await supporters.record_payment(db, payload(from_name="Hurensohn"), NOW)
            cur = await db.execute("SELECT COUNT(*) FROM supporters")
            return outcome, (await cur.fetchone())[0]

        assert run(_with_db(db_path, go)) == ("name_refused", 0)

    def test_newest_first_each_name_once_and_thirty_days_only(self, db_path):
        async def go(db):
            await supporters.record_payment(db, payload(kofi_transaction_id="old", from_name="Paul"),
                                            NOW - timedelta(days=31))
            await supporters.record_payment(db, payload(kofi_transaction_id="a", from_name="Lena"),
                                            NOW - timedelta(days=5))
            await supporters.record_payment(db, payload(kofi_transaction_id="b", from_name="Max"),
                                            NOW - timedelta(days=2))
            await supporters.record_payment(db, payload(kofi_transaction_id="c", from_name="lena"),
                                            NOW - timedelta(days=1))
            shown = await supporters.recent_names(db, NOW)
            removed = await supporters.prune(db, NOW)
            cur = await db.execute("SELECT COUNT(*) FROM supporters")
            return shown, removed, (await cur.fetchone())[0]

        shown, removed, left = run(_with_db(db_path, go))
        assert [n.casefold() for n in shown] == ["lena", "max"]
        assert removed == 1
        assert left == 3


class TestEndpoints:
    HEADERS = {"Content-Type": "application/x-www-form-urlencoded"}

    def test_webhook_is_off_without_a_token(self, client, monkeypatch):
        monkeypatch.delenv(supporters.TOKEN_ENV, raising=False)
        response = client.post("/api/kofi/webhook", content=form(payload()), headers=self.HEADERS)
        assert response.status_code == 404

    def test_webhook_to_rails(self, client, monkeypatch):
        monkeypatch.setenv(supporters.TOKEN_ENV, TOKEN)

        assert client.get("/api/supporters").json() == {"names": []}

        bad = client.post("/api/kofi/webhook", content=form(payload(verification_token="x")),
                          headers=self.HEADERS)
        assert bad.status_code == 401

        for _ in range(2):  # Ko-fi retries; the second call must change nothing
            ok = client.post("/api/kofi/webhook", content=form(payload()), headers=self.HEADERS)
            assert ok.status_code == 200 and ok.json() == {"ok": True}
        private = client.post(
            "/api/kofi/webhook",
            content=form(payload(kofi_transaction_id="tx-2", from_name="Heimlich", is_public=False)),
            headers=self.HEADERS,
        )
        assert private.status_code == 200

        shown = client.get("/api/supporters")
        assert shown.json() == {"names": ["Lena"]}
        assert "max-age=300" in shown.headers["cache-control"]

    def test_operator_review_over_the_api(self, client, monkeypatch):
        monkeypatch.setenv(supporters.TOKEN_ENV, TOKEN)
        client.post("/api/kofi/webhook",
                    content=form(payload(kofi_transaction_id="tx-9", from_name="Zocker99")),
                    headers=self.HEADERS)

        assert client.get("/api/admin/supporters").status_code == 401
        assert client.post("/api/admin/supporters/tx-9/review", json={"approve": True}).status_code == 401

        admin = {"Authorization": f"Bearer {auth.issue_session_token()}"}
        queue = client.get("/api/admin/supporters", headers=admin).json()
        assert [(r["id"], r["name"], r["reason"]) for r in queue["pending"]] == [("tx-9", "Zocker99", "digits")]
        assert client.get("/api/supporters").json() == {"names": []}

        assert client.post("/api/admin/supporters/tx-9/review", json={"approve": True},
                           headers=admin).status_code == 200
        assert client.post("/api/admin/supporters/tx-9/review", json={"approve": True},
                           headers=admin).status_code == 409
        assert client.post("/api/admin/supporters/tx-9/review", json={"approve": True, "x": 1},
                           headers=admin).status_code == 422
        # The public list is cached for five minutes by browsers, not by the server.
        assert client.get("/api/supporters").json() == {"names": ["Zocker99"]}
