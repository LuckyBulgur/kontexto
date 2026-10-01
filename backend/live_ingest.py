"""The live chat supervisor: which rooms have a reader, and what a line does.

Everything here runs in the **single WS worker** (``KONTEXTO_WS_MODE``), next to
the arena clock and the matchmaking loop. That is not a preference: four API
workers would open four connections to the same chat and count every message four
times. The throttle is in-process for the same reason, it has one writer.

The supervisor owns one reader task per bound chat, keyed by room and platform,
so a room that reads Twitch and TikTok has two. It reconciles against the
``live_rooms`` and ``live_channels`` tables every few seconds, so a room or a chat
that is created, paused or stopped on any worker is picked up here without any
cross-process signal. SQLite is the only thing the workers share, and that stays
true.

A reader is platform specific and knows nothing about rooms: ``twitch_chat.py``
reads IRC, ``tiktok_chat.py`` reads the Euler Stream socket. Both expose the same
``run(on_message, on_state, on_event)`` and hand over ``live_chat.ChatMessage``
and ``live_chat.PaidEvent``, so what happens to a line or to paid support is
decided once, here, for every platform. Paid support is stored and shown on the
host page; it never touches the round.

The Twitch reader also reports the broadcaster id it joined, and the ingest
keeps the badge pictures of that channel fresh (``twitch_badges.BadgeCatalog``).
"""

from __future__ import annotations

import asyncio
import logging
import os
import time

import live_chat
import twitch_badges
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


# How often stored paid events older than a day are dropped.
PRUNE_SECONDS = 600.0


def default_reader_factory(platform: str, channel: str):
    return READERS[platform](channel)


def _helix_client() -> twitch_badges.HelixClient | None:
    creds = twitch_badges.credentials()
    if creds is None:
        logger.info("twitch badges: no app credentials, the host page draws its own icons")
        return None
    return twitch_badges.HelixClient(creds)


class LiveChatIngest:
    """Supervises one reader per bound room and applies what they read."""

    def __init__(
        self,
        db_path: str,
        resolve_guess,
        reader_factory=None,
        clock=time.monotonic,
        badges: twitch_badges.BadgeCatalog | None = None,
    ) -> None:
        self._db_path = db_path
        # Injected from main.py: the word-to-rank path a room guess takes. Passed
        # in rather than imported so this module never reaches into the game
        # state, and so a test can hand it a fake.
        self._resolve = resolve_guess
        self._reader_factory = reader_factory or default_reader_factory
        # One reader per (room, platform).
        self._tasks: dict[tuple[str, str], asyncio.Task] = {}
        # Chats handled without a reader, which is what OFFLINE means. Kept
        # apart from _tasks because there is no task to ask whether it is still
        # running, and without this the supervisor treated every pass as "no
        # reader yet" and wrote the status line again on every one of them.
        self._offline: set[tuple[str, str]] = set()
        # Which channel each of those chats reads, so a platform whose channel
        # was swapped between two passes gets a fresh reader.
        self._reading: dict[tuple[str, str], str] = {}
        self._rooms: dict[str, dict] = {}
        self._gate = live_chat.GuessGate()
        # When this supervisor started. Absent hosts are only unbound once it
        # has been up for a whole absence window: after a deploy or a crash
        # every stamp is as old as the downtime, and a host page that is open
        # right now needs a few seconds to be seen again.
        self._started = clock()
        self._clock = clock
        # Twitch's badge pictures. Disabled (no fetch at all) without the app
        # credentials, and always disabled offline.
        self._badges = badges or twitch_badges.BadgeCatalog(
            db_path, None if OFFLINE else _helix_client()
        )
        # When the stored events were last pruned.
        self._pruned_at = -float("inf")
        # Fire-and-forget work (badge fetches), held so the event loop's weak
        # reference to a running task cannot let it be collected mid-flight.
        self._background: set[asyncio.Task] = set()

    # --- applying one message ---

    async def handle_message(self, koop_id: str, platform: str, message) -> None:
        room = self._rooms.get(koop_id)
        if room is None:
            return
        # The binding as of the last reconcile pass. A chat that was removed or
        # paused on an API worker stops counting within RECONCILE_SECONDS; a
        # read per line would cost the database what the throttle saves it.
        binding = next(
            (c for c in room["channels"] if c["platform"] == platform), None
        )
        if binding is None:
            return
        # The streamer's own "stop" ends the round before anything else is
        # asked: a paused chat, a solved round and the throttle must not stand
        # between a streamer who lost the host page and a free channel.
        if live_chat.is_streamer(message, binding["channel"]) and live_chat.is_stop_command(
            message.text
        ):
            await self._end_by_streamer(koop_id, platform, binding["channel"])
            return
        if binding["paused"]:
            return

        word = live_chat.extract_word(message.text, room["require_prefix"])
        if word is None:
            return
        if not self._gate.allow(koop_id, platform, message.external_id):
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
            badges = live_chat.encode_badges(message.badges)
            recorded = await record_koop_guess(
                db, koop_id, room["chat_token"], result["word"], result["rank"],
                display_name=nickname, source=platform, badges=badges,
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
                        "source": platform,
                        "badges": badges,
                    },
                )

            # One transaction for the whole bookkeeping of this line. Five
            # separate commits per chat message is five write locks, and this
            # path runs up to twenty times a second per room.
            channel = binding["channel"]
            solved_now = result["rank"] == 1 and recorded["solved"]
            is_new_viewer = await live_chat.record_viewer(
                db, koop_id, platform, message.external_id, nickname,
                result["rank"], commit=False, badges=badges, solved=solved_now,
            )
            await live_chat.record_stream_event(
                db, platform, channel, "guesses", rank=result["rank"], commit=False,
            )
            if is_new_viewer:
                await live_chat.record_stream_event(
                    db, platform, channel, "viewers", commit=False,
                )
            if solved_now:
                await live_chat.record_stream_event(
                    db, platform, channel, "solves", commit=False,
                )
            await db.commit()
        finally:
            await db.close()

        await analytics_guess(self._db_path, result["word"], result["rank"], recorded["solved"])

    async def handle_event(self, koop_id: str, platform: str, event) -> bool:
        """Store one paid event for the host page. True when it was new.

        Not gated by pause, the throttle or the round's state: a gift during a
        break or after the solve is still a gift, and the streamer still wants
        to thank for it. The actor's name passes the nickname rule, as every
        name out of a chat does, because it lands on a page that is on stream.
        """
        room = self._rooms.get(koop_id)
        if room is None:
            return False
        binding = next((c for c in room["channels"] if c["platform"] == platform), None)
        if binding is None:
            return False
        actor = (
            event.actor_name
            if event.actor_name == live_chat.ANONYMOUS_NAME
            else live_chat.viewer_nickname(event.actor_name)
        )
        db = await get_db(self._db_path)
        try:
            stored = await live_chat.record_paid_event(
                db, koop_id, binding["channel"], event, actor
            )
        finally:
            await db.close()
        return stored is not None

    async def handle_room_id(self, channel: str, broadcaster_id: str) -> None:
        """A Twitch reader joined and learned the channel's broadcaster id."""
        db = await get_db(self._db_path)
        try:
            await twitch_badges.remember_channel(db, channel, broadcaster_id)
        finally:
            await db.close()
        self._spawn(self._badges.ensure(broadcaster_id))

    async def _end_by_streamer(self, koop_id: str, platform: str, channel: str) -> None:
        """Unbind a room because its streamer wrote stop in their own chat.

        The whole room goes, every chat it reads, because only the host chose
        those chats and the point is that one word frees the streamer. It is the
        operator's unbinding: the overlay goes blank, the koop room stays, and an
        open host page reads the round as ended on its next poll.
        """
        db = await get_db(self._db_path)
        try:
            ended = await live_chat.end_live_room(db, koop_id)
        finally:
            await db.close()
        if ended:
            logger.info("live chat ended by streamer: %s/%s", platform, channel)
        self._forget(koop_id)

    async def _set_state(
        self, koop_id: str, platform: str, state: str, error: str | None
    ) -> None:
        db = await get_db(self._db_path)
        try:
            await live_chat.set_chat_state(db, koop_id, platform, state, error)
        except Exception:  # noqa: BLE001 - a status line must not kill the reader
            logger.warning(
                "could not write chat state for %s/%s", koop_id, platform, exc_info=True
            )
        finally:
            await db.close()

    def _spawn(self, coroutine) -> None:
        task = asyncio.create_task(coroutine)
        self._background.add(task)
        task.add_done_callback(self._background.discard)

    # --- supervising ---

    def _start(self, koop_id: str, binding: dict) -> None:
        platform = binding["platform"]
        key = (koop_id, platform)
        self._reading[key] = binding["channel"]
        if OFFLINE:
            # No reader, but the chat is accepting: that is exactly what the
            # status line should say, because the debug endpoint feeds it.
            self._offline.add(key)
            asyncio.create_task(self._set_state(koop_id, platform, "live", None))
            return
        reader = self._reader_factory(platform, binding["channel"])

        async def on_message(message):
            await self.handle_message(koop_id, platform, message)

        async def on_state(state, error):
            await self._set_state(koop_id, platform, state, error)

        async def on_event(event):
            try:
                await self.handle_event(koop_id, platform, event)
            except Exception:  # noqa: BLE001 - a lost event must not drop the chat
                logger.warning("could not store a paid event for %s/%s", koop_id, platform,
                               exc_info=True)

        if platform == "twitch":
            channel = binding["channel"]

            async def on_room(broadcaster_id):
                try:
                    await self.handle_room_id(channel, broadcaster_id)
                except Exception:  # noqa: BLE001 - pictures are decoration
                    logger.warning("could not note the broadcaster id of %s", channel,
                                   exc_info=True)

            run = reader.run(on_message, on_state, on_event, on_room)
        else:
            run = reader.run(on_message, on_state, on_event)
        self._tasks[key] = asyncio.create_task(run)

    def _cancel(self, key: tuple[str, str]) -> None:
        """Drop one reader task. The chat's own state is not touched here."""
        task = self._tasks.pop(key, None)
        if task is not None and not task.done():
            task.cancel()

    def _drop_chat(self, key: tuple[str, str]) -> None:
        self._cancel(key)
        self._offline.discard(key)
        self._reading.pop(key, None)

    def _forget(self, koop_id: str) -> None:
        for key in [k for k in (*self._tasks, *self._offline) if k[0] == koop_id]:
            self._drop_chat(key)
        self._rooms.pop(koop_id, None)
        self._gate.forget_room(koop_id)

    async def reconcile(self) -> None:
        if self._badges.enabled:
            self._spawn(self._badges.ensure())
        db = await get_db(self._db_path)
        try:
            if self._clock() - self._pruned_at >= PRUNE_SECONDS:
                self._pruned_at = self._clock()
                await live_chat.prune_events(db)
            if self._clock() - self._started >= live_chat.HOST_ABSENT_SECONDS:
                for gone in await live_chat.unbind_absent_rooms(db):
                    logger.info(
                        "live chat unbound, host page closed: %s",
                        ", ".join(f"{c['platform']}/{c['channel']}" for c in gone["channels"])
                        or gone["koop_id"],
                    )
            rooms = await live_chat.list_live_rooms(db)
            for room in rooms:
                known = self._rooms.get(room["koop_id"])
                # A new round, noticed here rather than in the koop handler, so
                # it is counted whether or not the chat is talking right now.
                # Every chat the room reads plays it, so each channel's book
                # gets it.
                if known is not None and room["round"] != known.get("round"):
                    for binding in room["channels"]:
                        await live_chat.record_stream_event(
                            db, binding["platform"], binding["channel"], "rounds",
                        )
                self._rooms[room["koop_id"]] = room
        finally:
            await db.close()

        live_ids = {room["koop_id"] for room in rooms}
        for koop_id in list(self._rooms):
            if koop_id not in live_ids:
                self._forget(koop_id)
        for key, task in list(self._tasks.items()):
            if task.done():
                self._tasks.pop(key, None)

        # A chat the host unbound, or swapped for another channel on the same
        # platform, loses its reader here.
        bound = {
            (room["koop_id"], binding["platform"]): binding["channel"]
            for room in rooms
            for binding in room["channels"]
        }
        for key in [
            k for k in (*self._tasks, *self._offline)
            if bound.get(k) != self._reading.get(k)
        ]:
            self._drop_chat(key)

        for room in rooms:
            for binding in room["channels"]:
                key = (room["koop_id"], binding["platform"])
                if key in self._tasks or key in self._offline:
                    continue
                # A reader that gave up wrote 'error' and is not started again.
                # The alternative is a reconnect loop against a channel that
                # does not exist, and a status line that keeps promising it will
                # work. A paused chat keeps its reader, so resuming is instant.
                if binding["chat_state"] == "error":
                    continue
                self._start(room["koop_id"], binding)

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
        for key in list(self._tasks):
            self._cancel(key)
        for task in list(self._background):
            task.cancel()
        self._offline.clear()
        self._reading.clear()


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
