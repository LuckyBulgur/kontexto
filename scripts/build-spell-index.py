#!/usr/bin/env python3
"""Build the typo-correction index for an existing data directory.

``prepare.py`` writes ``spell_index.npz`` as part of the normal pipeline, but a
data volume generated before the typo correction existed has everything else and
only lacks the index. Building it here at container start keeps the API workers
from each building their own copy on the first mistyped guess.

Usage: build-spell-index.py <data-dir> [--force]
"""

from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))

import spellfix  # noqa: E402  (needs the backend on the path first)


def load_json(path: str):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("data_dir")
    parser.add_argument("--force", action="store_true", help="rebuild even when a valid index exists")
    args = parser.parse_args()

    vocab_path = os.path.join(args.data_dir, "vocabulary.json")
    if not os.path.exists(vocab_path):
        print(f"No vocabulary in {args.data_dir}, nothing to index.")
        return 0

    vocabulary: dict[str, int] = load_json(vocab_path)
    lemma_map: dict[str, str] = load_json(os.path.join(args.data_dir, "lemma_map.json"))
    index_to_word = [""] * len(vocabulary)
    for word, index in vocabulary.items():
        index_to_word[index] = word

    target = os.path.join(args.data_dir, spellfix.INDEX_FILE)
    if not args.force and spellfix.SpellIndex.load(target, vocabulary, lemma_map, index_to_word) is not None:
        print(f"Typo index already current: {target}")
        return 0

    index = spellfix.SpellIndex.build(vocabulary, lemma_map, index_to_word)
    index.save(target)
    print(f"Wrote {target} ({len(index.surfaces)} surface forms).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
