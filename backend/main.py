"""FastAPI application for Kontexto game API."""

import asyncio
import os
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone

import aiosqlite
from fastapi import Depends, FastAPI, Header, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import analytics
import auth
from analytics_models import (
    AdminLoginRequest, AdminLoginResponse, BeaconRequest, BeaconResponse,
    BeaconTokenResponse,
)
from database import init_db, get_db
from duel import (
    create_duel, join_duel, get_duel_state, record_guess, record_tip,
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
from websocket_manager import manager as ws_manager, wordle_manager as wordle_ws_manager
from wordle import WordleState, evaluate, validate_hard_mode
from wordle_models import (
    WordleGuessRequest, WordleGuessResponse, WordleGameResponse,
    WordleRevealResponse, WordleCreateDuelRequest, WordleCreateDuelResponse,
    WordleJoinDuelRequest, WordleJoinDuelResponse, WordleDuelGuessRequest,
    WordleDuelStateResponse, WordleDuelHistoryResponse,
)
from wordle_duel import (
    create_wordle_duel, join_wordle_duel, record_wordle_guess,
    get_wordle_duel_state, get_wordle_player_history,
    cleanup_stale_wordle_duels,
)

_game_state: GameState | None = None
_db_path: str | None = None
_wordle_state: WordleState | None = None


def get_wordle_state() -> WordleState:
    if _wordle_state is None:
        raise RuntimeError("WordleState not initialized")
    return _wordle_state


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
    global _db_path, _wordle_state
    data_dir = os.environ.get("KONTEXTO_DATA_DIR", "data")
    _db_path = os.path.join(data_dir, "duels.db")
    await init_db(_db_path)

    wordle_dir = os.path.join(data_dir, "wordle")
    if os.path.isdir(wordle_dir):
        _wordle_state = WordleState(data_dir)

    tasks = []
    is_ws_mode = os.environ.get("KONTEXTO_WS_MODE")
    is_dev = os.environ.get("KONTEXTO_DEV")
    if is_ws_mode or is_dev:
        tasks.append(asyncio.create_task(ws_manager.poll_and_broadcast(_db_path)))
        tasks.append(asyncio.create_task(wordle_ws_manager.poll_and_broadcast(_db_path)))
        tasks.append(asyncio.create_task(_cleanup_loop()))

    yield

    for t in tasks:
        t.cancel()
    global _game_state
    _game_state = None
    _wordle_state = None


async def _cleanup_loop():
    """Run cleanup + analytics aggregation every 5 minutes (single WS worker)."""
    while True:
        await asyncio.sleep(300)
        try:
            db = await get_db(_db_path)
            try:
                await cleanup_stale_duels(db)
                await cleanup_stale_wordle_duels(db)
                await analytics.aggregate_daily(db)
                await analytics.prune_old_events(db)
            finally:
                await db.close()
        except Exception:
            pass


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _client_ip(request: Request) -> str:
    """Real client IP as seen by nginx (X-Real-IP / first X-Forwarded-For hop)."""
    real = request.headers.get("x-real-ip")
    if real:
        return real.strip()
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "0.0.0.0"


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
    await analytics.record_action(_db_path, "guesses", "kontexto", word=result["word"])
    if result["rank"] == 1:
        await analytics.record_action(_db_path, "solves", "kontexto")
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
    await analytics.record_action(_db_path, "hints", "kontexto")
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

    await analytics.record_action(_db_path, "reveals", "kontexto")
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
        await analytics.record_action(_db_path, "guesses", "duel", word=result["word"])
        if result["rank"] == 1:
            await analytics.record_action(_db_path, "solves", "duel")
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
    token: str = Query(...),
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

        await record_tip(db, duel_id, token, result["word"], result["rank"])
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


# --- Wordle single-player endpoints ---


@app.get("/api/wordle/game")
async def wordle_game(ws: WordleState = Depends(get_wordle_state)) -> WordleGameResponse:
    return WordleGameResponse(game_number=ws.get_game_number())


@app.post("/api/wordle/guess")
async def wordle_guess(
    req: WordleGuessRequest, ws: WordleState = Depends(get_wordle_state)
) -> WordleGuessResponse:
    word = req.word.lower().strip()
    if not ws.is_valid_word(word):
        return WordleGuessResponse(valid=False, error="not_in_word_list")
    if req.hard_mode and req.previous:
        previous = [(p.word.lower(), p.result) for p in req.previous]
        violation = validate_hard_mode(word, previous)
        if violation:
            return WordleGuessResponse(
                valid=False, error="hard_mode_violation", message=violation
            )
    solution = ws.get_solution(req.game_number)
    result = evaluate(word, solution)
    await analytics.record_action(_db_path, "guesses", "wordle")
    if word == solution:
        await analytics.record_action(_db_path, "solves", "wordle")
    return WordleGuessResponse(valid=True, result=result)


@app.get("/api/wordle/reveal")
async def wordle_reveal(
    game_number: int, ws: WordleState = Depends(get_wordle_state)
) -> WordleRevealResponse:
    await analytics.record_action(_db_path, "reveals", "wordle")
    return WordleRevealResponse(word=ws.get_solution(game_number))


# --- Wordle duel endpoints ---


@app.post("/api/wordle/duel")
async def wordle_create_duel(req: WordleCreateDuelRequest) -> WordleCreateDuelResponse:
    async with aiosqlite.connect(_db_path) as db:
        db.row_factory = aiosqlite.Row
        result = await create_wordle_duel(
            db, nickname=req.nickname, game_number=req.game_number
        )
    return WordleCreateDuelResponse(**result)


@app.post("/api/wordle/duel/{duel_id}/join")
async def wordle_join_duel(
    duel_id: str, req: WordleJoinDuelRequest
) -> WordleJoinDuelResponse:
    async with aiosqlite.connect(_db_path) as db:
        db.row_factory = aiosqlite.Row
        result = await join_wordle_duel(db, duel_id=duel_id, nickname=req.nickname)
    return WordleJoinDuelResponse(**result)


@app.get("/api/wordle/duel/{duel_id}")
async def wordle_duel_state(duel_id: str) -> WordleDuelStateResponse:
    async with aiosqlite.connect(_db_path) as db:
        db.row_factory = aiosqlite.Row
        state = await get_wordle_duel_state(db, duel_id)
    return WordleDuelStateResponse(**state)


@app.post("/api/wordle/duel/{duel_id}/guess")
async def wordle_duel_guess(
    duel_id: str,
    req: WordleDuelGuessRequest,
    ws: WordleState = Depends(get_wordle_state),
) -> WordleGuessResponse:
    word = req.word.lower().strip()
    if not ws.is_valid_word(word):
        return WordleGuessResponse(valid=False, error="not_in_word_list")
    async with aiosqlite.connect(_db_path) as db:
        db.row_factory = aiosqlite.Row
        state = await get_wordle_duel_state(db, duel_id)
        solution = ws.get_solution(state["game_number"])
        result = evaluate(word, solution)
        await record_wordle_guess(
            db,
            duel_id=duel_id,
            player_token=req.player_token,
            word=word,
            result=result,
        )
    await analytics.record_action(_db_path, "guesses", "duel")
    if word == solution:
        await analytics.record_action(_db_path, "solves", "duel")
    return WordleGuessResponse(valid=True, result=result)


@app.get("/api/wordle/duel/{duel_id}/history")
async def wordle_duel_history(
    duel_id: str, token: str
) -> WordleDuelHistoryResponse:
    async with aiosqlite.connect(_db_path) as db:
        db.row_factory = aiosqlite.Row
        guesses = await get_wordle_player_history(db, duel_id, token)
    return WordleDuelHistoryResponse(guesses=guesses)


@app.websocket("/ws/wordle/duel/{duel_id}")
async def wordle_duel_websocket(
    websocket: WebSocket, duel_id: str, token: str = Query(...)
):
    async with aiosqlite.connect(_db_path) as db:
        db.row_factory = aiosqlite.Row
        try:
            state = await get_wordle_duel_state(db, duel_id)
        except ValueError:
            await websocket.close(code=4004)
            return

    await wordle_ws_manager.connect(duel_id, token, websocket, _db_path)
    await websocket.send_json({"type": "state", "players": state["players"]})

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await wordle_ws_manager.disconnect(duel_id, token, _db_path)


# --- Analytics (pageview beacon) ---------------------------------------------


@app.get("/api/collect/token", response_model=BeaconTokenResponse)
async def collect_token(request: Request):
    """Issue a short-lived, IP-bound beacon token for the requesting client."""
    now = _now()
    fp = analytics.compute_fingerprint(_client_ip(request), request.headers.get("user-agent", ""), now)
    return {"token": analytics.make_beacon_token(fp, now)}


@app.post("/api/collect", response_model=BeaconResponse)
async def collect(req: BeaconRequest, request: Request):
    """Record a pageview beacon. Identity/device/geo are derived server-side."""
    db = await get_db(_db_path)
    try:
        accepted, _reason = await analytics.record_pageview(
            db,
            ip=_client_ip(request),
            user_agent=request.headers.get("user-agent", ""),
            referrer=req.referrer or request.headers.get("referer"),
            page=req.page,
            token=req.token,
            now=_now(),
        )
        return {"ok": accepted}
    finally:
        await db.close()


# --- Admin (TOTP-protected statistics dashboard) -----------------------------

_login_attempts: dict[str, list[float]] = defaultdict(list)
_LOGIN_MAX = 10
_LOGIN_WINDOW = 300  # seconds


def _login_rate_limited(ip: str) -> bool:
    now = time.time()
    attempts = [t for t in _login_attempts[ip] if now - t < _LOGIN_WINDOW]
    attempts.append(now)
    _login_attempts[ip] = attempts
    return len(attempts) > _LOGIN_MAX


@app.post("/api/admin/login", response_model=AdminLoginResponse)
async def admin_login(req: AdminLoginRequest, request: Request):
    if _login_rate_limited(_client_ip(request)):
        return JSONResponse(status_code=429, content={"error": "rate_limited", "message": "Zu viele Versuche"})
    if not auth.verify_totp(req.code):
        return JSONResponse(status_code=401, content={"error": "invalid_code", "message": "Code ungültig"})
    return {"token": auth.issue_session_token()}


@app.get("/api/admin/stats")
async def admin_stats(authorization: str = Header(default="")):
    token = authorization[7:] if authorization.lower().startswith("bearer ") else authorization
    if not auth.verify_session_token(token):
        return JSONResponse(status_code=401, content={"error": "unauthorized", "message": "Nicht autorisiert"})
    db = await get_db(_db_path)
    try:
        return await analytics.get_stats(db, _now())
    finally:
        await db.close()
