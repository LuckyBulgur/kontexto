#!/usr/bin/env python3
"""Derive ``backend/data/concrete_nouns.txt`` from the German concreteness norms.

Background
----------
Kontexto solutions used to be chosen by word frequency alone. Measured against
production on 2026-09-21, frequency is the weaker signal by a wide margin:

    AbstConc  < 4.0  ->  118 guesses per solve
    AbstConc  >= 7.0 ->   48 guesses per solve

while the frequency bands of the same pool differ by only about a third. The
rating therefore becomes a hard gate for solutions (see
``target_selection.TargetWordFilter``), and this script produces the artifact
that gate reads.

Source
------
Maximilian Koeper and Sabine Schulte im Walde, "Automatically Generated Affective
Norms of Abstractness, Arousal, Imageability and Valence for 350,000 German
Lemmas", LREC 2016. Column ``AbstConc``, higher means more concrete.

    https://www.ims.uni-stuttgart.de/en/research/resources/experiment-data/affective-norms/
    https://www.ims.uni-stuttgart.de/documents/ressourcen/experiment-daten/affective_norms.txt.gz

Only the derived per-word decision is committed, never the 6 MB source file.
That keeps the repository free of a redistribution question and keeps the data
directory small, at the price of needing this script again to change the
threshold. The threshold is written into the artifact's header so a later reader
can tell which run produced it.

Usage
-----
    python scripts/build-concreteness-list.py \
        --norms .model-cache/affective_norms.txt \
        --vocabulary .regen-work/prod/vocabulary.json

Pass ``--download`` to fetch the norms into the cache first.
"""

from __future__ import annotations

import argparse
import gzip
import json
import os
import sys
import urllib.request
from datetime import date

NORMS_URL = ("https://www.ims.uni-stuttgart.de/documents/ressourcen/"
             "experiment-daten/affective_norms.txt.gz")

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_OUT = os.path.join(HERE, "..", "backend", "data", "concrete_nouns.txt")

# Words rated at or above this are concrete enough to be a fair solution. 6.0 is
# where the measured cost drops to 61 guesses per solve, against 83 in the band
# below it and 118 at the abstract end. Raising it to 6.5 buys 6 guesses and
# costs 2,300 candidates, which is why 6.0 was the decision.
DEFAULT_THRESHOLD = 6.0


def log(msg: str) -> None:
    print(msg, flush=True)


def download(dest: str) -> str:
    """Fetch and unpack the norms, returning the path to the plain text file."""
    os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
    gz = dest + ".gz"
    log(f"Downloading {NORMS_URL}")
    with urllib.request.urlopen(NORMS_URL, timeout=180) as r, open(gz, "wb") as f:
        f.write(r.read())
    with gzip.open(gz, "rb") as src, open(dest, "wb") as out:
        out.write(src.read())
    log(f"  wrote {dest} ({os.path.getsize(dest)} bytes)")
    return dest


def fold(word: str) -> str:
    """Fold the sharp-s orthography, the way the rest of the pipeline does.

    The norms are lemmatised from a corpus written with ``ss``, so a vocabulary
    word spelled with the ligature finds no entry under its own spelling. Left
    unfolded this loses 1,260 otherwise valid nouns, among them some of the most
    ordinary words the game has: street, football, foot, fun, grandmother.
    """
    return word.replace("ß", "ss")


def read_norms(path: str) -> dict[str, float]:
    """``folded word -> AbstConc``, lowercased. Duplicates keep the first rating."""
    ratings: dict[str, float] = {}
    with open(path, encoding="utf-8") as f:
        header = f.readline().rstrip("\n").split("\t")
        if header[:2] != ["Word", "AbstConc"]:
            raise SystemExit(f"ABORT: unexpected norms header {header[:2]!r}")
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 2:
                continue
            word = fold(parts[0].lower())
            if word in ratings:
                continue
            try:
                ratings[word] = float(parts[1])
            except ValueError:
                continue
    return ratings


# Rating an unrated compound by its head (a Haartrockner is a Trockner) was
# tried and dropped on 2026-09-21. It recovered 453 words, of which 50 survived
# the remaining gates, and those 50 carried place names (``weilburg``,
# ``westerwald``) and noise (``liveticker``, ``schreiberling``) alongside the
# handful of good ones. Against a candidate pool of about 4,000 that trade is
# not worth the loss of precision. Genuine simplex holes, such as the missing
# entry for the German word for tree, are covered by the hand-verified
# CONCRETE_RESCUE list in backend/target_selection.py instead.


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--norms", default=".model-cache/affective_norms.txt",
                    help="plain-text norms file (tab separated)")
    ap.add_argument("--download", action="store_true",
                    help="fetch the norms into --norms first")
    ap.add_argument("--vocabulary", default=".regen-work/prod/vocabulary.json",
                    help="vocabulary.json, so the artifact stays to words the game knows")
    ap.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD)
    ap.add_argument("--out", default=DEFAULT_OUT)
    args = ap.parse_args()

    if args.download:
        download(args.norms)
    if not os.path.exists(args.norms):
        raise SystemExit(f"ABORT: {args.norms} not found, pass --download once")

    ratings = read_norms(args.norms)
    log(f"norms: {len(ratings)} lemmas")

    vocab = json.load(open(args.vocabulary, encoding="utf-8"))
    vocab_words = vocab if isinstance(vocab, list) else list(vocab.keys())
    log(f"vocabulary: {len(vocab_words)} words")

    rated = [w for w in vocab_words if fold(w) in ratings]
    keep = sorted(w for w in rated if ratings[fold(w)] >= args.threshold)
    log(f"  rated: {len(rated)} ({100 * len(rated) / len(vocab_words):.1f}% of the vocabulary)")
    log(f"  at or above {args.threshold}: {len(keep)}")

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8", newline="\n") as f:
        f.write("# Vocabulary words rated concrete by the German affective norms.\n")
        f.write("# Koeper and Schulte im Walde, LREC 2016, column AbstConc, higher = more concrete.\n")
        f.write("# https://www.ims.uni-stuttgart.de/en/research/resources/experiment-data/affective-norms/\n")
        f.write(f"# threshold: AbstConc >= {args.threshold}\n")
        f.write(f"# vocabulary: {len(vocab_words)} words, {len(rated)} of them rated\n")
        f.write(f"# generated: {date.today().isoformat()} by scripts/build-concreteness-list.py\n")
        for w in keep:
            f.write(w + "\n")
    log(f"wrote {args.out} ({os.path.getsize(args.out)} bytes)")

    sample = keep[:: max(1, len(keep) // 20)][:20]
    log("sample: " + ", ".join(sample))
    return 0


if __name__ == "__main__":
    sys.exit(main())
