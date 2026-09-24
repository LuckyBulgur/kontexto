"""What the game names on its own, held against the real data directory.

A teacher's fifth grade got "pimmel" as a tip on 2026-09-24. The unit tests in
test_game.py hold the mechanism; these hold the data: no game of the deployed
pool may offer a blocked word as a tip or opening word, and the hand list must
name words the vocabulary actually carries, or an entry with a typo would block
nothing without anyone noticing.

They skip when no real data directory is present, which is the case in a bare
checkout and in the unit-test CI job.
"""

import os

import numpy as np
import pytest

import core_lexicon
from game import GameState
from wordlists import contains_profanity

DATA_DIR = os.environ.get("KONTEXTO_DATA_DIR", os.path.join(os.path.dirname(__file__), "..", "data"))

SUDDEN_DEATH_RANKS = [2, 3, 4, 5, 6]


def _list_entries() -> list[str]:
    with open(core_lexicon.HINT_BLOCKLIST_FILE, encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip() and not line.startswith("#")]


def test_the_list_is_lowercase_and_has_no_duplicates():
    entries = _list_entries()
    assert entries == [e.lower() for e in entries]
    assert len(entries) == len(set(entries))


real_data = pytest.mark.skipif(
    not os.path.exists(os.path.join(DATA_DIR, core_lexicon.EVERYDAY_FILE)),
    reason="needs a data directory carrying an everyday list",
)


@pytest.fixture(scope="module")
def state() -> GameState:
    return GameState(DATA_DIR)


@real_data
def test_every_entry_is_a_vocabulary_word(state):
    missing = [e for e in _list_entries() if e not in state.vocabulary]
    assert missing == []


@real_data
def test_no_flagged_word_is_offered(state):
    offered = np.flatnonzero(state.handout_mask)
    flagged = [
        state.index_to_word[i] for i in offered
        if state.index_to_word[i] in state.hint_blocklist
        or contains_profanity(state.index_to_word[i], collapse_words=True)
    ]
    assert flagged == []


@real_data
def test_no_game_offers_a_blocked_word(state):
    blocked = state.hint_mask & ~state.handout_mask
    for number in range(1, state.total_games() + 1):
        view = state._get_view(number)
        indices = view.rank_to_index[view.hint_ranks]
        assert not blocked[indices].any(), f"game {number} offers a blocked word"


@real_data
def test_sudden_death_still_has_games_to_deal(state):
    curated = range(state.first_curated_game(), state.total_games() + 1)
    clean = sum(state.sudden_death_is_clean(n, SUDDEN_DEATH_RANKS) for n in curated)
    # 24 of 2.675 curated games were left out on the build of 2026-09-24.
    assert clean >= 0.97 * len(curated)
