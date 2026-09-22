"""The core lexicon: the words the game ranks over and shows.

Why this exists
---------------
The vocabulary is a frequency cut, not a choice: the 80.000 most frequent word
forms of a Common Crawl model. It carries ``verdauungstrakt`` next to ``darm``
and ``magens`` next to ``magen``, and every one of them occupies a rank. Only
20% of the words in it are words a German speaker actually uses, so the number
the player reads is inflated by roughly a factor of six: measured over 200
games, the 50th best everyday word sits at displayed rank 302 and only 78 of
the 500 nearest words are everyday words at all.

The core lexicon is the answer to "which words should count". It is one entry
per lemma, above a frequency floor, name tokens included, because plenty of
them double as ordinary nouns a player will guess. Everything outside it stays **guessable**: the
vocabulary does not shrink, the ranking scale does. A guess outside the core is
scored at the position of the nearest core word, so no word is ever refused.

Measured on 80 identical solutions, against the deployed 80.000 word scale:
median 45,5 guesses drops to 35,0, every round is solved instead of 78 of 80,
and rounds over 80 guesses fall from 12% to 4%.

The vectors are debiased on this lexicon and the transform is then applied to
the whole vocabulary (``prepare.postprocess_vectors(fit_words=...)``), so the
neighbourhood of a solution is decided by the words that matter.
"""

from __future__ import annotations

import json
import os

#: Zipf frequency a lemma must reach to be part of the core. 3,2 keeps 94,6% of
#: the content words among the 20.000 most frequent German words that the game
#: accepts today, and yields about 15.500 entries. A floor of 3,5 would measure
#: slightly easier still and drop that acceptance to 84,3%, which is the wrong
#: trade: a word the player knows must not vanish from the scale.
MIN_ZIPF = 3.2

#: Shortest entry. Two-letter forms are abbreviations and particles.
MIN_LENGTH = 3

CORE_FILE = "core_words.json"


def build_core_lexicon(
    vocabulary: dict[str, int] | list[str],
    lemma_map: dict[str, str],
    *,
    min_zipf: float = MIN_ZIPF,
    min_length: int = MIN_LENGTH,
    keep: set[str] | None = None,
) -> list[str]:
    """Pick the core lemmas out of ``vocabulary``.

    ``keep`` is added unconditionally; the solutions are passed in that way so
    a solution can never be missing from the scale it is ranked on.

    Imports ``wordfreq`` and ``simplemma`` lazily: this runs offline in the data
    build, and the runtime only ever reads the written file.
    """
    from HanTa import HanoverTagger as hnt
    from german_nouns.lookup import Nouns
    from wordfreq import zipf_frequency
    import simplemma

    tagger = hnt.HanoverTagger("morphmodel_ger.pgz")
    dictionary = Nouns()

    def is_dictionary_noun(word: str) -> bool:
        """Whether Wiktionary lists the word itself as a noun lemma.

        The tagger reads a handful of ordinary nouns as verb forms, among them
        such everyday words as the ones for a table, a fish and a spoon. The
        dictionary settles those cases before the tagger gets to vote.
        """
        try:
            entries = dictionary[word.capitalize()]
        except Exception:
            return False
        return any(str(e.get("lemma", "")).lower() == word
                   and "Substantiv" in (e.get("pos") or [])
                   for e in entries or [])

    def is_base_form(word: str) -> bool:
        """Whether the word is the form a dictionary would list.

        A participle or an inflected adjective sitting in the scale is noise
        twice over: nobody types it, and it pushes the solution's real
        neighbours further down. HanTa reads the lower-cased form for verbs and
        adjectives and the capitalised one for nouns, and the word survives when
        either reading gives the word back unchanged.
        """
        lower, _ = tagger.analyze(word)
        if lower.lower() == word:
            return True
        upper, _ = tagger.analyze(word.capitalize())
        return upper.lower() == word

    words = set(vocabulary)
    core: set[str] = set()
    for word in words:
        if len(word) < min_length or not word.isalpha():
            continue
        if zipf_frequency(word, "de") < min_zipf:
            continue
        # A word the dictionary lists as a noun lemma is in, full stop. The
        # inflection checks below all read a noun such as the one for a key or
        # a mirror as a form of the verb spelled the same way (both simplemma
        # and the lemma map turn it into the infinitive), and every one of
        # those words is exactly the kind of solution the game wants.
        if not is_dictionary_noun(word):
            # An inflected form belongs to its lemma, not beside it. Three
            # checks, because each catches what the others miss: lemma_map
            # holds what the game already derived, simplemma covers forms it
            # has no entry for, and the tagger catches the participles and
            # adjective endings both miss.
            if lemma_map.get(word, word) != word:
                continue
            base = simplemma.lemmatize(word, lang="de").lower()
            if base != word and base in words and zipf_frequency(base, "de") >= min_zipf:
                continue
            if not is_base_form(word):
                continue
        core.add(word)
    if keep:
        core |= {w for w in keep if w in words}
    return sorted(core)


def load_core_words(data_dir: str) -> list[str] | None:
    """The core lexicon of a data directory, or None when it carries none.

    A data directory written before the core existed simply has no file. The
    caller then ranks over the whole vocabulary, which is what it did before.
    """
    path = os.path.join(data_dir, CORE_FILE)
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        words = json.load(f)
    return words if isinstance(words, list) and words else None


def write_core_words(data_dir: str, words: list[str]) -> None:
    with open(os.path.join(data_dir, CORE_FILE), "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False)
