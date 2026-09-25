"""Purely English words hold no number on the German scale.

``data/english_words_de.txt`` lists them with the German word each is scored
as, and ``core_lexicon._apply_english`` takes them off the scale. The unit
tests pin the rule on a small fixture; the data tests hold the property against
the real data directory and skip without one, like test_rank_uniqueness.py.
"""

import os

import pytest

import core_lexicon
from game import GameState


def apply(english, scale, fold, known=None, kept=()):
    scale = set(scale)
    fold = dict(fold)
    known = set(known) if known is not None else scale | set(fold) | set(english)
    core_lexicon._apply_english(english, known, set(kept), scale, fold)
    return scale, fold


class TestApplyEnglish:
    def test_a_content_word_folds_onto_its_german_word(self):
        scale, fold = apply({"village": "dorf"}, {"village", "dorf"}, {})
        assert scale == {"dorf"}
        assert fold == {"village": "dorf"}

    def test_a_function_word_is_refused(self):
        scale, fold = apply({"from": None}, {"from", "haus"}, {})
        assert scale == {"haus"}
        assert fold == {}

    def test_a_form_follows_its_english_word(self):
        scale, fold = apply({"photo": "foto", "into": None},
                            {"photo", "into", "foto"}, {"photos": "photo", "intos": "into"})
        assert fold == {"photo": "foto", "photos": "foto"}
        assert "intos" not in fold

    def test_a_target_that_is_a_form_is_followed_one_step(self):
        scale, fold = apply({"data": "daten"}, {"data", "datum"}, {"daten": "datum"})
        assert fold["data"] == "datum"

    def test_a_target_holding_no_number_stops_the_build(self):
        with pytest.raises(ValueError, match="holds no number"):
            apply({"village": "dorf"}, {"village"}, {})

    def test_a_solution_can_never_be_english(self):
        with pytest.raises(ValueError, match="solutions"):
            apply({"village": "dorf"}, {"village", "dorf"}, {}, kept={"village"})

    def test_a_word_outside_the_vocabulary_is_ignored(self):
        scale, fold = apply({"village": "dorf"}, {"dorf"}, {}, known={"dorf"})
        assert scale == {"dorf"}
        assert fold == {}

    def test_the_build_applies_the_list(self):
        words = ["village", "dorf"]
        classes = {w: ("NOUN", w, "NOUN", w) for w in words}
        lexicon = core_lexicon.build_lexicon(
            words, everyday=words, classes=classes,
            second={w: (w.capitalize(), w.capitalize()) for w in words},
            nouns={"dorf": (True, (), False)}, stopwords=frozenset(),
            english={"village": "dorf"})
        assert lexicon.scale == ["dorf"]
        assert lexicon.fold == {"village": "dorf"}
        assert lexicon.everyday == ["dorf", "village"]


class TestTheList:
    def test_it_parses_and_is_not_empty(self):
        english = core_lexicon.load_english_words()
        assert len(english) > 300
        assert all(w == w.strip().lower() and " " not in w for w in english)

    def test_only_a_function_word_is_refused(self):
        """A content word is answered with its German word, never refused as
        too general, because for a content word that message would be false."""
        refused = {w for w, t in core_lexicon.load_english_words().items() if t is None}
        assert refused == {"about", "and", "both", "else", "for", "from", "into",
                           "its", "next", "that", "today", "too"}

    def test_no_target_is_itself_english(self):
        english = core_lexicon.load_english_words()
        assert [w for w, t in english.items() if t in english] == []

    def test_a_word_is_either_listed_or_kept_never_both(self):
        kept_file = os.path.join(os.path.dirname(core_lexicon.ENGLISH_FILE), "english_words_kept.txt")
        with open(kept_file, encoding="utf-8") as f:
            kept = {line.strip() for line in f if line.strip() and not line.startswith("#")}
        assert kept & set(core_lexicon.load_english_words()) == set()

    def test_german_homographs_stay_german(self):
        """English spellings that are German words or names in their own right."""
        english = core_lexicon.load_english_words()
        for word in ("island", "main", "inn", "wedding", "worms", "storm", "ranch", "farmer",
                     "horror", "zombie", "killer", "tip", "blend"):
            assert word not in english, word


DATA_DIR = os.environ.get("KONTEXTO_DATA_DIR", os.path.join(os.path.dirname(__file__), "..", "data"))
needs_data = pytest.mark.skipif(
    not os.path.exists(os.path.join(DATA_DIR, core_lexicon.CORE_FILE)),
    reason="needs a data directory carrying a counted lexicon",
)


@pytest.fixture(scope="module")
def state() -> GameState:
    return GameState(DATA_DIR)


@needs_data
def test_no_english_word_holds_a_number(state):
    english = core_lexicon.load_english_words()
    counted = [w for w in english if (i := state.vocabulary.get(w)) is not None and state.core_mask[i]]
    assert counted == []


@needs_data
def test_an_english_word_is_scored_as_its_german_word_or_refused(state):
    for word, target in core_lexicon.load_english_words().items():
        if word not in state.vocabulary:
            continue
        if target is None:
            assert state.is_uncounted(word), word
        else:
            assert state.normalize_word(word) == state.fold_map.get(target, target), word


@needs_data
def test_no_solution_is_english(state):
    assert set(state.target_words) & set(core_lexicon.load_english_words()) == set()
