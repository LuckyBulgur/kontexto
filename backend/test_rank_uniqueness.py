"""One word, one number, held from the outside.

A rank is a position, and two rows carrying the same number are two words
claiming the same position. Until 2026-09-22 the game did exactly that: the
counted lexicon held 15.517 places and 80.000 word forms were guessable, so a
guess outside the lexicon was shown the number of the counted word ahead of it.
A player reported it on the day the solution was the verb for "to report", where
the rows for two different words both read 3.

The fix was to make the counted list the guessable list. These tests hold that
property against the real data directory rather than against a fixture, because
the property is about the data and the code together: a build that admits a form
next to its own lemma, or a fold that lands on a word holding no place, breaks
it without any code changing.

They skip when no real data directory is present, which is the case in a bare
checkout and in the unit-test CI job.
"""

import os
import random

import pytest

import core_lexicon
from game import GameState

DATA_DIR = os.environ.get("KONTEXTO_DATA_DIR", os.path.join(os.path.dirname(__file__), "..", "data"))

pytestmark = pytest.mark.skipif(
    not os.path.exists(os.path.join(DATA_DIR, core_lexicon.CORE_FILE)),
    reason="needs a data directory carrying a counted lexicon",
)


@pytest.fixture(scope="module")
def state() -> GameState:
    return GameState(DATA_DIR)


def test_the_counted_lexicon_is_the_scale(state):
    assert state.core_mask is not None
    assert state.core_size == int(state.core_mask.sum())
    assert state.display_total() == state.core_size


def test_every_rank_is_held_by_exactly_one_word(state):
    """The property the ``about`` mark used to paper over."""
    for game_number in random.Random(20260922).sample(range(1, state.total_games() + 1), 40):
        ranks, rank_to_index = state._get_game(game_number)
        counted = ranks[ranks > 0]
        assert len(set(counted.tolist())) == len(counted)
        assert sorted(counted.tolist()) == list(range(1, state.core_size + 1))
        assert len(rank_to_index) - 1 == state.core_size


def test_a_fold_lands_on_a_word_that_holds_a_number(state):
    for form, target in state.fold_map.items():
        index = state.vocabulary.get(target)
        assert index is not None, f"{form} folds onto a word outside the vocabulary"
        assert state.core_mask[index], f"{form} folds onto a word holding no number"


def test_no_counted_word_is_also_a_folded_form(state):
    """A word cannot both hold a number and be scored as another word."""
    both = [w for w in state.fold_map
            if (i := state.vocabulary.get(w)) is not None and state.core_mask[i]]
    assert both == []


def test_a_guess_is_scored_as_a_counted_word_or_not_at_all(state):
    game_number = 1
    sample = random.Random(1).sample(sorted(state.vocabulary), 3000)
    for word in sample:
        result = state.guess(word, game_number, correct_typos=False)
        if result is None:
            continue
        index = state.vocabulary[result["word"]]
        assert state.core_mask[index] or result["rank"] == 1
        assert 1 <= result["rank"] <= state.core_size


def test_every_solution_holds_its_own_number(state):
    """A solution scored as another word would report the wrong round won."""
    for game_number in range(1, state.total_games() + 1):
        target = state.target_words[game_number - 1]
        index = state.vocabulary.get(target)
        assert index is not None, f"game {game_number}: {target} is not in the vocabulary"
        assert state.core_mask[index], f"game {game_number}: {target} holds no number"
        assert target not in state.fold_map, f"game {game_number}: {target} is folded away"


def test_a_word_the_scale_does_not_hold_is_named_as_such(state):
    """Refused, and reported as a word that does not count, not as unknown."""
    uncounted = next(w for w in sorted(state.vocabulary)
                     if not state.core_mask[state.vocabulary[w]] and w not in state.fold_map)
    assert state.guess(uncounted, 1, correct_typos=False) is None
    assert state.is_uncounted(uncounted) is True
