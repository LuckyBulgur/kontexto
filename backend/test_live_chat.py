"""Tests for live chat mode: the parsing rules, the throttle and the room binding.

Nothing here opens a socket. The rules that decide whether a chat line becomes a
guess are the part that has to be right, and they are pure functions; the reader
that fetches those lines is tested separately against a fake WebSocket.
"""

import asyncio
import os
import tempfile

import pytest

from database import init_db, get_db


@pytest.fixture
def db_path():
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        yield os.path.join(tmpdir, "duels.db")


@pytest.fixture
def db(db_path):
    asyncio.run(init_db(db_path))
    return db_path


class TestChannelNames:
    def test_plain_name_is_lowercased(self):
        from live_chat import normalise_channel

        assert normalise_channel("  KontextoDE  ") == "kontextode"

    def test_pasted_url_and_handle_are_accepted(self):
        from live_chat import normalise_channel

        assert normalise_channel("https://www.twitch.tv/kontexto?tt=1") == "kontexto"
        assert normalise_channel("@kontexto") == "kontexto"

    def test_impossible_logins_are_refused(self):
        from live_chat import normalise_channel

        assert normalise_channel("") is None
        assert normalise_channel(None) is None
        assert normalise_channel("ab") is None
        assert normalise_channel("hat leerzeichen") is None
        assert normalise_channel("hat-bindestrich") is None
        assert normalise_channel("x" * 26) is None

    def test_a_profane_channel_is_refused(self):
        from live_chat import normalise_channel

        assert normalise_channel("adolf_hitler_88") is None
        assert normalise_channel("hurensohn_tv") is None
        assert normalise_channel("marschall_tv") == "marschall_tv"
        assert normalise_channel("max1988") == "max1988"


class TestIrcParsing:
    def test_privmsg_with_tags(self):
        from live_chat import parse_irc_line

        line = (
            "@badges=subscriber/6;color=#1E90FF;display-name=Mara;user-id=12345 "
            ":mara!mara@mara.tmi.twitch.tv PRIVMSG #kontexto :apfel"
        )
        msg = parse_irc_line(line)
        assert msg is not None
        assert msg.external_id == "12345"
        assert msg.display_name == "Mara"
        assert msg.text == "apfel"

    def test_privmsg_without_tags_falls_back_to_the_login(self):
        from live_chat import parse_irc_line

        msg = parse_irc_line(":mara!mara@mara.tmi.twitch.tv PRIVMSG #kontexto :apfel")
        assert msg is not None
        assert msg.external_id == "mara"
        assert msg.display_name == "mara"

    def test_text_may_contain_colons(self):
        from live_chat import parse_irc_line

        msg = parse_irc_line(
            ":a!a@a.tmi.twitch.tv PRIVMSG #k :was ist das: ein test"
        )
        assert msg is not None
        assert msg.text == "was ist das: ein test"

    def test_tag_values_are_unescaped(self):
        from live_chat import parse_tags

        tags = parse_tags(r"system-msg=hat\sabonniert\:\sdanke;id=7")
        assert tags["system-msg"] == "hat abonniert; danke"
        assert tags["id"] == "7"

    def test_escaped_backslash_does_not_decode_twice(self):
        from live_chat import parse_tags

        # `\\s` is a literal backslash followed by an s, not an escaped space.
        assert parse_tags(r"a=x\\sy")["a"] == r"x\sy"

    def test_protocol_lines_are_not_chat(self):
        from live_chat import parse_irc_line

        assert parse_irc_line("PING :tmi.twitch.tv") is None
        assert parse_irc_line(":tmi.twitch.tv RECONNECT") is None
        assert parse_irc_line(":a!a@a.tmi.twitch.tv JOIN #kontexto") is None
        assert parse_irc_line("@msg-id=x :tmi.twitch.tv NOTICE #k :nope") is None


class TestWordExtraction:
    def test_free_mode_takes_a_single_word(self):
        from live_chat import extract_word

        assert extract_word("Apfel", require_prefix=False) == "apfel"
        assert extract_word("  Birne  ", require_prefix=False) == "birne"

    def test_free_mode_ignores_a_sentence(self):
        from live_chat import extract_word

        assert extract_word("ich glaube apfel", require_prefix=False) is None
        assert extract_word("lol", require_prefix=False) == "lol"
        assert extract_word("!k apfel", require_prefix=False) is None

    def test_free_mode_ignores_emotes_and_numbers(self):
        from live_chat import extract_word

        assert extract_word("LUL", require_prefix=False) == "lul"
        assert extract_word("123", require_prefix=False) is None
        assert extract_word(":)", require_prefix=False) is None
        assert extract_word("a", require_prefix=False) is None

    def test_umlauts_survive(self):
        from live_chat import extract_word

        assert extract_word("Häuser", require_prefix=False) == "häuser"
        assert extract_word("Straße", require_prefix=False) == "straße"

    def test_prefix_mode_needs_the_prefix(self):
        from live_chat import extract_word

        assert extract_word("!k apfel", require_prefix=True) == "apfel"
        assert extract_word("!K Apfel", require_prefix=True) == "apfel"
        assert extract_word("apfel", require_prefix=True) is None
        assert extract_word("!k zwei woerter hier", require_prefix=True) is None
        assert extract_word("!k", require_prefix=True) is None


class TestGuessGate:
    def test_same_viewer_is_held_back(self):
        from live_chat import GuessGate

        now = [100.0]
        gate = GuessGate(cooldown=2.0, per_second=100, clock=lambda: now[0])

        assert gate.allow("room", "v1") is True
        now[0] += 0.5
        assert gate.allow("room", "v1") is False
        # A different viewer is unaffected by someone else's cooldown.
        assert gate.allow("room", "v2") is True
        now[0] += 2.0
        assert gate.allow("room", "v1") is True

    def test_room_cap_limits_a_flood(self):
        from live_chat import GuessGate

        now = [100.0]
        gate = GuessGate(cooldown=0.0, per_second=5, clock=lambda: now[0])

        accepted = sum(gate.allow("room", f"v{i}") for i in range(20))
        assert accepted == 5

        # The bucket refills continuously, so half a second buys two more.
        now[0] += 0.5
        assert sum(gate.allow("room", f"w{i}") for i in range(10)) == 2

    def test_rooms_do_not_share_a_bucket(self):
        from live_chat import GuessGate

        now = [100.0]
        gate = GuessGate(cooldown=0.0, per_second=2, clock=lambda: now[0])

        assert sum(gate.allow("a", f"v{i}") for i in range(5)) == 2
        assert sum(gate.allow("b", f"v{i}") for i in range(5)) == 2

    def test_forget_room_drops_its_state(self):
        from live_chat import GuessGate

        now = [100.0]
        gate = GuessGate(cooldown=60.0, per_second=100, clock=lambda: now[0])

        assert gate.allow("room", "v1") is True
        assert gate.allow("room", "v1") is False
        gate.forget_room("room")
        assert gate.allow("room", "v1") is True


class TestViewerNickname:
    def test_an_abusive_name_is_reflected_not_rejected(self):
        from live_chat import viewer_nickname

        name = viewer_nickname("Hurensohn")
        assert name != "Hurensohn"
        assert name.startswith("Ich bin ")

    def test_an_ordinary_name_survives(self):
        from live_chat import viewer_nickname

        assert viewer_nickname("Mara") == "Mara"


class TestRoomBinding:
    def _run(self, coro):
        return asyncio.run(coro)

    def test_tables_exist(self, db):
        import aiosqlite

        async def run():
            conn = await aiosqlite.connect(db)
            cursor = await conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
            tables = [row[0] for row in await cursor.fetchall()]
            await conn.close()
            assert "live_rooms" in tables
            assert "live_viewers" in tables

        self._run(run())

    def test_create_and_read_back(self, db):
        from koop import create_koop
        from live_chat import create_live_room, get_live_room, get_live_room_by_overlay

        async def run():
            conn = await get_db(db)
            try:
                room = await create_koop(conn, game_number=1, nickname="Host", tips_allowed=True)
                live = await create_live_room(
                    conn,
                    koop_id=room["koop_id"],
                    platform="twitch",
                    channel="kontexto",
                    host_token=room["player_token"],
                    require_prefix=False,
                )
                assert live["chat_state"] == "connecting"
                assert len(live["overlay_token"]) > 20

                by_id = await get_live_room(conn, room["koop_id"])
                assert by_id["channel"] == "kontexto"
                assert by_id["host_token"] == room["player_token"]

                by_overlay = await get_live_room_by_overlay(conn, live["overlay_token"])
                assert by_overlay["koop_id"] == room["koop_id"]
                assert await get_live_room_by_overlay(conn, "nope") is None
            finally:
                await conn.close()

        self._run(run())

    def test_one_room_per_channel(self, db):
        from koop import create_koop
        from live_chat import ChannelBusy, create_live_room

        async def run():
            conn = await get_db(db)
            try:
                first = await create_koop(conn, game_number=1, nickname="A", tips_allowed=True)
                second = await create_koop(conn, game_number=1, nickname="B", tips_allowed=True)
                await create_live_room(
                    conn, first["koop_id"], "twitch", "kontexto",
                    first["player_token"], False,
                )
                with pytest.raises(ChannelBusy):
                    await create_live_room(
                        conn, second["koop_id"], "twitch", "kontexto",
                        second["player_token"], False,
                    )
            finally:
                await conn.close()

        self._run(run())

    def test_stop_needs_the_host_token(self, db):
        from koop import create_koop
        from live_chat import create_live_room, get_live_room, stop_live_room

        async def run():
            conn = await get_db(db)
            try:
                room = await create_koop(conn, game_number=1, nickname="Host", tips_allowed=True)
                await create_live_room(
                    conn, room["koop_id"], "twitch", "kontexto",
                    room["player_token"], False,
                )
                assert await stop_live_room(conn, room["koop_id"], "fremd") is False
                assert await get_live_room(conn, room["koop_id"]) is not None

                assert await stop_live_room(conn, room["koop_id"], room["player_token"]) is True
                assert await get_live_room(conn, room["koop_id"]) is None
                # The koop room itself survives, so the host can still reveal.
                cursor = await conn.execute(
                    "SELECT COUNT(*) FROM koops WHERE id = ?", (room["koop_id"],)
                )
                assert (await cursor.fetchone())[0] == 1
            finally:
                await conn.close()

        self._run(run())

    def test_chat_state_transitions(self, db):
        from koop import create_koop
        from live_chat import create_live_room, get_live_room, set_chat_state

        async def run():
            conn = await get_db(db)
            try:
                room = await create_koop(conn, game_number=1, nickname="Host", tips_allowed=True)
                await create_live_room(
                    conn, room["koop_id"], "twitch", "kontexto",
                    room["player_token"], False,
                )
                await set_chat_state(conn, room["koop_id"], "live")
                assert (await get_live_room(conn, room["koop_id"]))["chat_state"] == "live"

                await set_chat_state(conn, room["koop_id"], "error", "Kanal gesperrt")
                back = await get_live_room(conn, room["koop_id"])
                assert back["chat_state"] == "error"
                assert back["chat_error"] == "Kanal gesperrt"

                with pytest.raises(ValueError):
                    await set_chat_state(conn, room["koop_id"], "erfunden")
            finally:
                await conn.close()

        self._run(run())


class TestViewerGuesses:
    def _run(self, coro):
        return asyncio.run(coro)

    def test_a_viewer_guess_carries_the_viewer_name(self, db):
        from koop import create_koop, record_koop_guess, get_koop_guesses

        async def run():
            conn = await get_db(db)
            try:
                room = await create_koop(conn, game_number=1, nickname="Host", tips_allowed=True)
                result = await record_koop_guess(
                    conn, room["koop_id"], room["player_token"], "apfel", 42,
                    display_name="Mara",
                )
                assert result["nickname"] == "Mara"
                guesses = await get_koop_guesses(conn, room["koop_id"])
                assert guesses[0]["nickname"] == "Mara"

                # The host keeps their own name when no override is passed.
                await record_koop_guess(
                    conn, room["koop_id"], room["player_token"], "birne", 7
                )
                guesses = await get_koop_guesses(conn, room["koop_id"])
                assert guesses[1]["nickname"] == "Host"
            finally:
                await conn.close()

        self._run(run())

    def test_the_solver_is_the_viewer(self, db):
        from koop import create_koop, record_koop_guess, get_koop_state

        async def run():
            conn = await get_db(db)
            try:
                room = await create_koop(conn, game_number=1, nickname="Host", tips_allowed=True)
                await record_koop_guess(
                    conn, room["koop_id"], room["player_token"], "loesung", 1,
                    display_name="Mara",
                )
                state = await get_koop_state(conn, room["koop_id"])
                assert state["solved"] is True
                assert state["solved_by"] == "Mara"
                # One player row, whatever the chat does.
                assert len(state["players"]) == 1
            finally:
                await conn.close()

        self._run(run())

    def test_viewer_standing_is_counted_and_reset(self, db):
        from koop import create_koop
        from live_chat import record_viewer, reset_viewers, top_viewers

        async def run():
            conn = await get_db(db)
            try:
                room = await create_koop(conn, game_number=1, nickname="Host", tips_allowed=True)
                kid = room["koop_id"]
                await record_viewer(conn, kid, "twitch", "1", "Mara", 500)
                await record_viewer(conn, kid, "twitch", "1", "Mara", 12)
                await record_viewer(conn, kid, "twitch", "2", "Jo", 300)

                top = await top_viewers(conn, kid)
                assert [v["nickname"] for v in top] == ["Mara", "Jo"]
                assert top[0]["hits"] == 2
                assert top[0]["best_rank"] == 12

                await reset_viewers(conn, kid)
                assert await top_viewers(conn, kid) == []
            finally:
                await conn.close()

        self._run(run())

    def test_a_chat_guess_keeps_the_room_alive(self, db):
        from koop import create_koop, cleanup_stale_koops
        from live_chat import record_viewer

        async def run():
            conn = await get_db(db)
            try:
                room = await create_koop(conn, game_number=1, nickname="Host", tips_allowed=True)
                kid = room["koop_id"]
                # Nobody is connected and the room looks two hours old: the
                # ordinary rule would delete it out from under a running stream.
                await conn.execute(
                    "UPDATE koops SET last_activity = datetime('now', '-2 hours') WHERE id = ?",
                    (kid,),
                )
                await conn.commit()

                await record_viewer(conn, kid, "twitch", "1", "Mara", 30)
                assert await cleanup_stale_koops(conn) == 0

                await conn.execute(
                    "UPDATE koops SET last_activity = datetime('now', '-2 hours') WHERE id = ?",
                    (kid,),
                )
                await conn.commit()
                assert await cleanup_stale_koops(conn) == 1
            finally:
                await conn.close()

        self._run(run())

    def test_cleanup_removes_the_binding(self, db):
        from koop import create_koop, cleanup_stale_koops
        from live_chat import create_live_room, record_viewer

        async def run():
            conn = await get_db(db)
            try:
                room = await create_koop(conn, game_number=1, nickname="Host", tips_allowed=True)
                kid = room["koop_id"]
                await create_live_room(
                    conn, kid, "twitch", "kontexto", room["player_token"], False
                )
                await record_viewer(conn, kid, "twitch", "1", "Mara", 30)
                await conn.execute(
                    "UPDATE koops SET last_activity = datetime('now', '-2 hours') WHERE id = ?",
                    (kid,),
                )
                await conn.commit()

                assert await cleanup_stale_koops(conn) == 1
                for table in ("live_rooms", "live_viewers"):
                    cursor = await conn.execute(
                        f"SELECT COUNT(*) FROM {table} WHERE koop_id = ?", (kid,)
                    )
                    assert (await cursor.fetchone())[0] == 0
            finally:
                await conn.close()

        self._run(run())


class TestOverlaySnapshot:
    def _run(self, coro):
        return asyncio.run(coro)

    def test_snapshot_has_no_game_number_and_no_word(self, db):
        from koop import create_koop, record_koop_guess
        from live_chat import create_live_room, overlay_snapshot, record_viewer

        async def run():
            conn = await get_db(db)
            try:
                room = await create_koop(conn, game_number=7, nickname="Host", tips_allowed=True)
                kid = room["koop_id"]
                await create_live_room(
                    conn, kid, "twitch", "kontexto", room["player_token"], False
                )
                await record_koop_guess(
                    conn, kid, room["player_token"], "apfel", 42, display_name="Mara"
                )
                await record_viewer(conn, kid, "twitch", "1", "Mara", 42)

                snap = await overlay_snapshot(conn, kid)
                assert "game_number" not in snap
                assert snap["round"] == 1
                assert snap["best_rank"] == 42
                assert snap["solved"] is False
                assert snap["channel"] == "kontexto"
                assert snap["recent"][0]["word"] == "apfel"
                assert snap["recent"][0]["nickname"] == "Mara"
                assert snap["top"][0]["nickname"] == "Mara"

                assert await overlay_snapshot(conn, "fehlt") is None
            finally:
                await conn.close()

        self._run(run())

    def test_recent_is_newest_first_and_capped(self, db):
        from koop import create_koop, record_koop_guess
        from live_chat import overlay_snapshot

        async def run():
            conn = await get_db(db)
            try:
                room = await create_koop(conn, game_number=1, nickname="Host", tips_allowed=True)
                kid = room["koop_id"]
                for i in range(5):
                    await record_koop_guess(
                        conn, kid, room["player_token"], f"wort{i}", 100 - i
                    )
                snap = await overlay_snapshot(conn, kid, guess_limit=3)
                assert [g["word"] for g in snap["recent"]] == ["wort4", "wort3", "wort2"]
            finally:
                await conn.close()

        self._run(run())


class TestHostMessages:
    """Notes from the operator to a streamer: queued, shown once, gone with the room."""

    def _run(self, coro):
        return asyncio.run(coro)

    async def _bound_room(self, conn, channel="kontexto"):
        from koop import create_koop
        from live_chat import create_live_room

        room = await create_koop(conn, game_number=1, nickname="Host", tips_allowed=True)
        await create_live_room(
            conn,
            koop_id=room["koop_id"],
            platform="twitch",
            channel=channel,
            host_token=room["player_token"],
            require_prefix=False,
        )
        return room

    def test_normalisation(self):
        from live_chat import HOST_MESSAGE_MAX_CHARS, normalise_host_message

        assert normalise_host_message("  Danke\nfür den\tStream  ") == "Danke für den Stream"
        # Zero-width characters sit inside a word and are removed, not spaced.
        assert normalise_host_message("Dan​ke⁠!") == "Danke!"
        assert normalise_host_message("a\x00b") == "a b"
        # NFC: a decomposed umlaut counts as one character.
        assert normalise_host_message("für") == "für"
        assert normalise_host_message("") is None
        assert normalise_host_message(" ​\n ") is None
        assert normalise_host_message(None) is None
        assert normalise_host_message("x" * HOST_MESSAGE_MAX_CHARS) is not None
        assert normalise_host_message("x" * (HOST_MESSAGE_MAX_CHARS + 1)) is None

    def test_send_pending_and_seen(self, db):
        from live_chat import mark_host_messages_seen, pending_host_messages, send_host_message

        async def run():
            conn = await get_db(db)
            try:
                room = await self._bound_room(conn)
                kid = room["koop_id"]
                first = await send_host_message(conn, kid, "Danke!")
                second = await send_host_message(conn, kid, "Starker Stream")
                assert first is not None and second is not None and second > first

                pending = await pending_host_messages(conn, kid)
                assert [m["text"] for m in pending] == ["Danke!", "Starker Stream"]
                assert pending[0]["sent_at"].endswith("Z")

                assert await mark_host_messages_seen(conn, kid, first) == 1
                # Repeating the ack is a no-op.
                assert await mark_host_messages_seen(conn, kid, first) == 0
                assert [m["id"] for m in await pending_host_messages(conn, kid)] == [second]
                assert await mark_host_messages_seen(conn, kid, second) == 1
                assert await pending_host_messages(conn, kid) == []
            finally:
                await conn.close()

        self._run(run())

    def test_ack_is_scoped_to_its_room(self, db):
        from live_chat import mark_host_messages_seen, pending_host_messages, send_host_message

        async def run():
            conn = await get_db(db)
            try:
                a = await self._bound_room(conn, "kanal_a")
                b = await self._bound_room(conn, "kanal_b")
                await send_host_message(conn, a["koop_id"], "für A")
                mid_b = await send_host_message(conn, b["koop_id"], "für B")
                assert await mark_host_messages_seen(conn, a["koop_id"], mid_b) == 1
                assert len(await pending_host_messages(conn, b["koop_id"])) == 1
            finally:
                await conn.close()

        self._run(run())

    def test_unbound_room_gets_nothing(self, db):
        from koop import create_koop
        from live_chat import pending_host_messages, send_host_message

        async def run():
            conn = await get_db(db)
            try:
                # A plain koop room is not a stream.
                room = await create_koop(conn, game_number=1, nickname="Host", tips_allowed=True)
                assert await send_host_message(conn, room["koop_id"], "Hallo") is None
                assert await send_host_message(conn, "fehlt", "Hallo") is None
                assert await pending_host_messages(conn, room["koop_id"]) == []
            finally:
                await conn.close()

        self._run(run())

    def test_pending_cap(self, db):
        from live_chat import (
            HOST_MESSAGE_MAX_PENDING, TooManyPending, mark_host_messages_seen, send_host_message,
        )

        async def run():
            conn = await get_db(db)
            try:
                room = await self._bound_room(conn)
                kid = room["koop_id"]
                ids = [
                    await send_host_message(conn, kid, f"Nachricht {i}")
                    for i in range(HOST_MESSAGE_MAX_PENDING)
                ]
                with pytest.raises(TooManyPending):
                    await send_host_message(conn, kid, "eine zu viel")
                await mark_host_messages_seen(conn, kid, ids[0])
                assert await send_host_message(conn, kid, "wieder Platz") is not None
            finally:
                await conn.close()

        self._run(run())

    def test_stop_and_cleanup_remove_messages(self, db):
        from koop import cleanup_stale_koops
        from live_chat import send_host_message, stop_live_room

        async def count(conn, kid):
            cursor = await conn.execute(
                "SELECT COUNT(*) AS n FROM live_host_messages WHERE koop_id = ?", (kid,)
            )
            return (await cursor.fetchone())["n"]

        async def run():
            conn = await get_db(db)
            try:
                stopped = await self._bound_room(conn, "kanal_stop")
                await send_host_message(conn, stopped["koop_id"], "Danke")
                # A foreign token neither unbinds nor deletes.
                assert await stop_live_room(conn, stopped["koop_id"], "fremd") is False
                assert await count(conn, stopped["koop_id"]) == 1
                assert await stop_live_room(conn, stopped["koop_id"], stopped["player_token"])
                assert await count(conn, stopped["koop_id"]) == 0

                stale = await self._bound_room(conn, "kanal_alt")
                await send_host_message(conn, stale["koop_id"], "Danke")
                await conn.execute(
                    "UPDATE koops SET last_activity = datetime('now', '-2 hours') WHERE id = ?",
                    (stale["koop_id"],),
                )
                await conn.execute(
                    "UPDATE koop_players SET connected = 0 WHERE koop_id = ?", (stale["koop_id"],)
                )
                await conn.commit()
                await cleanup_stale_koops(conn)
                assert await count(conn, stale["koop_id"]) == 0
            finally:
                await conn.close()

        self._run(run())

    def test_active_streams_read_along_without_the_answer(self, db):
        from koop import record_koop_guess
        from live_chat import active_streams

        async def run():
            conn = await get_db(db)
            try:
                room = await self._bound_room(conn)
                kid = room["koop_id"]
                for i in range(7):
                    await record_koop_guess(conn, kid, room["player_token"], f"wort{i}", 50 - i)
                [stream] = await active_streams(conn)
                assert stream["koop_id"] == kid
                assert stream["guesses"] == 7
                assert [g["word"] for g in stream["recent_guesses"]] == [
                    "wort6", "wort5", "wort4", "wort3", "wort2",
                ]
                assert stream["created_at"].endswith("Z")
                assert stream["solved"] is False
                assert "game_number" not in stream
            finally:
                await conn.close()

        self._run(run())
