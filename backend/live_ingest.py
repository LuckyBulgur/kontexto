"""The live chat supervisor: which rooms have a reader, and what a line does.

Everything here runs in the **single WS worker** (``KONTEXTO_WS_MODE``), next to
the arena clock and the matchmaking loop. That is not a preference: four API
workers would open four connections to the same chat and count every message four
times. The throttle is in-process for the same reason, it has one writer.

The supervisor owns one reader task per bound room and reconciles against the
``live_rooms`` table every few seconds, so a room that is created or stopped on
any worker is picked up here without any cross-process signal. SQLite is the only
thing the workers share, and that stays true.

A reader is platform specific and knows nothing about rooms: ``twitch_chat.py``
reads IRC, ``tiktok_chat.py`` reads the Euler Stream socket. Both expose the same
``run(on_message, on_state)`` and hand over ``live_chat.ChatMessage``, so what
happens to a message is decided once, here, for every platform.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time

import live_chat
from database import get_db
from koop import get_koop_state, record_koop_guess
from tiktok_chat import TikTokChatReader
from twitch_chat import TwitchChatReader
from websocket_manager import koop_manager as koop_ws_manager

logger = logging.getLogger(__name__)

# How often the supervisor compares its reader tasks against the table. Five
# seconds is a compromise: a streamer waits at most that long for the connection
# to come up, and an idle server does twelve small reads a minute.
RECONCILE_SECONDS = 5.0

# Development and end-to-end switch: reconcile rooms, count rounds, accept
# messages, but never open a socket to a chat. Without it the e2e suite would
# dial a real chat server for every invented channel name, and a developer
# testing the form would sit in a reconnect loop against a channel that does not
# exist. Messages are fed in through the dev-only debug endpoint instead.
OFFLINE = bool(os.environ.get("KONTEXTO_LIVE_OFFLINE"))

# One reader class per platform in live_chat.PLATFORMS. A room whose platform is
# missing here is a programming error and fails loudly in _start.
READERS = {
    "twitch": TwitchChatReader,
    "tiktok": TikTokChatReader,
}


def default_reader_factory(platform: str, channel: str):
    return READERS[platform](channel)


class LiveChatIngest:
    """Supervises one reader per bound room and applies what they read."""

    def __init__(
        self, db_path: str, resolve_guess, reader_factory=None, clock=time.monotonic
    ) -> None:
        self._db_path = db_path
        # Injected from main.py: the word-to-rank path a room guess takes. Passed
        # in rather than imported so this module never reaches into the game
        # state, and so a test can hand it a fake.
        self._resolve = resolve_guess
        self._reader_factory = reader_factory or default_reader_factory
        self._tasks: dict[str, asyncio.Task] = {}
        # Rooms handled without a reader, which is what OFFLINE means. Kept
        # apart from _tasks because there is no task to ask whether it is still
        # running, and without this the supervisor treated every pass as "no
        # reader yet" and wrote the status line again on every one of them.
        self._offline: set[str] = set()
        self._rooms: dict[str, dict] = {}
        self._gate = live_chat.GuessGate()
        # When this supervisor started. Absent hosts are only unbound once it
        # has been up for a whole absence window: after a deploy or a crash
        # every stamp is as old as the downtime, and a host page that is open
        # right now needs a few seconds to be seen again.
        self._started = clock()
        self._clock = clock

    # --- applying one message ---

    async def handle_message(self, koop_id: str, message) -> None:
        room = self._rooms.get(koop_id)
        if room is None:
            return

        word = live_chat.extract_word(message.text, room["require_prefix"])
        if word is None:
            return
        if not self._gate.allow(koop_id, message.external_id):
            return

        db = await get_db(self._db_path)
        try:
            state = await get_koop_state(db, koop_id)
            if state is None or state["solved"] or state["gave_up"]:
                return

            result = self._resolve(state["game_number"], word)
            if result is None:
                # An unknown word, a stopword, or a typo with more than one
                # plausible correction. A chat cannot answer a suggestion, so the
                # line is dropped instead of turning into three of them.
                return
            if not live_chat.is_showable_guess(word, result["word"], result["rank"]):
                return

            nickname = live_chat.viewer_nickname(message.display_name)
            recorded = await record_koop_guess(
                db, koop_id, room["chat_token"], result["word"], result["rank"],
                display_name=nickname,
            )
            if recorded is None or recorded["already_guessed"]:
                return

            # Straight to the sockets, without waiting for the poll tick. Safe
            # here and nowhere else: the ingest and the broadcast manager are
            # the same process, the single WS worker.
            if recorded.get("guess_id") is not None:
                await koop_ws_manager.push_guess(
                    koop_id,
                    {
                        "id": recorded["guess_id"],
                        "nickname": nickname,
                        "word": result["word"],
                        "rank": result["rank"],
                        "is_tip": False,
                        "player_token": room["chat_token"],
                    },
                )

            # One transaction for the whole bookkeeping of this line. Five
            # separate commits per chat message is five write locks, and this
            # path runs up to twenty times a second per room.
            is_new_viewer = await live_chat.record_viewer(
                db, koop_id, room["platform"], message.external_id, nickname,
                result["rank"], commit=False,
            )
            await live_chat.record_stream_event(
                db, room["platform"], room["channel"], "guesses",
                rank=result["rank"], commit=False,
            )
            if is_new_viewer:
                await live_chat.record_stream_event(
                    db, room["platform"], room["channel"], "viewers", commit=False,
                )
            if result["rank"] == 1 and recorded["solved"]:
                await live_chat.record_stream_event(
                    db, room["platform"], room["channel"], "solves", commit=False,
                )
            await db.commit()
        finally:
            await db.close()

        await analytics_guess(self._db_path, result["word"], result["rank"], recorded["solved"])

    async def _set_state(self, koop_id: str, state: str, error: str | None) -> None:
        db = await get_db(self._db_path)
        try:
            await live_chat.set_chat_state(db, koop_id, state, error)
        except Exception:  # noqa: BLE001 - a status line must not kill the reader
            logger.warning("could not write chat state for %s", koop_id, exc_info=True)
        finally:
            await db.close()

    # --- supervising ---

    def _start(self, room: dict) -> None:
        koop_id = room["koop_id"]
        if OFFLINE:
            # No reader, but the room is accepting: that is exactly what the
            # status line should say, because the debug endpoint feeds it.
            self._offline.add(koop_id)
            asyncio.create_task(self._set_state(koop_id, "live", None))
            return
        reader = self._reader_factory(room["platform"], room["channel"])

        async def on_message(message):
            await self.handle_message(koop_id, message)

        async def on_state(state, error):
            await self._set_state(koop_id, state, error)

        self._tasks[koop_id] = asyncio.create_task(reader.run(on_message, on_state))

    def _cancel(self, koop_id: str) -> None:
        """Drop the reader task. The room's own state is not touched here."""
        task = self._tasks.pop(koop_id, None)
        if task is not None and not task.done():
            task.cancel()

    def _forget(self, koop_id: str) -> None:
        self._cancel(koop_id)
        self._offline.discard(koop_id)
        self._rooms.pop(koop_id, None)
        self._gate.forget_room(koop_id)

    async def reconcile(self) -> None:
        db = await get_db(self._db_path)
        try:
            if self._clock() - self._started >= live_chat.HOST_ABSENT_SECONDS:
                for gone in await live_chat.unbind_absent_rooms(db):
                    logger.info(
                        "live chat unbound, host page closed: %s/%s",
                        gone["platform"], gone["channel"],
                    )
            rooms = await live_chat.list_live_rooms(db)
            for room in rooms:
                known = self._rooms.get(room["koop_id"])
                # A new round, noticed here rather than in the koop handler, so
                # it is counted whether or not the chat is talking right now.
                if known is not None and room["round"] != known.get("round"):
                    await live_chat.record_stream_event(
                        db, room["platform"], room["channel"], "rounds",
                    )
                self._rooms[room["koop_id"]] = room
        finally:
            await db.close()

        live_ids = {room["koop_id"] for room in rooms}
        for koop_id in list(self._rooms):
            if koop_id not in live_ids:
                self._forget(koop_id)
        for koop_id, task in list(self._tasks.items()):
            if task.done():
                self._tasks.pop(koop_id, None)

        for room in rooms:
            if room["koop_id"] in self._tasks or room["koop_id"] in self._offline:
                continue
            # A reader that gave up wrote 'error' and is not started again. The
            # alternative is a reconnect loop against a channel that does not
            # exist, and a status line that keeps promising it will work.
            if room["chat_state"] == "error":
                continue
            self._start(room)

    async def run(self) -> None:
        while True:
            try:
                await self.reconcile()
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001 - one bad pass must not end the loop
                logger.warning("live chat reconcile failed", exc_info=True)
            await asyncio.sleep(RECONCILE_SECONDS)

    def shutdown(self) -> None:
        """Cancel every reader. The rooms stay in the table and come back."""
        for koop_id in list(self._tasks):
            self._cancel(koop_id)
        self._offline.clear()


async def analytics_guess(db_path: str, word: str, rank: int, solved: bool) -> None:
    """The same counters a human guess raises, under the `live` dimension."""
    import analytics

    await analytics.record_action(db_path, "guesses", "live", word=word)
    if rank == 1 and solved:
        await analytics.record_action(db_path, "solves", "live")


# The running ingest, so the dev-only debug endpoint can hand it a message. It
# is set by the one lifespan task, so there is never more than one.
_ingest: LiveChatIngest | None = None


def current_ingest() -> LiveChatIngest | None:
    return _ingest


async def run_live_chat(db_path: str, resolve_guess) -> None:
    """Entry point for the lifespan task in the WS worker."""
    global _ingest
    ingest = LiveChatIngest(db_path, resolve_guess)
    _ingest = ingest
    try:
        await ingest.run()
    finally:
        ingest.shutdown()
        _ingest = None
