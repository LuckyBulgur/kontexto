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

        self.current_game_number: int = 0
        self.current_rankings: dict[str, int] = {}
        self.rank_to_word: list[str] = []

    def load_game(self, game_number: int) -> None:
        """Load rankings for a specific game into memory."""
        if game_number == self.current_game_number:
            return

        path = os.path.join(self.data_dir, "games", f"{game_number:04d}.npz")
        data = np.load(path)
        ranks = data["ranks"]

        self.current_rankings = {
            self.index_to_word[i]: int(ranks[i])
            for i in range(len(ranks))
        }
        self.rank_to_word = [""] * (len(ranks) + 1)
        for word, rank in self.current_rankings.items():
            self.rank_to_word[rank] = word
        self.current_game_number = game_number

    def get_game_number(self, today: date | None = None) -> int:
        """Calculate today's game number from the start date.

        Wraps around when pre-computed games are exhausted.
        """
        if today is None:
            today = date.today()
        days = (today - self.start_date).days + 1
        total = self.metadata.get("total_games", len(self.target_words))
        return ((days - 1) % total) + 1

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

    def guess(self, word: str) -> dict | None:
        """Process a guess and return its rank."""
        normalized = self.normalize_word(word)
        if normalized is None:
            return None

        rank = self.current_rankings.get(normalized)
        if rank is None:
            return None

        return {
            "word": normalized,
            "rank": rank,
            "total": len(self.current_rankings),
        }

    def get_tip(self, difficulty: str, best_rank: int) -> dict | None:
        """Get a hint word based on difficulty level."""
        if difficulty == "easy":
            target_rank = max(1, best_rank // 2)
        elif difficulty == "medium":
            target_rank = max(1, best_rank - 1)
        else:  # hard
            target_rank = random.randint(1, max(1, best_rank - 1))

        max_rank = len(self.rank_to_word) - 1
        target_rank = min(target_rank, max_rank)
        best_word = self.rank_to_word[target_rank]

        return {
            "word": best_word,
            "rank": target_rank,
        }

    def get_target_word(self, game_number: int) -> str:
        """Return the target word for the given game number."""
        if game_number < 1 or game_number > len(self.target_words):
            raise ValueError(f"Game {game_number} not available (1-{len(self.target_words)})")
        return self.target_words[game_number - 1]
