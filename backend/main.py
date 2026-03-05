"""FastAPI application for Kontexto game API."""

import os
from contextlib import asynccontextmanager
from datetime import date, timedelta

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from game import GameState
from models import GuessRequest, GuessResponse, TipResponse, GameInfoResponse, RevealResponse, PastGamesResponse

_game_state: GameState | None = None


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
    gs = _get_game_state()
    game_num = _get_current_game_number()
    gs.load_game(game_num)
    yield
    global _game_state
    _game_state = None


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

    result = gs.guess(req.word)
    if result is None:
        if gs.is_stopword(req.word):
            return JSONResponse(
                status_code=422,
                content={"error": "stopword", "message": "Dieses Wort zählt nicht – es ist zu allgemein"},
            )
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
    result = gs.get_tip(difficulty=difficulty, best_rank=best_rank, guessed_ranks=parsed_ranks)
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
