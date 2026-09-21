#!/usr/bin/env python3
"""Turn the vendored German profanity list into the two tiers the runtime reads.

The raw LDNOOBW list is a flat list of strings. A flat list matched by substring
is unusable for German: ``ruck`` sits inside ``Druck``, ``mist`` inside
``Mistel``, ``arsch`` inside ``Marschall``. Which of those collisions are real
is not a judgement call, it is a measurement against a corpus, and this script
makes it:

* corpus = the 50.000 most frequent German words (wordfreq) plus the 35.255
  first names in ``backend/german_names.txt``, the two vocabularies a nickname
  is actually drawn from.
* for every entry, list the corpus words that contain it as a substring.

The output is a report, not a decision. A strong insult stays in the substring
tier and its collisions become allowlist entries; a mild or ambiguous word moves
to the exact-token tier or is dropped. Those calls live in the three curated
files under ``backend/data/`` and are documented there.

Run after updating the vendored list:

    python scripts/classify-profanity-list.py            # full report
    python scripts/classify-profanity-list.py --allowlist  # allowlist for the strict tier
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from wordlists import (  # noqa: E402
    load_term_file,
    normalize_for_profanity_check,
)

DATA = ROOT / "backend" / "data"
CORPUS_SIZE = 50_000


def corpus() -> list[str]:
    from wordfreq import top_n_list

    words = set(top_n_list("de", CORPUS_SIZE))
    names = (ROOT / "backend" / "german_names.txt").read_text(encoding="utf-8")
    words.update(line.strip() for line in names.splitlines() if line.strip())
    folded = {normalize_for_profanity_check(w).replace(" ", "") for w in words}
    return sorted(w for w in folded if w)


def collisions(terms: list[str], haystacks: list[str], profane: set[str]) -> dict[str, list[str]]:
    found: dict[str, list[str]] = {}
    for term in terms:
        hits = [w for w in haystacks if term in w and w != term and w not in profane]
        if hits:
            found[term] = hits
    return found


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--allowlist", action="store_true",
                        help="print the allowlist the strict tier needs, one word per line")
    parser.add_argument("--source", default="profanity_de_raw.txt",
                        help="which file under backend/data to classify")
    args = parser.parse_args()

    raw = load_term_file(DATA / args.source)
    words = corpus()
    profane = set(raw)

    if args.allowlist:
        strict = load_term_file(DATA / "profanity_de_strict.txt")
        hits = collisions(strict, words, profane)
        for word in sorted({w for group in hits.values() for w in group}):
            print(word)
        return 0

    hits = collisions(raw, words, profane)
    print(f"{len(raw)} entries, {len(words)} corpus words, {len(hits)} entries collide\n")
    for term, group in sorted(hits.items(), key=lambda item: (len(item[0]), item[0])):
        sample = ", ".join(group[:8])
        more = f" (+{len(group) - 8})" if len(group) > 8 else ""
        print(f"{term:<24} {len(group):>4}  {sample}{more}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
