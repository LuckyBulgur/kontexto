"""The counted lexicon: the words the game ranks over, one number each.

Why this exists
---------------
The vocabulary is a frequency cut, not a choice: the 80.000 most frequent word
forms of a Common Crawl model. It carries ``verdauungstrakt`` next to ``darm``
and ``magens`` next to ``magen``, and every one of them occupies a rank. Only a
fifth of it is language anybody uses, so the number the player reads is inflated
by roughly a factor of five.

The counted lexicon answers "which words hold a place on the scale". It is one
entry per lemma above a frequency floor, plus every word players have actually
typed often enough to prove they know it.

One word, one number
--------------------
Until 2026-09-22 the counted list was smaller than the guessable one, and a
guess outside it was shown the number of the counted word it stood behind. That
makes the scale compact and the numbers small, and it costs the one property a
rank has to have: two rows then carry the same number without being the same
distance. The player found it on the day the solution was the verb for "to
report", where the rows for "to contact" and "reports" both read 3.

There is no arithmetic that fixes this, because 64.483 guessable words cannot
hold 15.517 distinct places. So the counted list **is** the guessable list, and
every other surface form goes one of two ways:

* it **folds**, when it is an inflected form of a counted word. ``kinder`` is
  scored as ``kind`` and the row shows ``kind``. That is not a collision, it is
  the same word, and the game already did exactly this for what ``lemma_map``
  happened to know.
* it is **refused**, and the player is offered suggestions. Measured against
  1.95 million real guesses that is 3,6% of them, and all but a fraction of
  those are closed-class words a semantic game has nothing to say about:
  conjunctions, prepositions, auxiliaries, pronouns and determiners.

Why spaCy and not the previous three gates
------------------------------------------
The old build asked ``lemma_map``, simplemma and HanTa whether a word was a base
form. All three read a common adjective as a verb: the words for hot, cheap and
thin all came back as infinitives, and every one of them fell off the scale
although players type them by the thousand. The build also lost every noun
sitting just under the frequency floor that people nonetheless guess constantly,
among them the words for body part, board game and weekday.

``de_core_news_lg`` reads all of those correctly, and it lemmatises the plurals
the old gates missed (``eier`` to ``ei``, ``bakterien`` to ``bakterie``). It is
read twice, capitalised and as written, because German writes its nouns
capitalised and the capitalised reading is the one that finds ``haus`` behind
``haeuser``. It is also the one that invents a lemma when the word is no noun at
all: ``Blau`` comes back as ``blaue`` and ``Fangen`` as ``fange``, both of which
exist in the vocabulary and would have swallowed the word. Neither reading can
be trusted alone, so a verb, adjective or adverb settles the word on its own and
the noun reading only answers for what it is actually good at.

Measured, in three passes over the same 1.95 million guesses. Letting the noun
reading answer first admitted 7.644 declined adjectives and participles and put
the scale at 22.722; asking the adjective reading first took 2.632 of them back
out; stripping the declension ending where what is left is itself an adjective
took another 113. With the frequency floor raised to match (see MIN_ZIPF) the
scale ends at 15.487 words, which is the size of the colliding one it replaces
to within a third of a percent, and it refuses 3,6% of real guesses where the
old one refused none and gave a wrong number to a tenth of them.
"""

from __future__ import annotations

import json
import os

#: Zipf frequency a lemma must reach to be counted on frequency alone.
#: Raised from 3,2 on 2026-09-22, in the same change that made every rank
#: unique. The two belong together: once the list has to carry every guessable
#: word, corpus frequency stops being the only evidence that a word is known,
#: because MIN_GUESSES now carries that question for the words people actually
#: type. A stricter floor therefore drops rare corpus words without dropping
#: anything real, and it keeps the scale the size it was. Measured over 1.95
#: million guesses: 3,2 gives 19.977 words and refuses 2,95%, 3,6 gives 15.487
#: and refuses 3,55%, and the 0,6 points between them are rare words guessed
#: fewer than ten times in four months.
MIN_ZIPF = 3.6

#: How often players must have typed a word below the floor for it to count.
#: Real guesses beat corpus frequency at the question "does anybody know this
#: word": the words for body part (Zipf 3,02), angular (3,03) and weekday (3,14)
#: all sit under the floor and were each typed hundreds of times.
MIN_GUESSES = 10

#: Shortest entry. The German words for oil and egg, and the abbreviation for a
#: computer, are ordinary words; the previous floor of three characters dropped
#: all three and the players kept typing them.
MIN_LENGTH = 2

#: Word classes that can hold a place. Everything else is closed class, and a
#: semantic distance to the word for "but" is not a thing the game can express.
CONTENT_POS = frozenset({"NOUN", "PROPN", "ADJ", "ADV", "VERB", "X", "NUM"})

#: Read as written, these come back as themselves and are base forms, so they
#: are never folded. A noun is not on the list: ``eier`` also comes back
#: unchanged and is a plural.
PROTECTED_POS = frozenset({"VERB", "ADJ", "ADV"})

#: German adjective declension endings, longest first. A declined adjective is
#: the one inflection spaCy regularly hands back unchanged, and it arrives in
#: bulk: participles used as adjectives, each in five endings, none of which
#: anybody types. Stripping one only counts when what is left is itself read as
#: an adjective, which is what keeps an infinitive out of it: the stem of a verb
#: is read as a noun or as nothing, never as an adjective.
ADJECTIVE_ENDINGS = ("en", "em", "er", "es", "e")
STRIP_TARGET_POS = frozenset({"ADJ", "ADV"})

SPACY_MODEL = "de_core_news_lg"

CORE_FILE = "core_words.json"
FOLD_FILE = "fold_map.json"


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


def build_core_lexicon(
    vocabulary: dict[str, int] | list[str],
    lemma_map: dict[str, str] | None = None,
    *,
    min_zipf: float = MIN_ZIPF,
    min_length: int = MIN_LENGTH,
    min_guesses: int = MIN_GUESSES,
    guess_counts: dict[str, int] | None = None,
    keep: set[str] | None = None,
    classes: dict[str, tuple[str, str, str, str]] | None = None,
) -> tuple[list[str], dict[str, str]]:
    """Pick the counted words, and say what every other form folds onto.

    Returns ``(core_words, fold_map)``. ``fold_map`` maps a guessable surface
    form to the counted word it is a form of; a word in neither is refused.

    ``keep`` is added unconditionally and never folded; the solutions are passed
    in that way, so a solution can never be missing from the scale it is ranked
    on and can never be scored as some other word.

    ``lemma_map`` is accepted and ignored. It stays in the signature because the
    two build scripts pass it positionally and it is still the game's surface
    form index for typo correction; the word classes no longer come from it.
    """
    from wordfreq import zipf_frequency

    words = sorted(vocabulary)
    known = set(words)
    counts = guess_counts or {}
    kept = {w for w in (keep or ()) if w in known}
    if classes is None:
        classes = read_word_classes(words)

    def is_content(word: str) -> bool:
        up_pos, _, lo_pos, _ = classes[word]
        return up_pos in CONTENT_POS or lo_pos in CONTENT_POS

    def lemma_of(word: str) -> str:
        """The base form, asking each reading about what it is good at.

        The capitalised reading knows nouns, and it is the one that finds the
        singular behind a plural or a genitive. It is also the one that reads a
        declined adjective as a noun and hands the word straight back, which is
        how 7.644 forms such as the declensions of ugly, Iraqi and strenuous
        walked into the first build of this scale. So a verb, adjective or
        adverb reading that actually shortens the word wins, and the noun
        reading only gets its turn when that one has nothing to say.
        """
        up_pos, up_lemma, lo_pos, lo_lemma = classes[word]
        if lo_pos in PROTECTED_POS:
            # A verb, adjective or adverb reading settles the word on its own.
            # Letting the noun reading answer for one of these is what turns the
            # word for blue into the inflected adjective the capitalised reading
            # invents for it.
            if lo_lemma != word:
                return lo_lemma
            stripped = strip_declension(word)
            return stripped if stripped is not None else word
        if up_pos in ("NOUN", "PROPN") and up_lemma != word:
            return up_lemma
        return lo_lemma

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

    candidates = {
        w for w in words
        if w in kept
        or (
            w.isalpha()
            and len(w) >= min_length
            and (zipf_frequency(w, "de") >= min_zipf or counts.get(w, 0) >= min_guesses)
            and is_content(w)
        )
    }

    core: set[str] = set()
    fold: dict[str, str] = {}
    for word in candidates:
        lemma = lemma_of(word)
        # An inflected form belongs to its lemma, but only when that lemma is
        # itself counted. Otherwise the word keeps its own place: nobody says
        # the singular of the words for clothes or bacteria, and folding them
        # onto an entry that does not exist would simply lose them.
        if word not in kept and lemma != word and lemma in candidates:
            fold[word] = lemma
        else:
            core.add(word)
    for word in known - candidates:
        lemma = lemma_of(word)
        if lemma != word and lemma in core:
            fold[word] = lemma

    # A fold has to land on a counted word, never on another folded form.
    fold = {w: t for w, t in fold.items() if t in core}
    return sorted(core), fold


def load_core_words(data_dir: str) -> list[str] | None:
    """The counted lexicon of a data directory, or None when it carries none.

    A data directory written before the core existed simply has no file. The
    caller then ranks over the whole vocabulary, which is what it did before.
    """
    path = os.path.join(data_dir, CORE_FILE)
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


def write_fold_map(data_dir: str, folds: dict[str, str]) -> None:
    with open(os.path.join(data_dir, FOLD_FILE), "w", encoding="utf-8") as f:
        json.dump(folds, f, ensure_ascii=False)
