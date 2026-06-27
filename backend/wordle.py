"""Wordle game logic: evaluation, hard mode validation, and word state management."""

import json
import os
import random
from datetime import date, datetime, timezone, timedelta

BERLIN_TZ = timezone(timedelta(hours=1))


def evaluate(guess: str, solution: str) -> list[str]:
    """Two-pass color evaluation algorithm."""
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
    """Check hard mode constraints. Returns error message or None if valid."""
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
        self.all_valid: set[str] = set(self.solutions) | set(valid_list)
        self.epoch = date(2026, 3, 28)

    def get_game_number(self) -> int:
        today = datetime.now(BERLIN_TZ).date()
        return (today - self.epoch).days

    def get_solution(self, game_number: int) -> str:
        return self.solutions[game_number % len(self.solutions)]

    def random_game_number(self, exclude: set[int]) -> int | None:
        """Pick a random game number whose solution isn't excluded.

        Solutions are addressed modulo the pool size, so exclusion is compared on
        the solution index (``game_number % len``) to avoid handing back a game
        that maps to an already-played or to-be-protected solution. Returns None
        when every solution is excluded (caller relaxes and retries)."""
        n = len(self.solutions)
        excluded_idx = {e % n for e in exclude}
        candidates = [i for i in range(n) if i not in excluded_idx]
        if not candidates:
            return None
        return random.choice(candidates)

    def is_valid_word(self, word: str) -> bool:
        return word.lower() in self.all_valid

    def is_past_game(self, game_number: int) -> bool:
        return game_number < self.get_game_number()
