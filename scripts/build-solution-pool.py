"""Propose solution words the way the original Contexto picks them.

What the original does, measured
--------------------------------
The archive of 1.461 Contexto answers says what that game draws from, and it
is not what this project had been doing:

    Zipf(en)          p5 2,86   p25 3,58   median 4,11   p75 4,63   p95 5,24
    frequency rank    median 5.889, p90 24.699, almost nothing past 50.000
    word class        common nouns, with a sizeable share of abstract ones
    length            mean 6,0 letters, longest of 1.461 is 13
    compounds         about 7%

The pool this feeds sat at median rank 13.606 and p90 40.136, so it was drawn
from a band roughly twice as rare. That is the single biggest reason the game
played harder than the original, and striking words does not fix it: the
frequent words were never candidates, because the old gate demanded
concreteness and the concreteness norms do not rate abstract nouns.

So this script generates from the band instead, and every filter the project
had already agreed on stays in front of it.

The gates, in order
-------------------
1. **Frequency band.** German frequency rank up to ``MAX_RANK``, which is where
   the original stops.
2. **Word class, strictly.** The tagger in ``TargetWordFilter`` alone lets
   particles, conjunctions and infinitives through at this frequency, so a
   word counts as a noun only if Wiktionary lists it as a noun lemma **and**
   the tagger agrees **and** it is not in ``data/function_words_de.txt``.
3. **The existing filters, unchanged.** ``TargetWordFilter`` for proper names,
   inflected forms, the profanity list and the foreign-word margin, plus
   ``SOLUTION_BLOCKLIST`` and membership in the vocabulary.
4. **German, not English.** The original is an English game and its list is
   naturally English; ours has to be German, so a word whose English frequency
   outruns its German one by ``FOREIGN_MARGIN`` is dropped even where the
   dictionary lists it.
5. **The reject list is memory.** Anything already struck by hand under one of
   the codes in ``solution_rejects.txt`` stays struck; this script never
   proposes it again.

What comes out is a candidate list, not a pool. The last gate is still a
person reading it, in the semantic clusters that ``scripts/recode-pool.py``
documents.
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT / "backend"))

#: Where the original stops. Its p90 is 24.699, and drawing past this only
#: adds words no player reaches.
MAX_RANK = 25_000

#: A word whose English frequency exceeds its German one by this much is a
#: loanword that has not settled into German.
FOREIGN_MARGIN = 0.4

FUNCTION_WORDS_FILE = ROOT / "backend" / "data" / "function_words_de.txt"


def read_word_file(path: pathlib.Path) -> set[str]:
    return {line.strip() for line in path.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.startswith("#")}


def load_lists() -> tuple[set[str], set[str]]:
    data = ROOT / "backend" / "data"
    pool = read_word_file(data / "solution_pool.txt")
    rejects = set()
    for line in (data / "solution_rejects.txt").read_text(encoding="utf-8").splitlines():
        if line.strip() and not line.startswith("#") and "=" in line:
            rejects.add(line.split("=")[0].strip())
    return pool, rejects


def build(data_dir: str, max_rank: int) -> list[tuple[int, str, float]]:
    from HanTa import HanoverTagger as hnt
    from german_nouns.lookup import Nouns
    from wordfreq import top_n_list, zipf_frequency

    import target_selection as ts
    from wordlists import SOLUTION_BLOCKLIST

    pool, rejects = load_lists()
    closed_class = read_word_file(FUNCTION_WORDS_FILE)
    decided = pool | rejects | {w.lower() for w in SOLUTION_BLOCKLIST}

    vocabulary = set(json.load(open(os.path.join(data_dir, "vocabulary.json"), encoding="utf-8")))
    tagger = hnt.HanoverTagger("morphmodel_ger.pgz")
    dictionary = Nouns()
    word_filter = ts.TargetWordFilter(min_zipf_de=0.0, require_concrete=False)

    def is_noun(word: str) -> bool:
        """Wiktionary and the tagger have to agree, and it must be the lemma.

        The capitalised form is not enough on its own: the tagger reads every
        capitalised string as a noun, so an infinitive, an adjective or a
        place derivation all come back as NN. The lowercase reading settles
        it, and a verb form or an adjective there outvotes the dictionary.
        """
        if word in closed_class:
            return False
        try:
            entries = dictionary[word.capitalize()]
        except Exception:
            entries = None
        if not entries:
            return False
        if not any(isinstance(e, dict) and str(e.get("lemma", "")).lower() == word
                   for e in entries):
            return False
        tag = tagger.analyze(word.capitalize(), taglevel=1)
        if not tag or tag[1] != "NN" or str(tag[0]).lower() != word:
            return False
        lemma, pos = tagger.analyze(word, taglevel=1)
        if pos.startswith(("ADJ", "APPR", "VA", "PTK", "KO")):
            return False
        if pos.startswith("VV") and (pos == "VV(INF)" or str(lemma).lower() != word):
            return False
        return True

    def is_german(word: str) -> bool:
        return zipf_frequency(word, "en") - zipf_frequency(word, "de") < FOREIGN_MARGIN

    out: list[tuple[int, str, float]] = []
    for rank, word in enumerate(top_n_list("de", max_rank), start=1):
        if word in decided or word not in vocabulary or not word.isalpha() or len(word) < 3:
            continue
        if not is_noun(word) or not is_german(word):
            continue
        if not word_filter.is_valid_target(word):
            continue
        out.append((rank, word, round(zipf_frequency(word, "de"), 2)))
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="propose solution-word candidates")
    parser.add_argument("--data-dir", default=str(ROOT / ".regen-work" / "core"))
    parser.add_argument("--max-rank", type=int, default=MAX_RANK)
    parser.add_argument("--out", default=str(ROOT / ".regen-work" / "candidates.tsv"))
    args = parser.parse_args()

    rows = build(args.data_dir, args.max_rank)
    with open(args.out, "w", encoding="utf-8") as handle:
        for rank, word, zipf in rows:
            handle.write(f"{word}\t{rank}\t{zipf}\n")
    print(f"{len(rows)} candidates written to {args.out}")
    for lo, hi in ((1, 2000), (2000, 5000), (5000, 10000), (10000, args.max_rank)):
        band = [w for r, w, _ in rows if lo <= r < hi]
        print(f"\nrank {lo}-{hi}: {len(band)}")
        print("  " + "  ".join(band[:50]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
