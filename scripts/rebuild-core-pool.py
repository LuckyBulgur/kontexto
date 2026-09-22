#!/usr/bin/env python3
"""Rebuild the deployed data around the core lexicon and the curated pool.

What changes
------------
1. **The space.** The vectors are debiased on the core lexicon
   (``backend/core_lexicon.py``) instead of on all 80.000 word forms, and the
   transform is then applied to the whole vocabulary. Every rank array is
   recomputed, the played ones included, because the space itself moved.
2. **The scale.** ``core_words.json`` ships next to the games. The runtime
   counts only core words when it shows a rank, so the number the player reads
   shrinks by roughly a factor of six and the hint and close-word lists stop
   handing out rare compounds. Nothing is refused: a word outside the core
   still scores, at the position of the nearest core word.
3. **The answers.** ``backend/data/solution_pool.txt`` replaces the old pool.
   Every word in it is a concrete common noun above Zipf 3,2, measured solvable
   and read by hand.

What must not happen
--------------------
1. **The vocabulary must not move.** ``games/{NNNN}.npz`` binds ``ranks[i]``
   positionally to ``vocabulary.json``. The script reproduces the deployed
   vocabulary from the model and aborts on any difference, then copies the
   deployed file rather than writing its own.
2. **A played game must keep its word.** Games 1 to today's number keep the
   solution they had, at the same number. Their ranks are recomputed, which is
   unavoidable when the space changes, and is the one visible break: the
   archive of a past game ranks slightly differently than it did on the day.
3. **Today must not move.** ``get_game_number`` is
   ``((days - 1) % total_games) + 1`` and this script changes ``total_games``.
   Before the first wrap the modulo is a no-op, but the script verifies it.

Usage
-----
    python scripts/rebuild-core-pool.py \\
        --prod-dir .regen-work/prod \\
        --vec .model-cache/cc.de.300.vec \\
        --out-dir .regen-work/core \\
        --verify-sample 200
"""

from __future__ import annotations

import argparse
import json
import os
import random
import shutil
import sys
from datetime import date

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "backend"))

import core_lexicon  # noqa: E402
from prepare import postprocess_vectors, stream_vocab_vectors  # noqa: E402

POOL_FILE = os.path.join(HERE, "..", "backend", "data", "solution_pool.txt")
#: Files the runtime needs that this rebuild does not change.
CARRIED_OVER = ("vocabulary.json", "lemma_map.json", "bloom.bin", "spell_index.npz")


def log(msg: str) -> None:
    print(msg, flush=True)


def read_pool(path: str) -> list[str]:
    words: list[str] = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                words.append(line)
    if len(words) != len(set(words)):
        raise SystemExit("ABORT: the solution pool holds duplicates")
    return words


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--prod-dir", required=True, help="local copy of the deployed data")
    ap.add_argument("--vec", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--pool", default=POOL_FILE)
    ap.add_argument("--today", default=None)
    ap.add_argument("--seed", type=int, default=20260921)
    ap.add_argument("--verify-sample", type=int, default=0,
                    help="verify N recomputed arrays instead of all of them")
    args = ap.parse_args()

    today = date.fromisoformat(args.today) if args.today else date.today()

    meta = json.load(open(os.path.join(args.prod_dir, "metadata.json"), encoding="utf-8"))
    old_targets = json.load(open(os.path.join(args.prod_dir, "target_words.json"), encoding="utf-8"))
    vocab_index = json.load(open(os.path.join(args.prod_dir, "vocabulary.json"), encoding="utf-8"))
    lemma_map = json.load(open(os.path.join(args.prod_dir, "lemma_map.json"), encoding="utf-8"))
    start_date = date.fromisoformat(meta["start_date"])
    total_old = int(meta["total_games"])
    if len(old_targets) != total_old:
        raise SystemExit("ABORT: target_words length != total_games")

    days = (today - start_date).days + 1
    if days > total_old:
        raise SystemExit("ABORT: the daily series has wrapped; played words would move")
    cutoff = days
    log(f"Deployed pool: {total_old} games, today is game {cutoff}")

    pool = read_pool(args.pool)
    log(f"Curated pool: {len(pool)} solutions")

    log("Reproducing the deployed vocabulary from the model ...")
    raw, _ = stream_vocab_vectors(args.vec, len(vocab_index))
    vocab_list = sorted(raw)
    if vocab_list != sorted(vocab_index):
        raise SystemExit("ABORT: the reproduced vocabulary differs from the deployed one")
    log(f"  {len(vocab_list)} words, identical to the deployed file")

    played = old_targets[:cutoff]
    rest = [w for w in pool if w not in set(played)]
    missing = [w for w in pool if w not in raw]
    if missing:
        raise SystemExit(f"ABORT: {len(missing)} pool words are not in the vocabulary: {missing[:10]}")
    random.Random(args.seed).shuffle(rest)
    targets = played + rest
    if len(targets) != len(set(targets)):
        raise SystemExit("ABORT: duplicate solutions after merging")
    log(f"  keeping games 1..{cutoff}, then {len(rest)} curated solutions")

    # The played words stay solutions even when the curation would not pick them
    # again: their game number is public and a changed answer would rewrite
    # history. They are a shrinking remainder, 106 of them at the time of
    # writing, and they drop out of the series as it moves on.
    carried = [w for w in played if w not in set(pool)]
    log(f"  {len(carried)} played words are not in the curated pool and stay only where they are")

    core = core_lexicon.build_core_lexicon(vocab_index, lemma_map, keep=set(targets))
    missing_from_core = [w for w in targets if w not in set(core)]
    if missing_from_core:
        # A solution outside the core would be counted by nothing, and the
        # nearest core word would take displayed rank 1. game.py guards against
        # it, but the data should never ask it to.
        raise SystemExit(f"ABORT: {len(missing_from_core)} solutions are not in the core: "
                         f"{missing_from_core[:10]}")
    log(f"Core lexicon: {len(core)} words ({100 * len(core) / len(vocab_list):.0f}% of the vocabulary)")

    log("Debiasing on the core and applying it to the whole vocabulary ...")
    vectors = postprocess_vectors(raw, fit_words=set(core))
    del raw

    os.makedirs(os.path.join(args.out_dir, "games"), exist_ok=True)
    for name in CARRIED_OVER:
        src = os.path.join(args.prod_dir, name)
        if os.path.exists(src):
            shutil.copyfile(src, os.path.join(args.out_dir, name))
    core_lexicon.write_core_words(args.out_dir, core)
    with open(os.path.join(args.out_dir, "target_words.json"), "w", encoding="utf-8") as f:
        json.dump(targets, f, ensure_ascii=False)
    new_meta = dict(meta)
    new_meta["total_games"] = len(targets)
    new_meta["core_size"] = len(core)
    # Games 1..cutoff keep the words the old pool gave them, so they are the
    # only ones in the file that never passed the current rules: verbs,
    # adjectives and whatever else was allowed then. The daily series has
    # already walked past them, but the random modes draw over the whole range
    # and would keep serving them. This is where they stop.
    new_meta["first_curated_game"] = cutoff + 1
    with open(os.path.join(args.out_dir, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(new_meta, f, ensure_ascii=False, indent=2)

    if ((days - 1) % len(targets)) + 1 != cutoff:
        raise SystemExit("ABORT: today's game number moves under the new total")

    log(f"Computing {len(targets)} rank arrays ...")
    # prepare.compute_rankings rebuilds the 80.000 x 300 matrix per call, which
    # is a minute of pure copying per hundred games. The matrix is the same for
    # every target, so it is built once here; the arithmetic is identical.
    matrix = np.array([vectors[w] for w in vocab_list], dtype=np.float32)
    matrix /= np.maximum(np.linalg.norm(matrix, axis=1, keepdims=True), 1e-10)
    position = {w: i for i, w in enumerate(vocab_list)}
    for number, word in enumerate(targets, start=1):
        similarity = matrix @ matrix[position[word]]
        order = np.argsort(-similarity)
        ranks = np.empty(len(vocab_list), dtype=np.uint32)
        ranks[order] = np.arange(1, len(vocab_list) + 1, dtype=np.uint32)
        np.savez_compressed(os.path.join(args.out_dir, "games", f"{number:04d}.npz"), ranks=ranks)
        if number % 100 == 0 or number == len(targets):
            log(f"  {number}/{len(targets)}")

    log("Verification gate ...")
    check = list(range(1, len(targets) + 1))
    if args.verify_sample:
        check = sorted(random.Random(args.seed).sample(check, min(args.verify_sample, len(check))))
    for number in check:
        with np.load(os.path.join(args.out_dir, "games", f"{number:04d}.npz")) as data:
            ranks = data["ranks"]
        if int(ranks[position[targets[number - 1]]]) != 1:
            raise SystemExit(f"ABORT: game {number} does not rank its own solution first")
    log(f"  {len(check)} arrays rank their solution first")

    stale = [f for f in os.listdir(os.path.join(args.out_dir, "games"))
             if f.endswith(".npz") and int(f[:-4]) > len(targets)]
    with open(os.path.join(args.out_dir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump({
            "today": today.isoformat(), "cutoff": cutoff,
            "previous_total_games": total_old, "new_total_games": len(targets),
            "core_size": len(core), "seed": args.seed,
            "carried_played_words": carried,
            "obsolete_npz": sorted(f"{n:04d}.npz" for n in range(len(targets) + 1, total_old + 1)),
            "stale_in_out_dir": sorted(stale),
        }, f, ensure_ascii=False, indent=2)
    log(f"Artifacts written to {args.out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
