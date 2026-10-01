"""Paid support and badges in live rooms.

Recorded IRC lines and provider frames go through the parsers, and the ingest
stores what they yield. No socket is opened. What is asserted is the contract
the host page relies on: every paid act is one row, a bomb is one row and not
eleven, a duplicate frame changes nothing, and the per-channel totals rise once.
"""

import asyncio
import json
import os
import tempfile

import pytest

from database import get_db, init_db


@pytest.fixture
def db():
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        path = os.path.join(tmpdir, "live.db")
        asyncio.run(init_db(path))
        yield path


def _irc(tags: dict[str, str], command: str, login: str = "mara", text: str = "") -> str:
    raw = ";".join(f"{k}={v}" for k, v in tags.items())
    tail = f" :{text}" if text else ""
    return f"@{raw} :{login}!{login}@{login}.tmi.twitch.tv {command} #kontexto{tail}"


class TestBadgeTag:
    def test_the_twitch_tag_is_read_in_order(self):
        from live_chat import ChatBadge, parse_badge_tag

        assert parse_badge_tag("broadcaster/1,subscriber/3012,vip/1") == (
            ChatBadge("broadcaster", "1"), ChatBadge("subscriber", "3012"), ChatBadge("vip", "1"),
        )

    def test_garbage_and_floods_are_cut(self):
        from live_chat import MAX_BADGES, parse_badge_tag

        assert parse_badge_tag("") == ()
        assert parse_badge_tag(None) == ()
        assert parse_badge_tag("moderator,/1,MOD/1,a b/1,ok/1") == (
            parse_badge_tag("ok/1")
        )
        many = ",".join(f"set{i}/1" for i in range(20))
        assert len(parse_badge_tag(many)) == MAX_BADGES

    def test_encode_and_decode_round_trip(self):
        from live_chat import encode_badges, parse_badge_tag

        badges = parse_badge_tag("moderator/1,subscriber/12")
        assert encode_badges(badges) == "moderator/1,subscriber/12"
        assert parse_badge_tag(encode_badges(badges)) == badges
        assert encode_badges(()) is None

    def test_a_chat_line_carries_its_badges(self):
        from live_chat import parse_irc_line

        line = _irc({"badges": "moderator/1", "user-id": "7", "display-name": "Mara"},
                    "PRIVMSG", text="apfel")
        message = parse_irc_line(line)
        assert message.text == "apfel"
        assert [b.set_id for b in message.badges] == ["moderator"]


class TestTwitchEvents:
    def _parse(self, line, folder=None):
        from live_chat import GiftBombFolder, parse_twitch_event

        return parse_twitch_event(line, folder or GiftBombFolder())

    def test_a_cheer_is_an_event_and_still_a_guess(self):
        from live_chat import parse_irc_line

        line = _irc({"bits": "250", "id": "c1", "user-id": "7", "display-name": "Mara"},
                    "PRIVMSG", text="Cheer200 Kappa50 apfel")
        event = self._parse(line)
        assert (event.kind, event.amount, event.actor_name) == ("cheer", 250, "Mara")
        assert parse_irc_line(line).text == "apfel"

    def test_a_plain_line_is_no_event(self):
        line = _irc({"id": "x", "user-id": "7"}, "PRIVMSG", text="apfel")
        assert self._parse(line) is None

    def test_sub_and_resub(self):
        sub = self._parse(_irc({
            "msg-id": "sub", "id": "s1", "user-id": "7", "display-name": "Mara",
            "msg-param-sub-plan": "Prime", "msg-param-cumulative-months": "1",
        }, "USERNOTICE"))
        assert (sub.kind, sub.tier, sub.months) == ("sub", "prime", 1)

        resub = self._parse(_irc({
            "msg-id": "resub", "id": "s2", "user-id": "7", "display-name": "Mara",
            "msg-param-sub-plan": "2000", "msg-param-cumulative-months": "14",
        }, "USERNOTICE", text="Hallo Chat"))
        assert (resub.kind, resub.tier, resub.months) == ("resub", "2000", 14)
        # The resub message is a viewer's free text and is never carried.
        assert "Hallo" not in repr(resub)

    def test_a_bomb_is_one_event_and_its_gifts_fold_into_it(self):
        from live_chat import GiftBombFolder

        folder = GiftBombFolder()
        bomb = self._parse(_irc({
            "msg-id": "submysterygift", "id": "b1", "user-id": "7", "display-name": "Mara",
            "msg-param-mass-gift-count": "3", "msg-param-community-gift-id": "g9",
            "msg-param-sub-plan": "1000",
        }, "USERNOTICE"), folder)
        assert (bomb.kind, bomb.amount) == ("gift_bomb", 3)
        singles = [
            self._parse(_irc({
                "msg-id": "subgift", "id": f"g{i}", "user-id": "7", "display-name": "Mara",
                "msg-param-community-gift-id": "g9", "msg-param-sub-plan": "1000",
            }, "USERNOTICE"), folder)
            for i in range(3)
        ]
        assert singles == [None, None, None]
        # The next gift of the same person is an ordinary gift again.
        later = self._parse(_irc({
            "msg-id": "subgift", "id": "g10", "user-id": "7", "display-name": "Mara",
        }, "USERNOTICE"), folder)
        assert later.kind == "gift_sub"

    def test_a_bomb_folds_without_the_shared_id_too(self):
        from live_chat import GiftBombFolder

        folder = GiftBombFolder()
        self._parse(_irc({
            "msg-id": "submysterygift", "id": "b1", "user-id": "7",
            "msg-param-mass-gift-count": "2",
        }, "USERNOTICE"), folder)
        for i in range(2):
            assert self._parse(_irc(
                {"msg-id": "subgift", "id": f"g{i}", "user-id": "7"}, "USERNOTICE"
            ), folder) is None

    def test_a_folded_bomb_expires(self):
        from live_chat import GiftBombFolder

        now = [0.0]
        folder = GiftBombFolder(clock=lambda: now[0])
        folder.bomb("7", "g9", 5)
        now[0] = GiftBombFolder.EXPIRE_SECONDS + 1
        assert folder.is_part_of_bomb("7", "g9") is False

    def test_anonymous_gifts_have_no_identity(self):
        event = self._parse(_irc({
            "msg-id": "anonsubgift", "id": "a1", "user-id": "274598607",
            "display-name": "AnAnonymousGifter",
        }, "USERNOTICE", login="ananonymousgifter"))
        assert (event.actor_external_id, event.actor_name) == ("anonymous", "Anonym")

    def test_upgrades_count(self):
        event = self._parse(_irc({
            "msg-id": "giftpaidupgrade", "id": "u1", "user-id": "7", "display-name": "Mara",
        }, "USERNOTICE"))
        assert event.kind == "upgrade"

    def test_other_notices_are_ignored(self):
        for msg_id in ("raid", "ritual", "announcement", "bitsbadgetier"):
            assert self._parse(_irc({"msg-id": msg_id, "id": "r1"}, "USERNOTICE")) is None

    def test_an_event_without_an_id_is_dropped(self):
        line = _irc({"bits": "100", "user-id": "7", "display-name": "Mara"}, "PRIVMSG",
                    text="Cheer100")
        assert self._parse(line) is None

    def test_absurd_amounts_are_dropped(self):
        line = _irc({"bits": "999999999999", "id": "c1", "user-id": "7"}, "PRIVMSG",
                    text="Cheer1")
        assert self._parse(line) is None

    def test_roomstate_names_the_broadcaster(self):
        from live_chat import parse_roomstate

        assert parse_roomstate("@emote-only=0;room-id=12345 :tmi.twitch.tv ROOMSTATE #k") == "12345"
        assert parse_roomstate("@room-id=abc :tmi.twitch.tv ROOMSTATE #k") is None
        assert parse_roomstate(":tmi.twitch.tv PRIVMSG #k :hi") is None


def _frame(*events):
    return json.dumps({"messages": [{"type": t, "data": d} for t, d in events]})


def _tt_user(user_id="11", unique="mara.tt", nickname="Mara", **extra):
    return {"userId": user_id, "uniqueId": unique, "nickname": nickname, **extra}


class TestTikTokEvents:
    def _parse(self, *events):
        from tiktok_chat import parse_euler_frame_full

        return parse_euler_frame_full(_frame(*events))

    def test_a_streak_counts_once_when_it_ends(self):
        running = {
            "common": {"msgId": "100"}, "user": _tt_user(), "repeatCount": 3, "repeatEnd": 0,
            "giftDetails": {"giftType": 1, "diamondCount": 1, "giftName": "Rose"},
        }
        ended = {**running, "common": {"msgId": "101"}, "repeatCount": 5, "repeatEnd": 1}
        _, events = self._parse(("WebcastGiftMessage", running))
        assert events == []
        _, [event] = self._parse(("WebcastGiftMessage", ended))
        assert (event.kind, event.amount, event.gift_count, event.gift_name) == (
            "tiktok_gift", 5, 5, "Rose",
        )

    def test_a_non_streak_gift_counts_at_once(self):
        gift = {
            "common": {"msgId": "200"}, "user": _tt_user(), "repeatCount": 1, "repeatEnd": 0,
            "gift": {"type": 2, "diamondCount": 500, "name": "Löwe",
                     "image": {"urlList": ["https://p16-webcast.tiktokcdn.com/lion.webp"]}},
        }
        _, [event] = self._parse(("WebcastGiftMessage", gift))
        assert (event.amount, event.gift_name) == (500, "Löwe")
        assert event.gift_image == "https://p16-webcast.tiktokcdn.com/lion.webp"

    def test_a_foreign_gift_picture_is_dropped(self):
        gift = {
            "common": {"msgId": "201"}, "user": _tt_user(), "repeatCount": 1,
            "giftDetails": {"giftType": 2, "diamondCount": 5,
                            "giftImage": {"url": ["https://evil.example/x.png",
                                                  "http://p16.tiktokcdn.com/x.png"]}},
        }
        _, [event] = self._parse(("WebcastGiftMessage", gift))
        assert event.gift_image is None

    def test_a_subscription(self):
        sub = {"common": {"msgId": "300"}, "user": _tt_user(), "subMonth": "3",
               "messageType": "SUB_SUCCESS"}
        reminder = {**sub, "common": {"msgId": "301"}, "messageType": 1}
        _, events = self._parse(("WebcastSubNotifyMessage", sub),
                                ("WebcastSubNotifyMessage", reminder))
        assert [(e.kind, e.months) for e in events] == [("tiktok_sub", 3)]

    def test_a_treasure_chest(self):
        chest = {"envelopeInfo": {"envelopeId": "e1", "sendUserId": "11",
                                  "sendUserName": "Mara", "diamondCount": 100}}
        _, [event] = self._parse(("WebcastEnvelopeMessage", chest))
        assert (event.kind, event.amount, event.event_id) == ("tiktok_chest", 100, "chest-e1")

    def test_chat_roles_become_badges(self):
        chat = {
            "comment": "apfel",
            "user": _tt_user(fansClub={"data": {"level": 7}}),
            "userIdentity": {"isModeratorOfAnchor": True, "isSubscriberOfAnchor": True,
                             "isGiftGiverOfAnchor": True},
        }
        [message], _ = self._parse(("WebcastChatMessage", chat))
        assert [(b.set_id, b.version) for b in message.badges] == [
            ("tt-moderator", "1"), ("tt-subscriber", "1"), ("tt-fan", "7"), ("tt-supporter", "1"),
        ]

    def test_unknown_shapes_are_ignored(self):
        messages, events = self._parse(
            ("WebcastGiftMessage", {"user": "nope"}),
            ("WebcastSubNotifyMessage", {}),
            ("WebcastLikeMessage", {"user": _tt_user()}),
        )
        assert messages == [] and events == []


class TestStoredEvents:
    def _run(self, coro):
        return asyncio.run(coro)

    def _ingest(self, db):
        from live_ingest import LiveChatIngest

        return LiveChatIngest(db, lambda game_number, word: {"word": word, "rank": 10})

    async def _ready(self, db, channels=(("twitch", "kontexto"),)):
        from koop import create_koop
        from live_chat import create_live_room

        conn = await get_db(db)
        try:
            room = await create_koop(conn, game_number=1, nickname="Host", tips_allowed=True)
            await create_live_room(conn, room["koop_id"], room["player_token"], False,
                                   list(channels))
        finally:
            await conn.close()
        ingest = self._ingest(db)
        await ingest.reconcile()
        ingest.shutdown()
        return room["koop_id"], ingest

    def _cheer(self, event_id="c1", amount=100, name="Mara"):
        from live_chat import make_event

        return make_event(platform="twitch", event_id=event_id, kind="cheer",
                          actor_external_id="7", actor_name=name, amount=amount)

    async def _totals(self, db):
        from live_chat import stream_stats

        conn = await get_db(db)
        try:
            return {(r["platform"], r["channel"]): r for r in await stream_stats(conn)}
        finally:
            await conn.close()

    def test_an_event_is_stored_once_and_counted_once(self, db):
        from live_chat import events_after

        async def run():
            koop_id, ingest = await self._ready(db)
            assert await ingest.handle_event(koop_id, "twitch", self._cheer()) is True
            assert await ingest.handle_event(koop_id, "twitch", self._cheer()) is False
            conn = await get_db(db)
            try:
                events = await events_after(conn, koop_id, 0)
            finally:
                await conn.close()
            assert [(e["kind"], e["amount"], e["actor"]) for e in events] == [
                ("cheer", 100, "Mara"),
            ]
            assert (await self._totals(db))[("twitch", "kontexto")]["bits"] == 100

        self._run(run())

    def test_the_actor_passes_the_nickname_rule(self, db):
        from live_chat import events_after

        async def run():
            koop_id, ingest = await self._ready(db)
            await ingest.handle_event(koop_id, "twitch", self._cheer(name="Hurensohn"))
            conn = await get_db(db)
            try:
                [event] = await events_after(conn, koop_id, 0)
            finally:
                await conn.close()
            assert event["actor"] != "Hurensohn"
            assert "Hurensohn" not in event["actor"]

        self._run(run())

    def test_events_after_pages_and_caps(self, db):
        from live_chat import EVENTS_PER_POLL, events_after

        async def run():
            koop_id, ingest = await self._ready(db)
            for i in range(EVENTS_PER_POLL + 5):
                await ingest.handle_event(koop_id, "twitch", self._cheer(event_id=f"c{i}"))
            conn = await get_db(db)
            try:
                first = await events_after(conn, koop_id, 0)
                assert len(first) == EVENTS_PER_POLL
                # A fresh page gets the newest, oldest first.
                assert first[-1]["id"] > first[0]["id"]
                assert await events_after(conn, koop_id, first[-1]["id"]) == []
            finally:
                await conn.close()

        self._run(run())

    def test_a_chat_the_room_does_not_read_stores_nothing(self, db):
        async def run():
            koop_id, ingest = await self._ready(db)
            assert await ingest.handle_event(koop_id, "tiktok", self._cheer()) is False
            assert await ingest.handle_event("fehlt", "twitch", self._cheer()) is False

        self._run(run())

    def test_events_go_with_the_binding(self, db):
        from live_chat import end_live_room

        async def run():
            koop_id, ingest = await self._ready(db)
            await ingest.handle_event(koop_id, "twitch", self._cheer())
            conn = await get_db(db)
            try:
                await end_live_room(conn, koop_id)
                cursor = await conn.execute("SELECT COUNT(*) AS n FROM live_events")
                assert (await cursor.fetchone())["n"] == 0
            finally:
                await conn.close()

        self._run(run())

    def test_old_events_are_pruned(self, db):
        from live_chat import prune_events

        async def run():
            koop_id, ingest = await self._ready(db)
            await ingest.handle_event(koop_id, "twitch", self._cheer())
            conn = await get_db(db)
            try:
                await conn.execute(
                    "UPDATE live_events SET created_at = datetime('now', '-2 days')"
                )
                await conn.commit()
                assert await prune_events(conn) == 1
                assert await prune_events(conn) == 0
            finally:
                await conn.close()

        self._run(run())

    def test_every_kind_raises_its_total(self, db):
        from live_chat import make_event

        async def run():
            koop_id, ingest = await self._ready(db, (("twitch", "kontexto"), ("tiktok", "kontexto.de")))
            for i, (platform, kind, amount) in enumerate((
                ("twitch", "sub", 1), ("twitch", "resub", 1), ("twitch", "gift_bomb", 5),
                ("twitch", "gift_sub", 1), ("tiktok", "tiktok_gift", 300),
                ("tiktok", "tiktok_sub", 1), ("tiktok", "tiktok_chest", 50),
            )):
                event = make_event(platform=platform, event_id=f"e{i}", kind=kind,
                                   actor_external_id="7", actor_name="Mara", amount=amount)
                assert await ingest.handle_event(koop_id, platform, event)
            totals = await self._totals(db)
            twitch, tiktok = totals[("twitch", "kontexto")], totals[("tiktok", "kontexto.de")]
            assert (twitch["subs"], twitch["gift_subs"]) == (2, 6)
            assert (tiktok["tiktok_diamonds"], tiktok["subs"]) == (350, 1)

        self._run(run())

    def test_a_guess_keeps_its_badges(self, db):
        from koop import get_koop_guesses
        from live_chat import ChatMessage, parse_badge_tag, viewer_boards

        async def run():
            koop_id, ingest = await self._ready(db)
            await ingest.handle_message(koop_id, "twitch", ChatMessage(
                external_id="7", display_name="Mara", text="apfel",
                badges=parse_badge_tag("vip/1"),
            ))
            conn = await get_db(db)
            try:
                [guess] = await get_koop_guesses(conn, koop_id)
                boards = await viewer_boards(conn, koop_id)
            finally:
                await conn.close()
            assert guess["source"] == "twitch"
            assert guess["badges"] == [{"set_id": "vip", "version": "1"}]
            assert boards["busy"][0]["badges"] == "vip/1"
            assert boards["sharp"][0]["near_hits"] == 1

        self._run(run())

