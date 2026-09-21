"""Tests for the semantic target-word filter. verify-language-fixture

The cases are German words by necessity: this filter's whole job is to judge
German vocabulary, so the fixtures cannot be translated without testing nothing.

Two rules live in this filter and the tests keep them apart.

The **product rule** (``filt``, the defaults, in force since 2026-09-21): a
Kontexto solution is a concrete common noun. Verbs, adjectives and abstract
nouns are still perfectly legal *guesses*, they just stopped being answers.

The **word rule** (``legacy``): the older, wider gate that still has to work
underneath, because it is what rejects names, foreign words, inflected forms,
religious and offensive words. Those tests run against ``legacy`` so that a
word chosen to probe the name gate is not merely rejected for being abstract,
which would make the test prove nothing.
"""

import pytest

from target_selection import CONCRETE_RESCUE, TargetWordFilter


@pytest.fixture(scope="module")
def filt() -> TargetWordFilter:
    """The live product rule: concrete common nouns only."""
    return TargetWordFilter()


@pytest.fixture(scope="module")
def legacy() -> TargetWordFilter:
    """The pre-2026-09-21 rule: any guessable German content word."""
    return TargetWordFilter(nouns_only=False, require_concrete=False)


# Proper nouns must never be solution words; this is the core bug we are fixing.
GIVEN_NAMES = [
    "emma", "dirk", "kurt", "erich", "benno", "jens", "hannes", "gregor",
    "anton", "alfred", "ulrich", "matthias", "franziska", "rudi", "luis",
]
SURNAMES_AND_FAMOUS = ["merkel", "franco", "bender"]
PLACES = ["berlin", "washington", "münchen", "deutschland", "europa", "linz",
          "luxemburg", "hollywood", "mitteleuropa"]


@pytest.mark.parametrize("word", GIVEN_NAMES)
def test_given_names_are_rejected(legacy, word):
    assert legacy.is_valid_target(word) is False, f"{word!r} is a given name and must be rejected"


@pytest.mark.parametrize("word", SURNAMES_AND_FAMOUS)
def test_surnames_are_rejected(legacy, word):
    assert legacy.is_valid_target(word) is False, f"{word!r} is a surname and must be rejected"


@pytest.mark.parametrize("word", PLACES)
def test_place_names_are_rejected(legacy, word):
    assert legacy.is_valid_target(word) is False, f"{word!r} is a place name and must be rejected"


@pytest.mark.parametrize("word", ["house", "school", "wish", "music", "grand",
                                  "street", "council", "blue", "globe"])
def test_foreign_words_are_rejected(legacy, word):
    assert legacy.is_valid_target(word) is False, f"{word!r} is a foreign word and must be rejected"


# Concrete everyday nouns: the words the game is now built from.
CONCRETE_NOUNS = ["hund", "katze", "apfel", "haus", "tisch", "flughafen",
                  "marmor", "rucksack", "löffel", "leuchtturm", "kissen"]
# Abstract nouns: legal German words, but no longer solutions.
ABSTRACT_NOUNS = ["freiheit", "vernunft", "bewusstsein", "wahrscheinlichkeit",
                  "zusammenfassung", "berücksichtigung"]
GOOD_VERBS = ["laufen", "wohnen", "eintragen", "hinnehmen", "bezweifeln"]
GOOD_ADJECTIVES = ["schön", "hübsch", "mechanisch", "konstruktiv", "telefonisch"]
# Established German loanwords (in the Duden) must not trip the foreign-word gate.
GERMAN_LOANWORDS = ["team", "browser", "code", "training", "mail", "konto", "festival"]


@pytest.mark.parametrize("word", CONCRETE_NOUNS)
def test_concrete_nouns_are_kept(filt, word):
    assert filt.is_valid_target(word) is True, f"{word!r} is a concrete noun and must be kept"


@pytest.mark.parametrize("word", ABSTRACT_NOUNS)
def test_abstract_nouns_are_rejected_as_solutions(filt, word):
    assert filt.reject_reason(word) == "abstract", f"{word!r} is abstract and must not be a solution"


@pytest.mark.parametrize("word", ABSTRACT_NOUNS)
def test_abstract_nouns_are_still_real_words(legacy, word):
    assert legacy.is_valid_target(word) is True, f"{word!r} is a real German word, only not a solution"


@pytest.mark.parametrize("word", GOOD_VERBS + GOOD_ADJECTIVES)
def test_verbs_and_adjectives_are_not_solutions(filt, word):
    """Rejected, though not always for the same reason.

    A nominalised infinitive carries a real dictionary noun entry, so the filter
    lets it onto the noun path and the concreteness gate is what stops it. That
    path is worth keeping: of the 4,449 candidates, 180 read as a verb in lower
    case, and they are nouns like the German words for frying pan, ferry, cave
    and hut. Rejecting on the tag alone would have thrown all of them away.
    """
    assert filt.reject_reason(word) in ("not_noun", "abstract"), f"{word!r} must not be a solution"


@pytest.mark.parametrize("word", GOOD_VERBS)
def test_verbs_are_valid_content_words(legacy, word):
    assert legacy.is_valid_target(word) is True, f"{word!r} is a German verb and must stay guessable"


@pytest.mark.parametrize("word", GOOD_ADJECTIVES)
def test_adjectives_are_valid_content_words(legacy, word):
    assert legacy.is_valid_target(word) is True, f"{word!r} is a German adjective and must stay guessable"


@pytest.mark.parametrize("word", GERMAN_LOANWORDS)
def test_established_loanwords_are_not_treated_as_foreign(legacy, word):
    assert legacy.reject_reason(word) != "foreign", f"{word!r} is an established German loanword"


# Common nouns that collide with surnames must be rescued, not lost. HanTa
# mis-tags these as NE, but it still offers an NN reading, which names never do.
NOUN_RESCUE_WORDS = ["baum", "stein", "berg", "wolf", "fuchs", "vogel",
                     "löwe", "bäcker", "baumeister", "fund", "graf", "könig"]


@pytest.mark.parametrize("word", NOUN_RESCUE_WORDS)
def test_surname_colliding_common_nouns_are_kept(legacy, word):
    assert legacy.is_valid_target(word) is True, f"{word!r} is a common noun and must be kept despite surname collision"


# Rare but perfectly recognisable compound nouns make great solutions and must
# survive the rarity floor. Compounds are not penalised as such: the reference
# implementation is full of them, English merely writes them apart.
RECOGNISABLE_COMPOUNDS = ["haartrockner", "doppelbett", "gepäckstück",
                          "schaltschrank", "fachgeschäft"]


@pytest.mark.parametrize("word", RECOGNISABLE_COMPOUNDS)
def test_recognisable_compounds_survive_the_rarity_floor(legacy, word):
    assert legacy.is_valid_target(word) is True, f"{word!r} is a recognisable compound noun and must be kept"


@pytest.mark.parametrize("word", ["schlafzimmer", "doppelbett", "schaltschrank",
                                  "kopfkissen", "kugelschreiber"])
def test_concrete_compounds_are_solutions(filt, word):
    assert filt.is_valid_target(word) is True, f"{word!r} is a concrete compound and must be a solution"


@pytest.mark.parametrize("word", ["pressekonferenz", "landesregierung",
                                  "digitalisierung", "steuererklärung"])
def test_administrative_compounds_are_not_solutions(filt, word):
    assert filt.reject_reason(word) == "abstract", f"{word!r} is an administrative compound, not a thing"


# Given names that HanTa mis-tags as common nouns (NN) must still be rejected:
# they are in the name gazetteer and carry no common-noun dictionary sense.
NN_MISTAGGED_NAMES = ["sebastian", "torsten", "yvonne", "lotte", "isabel",
                      "karoline", "jörn"]


@pytest.mark.parametrize("word", NN_MISTAGGED_NAMES)
def test_names_mistagged_as_nouns_are_still_rejected(legacy, word):
    assert legacy.is_valid_target(word) is False, f"{word!r} is a name and must be rejected even if POS-tagged NN"


# Genuine common nouns that are *also* names must be kept, because they have a
# common-noun dictionary entry, so they are real words, not just names.
NOUN_NAME_HOMOGRAPHS = ["sommer", "winter", "rose", "stein", "mark", "könig",
                        "löwe", "sturm", "engel", "horn", "kraft"]


@pytest.mark.parametrize("word", NOUN_NAME_HOMOGRAPHS)
def test_common_nouns_that_are_also_names_are_kept(legacy, word):
    assert legacy.is_valid_target(word) is True, f"{word!r} is a common noun (and a name) and must be kept"


# Inflected forms (participles, conjugations, plurals) are not base words and
# must be rejected even when simplemma fails to normalise them.
INFLECTED_FORMS = ["verwendet", "gefunden", "gelaufen", "gemacht", "stunden",
                   "kinder", "häuser"]


@pytest.mark.parametrize("word", INFLECTED_FORMS)
def test_inflected_forms_are_rejected(legacy, word):
    assert legacy.is_valid_target(word) is False, f"{word!r} is an inflected form and must be rejected"


def test_old_spelling_lemma_does_not_reject_valid_word(legacy):
    # HanTa lemmatises "bewusstsein" to the pre-reform spelling; the ß/ss
    # difference must not be mistaken for an inflection.
    assert legacy.is_valid_target("bewusstsein") is True


@pytest.mark.parametrize("word", ["rom", "hamm", "china", "bmw", "beach",
                                  "shopping", "jude", "mohr"])
def test_blocklisted_places_brands_anglicisms_slurs_are_rejected(legacy, word):
    assert legacy.is_valid_target(word) is False, f"{word!r} is blocklisted and must be rejected"


# Narrowly religious terms are excluded as solutions (content policy); holidays
# and secular-dominant homographs stay.
RELIGIOUS_TERMS = ["gott", "kirche", "bibel", "koran", "islam", "christ",
                   "papst", "kloster", "priester", "religion", "synagoge",
                   "moschee", "buddhismus"]


@pytest.mark.parametrize("word", RELIGIOUS_TERMS)
def test_religious_terms_are_rejected(legacy, word):
    assert legacy.is_valid_target(word) is False, f"{word!r} is religious and must be rejected"


@pytest.mark.parametrize("word", ["ostern", "weihnachten", "engel", "himmel", "messe"])
def test_holidays_and_secular_homographs_are_kept(legacy, word):
    assert legacy.is_valid_target(word) is True, f"{word!r} should stay (holiday/secular meaning)"


def test_reject_reason_is_none_for_valid_word(filt):
    assert filt.reject_reason("hund") is None


def test_reject_reason_explains_name_rejection(filt):
    assert filt.reject_reason("emma") == "proper_noun"


# The concreteness data is an external resource with holes: it lists entries for
# the German words for DIY store and cotton but none for the word for tree. The
# rescue list closes those, and every entry must actually be needed.
@pytest.mark.parametrize("word", sorted(CONCRETE_RESCUE))
def test_concrete_rescue_words_are_solutions(filt, word):
    assert filt.is_valid_target(word) is True, f"{word!r} is on the rescue list and must be a solution"


def test_concrete_rescue_entries_are_not_merely_low_rated(filt):
    """A rescued word must be missing from the norms, never rated below the bar.

    Rescuing a word the norms deliberately rate as abstract would be overruling
    the evidence instead of patching a gap in it.
    """
    overlap = CONCRETE_RESCUE & filt._concrete
    assert not overlap, f"these are already rated concrete, drop them from the rescue list: {sorted(overlap)}"


# The hand audit of the rebuilt pool. One representative per heading of
# data/unfair_targets.txt, so a regression in how the file is loaded shows up
# as a failure rather than as a word nobody notices until it is the answer.
AUDITED_OUT = [
    "waschen",        # infinitive the tagger reads as a noun
    "erwachsene",     # adjective used as a noun, in a declined form
    "maggi",          # brand
    "eiffelturm",     # landmark
    "thailänder",     # nationality
    "hakenkreuz",     # atrocity
    "heroin",         # drug
    "kitzler",        # sexual content
    "zimmermädchen",  # dated term for a person
    "trafo",          # not a word a player converges on
]


@pytest.mark.parametrize("word", AUDITED_OUT)
def test_audited_words_are_rejected(filt, word):
    assert filt.reject_reason(word) in ("unfair", "religious"), f"{word!r} was audited out"


@pytest.mark.parametrize("word", AUDITED_OUT)
def test_audit_does_not_apply_to_the_older_rule(legacy, word):
    """The audit is part of the product rule, not of what counts as a word.

    The scripts that maintain the pre-2026-09-21 pools must keep reproducing
    what they produced then, so they see the wider rule and not this list.
    """
    assert legacy._unfair == frozenset()


# Rare but picturable is the point of the rebuilt pool, not a defect in it.
@pytest.mark.parametrize("word", ["maiskolben", "pelikan", "streichholz",
                                  "teekanne", "kochlöffel", "erdnuss"])
def test_rare_but_picturable_words_survive(filt, word):
    assert filt.is_valid_target(word) is True, f"{word!r} is exactly what the pool is for"


def test_missing_concreteness_data_fails_closed():
    """A missing artifact must stop the build, never silently widen the rule."""
    with pytest.raises(RuntimeError, match="concreteness list"):
        TargetWordFilter(concrete_file="does-not-exist.txt")


# Vulgar, sexual/FSK18 and strongly offensive words must never be a solution
# (content policy after an insult surfaced). They stay guessable; only the
# answer is governed.
OFFENSIVE_WORDS = ["arsch", "ficken", "fotze", "hurensohn", "wichser",
                   "schlampe", "penis", "vagina", "porno", "nutte", "muschi",
                   "hoden", "vergewaltigung", "neger", "nigger", "schwuchtel",
                   "dildo", "pisse", "möse", "vögeln"]


@pytest.mark.parametrize("word", OFFENSIVE_WORDS)
def test_offensive_words_are_rejected(legacy, word):
    assert legacy.is_valid_target(word) is False, f"{word!r} is offensive and must be rejected"


@pytest.mark.parametrize("word", OFFENSIVE_WORDS)
def test_offensive_words_are_rejected_under_the_product_rule_too(filt, word):
    assert filt.is_valid_target(word) is False, f"{word!r} is offensive and must be rejected"


def test_offensive_reject_reason(filt):
    assert filt.reject_reason("arsch") == "offensive"


def test_offensive_blocklist_folds_eszett(filt):
    # "scheiße" (ß) must be caught by the ß→ss-folded "scheisse" blocklist entry.
    assert filt.reject_reason("scheiße") == "offensive"
    assert filt.reject_reason("scheisse") == "offensive"


# Homographs whose dominant sense is harmless, mild everyday words, and
# substring false positives must NOT be over-blocked; they remain valid words.
NOT_OVERBLOCKED = ["schwanz", "sack", "nackt", "kotzen", "marsch",
                   "nachbarschaft", "geil", "popel", "furz"]


@pytest.mark.parametrize("word", NOT_OVERBLOCKED)
def test_harmless_words_and_false_positives_are_kept(legacy, word):
    assert legacy.is_valid_target(word) is True, f"{word!r} is harmless and must stay a valid target"
