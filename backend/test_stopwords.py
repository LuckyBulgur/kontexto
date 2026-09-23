"""The refusal list: a port of the original game's, held against drift.

Every entry is a word the game answers with "es ist zu allgemein". The list is
short on purpose and follows what Contexto refuses (see the header of
``data/stopwords_de.txt``); these tests keep it from growing back into a
frequency filter one plausible entry at a time.
"""

import os

import core_lexicon
from prepare import GERMAN_STOPWORDS

POOL_FILE = os.path.join(os.path.dirname(__file__), "data", "solution_pool.txt")

#: Words the original ranks, each with the English it was asked about. None of
#: them may be refused here.
RANKED_BY_THE_ORIGINAL = {
    "viel": "much", "viele": "many", "mehr": "more", "meist": "most",
    "wenig": "little", "weniger": "less", "nie": "never", "immer": "always",
    "oft": "often", "schon": "already", "bereits": "already", "bald": "soon",
    "fast": "almost", "vielleicht": "maybe", "wirklich": "really",
    "sogar": "even", "bitte": "please", "ja": "yes", "nein": "yes/no",
    "müssen": "must", "dürfen": "may", "mögen": "might", "wollen": "want",
    "hinter": "behind", "neben": "beside", "innerhalb": "within",
    "außerhalb": "outside", "entlang": "along", "trotz": "despite",
    "außer": "except", "statt": "instead", "seit": "since",
    "laut": "according", "dank": "thanks", "zusammen": "together",
}


def read_pool() -> set[str]:
    with open(POOL_FILE, encoding="utf-8") as f:
        return {line.strip() for line in f if line.strip() and not line.startswith("#")}


def test_the_list_loads_lowercase_entries():
    words = core_lexicon.load_stopwords()
    assert len(words) > 300
    assert all(w == w.lower() and w.isalpha() for w in words)


def test_every_vocabulary_stop_word_is_on_it():
    # The words the vocabulary build drops are refused through the same answer,
    # so the two lists must not disagree about any of them.
    assert GERMAN_STOPWORDS <= core_lexicon.load_stopwords()


def test_no_solution_is_on_it():
    assert not read_pool() & core_lexicon.load_stopwords()


def test_nothing_the_original_ranks_is_on_it():
    refused = sorted(set(RANKED_BY_THE_ORIGINAL) & core_lexicon.load_stopwords())
    assert refused == []


def test_verbs_that_share_a_spelling_with_a_function_word_stay_off_it():
    # "meinen" is also "to mean", "einigen" also "to agree".
    assert not {"meinen", "einigen"} & core_lexicon.load_stopwords()
