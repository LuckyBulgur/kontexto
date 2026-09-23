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

This module is only the reader: one connection to one channel, turning IRC lines
into ``live_chat.ChatMessage``. Which rooms get a reader, and what a message does
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
    truthful to show.
    """

    def __init__(self, channel: str, connect=None) -> None:
        self.channel = channel
        # Injected in tests, so the rules can be exercised against recorded IRC
        # lines without opening a socket.
        self._connect = connect or (lambda: websockets.connect(IRC_URL, ping_interval=None))

    async def _session(self, socket, on_message) -> None:
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

    async def run(self, on_message, on_state) -> None:
        """Stay connected until cancelled, or until the channel is hopeless."""
        backoff = _BACKOFF_START
        while True:
            try:
                async with self._connect() as socket:
                    await on_state("live", None)
                    backoff = _BACKOFF_START
                    await self._session(socket, on_message)
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
