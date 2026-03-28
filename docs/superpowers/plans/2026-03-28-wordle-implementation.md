# Wördle (German Wordle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a German Wordle game ("Wördle") with daily puzzles and real-time duel mode to the existing Kontexto platform.

**Architecture:** New backend module `backend/wordle.py` alongside existing `game.py`, with separate duel CRUD in `backend/wordle_duel.py`. Frontend as new route `/wordle` with dedicated components under `frontend/components/wordle/`. Shares existing infrastructure: SQLite DB, WebSocket manager, nginx, Docker.

**Tech Stack:** Python/FastAPI (backend), Next.js 16/React 19/TypeScript (frontend), SQLite/aiosqlite, Tailwind CSS 4, shadcn/ui, Sonner, canvas-confetti.

**Spec:** `docs/superpowers/specs/2026-03-28-wordle-design.md`

---

## File Map

### New Files — Backend

| File | Responsibility |
|------|---------------|
| `scripts/prepare-wordle-data.py` | Extract & filter Hugo0 word lists into `data/wordle/` |
| `backend/wordle.py` | Game logic: evaluate(), validate_hard_mode(), WordleState |
| `backend/wordle_duel.py` | Duel CRUD: create, join, guess, state, cleanup |
| `backend/wordle_models.py` | Pydantic request/response models |
| `backend/test_wordle.py` | Tests for wordle.py |
| `backend/test_wordle_duel.py` | Tests for wordle_duel.py |
| `backend/test_wordle_api.py` | Tests for API endpoints |

### New Files — Frontend

| File | Responsibility |
|------|---------------|
| `frontend/lib/wordle-types.ts` | TypeScript type definitions |
| `frontend/lib/wordle-api.ts` | REST API client functions |
| `frontend/lib/wordle-storage.ts` | localStorage management |
| `frontend/lib/use-wordle-duel-ws.ts` | WebSocket hook for duels |
| `frontend/components/wordle/Tile.tsx` | Single tile with flip/pop animations |
| `frontend/components/wordle/TileRow.tsx` | Row of 5 tiles with shake animation |
| `frontend/components/wordle/Board.tsx` | 5x6 grid container |
| `frontend/components/wordle/Key.tsx` | Single keyboard key with color state |
| `frontend/components/wordle/Keyboard.tsx` | Virtual QWERTZ keyboard |
| `frontend/components/wordle/WordleGame.tsx` | Main game logic & state |
| `frontend/components/wordle/StatsModal.tsx` | Statistics & distribution chart |
| `frontend/components/wordle/HelpModal.tsx` | How-to-play instructions |
| `frontend/components/wordle/SettingsModal.tsx` | Hard Mode toggle |
| `frontend/components/wordle/ShareButton.tsx` | Copy emoji grid to clipboard |
| `frontend/components/wordle/duel/OpponentBoard.tsx` | Opponent grid (colors, no letters) |
| `frontend/components/wordle/duel/DuelHeader.tsx` | Player status bar |
| `frontend/components/wordle/duel/DuelResultCard.tsx` | Duel end-game summary |
| `frontend/app/wordle/page.tsx` | Single-player page |
| `frontend/app/wordle/duel/create/page.tsx` | Duel creation page |
| `frontend/app/wordle/duel/page.tsx` | Duel gameplay page |

### Modified Files

| File | Change |
|------|--------|
| `backend/main.py` | Add wordle API endpoints & WebSocket route |
| `backend/database.py` | Add wordle_duels/players/guesses tables |
| `backend/websocket_manager.py` | Add WordleDuelConnectionManager |
| `frontend/components/Header.tsx` | Add Kontexto/Wördle game switcher |
| `nginx.conf` | Add `/wordle/`, `/api/wordle/`, `/ws/wordle/` routes |

---

## Task 1: Word List Preparation Script

**Files:**
- Create: `scripts/prepare-wordle-data.py`

This script downloads the Hugo0/wordle word list and filters it into two JSON files.

- [ ] **Step 1: Create the preparation script**

```python
#!/usr/bin/env python3
"""Extract German 5-letter words from Hugo0/wordle data.

Source: https://github.com/Hugo0/wordle (PolyForm Noncommercial 1.0.0)
Filters: len == 5, only a-z characters, no umlauts/special chars.
Output: data/wordle/solutions.json (daily tier), data/wordle/valid_words.json (valid tier)
"""

import json
import os
import re
import sys
import urllib.request

WORDS_URL = "https://raw.githubusercontent.com/Hugo0/wordle/main/data/languages/de/words.json"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "wordle")


def download_words(url: str) -> dict:
    print(f"Downloading {url} ...")
    with urllib.request.urlopen(url) as resp:
        return json.loads(resp.read().decode("utf-8"))


def is_valid_word(word: str) -> bool:
    return len(word) == 5 and bool(re.fullmatch(r"[a-z]+", word))


def main():
    data = download_words(WORDS_URL)
    words = data.get("words", [])

    solutions = []
    valid_words = []
    blocked = 0
    filtered = 0

    for entry in words:
        word = entry["word"].lower()
        tier = entry.get("tier", "valid")

        if not is_valid_word(word):
            filtered += 1
            continue

        if tier == "blocked":
            blocked += 1
            continue

        if tier == "daily":
            solutions.append(word)
        else:
            valid_words.append(word)

    # Sort solutions by frequency (most common first for early games)
    # We don't have frequency here, so use the order from Hugo0 which is already curated
    # Deduplicate
    solutions = list(dict.fromkeys(solutions))
    valid_words = list(dict.fromkeys(valid_words))

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    solutions_path = os.path.join(OUTPUT_DIR, "solutions.json")
    valid_path = os.path.join(OUTPUT_DIR, "valid_words.json")

    with open(solutions_path, "w", encoding="utf-8") as f:
        json.dump(solutions, f, ensure_ascii=False)

    with open(valid_path, "w", encoding="utf-8") as f:
        json.dump(valid_words, f, ensure_ascii=False)

    print(f"Solutions:    {len(solutions)} words -> {solutions_path}")
    print(f"Valid words:  {len(valid_words)} words -> {valid_path}")
    print(f"Filtered out: {filtered} (non a-z or wrong length)")
    print(f"Blocked:      {blocked}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run the script to generate word lists**

Run: `cd /home/ugura/kontexto && python3 scripts/prepare-wordle-data.py`
Expected: Two JSON files created in `data/wordle/`. Solutions count should be several hundred, valid words several thousand.

- [ ] **Step 3: Verify the output**

Run: `python3 -c "import json; s=json.load(open('data/wordle/solutions.json')); v=json.load(open('data/wordle/valid_words.json')); print(f'Solutions: {len(s)}, Valid: {len(v)}, Sample solutions: {s[:5]}, Sample valid: {v[:5]}')" `
Expected: Reasonable counts, all words 5 lowercase a-z letters.

- [ ] **Step 4: Commit**

```bash
git add scripts/prepare-wordle-data.py data/wordle/solutions.json data/wordle/valid_words.json
git commit -m "feat(wordle): add word list preparation script and German word data"
```

---

## Task 2: Backend — Wordle Game Logic

**Files:**
- Create: `backend/wordle.py`
- Create: `backend/test_wordle.py`

- [ ] **Step 1: Write failing tests for evaluate()**

Create `backend/test_wordle.py`:

```python
import pytest
from wordle import evaluate, validate_hard_mode


class TestEvaluate:
    def test_all_correct(self):
        assert evaluate("hallo", "hallo") == ["GREEN", "GREEN", "GREEN", "GREEN", "GREEN"]

    def test_all_wrong(self):
        assert evaluate("xyz12", "hallo") == ["GRAY", "GRAY", "GRAY", "GRAY", "GRAY"]

    def test_correct_position(self):
        result = evaluate("hecke", "hallo")
        assert result[0] == "GREEN"  # h correct

    def test_wrong_position(self):
        result = evaluate("lahme", "hallo")
        assert result[0] == "YELLOW"  # l is in hallo but not at pos 0

    def test_not_in_word(self):
        result = evaluate("xyz12", "hallo")
        assert result == ["GRAY", "GRAY", "GRAY", "GRAY", "GRAY"]

    def test_duplicate_letter_one_in_target(self):
        # target "hallo" has one 'a'. Guess "alarm" has 'a' at pos 0 and 2.
        # pos 0: a != h -> check later. pos 2: a != l -> check later.
        # Pass 1: no greens for 'a'.
        # Pass 2: pos 0 'a' -> found in target pos 1 -> YELLOW, consume.
        #         pos 2 'a' -> no more 'a' -> GRAY.
        result = evaluate("alarm", "hallo")
        assert result[0] == "YELLOW"  # first a: yellow
        assert result[2] == "GRAY"    # second a: gray (consumed)

    def test_duplicate_letter_green_priority(self):
        # target "hallo" has two 'l' at pos 2,3. Guess "llama":
        # pos 0: l != h. pos 1: l != a.
        # Pass 1: no greens for l (pos 0,1 don't match).
        # Actually let's use a clearer example:
        # target "belle", guess "lleer"
        # Pass 1: pos 1 l==e? no. Let me pick better.
        # target "alles", guess "lilie"
        # Pass 1: pos 2 l==l -> GREEN, consume target[2].
        # Pass 2: pos 0 l -> target has l at pos 3 -> YELLOW, consume.
        #         pos 3 i -> not in remaining -> GRAY.
        result = evaluate("lilie", "alles")
        assert result[0] == "YELLOW"  # l in word, wrong pos
        assert result[2] == "GREEN"   # l correct pos

    def test_duplicate_in_guess_exact_match_takes_priority(self):
        # target "knall", guess "llama"
        # target has l at pos 3, 4
        # Pass 1: pos 0 l!=k, pos 1 l!=n -> no green for l
        # Pass 2: pos 0 l -> found at pos 3 -> YELLOW, consume [3]
        #         pos 1 l -> found at pos 4 -> YELLOW, consume [4]
        result = evaluate("llama", "knall")
        assert result[0] == "YELLOW"
        assert result[1] == "YELLOW"


class TestValidateHardMode:
    def test_valid_guess(self):
        previous = [("stern", ["GRAY", "GRAY", "GREEN", "GRAY", "GRAY"])]
        assert validate_hard_mode("herze", previous) is None

    def test_green_must_stay(self):
        # 'e' at pos 2 was GREEN, new guess must have 'e' at pos 2
        previous = [("stern", ["GRAY", "GRAY", "GREEN", "GRAY", "GRAY"])]
        result = validate_hard_mode("hallo", previous)
        assert result is not None
        assert "Position 3" in result  # 1-indexed
        assert "E" in result

    def test_yellow_must_be_included(self):
        # 's' was YELLOW at pos 0 -> must appear somewhere
        previous = [("stern", ["YELLOW", "GRAY", "GRAY", "GRAY", "GRAY"])]
        result = validate_hard_mode("hallo", previous)
        assert result is not None
        assert "S" in result

    def test_yellow_included_different_position(self):
        previous = [("stern", ["YELLOW", "GRAY", "GRAY", "GRAY", "GRAY"])]
        assert validate_hard_mode("basis", previous) is None  # has 's'

    def test_gray_no_restriction(self):
        # gray letters CAN be reused
        previous = [("stern", ["GRAY", "GRAY", "GRAY", "GRAY", "GRAY"])]
        assert validate_hard_mode("stern", previous) is None

    def test_multiple_previous_guesses(self):
        previous = [
            ("stern", ["GRAY", "GRAY", "GREEN", "GRAY", "GRAY"]),  # e at pos 2 GREEN
            ("berge", ["GRAY", "YELLOW", "GREEN", "GRAY", "GRAY"]),  # e at pos 2 GREEN, r YELLOW
        ]
        # Must have 'e' at pos 2 AND 'r' somewhere
        assert validate_hard_mode("kerze", previous) is None
        result = validate_hard_mode("kehle", previous)
        assert result is not None  # missing 'r'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/ugura/kontexto/backend && python -m pytest test_wordle.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'wordle'`

- [ ] **Step 3: Implement wordle.py**

Create `backend/wordle.py`:

```python
"""Wordle game logic: evaluation, hard mode validation, and word state management."""

import json
import os
from datetime import date, datetime, timezone, timedelta

BERLIN_TZ = timezone(timedelta(hours=1))


def evaluate(guess: str, solution: str) -> list[str]:
    """Two-pass color evaluation algorithm.

    Pass 1: Mark exact matches as GREEN, consume target letter.
    Pass 2: Mark wrong-position matches as YELLOW, consume target letter.
    Remaining: GRAY.
    """
    result = ["GRAY"] * 5
    solution_chars: list[str | None] = list(solution)

    # Pass 1: Greens
    for i in range(5):
        if guess[i] == solution_chars[i]:
            result[i] = "GREEN"
            solution_chars[i] = None

    # Pass 2: Yellows
    for i in range(5):
        if result[i] == "GREEN":
            continue
        if guess[i] in solution_chars:
            idx = solution_chars.index(guess[i])
            result[i] = "YELLOW"
            solution_chars[idx] = None

    return result


def validate_hard_mode(guess: str, previous: list[tuple[str, list[str]]]) -> str | None:
    """Check hard mode constraints against all previous guesses.

    Returns error message string if violated, None if valid.
    """
    for prev_guess, prev_result in previous:
        for i, color in enumerate(prev_result):
            if color == "GREEN" and guess[i] != prev_guess[i]:
                return f"Position {i + 1} muss '{prev_guess[i].upper()}' sein"
            if color == "YELLOW" and prev_guess[i] not in guess:
                return f"'{prev_guess[i].upper()}' muss enthalten sein"
    return None


class WordleState:
    """Manages word lists and daily game selection."""

    def __init__(self, data_dir: str):
        wordle_dir = os.path.join(data_dir, "wordle")

        with open(os.path.join(wordle_dir, "solutions.json"), "r") as f:
            self.solutions: list[str] = json.load(f)

        with open(os.path.join(wordle_dir, "valid_words.json"), "r") as f:
            valid_list: list[str] = json.load(f)

        # Combined set for O(1) lookup
        self.all_valid: set[str] = set(self.solutions) | set(valid_list)

        # Epoch: fixed start date for game numbering
        self.epoch = date(2026, 3, 28)

    def get_game_number(self) -> int:
        today = datetime.now(BERLIN_TZ).date()
        return (today - self.epoch).days

    def get_solution(self, game_number: int) -> str:
        return self.solutions[game_number % len(self.solutions)]

    def is_valid_word(self, word: str) -> bool:
        return word.lower() in self.all_valid

    def is_past_game(self, game_number: int) -> bool:
        return game_number < self.get_game_number()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/ugura/kontexto/backend && python -m pytest test_wordle.py -v`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/wordle.py backend/test_wordle.py
git commit -m "feat(wordle): add core game logic with evaluate and hard mode validation"
```

---

## Task 3: Backend — Wordle Pydantic Models

**Files:**
- Create: `backend/wordle_models.py`

- [ ] **Step 1: Create Pydantic models**

Create `backend/wordle_models.py`:

```python
"""Pydantic request/response models for Wordle API."""

from pydantic import BaseModel


class PreviousGuess(BaseModel):
    word: str
    result: list[str]


class WordleGuessRequest(BaseModel):
    word: str
    game_number: int
    hard_mode: bool = False
    previous: list[PreviousGuess] = []


class WordleGuessResponse(BaseModel):
    valid: bool
    result: list[str] | None = None
    error: str | None = None
    message: str | None = None


class WordleGameResponse(BaseModel):
    game_number: int


class WordleRevealResponse(BaseModel):
    word: str


class WordleCreateDuelRequest(BaseModel):
    nickname: str
    game_number: int


class WordleCreateDuelResponse(BaseModel):
    duel_id: str
    player_token: str


class WordleJoinDuelRequest(BaseModel):
    nickname: str


class WordleDuelPlayerInfo(BaseModel):
    nickname: str
    guesses_used: int
    solved: bool
    connected: bool


class WordleJoinDuelResponse(BaseModel):
    player_token: str
    players: list[WordleDuelPlayerInfo]
    game_number: int


class WordleDuelGuessRequest(BaseModel):
    word: str
    player_token: str


class WordleDuelGuessEntry(BaseModel):
    word: str
    result: list[str]
    guessed_at: str


class WordleDuelHistoryResponse(BaseModel):
    guesses: list[WordleDuelGuessEntry]


class WordleDuelStateResponse(BaseModel):
    game_number: int
    players: list[WordleDuelPlayerInfo]
```

- [ ] **Step 2: Verify models import cleanly**

Run: `cd /home/ugura/kontexto/backend && python -c "from wordle_models import *; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/wordle_models.py
git commit -m "feat(wordle): add Pydantic request/response models"
```

---

## Task 4: Backend — Wordle Single-Player API Endpoints

**Files:**
- Modify: `backend/main.py`
- Create: `backend/test_wordle_api.py`

- [ ] **Step 1: Write failing tests for API endpoints**

Create `backend/test_wordle_api.py`:

```python
import json
import os
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient


@pytest.fixture
def wordle_state():
    """Create a minimal WordleState for testing."""
    from wordle import WordleState

    # Create temp data
    test_dir = "/tmp/test_wordle_data/wordle"
    os.makedirs(test_dir, exist_ok=True)
    with open(os.path.join(test_dir, "solutions.json"), "w") as f:
        json.dump(["hallo", "stern", "kraft", "blume", "traum"], f)
    with open(os.path.join(test_dir, "valid_words.json"), "w") as f:
        json.dump(["hecke", "lampe", "kerze", "vogel", "wurst"], f)

    state = WordleState("/tmp/test_wordle_data")
    return state


@pytest.fixture
def client(wordle_state):
    from main import app, get_wordle_state
    app.dependency_overrides[get_wordle_state] = lambda: wordle_state
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


class TestWordleGuess:
    def test_valid_guess_correct(self, client, wordle_state):
        game_number = 0  # solution is "hallo"
        resp = client.post("/api/wordle/guess", json={
            "word": "hallo", "game_number": game_number
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["valid"] is True
        assert data["result"] == ["GREEN", "GREEN", "GREEN", "GREEN", "GREEN"]

    def test_valid_guess_partial(self, client):
        resp = client.post("/api/wordle/guess", json={
            "word": "hecke", "game_number": 0  # solution "hallo"
        })
        data = resp.json()
        assert data["valid"] is True
        assert data["result"][0] == "GREEN"  # h matches

    def test_invalid_word(self, client):
        resp = client.post("/api/wordle/guess", json={
            "word": "zzzzz", "game_number": 0
        })
        data = resp.json()
        assert data["valid"] is False
        assert data["error"] == "not_in_word_list"

    def test_hard_mode_violation(self, client):
        resp = client.post("/api/wordle/guess", json={
            "word": "lampe", "game_number": 0,
            "hard_mode": True,
            "previous": [{"word": "hallo", "result": ["GREEN", "GREEN", "GREEN", "GREEN", "GREEN"]}]
        })
        data = resp.json()
        assert data["valid"] is False
        assert data["error"] == "hard_mode_violation"


class TestWordleGame:
    def test_get_game_number(self, client):
        resp = client.get("/api/wordle/game")
        assert resp.status_code == 200
        data = resp.json()
        assert "game_number" in data


class TestWordleReveal:
    def test_reveal_past_game(self, client, wordle_state):
        # Force game 0 to be in the past
        with patch.object(wordle_state, "get_game_number", return_value=5):
            resp = client.get("/api/wordle/reveal?game_number=0")
            assert resp.status_code == 200
            assert resp.json()["word"] == "hallo"

    def test_reveal_current_game(self, client, wordle_state):
        current = wordle_state.get_game_number()
        resp = client.get(f"/api/wordle/reveal?game_number={current}")
        assert resp.status_code == 200
        assert "word" in resp.json()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/ugura/kontexto/backend && python -m pytest test_wordle_api.py -v`
Expected: FAIL — endpoints don't exist yet.

- [ ] **Step 3: Add Wordle endpoints to main.py**

Read the existing `backend/main.py` to find the right insertion point, then add below the existing Kontexto endpoints. Add these imports at the top and a `get_wordle_state` dependency, then add the endpoint functions.

Add to top of `backend/main.py` imports:

```python
from wordle import WordleState, evaluate, validate_hard_mode
from wordle_models import (
    WordleGuessRequest, WordleGuessResponse,
    WordleGameResponse, WordleRevealResponse,
)
```

Add a global `wordle_state` variable initialized in the lifespan, and a dependency:

```python
wordle_state: WordleState | None = None

def get_wordle_state() -> WordleState:
    return wordle_state
```

In the `lifespan` async context manager, after existing game state init:

```python
global wordle_state
data_dir = os.environ.get("KONTEXTO_DATA_DIR", str(Path(__file__).parent.parent / "data"))
wordle_data_path = os.path.join(data_dir, "wordle", "solutions.json")
if os.path.exists(wordle_data_path):
    wordle_state = WordleState(data_dir)
    print(f"Wordle loaded: {len(wordle_state.solutions)} solutions, {len(wordle_state.all_valid)} total valid words")
```

Add endpoints:

```python
@app.get("/api/wordle/game")
async def wordle_game(ws: WordleState = Depends(get_wordle_state)) -> WordleGameResponse:
    return WordleGameResponse(game_number=ws.get_game_number())


@app.post("/api/wordle/guess")
async def wordle_guess(req: WordleGuessRequest, ws: WordleState = Depends(get_wordle_state)) -> WordleGuessResponse:
    word = req.word.lower().strip()

    if not ws.is_valid_word(word):
        return WordleGuessResponse(valid=False, error="not_in_word_list")

    if req.hard_mode and req.previous:
        previous = [(p.word.lower(), p.result) for p in req.previous]
        violation = validate_hard_mode(word, previous)
        if violation:
            return WordleGuessResponse(valid=False, error="hard_mode_violation", message=violation)

    solution = ws.get_solution(req.game_number)
    result = evaluate(word, solution)
    return WordleGuessResponse(valid=True, result=result)


@app.get("/api/wordle/reveal")
async def wordle_reveal(game_number: int, ws: WordleState = Depends(get_wordle_state)) -> WordleRevealResponse:
    return WordleRevealResponse(word=ws.get_solution(game_number))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/ugura/kontexto/backend && python -m pytest test_wordle_api.py -v`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/test_wordle_api.py
git commit -m "feat(wordle): add single-player API endpoints (guess, game, reveal)"
```

---

## Task 5: Backend — Wordle Duel Database & CRUD

**Files:**
- Modify: `backend/database.py`
- Create: `backend/wordle_duel.py`
- Create: `backend/test_wordle_duel.py`

- [ ] **Step 1: Add Wordle duel tables to database.py**

Read `backend/database.py` and add the new tables in the `init_db` function after the existing Kontexto tables:

```python
await db.execute("""
    CREATE TABLE IF NOT EXISTS wordle_duels (
        id TEXT PRIMARY KEY,
        game_number INTEGER NOT NULL,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
""")
await db.execute("""
    CREATE TABLE IF NOT EXISTS wordle_duel_players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        duel_id TEXT NOT NULL REFERENCES wordle_duels(id) ON DELETE CASCADE,
        nickname TEXT NOT NULL,
        player_token TEXT UNIQUE NOT NULL,
        guesses_used INTEGER DEFAULT 0,
        solved BOOLEAN DEFAULT 0,
        connected BOOLEAN DEFAULT 0
    )
""")
await db.execute("""
    CREATE TABLE IF NOT EXISTS wordle_duel_guesses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        duel_id TEXT NOT NULL REFERENCES wordle_duels(id) ON DELETE CASCADE,
        player_token TEXT NOT NULL,
        word TEXT NOT NULL,
        result TEXT NOT NULL,
        guessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
""")
```

- [ ] **Step 2: Write failing tests for duel CRUD**

Create `backend/test_wordle_duel.py`:

```python
import pytest
import asyncio
import aiosqlite
from database import init_db
from wordle_duel import (
    create_wordle_duel, join_wordle_duel, record_wordle_guess,
    get_wordle_duel_state, get_wordle_player_history,
    get_wordle_opponent_guesses, cleanup_stale_wordle_duels,
)


@pytest.fixture
async def db():
    conn = await aiosqlite.connect(":memory:")
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA foreign_keys = ON")
    await init_db(conn)
    yield conn
    await conn.close()


@pytest.mark.asyncio
class TestCreateDuel:
    async def test_creates_duel_and_player(self, db):
        result = await create_wordle_duel(db, nickname="Max", game_number=42)
        assert "duel_id" in result
        assert "player_token" in result
        assert len(result["duel_id"]) == 6

    async def test_player_in_db(self, db):
        result = await create_wordle_duel(db, nickname="Max", game_number=42)
        row = await db.execute_fetchall(
            "SELECT * FROM wordle_duel_players WHERE duel_id = ?",
            (result["duel_id"],)
        )
        assert len(row) == 1
        assert row[0]["nickname"] == "Max"


@pytest.mark.asyncio
class TestJoinDuel:
    async def test_join_returns_state(self, db):
        created = await create_wordle_duel(db, nickname="Max", game_number=42)
        joined = await join_wordle_duel(db, duel_id=created["duel_id"], nickname="Anna")
        assert "player_token" in joined
        assert len(joined["players"]) == 2
        assert joined["game_number"] == 42


@pytest.mark.asyncio
class TestRecordGuess:
    async def test_records_guess_and_updates_count(self, db):
        created = await create_wordle_duel(db, nickname="Max", game_number=42)
        token = created["player_token"]
        duel_id = created["duel_id"]

        await record_wordle_guess(
            db, duel_id=duel_id, player_token=token,
            word="stern", result=["GRAY", "GRAY", "GREEN", "GRAY", "GRAY"]
        )

        state = await get_wordle_duel_state(db, duel_id)
        player = state["players"][0]
        assert player["guesses_used"] == 1
        assert player["solved"] is False

    async def test_marks_solved_on_all_green(self, db):
        created = await create_wordle_duel(db, nickname="Max", game_number=42)
        await record_wordle_guess(
            db, duel_id=created["duel_id"], player_token=created["player_token"],
            word="hallo", result=["GREEN", "GREEN", "GREEN", "GREEN", "GREEN"]
        )
        state = await get_wordle_duel_state(db, created["duel_id"])
        assert state["players"][0]["solved"] is True


@pytest.mark.asyncio
class TestOpponentGuesses:
    async def test_returns_results_without_words(self, db):
        created = await create_wordle_duel(db, nickname="Max", game_number=42)
        await record_wordle_guess(
            db, duel_id=created["duel_id"], player_token=created["player_token"],
            word="stern", result=["GRAY", "GRAY", "GREEN", "GRAY", "GRAY"]
        )
        guesses = await get_wordle_opponent_guesses(db, created["duel_id"], created["player_token"])
        assert len(guesses) == 1
        assert "result" in guesses[0]
        assert "word" not in guesses[0]  # No word leaked!
        assert guesses[0]["nickname"] == "Max"
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /home/ugura/kontexto/backend && python -m pytest test_wordle_duel.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'wordle_duel'`

- [ ] **Step 4: Implement wordle_duel.py**

Create `backend/wordle_duel.py`:

```python
"""Wordle duel CRUD operations."""

import json
import secrets
import string
from datetime import datetime, timezone, timedelta

import aiosqlite

BERLIN_TZ = timezone(timedelta(hours=1))


def _generate_id(length: int = 6) -> str:
    chars = string.ascii_lowercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))


def _generate_token() -> str:
    return secrets.token_urlsafe(32)


async def create_wordle_duel(db: aiosqlite.Connection, nickname: str, game_number: int) -> dict:
    duel_id = _generate_id()
    player_token = _generate_token()

    await db.execute(
        "INSERT INTO wordle_duels (id, game_number, created_by) VALUES (?, ?, ?)",
        (duel_id, game_number, nickname),
    )
    await db.execute(
        "INSERT INTO wordle_duel_players (duel_id, nickname, player_token) VALUES (?, ?, ?)",
        (duel_id, nickname, player_token),
    )
    await db.commit()
    return {"duel_id": duel_id, "player_token": player_token}


async def join_wordle_duel(db: aiosqlite.Connection, duel_id: str, nickname: str) -> dict:
    player_token = _generate_token()

    # Get game_number
    cursor = await db.execute("SELECT game_number FROM wordle_duels WHERE id = ?", (duel_id,))
    row = await cursor.fetchone()
    if not row:
        raise ValueError("Duel not found")
    game_number = row["game_number"]

    await db.execute(
        "INSERT INTO wordle_duel_players (duel_id, nickname, player_token) VALUES (?, ?, ?)",
        (duel_id, nickname, player_token),
    )
    await db.commit()

    state = await get_wordle_duel_state(db, duel_id)
    return {
        "player_token": player_token,
        "players": state["players"],
        "game_number": game_number,
    }


async def record_wordle_guess(
    db: aiosqlite.Connection, duel_id: str, player_token: str,
    word: str, result: list[str]
) -> None:
    result_json = json.dumps(result)
    solved = all(c == "GREEN" for c in result)

    await db.execute(
        "INSERT INTO wordle_duel_guesses (duel_id, player_token, word, result) VALUES (?, ?, ?, ?)",
        (duel_id, player_token, word, result_json),
    )
    await db.execute(
        "UPDATE wordle_duel_players SET guesses_used = guesses_used + 1 WHERE duel_id = ? AND player_token = ?",
        (duel_id, player_token),
    )
    if solved:
        await db.execute(
            "UPDATE wordle_duel_players SET solved = 1 WHERE duel_id = ? AND player_token = ?",
            (duel_id, player_token),
        )
    await db.execute(
        "UPDATE wordle_duels SET last_activity = CURRENT_TIMESTAMP WHERE id = ?",
        (duel_id,),
    )
    await db.commit()


async def get_wordle_duel_state(db: aiosqlite.Connection, duel_id: str) -> dict:
    cursor = await db.execute("SELECT game_number FROM wordle_duels WHERE id = ?", (duel_id,))
    duel = await cursor.fetchone()
    if not duel:
        raise ValueError("Duel not found")

    cursor = await db.execute(
        "SELECT nickname, guesses_used, solved, connected FROM wordle_duel_players WHERE duel_id = ?",
        (duel_id,),
    )
    rows = await cursor.fetchall()
    players = [
        {
            "nickname": r["nickname"],
            "guesses_used": r["guesses_used"],
            "solved": bool(r["solved"]),
            "connected": bool(r["connected"]),
        }
        for r in rows
    ]
    return {"game_number": duel["game_number"], "players": players}


async def get_wordle_player_history(db: aiosqlite.Connection, duel_id: str, player_token: str) -> list[dict]:
    cursor = await db.execute(
        "SELECT word, result, guessed_at FROM wordle_duel_guesses WHERE duel_id = ? AND player_token = ? ORDER BY guessed_at",
        (duel_id, player_token),
    )
    rows = await cursor.fetchall()
    return [
        {"word": r["word"], "result": json.loads(r["result"]), "guessed_at": str(r["guessed_at"])}
        for r in rows
    ]


async def get_wordle_opponent_guesses(db: aiosqlite.Connection, duel_id: str, exclude_token: str) -> list[dict]:
    """Return all guesses from OTHER players, with results but WITHOUT words."""
    cursor = await db.execute(
        """SELECT g.result, g.guessed_at, p.nickname
           FROM wordle_duel_guesses g
           JOIN wordle_duel_players p ON g.player_token = p.player_token
           WHERE g.duel_id = ? AND g.player_token != ?
           ORDER BY g.guessed_at""",
        (duel_id, exclude_token),
    )
    rows = await cursor.fetchall()
    return [
        {"result": json.loads(r["result"]), "guessed_at": str(r["guessed_at"]), "nickname": r["nickname"]}
        for r in rows
    ]


async def set_wordle_player_connected(db: aiosqlite.Connection, duel_id: str, player_token: str, connected: bool) -> None:
    await db.execute(
        "UPDATE wordle_duel_players SET connected = ? WHERE duel_id = ? AND player_token = ?",
        (connected, duel_id, player_token),
    )
    await db.execute(
        "UPDATE wordle_duels SET last_activity = CURRENT_TIMESTAMP WHERE id = ?",
        (duel_id,),
    )
    await db.commit()


async def cleanup_stale_wordle_duels(db: aiosqlite.Connection) -> int:
    """Delete duels where all players disconnected > 1 hour ago."""
    cursor = await db.execute("""
        DELETE FROM wordle_duels WHERE id IN (
            SELECT d.id FROM wordle_duels d
            WHERE d.last_activity < datetime('now', '-1 hour')
            AND NOT EXISTS (
                SELECT 1 FROM wordle_duel_players p
                WHERE p.duel_id = d.id AND p.connected = 1
            )
        )
    """)
    count = cursor.rowcount
    await db.commit()
    return count
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /home/ugura/kontexto/backend && python -m pytest test_wordle_duel.py -v`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/database.py backend/wordle_duel.py backend/test_wordle_duel.py
git commit -m "feat(wordle): add duel database schema and CRUD operations"
```

---

## Task 6: Backend — Wordle Duel API + WebSocket

**Files:**
- Modify: `backend/main.py`
- Modify: `backend/websocket_manager.py`

- [ ] **Step 1: Add duel API endpoints to main.py**

Add imports at top:

```python
from wordle_duel import (
    create_wordle_duel, join_wordle_duel, record_wordle_guess,
    get_wordle_duel_state, get_wordle_player_history,
    get_wordle_opponent_guesses, set_wordle_player_connected,
    cleanup_stale_wordle_duels,
)
from wordle_models import (
    WordleCreateDuelRequest, WordleCreateDuelResponse,
    WordleJoinDuelRequest, WordleJoinDuelResponse,
    WordleDuelGuessRequest, WordleGuessResponse,
    WordleDuelHistoryResponse, WordleDuelGuessEntry,
    WordleDuelStateResponse, WordleDuelPlayerInfo,
)
```

Add endpoints:

```python
@app.post("/api/wordle/duel")
async def wordle_create_duel(req: WordleCreateDuelRequest) -> WordleCreateDuelResponse:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        result = await create_wordle_duel(db, nickname=req.nickname, game_number=req.game_number)
    return WordleCreateDuelResponse(**result)


@app.post("/api/wordle/duel/{duel_id}/join")
async def wordle_join_duel(duel_id: str, req: WordleJoinDuelRequest) -> WordleJoinDuelResponse:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        result = await join_wordle_duel(db, duel_id=duel_id, nickname=req.nickname)
    return WordleJoinDuelResponse(**result)


@app.get("/api/wordle/duel/{duel_id}")
async def wordle_duel_state(duel_id: str) -> WordleDuelStateResponse:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        state = await get_wordle_duel_state(db, duel_id)
    return WordleDuelStateResponse(**state)


@app.post("/api/wordle/duel/{duel_id}/guess")
async def wordle_duel_guess(
    duel_id: str, req: WordleDuelGuessRequest,
    ws: WordleState = Depends(get_wordle_state)
) -> WordleGuessResponse:
    word = req.word.lower().strip()
    if not ws.is_valid_word(word):
        return WordleGuessResponse(valid=False, error="not_in_word_list")

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        state = await get_wordle_duel_state(db, duel_id)
        solution = ws.get_solution(state["game_number"])
        result = evaluate(word, solution)
        await record_wordle_guess(db, duel_id=duel_id, player_token=req.player_token, word=word, result=result)

    return WordleGuessResponse(valid=True, result=result)


@app.get("/api/wordle/duel/{duel_id}/history")
async def wordle_duel_history(duel_id: str, token: str) -> WordleDuelHistoryResponse:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        guesses = await get_wordle_player_history(db, duel_id, token)
    return WordleDuelHistoryResponse(guesses=guesses)
```

- [ ] **Step 2: Add WordleDuelConnectionManager to websocket_manager.py**

Read `backend/websocket_manager.py` and create a `WordleDuelConnectionManager` class below the existing `DuelConnectionManager`, following the same polling pattern but using `wordle_duel_players` and `wordle_duel_guesses` tables. The key difference: broadcast `guess_made` with the color result (but not the word).

```python
class WordleDuelConnectionManager:
    """WebSocket connection manager for Wordle duels."""

    def __init__(self):
        self.connections: dict[str, dict[str, WebSocket]] = {}  # duel_id -> {token -> ws}
        self._known_state: dict[str, list[dict]] = {}
        self._known_guesses: dict[str, int] = {}  # duel_id -> last guess count

    async def connect(self, duel_id: str, token: str, websocket: WebSocket) -> None:
        await websocket.accept()
        if duel_id not in self.connections:
            self.connections[duel_id] = {}
        self.connections[duel_id][token] = websocket

        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            await set_wordle_player_connected(db, duel_id, token, True)
            state = await get_wordle_duel_state(db, duel_id)
            self._known_state[duel_id] = state["players"]

            # Count existing guesses for change detection
            cursor = await db.execute(
                "SELECT COUNT(*) as cnt FROM wordle_duel_guesses WHERE duel_id = ?", (duel_id,)
            )
            row = await cursor.fetchone()
            self._known_guesses[duel_id] = row["cnt"]

        await websocket.send_json({"type": "state", "players": state["players"]})

    async def disconnect(self, duel_id: str, token: str) -> None:
        if duel_id in self.connections:
            self.connections[duel_id].pop(token, None)
            if not self.connections[duel_id]:
                del self.connections[duel_id]
                self._known_state.pop(duel_id, None)
                self._known_guesses.pop(duel_id, None)

        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            await set_wordle_player_connected(db, duel_id, token, False)

    async def broadcast(self, duel_id: str, message: dict, exclude_token: str | None = None) -> None:
        if duel_id not in self.connections:
            return
        for token, ws in list(self.connections[duel_id].items()):
            if token == exclude_token:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                pass

    async def poll_and_broadcast(self) -> None:
        for duel_id in list(self.connections.keys()):
            try:
                async with aiosqlite.connect(DB_PATH) as db:
                    db.row_factory = aiosqlite.Row

                    state = await get_wordle_duel_state(db, duel_id)
                    current_players = state["players"]
                    prev_players = self._known_state.get(duel_id, [])

                    prev_map = {p["nickname"]: p for p in prev_players}

                    for player in current_players:
                        nick = player["nickname"]
                        prev = prev_map.get(nick)

                        if prev is None:
                            await self.broadcast(duel_id, {"type": "player_joined", "nickname": nick})
                        elif player["solved"] and not prev.get("solved"):
                            await self.broadcast(duel_id, {
                                "type": "player_solved",
                                "nickname": nick,
                                "guesses_used": player["guesses_used"],
                            })
                        elif player["connected"] and not prev.get("connected"):
                            await self.broadcast(duel_id, {"type": "player_reconnected", "nickname": nick})
                        elif not player["connected"] and prev.get("connected"):
                            await self.broadcast(duel_id, {"type": "player_disconnected", "nickname": nick})

                    # Check for new guesses to broadcast results
                    cursor = await db.execute(
                        """SELECT g.result, g.player_token, p.nickname,
                                  (SELECT COUNT(*) FROM wordle_duel_guesses g2
                                   WHERE g2.duel_id = g.duel_id AND g2.player_token = g.player_token) as guess_number
                           FROM wordle_duel_guesses g
                           JOIN wordle_duel_players p ON g.player_token = p.player_token
                           WHERE g.duel_id = ?
                           ORDER BY g.guessed_at""",
                        (duel_id,),
                    )
                    all_guesses = await cursor.fetchall()
                    current_count = len(all_guesses)
                    prev_count = self._known_guesses.get(duel_id, 0)

                    if current_count > prev_count:
                        # Broadcast new guesses
                        for guess in all_guesses[prev_count:]:
                            await self.broadcast(duel_id, {
                                "type": "guess_made",
                                "nickname": guess["nickname"],
                                "guess_number": guess["guess_number"],
                                "result": json.loads(guess["result"]),
                            }, exclude_token=guess["player_token"])

                    self._known_state[duel_id] = current_players
                    self._known_guesses[duel_id] = current_count

            except Exception:
                pass
```

- [ ] **Step 3: Add WebSocket endpoint and polling to main.py**

Initialize the manager and add the WS endpoint and polling task:

```python
wordle_duel_manager = WordleDuelConnectionManager()

@app.websocket("/ws/wordle/duel/{duel_id}")
async def wordle_duel_ws(websocket: WebSocket, duel_id: str, token: str):
    await wordle_duel_manager.connect(duel_id, token, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await wordle_duel_manager.disconnect(duel_id, token)
```

In the lifespan, add the polling loop (only when WS mode is active, same pattern as existing):

```python
if os.environ.get("KONTEXTO_WS_MODE"):
    async def wordle_poll_loop():
        while True:
            await asyncio.sleep(1)
            await wordle_duel_manager.poll_and_broadcast()
    asyncio.create_task(wordle_poll_loop())
```

- [ ] **Step 4: Verify the server starts without errors**

Run: `cd /home/ugura/kontexto/backend && python -c "from main import app; print('App created OK')"`
Expected: `App created OK`

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/websocket_manager.py
git commit -m "feat(wordle): add duel API endpoints and WebSocket manager"
```

---

## Task 7: Frontend — Types, API Client, Storage

**Files:**
- Create: `frontend/lib/wordle-types.ts`
- Create: `frontend/lib/wordle-api.ts`
- Create: `frontend/lib/wordle-storage.ts`

- [ ] **Step 1: Create type definitions**

Create `frontend/lib/wordle-types.ts`:

```typescript
export type TileColor = "GREEN" | "YELLOW" | "GRAY";

export type GameStatus = "playing" | "won" | "lost";

export interface WordleGuessResponse {
  valid: boolean;
  result?: TileColor[];
  error?: string;
  message?: string;
}

export interface WordleGameResponse {
  game_number: number;
}

export interface WordleRevealResponse {
  word: string;
}

export interface WordleDuelPlayer {
  nickname: string;
  guesses_used: number;
  solved: boolean;
  connected: boolean;
}

export interface WordleDuelState {
  game_number: number;
  players: WordleDuelPlayer[];
}

export interface WordleDuelGuessEntry {
  word: string;
  result: TileColor[];
  guessed_at: string;
}

export interface OpponentGuess {
  result: TileColor[];
  nickname: string;
  guessed_at: string;
}

export interface WordleStats {
  played: number;
  won: number;
  currentStreak: number;
  maxStreak: number;
  distribution: number[];
  lastPlayed: number;
}

export type WordleDuelWsMessage =
  | { type: "state"; players: WordleDuelPlayer[] }
  | { type: "player_joined"; nickname: string }
  | { type: "guess_made"; nickname: string; guess_number: number; result: TileColor[] }
  | { type: "player_solved"; nickname: string; guesses_used: number }
  | { type: "player_failed"; nickname: string }
  | { type: "player_disconnected"; nickname: string }
  | { type: "player_reconnected"; nickname: string };
```

- [ ] **Step 2: Create API client**

Create `frontend/lib/wordle-api.ts`:

```typescript
import type {
  TileColor,
  WordleGuessResponse,
  WordleGameResponse,
  WordleRevealResponse,
  WordleDuelState,
  WordleDuelGuessEntry,
} from "./wordle-types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!resp.ok) {
    throw new Error(`API error: ${resp.status}`);
  }
  return resp.json();
}

export async function getWordleGame(): Promise<WordleGameResponse> {
  return request("/wordle/game");
}

export async function submitWordleGuess(
  word: string,
  gameNumber: number,
  hardMode: boolean = false,
  previous: { word: string; result: TileColor[] }[] = []
): Promise<WordleGuessResponse> {
  return request("/wordle/guess", {
    method: "POST",
    body: JSON.stringify({
      word,
      game_number: gameNumber,
      hard_mode: hardMode,
      previous,
    }),
  });
}

export async function revealWordleAnswer(gameNumber: number): Promise<WordleRevealResponse> {
  return request(`/wordle/reveal?game_number=${gameNumber}`);
}

export async function createWordleDuel(
  nickname: string,
  gameNumber: number
): Promise<{ duel_id: string; player_token: string }> {
  return request("/wordle/duel", {
    method: "POST",
    body: JSON.stringify({ nickname, game_number: gameNumber }),
  });
}

export async function joinWordleDuel(
  duelId: string,
  nickname: string
): Promise<{ player_token: string; players: WordleDuelState["players"]; game_number: number }> {
  return request(`/wordle/duel/${duelId}/join`, {
    method: "POST",
    body: JSON.stringify({ nickname }),
  });
}

export async function getWordleDuelState(duelId: string): Promise<WordleDuelState> {
  return request(`/wordle/duel/${duelId}`);
}

export async function submitWordleDuelGuess(
  duelId: string,
  word: string,
  playerToken: string
): Promise<WordleGuessResponse> {
  return request(`/wordle/duel/${duelId}/guess`, {
    method: "POST",
    body: JSON.stringify({ word, player_token: playerToken }),
  });
}

export async function getWordleDuelHistory(
  duelId: string,
  token: string
): Promise<{ guesses: WordleDuelGuessEntry[] }> {
  return request(`/wordle/duel/${duelId}/history?token=${token}`);
}
```

- [ ] **Step 3: Create storage module**

Create `frontend/lib/wordle-storage.ts`:

```typescript
import type { TileColor, WordleStats, GameStatus } from "./wordle-types";

const KEYS = {
  state: "wordle_state",
  stats: "wordle_stats",
  hardMode: "wordle_hard_mode",
  duelToken: (duelId: string) => `wordle_duel_${duelId}`,
};

export interface WordleGameState {
  gameNumber: number;
  guesses: string[];
  evaluations: TileColor[][];
  status: GameStatus;
}

export function loadWordleState(currentGameNumber: number): WordleGameState | null {
  try {
    const raw = localStorage.getItem(KEYS.state);
    if (!raw) return null;
    const state: WordleGameState = JSON.parse(raw);
    if (state.gameNumber !== currentGameNumber) return null;
    return state;
  } catch {
    return null;
  }
}

export function saveWordleState(state: WordleGameState): void {
  localStorage.setItem(KEYS.state, JSON.stringify(state));
}

export function loadWordleStats(): WordleStats {
  try {
    const raw = localStorage.getItem(KEYS.stats);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { played: 0, won: 0, currentStreak: 0, maxStreak: 0, distribution: [0, 0, 0, 0, 0, 0], lastPlayed: -1 };
}

export function saveWordleStats(stats: WordleStats): void {
  localStorage.setItem(KEYS.stats, JSON.stringify(stats));
}

export function updateStatsAfterGame(gameNumber: number, won: boolean, guessCount: number): WordleStats {
  const stats = loadWordleStats();
  stats.played++;
  if (won) {
    stats.won++;
    stats.distribution[guessCount - 1]++;
    if (stats.lastPlayed === gameNumber - 1 || stats.lastPlayed === -1) {
      stats.currentStreak++;
    } else {
      stats.currentStreak = 1;
    }
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
  } else {
    stats.currentStreak = 0;
  }
  stats.lastPlayed = gameNumber;
  saveWordleStats(stats);
  return stats;
}

export function loadHardMode(): boolean {
  return localStorage.getItem(KEYS.hardMode) === "true";
}

export function saveHardMode(enabled: boolean): void {
  localStorage.setItem(KEYS.hardMode, enabled ? "true" : "false");
}

export function loadDuelToken(duelId: string): string | null {
  return localStorage.getItem(KEYS.duelToken(duelId));
}

export function saveDuelToken(duelId: string, token: string): void {
  localStorage.setItem(KEYS.duelToken(duelId), token);
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /home/ugura/kontexto/frontend && npx tsc --noEmit lib/wordle-types.ts lib/wordle-api.ts lib/wordle-storage.ts 2>&1 | head -20`
Expected: No errors (or only errors about missing dependencies that exist).

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/wordle-types.ts frontend/lib/wordle-api.ts frontend/lib/wordle-storage.ts
git commit -m "feat(wordle): add frontend types, API client, and localStorage management"
```

---

## Task 8: Frontend — Tile, TileRow, Board Components

**Files:**
- Create: `frontend/components/wordle/Tile.tsx`
- Create: `frontend/components/wordle/TileRow.tsx`
- Create: `frontend/components/wordle/Board.tsx`

- [ ] **Step 1: Create Tile component with animations**

Create `frontend/components/wordle/Tile.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import type { TileColor } from "@/lib/wordle-types";

const COLOR_MAP: Record<TileColor, string> = {
  GREEN: "bg-green-600 border-green-600 text-white",
  YELLOW: "bg-yellow-500 border-yellow-500 text-white",
  GRAY: "bg-zinc-500 border-zinc-500 text-white dark:bg-zinc-600 dark:border-zinc-600",
};

interface TileProps {
  letter: string;
  color?: TileColor;
  /** Delay in ms before flip animation starts */
  flipDelay?: number;
  /** Whether to play the pop animation on letter entry */
  pop?: boolean;
  /** Whether to play the bounce animation on win */
  bounce?: boolean;
  bounceDelay?: number;
}

export default function Tile({ letter, color, flipDelay = 0, pop = false, bounce = false, bounceDelay = 0 }: TileProps) {
  const [flipped, setFlipped] = useState(false);
  const [showColor, setShowColor] = useState(false);

  useEffect(() => {
    if (!color || flipped) return;
    const flipTimer = setTimeout(() => setFlipped(true), flipDelay);
    // Color shows at halfway point of flip
    const colorTimer = setTimeout(() => setShowColor(true), flipDelay + 250);
    return () => {
      clearTimeout(flipTimer);
      clearTimeout(colorTimer);
    };
  }, [color, flipDelay, flipped]);

  const baseClasses = "w-[58px] h-[58px] sm:w-[62px] sm:h-[62px] border-2 flex items-center justify-center text-2xl font-bold uppercase select-none";

  const stateClasses = showColor && color
    ? COLOR_MAP[color]
    : letter
      ? "border-zinc-400 dark:border-zinc-500 text-zinc-800 dark:text-zinc-100"
      : "border-zinc-300 dark:border-zinc-700";

  const animationClasses = [
    pop && !color ? "animate-wordle-pop" : "",
    flipped ? "animate-wordle-flip" : "",
    bounce ? "animate-wordle-bounce" : "",
  ].filter(Boolean).join(" ");

  const bounceStyle = bounce ? { animationDelay: `${bounceDelay}ms` } : undefined;

  return (
    <div
      className={`${baseClasses} ${stateClasses} ${animationClasses} transition-colors`}
      style={bounceStyle}
    >
      {letter}
    </div>
  );
}
```

- [ ] **Step 2: Create TileRow component with shake animation**

Create `frontend/components/wordle/TileRow.tsx`:

```tsx
"use client";

import type { TileColor } from "@/lib/wordle-types";
import Tile from "./Tile";

interface TileRowProps {
  letters: string[];       // 0-5 letters
  colors?: TileColor[];    // undefined if not yet evaluated
  shake?: boolean;
  bounce?: boolean;
  flipDelay?: number;      // base delay for flip stagger (row-level offset)
  pop?: boolean;           // pop the last typed letter
}

export default function TileRow({ letters, colors, shake = false, bounce = false, flipDelay = 0, pop = false }: TileRowProps) {
  const tiles = Array.from({ length: 5 }, (_, i) => ({
    letter: letters[i] || "",
    color: colors?.[i],
  }));

  return (
    <div className={`flex gap-1.5 ${shake ? "animate-wordle-shake" : ""}`}>
      {tiles.map((tile, i) => (
        <Tile
          key={i}
          letter={tile.letter}
          color={tile.color}
          flipDelay={flipDelay + i * 300}
          pop={pop && i === letters.length - 1 && !tile.color}
          bounce={bounce}
          bounceDelay={i * 100}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create Board component**

Create `frontend/components/wordle/Board.tsx`:

```tsx
"use client";

import type { TileColor } from "@/lib/wordle-types";
import TileRow from "./TileRow";

interface BoardProps {
  guesses: string[];
  evaluations: TileColor[][];
  currentGuess: string;
  currentRow: number;
  shakeRow?: number | null;
  wonRow?: number | null;
}

export default function Board({ guesses, evaluations, currentGuess, currentRow, shakeRow, wonRow }: BoardProps) {
  const rows = Array.from({ length: 6 }, (_, i) => {
    if (i < guesses.length) {
      // Submitted row
      return {
        letters: [...guesses[i]],
        colors: evaluations[i],
        shake: false,
        bounce: wonRow === i,
        pop: false,
      };
    }
    if (i === currentRow) {
      // Current input row
      return {
        letters: [...currentGuess],
        colors: undefined,
        shake: shakeRow === i,
        bounce: false,
        pop: currentGuess.length > 0,
      };
    }
    // Empty row
    return { letters: [], colors: undefined, shake: false, bounce: false, pop: false };
  });

  return (
    <div className="flex flex-col gap-1.5 items-center py-4">
      {rows.map((row, i) => (
        <TileRow
          key={i}
          letters={row.letters}
          colors={row.colors}
          shake={row.shake}
          bounce={row.bounce}
          pop={row.pop}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Add CSS animations to global styles**

Add Wordle-specific keyframes to `frontend/app/globals.css` (or the main CSS file):

```css
@keyframes wordle-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

@keyframes wordle-flip {
  0% { transform: rotateX(0deg); }
  50% { transform: rotateX(-90deg); }
  100% { transform: rotateX(0deg); }
}

@keyframes wordle-shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-5px); }
  40%, 80% { transform: translateX(5px); }
}

@keyframes wordle-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-30px); }
}

.animate-wordle-pop {
  animation: wordle-pop 100ms ease-in-out;
}

.animate-wordle-flip {
  animation: wordle-flip 500ms ease-in-out;
  transform-style: preserve-3d;
}

.animate-wordle-shake {
  animation: wordle-shake 600ms ease-in-out;
}

.animate-wordle-bounce {
  animation: wordle-bounce 400ms ease-in-out;
  animation-fill-mode: both;
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/components/wordle/Tile.tsx frontend/components/wordle/TileRow.tsx frontend/components/wordle/Board.tsx frontend/app/globals.css
git commit -m "feat(wordle): add Tile, TileRow, Board components with animations"
```

---

## Task 9: Frontend — Keyboard Component

**Files:**
- Create: `frontend/components/wordle/Key.tsx`
- Create: `frontend/components/wordle/Keyboard.tsx`

- [ ] **Step 1: Create Key component**

Create `frontend/components/wordle/Key.tsx`:

```tsx
"use client";

type KeyColor = "green" | "yellow" | "gray" | "default";

const KEY_COLOR_MAP: Record<KeyColor, string> = {
  green: "bg-green-600 text-white border-green-600",
  yellow: "bg-yellow-500 text-white border-yellow-500",
  gray: "bg-zinc-500 text-white border-zinc-500 dark:bg-zinc-600",
  default: "bg-zinc-200 text-zinc-800 border-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:border-zinc-600",
};

interface KeyProps {
  label: string;
  value: string;
  color?: KeyColor;
  wide?: boolean;
  onClick: (value: string) => void;
}

export default function Key({ label, value, color = "default", wide = false, onClick }: KeyProps) {
  return (
    <button
      type="button"
      className={`${KEY_COLOR_MAP[color]} ${wide ? "px-3 sm:px-4 text-xs" : "w-[32px] sm:w-[40px]"} h-[52px] sm:h-[58px] rounded font-bold uppercase text-sm flex items-center justify-center border cursor-pointer active:scale-95 transition-transform select-none`}
      onClick={() => onClick(value)}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 2: Create Keyboard component (QWERTZ)**

Create `frontend/components/wordle/Keyboard.tsx`:

```tsx
"use client";

import Key from "./Key";

type KeyColor = "green" | "yellow" | "gray" | "default";

const ROWS = [
  ["Q", "W", "E", "R", "T", "Z", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Y", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
];

interface KeyboardProps {
  letterStates: Map<string, KeyColor>;
  onKey: (key: string) => void;
}

export default function Keyboard({ letterStates, onKey }: KeyboardProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 pb-4">
      {ROWS.map((row, ri) => (
        <div key={ri} className="flex gap-1">
          {row.map((key) => {
            if (key === "ENTER") {
              return <Key key={key} label="Enter" value="ENTER" wide onClick={onKey} />;
            }
            if (key === "BACKSPACE") {
              return <Key key={key} label="⌫" value="BACKSPACE" wide onClick={onKey} />;
            }
            return (
              <Key
                key={key}
                label={key}
                value={key}
                color={letterStates.get(key.toLowerCase()) || "default"}
                onClick={onKey}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/wordle/Key.tsx frontend/components/wordle/Keyboard.tsx
git commit -m "feat(wordle): add QWERTZ keyboard component with color states"
```

---

## Task 10: Frontend — WordleGame Main Component

**Files:**
- Create: `frontend/components/wordle/WordleGame.tsx`

- [ ] **Step 1: Create the main game component**

Create `frontend/components/wordle/WordleGame.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import Board from "./Board";
import Keyboard from "./Keyboard";
import type { TileColor, GameStatus } from "@/lib/wordle-types";
import { getWordleGame, submitWordleGuess } from "@/lib/wordle-api";
import {
  loadWordleState, saveWordleState, loadHardMode,
  updateStatsAfterGame, loadWordleStats,
  type WordleGameState,
} from "@/lib/wordle-storage";

const WIN_MESSAGES = ["Genial!", "Großartig!", "Stark!", "Gut!", "Knapp!", "Gerade so!"];

interface WordleGameProps {
  onStatsOpen?: () => void;
  onGameEnd?: (won: boolean, guessCount: number) => void;
}

export default function WordleGame({ onStatsOpen, onGameEnd }: WordleGameProps) {
  const [gameNumber, setGameNumber] = useState<number | null>(null);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [evaluations, setEvaluations] = useState<TileColor[][]>([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [gameStatus, setGameStatus] = useState<GameStatus>("playing");
  const [letterStates, setLetterStates] = useState<Map<string, "green" | "yellow" | "gray">>(new Map());
  const [shakeRow, setShakeRow] = useState<number | null>(null);
  const [wonRow, setWonRow] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const hardMode = loadHardMode();

  // Load game on mount
  useEffect(() => {
    getWordleGame().then(({ game_number }) => {
      setGameNumber(game_number);
      const saved = loadWordleState(game_number);
      if (saved) {
        setGuesses(saved.guesses);
        setEvaluations(saved.evaluations);
        setGameStatus(saved.status);
        // Rebuild letter states
        const states = new Map<string, "green" | "yellow" | "gray">();
        for (let g = 0; g < saved.guesses.length; g++) {
          for (let i = 0; i < 5; i++) {
            const letter = saved.guesses[g][i];
            const color = saved.evaluations[g][i];
            const mapped = color === "GREEN" ? "green" : color === "YELLOW" ? "yellow" : "gray";
            const current = states.get(letter);
            if (mapped === "green" || (!current && mapped !== "green") || (current === "gray" && mapped === "yellow")) {
              if (mapped === "green" || !current || (current !== "green" && (mapped === "yellow" || current !== "yellow"))) {
                states.set(letter, mapped);
              }
            }
          }
        }
        setLetterStates(states);
      }
    });
  }, []);

  const updateLetterStates = useCallback((guess: string, evaluation: TileColor[]) => {
    setLetterStates((prev) => {
      const next = new Map(prev);
      for (let i = 0; i < 5; i++) {
        const letter = guess[i];
        const color = evaluation[i] === "GREEN" ? "green" : evaluation[i] === "YELLOW" ? "yellow" : "gray";
        const current = next.get(letter);
        if (color === "green") {
          next.set(letter, "green");
        } else if (color === "yellow" && current !== "green") {
          next.set(letter, "yellow");
        } else if (color === "gray" && !current) {
          next.set(letter, "gray");
        }
      }
      return next;
    });
  }, []);

  const shake = useCallback(() => {
    setShakeRow(guesses.length);
    setTimeout(() => setShakeRow(null), 600);
  }, [guesses.length]);

  const submitGuess = useCallback(async () => {
    if (gameNumber === null || submitting || gameStatus !== "playing") return;

    const word = currentGuess.toLowerCase();
    if (word.length < 5) {
      toast("Nicht genug Buchstaben");
      shake();
      return;
    }

    setSubmitting(true);
    try {
      const previous = guesses.map((g, i) => ({ word: g, result: evaluations[i] }));
      const resp = await submitWordleGuess(word, gameNumber, hardMode, previous);

      if (!resp.valid) {
        if (resp.error === "not_in_word_list") {
          toast("Nicht im Wörterbuch");
        } else if (resp.error === "hard_mode_violation") {
          toast(resp.message || "Hard Mode Verstoß");
        }
        shake();
        return;
      }

      const newGuesses = [...guesses, word];
      const newEvaluations = [...evaluations, resp.result!];
      const won = resp.result!.every((c) => c === "GREEN");
      const lost = !won && newGuesses.length >= 6;
      const newStatus: GameStatus = won ? "won" : lost ? "lost" : "playing";

      setGuesses(newGuesses);
      setEvaluations(newEvaluations);
      setCurrentGuess("");
      setGameStatus(newStatus);
      updateLetterStates(word, resp.result!);

      // Save state
      const state: WordleGameState = {
        gameNumber,
        guesses: newGuesses,
        evaluations: newEvaluations,
        status: newStatus,
      };
      saveWordleState(state);

      if (won) {
        // Delay win effects until flip animation completes (~1.8s)
        setTimeout(() => {
          setWonRow(newGuesses.length - 1);
          toast(WIN_MESSAGES[newGuesses.length - 1] || "Gewonnen!");
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
          updateStatsAfterGame(gameNumber, true, newGuesses.length);
          onGameEnd?.(true, newGuesses.length);
        }, 1800);
      } else if (lost) {
        setTimeout(async () => {
          // Show the solution word on loss
          const { revealWordleAnswer } = await import("@/lib/wordle-api");
          try {
            const { word } = await revealWordleAnswer(gameNumber);
            toast(word.toUpperCase(), { duration: 5000 });
          } catch {}
          updateStatsAfterGame(gameNumber, false, 6);
          onGameEnd?.(false, 6);
        }, 1800);
      }
    } finally {
      setSubmitting(false);
    }
  }, [gameNumber, currentGuess, guesses, evaluations, submitting, gameStatus, hardMode, shake, updateLetterStates, onGameEnd]);

  const handleKey = useCallback((key: string) => {
    if (gameStatus !== "playing") return;

    if (key === "ENTER") {
      submitGuess();
      return;
    }
    if (key === "BACKSPACE") {
      setCurrentGuess((prev) => prev.slice(0, -1));
      return;
    }
    if (/^[A-Za-z]$/.test(key) && currentGuess.length < 5) {
      setCurrentGuess((prev) => prev + key.toLowerCase());
    }
  }, [gameStatus, currentGuess, submitGuess]);

  // Physical keyboard listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Enter") handleKey("ENTER");
      else if (e.key === "Backspace") handleKey("BACKSPACE");
      else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleKey]);

  if (gameNumber === null) {
    return <div className="flex justify-center py-20 text-zinc-500">Laden...</div>;
  }

  return (
    <div className="flex flex-col items-center max-w-lg mx-auto">
      <Board
        guesses={guesses}
        evaluations={evaluations}
        currentGuess={currentGuess}
        currentRow={guesses.length}
        shakeRow={shakeRow}
        wonRow={wonRow}
      />
      <Keyboard letterStates={letterStates} onKey={handleKey} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/wordle/WordleGame.tsx
git commit -m "feat(wordle): add main WordleGame component with full game logic"
```

---

## Task 11: Frontend — Single-Player Page + Modals

**Files:**
- Create: `frontend/app/wordle/page.tsx`
- Create: `frontend/components/wordle/StatsModal.tsx`
- Create: `frontend/components/wordle/HelpModal.tsx`
- Create: `frontend/components/wordle/SettingsModal.tsx`
- Create: `frontend/components/wordle/ShareButton.tsx`

- [ ] **Step 1: Create StatsModal**

Create `frontend/components/wordle/StatsModal.tsx`:

```tsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { loadWordleStats } from "@/lib/wordle-storage";
import type { WordleStats, TileColor } from "@/lib/wordle-types";
import ShareButton from "./ShareButton";

interface StatsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameNumber: number;
  guesses: string[];
  evaluations: TileColor[][];
  won: boolean;
  hardMode: boolean;
}

export default function StatsModal({ open, onOpenChange, gameNumber, guesses, evaluations, won, hardMode }: StatsModalProps) {
  const stats = loadWordleStats();
  const winPct = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;
  const maxDist = Math.max(...stats.distribution, 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Statistiken</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-4 text-center py-2">
          <div>
            <div className="text-2xl font-bold">{stats.played}</div>
            <div className="text-xs text-zinc-500">Gespielt</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{winPct}</div>
            <div className="text-xs text-zinc-500">Gewinn-%</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{stats.currentStreak}</div>
            <div className="text-xs text-zinc-500">Aktuelle Serie</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{stats.maxStreak}</div>
            <div className="text-xs text-zinc-500">Max Serie</div>
          </div>
        </div>

        <div className="py-2">
          <h4 className="text-sm font-semibold mb-2">Verteilung</h4>
          {stats.distribution.map((count, i) => (
            <div key={i} className="flex items-center gap-2 mb-1">
              <span className="text-sm w-3 text-right">{i + 1}</span>
              <div
                className={`h-5 flex items-center justify-end px-1.5 text-xs text-white font-bold rounded-sm ${
                  won && guesses.length === i + 1 ? "bg-green-600" : "bg-zinc-500"
                }`}
                style={{ width: `${Math.max((count / maxDist) * 100, 8)}%` }}
              >
                {count}
              </div>
            </div>
          ))}
        </div>

        {guesses.length > 0 && (
          <ShareButton
            gameNumber={gameNumber}
            guesses={guesses}
            evaluations={evaluations}
            won={won}
            hardMode={hardMode}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create ShareButton**

Create `frontend/components/wordle/ShareButton.tsx`:

```tsx
"use client";

import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TileColor } from "@/lib/wordle-types";

const EMOJI_MAP: Record<TileColor, string> = {
  GREEN: "\u{1F7E9}",
  YELLOW: "\u{1F7E8}",
  GRAY: "\u{2B1B}",
};

interface ShareButtonProps {
  gameNumber: number;
  guesses: string[];
  evaluations: TileColor[][];
  won: boolean;
  hardMode: boolean;
}

export default function ShareButton({ gameNumber, guesses, evaluations, won, hardMode }: ShareButtonProps) {
  const handleShare = () => {
    const score = won ? `${guesses.length}/6` : "X/6";
    const hm = hardMode ? "*" : "";
    const grid = evaluations
      .map((row) => row.map((c) => EMOJI_MAP[c]).join(""))
      .join("\n");

    const text = `Wördle ${gameNumber} ${score}${hm}\n\n${grid}`;
    navigator.clipboard.writeText(text).then(() => toast("Kopiert!"));
  };

  return (
    <Button onClick={handleShare} className="w-full gap-2">
      <Copy className="w-4 h-4" /> Teilen
    </Button>
  );
}
```

- [ ] **Step 3: Create HelpModal**

Create `frontend/components/wordle/HelpModal.tsx`:

```tsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Tile from "./Tile";

interface HelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function HelpModal({ open, onOpenChange }: HelpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>So funktioniert Wördle</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p>Errate das Wördle in 6 Versuchen. Jeder Versuch muss ein gültiges deutsches 5-Buchstaben-Wort sein.</p>
          <p>Nach jedem Versuch zeigen die Farben der Kacheln, wie nah dein Versuch war:</p>

          <div>
            <div className="flex gap-1 mb-1">
              <Tile letter="K" color="GREEN" />
              <Tile letter="R" />
              <Tile letter="A" />
              <Tile letter="F" />
              <Tile letter="T" />
            </div>
            <p><strong>K</strong> ist im Wort und an der richtigen Stelle.</p>
          </div>

          <div>
            <div className="flex gap-1 mb-1">
              <Tile letter="S" />
              <Tile letter="T" color="YELLOW" />
              <Tile letter="E" />
              <Tile letter="R" />
              <Tile letter="N" />
            </div>
            <p><strong>T</strong> ist im Wort, aber an der falschen Stelle.</p>
          </div>

          <div>
            <div className="flex gap-1 mb-1">
              <Tile letter="B" />
              <Tile letter="L" />
              <Tile letter="U" />
              <Tile letter="M" />
              <Tile letter="E" color="GRAY" />
            </div>
            <p><strong>E</strong> ist nicht im Wort.</p>
          </div>

          <p className="text-zinc-500">Jeden Tag gibt es ein neues Wördle. Viel Spaß!</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Create SettingsModal**

Create `frontend/components/wordle/SettingsModal.tsx`:

```tsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hardMode: boolean;
  onHardModeChange: (enabled: boolean) => void;
  canToggleHardMode: boolean;
}

export default function SettingsModal({ open, onOpenChange, hardMode, onHardModeChange, canToggleHardMode }: SettingsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Einstellungen</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-between py-3">
          <div>
            <Label>Hard Mode</Label>
            <p className="text-xs text-zinc-500">
              Enthüllte Hinweise müssen in folgenden Versuchen verwendet werden.
            </p>
          </div>
          <Switch
            checked={hardMode}
            onCheckedChange={onHardModeChange}
            disabled={!canToggleHardMode}
          />
        </div>
        {!canToggleHardMode && (
          <p className="text-xs text-zinc-400">
            Hard Mode kann nur vor dem ersten Versuch aktiviert werden.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Create the single-player page**

Create `frontend/app/wordle/page.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import { Toaster } from "sonner";
import WordleGame from "@/components/wordle/WordleGame";
import StatsModal from "@/components/wordle/StatsModal";
import HelpModal from "@/components/wordle/HelpModal";
import SettingsModal from "@/components/wordle/SettingsModal";
import { loadHardMode, saveHardMode, loadWordleState } from "@/lib/wordle-storage";
import { getWordleGame } from "@/lib/wordle-api";
import { BarChart3, CircleHelp, Settings, Swords } from "lucide-react";
import type { TileColor } from "@/lib/wordle-types";
import Link from "next/link";

export default function WordlePage() {
  const [showStats, setShowStats] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [hardMode, setHardMode] = useState(loadHardMode());
  const [gameData, setGameData] = useState<{
    gameNumber: number;
    guesses: string[];
    evaluations: TileColor[][];
    won: boolean;
  } | null>(null);

  const handleGameEnd = useCallback((won: boolean, guessCount: number) => {
    // Reload state from storage to get final state
    getWordleGame().then(({ game_number }) => {
      const saved = loadWordleState(game_number);
      if (saved) {
        setGameData({
          gameNumber: game_number,
          guesses: saved.guesses,
          evaluations: saved.evaluations,
          won,
        });
        setTimeout(() => setShowStats(true), 2500);
      }
    });
  }, []);

  const handleHardModeChange = useCallback((enabled: boolean) => {
    setHardMode(enabled);
    saveHardMode(enabled);
  }, []);

  // Can only toggle hard mode before any guesses
  const canToggleHardMode = !gameData || gameData.guesses.length === 0;

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
      <Toaster position="top-center" />

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHelp(true)} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
            <CircleHelp className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-1 text-lg font-bold tracking-wider">
          <Link href="/" className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">KONTEXTO</Link>
          <span className="text-zinc-300 dark:text-zinc-600">|</span>
          <span>WÖRDLE</span>
        </div>
        <div className="flex items-center gap-1">
          <Link href="/wordle/duel/create" className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
            <Swords className="w-5 h-5" />
          </Link>
          <button onClick={() => setShowStats(true)} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
            <BarChart3 className="w-5 h-5" />
          </button>
          <button onClick={() => setShowSettings(true)} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <WordleGame onGameEnd={handleGameEnd} />

      <StatsModal
        open={showStats}
        onOpenChange={setShowStats}
        gameNumber={gameData?.gameNumber ?? 0}
        guesses={gameData?.guesses ?? []}
        evaluations={gameData?.evaluations ?? []}
        won={gameData?.won ?? false}
        hardMode={hardMode}
      />
      <HelpModal open={showHelp} onOpenChange={setShowHelp} />
      <SettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
        hardMode={hardMode}
        onHardModeChange={handleHardModeChange}
        canToggleHardMode={canToggleHardMode}
      />
    </div>
  );
}
```

- [ ] **Step 6: Verify the page builds**

Run: `cd /home/ugura/kontexto/frontend && npx next build 2>&1 | tail -10`
Expected: Build succeeds (or only warns about things unrelated to our code).

- [ ] **Step 7: Commit**

```bash
git add frontend/app/wordle/page.tsx frontend/components/wordle/StatsModal.tsx frontend/components/wordle/HelpModal.tsx frontend/components/wordle/SettingsModal.tsx frontend/components/wordle/ShareButton.tsx
git commit -m "feat(wordle): add single-player page with stats, help, settings, and share"
```

---

## Task 12: Frontend — Duel WebSocket Hook + Duel Components

**Files:**
- Create: `frontend/lib/use-wordle-duel-ws.ts`
- Create: `frontend/components/wordle/duel/OpponentBoard.tsx`
- Create: `frontend/components/wordle/duel/DuelHeader.tsx`
- Create: `frontend/components/wordle/duel/DuelResultCard.tsx`

- [ ] **Step 1: Create WebSocket hook**

Create `frontend/lib/use-wordle-duel-ws.ts`:

```typescript
"use client";

import { useEffect, useRef } from "react";
import type { WordleDuelWsMessage } from "./wordle-types";

interface UseWordleDuelWsOptions {
  duelId: string | null;
  token: string | null;
  onMessage: (msg: WordleDuelWsMessage) => void;
}

export function useWordleDuelWs({ duelId, token, onMessage }: UseWordleDuelWsOptions) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!duelId || !token) return;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let closed = false;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${protocol}//${window.location.host}/ws/wordle/duel/${duelId}?token=${token}`;
      ws = new WebSocket(url);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WordleDuelWsMessage;
          onMessageRef.current(msg);
        } catch {}
      };

      ws.onclose = () => {
        if (!closed) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };
    }

    connect();

    return () => {
      closed = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [duelId, token]);
}
```

- [ ] **Step 2: Create OpponentBoard**

Create `frontend/components/wordle/duel/OpponentBoard.tsx`:

```tsx
"use client";

import type { TileColor } from "@/lib/wordle-types";

const SMALL_COLOR_MAP: Record<TileColor, string> = {
  GREEN: "bg-green-600",
  YELLOW: "bg-yellow-500",
  GRAY: "bg-zinc-500 dark:bg-zinc-600",
};

interface OpponentBoardProps {
  guesses: TileColor[][]; // Array of color arrays (no letters!)
  nickname: string;
  solved: boolean;
}

export default function OpponentBoard({ guesses, nickname, solved }: OpponentBoardProps) {
  const rows = Array.from({ length: 6 }, (_, i) => guesses[i] || null);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-xs font-semibold text-zinc-500 mb-1">{nickname}</div>
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-0.5">
          {Array.from({ length: 5 }, (_, ci) => (
            <div
              key={ci}
              className={`w-5 h-5 sm:w-6 sm:h-6 rounded-sm ${
                row ? `${SMALL_COLOR_MAP[row[ci]]} animate-wordle-fade-in` : "bg-zinc-200 dark:bg-zinc-700"
              }`}
            />
          ))}
        </div>
      ))}
      {solved && <div className="text-xs text-green-600 font-semibold mt-1">Gelöst!</div>}
    </div>
  );
}
```

- [ ] **Step 3: Create DuelHeader**

Create `frontend/components/wordle/duel/DuelHeader.tsx`:

```tsx
"use client";

import type { WordleDuelPlayer } from "@/lib/wordle-types";

interface DuelHeaderProps {
  players: WordleDuelPlayer[];
  currentNickname: string | null;
}

export default function DuelHeader({ players, currentNickname }: DuelHeaderProps) {
  return (
    <div className="flex gap-3 justify-center py-2 flex-wrap">
      {players.map((p) => (
        <div
          key={p.nickname}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
            p.solved
              ? "bg-green-100 dark:bg-green-900/30"
              : "bg-zinc-100 dark:bg-zinc-800"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${p.connected ? "bg-green-500" : "bg-zinc-400"}`} />
          <span className="font-medium">
            {p.nickname}
            {p.nickname === currentNickname && " (du)"}
          </span>
          <span className="text-zinc-500">{p.guesses_used}x</span>
          {p.solved && <span className="text-green-600">&#10003;</span>}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create DuelResultCard**

Create `frontend/components/wordle/duel/DuelResultCard.tsx`:

```tsx
"use client";

import type { WordleDuelPlayer } from "@/lib/wordle-types";
import { Trophy } from "lucide-react";

interface DuelResultCardProps {
  players: WordleDuelPlayer[];
  currentNickname: string | null;
}

export default function DuelResultCard({ players, currentNickname }: DuelResultCardProps) {
  const sorted = [...players].sort((a, b) => {
    if (a.solved && !b.solved) return -1;
    if (!a.solved && b.solved) return 1;
    return a.guesses_used - b.guesses_used;
  });

  return (
    <div className="max-w-sm mx-auto bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-6 my-4">
      <h3 className="text-lg font-bold text-center mb-4">Duell Ergebnis</h3>
      <div className="space-y-3">
        {sorted.map((p, i) => (
          <div
            key={p.nickname}
            className={`flex items-center justify-between p-3 rounded ${
              i === 0 && p.solved ? "bg-green-50 dark:bg-green-900/20" : "bg-zinc-50 dark:bg-zinc-700/50"
            }`}
          >
            <div className="flex items-center gap-2">
              {i === 0 && p.solved && <Trophy className="w-4 h-4 text-yellow-500" />}
              <span className="font-medium">
                {p.nickname}
                {p.nickname === currentNickname && " (du)"}
              </span>
            </div>
            <div className="text-sm text-zinc-500">
              {p.solved ? `${p.guesses_used}/6` : "X/6"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add fade-in animation to globals.css**

```css
@keyframes wordle-fade-in {
  0% { opacity: 0; transform: scale(0.8); }
  100% { opacity: 1; transform: scale(1); }
}

.animate-wordle-fade-in {
  animation: wordle-fade-in 200ms ease-out;
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/use-wordle-duel-ws.ts frontend/components/wordle/duel/OpponentBoard.tsx frontend/components/wordle/duel/DuelHeader.tsx frontend/components/wordle/duel/DuelResultCard.tsx frontend/app/globals.css
git commit -m "feat(wordle): add duel WebSocket hook and duel UI components"
```

---

## Task 13: Frontend — Duel Pages

**Files:**
- Create: `frontend/app/wordle/duel/create/page.tsx`
- Create: `frontend/app/wordle/duel/page.tsx`

- [ ] **Step 1: Create duel create page**

Create `frontend/app/wordle/duel/create/page.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getWordleGame, createWordleDuel } from "@/lib/wordle-api";
import { saveDuelToken } from "@/lib/wordle-storage";
import Link from "next/link";

export default function WordleDuelCreatePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [gameNumber, setGameNumber] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getWordleGame().then(({ game_number }) => setGameNumber(game_number));
  }, []);

  const handleCreate = async () => {
    if (!nickname.trim() || gameNumber === null) return;
    setCreating(true);
    try {
      const { duel_id, player_token } = await createWordleDuel(nickname.trim(), gameNumber);
      saveDuelToken(duel_id, player_token);
      router.push(`/wordle/duel/${duel_id}/`);
    } catch {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
      <header className="flex items-center justify-center px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-1 text-lg font-bold tracking-wider">
          <Link href="/wordle" className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">WÖRDLE</Link>
          <span className="text-zinc-300 dark:text-zinc-600">|</span>
          <span>DUELL</span>
        </div>
      </header>

      <div className="max-w-sm mx-auto p-6 space-y-6 mt-8">
        <h2 className="text-xl font-bold text-center">Wördle Duell erstellen</h2>

        <div className="space-y-2">
          <Label htmlFor="nickname">Dein Nickname</Label>
          <Input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="z.B. Max"
            maxLength={20}
          />
        </div>

        <div className="text-sm text-zinc-500">
          Spiel #{gameNumber ?? "..."} (heutiges Wördle)
        </div>

        <Button
          onClick={handleCreate}
          disabled={!nickname.trim() || creating}
          className="w-full"
        >
          {creating ? "Erstellen..." : "Duell erstellen"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create duel play page**

Create `frontend/app/wordle/duel/page.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast, Toaster } from "sonner";
import confetti from "canvas-confetti";
import Board from "@/components/wordle/Board";
import Keyboard from "@/components/wordle/Keyboard";
import OpponentBoard from "@/components/wordle/duel/OpponentBoard";
import DuelHeader from "@/components/wordle/duel/DuelHeader";
import DuelResultCard from "@/components/wordle/duel/DuelResultCard";
import { useWordleDuelWs } from "@/lib/use-wordle-duel-ws";
import {
  getWordleDuelState, submitWordleDuelGuess, getWordleDuelHistory, joinWordleDuel,
} from "@/lib/wordle-api";
import { loadDuelToken, saveDuelToken } from "@/lib/wordle-storage";
import type { TileColor, WordleDuelPlayer, WordleDuelWsMessage, GameStatus } from "@/lib/wordle-types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy } from "lucide-react";
import Link from "next/link";

export default function WordleDuelPage() {
  // Extract duel_id from URL path: /wordle/duel/{id}/
  const [duelId, setDuelId] = useState<string | null>(null);
  const [playerToken, setPlayerToken] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [players, setPlayers] = useState<WordleDuelPlayer[]>([]);
  const [gameNumber, setGameNumber] = useState<number | null>(null);

  // Own game state
  const [guesses, setGuesses] = useState<string[]>([]);
  const [evaluations, setEvaluations] = useState<TileColor[][]>([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [gameStatus, setGameStatus] = useState<GameStatus>("playing");
  const [letterStates, setLetterStates] = useState<Map<string, "green" | "yellow" | "gray">>(new Map());
  const [shakeRow, setShakeRow] = useState<number | null>(null);
  const [wonRow, setWonRow] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Opponent guesses (colors only)
  const [opponentGuesses, setOpponentGuesses] = useState<Map<string, TileColor[][]>>(new Map());

  // Join dialog
  const [showJoin, setShowJoin] = useState(false);
  const [joinNickname, setJoinNickname] = useState("");

  // Extract duel_id from pathname
  useEffect(() => {
    const parts = window.location.pathname.split("/").filter(Boolean);
    // /wordle/duel/{id}
    const duelIdx = parts.indexOf("duel");
    if (duelIdx >= 0 && parts[duelIdx + 1]) {
      const id = parts[duelIdx + 1];
      setDuelId(id);
      const token = loadDuelToken(id);
      if (token) {
        setPlayerToken(token);
      } else {
        setShowJoin(true);
      }
    }
  }, []);

  // Load initial state
  useEffect(() => {
    if (!duelId || !playerToken) return;

    const load = async () => {
      const state = await getWordleDuelState(duelId);
      setPlayers(state.players);
      setGameNumber(state.game_number);

      const history = await getWordleDuelHistory(duelId, playerToken);
      const gs: string[] = [];
      const evs: TileColor[][] = [];
      for (const g of history.guesses) {
        gs.push(g.word);
        evs.push(g.result);
      }
      setGuesses(gs);
      setEvaluations(evs);

      const won = evs.length > 0 && evs[evs.length - 1].every((c) => c === "GREEN");
      const lost = !won && gs.length >= 6;
      setGameStatus(won ? "won" : lost ? "lost" : "playing");

      // Rebuild letter states
      const states = new Map<string, "green" | "yellow" | "gray">();
      for (let g = 0; g < gs.length; g++) {
        for (let i = 0; i < 5; i++) {
          const letter = gs[g][i];
          const color = evs[g][i] === "GREEN" ? "green" : evs[g][i] === "YELLOW" ? "yellow" : "gray";
          const current = states.get(letter);
          if (color === "green") states.set(letter, "green");
          else if (color === "yellow" && current !== "green") states.set(letter, "yellow");
          else if (color === "gray" && !current) states.set(letter, "gray");
        }
      }
      setLetterStates(states);

      // Find own nickname
      // We need player-info endpoint or derive from state
      const me = state.players.find((p) => {
        // Match by guesses_used count as heuristic
        return p.guesses_used === gs.length;
      });
      if (me) setNickname(me.nickname);
    };
    load();
  }, [duelId, playerToken]);

  // WebSocket handler
  const handleWsMessage = useCallback((msg: WordleDuelWsMessage) => {
    if (msg.type === "state") {
      setPlayers(msg.players);
    } else if (msg.type === "player_joined") {
      toast(`${msg.nickname} ist beigetreten`);
      setPlayers((prev) => [...prev, { nickname: msg.nickname, guesses_used: 0, solved: false, connected: true }]);
    } else if (msg.type === "guess_made") {
      setOpponentGuesses((prev) => {
        const next = new Map(prev);
        const existing = next.get(msg.nickname) || [];
        next.set(msg.nickname, [...existing, msg.result]);
        return next;
      });
      setPlayers((prev) =>
        prev.map((p) => p.nickname === msg.nickname ? { ...p, guesses_used: msg.guess_number } : p)
      );
    } else if (msg.type === "player_solved") {
      toast(`${msg.nickname} hat gelöst in ${msg.guesses_used} Versuchen!`);
      setPlayers((prev) =>
        prev.map((p) => p.nickname === msg.nickname ? { ...p, solved: true, guesses_used: msg.guesses_used } : p)
      );
    } else if (msg.type === "player_failed") {
      toast(`${msg.nickname} hat nicht gelöst`);
    } else if (msg.type === "player_disconnected") {
      setPlayers((prev) =>
        prev.map((p) => p.nickname === msg.nickname ? { ...p, connected: false } : p)
      );
    } else if (msg.type === "player_reconnected") {
      setPlayers((prev) =>
        prev.map((p) => p.nickname === msg.nickname ? { ...p, connected: true } : p)
      );
    }
  }, []);

  useWordleDuelWs({ duelId, token: playerToken, onMessage: handleWsMessage });

  // Join handler
  const handleJoin = async () => {
    if (!duelId || !joinNickname.trim()) return;
    try {
      const resp = await joinWordleDuel(duelId, joinNickname.trim());
      saveDuelToken(duelId, resp.player_token);
      setPlayerToken(resp.player_token);
      setNickname(joinNickname.trim());
      setPlayers(resp.players);
      setGameNumber(resp.game_number);
      setShowJoin(false);
    } catch {
      toast("Fehler beim Beitreten");
    }
  };

  // Guess submission
  const submitGuess = useCallback(async () => {
    if (!duelId || !playerToken || submitting || gameStatus !== "playing") return;
    const word = currentGuess.toLowerCase();
    if (word.length < 5) {
      toast("Nicht genug Buchstaben");
      setShakeRow(guesses.length);
      setTimeout(() => setShakeRow(null), 600);
      return;
    }

    setSubmitting(true);
    try {
      const resp = await submitWordleDuelGuess(duelId, word, playerToken);
      if (!resp.valid) {
        toast(resp.error === "not_in_word_list" ? "Nicht im Wörterbuch" : "Fehler");
        setShakeRow(guesses.length);
        setTimeout(() => setShakeRow(null), 600);
        return;
      }

      const newGuesses = [...guesses, word];
      const newEvals = [...evaluations, resp.result!];
      const won = resp.result!.every((c) => c === "GREEN");
      const lost = !won && newGuesses.length >= 6;

      setGuesses(newGuesses);
      setEvaluations(newEvals);
      setCurrentGuess("");
      setGameStatus(won ? "won" : lost ? "lost" : "playing");

      // Update letter states
      setLetterStates((prev) => {
        const next = new Map(prev);
        for (let i = 0; i < 5; i++) {
          const letter = word[i];
          const color = resp.result![i] === "GREEN" ? "green" as const : resp.result![i] === "YELLOW" ? "yellow" as const : "gray" as const;
          const current = next.get(letter);
          if (color === "green") next.set(letter, "green");
          else if (color === "yellow" && current !== "green") next.set(letter, "yellow");
          else if (color === "gray" && !current) next.set(letter, "gray");
        }
        return next;
      });

      // Update own player in list
      setPlayers((prev) =>
        prev.map((p) => p.nickname === nickname ? { ...p, guesses_used: newGuesses.length, solved: won } : p)
      );

      if (won) {
        setTimeout(() => {
          setWonRow(newGuesses.length - 1);
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        }, 1800);
      }
    } finally {
      setSubmitting(false);
    }
  }, [duelId, playerToken, currentGuess, guesses, evaluations, submitting, gameStatus, nickname]);

  const handleKey = useCallback((key: string) => {
    if (gameStatus !== "playing") return;
    if (key === "ENTER") { submitGuess(); return; }
    if (key === "BACKSPACE") { setCurrentGuess((prev) => prev.slice(0, -1)); return; }
    if (/^[A-Za-z]$/.test(key) && currentGuess.length < 5) {
      setCurrentGuess((prev) => prev + key.toLowerCase());
    }
  }, [gameStatus, currentGuess, submitGuess]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Enter") handleKey("ENTER");
      else if (e.key === "Backspace") handleKey("BACKSPACE");
      else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleKey]);

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/wordle/duel/${duelId}/`);
    toast("Link kopiert!");
  };

  const allFinished = players.length > 1 && players.every((p) => p.solved || p.guesses_used >= 6);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
      <Toaster position="top-center" />

      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <Link href="/wordle" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← Wördle
        </Link>
        <span className="text-lg font-bold tracking-wider">DUELL</span>
        <button onClick={copyLink} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
          <Copy className="w-5 h-5" />
        </button>
      </header>

      {players.length > 0 && <DuelHeader players={players} currentNickname={nickname} />}

      <div className="flex flex-col lg:flex-row items-start justify-center gap-6 px-4">
        {/* Opponent boards */}
        <div className="flex gap-4 flex-wrap justify-center lg:order-2">
          {players
            .filter((p) => p.nickname !== nickname)
            .map((p) => (
              <OpponentBoard
                key={p.nickname}
                nickname={p.nickname}
                guesses={opponentGuesses.get(p.nickname) || []}
                solved={p.solved}
              />
            ))}
        </div>

        {/* Own board */}
        <div className="lg:order-1">
          <Board
            guesses={guesses}
            evaluations={evaluations}
            currentGuess={currentGuess}
            currentRow={guesses.length}
            shakeRow={shakeRow}
            wonRow={wonRow}
          />
        </div>
      </div>

      <Keyboard letterStates={letterStates} onKey={handleKey} />

      {allFinished && <DuelResultCard players={players} currentNickname={nickname} />}

      {/* Join Dialog */}
      <Dialog open={showJoin} onOpenChange={setShowJoin}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Wördle Duell beitreten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Dein Nickname</Label>
              <Input
                value={joinNickname}
                onChange={(e) => setJoinNickname(e.target.value)}
                placeholder="z.B. Anna"
                maxLength={20}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
            </div>
            <Button onClick={handleJoin} disabled={!joinNickname.trim()} className="w-full">
              Beitreten
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd /home/ugura/kontexto/frontend && npx next build 2>&1 | tail -10`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/wordle/duel/create/page.tsx frontend/app/wordle/duel/page.tsx
git commit -m "feat(wordle): add duel create and gameplay pages"
```

---

## Task 14: Header Integration

**Files:**
- Modify: `frontend/components/Header.tsx`

- [ ] **Step 1: Read the current Header component**

Read `frontend/components/Header.tsx` to understand the existing structure, then add the game switcher.

- [ ] **Step 2: Add game switcher links**

In the Header component, replace the static "KONTEXTO" title with a switcher that highlights the active game based on the current pathname. Use `usePathname()` from `next/navigation` to detect the current route.

The title section should render:
```tsx
<div className="flex items-center gap-1 text-lg font-bold tracking-wider">
  <Link href="/" className={pathname.startsWith("/wordle") ? "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" : ""}>
    KONTEXTO
  </Link>
  <span className="text-zinc-300 dark:text-zinc-600">|</span>
  <Link href="/wordle" className={!pathname.startsWith("/wordle") ? "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" : ""}>
    WÖRDLE
  </Link>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/Header.tsx
git commit -m "feat(wordle): add game switcher to header (Kontexto | Wördle)"
```

---

## Task 15: Nginx & Infrastructure

**Files:**
- Modify: `nginx.conf`

- [ ] **Step 1: Read current nginx.conf**

Read `nginx.conf` to find the existing routing rules.

- [ ] **Step 2: Add Wordle routes**

Add these location blocks (before the default `/` fallback):

```nginx
# Wordle WebSocket
location /ws/wordle/ {
    proxy_pass http://127.0.0.1:8001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 86400;
}

# Wordle API
location /api/wordle/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# Wordle SPA fallback
location /wordle/ {
    try_files $uri $uri/ /wordle/index.html;
}
```

Note: `/api/wordle/` may already be covered by the existing `/api/` location block. If the existing block is `location /api/` (prefix match), it already matches `/api/wordle/`. Check and only add if needed. Same for `/ws/wordle/` — if `/ws/` already proxies all WebSocket traffic, `/ws/wordle/` is already covered.

The SPA fallback for `/wordle/` IS needed as a new block since the default fallback goes to `/index.html`.

- [ ] **Step 3: Commit**

```bash
git add nginx.conf
git commit -m "feat(wordle): add nginx routing for /wordle/ SPA fallback"
```

---

## Task 16: End-to-End Verification

- [ ] **Step 1: Run all backend tests**

Run: `cd /home/ugura/kontexto/backend && python -m pytest test_wordle.py test_wordle_api.py test_wordle_duel.py -v`
Expected: All tests PASS.

- [ ] **Step 2: Build frontend**

Run: `cd /home/ugura/kontexto/frontend && npx next build 2>&1 | tail -20`
Expected: Build succeeds with `/wordle` page listed in output.

- [ ] **Step 3: Start dev servers and smoke test**

Run backend: `cd /home/ugura/kontexto/backend && KONTEXTO_DATA_DIR=../data KONTEXTO_DEV=1 uvicorn main:app --port 8000 &`
Run frontend: `cd /home/ugura/kontexto/frontend && npm run dev &`

Test endpoints:
```bash
# Get game number
curl http://localhost:8000/api/wordle/game

# Submit a guess (use a word from solutions.json)
curl -X POST http://localhost:8000/api/wordle/guess \
  -H "Content-Type: application/json" \
  -d '{"word":"stern","game_number":0}'
```

Expected: Game number response and valid guess evaluation.

- [ ] **Step 4: Final commit with all remaining changes**

```bash
git add -A
git status
# Only commit if there are unstaged changes from fixes during verification
git commit -m "fix(wordle): address issues found during end-to-end verification"
```
