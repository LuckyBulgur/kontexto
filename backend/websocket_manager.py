"""WebSocket connection manager for duel real-time updates."""

import asyncio
import logging

from fastapi import WebSocket

from database import get_db
from duel import set_player_connected

logger = logging.getLogger(__name__)


class DuelConnectionManager:
    def __init__(self) -> None:
        self.connections: dict[str, dict[str, WebSocket]] = {}
        self._known_state: dict[str, dict[str, dict]] = {}

    async def connect(
        self, duel_id: str, player_token: str, websocket: WebSocket, db_path: str
    ) -> None:
        await websocket.accept()
        if duel_id not in self.connections:
            self.connections[duel_id] = {}
        self.connections[duel_id][player_token] = websocket

        db = await get_db(db_path)
        try:
            await set_player_connected(db, player_token, True)
        finally:
            await db.close()

    async def disconnect(self, duel_id: str, player_token: str, db_path: str) -> None:
        if duel_id in self.connections:
            self.connections[duel_id].pop(player_token, None)
            if not self.connections[duel_id]:
                del self.connections[duel_id]
                self._known_state.pop(duel_id, None)

        db = await get_db(db_path)
        try:
            await set_player_connected(db, player_token, False)
        finally:
            await db.close()

    async def broadcast(
        self, duel_id: str, message: dict, exclude_token: str | None = None
    ) -> None:
        if duel_id not in self.connections:
            return
        for token, ws in list(self.connections[duel_id].items()):
            if token == exclude_token:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                pass

    async def poll_and_broadcast(self, db_path: str) -> None:
        """Poll SQLite for changes and broadcast updates. Runs as background task."""
        while True:
            await asyncio.sleep(1)

            if not self.connections:
                self._known_state.clear()
                continue

            try:
                db = await get_db(db_path)
                try:
                    for duel_id in list(self.connections.keys()):
                        cursor = await db.execute(
                            "SELECT player_token, nickname, best_rank, guess_count, solved, connected "
                            "FROM duel_players WHERE duel_id = ?",
                            (duel_id,),
                        )
                        players = await cursor.fetchall()

                        prev = self._known_state.get(duel_id, {})
                        current = {}

                        for p in players:
                            token = p["player_token"]
                            state = {
                                "nickname": p["nickname"],
                                "best_rank": p["best_rank"],
                                "guess_count": p["guess_count"],
                                "solved": bool(p["solved"]),
                                "connected": bool(p["connected"]),
                            }
                            current[token] = state

                            old = prev.get(token)
                            if old is None:
                                await self.broadcast(
                                    duel_id,
                                    {"type": "player_joined", "nickname": p["nickname"]},
                                    exclude_token=token,
                                )
                            elif state["solved"] and not old.get("solved"):
                                await self.broadcast(
                                    duel_id,
                                    {
                                        "type": "player_solved",
                                        "nickname": p["nickname"],
                                        "guess_count": p["guess_count"],
                                    },
                                )
                            elif (
                                old.get("best_rank") != state["best_rank"]
                                or old.get("guess_count") != state["guess_count"]
                            ):
                                await self.broadcast(
                                    duel_id,
                                    {
                                        "type": "rank_update",
                                        "nickname": p["nickname"],
                                        "best_rank": p["best_rank"],
                                        "guess_count": p["guess_count"],
                                    },
                                    exclude_token=token,
                                )
                            elif old.get("connected") != state["connected"]:
                                msg_type = (
                                    "player_reconnected"
                                    if state["connected"]
                                    else "player_disconnected"
                                )
                                await self.broadcast(
                                    duel_id,
                                    {"type": msg_type, "nickname": p["nickname"]},
                                    exclude_token=token,
                                )

                        self._known_state[duel_id] = current
                finally:
                    await db.close()
            except Exception:
                logger.exception("Error in poll_and_broadcast")


manager = DuelConnectionManager()
