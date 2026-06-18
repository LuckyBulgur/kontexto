"""Tests for the semantic target-word filter.

The filter guarantees that Kontexto solution words are sensible, guessable
German content words (nouns, verbs, adjectives) and never proper nouns
(first names, surnames, place/brand names), foreign words, or rare fragments.
"""

import pytest

from target_selection import TargetWordFilter


@pytest.fixture(scope="module")
def filt() -> TargetWordFilter:
    return TargetWordFilter()


# Proper nouns must never be solution words — this is the core bug we are fixing.
GIVEN_NAMES = [
    "emma", "dirk", "kurt", "erich", "benno", "jens", "hannes", "gregor",
    "anton", "alfred", "ulrich", "matthias", "franziska", "rudi", "luis",
]
SURNAMES_AND_FAMOUS = ["merkel", "franco", "bender"]
PLACES = ["berlin", "washington", "münchen", "deutschland", "europa", "linz",
          "luxemburg", "hollywood", "mitteleuropa"]


@pytest.mark.parametrize("word", GIVEN_NAMES)
def test_given_names_are_rejected(filt, word):
    assert filt.is_valid_target(word) is False, f"{word!r} is a given name and must be rejected"


@pytest.mark.parametrize("word", SURNAMES_AND_FAMOUS)
def test_surnames_are_rejected(filt, word):
    assert filt.is_valid_target(word) is False, f"{word!r} is a surname and must be rejected"


@pytest.mark.parametrize("word", PLACES)
def test_place_names_are_rejected(filt, word):
    assert filt.is_valid_target(word) is False, f"{word!r} is a place name and must be rejected"


@pytest.mark.parametrize("word", ["house", "school", "wish", "music", "grand",
                                  "street", "council", "blue", "globe"])
def test_foreign_words_are_rejected(filt, word):
    assert filt.is_valid_target(word) is False, f"{word!r} is a foreign word and must be rejected"


# Genuine, guessable German content words must survive.
GOOD_NOUNS = ["hund", "katze", "apfel", "haus", "tisch", "freiheit",
              "vernunft", "flughafen", "bewusstsein", "marmor", "rucksack"]
GOOD_VERBS = ["laufen", "wohnen", "eintragen", "hinnehmen", "bezweifeln"]
GOOD_ADJECTIVES = ["schön", "hübsch", "mechanisch", "konstruktiv", "telefonisch"]
# Established German loanwords (in the Duden) are acceptable.
GERMAN_LOANWORDS = ["team", "browser", "code", "training", "mail", "konto", "festival"]


@pytest.mark.parametrize("word", GOOD_NOUNS)
def test_common_nouns_are_kept(filt, word):
    assert filt.is_valid_target(word) is True, f"{word!r} is a good German noun and must be kept"


@pytest.mark.parametrize("word", GOOD_VERBS)
def test_verbs_are_kept(filt, word):
    assert filt.is_valid_target(word) is True, f"{word!r} is a German verb and must be kept"


@pytest.mark.parametrize("word", GOOD_ADJECTIVES)
def test_adjectives_are_kept(filt, word):
    assert filt.is_valid_target(word) is True, f"{word!r} is a German adjective and must be kept"


@pytest.mark.parametrize("word", GERMAN_LOANWORDS)
def test_established_loanwords_are_kept(filt, word):
    assert filt.is_valid_target(word) is True, f"{word!r} is an established German loanword and must be kept"


# Common nouns that collide with surnames must be rescued, not lost. HanTa
# mis-tags these as NE, but it still offers an NN reading, which names never do.
NOUN_RESCUE_WORDS = ["baum", "stein", "berg", "wolf", "fuchs", "vogel",
                     "löwe", "bäcker", "baumeister", "fund", "graf", "könig"]


@pytest.mark.parametrize("word", NOUN_RESCUE_WORDS)
def test_surname_colliding_common_nouns_are_kept(filt, word):
    assert filt.is_valid_target(word) is True, f"{word!r} is a common noun and must be kept despite surname collision"


# Rare but perfectly recognisable compound nouns make great solutions and must
# survive the rarity floor.
RECOGNISABLE_COMPOUNDS = ["haartrockner", "doppelbett", "gepäckstück",
                          "schaltschrank", "fachgeschäft"]


@pytest.mark.parametrize("word", RECOGNISABLE_COMPOUNDS)
def test_recognisable_compounds_are_kept(filt, word):
    assert filt.is_valid_target(word) is True, f"{word!r} is a recognisable compound noun and must be kept"


# Given names that HanTa mis-tags as common nouns (NN) must still be rejected:
# they are in the name gazetteer and carry no common-noun dictionary sense.
NN_MISTAGGED_NAMES = ["sebastian", "torsten", "yvonne", "lotte", "isabel",
                      "karoline", "jörn"]


@pytest.mark.parametrize("word", NN_MISTAGGED_NAMES)
def test_names_mistagged_as_nouns_are_still_rejected(filt, word):
    assert filt.is_valid_target(word) is False, f"{word!r} is a name and must be rejected even if POS-tagged NN"


# Genuine common nouns that are *also* names must be kept — they have a
# common-noun dictionary entry, so they are real words, not just names.
NOUN_NAME_HOMOGRAPHS = ["sommer", "winter", "rose", "stein", "mark", "könig",
                        "löwe", "sturm", "engel", "horn", "kraft"]


@pytest.mark.parametrize("word", NOUN_NAME_HOMOGRAPHS)
def test_common_nouns_that_are_also_names_are_kept(filt, word):
    assert filt.is_valid_target(word) is True, f"{word!r} is a common noun (and a name) and must be kept"


# Inflected forms (participles, conjugations, plurals) are not base words and
# must be rejected even when simplemma fails to normalise them.
INFLECTED_FORMS = ["verwendet", "gefunden", "gelaufen", "gemacht", "stunden",
                   "kinder", "häuser"]


@pytest.mark.parametrize("word", INFLECTED_FORMS)
def test_inflected_forms_are_rejected(filt, word):
    assert filt.is_valid_target(word) is False, f"{word!r} is an inflected form and must be rejected"


def test_old_spelling_lemma_does_not_reject_valid_word(filt):
    # HanTa lemmatises "bewusstsein" to the pre-reform "Bewußtsein"; the ß/ss
    # difference must not be mistaken for an inflection.
    assert filt.is_valid_target("bewusstsein") is True


@pytest.mark.parametrize("word", ["rom", "hamm", "china", "bmw", "beach",
                                  "shopping", "jude", "mohr"])
def test_blocklisted_places_brands_anglicisms_slurs_are_rejected(filt, word):
    assert filt.is_valid_target(word) is False, f"{word!r} is blocklisted and must be rejected"


# Narrowly religious terms are excluded as solutions (content policy); holidays
# and secular-dominant homographs stay.
RELIGIOUS_TERMS = ["gott", "kirche", "bibel", "koran", "islam", "christ",
                   "papst", "kloster", "priester", "religion", "synagoge",
                   "moschee", "buddhismus"]


@pytest.mark.parametrize("word", RELIGIOUS_TERMS)
def test_religious_terms_are_rejected(filt, word):
    assert filt.is_valid_target(word) is False, f"{word!r} is religious and must be rejected"


@pytest.mark.parametrize("word", ["ostern", "weihnachten", "engel", "himmel", "messe"])
def test_holidays_and_secular_homographs_are_kept(filt, word):
    assert filt.is_valid_target(word) is True, f"{word!r} should stay (holiday/secular meaning)"


def test_reject_reason_is_none_for_valid_word(filt):
    assert filt.reject_reason("hund") is None


def test_reject_reason_explains_name_rejection(filt):
    assert filt.reject_reason("emma") == "proper_noun"


# Vulgar, sexual/FSK18 and strongly offensive words must never be a solution
# (content policy after "Arsch" surfaced). They stay guessable; only the answer
# is governed.
OFFENSIVE_WORDS = ["arsch", "ficken", "fotze", "hurensohn", "wichser",
                   "schlampe", "penis", "vagina", "porno", "nutte", "muschi",
                   "hoden", "vergewaltigung", "neger", "nigger", "schwuchtel",
                   "dildo", "pisse", "möse", "vögeln"]


@pytest.mark.parametrize("word", OFFENSIVE_WORDS)
def test_offensive_words_are_rejected(filt, word):
    assert filt.is_valid_target(word) is False, f"{word!r} is offensive and must be rejected"


def test_offensive_reject_reason(filt):
    assert filt.reject_reason("arsch") == "offensive"


def test_offensive_blocklist_folds_eszett(filt):
    # "scheiße" (ß) must be caught by the ß→ss-folded "scheisse" blocklist entry.
    assert filt.reject_reason("scheiße") == "offensive"
    assert filt.reject_reason("scheisse") == "offensive"


# Homographs whose dominant sense is harmless, mild everyday words, and
# substring false positives ("marsch"/"nachbarschaft" contain "arsch") must NOT
# be over-blocked — they remain valid solutions.
NOT_OVERBLOCKED = ["schwanz", "sack", "nackt", "kotzen", "marsch",
                   "nachbarschaft", "geil", "popel", "furz"]


@pytest.mark.parametrize("word", NOT_OVERBLOCKED)
def test_harmless_words_and_false_positives_are_kept(filt, word):
    assert filt.is_valid_target(word) is True, f"{word!r} is harmless and must stay a valid target"
