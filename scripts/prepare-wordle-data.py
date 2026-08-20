#!/usr/bin/env python3
"""Generate German Wördle word lists from the project's own vocabulary.

Self-contained: the lists are derived from ``vocabulary.json`` / ``lemma_map.json``
(produced by the Kontexto data preparation that runs first), so there is no
external download to rot. The previous source (Hugo0/wordle) was restructured
and its German word file now 404s.

Two tiers are written to ``<data>/wordle/``:

* ``solutions.json``: daily answers. Common, base-form German content words run
  through the same :class:`TargetWordFilter` as Kontexto, so no names, foreign
  words, inflected forms or fragments ever become a solution.
* ``valid_words.json``: accepted guesses. Every 5-letter a-z word in the
  vocabulary (plus inflected forms from the lemma map), kept permissive.

Wördle here uses the 26-letter a-z alphabet (no ä/ö/ü/ß), matching the existing
keyboard, so words containing umlauts are excluded by construction.
"""

import json
import os
import random
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "backend"))

from wordfreq import zipf_frequency  # noqa: E402

from prepare import EXCLUDED_TARGET_WORDS, GERMAN_STOPWORDS  # noqa: E402
from target_selection import TargetWordFilter  # noqa: E402

DATA_DIR = os.environ.get("KONTEXTO_DATA_DIR", os.path.join(HERE, "..", "data"))
OUTPUT_DIR = os.path.join(DATA_DIR, "wordle")

FIVE_LETTER = re.compile(r"^[a-z]{5}$")
# Wördle solutions use a looser bar than Kontexto (3.0 instead of 4.0): the
# 5-letter constraint already shrinks the pool hard, and at 4.0 there would only
# be ~1 year of daily puzzles. 3.0 still keeps them well-known words and yields
# ~1050 solutions (~3 years). Guesses (valid_words) stay fully permissive.
SOLUTION_MIN_ZIPF = 3.0
SHUFFLE_SEED = 42


def _load_words(path: str) -> list[str]:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    # vocabulary.json is {word: index}; lemma_map.json is {form: lemma}.
    return list(data.keys()) if isinstance(data, dict) else list(data)


def main() -> None:
    vocab_path = os.path.join(DATA_DIR, "vocabulary.json")
    if not os.path.exists(vocab_path):
        raise SystemExit(
            f"vocabulary.json not found at {vocab_path}; run the Kontexto data "
            "preparation first (it produces the vocabulary Wördle builds on)."
        )

    vocab = _load_words(vocab_path)
    lemma_path = os.path.join(DATA_DIR, "lemma_map.json")
    lemma_forms = _load_words(lemma_path) if os.path.exists(lemma_path) else []

    five_vocab = [w for w in vocab if FIVE_LETTER.match(w)]

    # Accepted guesses: every 5-letter a-z word we know, including inflected
    # forms, so players are rarely told a real word is "invalid".
    valid_words = sorted(
        {w for w in five_vocab}
        | {w for w in lemma_forms if FIVE_LETTER.match(w)}
    )

    # Daily solutions, common, sensible and base-form: no names, foreign
    # words, fragments or function words.
    target_filter = TargetWordFilter()
    solutions = [
        w
        for w in five_vocab
        if w not in GERMAN_STOPWORDS
        and w not in EXCLUDED_TARGET_WORDS
        and zipf_frequency(w, "de") >= SOLUTION_MIN_ZIPF
        and target_filter.is_valid_target(w)
    ]
    # Order by frequency, then shuffle deterministically so daily difficulty
    # varies without a frequency ramp.
    solutions.sort(key=lambda w: -zipf_frequency(w, "de"))
    random.Random(SHUFFLE_SEED).shuffle(solutions)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    solutions_path = os.path.join(OUTPUT_DIR, "solutions.json")
    valid_path = os.path.join(OUTPUT_DIR, "valid_words.json")
    with open(solutions_path, "w", encoding="utf-8") as f:
        json.dump(solutions, f, ensure_ascii=False)
    with open(valid_path, "w", encoding="utf-8") as f:
        json.dump(valid_words, f, ensure_ascii=False)

    print(f"Solutions:   {len(solutions)} words -> {solutions_path}")
    print(f"Valid words: {len(valid_words)} words -> {valid_path}")


if __name__ == "__main__":
    main()
