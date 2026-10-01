"""Displayed ranks of chosen words in chosen games, straight from a data directory.

Shared by scripts/propose-categories.py and scripts/measure-categories.py. It
reads the rank arrays the way backend/game.py does, without building a whole
GameState (no Bloom filter, no spell index, no lemma map needed), so it runs
against a data directory assembled from a production download.

The displayed rank of a word is the number of counted words that sit at its raw
rank or closer, exactly as GameState._display_scale computes it, with the
solution always counted. A word the scale does not count has no displayed rank.
"""

from __future__ import annotations

import json
import os
import sys
from collections.abc import Iterable

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.join(HERE, "..", "backend")
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

#: The twenty opening words the foothold is measured on, the same list as
#: scripts/benchmark-embeddings.py (OPENERS), copied so this module does not
#: import a script that loads embedding models.
OPENERS = (
    "haus", "wasser", "mensch", "tier", "stadt", "essen", "auto", "baum",
    "arbeit", "kind", "musik", "farbe", "körper", "maschine", "kleidung",
    "sport", "tisch", "papier", "wetter", "schule",
)


class RankSource:
    """One data directory: vocabulary, counted words, targets and rank arrays."""

    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        with open(os.path.join(data_dir, "vocabulary.json"), encoding="utf-8") as f:
            self.vocabulary: dict[str, int] = json.load(f)
        with open(os.path.join(data_dir, "target_words.json"), encoding="utf-8") as f:
            self.target_words: list[str] = json.load(f)
        with open(os.path.join(data_dir, "metadata.json"), encoding="utf-8") as f:
            self.metadata: dict = json.load(f)
        self.first_curated = max(1, int(self.metadata.get("first_curated_game", 1)))

        core_path = os.path.join(data_dir, "core_words.json")
        self.core_mask = np.zeros(len(self.vocabulary), dtype=bool)
        if os.path.exists(core_path):
            with open(core_path, encoding="utf-8") as f:
                for word in json.load(f):
                    index = self.vocabulary.get(word)
                    if index is not None:
                        self.core_mask[index] = True
        else:
            self.core_mask[:] = True

        # The curated game of every solution: the last number at or after the
        # first curated game, which is the one the random draws hand out.
        self.curated_game_of: dict[str, int] = {}
        for number, word in enumerate(self.target_words, start=1):
            if number >= self.first_curated:
                self.curated_game_of[word] = number

    def curated_games(self) -> Iterable[tuple[int, str]]:
        for number in range(self.first_curated, len(self.target_words) + 1):
            yield number, self.target_words[number - 1]

    def raw_ranks(self, game_number: int) -> np.ndarray:
        path = os.path.join(self.data_dir, "games", f"{game_number:04d}.npz")
        with np.load(path) as data:
            return data["ranks"].astype(np.int64, copy=False)

    def display_ranks(self, game_number: int, words: Iterable[str]) -> dict[str, int]:
        """Displayed rank of every given word the scale counts in this game."""
        ranks = self.raw_ranks(game_number)
        counted = self.core_mask.copy()
        counted[int(np.argmin(ranks))] = True       # the solution always counts
        counted_raw = np.sort(ranks[counted])
        out: dict[str, int] = {}
        for word in words:
            index = self.vocabulary.get(word)
            if index is None or not counted[index]:
                continue
            out[word] = int(np.searchsorted(counted_raw, ranks[index], side="right"))
        return out


def read_pool(path: str) -> list[str]:
    with open(path, encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip() and not line.startswith("#")]
