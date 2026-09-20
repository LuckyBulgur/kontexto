"""Game logic for Kontexto.

Loads pre-computed data and provides guess/tip/game-info operations.
All lookups are O(1) dict lookups after initial load.
"""

import json
import os
import pickle
import random
from collections import OrderedDict
from datetime import date

import numpy as np

import spellfix
from prepare import GERMAN_STOPWORDS

# Upper bound for per-process game data. Each cached game holds two uint32
# arrays over the ~80k vocabulary (~640 KB), so 64 games stay near 40 MB per
# worker. Unbounded caching exhausted the 4 GB prod host (OOM worker kills).
GAME_CACHE_SIZE = 64


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

        self._game_cache: OrderedDict[int, tuple[np.ndarray, np.ndarray]] = OrderedDict()

        # Typo correction. The prebuilt index is the normal case; a data
        # directory without one (an older prod volume, a hand-made fixture)
        # builds it on first use instead of failing or slowing down startup.
        self._spell_index: spellfix.SpellIndex | None = spellfix.SpellIndex.load(
            os.path.join(data_dir, spellfix.INDEX_FILE),
            self.vocabulary,
            self.lemma_map,
            self.index_to_word,
        )
        self._spell_index_built = self._spell_index is not None

    def load_game(self, game_number: int) -> None:
        """Warm the cache for a game (lookups load on demand anyway)."""
        self._get_game(game_number)

    def _get_game(self, game_number: int) -> tuple[np.ndarray, np.ndarray]:
        """Return (ranks, rank_to_index) for a game, loading it on a cache miss.

        ranks maps vocabulary index to rank (1-based permutation from
        prepare.py); rank_to_index is the inverse, with slot 0 unused.
        Entries are kept in an LRU bounded by GAME_CACHE_SIZE.
        """
        cached = self._game_cache.get(game_number)
        if cached is not None:
            self._game_cache.move_to_end(game_number)
            return cached

        path = os.path.join(self.data_dir, "games", f"{game_number:04d}.npz")
        with np.load(path) as data:
            ranks = data["ranks"].astype(np.uint32, copy=False)

        rank_to_index = np.zeros(len(ranks) + 1, dtype=np.uint32)
        rank_to_index[ranks] = np.arange(len(ranks), dtype=np.uint32)

        self._game_cache[game_number] = (ranks, rank_to_index)
        while len(self._game_cache) > GAME_CACHE_SIZE:
            self._game_cache.popitem(last=False)
        return ranks, rank_to_index

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

    def _get_spell_index(self) -> spellfix.SpellIndex:
        """The typo index, built on first use when the data dir shipped none."""
        if not self._spell_index_built:
            self._spell_index = spellfix.SpellIndex.build(
                self.vocabulary, self.lemma_map, self.index_to_word
            )
            self._spell_index_built = True
        assert self._spell_index is not None
        return self._spell_index

    def resolve_unknown(self, word: str) -> spellfix.Resolution:
        """What an unknown guess should become: a correction, hints, or nothing.

        Only ever called for a word ``normalize_word`` has already rejected, so
        a valid guess is never rewritten.
        """
        return self._get_spell_index().resolve(
            word.strip().lower(), self.vocabulary, self.lemma_map
        )

    def suggestions(self, word: str) -> list[str]:
        """Words to offer for an unknown guess, possibly empty."""
        return list(self.resolve_unknown(word).suggestions)

    def guess(self, word: str, game_number: int, correct_typos: bool = True) -> dict | None:
        """Process a guess and return its rank.

        An unknown word that is one unambiguous typo away from a real one is
        scored as that word, with ``corrected_from`` recording what was typed.
        Anything less clear stays unknown, so the caller can offer suggestions.
        """
        normalized = self.normalize_word(word)
        corrected_from: str | None = None
        if normalized is None:
            if not correct_typos:
                return None
            resolution = self.resolve_unknown(word)
            if not resolution.is_correction:
                return None
            normalized = resolution.word
            corrected_from = resolution.corrected_from

        index = self.vocabulary.get(normalized)
        if index is None:
            return None

        ranks, _ = self._get_game(game_number)
        return {
            "word": normalized,
            "rank": int(ranks[index]),
            "total": len(ranks),
            "corrected_from": corrected_from,
        }

    def get_tip(self, game_number: int, difficulty: str, best_rank: int, guessed_ranks: list[int] | None = None) -> dict | None:
        """Get a hint word based on difficulty level.

        Never returns rank 1 (the answer). If the computed rank was already
        guessed, searches upward for the next unguessed rank.
        """
        ranks, rank_to_index = self._get_game(game_number)

        if guessed_ranks is None:
            guessed_ranks = []
        guessed_set = set(guessed_ranks) | {1}  # always exclude rank 1

        if difficulty == "easy":
            target_rank = max(2, best_rank // 2)
        elif difficulty == "medium":
            target_rank = max(2, best_rank - 1)
        else:  # hard
            target_rank = random.randint(2, max(2, best_rank - 1))

        max_rank = len(ranks)
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
            "word": self.index_to_word[int(rank_to_index[target_rank])],
            "rank": target_rank,
        }

    def word_at_rank(self, game_number: int, rank: int) -> dict | None:
        """Return the word sitting at an exact rank of a game.

        Used by the Leiter mode, which opens on a deliberately distant word, and
        by Sudden Death, which shows the runners-up. Rank 1 is never handed out
        here: that is the solution, and no mode may learn it this way.
        """
        if rank < 2:
            return None
        ranks, rank_to_index = self._get_game(game_number)
        if rank > len(ranks):
            return None
        return {"word": self.index_to_word[int(rank_to_index[rank])], "rank": rank}

    def words_at_ranks(self, game_number: int, wanted: list[int]) -> list[dict]:
        """Return the words at several exact ranks, skipping the ones out of range."""
        out: list[dict] = []
        for rank in wanted:
            entry = self.word_at_rank(game_number, rank)
            if entry is not None:
                out.append(entry)
        return out

    def total_games(self) -> int:
        """Number of pre-computed games available (the full infinite-mode pool)."""
        return self.metadata.get("total_games", len(self.target_words))

    def random_game_number(self, exclude: set[int]) -> int | None:
        """Pick a uniformly random game number in 1..total_games, skipping
        ``exclude``. Returns None when every game is excluded (caller decides
        whether to relax the exclusion set and retry)."""
        candidates = [n for n in range(1, self.total_games() + 1) if n not in exclude]
        if not candidates:
            return None
        return random.choice(candidates)

    def random_game_numbers(self, count: int, exclude: set[int]) -> list[int] | None:
        """Pick ``count`` distinct random games, skipping ``exclude``.

        Returns None when the pool cannot supply that many, so the caller can
        relax its exclusion set instead of silently handing out a shorter list.
        """
        candidates = [n for n in range(1, self.total_games() + 1) if n not in exclude]
        if len(candidates) < count:
            return None
        return random.sample(candidates, count)

    def get_target_word(self, game_number: int) -> str:
        """Return the target word for the given game number."""
        if game_number < 1 or game_number > len(self.target_words):
            raise ValueError(f"Game {game_number} not available (1-{len(self.target_words)})")
        return self.target_words[game_number - 1]

    def get_closest_words(self, game_number: int) -> list[dict]:
        """Return the 500 closest words for the given game."""
        ranks, rank_to_index = self._get_game(game_number)
        return [
            {"word": self.index_to_word[int(rank_to_index[rank])], "rank": rank}
            for rank in range(1, min(501, len(ranks) + 1))
        ]
