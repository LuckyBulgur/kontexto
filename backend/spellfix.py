"""Typo correction for Kontexto guesses.

A guess that is not a known word is rejected outright today. This module turns
the obvious typos among those into the word the player meant, using a
symmetric-delete index (SymSpell) built offline in ``prepare.py``.

Three properties matter more than recall here:

1. **A known word is never touched.** Correction only runs after
   ``GameState.normalize_word`` has already failed, so a real guess can never be
   rewritten into a different real word.
2. **The secret word has no influence.** Candidates are ranked by edit distance
   and German word frequency only. Ranking them by their rank in the running
   game would turn the correction into a free hint: a player could type nonsense
   and read off which of the candidates sits closer to the solution.
3. **Guessing is left to the player when it is guessing.** A single candidate at
   distance 1 is applied, anything else is offered as a suggestion list. With
   short words the latter is almost always the case (``hand`` reaches ``band``,
   ``land``, ``rand``, ``sand`` and ``wand`` in one edit), which is why a word
   below ``MIN_AUTO_LENGTH`` is never corrected on its own.

The index maps every *surface* form (vocabulary word or inflected form from the
lemma map) to the vocabulary word a guess of it would score, so a typo of an
inflected form is found too.
"""

from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass, field

import numpy as np

# Below this many characters a single edit reaches too many real words for an
# automatic correction to be honest. Such a word only ever gets suggestions.
MIN_AUTO_LENGTH = 5

# Distance 2 is only searched for words long enough that two typos are more
# plausible than a different word, and its results are never applied on their own.
DISTANCE2_MIN_LENGTH = 7

# Words shorter than this get no suggestions either: the list would be noise.
MIN_SUGGEST_LENGTH = 3

MAX_SUGGESTIONS = 3

# Guards against pathological input: a long query has many delete variants, and
# a hash lookup per variant is cheap but not free.
MAX_QUERY_LENGTH = 30

# German spellings that are transliterations rather than typos. Applied before
# the edit-distance search, because they are not errors the player made.
_TRANSLITERATIONS: tuple[tuple[str, str], ...] = (
    ("ae", "ä"),
    ("oe", "ö"),
    ("ue", "ü"),
    ("ss", "ß"),
)

# Cap on the number of spelling variants tried, so a word full of digraphs
# cannot explode the combination count.
_MAX_TRANSLITERATION_VARIANTS = 32


def _hash(text: str) -> int:
    """Stable 64-bit hash.

    Python's own ``hash`` is randomized per process, so an index built in one
    process would be unreadable in the next.
    """
    return int.from_bytes(hashlib.blake2b(text.encode("utf-8"), digest_size=8).digest(), "big")


def _deletes(word: str) -> set[str]:
    """Every variant of ``word`` with exactly one character removed."""
    return {word[:i] + word[i + 1:] for i in range(len(word))}


def _keys(word: str) -> set[str]:
    """The index keys for a word: itself plus its single-character deletions."""
    return {word} | _deletes(word)


def damerau_distance(a: str, b: str, cutoff: int) -> int:
    """Optimal string alignment distance, capped at ``cutoff``.

    Returns ``cutoff + 1`` for anything further apart, which is all the callers
    need to know. Transpositions count as one edit, because swapped neighbours
    are one of the most common typing errors.
    """
    if a == b:
        return 0
    if abs(len(a) - len(b)) > cutoff:
        return cutoff + 1
    if not a:
        return len(b)
    if not b:
        return len(a)

    previous_previous: list[int] = []
    previous = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        current = [i] + [0] * len(b)
        row_min = current[0]
        for j, cb in enumerate(b, start=1):
            cost = 0 if ca == cb else 1
            value = min(
                previous[j] + 1,         # deletion
                current[j - 1] + 1,      # insertion
                previous[j - 1] + cost,  # substitution
            )
            if i > 1 and j > 1 and ca == b[j - 2] and a[i - 2] == cb:
                value = min(value, previous_previous[j - 2] + cost)
            current[j] = value
            if value < row_min:
                row_min = value
        if row_min > cutoff:
            return cutoff + 1
        previous_previous = previous
        previous = current
    return previous[len(b)] if previous[len(b)] <= cutoff else cutoff + 1


def build_surfaces(vocabulary: dict[str, int], lemma_map: dict[str, str]) -> tuple[list[str], np.ndarray]:
    """Every form a player can type, with the vocabulary index it scores as.

    The order is a pure function of the two inputs, so a prebuilt index file can
    reference surfaces by position without shipping the strings again.
    """
    surfaces: list[str] = sorted(vocabulary)
    targets: list[int] = [vocabulary[w] for w in surfaces]
    for word in sorted(lemma_map):
        if word in vocabulary:
            continue
        target = vocabulary.get(lemma_map[word])
        if target is None:
            continue
        surfaces.append(word)
        targets.append(target)
    return surfaces, np.array(targets, dtype=np.uint32)


def build_index(surfaces: list[str]) -> tuple[np.ndarray, np.ndarray]:
    """Build the symmetric-delete index over ``surfaces``.

    Returns ``(hashes, surface_ids)``, both sorted by hash, so a lookup is a
    binary search. Hashes instead of the strings themselves keep the index near
    12 bytes per entry, and a hash collision costs one extra distance check,
    because every candidate is verified against the real string afterwards.
    """
    hashes: list[int] = []
    ids: list[int] = []
    for surface_id, surface in enumerate(surfaces):
        for key in _keys(surface):
            hashes.append(_hash(key))
            ids.append(surface_id)
    hash_array = np.array(hashes, dtype=np.uint64)
    id_array = np.array(ids, dtype=np.uint32)
    order = np.argsort(hash_array, kind="stable")
    return hash_array[order], id_array[order]


def signature(surface_count: int, vocab_size: int) -> str:
    """Identifies the data an index was built from.

    A stale index on disk is worse than none: it would silently correct towards
    words that are no longer in the vocabulary.
    """
    return f"{surface_count}:{vocab_size}"


@dataclass(frozen=True)
class Resolution:
    """What to do with a guess that is not a known word.

    ``word`` set means the guess is scored as that word, ``suggestions`` means
    the player picks. The two are mutually exclusive.
    """

    word: str | None = None
    corrected_from: str | None = None
    suggestions: tuple[str, ...] = field(default_factory=tuple)

    @property
    def is_correction(self) -> bool:
        return self.word is not None


class SpellIndex:
    """Runtime side of the correction: lookup plus the rules above."""

    def __init__(
        self,
        surfaces: list[str],
        targets: np.ndarray,
        hashes: np.ndarray,
        surface_ids: np.ndarray,
        index_to_word: list[str],
        frequency: np.ndarray | None = None,
    ) -> None:
        self.surfaces = surfaces
        self.targets = targets
        self.hashes = hashes
        self.surface_ids = surface_ids
        self.index_to_word = index_to_word
        # Lower is more frequent. Missing data sorts every word equal, which
        # leaves the alphabetical tie-break in charge.
        self.frequency = (
            frequency
            if frequency is not None and len(frequency) == len(index_to_word)
            else np.zeros(len(index_to_word), dtype=np.uint32)
        )

    @classmethod
    def build(
        cls,
        vocabulary: dict[str, int],
        lemma_map: dict[str, str],
        index_to_word: list[str],
        frequency: np.ndarray | None = None,
    ) -> "SpellIndex":
        surfaces, targets = build_surfaces(vocabulary, lemma_map)
        hashes, surface_ids = build_index(surfaces)
        return cls(surfaces, targets, hashes, surface_ids, index_to_word, frequency)

    @classmethod
    def load(
        cls,
        path: str,
        vocabulary: dict[str, int],
        lemma_map: dict[str, str],
        index_to_word: list[str],
    ) -> "SpellIndex | None":
        """Load a prebuilt index, or return None when it is missing or stale."""
        if not os.path.exists(path):
            return None
        surfaces, targets = build_surfaces(vocabulary, lemma_map)
        with np.load(path, allow_pickle=False) as data:
            stored = str(data["signature"].item())
            if stored != signature(len(surfaces), len(vocabulary)):
                return None
            hashes = data["hashes"]
            surface_ids = data["surface_ids"]
            frequency = data["frequency"] if "frequency" in data.files else None
        return cls(surfaces, targets, hashes, surface_ids, index_to_word, frequency)

    def save(self, path: str) -> None:
        np.savez_compressed(
            path,
            signature=np.array(signature(len(self.surfaces), len(self.index_to_word))),
            hashes=self.hashes,
            surface_ids=self.surface_ids,
            frequency=self.frequency,
        )

    def _candidate_surface_ids(self, word: str) -> set[int]:
        """Surface ids sharing an index key with ``word``.

        This is the symmetric-delete trick: comparing the deletions of the query
        against the deletions of every word covers all edits up to distance 2
        with a single deletion index.
        """
        found: set[int] = set()
        for key in _keys(word):
            needle = np.uint64(_hash(key))
            lo = int(np.searchsorted(self.hashes, needle, side="left"))
            hi = int(np.searchsorted(self.hashes, needle, side="right"))
            if hi > lo:
                found.update(int(i) for i in self.surface_ids[lo:hi])
        return found

    def _matches(self, word: str, max_distance: int) -> dict[str, int]:
        """Vocabulary words within ``max_distance`` of ``word``, with distances.

        Several surfaces can lead to the same vocabulary word (a word and its
        inflected forms), the shortest distance wins, and the result counts as
        one candidate. That keeps an inflection from making a clear typo look
        ambiguous.
        """
        best: dict[str, int] = {}
        for surface_id in self._candidate_surface_ids(word):
            surface = self.surfaces[surface_id]
            distance = damerau_distance(word, surface, max_distance)
            if distance > max_distance:
                continue
            target = self.index_to_word[int(self.targets[surface_id])]
            if distance < best.get(target, max_distance + 1):
                best[target] = distance
        return best

    def _ordered(self, matches: dict[str, int], vocabulary: dict[str, int]) -> list[str]:
        """Closest first, then most frequent. Never by rank in the running game."""

        def sort_key(word: str) -> tuple[int, int, str]:
            index = vocabulary.get(word, 0)
            return (matches[word], int(self.frequency[index]), word)

        return sorted(matches, key=sort_key)

    def _transliterations(self, word: str) -> list[str]:
        """Spellings of ``word`` with ``ae``, ``oe``, ``ue`` and ``ss`` written out."""
        variants = {word}
        for plain, umlaut in _TRANSLITERATIONS:
            expanded: set[str] = set()
            for variant in variants:
                expanded.add(variant)
                start = 0
                while True:
                    position = variant.find(plain, start)
                    if position < 0:
                        break
                    expanded.add(variant[:position] + umlaut + variant[position + len(plain):])
                    start = position + 1
            variants = expanded
            if len(variants) > _MAX_TRANSLITERATION_VARIANTS:
                return []
        variants.discard(word)
        return sorted(variants)

    def resolve(self, word: str, vocabulary: dict[str, int], lemma_map: dict[str, str]) -> Resolution:
        """Decide what an unknown guess should become.

        Called only after the word has been found to be unknown, never to
        second-guess a valid guess.
        """
        if not word or len(word) > MAX_QUERY_LENGTH:
            return Resolution()

        # Written-out umlauts are a spelling, not a typo, so they are resolved
        # first and independently of the length rules.
        spellings: dict[str, int] = {}
        for variant in self._transliterations(word):
            target = variant if variant in vocabulary else lemma_map.get(variant)
            if target is not None and target in vocabulary:
                spellings[target] = 0
        if len(spellings) == 1:
            return Resolution(word=next(iter(spellings)), corrected_from=word)
        if len(spellings) > 1:
            return Resolution(suggestions=tuple(self._ordered(spellings, vocabulary)[:MAX_SUGGESTIONS]))

        if len(word) < MIN_SUGGEST_LENGTH:
            return Resolution()

        matches = self._matches(word, 1)
        if len(matches) == 1 and len(word) >= MIN_AUTO_LENGTH:
            return Resolution(word=next(iter(matches)), corrected_from=word)
        if not matches and len(word) >= DISTANCE2_MIN_LENGTH:
            matches = self._matches(word, 2)
        if not matches:
            return Resolution()
        return Resolution(suggestions=tuple(self._ordered(matches, vocabulary)[:MAX_SUGGESTIONS]))
