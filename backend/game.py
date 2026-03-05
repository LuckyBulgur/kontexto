"""Game logic for Kontexto.

Loads pre-computed data and provides guess/tip/game-info operations.
All lookups are O(1) dict lookups after initial load.
"""

import json
import os
import pickle
import random
from datetime import date

import numpy as np

from prepare import GERMAN_STOPWORDS


class GameState:
    """Holds all game data in memory for fast lookups."""

    def __init__(self, data_dir: str) -> None:
        self.data_dir = data_dir

        with open(os.path.join(data_dir, "vocabulary.json"), encoding="utf-8") as f:
            self.vocabulary: dict[str, int] = json.load(f)
        self.index_to_word: list[str] = [""] * len(self.vocabulary)
        for word, idx in self.vocabulary.items():
            self.index_to_word[idx] = word

        with open(os.path.join(data_dir, "lemma_map.json"), encoding="utf-8") as f:
            self.lemma_map: dict[str, str] = json.load(f)

        with open(os.path.join(data_dir, "bloom.bin"), "rb") as f:
            self.bloom = pickle.load(f)

        with open(os.path.join(data_dir, "target_words.json"), encoding="utf-8") as f:
            self.target_words: list[str] = json.load(f)

        with open(os.path.join(data_dir, "metadata.json"), encoding="utf-8") as f:
            self.metadata: dict = json.load(f)

        self.start_date = date.fromisoformat(self.metadata["start_date"])

        self._game_cache: dict[int, tuple[dict[str, int], list[str]]] = {}

    def load_game(self, game_number: int) -> None:
        """Load rankings for a specific game into cache."""
        if game_number in self._game_cache:
            return

        path = os.path.join(self.data_dir, "games", f"{game_number:04d}.npz")
        data = np.load(path)
        ranks = data["ranks"]

        rankings = {
            self.index_to_word[i]: int(ranks[i])
            for i in range(len(ranks))
        }
        rank_to_word = [""] * (len(ranks) + 1)
        for word, rank in rankings.items():
            rank_to_word[rank] = word
        self._game_cache[game_number] = (rankings, rank_to_word)

    def _get_game(self, game_number: int) -> tuple[dict[str, int], list[str]]:
        """Get rankings and rank_to_word for a game (must be loaded first)."""
        return self._game_cache[game_number]

    def get_game_number(self, today: date | None = None) -> int:
        """Calculate today's game number from the start date.

        Wraps around when pre-computed games are exhausted.
        """
        if today is None:
            today = date.today()
        days = (today - self.start_date).days + 1
        total = self.metadata.get("total_games", len(self.target_words))
        return ((days - 1) % total) + 1

    def is_stopword(self, word: str) -> bool:
        return word.strip().lower() in GERMAN_STOPWORDS

    def normalize_word(self, word: str) -> str | None:
        """Normalize a word: lowercase, check vocab first, lemma as fallback."""
        w = word.strip().lower()

        if w not in self.bloom:
            return None

        # Direct vocab match takes priority
        if w in self.vocabulary:
            return w

        # Fallback: try lemma mapping
        if w in self.lemma_map:
            lemma = self.lemma_map[w]
            if lemma in self.vocabulary:
                return lemma

        return None

    def guess(self, word: str, game_number: int) -> dict | None:
        """Process a guess and return its rank."""
        normalized = self.normalize_word(word)
        if normalized is None:
            return None

        rankings, _ = self._get_game(game_number)
        rank = rankings.get(normalized)
        if rank is None:
            return None

        return {
            "word": normalized,
            "rank": rank,
            "total": len(rankings),
        }

    def get_tip(self, game_number: int, difficulty: str, best_rank: int, guessed_ranks: list[int] | None = None) -> dict | None:
        """Get a hint word based on difficulty level.

        Never returns rank 1 (the answer). If the computed rank was already
        guessed, searches upward for the next unguessed rank.
        """
        rankings, rank_to_word = self._get_game(game_number)

        if guessed_ranks is None:
            guessed_ranks = []
        guessed_set = set(guessed_ranks) | {1}  # always exclude rank 1

        if difficulty == "easy":
            target_rank = max(2, best_rank // 2)
        elif difficulty == "medium":
            target_rank = max(2, best_rank - 1)
        else:  # hard
            target_rank = random.randint(2, max(2, best_rank - 1))

        max_rank = len(rank_to_word) - 1
        target_rank = min(target_rank, max_rank)

        # Search both directions for an unguessed rank
        lo, hi = target_rank, target_rank
        while True:
            if lo >= 2 and lo not in guessed_set:
                target_rank = lo
                break
            if hi <= max_rank and hi not in guessed_set:
                target_rank = hi
                break
            lo -= 1
            hi += 1
            if lo < 2 and hi > max_rank:
                return None

        return {
            "word": rank_to_word[target_rank],
            "rank": target_rank,
        }

    def get_target_word(self, game_number: int) -> str:
        """Return the target word for the given game number."""
        if game_number < 1 or game_number > len(self.target_words):
            raise ValueError(f"Game {game_number} not available (1-{len(self.target_words)})")
        return self.target_words[game_number - 1]

    def get_closest_words(self, game_number: int) -> list[dict]:
        """Return the 500 closest words for the given game."""
        _, rank_to_word = self._get_game(game_number)
        result = []
        for rank in range(1, min(501, len(rank_to_word))):
            word = rank_to_word[rank]
            if word:
                result.append({"word": word, "rank": rank})
        return result
