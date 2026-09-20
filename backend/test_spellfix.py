"""Tests for the typo correction.

The interesting cases are not the ones that get corrected, they are the ones
that must not be: a real word left alone, a short word with many neighbours, a
typo with two equally plausible readings.
"""

import os
import tempfile

import numpy as np
import pytest

import spellfix

# A vocabulary with the conflicts that matter in German: a cluster of four-letter
# words one edit apart (hand/band/land/rand/sand/wand), umlaut words reachable by
# transliteration, and inflected forms that resolve to a lemma.
WORDS = [
    "hand", "band", "land", "rand", "sand", "wand",
    "haus", "maus", "laus",
    "garten", "fenster", "blume", "wasser", "kirsche", "birne",
    "häuser", "straße", "grün", "brücke", "küche",
    "computer", "telefon", "kalender",
]

LEMMAS = {
    "gartens": "garten",
    "blumen": "blume",
    "fenstern": "fenster",
}


@pytest.fixture
def index():
    vocabulary = {w: i for i, w in enumerate(WORDS)}
    return (
        spellfix.SpellIndex.build(vocabulary, LEMMAS, list(WORDS)),
        vocabulary,
        LEMMAS,
    )


def resolve(index, word):
    idx, vocabulary, lemmas = index
    return idx.resolve(word, vocabulary, lemmas)


class TestDamerauDistance:
    def test_identical(self):
        assert spellfix.damerau_distance("haus", "haus", 2) == 0

    def test_substitution(self):
        assert spellfix.damerau_distance("haus", "maus", 2) == 1

    def test_transposition_counts_as_one(self):
        assert spellfix.damerau_distance("hasu", "haus", 2) == 1

    def test_insertion_and_deletion(self):
        assert spellfix.damerau_distance("hauss", "haus", 2) == 1
        assert spellfix.damerau_distance("hus", "haus", 2) == 1

    def test_cutoff_is_respected(self):
        assert spellfix.damerau_distance("haus", "fenster", 2) == 3

    def test_length_difference_shortcut(self):
        assert spellfix.damerau_distance("a", "abcdef", 2) == 3


class TestCorrections:
    def test_doubled_letter(self, index):
        result = resolve(index, "wasserr")
        assert result.word == "wasser"
        assert result.corrected_from == "wasserr"

    def test_transposed_letters(self, index):
        assert resolve(index, "gartne").word == "garten"

    def test_missing_letter(self, index):
        assert resolve(index, "kirsce").word == "kirsche"

    def test_typo_of_an_inflected_form_scores_the_lemma(self, index):
        # "gartenss" is one edit from the inflected "gartens", which the lemma
        # map resolves to "garten".
        assert resolve(index, "gartenss").word == "garten"

    def test_inflection_and_lemma_count_as_one_candidate(self, index):
        # "blumen" would reach both "blume" and its inflected form; that is one
        # word, not an ambiguity.
        assert resolve(index, "blumenn").word == "blume"


class TestTransliteration:
    def test_written_out_umlaut(self, index):
        result = resolve(index, "haeuser")
        assert result.word == "häuser"
        assert result.corrected_from == "haeuser"

    def test_written_out_eszett(self, index):
        assert resolve(index, "strasse").word == "straße"

    def test_short_word_is_still_transliterated(self, index):
        # The length rule guards against ambiguous typos, not against a spelling
        # that resolves by construction.
        assert resolve(index, "gruen").word == "grün"

    def test_combined_umlauts(self, index):
        assert resolve(index, "bruecke").word == "brücke"


class TestRefusals:
    def test_short_word_with_neighbours_is_not_corrected(self, index):
        result = resolve(index, "xand")
        assert result.word is None
        assert set(result.suggestions) <= {"hand", "band", "land", "rand", "sand", "wand"}
        assert result.suggestions

    def test_single_neighbour_of_a_short_word_is_still_not_corrected(self, index):
        # Only "hand" is one edit away, but four letters leave too little
        # evidence that a typo happened at all.
        result = resolve(index, "hznd")
        assert result.word is None
        assert result.suggestions == ("hand",)

    def test_ambiguous_long_word_offers_suggestions(self, index):
        # One edit from both "haus" and "maus" (and "laus"), so nothing is applied.
        result = resolve(index, "hais")
        assert result.word is None

    def test_nonsense_yields_nothing(self, index):
        result = resolve(index, "qwertzuiop")
        assert result.word is None
        assert result.suggestions == ()

    def test_very_short_input_is_ignored(self, index):
        assert resolve(index, "xy") == spellfix.Resolution()

    def test_overlong_input_is_ignored(self, index):
        assert resolve(index, "a" * 40) == spellfix.Resolution()

    def test_two_typos_are_out_of_scope(self, index):
        # "komputr" is two edits from "computer": not found, by design.
        assert resolve(index, "komputr") == spellfix.Resolution()


class TestSuggestionOrder:
    def test_frequency_decides_before_the_alphabet(self):
        vocabulary = {w: i for i, w in enumerate(WORDS)}
        # Make "wand" the most frequent of the four-letter cluster.
        frequency = np.full(len(WORDS), 100, dtype=np.uint32)
        frequency[vocabulary["wand"]] = 0
        idx = spellfix.SpellIndex.build(vocabulary, LEMMAS, list(WORDS), frequency)
        assert idx.resolve("xand", vocabulary, LEMMAS).suggestions[0] == "wand"

    def test_suggestions_are_capped(self, index):
        assert len(resolve(index, "xand").suggestions) <= spellfix.MAX_SUGGESTIONS


class TestPersistence:
    def test_round_trip(self, index):
        idx, vocabulary, lemmas = index
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, spellfix.INDEX_FILE)
            idx.save(path)
            loaded = spellfix.SpellIndex.load(path, vocabulary, lemmas, list(WORDS))
            assert loaded is not None
            assert loaded.resolve("wasserr", vocabulary, lemmas).word == "wasser"

    def test_missing_file_is_not_an_error(self):
        vocabulary = {w: i for i, w in enumerate(WORDS)}
        assert spellfix.SpellIndex.load("does-not-exist.npz", vocabulary, LEMMAS, list(WORDS)) is None

    def test_stale_index_is_rejected(self, index):
        """An index built for a different vocabulary must not be used.

        It would correct towards words the game no longer knows, and every such
        correction would then be scored as a word that has no rank.
        """
        idx, vocabulary, lemmas = index
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, spellfix.INDEX_FILE)
            idx.save(path)
            smaller = {w: i for i, w in enumerate(WORDS[:10])}
            assert spellfix.SpellIndex.load(path, smaller, {}, WORDS[:10]) is None


class TestKnownWords:
    def test_a_known_word_is_never_rewritten(self, index):
        assert resolve(index, "haus") == spellfix.Resolution()

    def test_a_known_inflection_is_never_rewritten(self, index):
        assert resolve(index, "gartens") == spellfix.Resolution()
