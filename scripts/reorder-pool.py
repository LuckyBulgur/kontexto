#!/usr/bin/env python3
"""Reorder the unplayed pool so the daily series reads like the reference game.

Background
----------
The rebuilt pool is right about *which* words are solutions, and wrong about
*when*. Drawn in one undifferentiated block, the daily series inherits the whole
pool's profile: median word length 9 and 38% compounds, against 6 and a handful
in contexto.me's published archive. Those two are what a player switching over
notices first, and neither needs a single word removed to fix. It only needs the
short, everyday words to come first.

So the pool is sorted by how close a word sits to that profile, the first 2,500
become the daily band, and the order inside each band is shuffled so difficulty
still varies from day to day.

Measured effect on the daily band: word length 9 to 7, compounds 38% to 13%,
Zipf median 3.06 to 3.35. Seven years of daily puzzles before it reaches the
rest.

What must not happen
--------------------
1. **No played game may move.** Games 1 to today's number keep their word and
   their npz.
2. **No word may appear twice or disappear.** The reordered list is the same
   multiset, asserted, not assumed.
3. **Word and rank array must stay together.** ``games/{NNNN}.npz`` is bound to
   its solution, so moving a word to a new number moves its npz with it. The
   script verifies that by loading every moved array and checking that rank 1 is
   the word now standing at that number. Nothing is recomputed.

The difficulty tiers
--------------------
``difficulty.json`` is written next to the artifacts but is **not** part of the
upload. Nothing in the game reads it yet, and a file that is not on the server
cannot leak through an endpoint. It exists so a later "hard" mode, or a
recalibration against real play data, does not have to redo this analysis.

Usage
-----
    python scripts/reorder-pool.py \\
        --pool-dir .regen-work/concrete-final \\
        --prod-dir .regen-work/prod \\
        --out-dir  .regen-work/reordered
"""

from __future__ import annotations

import argparse
import json
import os
import random
import shutil
import statistics
import sys
from datetime import date

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "backend"))

from wordfreq import zipf_frequency  # noqa: E402

# How many games the daily series gets before it reaches the rest. 2,500 is
# just under seven years, which is long enough that the far end is a theoretical
# concern, and short enough that the band stays genuinely short and common.
DAILY_BAND = 2500
# Weight between length and frequency in the ordering key. A third of a
# character is worth one Zipf point: at that ratio the band comes out at length
# 7 and 13% compounds, which is the closest the vocabulary gets to the reference
# profile without dropping words.
LENGTH_WEIGHT = 1 / 3.0


def log(msg: str) -> None:
    print(msg, flush=True)


def load_json(path: str):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def profile_key(word: str) -> float:
    """Lower is closer to the reference game's profile: short and common."""
    return len(word) * LENGTH_WEIGHT - zipf_frequency(word, "de")


def is_compound(word: str, vocab: set[str]) -> bool:
    if len(word) < 9:
        return False
    for cut in range(4, len(word) - 3):
        head, tail = word[:cut], word[cut:]
        if head in vocab and tail in vocab:
            return True
        for link in ("s", "n", "es", "en", "er"):
            if head.endswith(link) and head[: -len(link)] in vocab and tail in vocab:
                return True
    return False


def describe(label: str, words: list[str], vocab: set[str]) -> None:
    lengths = [len(w) for w in words]
    zipfs = [zipf_frequency(w, "de") for w in words]
    compounds = sum(1 for w in words if is_compound(w, vocab))
    log(f"  {label:22s} {len(words):5d} games, {len(words)/365:4.1f} years, "
        f"length {statistics.median(lengths):.0f}, compounds "
        f"{100*compounds/len(words):.0f}%, zipf {statistics.median(zipfs):.2f}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pool-dir", required=True, help="the deployed pool's artifacts")
    ap.add_argument("--prod-dir", required=True, help="local copy of the deployed data (read-only)")
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--daily-band", type=int, default=DAILY_BAND)
    ap.add_argument("--seed", type=int, default=20260921)
    ap.add_argument("--today", default=None)
    ap.add_argument("--verify-sample", type=int, default=0,
                    help="verify only N moved arrays instead of all of them")
    args = ap.parse_args()

    today = date.fromisoformat(args.today) if args.today else date.today()

    meta = load_json(os.path.join(args.pool_dir, "metadata.json"))
    targets = load_json(os.path.join(args.pool_dir, "target_words.json"))
    total = int(meta["total_games"])
    start_date = date.fromisoformat(meta["start_date"])
    if len(targets) != total:
        raise SystemExit("ABORT: target_words length != total_games")

    days = (today - start_date).days + 1
    cutoff = ((days - 1) % total) + 1
    log(f"Pool: {total} games, today is game {cutoff}")
    if days > total:
        raise SystemExit("ABORT: the daily series has wrapped; reordering would move played words")

    vocab_raw = load_json(os.path.join(args.prod_dir, "vocabulary.json"))
    vocab = set(vocab_raw if isinstance(vocab_raw, list) else vocab_raw.keys())
    vocab_list = sorted(vocab)

    kept = targets[:cutoff]
    movable = targets[cutoff:]
    log(f"Keeping games 1..{cutoff}, reordering {len(movable)}")

    ranked = sorted(movable, key=profile_key)
    band, rest = ranked[: args.daily_band], ranked[args.daily_band:]
    describe("daily band", band, vocab)
    describe("beyond it", rest, vocab)
    describe("before, whole pool", movable, vocab)

    # Shuffled inside each band: the band decides which words the daily series
    # reaches in the next seven years, not which one comes on which day. A
    # strictly sorted series would start at its easiest and creep, and every
    # player would feel the ramp.
    rng = random.Random(args.seed)
    rng.shuffle(band)
    rng.shuffle(rest)
    new_targets = kept + band + rest

    # ---- gates -------------------------------------------------------------
    log("Verification gate ...")
    if new_targets[:cutoff] != targets[:cutoff]:
        raise SystemExit("ABORT: played games changed")
    if sorted(new_targets) != sorted(targets):
        raise SystemExit("ABORT: the reordered pool is not the same set of words")
    if len(set(new_targets)) != len(new_targets):
        raise SystemExit("ABORT: duplicate solutions")
    if ((days - 1) % len(new_targets)) + 1 != cutoff:
        raise SystemExit("ABORT: today's game number moves")

    where = {word: i + 1 for i, word in enumerate(targets)}
    moves = [(where[word], i + 1) for i, word in enumerate(new_targets) if i + 1 > cutoff]
    log(f"  {sum(1 for a, b in moves if a != b)} of {len(moves)} games change number")

    # ---- copy the arrays with their words ----------------------------------
    out_games = os.path.join(args.out_dir, "games")
    os.makedirs(out_games, exist_ok=True)
    src_games = os.path.join(args.pool_dir, "games")
    log(f"Copying {len(moves)} rank arrays to their new numbers ...")
    for i, (old, new) in enumerate(moves):
        shutil.copyfile(os.path.join(src_games, f"{old:04d}.npz"),
                        os.path.join(out_games, f"{new:04d}.npz"))
        if (i + 1) % 500 == 0:
            log(f"  {i + 1}/{len(moves)}")

    check = moves if not args.verify_sample else rng.sample(moves, min(args.verify_sample, len(moves)))
    log(f"Checking that rank 1 is the right word in {len(check)} arrays ...")
    for i, (_old, new) in enumerate(check):
        with np.load(os.path.join(out_games, f"{new:04d}.npz")) as archive:
            ranks = archive["ranks"]
        if vocab_list[int(np.argmin(ranks))] != new_targets[new - 1]:
            raise SystemExit(f"ABORT: game {new} holds the wrong rank array")
        if (i + 1) % 500 == 0:
            log(f"  {i + 1}/{len(check)}")
    log("  every checked array matches its solution")

    # ---- artifacts ---------------------------------------------------------
    with open(os.path.join(args.out_dir, "target_words.json"), "w", encoding="utf-8") as f:
        json.dump(new_targets, f, ensure_ascii=False)
    shutil.copyfile(os.path.join(args.pool_dir, "metadata.json"),
                    os.path.join(args.out_dir, "metadata.json"))
    with open(os.path.join(args.out_dir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump({
            "today": today.isoformat(), "cutoff": cutoff,
            "previous_total_games": total, "new_total_games": len(new_targets),
            "daily_band": args.daily_band, "seed": args.seed,
            "moved": sum(1 for a, b in moves if a != b),
            "obsolete_npz": [],
        }, f, ensure_ascii=False, indent=2)
    log(f"Artifacts written to {args.out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
