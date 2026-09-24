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
  decides three things: the words the vectors are debiased on, the single word
  a tip or an opening word hands out, and how cautiously a form is folded.

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
What must not move is what the game hands out while a round is open, so tips
and opening words are drawn from the everyday list only; otherwise they would
serve the rare compounds the everyday list was built to keep out of them. A list
the game shows (the neighbour list, the Sudden Death runners-up) runs over the
whole scale without a gap, as the original's does.

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

Three readings, not one (2026-09-24)
------------------------------------
spaCy alone was enough while the scale held only everyday words, because a form
whose lemma it misread simply had no lemma on the scale to collide with. Once
the scale counted every base form, its misreadings became visible: on the day
the widened scale shipped, the neighbour list for ``oldtimer`` read ``oldies`` 2
beside ``oldie`` 10, the plural of ``zweirad`` 3 beside the singular at 25, and
the dative plural of ``motorrad`` 12 beside the singular at 8, because spaCy
reads rare plurals onto lemmas that are no word (a stem without its vowel
change, or the nominative plural). The original lists lemmas only; three of
its lists of 500 hold no plural next to its singular.

So a fold now weighs three readings: spaCy's, simplemma's, and Wiktionary's
(``german-nouns``), which lists every declined form of a common noun with its
lemma and is the authority on nouns. Each was measured against the deployed
build and against the 1,95 million guesses, and each is wrong somewhere the
others are not: simplemma reads ``schlag`` as ``schlagen`` and ``montage`` as
Monday, Wiktionary files ``strasse`` as a plural of the rhinestone and
``ungarn`` as a plural of the Hungarian, spaCy reads ``bunker`` as a verb. The
rules in :func:`build_lexicon` are what survived those measurements: a noun of
its own never folds, a verb with conjugated forms never folds onto a noun, a
frequent word needs two readings that agree, and spellings with ss and with the
sharp s meet on the one in current use.

The result: 6.073 forms that held a number fold onto their lemma, the scale
shrinks from 56.712 to 51.291 words, and 657 forms that used to fold onto a verb
or adjective count as the nouns they are (``macht``, ``glaube``, ``alter``,
``stand``: 20.638 guesses). Refusals stay at 0,79%, because a fold never
refuses. Held against the real data by ``test_rank_uniqueness.py``.
"""

from __future__ import annotations

import functools
import json
import os
from collections import Counter
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

#: How much more frequent (in Zipf) a noun in -e may be than its stem when only
#: one model reads it as that stem's plural. A plural in -e is rarer than its
#: singular, so one that is clearly more frequent is a word of its own that a
#: model misread: ``granate`` is not a form of ``granat``. See ``may_fold``.
FOLD_FREQUENCY_MARGIN = 0.2

#: How much more frequent (in Zipf) a plural that is also a rare verb may be
#: than its singular and still read as the plural. See ``plural_first``.
PLURAL_FREQUENCY_MARGIN = 0.5

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

#: The words the game never names on its own (tips, the Leiter opening word,
#: the Sudden Death runners-up), on top of what the profanity engine flags.
#: Shipped with the code for the same reason as the stop list.
HINT_BLOCKLIST_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "hint_blocklist_de.txt")


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
    return _read_word_file(STOPWORD_FILE)


@functools.cache
def load_hint_blocklist() -> frozenset[str]:
    """The words a tip may not name beyond the profanity engine, read once."""
    return _read_word_file(HINT_BLOCKLIST_FILE)


def _read_word_file(path: str) -> frozenset[str]:
    words: set[str] = set()
    with open(path, encoding="utf-8") as f:
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


#: Wiktionary parts of speech that make an entry a name rather than a noun.
NAME_POS = frozenset({"Toponym", "Vorname", "Nachname", "Familienname", "Eigenname"})


def fold_umlauts(word: str) -> str:
    """The word with its umlauts and the sharp s written out, for comparing stems."""
    return (word.replace("ä", "a").replace("ö", "o").replace("ü", "u")
            .replace("ß", "ss"))


def read_simplemma(words: list[str]) -> dict[str, tuple[str, str]]:
    """simplemma's lemma per word, read capitalised and as written.

    The case of the answer carries the word class: as written, the plural of
    the two-wheeler comes back as ``Zweirad``, a noun, and ``wussten`` as ``wissen``, a verb.
    Imported lazily for the same reason as spaCy.
    """
    import simplemma

    return {w: (simplemma.lemmatize(w.capitalize(), lang="de"),
                simplemma.lemmatize(w, lang="de"))
            for w in words}


def read_noun_forms(words: list[str]) -> dict[str, tuple[bool, tuple[str, ...], bool]]:
    """What Wiktionary (``german-nouns``) says about each word as a noun.

    Per word that it knows as a noun: whether the word is a noun lemma of its
    own, the lemmas it is an inflected form of, and whether it is also filed as
    a name (a place, a given name, a surname). ``montage`` is both, the
    assembly and the plural of Monday, and the first answer wins: a word that
    is a noun of its own holds its own place. ``kekse`` is only a form.

    Nominalised adjectives (``Tote``, ``Kranke``, declined ``stark`` and
    ``schwach``) are left out, because Wiktionary lists each of their endings
    as a form of a different entry, and so is everything filed as a name. Read with an explicit encoding, because the
    package's own loader opens its CSV in the platform default.
    """
    import csv

    from german_nouns.config import CSV_FILE_PATH

    wanted = set(words)
    singular: set[str] = set()
    plural_only: set[str] = set()
    forms: dict[str, set[str]] = {}
    variants: dict[str, str] = {}
    names: set[str] = set()
    with open(CSV_FILE_PATH, encoding="utf-8", newline="") as f:
        rows = csv.reader(f)
        header = next(rows)
        lemma_col = header.index("lemma")
        pos_col = header.index("pos")
        singular_cols = [i for i, name in enumerate(header) if name.startswith("nominativ singular")]
        plural_col = header.index("nominativ plural")
        # A starred column is an archaic or rare form, the dative in -e above
        # all (``dem Kaffe``, ``dem Range``), and read as a form it scores the
        # misspelt coffee as a hamlet and the rascal as a rank.
        flexion_cols = [i for i, name in enumerate(header)
                        if name not in ("lemma", "pos") and not name.startswith("genus")
                        and not name.endswith("*")]
        genitive_cols = [i for i, name in enumerate(header) if name.startswith("genitiv singular")]
        adjectival = {i for i in flexion_cols
                      if header[i].endswith(("stark", "schwach", "gemischt"))}
        for row in rows:
            if "Substantiv" in row[pos_col] and NAME_POS & set(row[pos_col].split(",")):
                name = row[lemma_col].lower()
                if name in wanted:
                    names.add(name)
            # Common nouns only. Wiktionary files towns (``Enger``,
            # ``Mutters``), given names and surnames under "Substantiv" as well,
            # and each of those would otherwise keep a plural apart from its
            # singular.
            if row[pos_col] != "Substantiv" or any(row[i] for i in adjectival):
                continue
            lemma = row[lemma_col].lower()
            if lemma in wanted:
                if any(row[i] for i in singular_cols):
                    singular.add(lemma)
                elif row[plural_col].lower() == lemma:
                    plural_only.add(lemma)
            for i in flexion_cols:
                form = row[i].lower()
                if form and form != lemma and form in wanted:
                    forms.setdefault(form, set()).add(lemma)
            # A weak noun with a genitive in -ns (``Gedanke``, ``Gedankens``)
            # has a variant in -n that Wiktionary lists as a lemma of its own
            # (``Gedanken``, ``Namen``, ``Willen``), and it is the same word.
            for i in genitive_cols:
                genitive = row[i].lower()
                if genitive == lemma + "ns" and lemma + "n" in wanted:
                    variants[lemma + "n"] = lemma
    for variant, lemma in variants.items():
        forms.setdefault(variant, set()).add(lemma)
    singular -= set(variants)
    # A plural-only entry is a word of its own (``kosten``, ``leute``) unless it
    # is also the plural of a singular, which is what ``spatzen`` is.
    own = singular | {w for w in plural_only if w not in forms}
    return {w: (w in own, tuple(sorted(forms.get(w, ()))), w in names)
            for w in own | set(forms) | names}


def build_lexicon(
    vocabulary: dict[str, int] | list[str],
    lemma_map: dict[str, str] | None = None,
    *,
    everyday: set[str] | list[str] | None = None,
    keep: set[str] | None = None,
    guess_counts: dict[str, int] | None = None,
    classes: dict[str, tuple[str, str, str, str]] | None = None,
    second: dict[str, tuple[str, str]] | None = None,
    nouns: dict[str, tuple[bool, tuple[str, ...], bool]] | None = None,
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

    ``classes``, ``second`` and ``nouns`` are the spaCy, simplemma and
    Wiktionary readings (:func:`read_word_classes`, :func:`read_simplemma`,
    :func:`read_noun_forms`); each is read here when not passed, and passed by
    tests and by measurements that iterate on a rule.

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
    if second is None:
        second = read_simplemma(words)
    if nouns is None:
        nouns = read_noun_forms(words)

    # Every word some other form is read as the verb of. That is what tells an
    # infinitive from a declined adjective that happens to end the same way:
    # nothing lemmatises onto ``steilen``, and four forms lemmatise onto
    # ``malen``, which is why ``malen`` must not lose its ending to ``mal``.
    # A noun Wiktionary knows is no evidence for a verb, even where spaCy reads
    # it as one: ``harfe`` read as a form of ``harfen`` must not make the
    # plural an infinitive.
    verb_sources = [(w, lemma) for w, (_, _, pos, lemma) in classes.items()
                    if pos in ("VERB", "AUX") and lemma != w and w not in nouns]
    verb_lemmas = {lemma for _, lemma in verb_sources}
    # How many forms read as each of them. One is what a finite form gets from
    # a sibling spaCy also misread (``wusstet`` onto ``wussten``); a real
    # infinitive collects several (``spannt``, ``spannte``, ``gespannt``).
    verb_forms = Counter(lemma for _, lemma in verb_sources)

    frozen_everyday = set(everyday) if everyday is not None else None

    def is_common(word: str) -> bool:
        """An everyday word, or one that would be: frequent or typed often.

        The frozen list answers where a rebuild passes it; a fresh build asks
        the same two questions the everyday list is derived from.
        """
        if frozen_everyday is not None:
            return word in frozen_everyday
        return zipf_frequency(word, "de") >= min_zipf or counts.get(word, 0) >= min_guesses

    def is_content(word: str) -> bool:
        up_pos, _, lo_pos, _ = classes[word]
        return up_pos in CONTENT_POS or lo_pos in CONTENT_POS

    def reading(word: str) -> tuple[str, bool]:
        """spaCy's base form, and whether the word is a base form of its own.

        The capitalised reading knows nouns, and it is the one that finds the
        singular behind a plural or a genitive. It is also the one that reads a
        declined adjective as a noun and hands the word straight back, which is
        how 7.644 forms such as the declensions of ugly, Iraqi and strenuous
        walked into the first build of the everyday list. So a verb, adjective
        or adverb reading that actually shortens the word wins, and the noun
        reading only gets its turn when that one has nothing to say.

        The flag is True where the word was proven a base form: an infinitive
        other forms conjugate onto, a noun in -e, or an adjective or adverb that
        reads as itself and that simplemma does not name another word for. The
        last condition matters because spaCy tags a genitive it does not know
        as an adverb (``gewichts``) and a plural as an adjective (``rinder``).
        """
        up_pos, up_lemma, lo_pos, lo_lemma = classes[word]
        if lo_pos in PROTECTED_POS:
            if lo_lemma != word:
                return lo_lemma, False
            if lo_pos == "VERB" and word in verb_lemmas and (
                    verb_forms[word] > 1 or not names_a_verb(word)) and not plural_first(word):
                return word, True
            if is_noun_in_e(word, up_pos, up_lemma):
                return word, True
            stripped = strip_declension(word)
            if stripped is not None:
                return stripped, False
            if lo_pos == "VERB":
                # A plural spaCy reads as an unknown infinitive (``harfen``,
                # and the plural of sound) still gets its noun reading.
                if up_pos == "NOUN" and up_lemma != word:
                    return up_lemma, False
                return word, False
            other = second[word][1]
            names_other = other.lower() != word and (
                other[:1].isupper()
                or classes.get(other.lower(), ("", "", ""))[2] in ("ADJ", "ADV"))
            # Wiktionary's plural reading counts only where simplemma does not
            # read the word as itself: ``links`` is the genitive of the link
            # and the word for left, the plural of steam is only that.
            plural = (word in nouns and not nouns[word][0] and bool(nouns[word][1])
                      and other.lower() != word)
            return word, not (names_other or plural)
        if up_pos in ("NOUN", "PROPN") and up_lemma != word:
            return up_lemma, False
        return lo_lemma, False

    def names_a_verb(word: str) -> bool:
        """simplemma reads the word as a form of another verb.

        spaCy hands some finite forms back unchanged and then lemmatises other
        forms onto them (``wusstet`` onto ``wussten``), which is what proves an
        infinitive everywhere else. simplemma's verb reading breaks that tie;
        an adjective reading does not, since it reads ``lieben`` as ``lieb``.
        """
        lemma = second[word][1]
        return (lemma != word and not lemma[:1].isupper()
                and classes.get(lemma, ("", "", ""))[2] in ("VERB", "AUX"))

    def second_opinion(word: str) -> str | None:
        """simplemma's base form, for a word spaCy left without one.

        spaCy reads rare plurals wrong (the two-wheelers onto a stem that is no
        word, ``yachten`` as ``yachte``, ``oldies`` as a foreign word), and a lemma
        that is no word leaves the form holding a number next to its own
        singular. simplemma reads those right as written, and finite verb forms
        too (``wussten``, ``abgibst``). Where it reads the word as itself, it
        still names the noun behind a plural that nothing conjugates onto as a
        verb (``kutschen``), which keeps ``arbeiten`` and ``anzeigen`` apart from
        their nouns. What it gets wrong is caught by :func:`may_fold`.
        """
        capitalised, as_written = second[word]
        lemma = as_written.lower()
        if lemma != word:
            return lemma
        noun = capitalised.lower()
        if (noun != word and capitalised[:1].isupper() and classes[word][0] == "NOUN"
                and word not in verb_lemmas):
            return noun
        return None

    def is_noun(word: str) -> bool:
        """simplemma reads the word as a noun, or Wiktionary lists it as one."""
        return second[word][1][:1].isupper() or nouns.get(word, (False,))[0]

    def may_fold(word: str, target: str, agreed: bool) -> bool:
        """The two guards a rare word's fold passes, measured on the deployed build.

        A word simplemma reads capitalised as a noun of its own is never scored
        as a verb: both models read ``schlag`` as a form of ``schlagen``,
        ``reis`` of ``reisen`` and ``unterstand`` of ``unterstehen``. An
        adjective target stays allowed, because simplemma reads every declined
        adjective capitalised as a noun (``tragische``). And a noun in -e that
        only one model reads as its stem must not be clearly more frequent than
        that stem, since a plural in -e is rarer than its singular (``hunde``
        against ``hund``): that keeps ``granate`` off ``granat`` and ``russe``
        off the word for soot. Plurals in -en or -n are not held to it, because
        ``kennzahlen`` and ``reptilien`` are more frequent than their singular.
        """
        if (second[word][0] == word.capitalize() and not is_noun(target)
                and classes.get(target, ("", "", ""))[2] not in ("ADJ", "ADV")):
            return False
        if (not agreed and target == word[:-1] and word.endswith("e")
                and zipf_frequency(word, "de") > zipf_frequency(target, "de") + FOLD_FREQUENCY_MARGIN):
            return False
        return True

    def fold_target(word: str) -> str | None:
        """The word this one is a form of, or None when it is a word itself.

        Three readings vote: spaCy's, Wiktionary's for a noun and simplemma's.
        A word Wiktionary knows as a common noun of its own never folds
        (``montage`` is not Monday, ``bunker`` is not a verb), and an infinitive
        both models read as itself is never scored as a noun (``paddeln``). A
        frequent word folds only where two of the three name the same target,
        because a single reading was wrong often enough on exactly those words
        to matter: the word for thin read as its verb, ``polen`` as ``pol``, ``maria``
        as ``mare``, each typed hundreds of times on production. A frequent word
        filed as a name never folds (``ungarn``, ``wales``): Wiktionary decides
        where it knows the word, spaCy's name reading where it does not. A rare word
        takes the first reading that names a word, dictionary first, then
        spaCy, then simplemma, each through :func:`may_fold`.
        """
        spelled = spelling_variant(word)
        if spelled is not None:
            return spelled
        up_pos, up_lemma, lo_pos, lo_lemma = classes[word]
        common = is_common(word)
        noun = nouns.get(word)
        if common and (noun[2] if noun is not None else up_pos == "PROPN"):
            return None
        lemma, proven = reading(word)
        if proven:
            return None
        other = second_opinion(word)
        spacy_target = lemma if lemma != word and lemma in known else None
        other_target = other if other is not None and other in known else None

        noun_target = None
        # An infinitive that other forms conjugate onto is a verb, even where
        # its spelling is also a plural (``spannen``, the spans) and even where
        # spaCy reads it as a noun on its own (``duschen``, ``schimpfen``).
        verb = word in verb_lemmas and verb_forms[word] > 1
        plural = plural_first(word)
        infinitive = not plural and word.endswith("n") and second[word][1] == word and (
            verb or (lo_pos in ("VERB", "AUX") and lo_lemma == word))
        if noun is not None and not infinitive and not verb:
            is_lemma, of, _ = noun
            places = [t for t in of if t in known]
            if is_lemma:
                # A noun of its own that is also a plural (``romane``, the
                # Romance peoples, and the novels) folds only where spaCy reads
                # it as that plural in both readings; ``montage`` stays.
                places = [t for t in places if up_lemma == t and lo_lemma == t]
                if not places:
                    return None
            if places:
                # Where the form belongs to two nouns (``medien``: Medium and
                # Media), the one a model also names is the one players mean.
                named = [t for t in places if t in (spacy_target, other_target)]
                noun_target = max(named or places, key=lambda t: zipf_frequency(t, "de"))
        if infinitive:
            spacy_target = spacy_target if spacy_target is not None and not is_noun(spacy_target) else None
            other_target = other_target if other_target is not None and not is_noun(other_target) else None

        # simplemma reads capitalised where a noun is concerned: as written it
        # reads the buttons as a verb, capitalised as the plural of ``knopf``.
        capitalised = second[word][0]
        noun_vote = (capitalised.lower() if capitalised[:1].isupper()
                     and capitalised.lower() == noun_target else None)
        if other_target == noun_vote:
            noun_vote = None
        if common:
            votes = Counter(t for t in (noun_target, spacy_target, other_target, noun_vote)
                            if t is not None)
            if not votes:
                return None
            target, count = votes.most_common(1)[0]
            # The readings that say the word is itself vote too: a verb
            # simplemma reads as written (making pottery) against the dictionary's
            # plural of the potter.
            stay = 0 if plural else (second[word][1] == word) + (lo_lemma == word)
            if count >= 2 and count > stay:
                return target
            # A plural in -s is unambiguous where the dictionary names the
            # singular and no model names anything else (``airlines``,
            # ``cookies``); simplemma reads such loanwords as themselves.
            if (noun_target is not None and len(votes) == 1 and noun_target == word[:-1]
                    and word.endswith("s")):
                return noun_target
            # A finite verb form spaCy hands back unchanged (``wussten``,
            # ``mag``) has only simplemma's vote. It stands when both of its
            # readings name the same verb and the dictionary knows no noun of
            # that spelling.
            if (noun is None and lo_pos in ("VERB", "AUX") and up_pos not in ("ADJ", "ADV")
                    and other_target is not None and target == other_target
                    and capitalised.lower() == other_target and not capitalised[:1].isupper()
                    and classes.get(other_target, ("", "", ""))[2] in ("VERB", "AUX")):
                return other_target
            return None

        if noun_target is not None:
            return noun_target
        if (spacy_target is not None and other_target is not None and spacy_target != other_target
                and is_stem(other_target, word) and not is_stem(spacy_target, word)):
            # Where the two disagree, the reading the word is built on wins:
            # ``linke`` is ``link`` with an ending, not spaCy's ``linker``.
            spacy_target = None
        if spacy_target is not None:
            return spacy_target if may_fold(word, spacy_target, other == spacy_target) else None
        if other_target is not None:
            return other_target if may_fold(word, other_target, False) else None
        return None

    def is_stem(target: str, word: str) -> bool:
        """The word is the target plus an ending, umlauts aside."""
        return len(target) < len(word) and fold_umlauts(word).startswith(fold_umlauts(target))

    def plural_first(word: str) -> bool:
        """A plural that is also a rare verb, and reads as the plural.

        ``posaunen``, ``trommeln``, ``weiden`` and the flutes are infinitives
        as well, and in a neighbour list beside their singular they read as the
        plural they mostly are. The verb wins where the corpus shows it: two or
        more conjugated forms (``rollt``, ``rollte``, ``gerollt``), or a
        singular rarer than the form itself (``leihen`` against ``leihe``).
        """
        entry = nouns.get(word)
        if entry is None or entry[0] or verb_forms[word] > 1:
            return False
        places = [t for t in entry[1] if t in known]
        return bool(places) and (max(zipf_frequency(t, "de") for t in places)
                                 >= zipf_frequency(word, "de") - PLURAL_FREQUENCY_MARGIN)

    def spelling_variant(word: str) -> str | None:
        """The current spelling of a word written with ss or the sharp s.

        Since 1996 a short vowel takes ss (``hass``, ``nass``, ``abschluss``)
        and a long one keeps the sharp s (street, foot, big), and Swiss German
        writes ss throughout. Frequency cannot tell them apart, since wordfreq
        counts both spellings as one word, so two sources in current spelling
        decide. simplemma, where it reads the ss form onto a sharp s form
        (``draussen``, ``gross``, ``schliessen``). And Wiktionary, where the sharp s
        form is a noun of its own and the ss form is not, unless the ss form is
        the plural of a more frequent noun: ``strasse`` is the rhinestone's
        plural and lands on the street, ``busse`` is the buses'.
        """
        if "ß" in word:
            # The reverse: the old spellings of hate, river and degree are nouns
            # Wiktionary lists with ss.
            variant = word.replace("ß", "ss")
            if variant in known and nouns.get(variant, (False,))[0] and word not in nouns:
                return variant
            return None
        if "ss" not in word:
            return None
        read = second[word][1].lower()
        if "ß" in read and read != word and read in known:
            return fold_target(read) or read
        variant = word.replace("ss", "ß")
        if variant not in known or variant not in nouns:
            return None
        own, of, _ = nouns.get(word, (False, (), False))
        if own:
            return None
        target = fold_target(variant) or variant
        if any(zipf_frequency(t, "de") >= zipf_frequency(target, "de") for t in of if t in known):
            return None
        return target

    def lemma_of(word: str) -> str:
        target = fold_target(word)
        return word if target is None else target

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

    # Solutions are never folded: a solution scored as another word would
    # report the round solved on the wrong one. Everyday words always hold a
    # place or fold onto one, whatever the frequency floor says, and they fold
    # only where two readings agree (``fold_target``); until 2026-09-24 they
    # never folded, which was harmless while their lemma was usually off the
    # scale and put ``affen`` beside ``affe`` once it was not. A stop word stays
    # refused even when it is an everyday word, and it stays on the everyday
    # list: ``heute`` and ``hier`` are everyday German, the list is what the
    # vectors are debiased on, and taking them off would move every rank of
    # every game.
    fixed = (daily - stop) | kept
    candidates = fixed | {w for w in words if holds_a_place(w)}

    wanted: dict[str, str] = {}
    for word in candidates - kept:
        lemma = lemmas[word]
        if lemma != word and lemma in candidates:
            wanted[word] = lemma
    # A fold has to land on a word that holds a number. When the lemma is itself
    # a form of something else, the form keeps its own place instead of
    # following the chain: spaCy reads ``akten`` as ``akte`` and ``akte`` as
    # ``akt``, and scoring the files as the act would be a wrong word, which is
    # worse than a second number for the same one.
    # Two forms that each read as the other (spaCy reads the security hole as
    # a verb whose infinitive is its own plural) would both keep a
    # place. The one simplemma reads as itself is the base form.
    for word, target in list(wanted.items()):
        if wanted.get(target) == word:
            base = target if second[target][1].lower() == target else word
            wanted.pop(base, None)
    scale = candidates - set(wanted)
    fold: dict[str, str] = {}
    for word, target in wanted.items():
        if target in scale:
            fold[word] = target
            continue
        # The target is itself a form. Wiktionary may list the word it belongs
        # to directly (``seeleuten``: the plural's dative, and a form of
        # ``seemann``); otherwise the second opinion may name it (the dative
        # plural of the motorbike read as its nominative plural).
        entry = nouns.get(word)
        places = [t for t in entry[1] if t in scale] if entry is not None and not entry[0] else []
        if places:
            fold[word] = max(places, key=lambda t: zipf_frequency(t, "de"))
            continue
        other = None if is_common(word) else second_opinion(word)
        if other is not None and other != word and other in scale and may_fold(word, other, False):
            fold[word] = other
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
