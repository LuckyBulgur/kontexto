"""Tests for the Twitch reader and the chat ingest.

No socket is opened. The reader takes its connection from a factory, so the IRC
handling is exercised against recorded lines, and the ingest takes its
word-to-rank resolver from the caller, so it can be driven without game data.
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


async def _collect(bucket, message):
    bucket.append(message)


class FakeSocket:
    """A WebSocket that yields recorded IRC lines and records what was sent."""

    def __init__(self, lines):
        self._lines = list(lines)
        self.sent: list[str] = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def send(self, text):
        self.sent.append(text)

    def __aiter__(self):
        async def gen():
            for line in self._lines:
                yield line

        return gen()


class TestTwitchReader:
    def _run(self, coro):
        return asyncio.run(coro)

    def test_handshake_and_chat(self):
        from twitch_chat import TwitchChatReader

        socket = FakeSocket([
            ":tmi.twitch.tv 001 justinfan1 :Welcome",
            "@user-id=1;display-name=Mara :m!m@m.tmi.twitch.tv PRIVMSG #kontexto :apfel",
        ])
        seen = []
        reader = TwitchChatReader("kontexto", connect=lambda: socket)

        self._run(reader._session(socket, lambda msg: _collect(seen, msg)))

        assert socket.sent[0].startswith("CAP REQ")
        assert socket.sent[1].startswith("NICK justinfan")
        assert socket.sent[2] == "JOIN #kontexto"
        assert [m.text for m in seen] == ["apfel"]

    def test_ping_is_answered(self):
        from twitch_chat import TwitchChatReader

        socket = FakeSocket(["PING :tmi.twitch.tv"])
        reader = TwitchChatReader("kontexto", connect=lambda: socket)
        self._run(reader._session(socket, lambda msg: _collect([], msg)))
        assert "PONG :tmi.twitch.tv" in socket.sent

    def test_reconnect_ends_the_session(self):
        from twitch_chat import TwitchChatReader

        socket = FakeSocket([
            ":tmi.twitch.tv RECONNECT",
            "@user-id=1;display-name=M :m!m@m.tmi.twitch.tv PRIVMSG #k :apfel",
        ])
        seen = []
        reader = TwitchChatReader("k", connect=lambda: socket)
        self._run(reader._session(socket, lambda msg: _collect(seen, msg)))
        # Everything after the RECONNECT belongs to the next connection.
        assert seen == []

    def test_a_suspended_channel_is_fatal(self):
        from twitch_chat import FatalChatError, TwitchChatReader

        socket = FakeSocket([
            "@msg-id=msg_channel_suspended :tmi.twitch.tv NOTICE #k :gesperrt",
        ])
        reader = TwitchChatReader("k", connect=lambda: socket)
        with pytest.raises(FatalChatError):
            self._run(reader._session(socket, lambda msg: _collect([], msg)))

    def test_run_gives_up_on_a_fatal_notice(self):
        from twitch_chat import TwitchChatReader

        states = []
        socket = FakeSocket([
            "@msg-id=msg_room_not_found :tmi.twitch.tv NOTICE #k :weg",
        ])
        reader = TwitchChatReader("k", connect=lambda: socket)

        async def on_state(state, error):
            states.append((state, error))

        # Returns instead of reconnecting forever, which is the whole point.
        self._run(reader.run(lambda msg: _collect([], msg), on_state))

        assert states[0][0] == "live"
        assert states[-1][0] == "error"
        assert "gibt es nicht" in states[-1][1]

    def test_an_ordinary_notice_is_ignored(self):
        from twitch_chat import TwitchChatReader

        socket = FakeSocket([
            "@msg-id=host_on :tmi.twitch.tv NOTICE #k :hosting",
            "@user-id=1;display-name=M :m!m@m.tmi.twitch.tv PRIVMSG #k :apfel",
        ])
        seen = []
        reader = TwitchChatReader("k", connect=lambda: socket)
        self._run(reader._session(socket, lambda msg: _collect(seen, msg)))
        assert [m.text for m in seen] == ["apfel"]


class TestIngest:
    def _run(self, coro):
        return asyncio.run(coro)

    def _ingest(self, db, ranks):
        from twitch_chat import LiveChatIngest

        def resolve(game_number, word):
            rank = ranks.get(word)
            return None if rank is None else {"word": word, "rank": rank}

        return LiveChatIngest(db, resolve)

    def _message(self, external_id, name, text):
        from live_chat import ChatMessage

        return ChatMessage(external_id=external_id, display_name=name, text=text)

    async def _room(self, db, require_prefix=False):
        from koop import create_koop
        from live_chat import create_live_room

        conn = await get_db(db)
        try:
            room = await create_koop(conn, game_number=1, nickname="Host", tips_allowed=True)
            await create_live_room(
                conn, room["koop_id"], "twitch", "kontexto",
                room["player_token"], require_prefix,
            )
            return room["koop_id"]
        finally:
            await conn.close()

    async def _ready(self, db, ranks, require_prefix=False):
        """A room plus an ingest that has already picked it up."""
        koop_id = await self._room(db, require_prefix)
        ingest = self._ingest(db, ranks)
        await ingest.reconcile()
        # The reader task would open a socket; the rules are what is under test.
        ingest.shutdown()
        return koop_id, ingest

    async def _words(self, db, koop_id):
        from koop import get_koop_guesses

        conn = await get_db(db)
        try:
            return [g["word"] for g in await get_koop_guesses(conn, koop_id)]
        finally:
            await conn.close()

    def test_a_chat_line_becomes_a_guess(self, db):
        from koop import get_koop_guesses
        from live_chat import top_viewers

        async def run():
            koop_id, ingest = await self._ready(db, {"apfel": 42})
            await ingest.handle_message(koop_id, self._message("1", "Mara", "Apfel"))

            conn = await get_db(db)
            try:
                guesses = await get_koop_guesses(conn, koop_id)
                assert [(g["nickname"], g["word"], g["rank"]) for g in guesses] == [
                    ("Mara", "apfel", 42)
                ]
                assert (await top_viewers(conn, koop_id))[0]["nickname"] == "Mara"
            finally:
                await conn.close()

        self._run(run())

    def test_conversation_and_unknown_words_are_dropped(self, db):
        async def run():
            koop_id, ingest = await self._ready(db, {"apfel": 42})
            await ingest.handle_message(koop_id, self._message("1", "A", "das ist schwer"))
            await ingest.handle_message(koop_id, self._message("2", "B", "nichtimspiel"))
            assert await self._words(db, koop_id) == []

        self._run(run())

    def test_the_cooldown_holds_one_viewer_back(self, db):
        async def run():
            koop_id, ingest = await self._ready(db, {"apfel": 42, "birne": 7})
            await ingest.handle_message(koop_id, self._message("1", "Mara", "apfel"))
            await ingest.handle_message(koop_id, self._message("1", "Mara", "birne"))
            assert await self._words(db, koop_id) == ["apfel"]

        self._run(run())

    def test_another_viewer_is_not_held_back(self, db):
        async def run():
            koop_id, ingest = await self._ready(db, {"apfel": 42, "birne": 7})
            await ingest.handle_message(koop_id, self._message("1", "Mara", "apfel"))
            await ingest.handle_message(koop_id, self._message("2", "Jo", "birne"))
            assert await self._words(db, koop_id) == ["apfel", "birne"]

        self._run(run())

    def test_a_solved_round_takes_no_more_guesses(self, db):
        async def run():
            koop_id, ingest = await self._ready(db, {"loesung": 1, "apfel": 42})
            await ingest.handle_message(koop_id, self._message("1", "Mara", "loesung"))
            await ingest.handle_message(koop_id, self._message("2", "Jo", "apfel"))
            assert await self._words(db, koop_id) == ["loesung"]

        self._run(run())

    def test_prefix_mode_is_honoured(self, db):
        async def run():
            koop_id, ingest = await self._ready(
                db, {"apfel": 42, "birne": 7}, require_prefix=True
            )
            await ingest.handle_message(koop_id, self._message("1", "A", "apfel"))
            await ingest.handle_message(koop_id, self._message("2", "B", "!k birne"))
            assert await self._words(db, koop_id) == ["birne"]

        self._run(run())

    def test_an_abusive_chat_name_is_masked_on_the_board(self, db):
        from koop import get_koop_guesses

        async def run():
            koop_id, ingest = await self._ready(db, {"apfel": 42})
            await ingest.handle_message(koop_id, self._message("1", "Hurensohn", "apfel"))

            conn = await get_db(db)
            try:
                guesses = await get_koop_guesses(conn, koop_id)
                assert guesses[0]["nickname"] != "Hurensohn"
                assert guesses[0]["nickname"].startswith("Ich bin ")
            finally:
                await conn.close()

        self._run(run())

    def test_a_flagged_word_never_reaches_the_overlay(self, db):
        async def run():
            koop_id, ingest = await self._ready(db, {"hitler": 312, "apfel": 42})
            await ingest.handle_message(koop_id, self._message("1", "Mara", "Hitler"))
            await ingest.handle_message(koop_id, self._message("2", "Jo", "apfel"))
            assert await self._words(db, koop_id) == ["apfel"]

        self._run(run())

    def test_a_flagged_solution_still_counts(self, db):
        """Idiot is a solution and a flagged word; the chat must be able to win."""
        async def run():
            koop_id, ingest = await self._ready(db, {"idiot": 1, "depp": 3})
            await ingest.handle_message(koop_id, self._message("1", "Mara", "depp"))
            await ingest.handle_message(koop_id, self._message("2", "Jo", "Idiot"))
            assert await self._words(db, koop_id) == ["idiot"]

        self._run(run())

    def test_an_unbound_room_takes_nothing(self, db):
        async def run():
            koop_id, ingest = await self._ready(db, {"apfel": 42})
            from live_chat import stop_live_room, get_live_room

            conn = await get_db(db)
            try:
                room = await get_live_room(conn, koop_id)
                await stop_live_room(conn, koop_id, room["host_token"])
            finally:
                await conn.close()

            await ingest.reconcile()
            await ingest.handle_message(koop_id, self._message("1", "Mara", "apfel"))
            assert await self._words(db, koop_id) == []

        self._run(run())

    def test_a_new_round_is_counted_once(self, db):
        from live_chat import stream_stats

        async def run():
            koop_id, ingest = await self._ready(db, {"apfel": 42})

            conn = await get_db(db)
            try:
                await conn.execute(
                    "UPDATE koops SET round = 2 WHERE id = ?", (koop_id,)
                )
                await conn.commit()
            finally:
                await conn.close()

            await ingest.reconcile()
            ingest.shutdown()
            await ingest.reconcile()
            ingest.shutdown()

            conn = await get_db(db)
            try:
                rows = await stream_stats(conn)
                # The first pass only learned the room, the second saw round 2,
                # and the third saw no change. One round, counted once.
                assert rows[0]["rounds"] == 1
            finally:
                await conn.close()

        self._run(run())


class TestStreamStats:
    def _run(self, coro):
        return asyncio.run(coro)

    def test_counters_add_up_per_channel(self, db):
        from live_chat import record_stream_event, stream_stats, stream_totals

        async def run():
            conn = await get_db(db)
            try:
                await record_stream_event(conn, "twitch", "kontexto", "sessions")
                await record_stream_event(conn, "twitch", "kontexto", "guesses", rank=80)
                await record_stream_event(conn, "twitch", "kontexto", "guesses", rank=4)
                await record_stream_event(conn, "twitch", "andere", "sessions")

                rows = await stream_stats(conn)
                assert [r["channel"] for r in rows] == ["kontexto", "andere"]
                assert rows[0]["guesses"] == 2
                assert rows[0]["sessions"] == 1
                assert rows[0]["best_rank"] == 4
                assert rows[0]["first_seen"]

                totals = await stream_totals(conn)
                assert totals["channels"] == 2
                assert totals["guesses"] == 2

                with pytest.raises(ValueError):
                    await record_stream_event(conn, "twitch", "x", "erfunden")
            finally:
                await conn.close()

        self._run(run())

    def test_stats_outlive_the_room(self, db):
        from koop import cleanup_stale_koops, create_koop
        from live_chat import create_live_room, record_stream_event, stream_stats

        async def run():
            conn = await get_db(db)
            try:
                room = await create_koop(conn, game_number=1, nickname="Host", tips_allowed=True)
                await create_live_room(
                    conn, room["koop_id"], "twitch", "kontexto", room["player_token"], False
                )
                await record_stream_event(conn, "twitch", "kontexto", "guesses", rank=9)
                await conn.execute(
                    "UPDATE koops SET last_activity = datetime('now', '-2 hours') WHERE id = ?",
                    (room["koop_id"],),
                )
                await conn.commit()
                assert await cleanup_stale_koops(conn) == 1

                # The room is gone, the channel's book is not.
                rows = await stream_stats(conn)
                assert rows[0]["channel"] == "kontexto"
                assert rows[0]["guesses"] == 1
            finally:
                await conn.close()

        self._run(run())

    def test_active_streams_lists_bound_rooms_only(self, db):
        from koop import create_koop
        from live_chat import active_streams, create_live_room, stop_live_room

        async def run():
            conn = await get_db(db)
            try:
                room = await create_koop(conn, game_number=1, nickname="Host", tips_allowed=True)
                await create_live_room(
                    conn, room["koop_id"], "twitch", "kontexto", room["player_token"], False
                )
                active = await active_streams(conn)
                assert len(active) == 1
                assert active[0]["channel"] == "kontexto"
                assert active[0]["round"] == 1

                await stop_live_room(conn, room["koop_id"], room["player_token"])
                assert await active_streams(conn) == []
            finally:
                await conn.close()

        self._run(run())
