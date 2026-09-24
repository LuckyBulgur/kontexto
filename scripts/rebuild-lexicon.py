#!/usr/bin/env python3
"""Rebuild the counted lexicon of a deployed data directory, and nothing else.

What changes
------------
``core_words.json`` (which words hold a number) and ``fold_map.json`` (what
every other guessable form is scored as), rebuilt by
``backend/core_lexicon.build_lexicon`` from the deployed vocabulary.
``metadata.json`` carries the new ``core_size``.

What must not change
--------------------
1. **The rank arrays.** ``games/{NNNN}.npz`` ranks the whole vocabulary and the
   displayed rank is computed from them at runtime, so a new lexicon renumbers
   every game without touching a single array. None is written here.
2. **The everyday list.** The vectors were debiased on it, and a list that
   moved would mean the arrays no longer match the space they came from. It is
   passed in frozen and the script aborts if the build returns anything else.
3. **The solutions.** Every one of them holds its own number and none is folded
   away, or the game would report a round solved on the wrong word.
4. **What a player could type yesterday.** A word that counted and would now be
   neither counted nor folded is refused from tomorrow on. The script lists
   every such word and aborts when one of them was typed on production at
   least ``core_lexicon.MIN_GUESSES`` times.

The manifest records a SHA-256 of every deployed file the build started from,
and ``scripts/upload-core-pool.sh --lexicon-only`` refuses to ship when
production no longer matches them.

Usage
-----
    python scripts/rebuild-lexicon.py \\
        --prod-dir .regen-work/prod \\
        --out-dir .regen-work/lexicon \\
        --guess-counts .regen-work/guess-counts.json

``--full`` also copies the rest of the deployed directory (games, vocabulary,
indexes) into the output, which makes it a complete data directory for
``KONTEXTO_DATA_DIR`` and ``backend/test_rank_uniqueness.py``. The upload ships
the lexicon files either way.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "backend"))

import core_lexicon  # noqa: E402

#: Deployed files the lexicon is built from and checked against on upload.
BASE_FILES = ("vocabulary.json", "target_words.json", "metadata.json",
              core_lexicon.CORE_FILE, core_lexicon.FOLD_FILE, core_lexicon.EVERYDAY_FILE)
#: What the upload ships.
SHIPPED_FILES = (core_lexicon.CORE_FILE, core_lexicon.FOLD_FILE, "metadata.json")


def log(msg: str) -> None:
    print(msg, flush=True)


def load(path: str):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def sha256(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--prod-dir", required=True, help="local copy of the deployed data")
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--guess-counts", default=None,
                    help="JSON object word -> how often it was guessed on production")
    ap.add_argument("--full", action="store_true",
                    help="also copy the rest of the deployed directory into the output")
    args = ap.parse_args()

    for name in BASE_FILES:
        if not os.path.exists(os.path.join(args.prod_dir, name)):
            raise SystemExit(f"ABORT: {args.prod_dir}/{name} is missing")
    if os.path.abspath(args.prod_dir) == os.path.abspath(args.out_dir):
        raise SystemExit("ABORT: the output must not be the deployed copy it is built from")

    vocabulary = load(os.path.join(args.prod_dir, "vocabulary.json"))
    targets = load(os.path.join(args.prod_dir, "target_words.json"))
    meta = load(os.path.join(args.prod_dir, "metadata.json"))
    deployed_scale = set(core_lexicon.load_core_words(args.prod_dir) or ())
    deployed_fold = core_lexicon.load_fold_map(args.prod_dir)
    deployed_everyday = core_lexicon.load_everyday_words(args.prod_dir)
    if not deployed_everyday:
        raise SystemExit("ABORT: the deployed directory carries no everyday list")
    lemma_path = os.path.join(args.prod_dir, "lemma_map.json")
    lemma_map = load(lemma_path) if os.path.exists(lemma_path) else {}

    guess_counts: dict[str, int] = {}
    if args.guess_counts:
        guess_counts = load(args.guess_counts)
        log(f"{len(guess_counts)} words carry a guess count from production")

    log(f"Deployed: {len(deployed_scale)} counted words, {len(deployed_fold)} folds, "
        f"{len(deployed_everyday)} everyday words, {len(targets)} solutions")
    log("Reading word classes (spaCy), lemmas (simplemma) and nouns (Wiktionary) ...")
    lexicon = core_lexicon.build_lexicon(
        vocabulary, lemma_map, everyday=deployed_everyday, keep=set(targets),
        guess_counts=guess_counts)
    scale = set(lexicon.scale)

    if lexicon.everyday != sorted(set(deployed_everyday) | (set(targets) & set(vocabulary))):
        raise SystemExit("ABORT: the everyday list moved; the rank arrays would no longer "
                         "match the space they were computed in")
    unplaced = [w for w in targets if w not in scale or w in lexicon.fold]
    if unplaced:
        raise SystemExit(f"ABORT: {len(unplaced)} solutions hold no number of their own: "
                         f"{unplaced[:10]}")

    dropped = sorted(w for w in deployed_scale if w not in scale and w not in lexicon.fold)
    if dropped:
        typed = {w: guess_counts.get(w, 0) for w in dropped}
        log(f"{len(dropped)} counted words would be refused from now on: "
            + ", ".join(f"{w} ({n})" for w, n in typed.items()))
        known = [w for w, n in typed.items() if n >= core_lexicon.MIN_GUESSES]
        if known:
            raise SystemExit(f"ABORT: players type {len(known)} of them: {known[:10]}")

    newly_folded = sorted(w for w in deployed_scale if w in lexicon.fold)
    unfolded = sorted(w for w in deployed_fold if w in scale)
    retargeted = sorted(w for w, t in deployed_fold.items()
                        if w in lexicon.fold and lexicon.fold[w] != t)
    log(f"Counted lexicon: {len(deployed_scale)} -> {len(scale)} words, "
        f"folds {len(deployed_fold)} -> {len(lexicon.fold)}")
    log(f"  {len(newly_folded)} counted words now fold onto their lemma")
    log(f"  {len(unfolded)} folded forms now count as words of their own")
    log(f"  {len(retargeted)} folds land on a different word")

    os.makedirs(args.out_dir, exist_ok=True)
    if args.full:
        for name in os.listdir(args.prod_dir):
            src = os.path.join(args.prod_dir, name)
            dst = os.path.join(args.out_dir, name)
            if name in SHIPPED_FILES or name.startswith("duels.db"):
                continue
            if os.path.isdir(src):
                shutil.copytree(src, dst, dirs_exist_ok=True)
            else:
                shutil.copyfile(src, dst)
    core_lexicon.write_core_words(args.out_dir, lexicon.scale)
    core_lexicon.write_fold_map(args.out_dir, lexicon.fold)
    if args.full:
        core_lexicon.write_everyday_words(args.out_dir, lexicon.everyday)
    new_meta = dict(meta)
    new_meta["core_size"] = len(scale)
    with open(os.path.join(args.out_dir, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(new_meta, f, ensure_ascii=False, indent=2)

    def counted(words: list[str]) -> list[list]:
        return [[w, guess_counts.get(w, 0), lexicon.fold.get(w)] for w in words]

    with open(os.path.join(args.out_dir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump({
            "mode": "lexicon",
            "base": {name: sha256(os.path.join(args.prod_dir, name)) for name in BASE_FILES},
            "core_size": len(scale),
            "previous_core_size": len(deployed_scale),
            "fold_size": len(lexicon.fold),
            "dropped": dropped,
            "newly_folded": counted(newly_folded),
            "unfolded": [[w, guess_counts.get(w, 0)] for w in unfolded],
            "retargeted": [[w, deployed_fold[w], lexicon.fold[w]] for w in retargeted],
        }, f, ensure_ascii=False, indent=1)
    log(f"Artifacts written to {args.out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
