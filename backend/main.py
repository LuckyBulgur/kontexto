"""FastAPI application for Kontexto game API."""

import asyncio
import json
import logging
import os
import secrets
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone

import aiosqlite
from fastapi import Depends, FastAPI, Header, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

import analytics
import auth
import creator_spot
from analytics_models import (
    AdminSessionResponse, BeaconRequest, BeaconResponse, BeaconTokenResponse,
    CompletionRequest, HeartbeatRequest, LiveStatsResponse,
    RegisterOptionsRequest, RegisterVerifyRequest, ShareClickRequest,
    SurveyAnswerRequest, WebAuthnVerifyRequest, WordRatingRequest, WordRatingSummary,
)
from database import init_db, get_db
from server_secret import server_secret
from duel import (
    create_duel, join_duel, get_duel_state, record_guess, record_tip,
    get_player_history, get_player_info, cleanup_stale_duels,
    set_player_connected, advance_duel_game,
)
from duel import reveal_context as reveal_duel_context
from koop import (
    create_koop, join_koop, get_koop_state, get_koop_guesses,
    record_koop_guess, record_koop_tip, cleanup_stale_koops,
    give_up_koop, advance_koop_game,
)
from koop import get_player_info as get_koop_player_info
from koop import reveal_context as reveal_koop_context
import live_chat
import tiktok_chat
from live_ingest import current_ingest as current_live_ingest, run_live_chat
from arena import (
    ArenaGuessRefused, advance_arena_game, cleanup_stale_arenas, create_arena,
    get_arena_state, join_arena, record_arena_guess, start_arena,
)
from arena import get_player_history as get_arena_player_history
from arena import get_player_info as get_arena_player_info
from arena import iso_timestamp as arena_iso_timestamp
from arena import reveal_context as reveal_arena_context
from matchmaking import (
    cancel as cancel_match_ticket,
    enqueue as enqueue_for_match,
    live_counts as matchmaking_live_counts,
    prune_queue,
    reset_connected_flags,
    run_matchmaking,
    ticket_status,
    waiting_counts as matchmaking_waiting,
)
from game import GameState
from models import (
    GuessRequest, GuessResponse, TipResponse, GameInfoResponse,
    RevealResponse, PastGamesResponse, ClosestWordsResponse,
    InfiniteNextResponse,
    WordAtRankResponse, DualNextResponse, DualGuessResponse, SuddenDeathResponse,
    CreateDuelRequest, CreateDuelResponse, JoinDuelRequest,
    JoinDuelResponse, DuelStateResponse, DuelGuessRequest,
    DuelGuessHistoryResponse,
    CreateKoopRequest, CreateKoopResponse, JoinKoopRequest, JoinKoopResponse,
    KoopStateResponse, KoopGuessRequest, KoopGuessResponse, KoopGuessesResponse,
    KoopGiveUpRequest, KoopGiveUpResponse, NextGameRequest, NextGameResponse,
    RoomRevealRequest, RoomRevealResponse,
    CreateLiveRequest, CreateLiveResponse, LiveRoomResponse,
    LiveStopRequest, LiveStopResponse, LiveOverlayResponse,
    LiveDebugMessageRequest, LivePlatformsResponse,
    LiveMessagesSeenRequest, LiveMessagesSeenResponse,
    AdminHostMessageRequest, AdminHostMessageResponse, AdminLiveStreamsResponse,
    CreateArenaRequest, CreateArenaResponse, JoinArenaRequest, JoinArenaResponse,
    ArenaStateResponse, ArenaTokenRequest, ArenaGuessRequest, ArenaGuessResponse,
    MatchmakingEnqueueRequest, MatchmakingTicketResponse,
    MatchmakingStatusResponse, MatchmakingCancelRequest, MatchmakingLiveResponse,
    PopularModesResponse,
)
from websocket_manager import (
    manager as ws_manager,
    wordle_manager as wordle_ws_manager,
    koop_manager as koop_ws_manager,
    arena_manager as arena_ws_manager,
)
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
    cleanup_stale_wordle_duels, advance_wordle_duel_game,
    is_wordle_duel_member,
)
from wordle_duel import reveal_context as reveal_wordle_duel_context
from rooms import ROOM_REVEAL_MESSAGES, RoomRevealRefused

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
    daily. That exclusion is enforced where the next game is selected
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


def _unknown_word_response(gs: GameState, word: str) -> JSONResponse:
    """Reject a guess the dictionary does not have, with what it might have been.

    The suggestions are the typo candidates that were too ambiguous to apply on
    their own. They are ordered by edit distance and German word frequency, never
    by their rank in the running game, which would make them a free hint.
    """
    return JSONResponse(
        status_code=404,
        content={
            "error": "unknown_word",
            "message": "Wort nicht im Wörterbuch",
            "suggestions": gs.suggestions(word),
        },
    )


def _room_game_number(source: str) -> int:
    """Pick the game a new Kontexto room is opened on.

    The client sends the kind, the server picks the number, because the number
    is the answer (rooms.py). "random" is never today's daily, so an invited
    friend who has not played it yet is not spoiled; if the pool cannot supply
    anything else, the daily is the only remaining option.
    """
    gs = _get_game_state()
    daily = _get_current_game_number()
    if source == "today":
        return daily
    chosen = gs.random_game_number({daily})
    return chosen if chosen is not None else daily


def _wordle_room_game_number(ws: WordleState, source: str) -> int:
    """The same server-side pick for a Wordle duel.

    It also removes a bug the client had: it drew from 1..5000 while the
    solution list is shorter, so a random duel could point at a game that does
    not exist.
    """
    daily = ws.get_game_number()
    if source == "today":
        return daily
    chosen = ws.random_game_number({daily})
    return chosen if chosen is not None else daily


def _pick_next_kontexto_game(current: int, played: set[int]) -> int | None:
    """Choose the next game for a multiplayer room's "Nächstes Spiel".

    Mirrors ``/api/infinite/next``: never the daily (so the room can't spoil it)
    or the current game; avoids games already played in this room until the pool
    is exhausted, then relaxes back to just {daily, current}.
    """
    gs = _get_game_state()
    daily = _get_current_game_number()
    base = {daily, current}
    chosen = gs.random_game_number(base | played)
    if chosen is None:
        chosen = gs.random_game_number(base)
    return chosen


def _room_reveal_refusal(refused: RoomRevealRefused) -> JSONResponse:
    """One answer shape for every refused room reveal.

    404 for an unknown room or a token that is not a member, 409 while the round
    is still open. The player is told the round is running and nothing else: a
    message that distinguished "not yet" from "not you" would be a probe.
    """
    status = 409 if refused.code == "round_open" else 404
    return JSONResponse(
        status_code=status,
        content={
            "error": refused.code,
            "message": ROOM_REVEAL_MESSAGES.get(refused.code, "Kein Zugriff"),
        },
    )


def _room_reveal_payload(ctx: dict) -> dict:
    """Turn a granted Kontexto room reveal into its response.

    No analytics here on purpose. The authoritative reveal counter belongs to
    the player action that ends a round (koop give-up, the solo reveal button);
    a round that ends on a deadline or a solve is not a reveal, and counting it
    as one is what the arena client used to do through the solo endpoint.
    """
    gs = _get_game_state()
    return {
        "word": gs.get_target_word(ctx["game_number"]),
        "game_number": ctx["game_number"],
        "round": ctx["round"],
    }


def _public_arena_state(state: dict) -> dict:
    """The arena state as the players may see it, without the game number."""
    return {k: v for k, v in state.items() if k != "game_number"}


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

    # The action-counter batcher runs in EVERY worker (unlike the singleton
    # aggregation/cleanup/broadcast loops below, which run only in the WS worker):
    # each worker must persist the counters for the requests it served. Its writes
    # are commutative additive upserts, so concurrent per-worker flushers stay
    # correct against the shared SQLite file.
    await analytics.start_counter_batcher(_db_path)

    tasks = []
    is_ws_mode = os.environ.get("KONTEXTO_WS_MODE")
    is_dev = os.environ.get("KONTEXTO_DEV")
    if is_ws_mode or is_dev:
        # No socket survives a restart, so every connection flag still set in
        # the database is a ghost from the process that died. Clear them before
        # the broadcast loops start, or the first diff they push is wrong.
        db = await get_db(_db_path)
        try:
            cleared = await reset_connected_flags(db)
        finally:
            await db.close()
        if cleared:
            logger.info("cleared %d stale connection flags at startup", cleared)

        tasks.append(asyncio.create_task(ws_manager.poll_and_broadcast(_db_path)))
        tasks.append(asyncio.create_task(wordle_ws_manager.poll_and_broadcast(_db_path)))
        tasks.append(asyncio.create_task(koop_ws_manager.poll_and_broadcast(_db_path)))
        tasks.append(asyncio.create_task(arena_ws_manager.poll_and_broadcast(_db_path)))
        tasks.append(asyncio.create_task(_matchmaking_loop()))
        tasks.append(asyncio.create_task(_cleanup_loop()))
        # Live chat mode. Here and only here, like every other loop: four API
        # workers would open four connections to the same chat and count every
        # message four times.
        tasks.append(asyncio.create_task(run_live_chat(_db_path, _resolve_room_guess)))
        # Exactly one worker (KONTEXTO_WS_MODE) runs analytics aggregation/pruning.
        # Log it so a misconfiguration where it runs nowhere is immediately visible
        # at startup: rollups never built, raw events never pruned.
        logger.info("analytics aggregation + cleanup loop active in this worker")

    yield

    for t in tasks:
        t.cancel()
    # Drain buffered counters before exit so the last flush window isn't lost.
    await analytics.stop_counter_batcher()
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
                await cleanup_stale_koops(db)
                await cleanup_stale_wordle_duels(db)
                await cleanup_stale_arenas(db)
                await prune_queue(db)
                await analytics.aggregate_daily(db)
                await analytics.prune_old_events(db)
                await analytics.prune_presence(db)
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
async def guess(
    req: GuessRequest,
    request: Request,
    game: int | None = Query(None),
    infinite: bool = Query(False),
    mode: str | None = Query(None),
):
    gs = _get_game_state()
    try:
        game_num = _resolve_game_number(game, infinite=infinite)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": "invalid_game", "message": str(e)})
    gs.load_game(game_num)

    if gs.is_uncounted(req.word):
        return JSONResponse(
            status_code=422,
            content={"error": "stopword", "message": "Dieses Wort zählt nicht, es ist zu allgemein"},
        )

    result = gs.guess(req.word, game_num)
    if result is None:
        return _unknown_word_response(gs, req.word)
    mode = _solo_mode(mode, infinite)
    if req.first:
        # First guess of this game for this visitor: the only point where an
        # abandoned game becomes countable at all.
        await analytics.record_game_start(
            _db_path,
            ip=_client_ip(request),
            user_agent=request.headers.get("user-agent", ""),
            mode=mode,
            game_number=game_num,
        )
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
    mode: str | None = Query(None),
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
    await analytics.record_game_stat(_db_path, _solo_mode(mode, infinite), game_num, "hints")
    return result


@app.get("/api/game", response_model=GameInfoResponse)
async def game_info():
    gs = _get_game_state()
    game_num = _get_current_game_number()

    return {
        "gameNumber": game_num,
        "date": date.today().isoformat(),
        "total": gs.display_total(),
        "firstCuratedGame": gs.first_curated_game(),
    }


class CreatorSubmissionRequest(BaseModel):
    clip_url: str = Field(..., max_length=500)
    channel_url: str = Field(..., max_length=500)
    channel_name: str = Field(..., max_length=80)
    email: str | None = Field(default=None, max_length=254)


@app.post("/api/creator-submissions", status_code=201)
async def creator_submission(req: CreatorSubmissionRequest, request: Request):
    db = await get_db(_db_path)
    try:
        try:
            submission_id = await creator_spot.submit(
                db, clip_url=req.clip_url, channel_url=req.channel_url,
                channel_name=req.channel_name, email=req.email,
                ip=_client_ip(request),
            )
        except creator_spot.SubmissionError as exc:
            return JSONResponse(status_code=429 if str(exc) == "rate_limited" else 400, content={"error": str(exc)})
        return {"id": submission_id}
    finally:
        await db.close()


@app.get("/api/creator-spot")
async def current_creator_spot():
    db = await get_db(_db_path)
    try:
        return {"creator": await creator_spot.today(db, _get_current_game_number(), date.today())}
    finally:
        await db.close()


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
        # Pool exhausted for this session, relax to allow already-played games
        # again, still never the daily or the current game.
        chosen = gs.random_game_number(base_exclude)
    if chosen is None:
        return JSONResponse(
            status_code=404,
            content={"error": "no_games", "message": "Keine weiteren Spiele verfügbar"},
        )

    return {
        "gameNumber": chosen,
        "total": gs.display_total(),
        "totalGames": gs.total_games(),
    }


@app.get("/api/reveal", response_model=RevealResponse)
async def reveal(
    game: int | None = Query(None),
    infinite: bool = Query(False),
    mode: str | None = Query(None),
):
    gs = _get_game_state()
    try:
        game_num = _resolve_game_number(game, infinite=infinite)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": "invalid_game", "message": str(e)})

    mode = _solo_mode(mode, infinite)
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


# --- Solo modes (Leiter, Limitierte Versuche, Doppelziel, Sudden Death) ---

# Ranks shown as a starting point in Sudden Death: the five runners-up. Wide
# enough to describe the target's neighbourhood, never rank 1.
SUDDEN_DEATH_RANKS = [2, 3, 4, 5, 6]


def _parse_exclude(raw: str) -> set[int]:
    return {int(p) for p in raw.split(",") if p.strip().lstrip("-").isdigit()}


def _solo_mode(mode: str | None, infinite: bool) -> str:
    """Resolve the analytics mode of a solo request.

    Validated against the shared allow-list rather than forwarded verbatim, so a
    crafted request cannot create an arbitrary dimension in analytics_counters.
    """
    if mode and mode in analytics.SOLO_MODES:
        return mode
    return "infinite" if infinite else "kontexto"


@app.get("/api/word-at-rank", response_model=WordAtRankResponse)
async def word_at_rank(
    rank: int = Query(..., ge=2),
    game: int | None = Query(None),
    infinite: bool = Query(False),
):
    """Serve the word sitting at one exact rank, the opening move of Leiter.

    Rank 1 is rejected by the model constraint and again in ``word_at_rank``:
    this endpoint must never become a second way to read the solution.
    """
    gs = _get_game_state()
    try:
        game_num = _resolve_game_number(game, infinite=infinite)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": "invalid_game", "message": str(e)})

    result = gs.word_at_rank(game_num, rank)
    if result is None:
        return JSONResponse(
            status_code=404,
            content={"error": "rank_out_of_range", "message": f"Rang {rank} gibt es in diesem Spiel nicht"},
        )
    return {**result, "gameNumber": game_num}


@app.get("/api/dual/next", response_model=DualNextResponse)
async def dual_next(exclude: str = Query("")):
    """Pick the two independent targets of a Doppelziel round.

    Never the daily game, so a Doppelziel round cannot spoil it, and never the
    same game twice, because two identical targets would make the second rank
    pure noise.
    """
    gs = _get_game_state()
    base_exclude = {_get_current_game_number()}
    chosen = gs.random_game_numbers(2, base_exclude | _parse_exclude(exclude))
    if chosen is None:
        chosen = gs.random_game_numbers(2, base_exclude)
    if chosen is None:
        return JSONResponse(
            status_code=404,
            content={"error": "no_games", "message": "Keine weiteren Spiele verfügbar"},
        )
    return {
        "gameNumbers": chosen,
        "total": gs.display_total(),
        "totalGames": gs.total_games(),
    }


@app.post("/api/dual/guess", response_model=DualGuessResponse)
async def dual_guess(
    req: GuessRequest,
    request: Request,
    games: str = Query(...),
):
    """Rank one word against both Doppelziel targets in a single round trip.

    Two separate calls to /api/guess would work but would double the request
    count on every keystroke-driven guess and could half-fail, leaving the client
    with one rank and no honest way to display the round.
    """
    gs = _get_game_state()
    numbers = [int(p) for p in games.split(",") if p.strip().isdigit()]
    if len(numbers) != 2 or numbers[0] == numbers[1]:
        return JSONResponse(
            status_code=400,
            content={"error": "invalid_game", "message": "Doppelziel braucht zwei verschiedene Spiele"},
        )
    total_games = gs.total_games()
    if any(n < 1 or n > total_games for n in numbers):
        return JSONResponse(
            status_code=400,
            content={"error": "invalid_game", "message": "Spiel existiert nicht"},
        )

    if gs.is_uncounted(req.word):
        return JSONResponse(
            status_code=422,
            content={"error": "stopword", "message": "Dieses Wort zählt nicht, es ist zu allgemein"},
        )

    results = [gs.guess(req.word, n) for n in numbers]
    if any(r is None for r in results):
        return _unknown_word_response(gs, req.word)

    normalized = results[0]["word"]
    if req.first:
        await analytics.record_game_start(
            _db_path,
            ip=_client_ip(request),
            user_agent=request.headers.get("user-agent", ""),
            mode="doppel",
            game_number=numbers[0],
        )
    await analytics.record_action(_db_path, "guesses", "doppel", word=normalized)
    for n, r in zip(numbers, results):
        await analytics.record_game_stat(_db_path, "doppel", n, "guesses")
        if r["rank"] == 1:
            await analytics.record_game_stat(_db_path, "doppel", n, "solves")
    # A Doppelziel round counts as solved only when both targets are found, which
    # is what the mode asks of the player.
    if all(r["rank"] == 1 for r in results):
        await analytics.record_action(_db_path, "solves", "doppel")

    return {
        "word": normalized,
        "ranks": [{"gameNumber": n, "rank": r["rank"]} for n, r in zip(numbers, results)],
        "total": results[0]["total"],
        "corrected_from": results[0]["corrected_from"],
    }


@app.get("/api/sudden-death", response_model=SuddenDeathResponse)
async def sudden_death(exclude: str = Query("")):
    """Hand out a Sudden Death round: a game plus its five runners-up.

    The daily game is excluded for the same reason as everywhere else, and the
    solution itself never leaves the server here. A game whose runners-up
    include a word the game never names on its own is not dealt, because the
    list is shown before the first guess and cannot skip a rank.
    """
    gs = _get_game_state()
    base_exclude = {_get_current_game_number()}
    chosen = gs.random_sudden_death_game(base_exclude | _parse_exclude(exclude), SUDDEN_DEATH_RANKS)
    if chosen is None:
        chosen = gs.random_sudden_death_game(base_exclude, SUDDEN_DEATH_RANKS)
    if chosen is None:
        return JSONResponse(
            status_code=404,
            content={"error": "no_games", "message": "Keine weiteren Spiele verfügbar"},
        )

    hints = gs.words_at_ranks(chosen, SUDDEN_DEATH_RANKS)
    if not hints:
        return JSONResponse(
            status_code=404,
            content={"error": "no_hints", "message": "Für dieses Spiel gibt es keine Nachbarn"},
        )
    return {"gameNumber": chosen, "total": gs.display_total(), "hints": hints}


# --- Duel endpoints ---

@app.post("/api/duel", response_model=CreateDuelResponse)
async def create_duel_endpoint(req: CreateDuelRequest):
    game_number = _room_game_number(req.game_source)
    db = await get_db(_db_path)
    try:
        result = await create_duel(db, game_number, req.nickname, req.tips_allowed)
        await analytics.record_action(_db_path, "duels_created", "kontexto")
        await analytics.record_mode_pick(_db_path, "friends", "duel")
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

        if gs.is_uncounted(req.word):
            return JSONResponse(
                status_code=422,
                content={"error": "stopword", "message": "Dieses Wort zählt nicht, es ist zu allgemein"},
            )

        result = gs.guess(req.word, game_num)
        if result is None:
            return _unknown_word_response(gs, req.word)

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


@app.post("/api/duel/{duel_id}/next-game", response_model=NextGameResponse)
async def duel_next_game_endpoint(duel_id: str, req: NextGameRequest):
    gs = _get_game_state()
    db = await get_db(_db_path)
    try:
        state = await get_duel_state(db, duel_id)
        if state is None:
            return JSONResponse(
                status_code=404,
                content={"error": "duel_not_found", "message": "Duell nicht gefunden"},
            )
        info = await get_player_info(db, req.player_token)
        if info is None or info["duel_id"] != duel_id:
            return JSONResponse(
                status_code=404,
                content={"error": "player_not_found", "message": "Spieler nicht gefunden"},
            )
        new_game = await advance_duel_game(db, duel_id, _pick_next_kontexto_game)
        if new_game is None:
            return JSONResponse(
                status_code=404,
                content={"error": "no_games", "message": "Keine weiteren Spiele verfügbar"},
            )
        await analytics.record_action(_db_path, "rounds", "duel")
        fresh = await get_duel_state(db, duel_id)
        return {"round": fresh["round"], "total": gs.display_total()}
    finally:
        await db.close()


@app.post("/api/duel/{duel_id}/reveal", response_model=RoomRevealResponse)
async def duel_reveal_endpoint(duel_id: str, req: RoomRevealRequest):
    """The solution of a duel round, for a player whose own round is over."""
    db = await get_db(_db_path)
    try:
        try:
            ctx = await reveal_duel_context(db, duel_id, req.player_token)
        except RoomRevealRefused as refused:
            return _room_reveal_refusal(refused)
        return _room_reveal_payload(ctx)
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


# --- Koop (cooperative Kontexto) endpoints ---

@app.post("/api/koop", response_model=CreateKoopResponse)
async def create_koop_endpoint(req: CreateKoopRequest):
    game_number = _room_game_number(req.game_source)
    db = await get_db(_db_path)
    try:
        result = await create_koop(db, game_number, req.nickname, req.tips_allowed)
        await analytics.record_action(_db_path, "koops_created", "kontexto")
        await analytics.record_mode_pick(_db_path, "friends", "koop")
        return result
    finally:
        await db.close()


@app.post("/api/koop/{koop_id}/join", response_model=JoinKoopResponse)
async def join_koop_endpoint(koop_id: str, req: JoinKoopRequest):
    gs = _get_game_state()
    db = await get_db(_db_path)
    try:
        result = await join_koop(db, koop_id, req.nickname)
        if result is None:
            return JSONResponse(
                status_code=404,
                content={"error": "koop_not_found", "message": "Koop nicht gefunden"},
            )
        result["total"] = gs.display_total()
        return result
    finally:
        await db.close()


@app.get("/api/koop/player-info")
async def koop_player_info(token: str = Query(...)):
    db = await get_db(_db_path)
    try:
        info = await get_koop_player_info(db, token)
        if info is None:
            return JSONResponse(status_code=404, content={"error": "player_not_found"})
        return info
    finally:
        await db.close()


@app.get("/api/koop/{koop_id}", response_model=KoopStateResponse)
async def get_koop_state_endpoint(koop_id: str):
    gs = _get_game_state()
    db = await get_db(_db_path)
    try:
        state = await get_koop_state(db, koop_id)
        if state is None:
            return JSONResponse(
                status_code=404,
                content={"error": "koop_not_found", "message": "Koop nicht gefunden"},
            )
        state["total"] = gs.display_total()
        return state
    finally:
        await db.close()


@app.get("/api/koop/{koop_id}/guesses", response_model=KoopGuessesResponse)
async def koop_guesses_endpoint(koop_id: str):
    db = await get_db(_db_path)
    try:
        state = await get_koop_state(db, koop_id)
        if state is None:
            return JSONResponse(
                status_code=404,
                content={"error": "koop_not_found", "message": "Koop nicht gefunden"},
            )
        return {"guesses": await get_koop_guesses(db, koop_id)}
    finally:
        await db.close()


@app.post("/api/koop/{koop_id}/guess", response_model=KoopGuessResponse)
async def koop_guess_endpoint(koop_id: str, req: KoopGuessRequest):
    db = await get_db(_db_path)
    try:
        state = await get_koop_state(db, koop_id)
        if state is None:
            return JSONResponse(
                status_code=404,
                content={"error": "koop_not_found", "message": "Koop nicht gefunden"},
            )
        game_num = state["game_number"]
        gs = _get_game_state()
        gs.load_game(game_num)

        if gs.is_uncounted(req.word):
            return JSONResponse(
                status_code=422,
                content={"error": "stopword", "message": "Dieses Wort zählt nicht, es ist zu allgemein"},
            )

        result = gs.guess(req.word, game_num)
        if result is None:
            return _unknown_word_response(gs, req.word)

        recorded = await record_koop_guess(db, koop_id, req.player_token, result["word"], result["rank"])
        if recorded is None:
            return JSONResponse(
                status_code=404,
                content={"error": "player_not_found", "message": "Spieler nicht gefunden"},
            )
        if not recorded["already_guessed"]:
            await analytics.record_action(_db_path, "guesses", "koop", word=result["word"])
            await analytics.record_game_stat(_db_path, "koop", game_num, "guesses")
            if result["rank"] == 1 and recorded["solved"]:
                await analytics.record_action(_db_path, "solves", "koop")
                await analytics.record_game_stat(_db_path, "koop", game_num, "solves")
        return {**result, "already_guessed": recorded["already_guessed"]}
    finally:
        await db.close()


@app.get("/api/koop/{koop_id}/tip", response_model=TipResponse)
async def koop_tip_endpoint(
    koop_id: str,
    token: str = Query(...),
    difficulty: str = Query("easy", pattern="^(easy|medium|hard)$"),
):
    db = await get_db(_db_path)
    try:
        state = await get_koop_state(db, koop_id)
        if state is None:
            return JSONResponse(
                status_code=404,
                content={"error": "koop_not_found", "message": "Koop nicht gefunden"},
            )
        if not state["tips_allowed"]:
            return JSONResponse(
                status_code=403,
                content={"error": "tips_disabled", "message": "Tipps sind in diesem Koop deaktiviert"},
            )
        game_num = state["game_number"]
        gs = _get_game_state()
        gs.load_game(game_num)

        # Server-authoritative: derive best_rank and already-guessed ranks from the
        # shared list rather than trusting the client.
        shared = await get_koop_guesses(db, koop_id)
        ranks = [g["rank"] for g in shared]
        best_rank = min(ranks) if ranks else 10000

        result = gs.get_tip(game_number=game_num, difficulty=difficulty, best_rank=best_rank, guessed_ranks=ranks)
        if result is None:
            return JSONResponse(
                status_code=404,
                content={"error": "no_tip", "message": "Kein Tipp verfügbar"},
            )

        recorded = await record_koop_tip(db, koop_id, token, result["word"], result["rank"])
        if recorded is None:
            return JSONResponse(
                status_code=404,
                content={"error": "player_not_found", "message": "Spieler nicht gefunden"},
            )
        return result
    finally:
        await db.close()


@app.post("/api/koop/{koop_id}/give-up", response_model=KoopGiveUpResponse)
async def koop_give_up_endpoint(koop_id: str, req: KoopGiveUpRequest):
    gs = _get_game_state()
    db = await get_db(_db_path)
    try:
        state = await get_koop_state(db, koop_id)
        if state is None:
            return JSONResponse(
                status_code=404,
                content={"error": "koop_not_found", "message": "Koop nicht gefunden"},
            )
        game_num = state["game_number"]
        target = gs.get_target_word(game_num)
        result = await give_up_koop(db, koop_id, req.player_token, target)
        if result is None:
            return JSONResponse(
                status_code=404,
                content={"error": "player_not_found", "message": "Spieler nicht gefunden"},
            )
        await analytics.record_action(_db_path, "reveals", "koop")
        await analytics.record_game_stat(_db_path, "koop", game_num, "reveals")
        return {
            "word": result["word"],
            "game_number": result["game_number"],
            "round": result["round"],
        }
    finally:
        await db.close()


@app.post("/api/koop/{koop_id}/next-game", response_model=NextGameResponse)
async def koop_next_game_endpoint(koop_id: str, req: NextGameRequest):
    gs = _get_game_state()
    db = await get_db(_db_path)
    try:
        state = await get_koop_state(db, koop_id)
        if state is None:
            return JSONResponse(
                status_code=404,
                content={"error": "koop_not_found", "message": "Koop nicht gefunden"},
            )
        info = await get_koop_player_info(db, req.player_token)
        if info is None or info["koop_id"] != koop_id:
            return JSONResponse(
                status_code=404,
                content={"error": "player_not_found", "message": "Spieler nicht gefunden"},
            )
        new_game = await advance_koop_game(db, koop_id, _pick_next_kontexto_game)
        if new_game is None:
            return JSONResponse(
                status_code=404,
                content={"error": "no_games", "message": "Keine weiteren Spiele verfügbar"},
            )
        await analytics.record_action(_db_path, "rounds", "koop")
        fresh = await get_koop_state(db, koop_id)
        return {"round": fresh["round"], "total": gs.display_total()}
    finally:
        await db.close()


@app.post("/api/koop/{koop_id}/reveal", response_model=RoomRevealResponse)
async def koop_reveal_endpoint(koop_id: str, req: RoomRevealRequest):
    """The solution of a koop round, once the team has solved or given up."""
    db = await get_db(_db_path)
    try:
        try:
            ctx = await reveal_koop_context(db, koop_id, req.player_token)
        except RoomRevealRefused as refused:
            return _room_reveal_refusal(refused)
        return _room_reveal_payload(ctx)
    finally:
        await db.close()


@app.websocket("/ws/koop/{koop_id}")
async def koop_websocket(websocket: WebSocket, koop_id: str, token: str = Query(...)):
    db = await get_db(_db_path)
    try:
        state = await get_koop_state(db, koop_id)
    finally:
        await db.close()

    if state is None:
        await websocket.close(code=4004)
        return

    await koop_ws_manager.connect(koop_id, token, websocket, _db_path)
    await websocket.send_json({
        "type": "state",
        "players": state["players"],
        "best_rank": state["best_rank"],
        "solved": state["solved"],
    })

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await koop_ws_manager.disconnect(koop_id, token, _db_path)


# --- Live chat endpoints (a stream chat plays a koop round) ---
#
# Deliberately four endpoints and not a second set of game endpoints: a live room
# IS a koop room, so playing, tipping, giving up, the next round and the reveal
# all go through /api/koop/... with the host's token. What is here is the binding
# of a room to a channel and the read the OBS overlay polls.


def _resolve_room_guess(game_number: int, word: str) -> dict | None:
    """The word-to-rank path a room guess takes, for callers without a request.

    The chat ingest has no HTTP response to shape, so the three outcomes the koop
    handler distinguishes (stopword, unknown word, a rank) collapse into two:
    a result, or nothing. Keeping it next to that handler is the point, so the
    two cannot drift apart.
    """
    gs = _get_game_state()
    gs.load_game(game_number)
    if gs.is_uncounted(word):
        return None
    return gs.guess(word, game_number)


def _live_room_payload(
    room: dict, top: list[dict], messages: list[dict] | None = None
) -> dict:
    return {
        "koop_id": room["koop_id"],
        "platform": room["platform"],
        "channel": room["channel"],
        "require_prefix": room["require_prefix"],
        "chat_state": room["chat_state"],
        "chat_error": room["chat_error"],
        "overlay_token": room["overlay_token"],
        "top": top,
        "messages": messages or [],
    }


# The name a refusal uses for each platform.
_PLATFORM_NAMES = {"twitch": "Twitch", "tiktok": "TikTok"}


def _tiktok_room_cap() -> int:
    """How many TikTok rooms may be bound at once.

    The free provider tier holds 25 sockets. The default stays below that, so
    a room that reconnects still finds a slot, and a paid tier raises it here.
    """
    try:
        return max(0, int(os.environ.get("KONTEXTO_TIKTOK_MAX_ROOMS", "20")))
    except ValueError:
        return 20


def _available_platforms() -> list[str]:
    return [
        platform for platform in live_chat.PLATFORMS
        if platform != "tiktok" or tiktok_chat.is_configured()
    ]


@app.get("/api/live/platforms", response_model=LivePlatformsResponse)
async def live_platforms_endpoint():
    """What the create form may offer. Read on every opening of the form, so a
    key added on the server shows up without a new frontend build."""
    return {"platforms": _available_platforms()}


@app.post("/api/live", response_model=CreateLiveResponse)
async def create_live_endpoint(req: CreateLiveRequest):
    if req.platform not in _available_platforms():
        return JSONResponse(
            status_code=503,
            content={
                "error": "platform_unavailable",
                "message": f"{_PLATFORM_NAMES[req.platform]} ist gerade nicht angebunden",
            },
        )
    channel = live_chat.normalise_channel(req.channel, req.platform)
    if channel is None:
        return JSONResponse(
            status_code=422,
            content={
                "error": "bad_channel",
                "message": f"Diesen Kanalnamen gibt es auf {_PLATFORM_NAMES[req.platform]} nicht",
            },
        )

    game_number = _room_game_number(req.game_source)
    db = await get_db(_db_path)
    try:
        if req.platform == "tiktok":
            # Checked before the insert, not inside it. Two creates can race for
            # the last slot and both pass; that costs one socket over the cap,
            # which the provider answers with 4429 and the reader waits out.
            cursor = await db.execute(
                "SELECT COUNT(*) AS n FROM live_rooms WHERE platform = 'tiktok'"
            )
            row = await cursor.fetchone()
            if row["n"] >= _tiktok_room_cap():
                return JSONResponse(
                    status_code=503,
                    content={
                        "error": "platform_full",
                        "message": "Gerade laufen zu viele TikTok-Runden gleichzeitig",
                    },
                )
        # The host plays under their channel name unless they asked for another.
        # sanitize_nickname runs inside create_koop, so a channel name that is
        # itself abusive is masked like any other.
        host_name = req.nickname or channel
        room = await create_koop(db, game_number, host_name, req.tips_allowed)
        try:
            live = await live_chat.create_live_room(
                db,
                koop_id=room["koop_id"],
                platform=req.platform,
                channel=channel,
                host_token=room["player_token"],
                require_prefix=req.require_prefix,
            )
        except live_chat.ChannelBusy:
            # Roll the empty koop room back rather than leaving an orphan that
            # the cleanup loop would carry for an hour.
            await db.execute("DELETE FROM koop_players WHERE koop_id = ?", (room["koop_id"],))
            await db.execute("DELETE FROM koops WHERE id = ?", (room["koop_id"],))
            await db.commit()
            return JSONResponse(
                status_code=409,
                content={
                    "error": "channel_busy",
                    "message": "Für diesen Kanal läuft schon eine Runde",
                },
            )

        await analytics.record_action(_db_path, "live_rooms_created", "kontexto")
        await analytics.record_mode_pick(_db_path, "friends", "live")
        await live_chat.record_stream_event(db, req.platform, channel, "sessions")
        await live_chat.record_stream_event(db, req.platform, channel, "rounds")
        full = await live_chat.get_live_room(db, room["koop_id"])
        return {**_live_room_payload(full, []), "player_token": room["player_token"]}
    finally:
        await db.close()


# When this worker last raised a room's presence stamp. Per worker on purpose:
# it only saves the SQL round trip, the stamp's own age check in touch_host is
# what keeps four workers from writing four times.
_host_touched: dict[str, float] = {}


def _host_touch_due(koop_id: str) -> bool:
    now = time.monotonic()
    last = _host_touched.get(koop_id)
    if last is not None and now - last < live_chat.HOST_TOUCH_SECONDS:
        return False
    _host_touched[koop_id] = now
    # Rooms come and go for weeks in one process; forget the ones long silent.
    if len(_host_touched) > 1000:
        horizon = now - live_chat.HOST_ABSENT_SECONDS
        for key in [k for k, t in _host_touched.items() if t < horizon]:
            del _host_touched[key]
    return True


@app.get("/api/live/{koop_id}", response_model=LiveRoomResponse)
async def get_live_endpoint(koop_id: str, token: str = Query(...)):
    db = await get_db(_db_path)
    try:
        room = await live_chat.get_live_room(db, koop_id)
        # A foreign token gets the same 404 as an unknown room: telling the two
        # apart would let anybody check whether a channel is playing right now.
        if room is None or not secrets.compare_digest(room["host_token"], token):
            return JSONResponse(
                status_code=404,
                content={"error": "room_not_found", "message": "Diese Runde gibt es nicht"},
            )
        if _host_touch_due(koop_id):
            await live_chat.touch_host(db, koop_id)
        return _live_room_payload(
            room,
            await live_chat.top_viewers(db, koop_id),
            await live_chat.pending_host_messages(db, koop_id),
        )
    finally:
        await db.close()


@app.post("/api/live/{koop_id}/messages/seen", response_model=LiveMessagesSeenResponse)
async def live_messages_seen_endpoint(koop_id: str, req: LiveMessagesSeenRequest):
    """The host page confirms that the operator's notes up to an id are on screen.

    Explicit rather than implied by the read, so a poll response that never
    arrived cannot swallow a note. Repeating it is harmless.
    """
    db = await get_db(_db_path)
    try:
        room = await live_chat.get_live_room(db, koop_id)
        if room is None or not secrets.compare_digest(room["host_token"], req.player_token):
            return JSONResponse(
                status_code=404,
                content={"error": "room_not_found", "message": "Diese Runde gibt es nicht"},
            )
        marked = await live_chat.mark_host_messages_seen(db, koop_id, req.up_to_id)
        return {"marked": marked}
    finally:
        await db.close()


@app.post("/api/live/{koop_id}/stop", response_model=LiveStopResponse)
async def stop_live_endpoint(koop_id: str, req: LiveStopRequest):
    """Unbind the chat. The koop room stays, so the host can still reveal."""
    db = await get_db(_db_path)
    try:
        stopped = await live_chat.stop_live_room(db, koop_id, req.player_token)
        if not stopped:
            return JSONResponse(
                status_code=404,
                content={"error": "room_not_found", "message": "Diese Runde gibt es nicht"},
            )
        return {"stopped": True}
    finally:
        await db.close()


@app.get("/api/live/overlay/state", response_model=LiveOverlayResponse)
async def live_overlay_endpoint(token: str = Query(...)):
    """What the OBS browser source polls, once a second.

    Its own token, so the room id alone does not open it, and no game number and
    no target word, because this view is pointed at an audience.
    """
    gs = _get_game_state()
    db = await get_db(_db_path)
    try:
        room = await live_chat.get_live_room_by_overlay(db, token)
        if room is None:
            return JSONResponse(
                status_code=404,
                content={"error": "room_not_found", "message": "Diese Runde gibt es nicht"},
            )
        snap = await live_chat.overlay_snapshot(db, room["koop_id"])
        if snap is None:
            return JSONResponse(
                status_code=404,
                content={"error": "room_not_found", "message": "Diese Runde gibt es nicht"},
            )
        return {**snap, "total": gs.display_total()}
    finally:
        await db.close()


@app.post("/api/live/{koop_id}/debug-message")
async def live_debug_message(koop_id: str, req: LiveDebugMessageRequest):
    """Feed one chat line into a room without a chat. Development only.

    The end-to-end suite has to prove that a message from a viewer reaches the
    board and the overlay, and it cannot do that by talking to Twitch. This is
    the seam. It is closed unless KONTEXTO_DEV is set, so it does not exist in
    production, and it takes the same path a real message takes rather than a
    shortcut into the database.
    """
    if not os.environ.get("KONTEXTO_DEV"):
        return JSONResponse(status_code=404, content={"error": "not_found"})
    ingest = current_live_ingest()
    if ingest is None:
        return JSONResponse(
            status_code=503, content={"error": "ingest_not_running"}
        )
    await ingest.reconcile()
    await ingest.handle_message(
        koop_id,
        live_chat.ChatMessage(
            external_id=req.external_id,
            display_name=req.display_name,
            text=req.text,
        ),
    )
    return {"delivered": True}


@app.post("/api/live/{koop_id}/debug-host-message", response_model=AdminHostMessageResponse)
async def live_debug_host_message(koop_id: str, req: AdminHostMessageRequest):
    """Queue an operator note without a passkey session. Development only.

    The end-to-end suite cannot sign in with a passkey, and it has to prove that
    a note reaches the host page and never the overlay. Closed unless
    KONTEXTO_DEV is set, and it runs the same normalisation and the same insert
    the admin endpoint runs.
    """
    if not os.environ.get("KONTEXTO_DEV"):
        return JSONResponse(status_code=404, content={"error": "not_found"})
    return await _queue_host_message(koop_id, req.text)


async def _queue_host_message(koop_id: str, raw: str):
    body = live_chat.normalise_host_message(raw)
    if body is None:
        return JSONResponse(
            status_code=422,
            content={
                "error": "bad_message",
                "message": f"Die Nachricht muss 1 bis {live_chat.HOST_MESSAGE_MAX_CHARS} Zeichen haben",
            },
        )
    db = await get_db(_db_path)
    try:
        try:
            message_id = await live_chat.send_host_message(db, koop_id, body)
        except live_chat.TooManyPending:
            return JSONResponse(
                status_code=409,
                content={
                    "error": "too_many_pending",
                    "message": "Der Stream hat die letzten Nachrichten noch nicht angezeigt",
                },
            )
        if message_id is None:
            return JSONResponse(
                status_code=404,
                content={"error": "room_not_found", "message": "Dieser Stream läuft nicht mehr"},
            )
        return {"id": message_id}
    finally:
        await db.close()


# --- Arena endpoints (Battle Royale, Blitz-Duell, Zeitbonus-Jagd) ---

# What the player is told when a guess is refused. The codes come from
# arena.ArenaGuessRefused; only the wording belongs here.
_ARENA_REFUSAL_MESSAGES = {
    "not_running": "Die Runde läuft gerade nicht",
    "eliminated": "Du bist in dieser Runde schon raus",
    "time_up": "Deine Zeit ist abgelaufen",
    "player_not_found": "Spieler nicht gefunden",
    "arena_not_found": "Runde nicht gefunden",
}


@app.post("/api/arena", response_model=CreateArenaResponse)
async def create_arena_endpoint(req: CreateArenaRequest):
    game_number = _room_game_number(req.game_source)
    db = await get_db(_db_path)
    try:
        result = await create_arena(db, req.mode, game_number, req.nickname)
        if result is None:
            return JSONResponse(
                status_code=400,
                content={"error": "invalid_mode", "message": "Unbekannter Modus"},
            )
        await analytics.record_action(_db_path, "duels_created", req.mode)
        await analytics.record_mode_pick(_db_path, "friends", req.mode)
        return result
    finally:
        await db.close()


@app.post("/api/arena/{arena_id}/join", response_model=JoinArenaResponse)
async def join_arena_endpoint(arena_id: str, req: JoinArenaRequest):
    db = await get_db(_db_path)
    try:
        state = await get_arena_state(db, arena_id)
        if state is None:
            return JSONResponse(
                status_code=404,
                content={"error": "arena_not_found", "message": "Runde nicht gefunden"},
            )
        result = await join_arena(db, arena_id, req.nickname)
        if result is None:
            # Either the room is full or the round has already started. Both mean
            # the same thing to the player: this one takes nobody else.
            return JSONResponse(
                status_code=409,
                content={"error": "arena_closed", "message": "Diese Runde nimmt niemanden mehr auf"},
            )
        return result
    finally:
        await db.close()


@app.get("/api/arena/player-info")
async def arena_player_info(token: str = Query(...)):
    db = await get_db(_db_path)
    try:
        info = await get_arena_player_info(db, token)
        if info is None:
            return JSONResponse(status_code=404, content={"error": "player_not_found"})
        return info
    finally:
        await db.close()


@app.get("/api/arena/{arena_id}", response_model=ArenaStateResponse)
async def get_arena_endpoint(arena_id: str):
    db = await get_db(_db_path)
    try:
        state = await get_arena_state(db, arena_id)
        if state is None:
            return JSONResponse(
                status_code=404,
                content={"error": "arena_not_found", "message": "Runde nicht gefunden"},
            )
        return state
    finally:
        await db.close()


@app.post("/api/arena/{arena_id}/start", response_model=ArenaStateResponse)
async def start_arena_endpoint(arena_id: str, req: ArenaTokenRequest):
    """Start the round. Any player in the lobby may press it.

    The first deadline is written here, by the server, so that every client
    counts down against the same absolute moment.
    """
    db = await get_db(_db_path)
    try:
        info = await get_arena_player_info(db, req.player_token)
        if info is None or info["arena_id"] != arena_id:
            return JSONResponse(
                status_code=404,
                content={"error": "player_not_found", "message": "Spieler nicht gefunden"},
            )
        state = await start_arena(db, arena_id)
        if state is None:
            return JSONResponse(
                status_code=409,
                content={"error": "cannot_start", "message": "Die Runde kann noch nicht starten"},
            )
        return state
    finally:
        await db.close()


@app.post("/api/arena/{arena_id}/guess", response_model=ArenaGuessResponse)
async def arena_guess_endpoint(arena_id: str, req: ArenaGuessRequest):
    db = await get_db(_db_path)
    try:
        state = await get_arena_state(db, arena_id)
        if state is None:
            return JSONResponse(
                status_code=404,
                content={"error": "arena_not_found", "message": "Runde nicht gefunden"},
            )
        game_num = state["game_number"]
        gs = _get_game_state()
        gs.load_game(game_num)

        if gs.is_uncounted(req.word):
            return JSONResponse(
                status_code=422,
                content={"error": "stopword", "message": "Dieses Wort zählt nicht, es ist zu allgemein"},
            )
        result = gs.guess(req.word, game_num)
        if result is None:
            return _unknown_word_response(gs, req.word)

        try:
            booked = await record_arena_guess(
                db, arena_id, req.player_token, result["word"], result["rank"]
            )
        except ArenaGuessRefused as refused:
            return JSONResponse(status_code=409, content={
                "error": refused.code,
                "message": _ARENA_REFUSAL_MESSAGES.get(refused.code, "Dieser Versuch zählt nicht mehr"),
            })

        mode = state["mode"]
        await analytics.record_action(_db_path, "guesses", mode, word=result["word"])
        await analytics.record_game_stat(_db_path, mode, game_num, "guesses")
        if result["rank"] == 1:
            await analytics.record_action(_db_path, "solves", mode)
            await analytics.record_game_stat(_db_path, mode, game_num, "solves")

        return {
            "word": result["word"],
            "rank": result["rank"],
            "total": result["total"],
            "deadline_at": booked["deadline_at"],
            "finished": booked["finished"],
            "corrected_from": result["corrected_from"],
        }
    finally:
        await db.close()


@app.get("/api/arena/{arena_id}/history", response_model=DuelGuessHistoryResponse)
async def arena_history_endpoint(arena_id: str, token: str = Query(...)):
    db = await get_db(_db_path)
    try:
        return {"guesses": await get_arena_player_history(db, arena_id, token)}
    finally:
        await db.close()


@app.post("/api/arena/{arena_id}/next-game", response_model=NextGameResponse)
async def arena_next_game_endpoint(arena_id: str, req: NextGameRequest):
    gs = _get_game_state()
    db = await get_db(_db_path)
    try:
        info = await get_arena_player_info(db, req.player_token)
        if info is None or info["arena_id"] != arena_id:
            return JSONResponse(
                status_code=404,
                content={"error": "player_not_found", "message": "Spieler nicht gefunden"},
            )
        new_game = await advance_arena_game(db, arena_id, _pick_next_kontexto_game)
        if new_game is None:
            return JSONResponse(
                status_code=409,
                content={"error": "no_games", "message": "Keine weitere Runde möglich"},
            )
        state = await get_arena_state(db, arena_id)
        await analytics.record_action(_db_path, "rounds", state["mode"] if state else "royale")
        return {"round": state["round"], "total": gs.display_total()}
    finally:
        await db.close()


@app.post("/api/arena/{arena_id}/reveal", response_model=RoomRevealResponse)
async def arena_reveal_endpoint(arena_id: str, req: RoomRevealRequest):
    """The solution of an arena round, once the arena is finished."""
    db = await get_db(_db_path)
    try:
        try:
            ctx = await reveal_arena_context(db, arena_id, req.player_token)
        except RoomRevealRefused as refused:
            return _room_reveal_refusal(refused)
        return _room_reveal_payload(ctx)
    finally:
        await db.close()


@app.websocket("/ws/arena/{arena_id}")
async def arena_websocket(websocket: WebSocket, arena_id: str, token: str = Query(...)):
    db = await get_db(_db_path)
    try:
        state = await get_arena_state(db, arena_id)
    finally:
        await db.close()

    if state is None:
        await websocket.close(code=4004)
        return

    await arena_ws_manager.connect(arena_id, token, websocket, _db_path)
    # Not **state: the room state carries the game number for the handlers, and
    # a socket frame is exactly the kind of place it must not appear (rooms.py).
    await websocket.send_json({"type": "state", **_public_arena_state(state)})

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await arena_ws_manager.disconnect(arena_id, token, _db_path)


# --- Matchmaking (random opponents for every multiplayer mode) ---

async def _matchmaking_room(db, mode: str, nicknames: list[str]) -> tuple[str, list[str]]:
    """Build the room a matched party was formed for.

    matchmaking.py knows nothing about duels, koops or arenas on purpose; this is
    the one place that maps a queue mode onto a concrete room. Tokens come back
    positionally, because two strangers may well carry the same nickname.
    """
    gs = _get_game_state()

    if mode == "wordle_duel":
        ws = get_wordle_state()
        game_number = ws.random_game_number({ws.get_game_number()})
        if game_number is None:
            game_number = ws.get_game_number()
        created = await create_wordle_duel(db, nicknames[0], game_number)
        room_id = created["duel_id"]
        tokens = [created["player_token"]]
        for name in nicknames[1:]:
            joined = await join_wordle_duel(db, room_id, name)
            tokens.append(joined["player_token"])
        return room_id, tokens

    # Every Kontexto room draws a random game that is never today's daily, so a
    # matched round cannot spoil the puzzle the player may not have played yet.
    game_number = gs.random_game_number({_get_current_game_number()})
    if game_number is None:
        game_number = _get_current_game_number()

    if mode == "duel":
        created = await create_duel(db, game_number, nicknames[0], True)
        room_id = created["duel_id"]
        tokens = [created["player_token"]]
        for name in nicknames[1:]:
            joined = await join_duel(db, room_id, name)
            tokens.append(joined["player_token"])
        return room_id, tokens

    if mode == "koop":
        created = await create_koop(db, game_number, nicknames[0], True)
        room_id = created["koop_id"]
        tokens = [created["player_token"]]
        for name in nicknames[1:]:
            joined = await join_koop(db, room_id, name)
            tokens.append(joined["player_token"])
        return room_id, tokens

    created = await create_arena(db, mode, game_number, nicknames[0])
    room_id = created["arena_id"]
    tokens = [created["player_token"]]
    for name in nicknames[1:]:
        joined = await join_arena(db, room_id, name)
        tokens.append(joined["player_token"])
    return room_id, tokens


async def _matchmaking_loop():
    """Form parties once a second. Single WS worker, so there is one writer."""
    while True:
        await asyncio.sleep(1)
        try:
            db = await get_db(_db_path)
            try:
                for room in await run_matchmaking(db, _matchmaking_room):
                    await analytics.record_action(_db_path, "matches_made", room["mode"])
            finally:
                await db.close()
        except Exception:
            logger.exception("matchmaking cycle failed")


@app.post("/api/matchmaking/enqueue", response_model=MatchmakingTicketResponse)
async def matchmaking_enqueue(req: MatchmakingEnqueueRequest):
    db = await get_db(_db_path)
    try:
        result = await enqueue_for_match(db, req.mode, req.nickname)
        if result is None:
            return JSONResponse(
                status_code=400,
                content={"error": "invalid_mode", "message": "Unbekannter Modus"},
            )
        # Taking a ticket is the pick on the strangers tab. Counted here and not
        # where the party forms, because a player who gave up waiting still
        # chose this mode, and because the room itself is built by the
        # matchmaking loop through the module, not through the create endpoint.
        await analytics.record_mode_pick(_db_path, "strangers", req.mode)
        return result
    finally:
        await db.close()


@app.get("/api/matchmaking/status", response_model=MatchmakingStatusResponse)
async def matchmaking_status(ticket: str = Query(..., min_length=8, max_length=200)):
    db = await get_db(_db_path)
    try:
        status = await ticket_status(db, ticket)
        if status is None:
            # A ticket ages out after matchmaking.TICKET_TTL_SECONDS, so an
            # unknown one usually means the wait was abandoned and pruned.
            return JSONResponse(
                status_code=404,
                content={"error": "ticket_not_found", "message": "Die Suche ist abgelaufen"},
            )
        return {**status, "waiting": (await matchmaking_waiting(db)).get(status["mode"], 0)}
    finally:
        await db.close()


# The picker opens out of every running game and then polls, so this endpoint
# sees far more traffic than the queue itself. Five seconds of staleness costs
# nothing on a figure that exists for orientation, and it caps the five
# aggregate queries at one round per second across all API workers.
LIVE_CACHE_TTL = 5.0
_live_cache: tuple[float, dict] | None = None
_live_cache_lock = asyncio.Lock()


async def _live_payload() -> dict:
    global _live_cache
    now = time.monotonic()
    cached = _live_cache
    if cached and now - cached[0] < LIVE_CACHE_TTL:
        return cached[1]

    async with _live_cache_lock:
        # A second waiter arrives after the holder refilled the cache; without
        # this check every request queued behind an expiry would count again.
        cached = _live_cache
        now = time.monotonic()
        if cached and now - cached[0] < LIVE_CACHE_TTL:
            return cached[1]

        db = await get_db(_db_path)
        try:
            modes = await matchmaking_live_counts(db)
        finally:
            await db.close()

        payload = {
            "modes": modes,
            "waiting_total": sum(m["waiting"] for m in modes.values()),
            "playing_total": sum(m["playing"] for m in modes.values()),
        }
        _live_cache = (time.monotonic(), payload)
        return payload


@app.get("/api/matchmaking/live", response_model=MatchmakingLiveResponse)
async def matchmaking_live():
    """How busy every mode is, for the picker before a ticket exists."""
    return await _live_payload()


# The badge in the picker moves at the pace of a month of play, so a five
# minute cache is generous and still keeps a dialog opened ten times in a row
# off the database. Per worker, like the live cache above: four copies of a
# read-only answer cost nothing and share no state.
POPULAR_CACHE_TTL = 300.0
_popular_cache: tuple[float, dict] | None = None
_popular_cache_lock = asyncio.Lock()


@app.get("/api/modes/popular", response_model=PopularModesResponse)
async def popular_modes_endpoint():
    """The most-picked mode per tab of the picker, or null where it is unclear.

    Names only, never counts: the dialog asks which mode is popular, and how
    much traffic this site has is nobody else's business.
    """
    global _popular_cache
    now = time.monotonic()
    cached = _popular_cache
    if cached and now - cached[0] < POPULAR_CACHE_TTL:
        return cached[1]

    async with _popular_cache_lock:
        cached = _popular_cache
        now = time.monotonic()
        if cached and now - cached[0] < POPULAR_CACHE_TTL:
            return cached[1]

        db = await get_db(_db_path)
        try:
            leaders = await analytics.popular_modes(db)
        finally:
            await db.close()

        payload = {**leaders, "window_days": analytics.POPULAR_WINDOW_DAYS}
        _popular_cache = (time.monotonic(), payload)
        return payload



# The tally moves with a day of play, so a five minute cache keeps a page
# reloaded ten times off the database. Per worker and per game number, like the
# popular-modes cache above: four copies of a read-only answer cost nothing and
# share no state.
RATING_CACHE_TTL = 300.0
_rating_cache: dict[tuple[int, str], tuple[float, dict]] = {}
_rating_cache_lock = asyncio.Lock()


@app.post("/api/rating", response_model=BeaconResponse)
async def word_rating(req: WordRatingRequest, request: Request):
    """Record one vote on how a solution word played.

    The only metric this project takes from the player rather than from a
    handler, and the posture is the one the distribution histograms use: a
    fingerprint-bound token, a bot filter, a validated enum payload and a dedup
    ledger. It touches no authoritative counter.

    A rejected vote returns ok=false rather than an error, exactly like the
    survey: a duplicate or an expired token is nothing the visitor could act on,
    and an error would tell a prober which of the two it was.
    """
    db = await get_db(_db_path)
    try:
        accepted, _reason = await analytics.record_word_rating(
            db,
            ip=_client_ip(request),
            user_agent=request.headers.get("user-agent", ""),
            token=req.token,
            game_number=req.game_number,
            verdict=req.verdict,
            reason=req.reason,
            detail=req.detail,
            target_words=_get_game_state().target_words,
            first_game=_get_game_state().first_curated_game(),
            now=_now(),
        )
        return {"ok": accepted}
    finally:
        await db.close()


@app.get("/api/rating", response_model=WordRatingSummary)
async def word_rating_summary(
    game: int | None = Query(None),
    infinite: bool = Query(False),
):
    """How the others voted on this word.

    The game number goes through the same gate as reveal, so a future puzzle is
    refused here too. The tally is the answer to a round that is over, and a
    round that has not happened has no tally worth probing for.
    """
    daily = _get_current_game_number()
    if game is None or game == daily:
        # Today's puzzle is the one everybody is voting on, and _resolve_game_number
        # refuses it by number: its date gate stops a caller naming today or later,
        # which is right for reveal and wrong here. A tally of three numbers says
        # nothing about the word, so today is let through and the future is not.
        game_num = daily
    else:
        try:
            game_num = _resolve_game_number(game, infinite=infinite)
        except ValueError as e:
            return JSONResponse(status_code=400,
                                content={"error": "invalid_game", "message": str(e)})

    # The tally belongs to the word; the number only names it until the next
    # pool rebuild, so the cache is keyed by both.
    word = _get_game_state().get_target_word(game_num)
    key = (game_num, word)
    now = time.monotonic()
    cached = _rating_cache.get(key)
    if cached and now - cached[0] < RATING_CACHE_TTL:
        return cached[1]

    async with _rating_cache_lock:
        cached = _rating_cache.get(key)
        now = time.monotonic()
        if cached and now - cached[0] < RATING_CACHE_TTL:
            return cached[1]

        db = await get_db(_db_path)
        try:
            payload = await analytics.get_rating_summary(db, game_num, word)
        finally:
            await db.close()

        # Bounded so a crawler walking every game number cannot grow it without
        # limit; the daily word is the only one anybody asks for twice.
        if len(_rating_cache) > 512:
            _rating_cache.clear()
        _rating_cache[key] = (time.monotonic(), payload)
        return payload

@app.post("/api/matchmaking/cancel", response_model=BeaconResponse)
async def matchmaking_cancel(req: MatchmakingCancelRequest):
    db = await get_db(_db_path)
    try:
        return {"ok": await cancel_match_ticket(db, req.ticket)}
    finally:
        await db.close()


# --- Wordle single-player endpoints ---


@app.get("/api/wordle/game")
async def wordle_game(ws: WordleState = Depends(get_wordle_state)) -> WordleGameResponse:
    return WordleGameResponse(game_number=ws.get_game_number())


@app.post("/api/wordle/guess")
async def wordle_guess(
    req: WordleGuessRequest, request: Request, ws: WordleState = Depends(get_wordle_state)
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
    if req.first:
        await analytics.record_game_start(
            _db_path,
            ip=_client_ip(request),
            user_agent=request.headers.get("user-agent", ""),
            mode="wordle",
            game_number=req.game_number,
        )
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
    ws = get_wordle_state()
    game_number = _wordle_room_game_number(ws, req.game_source)
    async with aiosqlite.connect(_db_path) as db:
        db.row_factory = aiosqlite.Row
        result = await create_wordle_duel(
            db, nickname=req.nickname, game_number=game_number
        )
    # "wordle_duel", not "wordle": the plain Wordle and the duel are separate
    # modes everywhere else now (the queue, the mode catalogue, the dashboard),
    # and counting them together made the duel invisible. Rows written before
    # this stay under their old dimension; the split starts here.
    await analytics.record_action(_db_path, "duels_created", "wordle_duel")
    await analytics.record_mode_pick(_db_path, "friends", "wordle_duel")
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
    # See the note on duels_created above: this used to land under "duel" and
    # was therefore counted as Kontexto-Duell.
    await analytics.record_action(_db_path, "guesses", "wordle_duel")
    if word == solution:
        await analytics.record_action(_db_path, "solves", "wordle_duel")
    return WordleGuessResponse(valid=True, result=result)


@app.get("/api/wordle/duel/{duel_id}/history")
async def wordle_duel_history(
    duel_id: str, token: str
) -> WordleDuelHistoryResponse:
    async with aiosqlite.connect(_db_path) as db:
        db.row_factory = aiosqlite.Row
        guesses = await get_wordle_player_history(db, duel_id, token)
    return WordleDuelHistoryResponse(guesses=guesses)


@app.post("/api/wordle/duel/{duel_id}/next-game", response_model=NextGameResponse)
async def wordle_duel_next_game(
    duel_id: str, req: NextGameRequest, ws: WordleState = Depends(get_wordle_state)
):
    def pick_next(current: int, played: set[int]) -> int | None:
        daily = ws.get_game_number()
        base = {daily, current}
        chosen = ws.random_game_number(base | played)
        if chosen is None:
            chosen = ws.random_game_number(base)
        return chosen

    async with aiosqlite.connect(_db_path) as db:
        db.row_factory = aiosqlite.Row
        if not await is_wordle_duel_member(db, duel_id, req.player_token):
            return JSONResponse(
                status_code=404,
                content={"error": "player_not_found", "message": "Spieler nicht gefunden"},
            )
        new_game = await advance_wordle_duel_game(db, duel_id, pick_next)
        if new_game is None:
            return JSONResponse(
                status_code=404,
                content={"error": "no_games", "message": "Keine weiteren Spiele verfügbar"},
            )
        fresh = await get_wordle_duel_state(db, duel_id)
    await analytics.record_action(_db_path, "rounds", "duel")
    return NextGameResponse(round=fresh["round"], total=len(ws.solutions))


@app.post("/api/wordle/duel/{duel_id}/reveal", response_model=RoomRevealResponse)
async def wordle_duel_reveal(
    duel_id: str, req: RoomRevealRequest, ws: WordleState = Depends(get_wordle_state)
):
    """The solution of a Wordle duel round, for a player who has no move left."""
    async with aiosqlite.connect(_db_path) as db:
        db.row_factory = aiosqlite.Row
        try:
            ctx = await reveal_wordle_duel_context(db, duel_id, req.player_token)
        except RoomRevealRefused as refused:
            return _room_reveal_refusal(refused)
    # No reveals counter here; see _room_reveal_payload.
    return RoomRevealResponse(
        word=ws.get_solution(ctx["game_number"]),
        game_number=ctx["game_number"],
        round=ctx["round"],
    )


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
            share=req.share,
            now=_now(),
        )
        return {"ok": accepted}
    finally:
        await db.close()


@app.post("/api/collect/heartbeat", response_model=BeaconResponse)
async def collect_heartbeat(req: HeartbeatRequest, request: Request):
    """Record a live-presence heartbeat (powers the admin "currently online" count)."""
    db = await get_db(_db_path)
    try:
        accepted, _reason = await analytics.record_heartbeat(
            db,
            ip=_client_ip(request),
            user_agent=request.headers.get("user-agent", ""),
            page=req.page,
            token=req.token,
            visible=req.visible,
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


@app.post("/api/collect/share", response_model=BeaconResponse)
async def collect_share(req: ShareClickRequest, request: Request):
    """Count a press of the share button (token-gated, bot-filtered)."""
    db = await get_db(_db_path)
    try:
        accepted, _reason = await analytics.record_share_click(
            db,
            ip=_client_ip(request),
            user_agent=request.headers.get("user-agent", ""),
            token=req.token,
            mode=req.mode,
            now=_now(),
        )
        return {"ok": accepted}
    finally:
        await db.close()


@app.post("/api/survey/answer", response_model=BeaconResponse)
async def survey_answer(req: SurveyAnswerRequest, request: Request):
    """Record one answer to the attribution survey.

    Token-gated, bot-filtered and deduplicated per fingerprint, exactly like the
    completion beacon. A rejected answer (duplicate, bad token) returns ok=false
    rather than an error: the client shows the thank-you state either way, because
    there is nothing the visitor could do about it.
    """
    db = await get_db(_db_path)
    try:
        accepted, _reason = await analytics.record_survey_answer(
            db,
            ip=_client_ip(request),
            user_agent=request.headers.get("user-agent", ""),
            token=req.token,
            source=req.source,
            detail=req.detail,
            survey=req.survey,
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


def _verify_admin(authorization: str) -> bool:
    token = authorization[7:] if authorization.lower().startswith("bearer ") else authorization
    return auth.verify_session_token(token)


class CreatorReviewRequest(BaseModel):
    approve: bool


@app.get("/api/admin/creator-submissions")
async def admin_creator_submissions(authorization: str = Header(default="")):
    if not _verify_admin(authorization):
        return JSONResponse(status_code=401, content={"error": "unauthorized"})
    db = await get_db(_db_path)
    try:
        return {"submissions": await creator_spot.list_submissions(db)}
    finally:
        await db.close()


@app.post("/api/admin/creator-submissions/{submission_id}/review")
async def admin_review_creator(submission_id: int, req: CreatorReviewRequest,
                               authorization: str = Header(default="")):
    if not _verify_admin(authorization):
        return JSONResponse(status_code=401, content={"error": "unauthorized"})
    db = await get_db(_db_path)
    try:
        if not await creator_spot.review(db, submission_id, req.approve):
            return JSONResponse(status_code=409, content={"error": "not_pending"})
        return {"ok": True}
    finally:
        await db.close()


@app.get("/api/admin/live", response_model=LiveStatsResponse)
async def admin_live(authorization: str = Header(default="")):
    """Lightweight, session-protected snapshot of currently-online visitors.

    Polled frequently by the dashboard's live badge, so it stays cheap (a single
    windowed count + per-page split) instead of recomputing the full stats payload.
    """
    if not _verify_admin(authorization):
        return JSONResponse(status_code=401, content={"error": "unauthorized", "message": "Nicht autorisiert"})
    db = await get_db(_db_path)
    try:
        return await analytics.get_live_visitors(db, _now())
    finally:
        await db.close()


@app.get("/api/admin/live-streams", response_model=AdminLiveStreamsResponse)
async def admin_live_streams(authorization: str = Header(default="")):
    """Every live-chat room bound right now, with the notes sent to it.

    Polled by the dashboard's stream section while it is open, so it stays a
    handful of indexed reads instead of riding on the full stats payload.
    """
    if not _verify_admin(authorization):
        return JSONResponse(status_code=401, content={"error": "unauthorized", "message": "Nicht autorisiert"})
    db = await get_db(_db_path)
    try:
        streams = await live_chat.active_streams(db)
        messages = await live_chat.recent_host_messages(
            db, [stream["koop_id"] for stream in streams]
        )
        for stream in streams:
            stream["messages"] = messages.get(stream["koop_id"], [])
        return {"server_time": arena_iso_timestamp(_now()), "streams": streams}
    finally:
        await db.close()


@app.post("/api/admin/live-streams/{koop_id}/message", response_model=AdminHostMessageResponse)
async def admin_send_host_message(
    koop_id: str, req: AdminHostMessageRequest, authorization: str = Header(default="")
):
    """Send the streamer a short note. It appears on the host page only."""
    if not _verify_admin(authorization):
        return JSONResponse(status_code=401, content={"error": "unauthorized", "message": "Nicht autorisiert"})
    return await _queue_host_message(koop_id, req.text)


@app.post("/api/admin/live-streams/{koop_id}/end", response_model=LiveStopResponse)
async def admin_end_live_stream(koop_id: str, authorization: str = Header(default="")):
    """End a stream round: the chat stops counting and the overlay goes blank.

    The board on the streamer's page stays, like after their own stop, so a
    round that was nearly solved can still be revealed there.
    """
    if not _verify_admin(authorization):
        return JSONResponse(status_code=401, content={"error": "unauthorized", "message": "Nicht autorisiert"})
    db = await get_db(_db_path)
    try:
        if not await live_chat.end_live_room(db, koop_id):
            return JSONResponse(
                status_code=404,
                content={"error": "room_not_found", "message": "Dieser Stream läuft nicht mehr"},
            )
        return {"stopped": True}
    finally:
        await db.close()


@app.get("/api/admin/stats")
async def admin_stats(authorization: str = Header(default="")):
    if not _verify_admin(authorization):
        return JSONResponse(status_code=401, content={"error": "unauthorized", "message": "Nicht autorisiert"})
    # Persist this worker's buffered counters before reading so the dashboard
    # reflects the very latest actions it served (counters are otherwise flushed
    # on a short interval).
    await analytics.flush_counters()
    db = await get_db(_db_path)
    try:
        gs = _get_game_state()
        stats = await analytics.get_stats(
            db, _now(), target_words=gs.target_words,
            first_rated_game=gs.first_curated_game())
        # Live chat mode keeps its own per-channel book, because the unit its
        # figures are about is a channel and not a day.
        stats["live_streams"] = {
            "totals": await live_chat.stream_totals(db),
            "channels": await live_chat.stream_stats(db),
            "active": await live_chat.active_streams(db),
        }
    finally:
        await db.close()

    # Enrich per-game difficulty with the real target word (admin-only) and trim
    # to the hardest/easiest Kontexto words with enough finished games to matter.
    # The daily Kontexto mode and the endless ("infinite") mode draw from the very
    # same pre-computed target-word pool, so their per-word stats are merged into a
    # single difficulty figure per word; only duel/wordle are excluded here.
    gs = _get_game_state()
    raw = stats.pop("game_difficulty", [])
    merged: dict[int, dict[str, int]] = {}
    for g in raw:
        if g["mode"] not in ("kontexto", "infinite"):
            continue
        acc = merged.setdefault(
            g["game_number"], {"guesses": 0, "solves": 0, "reveals": 0, "hints": 0})
        for metric in ("guesses", "solves", "reveals", "hints"):
            acc[metric] += g.get(metric) or 0
    enriched = []
    for game_number, m in merged.items():
        finished = m["solves"] + m["reveals"]
        if finished < 3:
            continue
        try:
            word = gs.get_target_word(game_number)
        except ValueError:
            continue
        enriched.append({
            "mode": "kontexto",
            "game_number": game_number,
            "guesses": m["guesses"],
            "solves": m["solves"],
            "reveals": m["reveals"],
            "hints": m["hints"],
            "finished": finished,
            "solve_rate": round(m["solves"] / finished, 3),
            "avg_guesses": round(m["guesses"] / m["solves"], 1) if m["solves"] else None,
            "word": word,
        })
    stats["game_difficulty"] = {
        "hardest": sorted(enriched, key=lambda g: (g["solve_rate"], -g["finished"]))[:12],
        "easiest": sorted(enriched, key=lambda g: (-g["solve_rate"], -g["finished"]))[:12],
    }
    return stats
