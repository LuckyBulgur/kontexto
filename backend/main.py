"""FastAPI application for Kontexto game API."""

import asyncio
import os
from contextlib import asynccontextmanager
from datetime import date, timedelta

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from database import init_db, get_db
from duel import (
    create_duel, join_duel, get_duel_state, record_guess,
    get_player_history, get_player_info, cleanup_stale_duels,
    set_player_connected,
)
from game import GameState
from models import (
    GuessRequest, GuessResponse, TipResponse, GameInfoResponse,
    RevealResponse, PastGamesResponse, ClosestWordsResponse,
    CreateDuelRequest, CreateDuelResponse, JoinDuelRequest,
    JoinDuelResponse, DuelStateResponse, DuelGuessRequest,
    DuelGuessHistoryResponse,
)
from websocket_manager import manager as ws_manager

_game_state: GameState | None = None
_db_path: str | None = None


def _get_game_state() -> GameState:
    global _game_state
    if _game_state is None:
        data_dir = os.environ.get("KONTEXTO_DATA_DIR", "data")
        _game_state = GameState(data_dir)
    return _game_state


def _get_current_game_number() -> int:
    gs = _get_game_state()
    forced = os.environ.get("KONTEXTO_FORCE_GAME")
    if forced:
        return int(forced)
    return gs.get_game_number()


def _resolve_game_number(game: int | None) -> int:
    """Resolve game number: None means today's game, otherwise validate."""
    if game is None:
        return _get_current_game_number()
    gs = _get_game_state()
    total = gs.metadata.get("total_games", len(gs.target_words))
    if game < 1 or game > total:
        raise ValueError(f"Spiel {game} existiert nicht (1-{total})")
    # Check that the game date is in the past
    game_date = gs.start_date + timedelta(days=game - 1)
    if game_date >= date.today():
        raise ValueError(f"Spiel {game} ist noch nicht verfügbar")
    return game


@asynccontextmanager
async def lifespan(app: FastAPI):
    _get_game_state()
    global _db_path
    data_dir = os.environ.get("KONTEXTO_DATA_DIR", "data")
    _db_path = os.path.join(data_dir, "duels.db")
    await init_db(_db_path)

    tasks = []
    if os.environ.get("KONTEXTO_WS_MODE"):
        tasks.append(asyncio.create_task(ws_manager.poll_and_broadcast(_db_path)))
        tasks.append(asyncio.create_task(_cleanup_loop()))

    yield

    for t in tasks:
        t.cancel()
    global _game_state
    _game_state = None


async def _cleanup_loop():
    """Run cleanup every 5 minutes."""
    while True:
        await asyncio.sleep(300)
        try:
            db = await get_db(_db_path)
            try:
                await cleanup_stale_duels(db)
            finally:
                await db.close()
        except Exception:
            pass


app = FastAPI(title="Kontexto API", lifespan=lifespan)

if os.environ.get("KONTEXTO_DEV"):
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.post("/api/guess", response_model=GuessResponse)
async def guess(req: GuessRequest, game: int | None = Query(None)):
    gs = _get_game_state()
    try:
        game_num = _resolve_game_number(game)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": "invalid_game", "message": str(e)})
    gs.load_game(game_num)

    if gs.is_stopword(req.word):
        return JSONResponse(
            status_code=422,
            content={"error": "stopword", "message": "Dieses Wort zählt nicht – es ist zu allgemein"},
        )

    result = gs.guess(req.word, game_num)
    if result is None:
        return JSONResponse(
            status_code=404,
            content={"error": "unknown_word", "message": "Wort nicht im Wörterbuch"},
        )
    return result


@app.get("/api/tip", response_model=TipResponse)
async def tip(
    difficulty: str = Query("easy", pattern="^(easy|medium|hard)$"),
    best_rank: int = Query(1000, ge=1),
    game: int | None = Query(None),
    guessed_ranks: str = Query(""),
):
    gs = _get_game_state()
    try:
        game_num = _resolve_game_number(game)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": "invalid_game", "message": str(e)})
    gs.load_game(game_num)

    parsed_ranks = [int(r) for r in guessed_ranks.split(",") if r.strip().isdigit()]
    result = gs.get_tip(game_number=game_num, difficulty=difficulty, best_rank=best_rank, guessed_ranks=parsed_ranks)
    if result is None:
        return JSONResponse(
            status_code=404,
            content={"error": "no_tip", "message": "Kein Tipp verfügbar"},
        )
    return result


@app.get("/api/game", response_model=GameInfoResponse)
async def game_info():
    gs = _get_game_state()
    game_num = _get_current_game_number()

    return {
        "gameNumber": game_num,
        "date": date.today().isoformat(),
        "total": gs.metadata["vocab_size"],
    }


@app.get("/api/games", response_model=PastGamesResponse)
async def past_games():
    gs = _get_game_state()
    today_game = _get_current_game_number()
    yesterday = date.today() - timedelta(days=1)
    games = []
    current = yesterday
    while current >= gs.start_date:
        game_num = gs.get_game_number(current)
        games.append({"gameNumber": game_num, "date": current.isoformat()})
        current -= timedelta(days=1)
    return {"games": games, "todayGame": today_game}


@app.get("/api/reveal", response_model=RevealResponse)
async def reveal(game: int | None = Query(None)):
    gs = _get_game_state()
    try:
        game_num = _resolve_game_number(game)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": "invalid_game", "message": str(e)})

    return {"word": gs.get_target_word(game_num)}


@app.get("/api/closest", response_model=ClosestWordsResponse)
async def closest_words(game: int | None = Query(None)):
    gs = _get_game_state()
    try:
        game_num = _resolve_game_number(game)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": "invalid_game", "message": str(e)})
    gs.load_game(game_num)

    return {"words": gs.get_closest_words(game_num), "gameNumber": game_num}


# --- Duel endpoints ---

@app.post("/api/duel", response_model=CreateDuelResponse)
async def create_duel_endpoint(req: CreateDuelRequest):
    gs = _get_game_state()
    total = gs.metadata.get("total_games", len(gs.target_words))
    if req.game_number < 1 or req.game_number > total:
        return JSONResponse(
            status_code=400,
            content={"error": "invalid_game", "message": f"Spiel {req.game_number} existiert nicht"},
        )
    db = await get_db(_db_path)
    try:
        result = await create_duel(db, req.game_number, req.nickname, req.tips_allowed)
        return result
    finally:
        await db.close()


@app.post("/api/duel/{duel_id}/join", response_model=JoinDuelResponse)
async def join_duel_endpoint(duel_id: str, req: JoinDuelRequest):
    db = await get_db(_db_path)
    try:
        result = await join_duel(db, duel_id, req.nickname)
        if result is None:
            return JSONResponse(
                status_code=404,
                content={"error": "duel_not_found", "message": "Duell nicht gefunden"},
            )
        return result
    finally:
        await db.close()


@app.get("/api/duel/player-info")
async def duel_player_info(token: str = Query(...)):
    db = await get_db(_db_path)
    try:
        info = await get_player_info(db, token)
        if info is None:
            return JSONResponse(status_code=404, content={"error": "player_not_found"})
        return info
    finally:
        await db.close()


@app.get("/api/duel/{duel_id}", response_model=DuelStateResponse)
async def get_duel_state_endpoint(duel_id: str):
    db = await get_db(_db_path)
    try:
        state = await get_duel_state(db, duel_id)
        if state is None:
            return JSONResponse(
                status_code=404,
                content={"error": "duel_not_found", "message": "Duell nicht gefunden"},
            )
        return state
    finally:
        await db.close()


@app.post("/api/duel/{duel_id}/guess", response_model=GuessResponse)
async def duel_guess_endpoint(duel_id: str, req: DuelGuessRequest):
    db = await get_db(_db_path)
    try:
        state = await get_duel_state(db, duel_id)
        if state is None:
            return JSONResponse(
                status_code=404,
                content={"error": "duel_not_found", "message": "Duell nicht gefunden"},
            )
        game_num = state["game_number"]
        gs = _get_game_state()
        gs.load_game(game_num)

        if gs.is_stopword(req.word):
            return JSONResponse(
                status_code=422,
                content={"error": "stopword", "message": "Dieses Wort zahlt nicht -- es ist zu allgemein"},
            )

        result = gs.guess(req.word, game_num)
        if result is None:
            return JSONResponse(
                status_code=404,
                content={"error": "unknown_word", "message": "Wort nicht im Worterbuch"},
            )

        await record_guess(db, duel_id, req.player_token, result["word"], result["rank"])
        return result
    finally:
        await db.close()


@app.get("/api/duel/{duel_id}/history", response_model=DuelGuessHistoryResponse)
async def duel_history_endpoint(duel_id: str, token: str = Query(...)):
    db = await get_db(_db_path)
    try:
        history = await get_player_history(db, duel_id, token)
        return {"guesses": history}
    finally:
        await db.close()


@app.get("/api/duel/{duel_id}/tip", response_model=TipResponse)
async def duel_tip_endpoint(
    duel_id: str,
    difficulty: str = Query("easy", pattern="^(easy|medium|hard)$"),
    best_rank: int = Query(1000, ge=1),
    guessed_ranks: str = Query(""),
):
    db = await get_db(_db_path)
    try:
        state = await get_duel_state(db, duel_id)
        if state is None:
            return JSONResponse(
                status_code=404,
                content={"error": "duel_not_found", "message": "Duell nicht gefunden"},
            )
        if not state["tips_allowed"]:
            return JSONResponse(
                status_code=403,
                content={"error": "tips_disabled", "message": "Tipps sind in diesem Duell deaktiviert"},
            )
        game_num = state["game_number"]
        gs = _get_game_state()
        gs.load_game(game_num)

        parsed_ranks = [int(r) for r in guessed_ranks.split(",") if r.strip().isdigit()]
        result = gs.get_tip(game_number=game_num, difficulty=difficulty, best_rank=best_rank, guessed_ranks=parsed_ranks)
        if result is None:
            return JSONResponse(
                status_code=404,
                content={"error": "no_tip", "message": "Kein Tipp verfugbar"},
            )
        return result
    finally:
        await db.close()


@app.websocket("/ws/duel/{duel_id}")
async def duel_websocket(websocket: WebSocket, duel_id: str, token: str = Query(...)):
    db = await get_db(_db_path)
    try:
        state = await get_duel_state(db, duel_id)
    finally:
        await db.close()

    if state is None:
        await websocket.close(code=4004)
        return

    await ws_manager.connect(duel_id, token, websocket, _db_path)
    await websocket.send_json({"type": "state", "players": state["players"]})

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await ws_manager.disconnect(duel_id, token, _db_path)
