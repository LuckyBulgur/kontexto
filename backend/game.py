"""Game logic for Kontexto.

Loads pre-computed data and provides guess/tip/game-info operations.
All lookups are O(1) dict lookups after initial load.
"""

import bisect
import json
import os
import pickle
import random
from collections import OrderedDict
from datetime import date
from typing import NamedTuple

import numpy as np

import core_lexicon
import spellfix
from prepare import GERMAN_STOPWORDS

# Upper bound for per-process game data. Each cached game holds the displayed
# rank per vocabulary word plus the core word at each displayed rank, about
# 1 MB over the ~80k vocabulary, so 40 games stay near 40 MB per worker.
# Unbounded caching exhausted the 4 GB prod host (OOM worker kills).
GAME_CACHE_SIZE = 40


class GameView(NamedTuple):
    """One game on the displayed scale."""

    #: Displayed rank per vocabulary index, 0 for a word that holds no number.
    ranks: np.ndarray
    #: Displayed rank to vocabulary index, slot 0 unused.
    rank_to_index: np.ndarray
    #: Displayed ranks of the words a tip may name, ascending, rank 1 excluded.
    hint_ranks: np.ndarray


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

        # The core lexicon decides what a rank counts. Without one (an older
        # data volume, the Wordle data, a fixture) every vocabulary word counts,
        # which is what the game did before the core existed.
        core_words = core_lexicon.load_core_words(data_dir)
        self.core_mask: np.ndarray | None = None
        if core_words:
            mask = np.zeros(len(self.vocabulary), dtype=bool)
            known = 0
            for word in core_words:
                index = self.vocabulary.get(word)
                if index is not None:
                    mask[index] = True
                    known += 1
            if known:
                self.core_mask = mask
        self.core_size = int(self.core_mask.sum()) if self.core_mask is not None else len(self.vocabulary)

        # What a guessable form outside the counted list is scored as. Written
        # by the same build as the list itself, so the two can never disagree
        # about which word holds a number; see core_lexicon for why a form that
        # folds is not a collision but the same word.
        self.fold_map: dict[str, str] = (
            core_lexicon.load_fold_map(data_dir) if self.core_mask is not None else {}
        )

        # What a tip, a neighbour list or an opening word may name: the everyday
        # words that hold a number. The scale counts every base form since
        # 2026-09-24, and handing out its rare compounds is exactly what the
        # everyday list exists to prevent. A directory without the file is one
        # whose scale is its everyday list, so the scale answers instead.
        self.hint_mask: np.ndarray | None = None
        everyday = core_lexicon.load_everyday_words(data_dir) if self.core_mask is not None else None
        if everyday:
            mask = np.zeros(len(self.vocabulary), dtype=bool)
            for word in everyday:
                index = self.vocabulary.get(word)
                if index is not None:
                    mask[index] = True
            mask &= self.core_mask
            if mask.any():
                self.hint_mask = mask

        self.stopwords = core_lexicon.load_stopwords() | GERMAN_STOPWORDS

        self._game_cache: OrderedDict[int, GameView] = OrderedDict()

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

    def _display_scale(self, ranks: np.ndarray) -> GameView:
        """Turn raw ranks over the whole vocabulary into the displayed scale.

        The stored array ranks all ~80.000 words, but most of them are rare
        compounds and inflected forms nobody guesses, and each one pushes the
        number the player reads further up. So the displayed rank counts the
        words of the counted lexicon, and **only** those: each of them gets its
        own number, one after the other, with no gaps and no ties.

        A word outside the lexicon gets rank 0, which is not a rank. It never
        reaches a player, because :meth:`normalize_word` has already folded it
        onto the counted word it is a form of, or refused it. Giving it the
        number of the counted word ahead of it, which is what this did until
        2026-09-22, is what put two different words on the same rank.
        """
        if self.core_mask is None:
            rank_to_index = np.zeros(len(ranks) + 1, dtype=np.uint32)
            rank_to_index[ranks] = np.arange(len(ranks), dtype=np.uint32)
            return GameView(ranks, rank_to_index, np.sort(ranks[ranks > 1]))

        order = np.argsort(ranks)                       # vocabulary index by rank
        # The solution counts, whatever the lexicon says. It is the word at rank
        # 1, and if it were left out of the count, the nearest counted word
        # would take displayed rank 1 and the game would report a wrong word as
        # solved. The pool builder keeps every solution in the lexicon, so this
        # is a guard rather than a mechanism, and it costs one array element.
        counts = self.core_mask.copy()
        counts[order[0]] = True

        core_by_rank = counts[order]
        # counted[r - 1] = how many counting words sit at rank r or closer
        counted = np.cumsum(core_by_rank, dtype=np.uint32)
        core_size = int(counted[-1])

        display = counted[ranks - 1].copy()
        display[~counts] = 0

        core_rank_to_index = np.zeros(core_size + 1, dtype=np.uint32)
        core_rank_to_index[1:] = order[core_by_rank]

        hints = self.hint_mask if self.hint_mask is not None else counts
        hint_ranks = np.sort(display[hints])
        return GameView(
            display.astype(np.uint32, copy=False),
            core_rank_to_index,
            hint_ranks[hint_ranks > 1].astype(np.uint32, copy=False),
        )

    def _get_view(self, game_number: int) -> GameView:
        """One game on the displayed scale, loaded on a cache miss.

        Entries are kept in an LRU bounded by GAME_CACHE_SIZE.
        """
        cached = self._game_cache.get(game_number)
        if cached is not None:
            self._game_cache.move_to_end(game_number)
            return cached

        path = os.path.join(self.data_dir, "games", f"{game_number:04d}.npz")
        with np.load(path) as data:
            ranks = data["ranks"].astype(np.uint32, copy=False)

        view = self._display_scale(ranks)

        self._game_cache[game_number] = view
        while len(self._game_cache) > GAME_CACHE_SIZE:
            self._game_cache.popitem(last=False)
        return view

    def _get_game(self, game_number: int) -> tuple[np.ndarray, np.ndarray]:
        """Return (ranks, rank_to_index) for a game.

        Both are on the displayed scale (see :meth:`_display_scale`): ranks maps
        a vocabulary index to the rank the player is shown, rank_to_index maps a
        displayed rank back to the counted word standing there, slot 0 unused.
        """
        view = self._get_view(game_number)
        return view.ranks, view.rank_to_index

    def get_game_number(self, today: date | None = None) -> int:
        """Calculate today's game number from the start date.

        Wraps around when pre-computed games are exhausted.
        """
        if today is None:
            today = date.today()
        days = (today - self.start_date).days + 1
        total = self.metadata.get("total_games", len(self.target_words))
        return ((days - 1) % total) + 1

    def is_uncounted(self, word: str) -> bool:
        """Whether the game carries this word but gives it no place on the scale.

        The stop list (``data/stopwords_de.txt``, a port of the original game's)
        is the rule: articles, pronouns, the basic prepositions, conjunctions,
        auxiliaries and a few adverbs. The build also refuses the forms it reads
        as one of those (``meinem`` as ``mein``), which is why a word the
        vocabulary carries but the scale does not hold is answered the same way.
        Measured against 1,95 million real guesses that is 0,8% of them.

        The caller answers this before it answers "unknown word", so a word the
        dictionary has is never reported as a word the dictionary lacks.
        """
        w = word.strip().lower()
        if w in self.stopwords:
            return True
        if self.core_mask is None:
            return False
        return w in self.vocabulary and self.normalize_word(w) is None

    def normalize_word(self, word: str) -> str | None:
        """The counted word a guess is scored as, or None when there is none.

        A counted word is itself. An inflected form of one is that one: the
        plural for children is scored as the word for child and the row shows
        it, which is what the game already did for the forms ``lemma_map``
        happened to know. Everything else is refused, and the caller offers
        suggestions, because a word with no place on the scale can only be shown
        a number that belongs to a different word.
        """
        w = word.strip().lower()

        if w not in self.bloom:
            return None

        if self.core_mask is not None:
            index = self.vocabulary.get(w)
            if index is not None and self.core_mask[index]:
                return w
            folded = self.fold_map.get(w)
            if folded is not None:
                return folded
            # Not counted and not a form of anything counted. A word the
            # vocabulary does not carry at all can still be an inflection the
            # game derived itself, so the lemma index gets the last word.
            lemma = self.lemma_map.get(w)
            if lemma is not None and lemma != w:
                lemma_index = self.vocabulary.get(lemma)
                if lemma_index is not None and self.core_mask[lemma_index]:
                    return lemma
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
        """Words to offer for an unknown guess, possibly empty.

        The typo index reads the whole vocabulary, so it can name a word the
        scale does not count. Offering one would be a trap: the player taps it
        and gets told the word does not count, which reads as the game changing
        its mind. So a suggestion is kept only if guessing it would work, and it
        is named by the word that would actually be scored.
        """
        offered: list[str] = []
        for candidate in self.resolve_unknown(word).suggestions:
            scored = self.normalize_word(candidate)
            if scored is not None and scored not in offered:
                offered.append(scored)
        return offered

    def _solution_of(self, game_number: int, word: str) -> str | None:
        """The word itself, when it is this game's solution and nothing else.

        ``normalize_word`` refuses a word that holds no place on the scale, and
        it cannot make an exception for the solution because it does not know
        which game is being played. The solution always holds rank 1, whatever
        the lexicon says, and a player who types it has to be told they won.
        The pool builder keeps every solution counted, so this is a guard for a
        data directory where that went wrong.
        """
        raw = word.strip().lower()
        index = self.vocabulary.get(raw)
        if index is None:
            return None
        ranks, _ = self._get_game(game_number)
        return raw if int(ranks[index]) == 1 else None

    def guess(self, word: str, game_number: int, correct_typos: bool = True) -> dict | None:
        """Process a guess and return its rank.

        An unknown word that is one unambiguous typo away from a real one is
        scored as that word, with ``corrected_from`` recording what was typed.
        Anything less clear stays unknown, so the caller can offer suggestions.
        """
        normalized = self.normalize_word(word)
        corrected_from: str | None = None
        if normalized is None:
            normalized = self._solution_of(game_number, word)
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

        ranks, rank_to_index = self._get_game(game_number)
        rank = int(ranks[index])
        if rank == 0:
            # Not on the scale. `normalize_word` only returns counted words, so
            # this is reachable only for a data directory whose lexicon and rank
            # arrays disagree, and a number that belongs to another word is
            # worse than no answer.
            return None
        return {
            "word": normalized,
            "rank": rank,
            "total": len(rank_to_index) - 1,
            "corrected_from": corrected_from,
        }

    def get_tip(self, game_number: int, difficulty: str, best_rank: int, guessed_ranks: list[int] | None = None) -> dict | None:
        """Get a hint word based on difficulty level.

        The difficulty picks a target rank; the tip is the everyday word nearest
        to it that has not been guessed yet, looking closer first and then
        further out. Never rank 1, which is the answer.
        """
        view = self._get_view(game_number)
        hints = view.hint_ranks
        if len(hints) == 0:
            return None

        guessed_set = set(guessed_ranks or ())

        if difficulty == "easy":
            target_rank = max(2, best_rank // 2)
        elif difficulty == "medium":
            target_rank = max(2, best_rank - 1)
        else:  # hard
            target_rank = random.randint(2, max(2, best_rank - 1))

        # Positions in the hint list, not ranks: the everyday words sit between
        # rare ones, so the nearest one may be several ranks away.
        lo = bisect.bisect_right(hints, target_rank) - 1
        hi = lo + 1
        while lo >= 0 or hi < len(hints):
            if lo >= 0 and int(hints[lo]) not in guessed_set:
                return self._entry(view, int(hints[lo]))
            if hi < len(hints) and int(hints[hi]) not in guessed_set:
                return self._entry(view, int(hints[hi]))
            lo -= 1
            hi += 1
        return None

    def word_at_rank(self, game_number: int, rank: int) -> dict | None:
        """The everyday word at this rank, or the first one further out.

        Used by the Leiter mode, which opens on a deliberately distant word.
        The word may sit a few ranks beyond the one asked for, never closer, and
        the returned rank is its own. Rank 1 is never handed out here: that is
        the solution, and no mode may learn it this way.
        """
        if rank < 2:
            return None
        view = self._get_view(game_number)
        position = bisect.bisect_left(view.hint_ranks, rank)
        if position >= len(view.hint_ranks):
            return None
        return self._entry(view, int(view.hint_ranks[position]))

    def words_at_ranks(self, game_number: int, wanted: list[int]) -> list[dict]:
        """The words at exactly these ranks, nearest first, rank 1 never.

        Sudden Death asks for ranks 2 to 6 and shows them as a list, so they
        come from the whole scale like the neighbour list does: drawn from the
        everyday list they read 4, 6, 7, 8, 14, which a player takes for a bug.
        A rank past the end of the scale is left out.
        """
        view = self._get_view(game_number)
        last = len(view.rank_to_index) - 1
        return [self._entry(view, rank) for rank in sorted(set(wanted)) if 2 <= rank <= last]

    def _entry(self, view: GameView, rank: int) -> dict:
        return {"word": self.index_to_word[int(view.rank_to_index[rank])], "rank": rank}

    def display_total(self) -> int:
        """The scale a rank is read against: every word that holds a number.

        Endpoints used to report ``metadata["vocab_size"]`` here, which is the
        whole vocabulary and no longer the number a rank is measured against.
        """
        return self.core_size

    def total_games(self) -> int:
        """Number of pre-computed games available (the full infinite-mode pool)."""
        return self.metadata.get("total_games", len(self.target_words))

    def first_curated_game(self) -> int:
        """Lowest game number the random modes may draw.

        Games below it kept the words the old pool gave them when the data was
        rebuilt around the core lexicon, so they never passed the rule that a
        solution is a concrete common noun: game 107 was the verb for "to
        report". The daily series has walked past them and never returns before
        the pool wraps; the random modes draw over the whole range and would
        keep handing them out.

        **The archive is deliberately not filtered.** ``/api/games`` walks back
        one day at a time and reads the game number off the date, so every
        puzzle that was ever a daily stays playable there. A player who missed
        a day is entitled to it; what they are not entitled to is meeting it
        again by accident in the endless mode.

        A data directory without the key behaves as it always did.
        """
        return max(1, int(self.metadata.get("first_curated_game", 1)))

    def random_game_number(self, exclude: set[int]) -> int | None:
        """Pick a uniformly random game number, skipping ``exclude``.

        The range starts at :meth:`first_curated_game`. Returns None when every
        game is excluded (caller decides whether to relax the exclusion set and
        retry).
        """
        candidates = [n for n in range(self.first_curated_game(), self.total_games() + 1)
                      if n not in exclude]
        if not candidates:
            return None
        return random.choice(candidates)

    def random_game_numbers(self, count: int, exclude: set[int]) -> list[int] | None:
        """Pick ``count`` distinct random games, skipping ``exclude``.

        Returns None when the pool cannot supply that many, so the caller can
        relax its exclusion set instead of silently handing out a shorter list.
        The range starts at :meth:`first_curated_game`.
        """
        candidates = [n for n in range(self.first_curated_game(), self.total_games() + 1)
                      if n not in exclude]
        if len(candidates) < count:
            return None
        return random.sample(candidates, count)

    def get_target_word(self, game_number: int) -> str:
        """Return the target word for the given game number."""
        if game_number < 1 or game_number > len(self.target_words):
            raise ValueError(f"Game {game_number} not available (1-{len(self.target_words)})")
        return self.target_words[game_number - 1]

    def get_closest_words(self, game_number: int) -> list[dict]:
        """The 500 words nearest the solution, rank 1 to 500 without a gap.

        This is the list the original shows once a round is over, and like the
        original it names every word that holds a number, rare ones included:
        a list that skipped them read as broken, because the ranks jumped from
        1 to 4 to 6. The list only appears after the round, so naming a rare
        compound gives nothing away. Tips and opening words, which are handed
        out while the round is open, still come from the everyday list.
        """
        view = self._get_view(game_number)
        last = min(500, len(view.rank_to_index) - 1)
        return [self._entry(view, rank) for rank in range(1, last + 1)]
