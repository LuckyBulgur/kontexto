"""FastAPI application for Kontexto game API."""

import os
from contextlib import asynccontextmanager
from datetime import date

from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse

from game import GameState
from models import GuessRequest, GuessResponse, TipResponse, GameInfoResponse

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    gs = _get_game_state()
    game_num = _get_current_game_number()
    gs.load_game(game_num)
    yield
    global _game_state
    _game_state = None


app = FastAPI(title="Kontexto API", lifespan=lifespan)


@app.post("/api/guess", response_model=GuessResponse)
async def guess(req: GuessRequest):
    gs = _get_game_state()
    game_num = _get_current_game_number()
    gs.load_game(game_num)

    result = gs.guess(req.word)
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
):
    gs = _get_game_state()
    game_num = _get_current_game_number()
    gs.load_game(game_num)

    result = gs.get_tip(difficulty=difficulty, best_rank=best_rank)
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
