#!/usr/bin/env python3
"""List the words on the scale that look purely English, for a reading pass.

Why
---
The vectors come from a German Common Crawl model, and German web text carries
enough English that ``village``, ``cinema`` and ``captain`` each held a number
of their own until 2026-09-25, right next to the German word they translate.
``backend/data/english_words_de.txt`` takes them off the scale; this script
finds the candidates for it. It decides nothing: what it prints is read line by
line, and each word goes either into that file (with its German word) or into
``backend/data/english_words_kept.txt``. Both are left out of the next run.

What makes a candidate
----------------------
A word on the scale, not a solution, that the German Wiktionary does not list
as a German word or as a form of one, and that is English by one of two tests:

* the English section of the German Wiktionary describes it (or its English
  lemma, read by simplemma, so ``hills`` finds ``hill``), which also yields the
  German translation proposed as its target;
* or, where the dictionary is silent, it is clearly more frequent in English
  than in German (wordfreq, ``EN_MARGIN``) and frequent enough in English to be
  a word rather than a code (``EN_FLOOR``). That test is what catches
  ``tourism`` and ``hills``, which the dictionary's English section lacks, and
  it is also what brings in most of the names, which is why nothing here is
  applied without reading it.

Names, obsolete spellings and variants in the German dictionary do not make a
word German: the name Leon lists ``lion`` as a variant and the old spelling
Photo lists ``photo``, and neither is a reason to keep an English word.

The dump
--------
The German Wiktionary as extracted by wiktextract, from
https://kaikki.org/dewiktionary/rawdata.html (``raw-wiktextract-data.jsonl.gz``,
about 300 MB, CC BY-SA). It is read once, streamed, and never committed.

Usage
-----
    python scripts/find-english-words.py \\
        --wiktionary .regen-work/wiktionary/dewiktionary.jsonl.gz \\
        --data-dir .regen-work/prod \\
        --guess-counts .regen-work/guess-counts.json > candidates.tsv

The data directory is a copy of the deployed one (``core_words.json``,
``fold_map.json``, ``target_words.json``). Output columns: word, the test that
found it, guesses on production, proposed German target (``-`` for none), the
first dictionary gloss.
"""

from __future__ import annotations

import argparse
import gzip
import json
import os
import re
import sys
from dataclasses import dataclass, field

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "backend"))

import core_lexicon  # noqa: E402

#: How much more frequent (Zipf) a word must be in English than in German to be
#: a candidate on frequency alone. Measured on 2026-09-25: 0,3 finds tourism,
#: hills and telescope and misses no word the dictionary test found.
EN_MARGIN = 0.3
#: English Zipf a frequency-only candidate must reach, so that abbreviations and
#: codes that happen to be rarer in German stay out.
EN_FLOOR = 3.5
#: Form tags that do not make a spelling a German word of today.
DATED_TAGS = frozenset({"obsolete", "variant", "archaic"})
KEPT_FILE = os.path.join(HERE, "..", "backend", "data", "english_words_kept.txt")


@dataclass
class EnglishEntry:
    glosses: list[str] = field(default_factory=list)
    translations: list[str] = field(default_factory=list)


def read_dump(path: str) -> tuple[set[str], set[str], dict[str, EnglishEntry]]:
    """German words and forms, German names, and the English entries."""
    german: set[str] = set()
    names: set[str] = set()
    english: dict[str, EnglishEntry] = {}
    with gzip.open(path, "rt", encoding="utf-8") as f:
        for line in f:
            entry = json.loads(line)
            word = (entry.get("word") or "").lower()
            if not word:
                continue
            language = entry.get("lang_code")
            if language == "de":
                pos = entry.get("pos")
                if pos == "name":
                    names.add(word)
                    continue
                if pos == "unknown":
                    continue
                german.add(word)
                for form in entry.get("forms") or ():
                    text = (form.get("form") or "").lower()
                    if text and " " not in text and not DATED_TAGS & set(form.get("tags") or ()):
                        german.add(text)
            elif language == "en":
                target = english.setdefault(word, EnglishEntry())
                for sense in entry.get("senses") or ():
                    target.glosses.extend(sense.get("glosses") or ())
                for translation in entry.get("translations") or ():
                    if translation.get("lang_code") == "de" and translation.get("word"):
                        target.translations.append(translation["word"])
    return german, names, english


def read_decided() -> set[str]:
    """Every word already ruled on, in either file."""
    decided = set(core_lexicon.load_english_words())
    with open(KEPT_FILE, encoding="utf-8") as f:
        decided |= {line.strip().lower() for line in f if line.strip() and not line.startswith("#")}
    return decided


def proposed_target(entry: EnglishEntry, scale: set[str], fold: dict[str, str],
                    exclude: set[str]) -> str | None:
    """The first translation or single-word gloss that holds a number."""
    offers = [t for t in entry.translations if " " not in t]
    for gloss in entry.glosses:
        offers.extend(p.strip() for p in re.split(r"[,;:]", gloss) if p.strip() and " " not in p.strip())
    for offer in offers:
        word = offer.lower()
        word = fold.get(word, word)
        if word in scale and word not in exclude:
            return word
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--wiktionary", required=True, help="raw-wiktextract-data.jsonl.gz of dewiktionary")
    ap.add_argument("--data-dir", required=True, help="copy of the deployed data directory")
    ap.add_argument("--guess-counts", default=None,
                    help="JSON object word -> how often it was guessed on production")
    args = ap.parse_args()

    import simplemma
    from wordfreq import zipf_frequency

    scale = set(core_lexicon.load_core_words(args.data_dir) or ())
    if not scale:
        raise SystemExit(f"ABORT: {args.data_dir} carries no core_words.json")
    fold = core_lexicon.load_fold_map(args.data_dir)
    with open(os.path.join(args.data_dir, "target_words.json"), encoding="utf-8") as f:
        solutions = set(json.load(f))
    counts: dict[str, int] = {}
    if args.guess_counts:
        with open(args.guess_counts, encoding="utf-8") as f:
            counts = json.load(f)

    print("Reading the dictionary ...", file=sys.stderr, flush=True)
    german, names, english = read_dump(args.wiktionary)
    decided = read_decided()

    def english_entry(word: str) -> EnglishEntry | None:
        entry = english.get(word)
        if entry is not None and entry.glosses:
            return entry
        lemma = simplemma.lemmatize(word, lang="en")
        entry = english.get(lemma)
        return entry if entry is not None and entry.glosses else None

    found = []
    for word in sorted(scale - solutions - decided - german):
        entry = english_entry(word)
        if entry is not None:
            found.append((word, "dictionary", entry))
            continue
        de, en = zipf_frequency(word, "de"), zipf_frequency(word, "en")
        if word not in names and en >= de + EN_MARGIN and en >= EN_FLOOR:
            found.append((word, "frequency", None))

    flagged = {word for word, _, _ in found}
    for word, test, entry in found:
        target = proposed_target(entry, scale, fold, flagged) if entry is not None else None
        gloss = entry.glosses[0][:80] if entry is not None and entry.glosses else ""
        print("\t".join((word, test, str(counts.get(word, 0)), target or "-", gloss)))
    print(f"{len(found)} candidates, {len(decided)} words already ruled on", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
