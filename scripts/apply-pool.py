#!/usr/bin/env python3
"""Rebuild the game series from the curated pool without recomputing a rank.

When to use this instead of rebuild-core-pool.py
------------------------------------------------
A rank array depends on the solution and the vector space, never on the game
number. When the space is unchanged and every word the pool asks for is already
a solution somewhere in the deployed series, a new pool is only a new order of
arrays that exist: striking words from ``solution_pool.txt`` is exactly that
case. This script builds that order in seconds instead of recomputing some
2.400 arrays against the 4,5 GB model, and it refuses whenever the case does
not hold.

The order is the one rebuild-core-pool.py would produce: games 1 to the cutoff
keep their word, the remaining pool words follow, shuffled with the same seed.

What must not happen, and is checked
------------------------------------
1. **A played game must keep its word.** Games 1 to ``--keep-through`` are
   copied unchanged. Pass one more than today's number when the server and the
   players may disagree about the date around midnight.
2. **Today must not move.** ``get_game_number`` is
   ``((days - 1) % total_games) + 1`` and the total changes.
3. **Every array ranks its own solution first**, checked on every output file.

The lexicon files (core_words, fold_map, everyday_words) are copied unchanged,
because a new order of solutions changes nothing about which words count.

Usage (inside the container, next to the live data)
---------------------------------------------------
    python3 scripts/apply-pool.py --data-dir /app/data \\
        --out-dir /app/data/.staging --keep-through 111

The output has the layout scripts/upload-core-pool.sh swaps in.
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
POOL_FILE = os.path.join(HERE, "..", "backend", "data", "solution_pool.txt")
LEXICON_FILES = ("core_words.json", "fold_map.json", "everyday_words.json")
#: The seed rebuild-core-pool.py shuffles with, so both scripts agree.
SEED = 20260921


def read_pool(path: str) -> list[str]:
    with open(path, encoding="utf-8") as f:
        words = [line.strip() for line in f if line.strip() and not line.startswith("#")]
    if len(words) != len(set(words)):
        raise SystemExit("ABORT: the solution pool holds duplicates")
    return words


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data-dir", required=True, help="the deployed data directory")
    ap.add_argument("--out-dir", required=True, help="an empty directory to write into")
    ap.add_argument("--keep-through", type=int, required=True,
                    help="the last game number that keeps its word")
    ap.add_argument("--pool", default=POOL_FILE)
    ap.add_argument("--today", default=None, help="ISO date, default today")
    ap.add_argument("--seed", type=int, default=SEED)
    args = ap.parse_args()

    data = args.data_dir
    with open(os.path.join(data, "metadata.json"), encoding="utf-8") as f:
        meta = json.load(f)
    with open(os.path.join(data, "target_words.json"), encoding="utf-8") as f:
        old_targets: list[str] = json.load(f)
    with open(os.path.join(data, "vocabulary.json"), encoding="utf-8") as f:
        vocabulary: dict[str, int] = json.load(f)
    if len(old_targets) != int(meta["total_games"]):
        raise SystemExit("ABORT: target_words length != total_games")

    today = date.fromisoformat(args.today) if args.today else date.today()
    days = (today - date.fromisoformat(meta["start_date"])).days + 1
    if days > len(old_targets):
        raise SystemExit("ABORT: the daily series has wrapped; played words would move")
    keep = args.keep_through
    if keep < days:
        raise SystemExit(f"ABORT: --keep-through {keep} is before today's game {days}")
    if keep > len(old_targets):
        raise SystemExit("ABORT: --keep-through is past the end of the series")

    pool = read_pool(args.pool)
    played = old_targets[:keep]
    rest = [w for w in pool if w not in set(played)]
    random.Random(args.seed).shuffle(rest)
    targets = played + rest
    if len(targets) != len(set(targets)):
        raise SystemExit("ABORT: duplicate solutions after merging")
    if ((days - 1) % len(targets)) + 1 != days:
        raise SystemExit("ABORT: today's game number moves under the new total")

    source_of = {word: number for number, word in enumerate(old_targets, start=1)}
    missing = [w for w in rest if w not in source_of]
    if missing:
        raise SystemExit(f"ABORT: {len(missing)} pool words have no rank array yet, "
                         f"use rebuild-core-pool.py: {missing[:10]}")

    if os.path.exists(args.out_dir) and os.listdir(args.out_dir):
        raise SystemExit(f"ABORT: {args.out_dir} is not empty")
    games_out = os.path.join(args.out_dir, "games")
    os.makedirs(games_out, exist_ok=True)

    print(f"Today is game {days}; keeping games 1..{keep}, then {len(rest)} pool words", flush=True)
    for number, word in enumerate(targets, start=1):
        src = os.path.join(data, "games", f"{source_of[word]:04d}.npz")
        dst = os.path.join(games_out, f"{number:04d}.npz")
        shutil.copyfile(src, dst)
        with np.load(dst) as arrays:
            if int(arrays["ranks"][vocabulary[word]]) != 1:
                raise SystemExit(f"ABORT: game {number} ({word}) does not rank its solution first")

    for name in LEXICON_FILES:
        src = os.path.join(data, name)
        if os.path.exists(src):
            shutil.copyfile(src, os.path.join(args.out_dir, name))
    with open(os.path.join(args.out_dir, "target_words.json"), "w", encoding="utf-8") as f:
        json.dump(targets, f, ensure_ascii=False)
    new_meta = dict(meta)
    new_meta["total_games"] = len(targets)
    # Games up to the cutoff keep words that may predate the current rules, so
    # the random modes start after them, as rebuild-core-pool.py does.
    new_meta["first_curated_game"] = max(int(meta.get("first_curated_game", 1)), keep + 1)
    with open(os.path.join(args.out_dir, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(new_meta, f, ensure_ascii=False, indent=2)
    with open(os.path.join(args.out_dir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump({
            "mode": "reorder", "today": today.isoformat(), "cutoff": keep,
            "previous_total_games": len(old_targets), "new_total_games": len(targets),
            "seed": args.seed,
            "struck": sorted(set(old_targets[keep:]) - set(rest)),
        }, f, ensure_ascii=False, indent=2)
    print(f"{len(targets)} games written to {args.out_dir}, every one ranks its solution first")
    return 0


if __name__ == "__main__":
    sys.exit(main())
