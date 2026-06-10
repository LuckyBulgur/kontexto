"""WebSocket connection manager for duel real-time updates."""

import asyncio
import json
import logging

from fastapi import WebSocket

from database import get_db
from duel import set_player_connected
from koop import (
    get_koop_guesses,
    set_player_connected as set_koop_player_connected,
)
from wordle_duel import get_wordle_player_history, set_wordle_player_connected

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
                            "SELECT player_token, nickname, best_rank, guess_count, tip_count, solved, connected "
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
                                "tip_count": p["tip_count"],
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
                                        "tip_count": p["tip_count"],
                                    },
                                )
                            elif (
                                old.get("best_rank") != state["best_rank"]
                                or old.get("guess_count") != state["guess_count"]
                                or old.get("tip_count") != state["tip_count"]
                            ):
                                await self.broadcast(
                                    duel_id,
                                    {
                                        "type": "rank_update",
                                        "nickname": p["nickname"],
                                        "best_rank": p["best_rank"],
                                        "guess_count": p["guess_count"],
                                        "tip_count": p["tip_count"],
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


class WordleDuelConnectionManager:
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
            await set_wordle_player_connected(db, duel_id, player_token, True)
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
            await set_wordle_player_connected(db, duel_id, player_token, False)
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
                            "SELECT player_token, nickname, guesses_used, solved, connected "
                            "FROM wordle_duel_players WHERE duel_id = ?",
                            (duel_id,),
                        )
                        players = await cursor.fetchall()

                        prev = self._known_state.get(duel_id, {})
                        current = {}

                        for p in players:
                            token = p["player_token"]
                            state = {
                                "nickname": p["nickname"],
                                "guesses_used": p["guesses_used"],
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
                                continue

                            # New guesses: broadcast each new row with its colours.
                            old_used = old.get("guesses_used", 0)
                            if state["guesses_used"] > old_used:
                                history = await get_wordle_player_history(
                                    db, duel_id, token
                                )
                                for idx in range(old_used, state["guesses_used"]):
                                    if idx >= len(history):
                                        break
                                    await self.broadcast(
                                        duel_id,
                                        {
                                            "type": "guess_made",
                                            "nickname": p["nickname"],
                                            "guess_number": idx + 1,
                                            "result": history[idx]["result"],
                                        },
                                        exclude_token=token,
                                    )

                            # Solved / failed are additional notifications.
                            if state["solved"] and not old.get("solved"):
                                await self.broadcast(
                                    duel_id,
                                    {
                                        "type": "player_solved",
                                        "nickname": p["nickname"],
                                        "guesses_used": p["guesses_used"],
                                    },
                                )
                            elif (
                                not state["solved"]
                                and state["guesses_used"] >= 6
                                and old_used < 6
                            ):
                                await self.broadcast(
                                    duel_id,
                                    {
                                        "type": "player_failed",
                                        "nickname": p["nickname"],
                                    },
                                )

                            if old.get("connected") != state["connected"]:
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
                logger.exception("Error in wordle poll_and_broadcast")


wordle_manager = WordleDuelConnectionManager()


class KoopConnectionManager:
    """Real-time broadcast for cooperative Kontexto.

    The mutable shared state is the de-duplicated guess list plus the team's
    solved flag, so the poll loop diffs the guess feed (by max id) and the
    koops.solved transition — not per-player ranks like the duel.
    """

    def __init__(self) -> None:
        self.connections: dict[str, dict[str, WebSocket]] = {}
        # koop_id -> {"last_guess_id": int, "solved": bool, "players": {token: connected}}
        self._known_state: dict[str, dict] = {}

    async def connect(
        self, koop_id: str, player_token: str, websocket: WebSocket, db_path: str
    ) -> None:
        await websocket.accept()
        if koop_id not in self.connections:
            self.connections[koop_id] = {}
        self.connections[koop_id][player_token] = websocket

        db = await get_db(db_path)
        try:
            await set_koop_player_connected(db, player_token, True)
        finally:
            await db.close()

    async def disconnect(self, koop_id: str, player_token: str, db_path: str) -> None:
        if koop_id in self.connections:
            self.connections[koop_id].pop(player_token, None)
            if not self.connections[koop_id]:
                del self.connections[koop_id]
                self._known_state.pop(koop_id, None)

        db = await get_db(db_path)
        try:
            await set_koop_player_connected(db, player_token, False)
        finally:
            await db.close()

    async def broadcast(
        self, koop_id: str, message: dict, exclude_token: str | None = None
    ) -> None:
        if koop_id not in self.connections:
            return
        for token, ws in list(self.connections[koop_id].items()):
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
                    for koop_id in list(self.connections.keys()):
                        await self._poll_one(db, koop_id)
                finally:
                    await db.close()
            except Exception:
                logger.exception("Error in koop poll_and_broadcast")

    async def _poll_one(self, db, koop_id: str) -> None:
        prev = self._known_state.get(koop_id)

        # First sighting: seed last_guess_id with the current MAX so the existing
        # list is not replayed to a freshly connected client as guess_added.
        if prev is None:
            cursor = await db.execute(
                "SELECT COALESCE(MAX(id), 0) AS max_id FROM koop_guesses WHERE koop_id = ?",
                (koop_id,),
            )
            row = await cursor.fetchone()
            cursor = await db.execute(
                "SELECT solved FROM koops WHERE id = ?", (koop_id,)
            )
            koop = await cursor.fetchone()
            cursor = await db.execute(
                "SELECT player_token, connected FROM koop_players WHERE koop_id = ?",
                (koop_id,),
            )
            players = {p["player_token"]: bool(p["connected"]) for p in await cursor.fetchall()}
            self._known_state[koop_id] = {
                "last_guess_id": row["max_id"],
                "solved": bool(koop["solved"]) if koop else False,
                "players": players,
            }
            return

        # New shared guesses since the last poll → broadcast each (excluding the
        # author, who already has it from the REST response).
        cursor = await db.execute(
            "SELECT id, player_token, nickname, word, rank, is_tip FROM koop_guesses "
            "WHERE koop_id = ? AND id > ? ORDER BY id",
            (koop_id, prev["last_guess_id"]),
        )
        for g in await cursor.fetchall():
            await self.broadcast(
                koop_id,
                {
                    "type": "guess_added",
                    "nickname": g["nickname"],
                    "word": g["word"],
                    "rank": g["rank"],
                    "is_tip": bool(g["is_tip"]),
                },
                exclude_token=g["player_token"],
            )
            prev["last_guess_id"] = g["id"]

        # Team solved transition.
        cursor = await db.execute(
            "SELECT solved, solved_by FROM koops WHERE id = ?", (koop_id,)
        )
        koop = await cursor.fetchone()
        if koop and bool(koop["solved"]) and not prev["solved"]:
            cursor = await db.execute(
                "SELECT word FROM koop_guesses WHERE koop_id = ? AND rank = 1 LIMIT 1",
                (koop_id,),
            )
            row = await cursor.fetchone()
            await self.broadcast(
                koop_id,
                {
                    "type": "koop_solved",
                    "nickname": koop["solved_by"],
                    "word": row["word"] if row else None,
                },
            )
            prev["solved"] = True

        # Player join / connection-state changes.
        cursor = await db.execute(
            "SELECT player_token, nickname, connected FROM koop_players WHERE koop_id = ?",
            (koop_id,),
        )
        current_players: dict[str, bool] = {}
        for p in await cursor.fetchall():
            token = p["player_token"]
            connected = bool(p["connected"])
            current_players[token] = connected
            old = prev["players"].get(token)
            if old is None:
                await self.broadcast(
                    koop_id,
                    {"type": "player_joined", "nickname": p["nickname"]},
                    exclude_token=token,
                )
            elif old != connected:
                await self.broadcast(
                    koop_id,
                    {
                        "type": "player_reconnected" if connected else "player_disconnected",
                        "nickname": p["nickname"],
                    },
                    exclude_token=token,
                )
        prev["players"] = current_players


koop_manager = KoopConnectionManager()
