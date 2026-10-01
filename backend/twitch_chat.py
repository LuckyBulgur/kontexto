"""Reading a Twitch chat.

Twitch chat is IRC, it has a WebSocket endpoint, and it has an anonymous
read-only login, so there is no token to store, no app to register, no OAuth
redirect and no write path that could ever post as anybody:

    wss://irc-ws.chat.twitch.tv:443
    CAP REQ :twitch.tv/tags twitch.tv/commands
    NICK justinfan<random>
    JOIN #<channel>

``websockets`` comes in through ``uvicorn[standard]``, so nothing is added to
requirements.txt for this.

The anonymous login sees everything a chat shows: the ``badges`` tag on every
line, the ``bits`` tag on a cheer, and the USERNOTICE lines for subscriptions,
gifted subscriptions and sub bombs. Only a hype train or a channel points
redemption would need the streamer's own OAuth token, and neither is money a
viewer spends in the chat.

This module is only the reader: one connection to one channel, turning IRC lines
into ``live_chat.ChatMessage`` and ``live_chat.PaidEvent``. Which rooms get a reader, and what a message does
to a room, is ``live_ingest.py``, which runs in the single WS worker.
"""

from __future__ import annotations

import asyncio
import logging
import random

import websockets

import live_chat

logger = logging.getLogger(__name__)

IRC_URL = "wss://irc-ws.chat.twitch.tv:443"

_BACKOFF_START = 1.0
_BACKOFF_MAX = 60.0

# NOTICE ids that mean "this will never work", as opposed to the transient
# trouble a reconnect fixes. Retrying these forever would be a connection loop
# against Twitch and a status line that lies to the streamer.
_FATAL_NOTICES = {
    "msg_channel_suspended": "Dieser Kanal ist gesperrt",
    "msg_banned": "Der Zugriff auf diesen Chat ist gesperrt",
    "msg_room_not_found": "Diesen Kanal gibt es nicht",
    "tos_ban": "Dieser Kanal ist gesperrt",
}


class FatalChatError(Exception):
    """The channel cannot be read at all. Stop, do not reconnect."""


class TwitchChatReader:
    """One anonymous connection to one channel.

    ``on_message`` is awaited for every chat line; ``on_state`` is awaited when
    the connection comes up or gives up, so the host's status line has something
    truthful to show; ``on_event`` is awaited for every paid event and
    ``on_room`` once per join with the broadcaster id, which the badge pictures
    are looked up by.
    """

    def __init__(self, channel: str, connect=None) -> None:
        self.channel = channel
        self._folder = live_chat.GiftBombFolder()
        # Injected in tests, so the rules can be exercised against recorded IRC
        # lines without opening a socket.
        self._connect = connect or (lambda: websockets.connect(IRC_URL, ping_interval=None))

    async def _session(self, socket, on_message, on_event=None, on_room=None) -> None:
        on_event = on_event or _ignore
        on_room = on_room or _ignore
        await socket.send("CAP REQ :twitch.tv/tags twitch.tv/commands")
        await socket.send(f"NICK justinfan{random.randint(10000, 99999)}")  # nosec B311
        await socket.send(f"JOIN #{self.channel}")

        async for raw in socket:
            for line in str(raw).splitlines():
                if not line:
                    continue
                if line.startswith("PING"):
                    await socket.send("PONG :tmi.twitch.tv")
                    continue
                if " RECONNECT" in line or line.startswith("RECONNECT"):
                    # Twitch asks the client to move to another server. Not an
                    # error: drop the connection and let the backoff reopen it.
                    return
                if " NOTICE " in line:
                    fatal = self._fatal_notice(line)
                    if fatal:
                        raise FatalChatError(fatal)
                    continue
                if " ROOMSTATE " in line:
                    room_id = live_chat.parse_roomstate(line)
                    if room_id is not None:
                        await on_room(room_id)
                    continue
                event = live_chat.parse_twitch_event(line, self._folder)
                if event is not None:
                    await on_event(event)
                message = live_chat.parse_irc_line(line)
                if message is not None:
                    await on_message(message)

    @staticmethod
    def _fatal_notice(line: str) -> str | None:
        if not line.startswith("@"):
            return None
        raw_tags, _, _ = line[1:].partition(" ")
        msg_id = live_chat.parse_tags(raw_tags).get("msg-id", "")
        return _FATAL_NOTICES.get(msg_id)

    async def run(self, on_message, on_state, on_event=None, on_room=None) -> None:
        """Stay connected until cancelled, or until the channel is hopeless."""
        on_event = on_event or _ignore
        on_room = on_room or _ignore
        backoff = _BACKOFF_START
        while True:
            try:
                async with self._connect() as socket:
                    await on_state("live", None)
                    backoff = _BACKOFF_START
                    await self._session(socket, on_message, on_event, on_room)
            except asyncio.CancelledError:
                raise
            except FatalChatError as fatal:
                await on_state("error", str(fatal))
                return
            except Exception as exc:  # noqa: BLE001 - any transport failure retries
                logger.info("twitch chat %s disconnected: %s", self.channel, exc)
                await on_state("connecting", None)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, _BACKOFF_MAX)


async def _ignore(_value) -> None:
    """The default for a caller that only wants chat lines."""
