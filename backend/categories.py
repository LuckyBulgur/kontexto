"""Solution categories: the field a solution belongs to.

Since 2026-10-01 a round can be drawn from chosen fields (only animals, only
food and drink), and a room can show the round's field above the board. The
daily, the archive and the standard solo modes never do either; where the
feature appears and why is in CLAUDE.md, section "Categories".

Two hand-kept files under ``backend/data/`` carry it, both shipped with the code
rather than the data volume, so a deploy is all it takes to change them:

* ``categories.txt``, the catalogue: ``id = Display name: seed words``. The id is
  stable (rooms store it, old clients send it), the display name is UI copy,
  the seed words feed the two maintenance scripts and nothing at runtime.
* ``solution_categories.txt``, the assignment: ``word = id``, or ``word = -``
  for a solution that deliberately has no field. Keyed by word and never by
  game number, because a pool rebuild hands the numbers out again (the lesson
  of ``word_rating_v2``).

A word without a field is never drawn by a category filter, and its round
shows no field. That is the one way a solution is ever left out, and it exists
for the words a field's own name would give away: the solution "tier" cannot be
shown as "Tiere".
"""

from __future__ import annotations

import os
import re
from collections.abc import Iterable
from dataclasses import dataclass
from functools import lru_cache

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
CATALOGUE_FILE = os.path.join(DATA_DIR, "categories.txt")
ASSIGNMENT_FILE = os.path.join(DATA_DIR, "solution_categories.txt")

#: The assignment target that files a solution under no field at all.
UNCATEGORISED = "-"

#: The fewest playable solutions a field may have. A player who picks only that
#: field gets this many rounds before the draw repeats a word, which at the
#: production median of 35 guesses a round is several evenings. The smallest
#: field, "Märchen und Fantasie", holds 44; a floor above it would dissolve a
#: field that reads as one rather than make any field better.
MIN_PLAYABLE = 40

_ID_PATTERN = re.compile(r"^[a-z]+$")
#: Plural and case endings a display name may carry over the base form of its
#: own word: "Tiere" names "tier", "Pflanzen" names "pflanze".
_NAME_ENDINGS = ("", "e", "n", "en", "s", "er", "ien")
_NAME_JOINERS = frozenset({"und"})


class CategoryError(ValueError):
    """A category id the catalogue does not know, or a malformed data line."""


@dataclass(frozen=True)
class Category:
    id: str
    name: str
    seeds: tuple[str, ...]

    def public(self) -> dict[str, str]:
        """The shape every API response carries: id for code, name for people."""
        return {"id": self.id, "name": self.name}


def name_forms(name: str) -> frozenset[str]:
    """Every word a display name could be read as naming.

    A name token is matched against a solution with the plural endings
    stripped, so "Familie und Menschen" covers "familie" and "mensch". This is
    deliberately generous: a false hit only moves one solution out of a field,
    a missed one shows the answer on screen.
    """
    forms: set[str] = set()
    for token in re.findall(r"[^\W\d_]+", name.lower()):
        if token in _NAME_JOINERS:
            continue
        for ending in _NAME_ENDINGS:
            if ending and token.endswith(ending) and len(token) > len(ending) + 2:
                forms.add(token[: -len(ending)])
        forms.add(token)
    return frozenset(forms)


def read_catalogue(path: str = CATALOGUE_FILE) -> tuple[Category, ...]:
    """Parse the catalogue, in file order, which is the order the picker shows."""
    out: list[Category] = []
    seen: set[str] = set()
    with open(path, encoding="utf-8") as f:
        for number, raw in enumerate(f, 1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            ident, sep, rest = line.partition(" = ")
            name, colon, seeds = rest.partition(":")
            ident, name = ident.strip(), name.strip()
            if not sep or not colon or not name:
                raise CategoryError(f"{path}:{number}: expected 'id = Display name: seed words'")
            if not _ID_PATTERN.match(ident):
                raise CategoryError(f"{path}:{number}: id {ident!r} is not a lowercase ASCII slug")
            if ident in seen:
                raise CategoryError(f"{path}:{number}: id {ident!r} is listed twice")
            seen.add(ident)
            out.append(Category(ident, name, tuple(seeds.split())))
    if not out:
        raise CategoryError(f"{path}: the catalogue is empty")
    return tuple(out)


def read_assignment(known_ids: Iterable[str], path: str = ASSIGNMENT_FILE) -> dict[str, str | None]:
    """Parse the assignment: solution word to category id, None for "no field"."""
    known = frozenset(known_ids)
    out: dict[str, str | None] = {}
    with open(path, encoding="utf-8") as f:
        for number, raw in enumerate(f, 1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            word, sep, target = line.partition(" = ")
            word, target = word.strip(), target.strip()
            if not sep or not word or not target:
                raise CategoryError(f"{path}:{number}: expected 'word = id'")
            if word in out:
                raise CategoryError(f"{path}:{number}: {word} is listed twice")
            if target != UNCATEGORISED and target not in known:
                raise CategoryError(f"{path}:{number}: {word} names unknown category {target!r}")
            out[word] = None if target == UNCATEGORISED else target
    return out


class Categories:
    """The catalogue and the assignment, read once per worker."""

    def __init__(self, catalogue: tuple[Category, ...], assignment: dict[str, str | None]):
        self.catalogue = catalogue
        self._by_id = {category.id: category for category in catalogue}
        self._assignment = assignment

    @property
    def ids(self) -> tuple[str, ...]:
        return tuple(category.id for category in self.catalogue)

    def get(self, ident: str) -> Category | None:
        return self._by_id.get(ident)

    def of_word(self, word: str) -> str | None:
        """The field a solution is filed under, or None (no field, or unknown)."""
        return self._assignment.get(word)

    def knows(self, word: str) -> bool:
        """Whether the assignment has a line for the word, "-" included."""
        return word in self._assignment

    def parse(self, raw: str | Iterable[str] | None) -> frozenset[str]:
        """Validate a filter from a request. Empty means every field.

        Takes a comma list (a query string) or an iterable (a JSON body).
        Raises CategoryError on any id the catalogue does not know, so a typo
        is a 400 rather than a filter that silently matches nothing.
        """
        if raw is None:
            return frozenset()
        items = raw.split(",") if isinstance(raw, str) else list(raw)
        chosen: set[str] = set()
        for item in items:
            ident = item.strip()
            if not ident:
                continue
            if ident not in self._by_id:
                raise CategoryError(f"unknown category {ident!r}")
            chosen.add(ident)
        return frozenset(chosen)

    def ordered(self, chosen: Iterable[str]) -> list[str]:
        """A filter in catalogue order, which is how it is stored and shown."""
        wanted = set(chosen)
        return [ident for ident in self.ids if ident in wanted]


@lru_cache(maxsize=1)
def get_categories() -> Categories:
    """The shipped catalogue and assignment. Raises on a malformed file, which
    is a deploy that must not start rather than a field that quietly vanishes."""
    catalogue = read_catalogue()
    assignment = read_assignment((category.id for category in catalogue))
    return Categories(catalogue, assignment)


def encode_filter(chosen: Iterable[str]) -> str:
    """The stored form of a room's filter: ids in catalogue order, comma joined."""
    return ",".join(get_categories().ordered(chosen))


def decode_filter(stored: str | None) -> list[str]:
    """Read a stored filter back, in catalogue order.

    An id the catalogue no longer carries is dropped rather than raised: a room
    outlives a deploy that merged a field, and it should keep drawing from what
    is left instead of failing.
    """
    if not stored:
        return []
    return get_categories().ordered(stored.split(","))
