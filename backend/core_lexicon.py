"""The counted lexicon: the words the game ranks over, one number each.

Two lists, two questions
------------------------
The vocabulary is a frequency cut of 80.000 word forms from a Common Crawl
model. This module turns it into two lists, and they answer different questions.

* **The scale** (``core_words.json``) answers "which words hold a place". Since
  2026-09-24 that is every base form in the vocabulary except a short list of
  function words, the way the original game does it: asked on that day, the
  Contexto API refused 178 of 408 English candidates as "too common", all of
  them articles, pronouns, basic prepositions, conjunctions, auxiliaries and a
  handful of adverbs, and ranked everything else. ``leggings`` came back at
  25.638. The German port of that list is ``data/stopwords_de.txt``.
* **The everyday list** (``everyday_words.json``) answers "which words does
  everybody know". It is what the scale used to be, one entry per lemma above a
  frequency floor plus every word players typed often enough, and it still
  decides three things: the words the vectors are debiased on, the words a tip
  or a neighbour list hands out, and, through the build, nothing else.

Why the scale grew
------------------
Until 2026-09-24 the everyday list *was* the scale, and every other surface form
either folded onto it or was refused. Measured against 1,95 million real guesses
that refused 3,56% of them, and most of those were not function words at all:
52.820 guesses went to words under the frequency floor (``leggings`` at Zipf
3,04, ``apfelmus``, ``backblech``, ``alufolie``), each one answered with "es ist
zu allgemein", which was simply false. Counting every base form cuts the refusals
to 0,79% (47.960 refused word forms down to 292), all of them stop words or forms
the build reads as one. That includes 6.800 guesses that counted before and no
longer do, because they went to ``heute``, ``jetzt`` and ``hier``, which the old
frequency rule let through and the original has always refused.

The price is that rare words now sit between the everyday ones. Over 60 games
the 50th everyday word moved from displayed rank 50 to 112, and the 100th from
100 to about 250. The colour bands moved with it, to the original's own 300 and
1.500, which measured on this scale land where 100 and 600 landed on the old one.
What must not move is what the game hands out, so tips and neighbour lists are
drawn from the everyday list only; otherwise they would serve the rare
compounds the everyday list was built to keep out of them.

One word, one number
--------------------
A rank is a position, and two rows carrying the same number are two words
claiming one position. Every surface form therefore goes one of three ways:

* it **counts**, and holds its own number;
* it **folds**, when it is an inflected form of a counted word. ``kinder`` is
  scored as ``kind`` and the row shows ``kind``. That is not a collision, it is
  the same word;
* it is **refused**, when it is on the stop list or is a form of a word on it
  (``meinem`` reads as ``mein``).

Why spaCy
---------
``de_core_news_lg`` reads every word twice, capitalised and as written, because
German writes its nouns capitalised and the capitalised reading is the one that
finds ``haus`` behind ``haeuser``. It is also the one that invents a lemma when
the word is no noun at all: ``Blau`` comes back as ``blaue``. Neither reading can
be trusted alone, so a verb, adjective or adverb settles the word on its own and
the noun reading only answers for what it is actually good at.

Two readings went wrong in a way only the fold map showed, and both are guarded
below. A declension ending was stripped from verbs as well as adjectives, which
scored ``malen`` as ``mal``, ``lieben`` as ``lieb`` and ``halten`` as ``halt``:
79 infinitives and 5.505 real guesses. And ``liebe`` itself, the noun, was read
as a declined ``lieb``, which on its own cost 5.147 guesses.
"""

from __future__ import annotations

import functools
import json
import os
from typing import NamedTuple

#: Zipf frequency a lemma must reach to be an everyday word on frequency alone.
#: Measured over 1.95 million guesses on 2026-09-22: 3,2 gives 19.977 words and
#: 3,6 gives 15.487. It decided the scale until 2026-09-24 and now decides only
#: the everyday list, so raising or lowering it changes what tips hand out and
#: what the vectors are debiased on, never whether a guess is refused.
MIN_ZIPF = 3.6

#: How often players must have typed a word below the floor for it to be an
#: everyday word. Real guesses beat corpus frequency at the question "does
#: anybody know this word": the words for body part (Zipf 3,02), angular (3,03)
#: and weekday (3,14) all sit under the floor and were each typed hundreds of
#: times.
MIN_GUESSES = 10

#: Shortest entry. The German words for oil and egg, and the abbreviation for a
#: computer, are ordinary words; the previous floor of three characters dropped
#: all three and the players kept typing them.
MIN_LENGTH = 2

#: Word classes an everyday word can have. The scale does not ask: whatever is
#: not on the stop list counts there, which is how ``laut`` (1.275 guesses) and
#: ``dank`` stopped being refused as prepositions.
CONTENT_POS = frozenset({"NOUN", "PROPN", "ADJ", "ADV", "VERB", "X", "NUM"})

#: Read as written, these come back as themselves and are base forms, so they
#: are never folded. A noun is not on the list: ``eier`` also comes back
#: unchanged and is a plural.
PROTECTED_POS = frozenset({"VERB", "ADJ", "ADV"})

#: German adjective declension endings, longest first. A declined adjective is
#: the one inflection spaCy regularly hands back unchanged, and it arrives in
#: bulk: participles used as adjectives, each in five endings, none of which
#: anybody types. Stripping one only counts when what is left is itself read as
#: an adjective.
ADJECTIVE_ENDINGS = ("en", "em", "er", "es", "e")
STRIP_TARGET_POS = frozenset({"ADJ", "ADV"})

#: The word class model. ``de_core_news_lg`` is the one every figure in this
#: file was measured with and the one the data build installs.
#:
#: ``KONTEXTO_SPACY_MODEL`` overrides it, and exists for exactly one caller: the
#: CI test job, which runs the whole pipeline end to end and would otherwise
#: have to download 570 MB to assert that a file was written. It sets the small
#: model, 15 MB, which reads word classes worse and writes the same files. It is
#: an environment variable and not a silent fallback on purpose: a data build
#: whose model failed to download has to fail, not quietly ship a scale built
#: from a weaker reading.
SPACY_MODEL = os.environ.get("KONTEXTO_SPACY_MODEL") or "de_core_news_lg"

CORE_FILE = "core_words.json"
FOLD_FILE = "fold_map.json"
EVERYDAY_FILE = "everyday_words.json"

#: The refusal list, shipped with the code rather than the data, because what
#: counts as a function word is a rule of the game and not a property of one
#: build. See the file's header for where every entry comes from.
STOPWORD_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "stopwords_de.txt")


class Lexicon(NamedTuple):
    """What a build decides about the vocabulary."""

    #: Every word that holds a number, sorted.
    scale: list[str]
    #: Surface form to the counted word it is scored as.
    fold: dict[str, str]
    #: The everyday list, sorted. Not quite a subset of ``scale``: an everyday
    #: word on the stop list (``heute``) stays here and holds no number, so the
    #: runtime hands out ``everyday`` intersected with ``scale``.
    everyday: list[str]


@functools.cache
def load_stopwords() -> frozenset[str]:
    """The words refused as too general, read once per process."""
    words: set[str] = set()
    with open(STOPWORD_FILE, encoding="utf-8") as f:
        for line in f:
            word = line.strip()
            if word and not word.startswith("#"):
                words.add(word.lower())
    return frozenset(words)


def read_word_classes(words: list[str]) -> dict[str, tuple[str, str, str, str]]:
    """Both spaCy readings per word: (pos, lemma) capitalised, then as written.

    Imports spaCy lazily: this runs in the offline data build, and the runtime
    only ever reads the written files.
    """
    import spacy

    nlp = spacy.load(SPACY_MODEL, disable=["parser", "ner", "attribute_ruler"])

    def read(forms: list[str]) -> list[tuple[str, str]]:
        return [(doc[0].pos_, doc[0].lemma_.lower())
                for doc in nlp.pipe(forms, batch_size=2000)]

    upper = read([w.capitalize() for w in words])
    lower = read(words)
    return {w: (u[0], u[1], l[0], l[1]) for w, u, l in zip(words, upper, lower)}


def build_lexicon(
    vocabulary: dict[str, int] | list[str],
    lemma_map: dict[str, str] | None = None,
    *,
    everyday: set[str] | list[str] | None = None,
    keep: set[str] | None = None,
    guess_counts: dict[str, int] | None = None,
    classes: dict[str, tuple[str, str, str, str]] | None = None,
    stopwords: frozenset[str] | set[str] | None = None,
    min_zipf: float = MIN_ZIPF,
    min_length: int = MIN_LENGTH,
    min_guesses: int = MIN_GUESSES,
) -> Lexicon:
    """Pick the counted words, the everyday ones among them, and the folds.

    ``everyday`` freezes the everyday list instead of deriving it. A rebuild
    passes the deployed one, because the vectors are debiased on it and a list
    that moved would move every rank of the game being played today.
    ``min_zipf`` and ``min_guesses`` only apply when it is derived.

    ``keep`` is added unconditionally, to both lists, and never folded; the
    solutions are passed in that way, so a solution can never be missing from
    the scale it is ranked on and can never be scored as some other word.

    ``lemma_map`` is accepted and ignored. It stays in the signature because the
    two build scripts pass it positionally and it is still the game's surface
    form index for typo correction; the word classes no longer come from it.
    """
    from wordfreq import zipf_frequency

    words = sorted(vocabulary)
    known = set(words)
    counts = guess_counts or {}
    stop = load_stopwords() if stopwords is None else frozenset(stopwords)
    kept = {w for w in (keep or ()) if w in known}
    if classes is None:
        classes = read_word_classes(words)

    # Every word some other form is read as the verb of. That is what tells an
    # infinitive from a declined adjective that happens to end the same way:
    # nothing lemmatises onto ``steilen``, and four forms lemmatise onto
    # ``malen``, which is why ``malen`` must not lose its ending to ``mal``.
    verb_lemmas = {lemma for w, (_, _, pos, lemma) in classes.items()
                   if pos in ("VERB", "AUX") and lemma != w}

    def is_content(word: str) -> bool:
        up_pos, _, lo_pos, _ = classes[word]
        return up_pos in CONTENT_POS or lo_pos in CONTENT_POS

    def lemma_of(word: str) -> str:
        """The base form, asking each reading about what it is good at.

        The capitalised reading knows nouns, and it is the one that finds the
        singular behind a plural or a genitive. It is also the one that reads a
        declined adjective as a noun and hands the word straight back, which is
        how 7.644 forms such as the declensions of ugly, Iraqi and strenuous
        walked into the first build of the everyday list. So a verb, adjective
        or adverb reading that actually shortens the word wins, and the noun
        reading only gets its turn when that one has nothing to say.
        """
        up_pos, up_lemma, lo_pos, lo_lemma = classes[word]
        if lo_pos in PROTECTED_POS:
            if lo_lemma != word:
                return lo_lemma
            if lo_pos == "VERB" and word in verb_lemmas:
                return word
            if is_noun_in_e(word, up_pos, up_lemma):
                return word
            stripped = strip_declension(word)
            return stripped if stripped is not None else word
        if up_pos in ("NOUN", "PROPN") and up_lemma != word:
            return up_lemma
        return lo_lemma

    def is_noun_in_e(word: str, up_pos: str, up_lemma: str) -> bool:
        """A feminine noun in -e, not a declined adjective.

        ``liebe`` reads as the adjective ``lieb`` with an ending, and so do
        ``spitze``, ``milde`` and ``erwachsene``. The capitalised reading calls
        each one a noun of its own, which it also does for plenty of genuine
        declensions, so the tie is broken by frequency: a declined form is rarer
        than its stem (``perfekte`` 4,40 against ``perfekt`` 4,84), a noun is not
        (``liebe`` 5,48 against ``lieb`` 4,47).
        """
        if not word.endswith("e") or up_pos != "NOUN" or up_lemma != word:
            return False
        stem = word[:-1]
        return stem in classes and zipf_frequency(word, "de") > zipf_frequency(stem, "de")

    def strip_declension(word: str) -> str | None:
        """The undeclined adjective behind a declined one, if there is one."""
        for ending in ADJECTIVE_ENDINGS:
            if not word.endswith(ending) or len(word) - len(ending) < min_length:
                continue
            stem = word[: -len(ending)]
            reading = classes.get(stem)
            if reading is not None and reading[2] in STRIP_TARGET_POS and reading[3] == stem:
                return stem
        return None

    lemmas = {w: lemma_of(w) for w in words}

    def holds_a_place(word: str) -> bool:
        return (word.isalpha() and len(word) >= min_length
                and word not in stop and lemmas[word] not in stop)

    if everyday is None:
        daily = _derive_everyday(words, lemmas, kept, counts, is_content, min_length,
                                 zipf_frequency, min_zipf, min_guesses)
    else:
        daily = {w for w in everyday if w in known} | kept

    # Everyday words and solutions are never folded: a tip has to name a word
    # that holds its own number, and a solution scored as another word would
    # report the round solved on the wrong one. A stop word stays refused even
    # when it is an everyday word, and it stays on the everyday list: ``heute``
    # and ``hier`` are everyday German, the list is what the vectors are
    # debiased on, and taking them off would move every rank of every game.
    fixed = (daily - stop) | kept
    candidates = fixed | {w for w in words if holds_a_place(w)}

    wanted: dict[str, str] = {}
    for word in candidates - fixed:
        lemma = lemmas[word]
        if lemma != word and lemma in candidates:
            wanted[word] = lemma
    # A fold has to land on a word that holds a number. When the lemma is itself
    # a form of something else, the form keeps its own place instead of
    # following the chain: spaCy reads ``akten`` as ``akte`` and ``akte`` as
    # ``akt``, and scoring the files as the act would be a wrong word, which is
    # worse than a second number for the same one.
    scale = candidates - set(wanted)
    fold = {w: t for w, t in wanted.items() if t in scale}
    scale |= set(wanted) - set(fold)

    # A form too short or too odd to count on its own can still be a form of a
    # counted word. A stop word never folds, whatever its lemma.
    for word in known - candidates:
        lemma = lemmas[word]
        if word not in stop and lemma != word and lemma in scale:
            fold[word] = lemma

    return Lexicon(scale=sorted(scale), fold=fold, everyday=sorted(daily))


def _derive_everyday(words, lemmas, kept, counts, is_content, min_length,
                     zipf_frequency, min_zipf, min_guesses) -> set[str]:
    """The everyday list from scratch: frequent or proven, content, one per lemma.

    This is the rule the scale followed until 2026-09-24, kept unchanged so a
    fresh build debiases on the same kind of list the deployed one was fitted on.
    """
    frequent = {
        w for w in words
        if w in kept
        or (
            w.isalpha()
            and len(w) >= min_length
            and (zipf_frequency(w, "de") >= min_zipf or counts.get(w, 0) >= min_guesses)
            and is_content(w)
        )
    }
    # An inflected form belongs to its lemma, but only when that lemma is itself
    # frequent. Otherwise the word keeps its own place: nobody says the singular
    # of the words for clothes or bacteria, and folding them onto an entry that
    # does not exist would simply lose them.
    return {w for w in frequent
            if w in kept or lemmas[w] == w or lemmas[w] not in frequent}


def load_core_words(data_dir: str) -> list[str] | None:
    """The scale of a data directory, or None when it carries none.

    A data directory written before the scale existed simply has no file. The
    caller then ranks over the whole vocabulary, which is what it did before.
    """
    return _load_word_list(os.path.join(data_dir, CORE_FILE))


def load_everyday_words(data_dir: str) -> list[str] | None:
    """The everyday list of a data directory, or None when it carries none.

    A directory from before 2026-09-24 has none, and its scale is its everyday
    list, so the caller falls back on that.
    """
    return _load_word_list(os.path.join(data_dir, EVERYDAY_FILE))


def _load_word_list(path: str) -> list[str] | None:
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        words = json.load(f)
    return words if isinstance(words, list) and words else None


def load_fold_map(data_dir: str) -> dict[str, str]:
    """Surface form to counted word, empty for a directory without the file."""
    path = os.path.join(data_dir, FOLD_FILE)
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as f:
        folds = json.load(f)
    return folds if isinstance(folds, dict) else {}


def write_core_words(data_dir: str, words: list[str]) -> None:
    with open(os.path.join(data_dir, CORE_FILE), "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False)


def write_everyday_words(data_dir: str, words: list[str]) -> None:
    with open(os.path.join(data_dir, EVERYDAY_FILE), "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False)


def write_fold_map(data_dir: str, folds: dict[str, str]) -> None:
    with open(os.path.join(data_dir, FOLD_FILE), "w", encoding="utf-8") as f:
        json.dump(folds, f, ensure_ascii=False)


def write_lexicon(data_dir: str, lexicon: Lexicon) -> None:
    """All three files of a build, which only ever change together."""
    write_core_words(data_dir, lexicon.scale)
    write_fold_map(data_dir, lexicon.fold)
    write_everyday_words(data_dir, lexicon.everyday)
