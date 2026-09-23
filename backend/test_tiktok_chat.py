"""Tests for the TikTok reader.

No socket is opened. The frame below has the shape of one recorded from a real
TikTok LIVE room through the provider on 2026-09-23, reduced to the fields the
reader touches plus a few it must ignore, with every id and name replaced.
"""

import asyncio
import json
import logging

import pytest
from websockets.exceptions import ConnectionClosed
from websockets.frames import Close

import tiktok_chat
from tiktok_chat import (
    ConnectBudget,
    TikTokChatReader,
    WAITING_TEXT,
    classify_close,
    parse_euler_frame,
)


def _chat(comment, user_id="7485681802586752017", unique_id="mara.k", nickname="Mara"):
    return {
        "type": "WebcastChatMessage",
        "data": {
            "comment": comment,
            "common": {"method": "WebcastChatMessage"},
            "contentLanguage": "de",
            "emotes": [],
            "user": {
                "userId": user_id,
                "uniqueId": unique_id,
                "nickname": nickname,
                "idStr": user_id,
                "followInfo": {"followerCount": 12},
                "badges": [],
            },
            "userIdentity": {"isAnchor": False},
        },
    }


def _frame(*events):
    return json.dumps({"timestamp": 1790000000000, "messages": list(events)})


RECORDED_OPENING = _frame(
    {"type": "workerInfo", "data": {"agentId": "a1"}},
    {"type": "roomInfo", "data": {"id": "7550000000000000000", "title": "Stream"}},
    {"type": "tiktok.connect", "data": {"agentId": "a1"}},
    {"type": "WebcastMemberMessage", "data": {"user": {"userId": "1", "nickname": "X"}}},
    {"type": "WebcastLikeMessage", "data": {"likeCount": 5}},
    _chat("Apfel"),
)


class TestFrames:
    def test_only_chat_lines_are_taken(self):
        messages = parse_euler_frame(RECORDED_OPENING)
        assert [m.text for m in messages] == ["Apfel"]
        assert messages[0].display_name == "Mara"
        # Prefixed, so a TikTok id can never collide with a Twitch id in the
        # per-room cooldown or the leaderboard.
        assert messages[0].external_id == "tt:7485681802586752017"

    def test_bytes_and_a_single_unbundled_event_are_read(self):
        assert [m.text for m in parse_euler_frame(json.dumps(_chat("birne")).encode())] == ["birne"]

    @pytest.mark.parametrize("raw", [
        "", "nicht json", "[]", "42", '{"messages": "kaputt"}',
        _frame({"type": "WebcastChatMessage"}),
        _frame({"type": "WebcastChatMessage", "data": {"comment": "x"}}),
        _frame({"type": "WebcastChatMessage", "data": {"comment": 5, "user": {"userId": "1"}}}),
        _frame({"type": "WebcastChatMessage", "data": {"comment": "x", "user": {}}}),
    ])
    def test_a_broken_frame_is_dropped_without_raising(self, raw):
        assert parse_euler_frame(raw) == []

    def test_the_handle_stands_in_for_a_missing_id(self):
        [message] = parse_euler_frame(_frame(_chat("apfel", user_id="", unique_id="mara.k")))
        assert message.external_id == "tt:mara.k"

    def test_an_overlong_nickname_falls_back_to_the_handle(self):
        [message] = parse_euler_frame(_frame(_chat("apfel", nickname="N" * 40, unique_id="mara.k")))
        assert message.display_name == "mara.k"

    def test_an_overlong_nickname_and_handle_are_cut_to_length(self):
        [message] = parse_euler_frame(
            _frame(_chat("apfel", nickname="N" * 40, unique_id="h" * 24))
        )
        assert message.display_name == "N" * 20


class TestChannel:
    @pytest.mark.parametrize("raw,expected", [
        ("kontexto", "kontexto"),
        ("@Kontexto.DE", "kontexto.de"),
        ("https://www.tiktok.com/@abc_1/live?lang=de", "abc_1"),
        ("tiktok.com/@ab", "ab"),
        ("x" * 24, "x" * 24),
    ])
    def test_accepted(self, raw, expected):
        from live_chat import normalise_channel

        assert normalise_channel(raw, "tiktok") == expected

    @pytest.mark.parametrize("raw", ["a", "endet.", "x" * 25, "hat leerzeichen", "", "ümlaut"])
    def test_refused(self, raw):
        from live_chat import normalise_channel

        assert normalise_channel(raw, "tiktok") is None


class TestCloseCodes:
    @pytest.mark.parametrize("code,kind", [
        (4400, "fatal"), (4401, "fatal"), (4403, "fatal"),
        (4404, "waiting"), (4005, "waiting"), (4006, "waiting"),
        (4429, "rate_limited"),
        (1011, "transient"), (4500, "transient"), (4555, "transient"),
        (4556, "transient"), (4557, "transient"), (1000, "transient"), (None, "transient"),
    ])
    def test_classes(self, code, kind):
        assert classify_close(code) == kind


class FakeSocket:
    """Yields recorded frames, then closes with the given code."""

    def __init__(self, frames, close_code=None):
        self._frames = list(frames)
        self._close_code = close_code
        self.close_code = close_code

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    def __aiter__(self):
        async def gen():
            for frame in self._frames:
                yield frame
            if self._close_code is not None and self._close_code not in (1000, 1001):
                raise ConnectionClosed(Close(self._close_code, "closed"), None)

        return gen()


class Stop(Exception):
    """Ends a reader loop from the injected sleep."""


def _reader(sockets, sleeps, max_sleeps=10):
    queue = list(sockets)

    def connect():
        return queue.pop(0)

    async def sleep(seconds):
        sleeps.append(seconds)
        if len(sleeps) >= max_sleeps or not queue:
            raise Stop()

    return TikTokChatReader(
        "kontexto", connect=connect, sleep=sleep, budget=ConnectBudget((1000, 1000, 1000)),
    )


def _run_reader(reader):
    states, seen = [], []

    async def on_state(state, error):
        states.append((state, error))

    async def on_message(message):
        seen.append(message.text)

    async def go():
        try:
            await reader.run(on_message, on_state)
        except Stop:
            pass

    asyncio.run(go())
    return states, seen


class TestReader:
    def test_chat_reaches_the_ingest_and_live_waits_for_a_frame(self):
        sleeps = []
        reader = _reader([FakeSocket([RECORDED_OPENING, _frame(_chat("birne"))], 4500)], sleeps)
        states, seen = _run_reader(reader)
        assert seen == ["Apfel", "birne"]
        assert states[0] == ("live", None)
        assert states[-1] == ("connecting", None)

    def test_a_streamer_who_is_not_live_is_waited_for_slowly(self):
        sleeps = []
        reader = _reader(
            [FakeSocket([], 4404), FakeSocket([], 4404), FakeSocket([], 4404)], sleeps,
        )
        states, _ = _run_reader(reader)
        # Never announced live, because nothing arrived.
        assert ("live", None) not in states
        assert states[0] == ("connecting", WAITING_TEXT)
        # 60, 120, ... with 10% jitter: a waiting room is cheap on the budget.
        assert 54 <= sleeps[0] <= 66
        assert 108 <= sleeps[1] <= 132

    def test_a_refused_key_ends_the_reader(self, caplog):
        sleeps = []
        reader = _reader([FakeSocket([], 4401)], sleeps)
        with caplog.at_level(logging.ERROR, logger="tiktok_chat"):
            states, _ = _run_reader(reader)
        assert states[-1][0] == "error"
        assert sleeps == []
        assert "API key was refused" in caplog.text

    def test_transient_trouble_retries_fast_and_resets_after_a_stream(self):
        sleeps = []
        reader = _reader(
            [FakeSocket([], 1011), FakeSocket([], 1011), FakeSocket([RECORDED_OPENING], 4555),
             FakeSocket([], 1011)],
            sleeps,
        )
        _run_reader(reader)
        assert sleeps[0] < 1.2 and 1.8 <= sleeps[1] <= 2.2
        # The third connection carried a stream, so the clock starts over.
        assert sleeps[2] < 1.2

    def test_the_provider_connection_limit_backs_off_a_minute(self):
        sleeps = []
        reader = _reader([FakeSocket([], 4429), FakeSocket([], 4429)], sleeps)
        _run_reader(reader)
        assert sleeps[0] >= 54

    def test_without_a_key_the_reader_says_so_and_stops(self, monkeypatch):
        monkeypatch.delenv("KONTEXTO_EULER_API_KEY", raising=False)
        reader = TikTokChatReader("kontexto", budget=ConnectBudget((5, 5, 5)))
        states, _ = _run_reader(reader)
        assert states == [("error", tiktok_chat.NOT_CONFIGURED_TEXT)]

    def test_the_key_never_reaches_a_log(self, monkeypatch, caplog):
        monkeypatch.setenv("KONTEXTO_EULER_API_KEY", "geheimer-schluessel")
        url = tiktok_chat.build_url("kontexto", "geheimer-schluessel")

        def connect():
            raise OSError(f"cannot reach {url}")

        sleeps = []

        async def sleep(seconds):
            sleeps.append(seconds)
            raise Stop()

        reader = TikTokChatReader(
            "kontexto", connect=connect, sleep=sleep, budget=ConnectBudget((5, 5, 5)),
        )
        with caplog.at_level(logging.DEBUG):
            _run_reader(reader)
        assert "geheimer-schluessel" not in caplog.text
        assert "***" in caplog.text


class TestBudget:
    def test_the_minute_window_holds_and_frees(self):
        now = [0.0]
        budget = ConnectBudget((2, 100, 100), clock=lambda: now[0])
        assert budget.reserve() == 0
        now[0] = 10
        assert budget.reserve() == 0
        now[0] = 20
        assert budget.reserve() == pytest.approx(40)
        now[0] = 60
        assert budget.reserve() == 0

    def test_the_hour_window_outlasts_the_minute(self):
        now = [0.0]
        budget = ConnectBudget((100, 3, 100), clock=lambda: now[0])
        for step in range(3):
            now[0] = step * 61
            assert budget.reserve() == 0
        now[0] = 200
        assert budget.reserve() == pytest.approx(3400)

    def test_a_malformed_override_falls_back(self, monkeypatch):
        monkeypatch.setenv("KONTEXTO_EULER_BUDGET", "viel")
        assert ConnectBudget()._limits == ConnectBudget.DEFAULT_LIMITS
        monkeypatch.setenv("KONTEXTO_EULER_BUDGET", "10,100,1000")
        assert ConnectBudget()._limits == (10, 100, 1000)
