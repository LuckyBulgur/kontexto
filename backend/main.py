"""FastAPI application for Kontexto game API."""

import asyncio
import json
import logging
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
    AdminSessionResponse, BeaconRequest, BeaconResponse, BeaconTokenResponse,
    CompletionRequest, RegisterOptionsRequest, RegisterVerifyRequest,
    WebAuthnVerifyRequest,
)
from database import init_db, get_db
from server_secret import server_secret
from duel import (
    create_duel, join_duel, get_duel_state, record_guess, record_tip,
    get_player_history, get_player_info, cleanup_stale_duels,
    set_player_connected,
)
from game import GameState
from models import (
    GuessRequest, GuessResponse, TipResponse, GameInfoResponse,
    RevealResponse, PastGamesResponse, ClosestWordsResponse,
    InfiniteNextResponse,
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

logger = logging.getLogger(__name__)

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


def _resolve_game_number(game: int | None, *, infinite: bool = False) -> int:
    """Resolve game number: None means today's game, otherwise validate.

    In infinite mode the date gate is skipped: any pre-computed game in the
    pool (1..total_games) is playable on demand, independent of the daily
    schedule. The only game the caller must never hand out this way is today's
    daily — that exclusion is enforced where the next game is selected
    (``/api/infinite/next``), not here.
    """
    if game is None:
        return _get_current_game_number()
    gs = _get_game_state()
    total = gs.metadata.get("total_games", len(gs.target_words))
    if game < 1 or game > total:
        raise ValueError(f"Spiel {game} existiert nicht (1-{total})")
    if infinite:
        return game
    # Check that the game date is in the past
    game_date = gs.start_date + timedelta(days=game - 1)
    if game_date >= date.today():
        raise ValueError(f"Spiel {game} ist noch nicht verfügbar")
    return game


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fail-closed: refuse to boot without a real secret (prod). A dev fallback is
    # only honoured when KONTEXTO_DEV is set; see server_secret.server_secret.
    server_secret()
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
        # Exactly one worker (KONTEXTO_WS_MODE) runs analytics aggregation/pruning.
        # Log it so a misconfiguration where it runs nowhere — rollups never built,
        # raw events never pruned — is immediately visible at startup.
        logger.info("analytics aggregation + cleanup loop active in this worker")

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
            logger.exception("cleanup/analytics aggregation cycle failed")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _client_ip(request: Request) -> str:
    """Real, non-spoofable client IP behind the Caddy->nginx proxy chain.

    Resolved from the trusted hop of X-Forwarded-For; client-supplied left-hand
    entries are ignored. See analytics.client_ip_from_headers for details.
    """
    return analytics.client_ip_from_headers(
        request.headers.get("x-forwarded-for"),
        request.headers.get("x-real-ip"),
        request.client.host if request.client else None,
    )


app = FastAPI(title="Kontexto API", lifespan=lifespan)

if os.environ.get("KONTEXTO_DEV"):
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.post("/api/guess", response_model=GuessResponse)
async def guess(req: GuessRequest, game: int | None = Query(None), infinite: bool = Query(False)):
    gs = _get_game_state()
    try:
        game_num = _resolve_game_number(game, infinite=infinite)
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
    mode = "infinite" if infinite else "kontexto"
    await analytics.record_action(_db_path, "guesses", mode, word=result["word"])
    await analytics.record_game_stat(_db_path, mode, game_num, "guesses")
    if result["rank"] == 1:
        await analytics.record_action(_db_path, "solves", mode)
        await analytics.record_game_stat(_db_path, mode, game_num, "solves")
    return result


@app.get("/api/tip", response_model=TipResponse)
async def tip(
    difficulty: str = Query("easy", pattern="^(easy|medium|hard)$"),
    best_rank: int = Query(1000, ge=1),
    game: int | None = Query(None),
    guessed_ranks: str = Query(""),
    infinite: bool = Query(False),
):
    gs = _get_game_state()
    try:
        game_num = _resolve_game_number(game, infinite=infinite)
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
    await analytics.record_action(_db_path, "hints", difficulty)
    await analytics.record_game_stat(_db_path, "infinite" if infinite else "kontexto", game_num, "hints")
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


@app.get("/api/infinite/next", response_model=InfiniteNextResponse)
async def infinite_next(exclude: str = Query(""), current: int | None = Query(None)):
    """Pick the next game for the endless mode.

    Draws a uniformly random game from the full pre-computed pool, always
    skipping today's daily game (so the endless session can never spoil the
    daily) and the game the player is currently on. ``exclude`` is the
    comma-separated list of games already finished this session, used to avoid
    repeats until the pool is exhausted; once every game has been played the
    exclusion is relaxed back to just the daily + current game so the mode truly
    never ends.
    """
    gs = _get_game_state()
    daily = _get_current_game_number()

    base_exclude: set[int] = {daily}
    if current is not None:
        base_exclude.add(current)

    played = {int(p) for p in exclude.split(",") if p.strip().lstrip("-").isdigit()}
    chosen = gs.random_game_number(base_exclude | played)
    if chosen is None:
        # Pool exhausted for this session — relax to allow already-played games
        # again, still never the daily or the current game.
        chosen = gs.random_game_number(base_exclude)
    if chosen is None:
        return JSONResponse(
            status_code=404,
            content={"error": "no_games", "message": "Keine weiteren Spiele verfügbar"},
        )

    return {
        "gameNumber": chosen,
        "total": gs.metadata["vocab_size"],
        "totalGames": gs.total_games(),
    }


@app.get("/api/reveal", response_model=RevealResponse)
async def reveal(game: int | None = Query(None), infinite: bool = Query(False)):
    gs = _get_game_state()
    try:
        game_num = _resolve_game_number(game, infinite=infinite)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": "invalid_game", "message": str(e)})

    mode = "infinite" if infinite else "kontexto"
    await analytics.record_action(_db_path, "reveals", mode)
    await analytics.record_game_stat(_db_path, mode, game_num, "reveals")
    return {"word": gs.get_target_word(game_num)}


@app.get("/api/closest", response_model=ClosestWordsResponse)
async def closest_words(game: int | None = Query(None), infinite: bool = Query(False)):
    gs = _get_game_state()
    try:
        game_num = _resolve_game_number(game, infinite=infinite)
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
        await analytics.record_action(_db_path, "duels_created", "kontexto")
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
        await analytics.record_game_stat(_db_path, "duel", game_num, "guesses")
        if result["rank"] == 1:
            await analytics.record_action(_db_path, "solves", "duel")
            await analytics.record_game_stat(_db_path, "duel", game_num, "solves")
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
    await analytics.record_action(_db_path, "duels_created", "wordle")
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


@app.post("/api/stats/complete", response_model=BeaconResponse)
async def stats_complete(req: CompletionRequest, request: Request):
    """Record a client-reported game completion (distribution histograms only).

    Token-gated, deduplicated and clamped server-side. Never touches the
    authoritative solve/reveal counters, which are incremented from the real
    game handlers.
    """
    db = await get_db(_db_path)
    try:
        accepted, _reason = await analytics.record_completion(
            db,
            ip=_client_ip(request),
            user_agent=request.headers.get("user-agent", ""),
            token=req.token,
            mode=req.mode,
            game_number=req.game_number,
            outcome=req.outcome,
            guesses=req.guesses,
            tips=req.tips,
            duration_seconds=req.duration_seconds,
            best_rank=req.best_rank,
            now=_now(),
        )
        return {"ok": accepted}
    finally:
        await db.close()


# --- Admin (WebAuthn/passkey-protected statistics dashboard) -----------------

# Per-IP failed-login tracking (in-memory fast path; keyed on the trustworthy IP).
_login_failures_by_ip: dict[str, list[float]] = defaultdict(list)
_LOGIN_IP_FAIL_MAX = 8
_LOGIN_FAIL_WINDOW = 600  # seconds


def _login_ip_blocked(ip: str) -> bool:
    now = time.time()
    fails = [t for t in _login_failures_by_ip[ip] if now - t < _LOGIN_FAIL_WINDOW]
    _login_failures_by_ip[ip] = fails
    return len(fails) >= _LOGIN_IP_FAIL_MAX


def _record_login_ip_failure(ip: str) -> None:
    _login_failures_by_ip[ip].append(time.time())


def _rate_limited_response():
    return JSONResponse(status_code=429, content={"error": "rate_limited", "message": "Zu viele Versuche"})


async def _login_throttled(db, ip: str) -> bool:
    """True if this IP or the global failure backstop is currently tripped."""
    if _login_ip_blocked(ip):
        return True
    return await analytics.login_failures(db, _now()) >= analytics.GLOBAL_LOGIN_FAIL_MAX


@app.post("/api/admin/webauthn/login/options")
async def webauthn_login_options(request: Request):
    ip = _client_ip(request)
    db = await get_db(_db_path)
    try:
        if await _login_throttled(db, ip):
            return _rate_limited_response()
        stored = await auth.get_credential(db)
        if not stored:
            return JSONResponse(status_code=404, content={"error": "no_credential", "message": "Kein Passkey registriert"})
        options_json, challenge = auth.authentication_options(stored)
        return {"options": json.loads(options_json), "challengeToken": auth.make_challenge_token(challenge, "auth")}
    finally:
        await db.close()


@app.post("/api/admin/webauthn/login/verify", response_model=AdminSessionResponse)
async def webauthn_login_verify(req: WebAuthnVerifyRequest, request: Request):
    ip = _client_ip(request)
    db = await get_db(_db_path)
    try:
        if await _login_throttled(db, ip):
            return _rate_limited_response()
        challenge = auth.verify_challenge_token(req.challenge_token, "auth")
        stored = await auth.get_credential(db)
        if challenge and stored:
            try:
                new_count = auth.verify_authentication(req.credential, challenge, stored)
                await auth.update_sign_count(db, stored["credential_id"], new_count)
                return {"token": auth.issue_session_token()}
            except Exception:
                pass
        # Failed: record against both the per-IP and the global counters.
        _record_login_ip_failure(ip)
        await analytics.record_login_failure(db, _now())
        return JSONResponse(status_code=401, content={"error": "auth_failed", "message": "Anmeldung fehlgeschlagen"})
    finally:
        await db.close()


@app.post("/api/admin/webauthn/register/options")
async def webauthn_register_options(req: RegisterOptionsRequest):
    if not auth.enroll_token_valid(req.enroll_token):
        return JSONResponse(status_code=403, content={"error": "forbidden", "message": "Registrierung gesperrt"})
    options_json, challenge = auth.registration_options()
    return {"options": json.loads(options_json), "challengeToken": auth.make_challenge_token(challenge, "reg")}


@app.post("/api/admin/webauthn/register/verify")
async def webauthn_register_verify(req: RegisterVerifyRequest):
    if not auth.enroll_token_valid(req.enroll_token):
        return JSONResponse(status_code=403, content={"error": "forbidden", "message": "Registrierung gesperrt"})
    challenge = auth.verify_challenge_token(req.challenge_token, "reg")
    if not challenge:
        return JSONResponse(status_code=400, content={"error": "bad_challenge", "message": "Challenge abgelaufen"})
    db = await get_db(_db_path)
    try:
        try:
            cred = auth.verify_registration(req.credential, challenge)
        except Exception:
            return JSONResponse(status_code=400, content={"error": "registration_failed", "message": "Registrierung fehlgeschlagen"})
        await auth.replace_credential(
            db, credential_id=cred["credential_id"], public_key=cred["public_key"],
            sign_count=cred["sign_count"])
        return {"ok": True}
    finally:
        await db.close()


@app.get("/api/admin/stats")
async def admin_stats(authorization: str = Header(default="")):
    token = authorization[7:] if authorization.lower().startswith("bearer ") else authorization
    if not auth.verify_session_token(token):
        return JSONResponse(status_code=401, content={"error": "unauthorized", "message": "Nicht autorisiert"})
    db = await get_db(_db_path)
    try:
        stats = await analytics.get_stats(db, _now())
    finally:
        await db.close()

    # Enrich per-game difficulty with the real target word (admin-only) and trim
    # to the hardest/easiest Kontexto words with enough finished games to matter.
    gs = _get_game_state()
    raw = stats.pop("game_difficulty", [])
    enriched = []
    for g in raw:
        if g["mode"] != "kontexto" or (g.get("finished") or 0) < 3 or g["solve_rate"] is None:
            continue
        try:
            word = gs.get_target_word(g["game_number"])
        except ValueError:
            continue
        enriched.append({**g, "word": word})
    stats["game_difficulty"] = {
        "hardest": sorted(enriched, key=lambda g: (g["solve_rate"], -g["finished"]))[:12],
        "easiest": sorted(enriched, key=lambda g: (-g["solve_rate"], -g["finished"]))[:12],
    }
    return stats
