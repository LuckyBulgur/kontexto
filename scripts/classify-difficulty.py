#!/usr/bin/env python3
"""Estimate how hard each solution plays, and write the tiers to docs/.

Why this exists
---------------
Difficulty was asserted for a long time and never measured. It is measurable:
``analytics_game_stats`` records guesses and solves per game, and joined against
the solutions it says, clearly, that concreteness dominates. A solution the
German affective norms rate below 4.0 costs 118 guesses per solve, one at 7.0 or
above costs 48; whole frequency bands of the same pool differ by barely a third.

This script turns those measurements into a per-game estimate, so a later "hard"
mode, or a recalibration once the rebuilt pool has real play data behind it, does
not have to redo the analysis.

Where it is written, and why not on the server
----------------------------------------------
``docs/data/difficulty.json``. The Dockerfile copies ``backend/`` and
``scripts/`` into the image and not ``docs/``, so this file never reaches
production. That is deliberate: the tier is an internal planning number, and a
player who could read it would know before the first guess whether today is an
easy day. A file that is not there cannot leak through an endpoint, which is a
better guarantee than every endpoint remembering not to return it.

How good the estimate is
------------------------
The concreteness and frequency terms are calibrated against production. The
neighbourhood term is structural and is not. Checked against 80 played rounds,
the hard tier separates clearly (median 95 guesses against about 55); the split
between easy and middle does not, on 16 rounds, which is too few to tell. Treat
the top tier as evidence and the rest as an ordering.

Usage
-----
    python scripts/classify-difficulty.py \\
        --pool-dir .regen-work/reordered \\
        --neighbourhoods .regen-work/concrete-final/neighbourhoods.jsonl
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "backend"))

from wordfreq import zipf_frequency  # noqa: E402

from target_selection import CONCRETE_RESCUE  # noqa: E402

DEFAULT_OUT = os.path.join(HERE, "..", "docs", "data", "difficulty.json")
DEFAULT_NORMS = ".model-cache/affective_norms.txt"

#: Guesses per solve by concreteness band, measured on production 2026-09-21.
CONCRETENESS_COST = ((7.0, 48.0), (6.0, 61.0), (5.0, 83.0), (0.0, 118.0))
#: A word the norms do not list at all, and that is not hand-verified.
UNRATED_COST = 100.0
#: Frequency multiplier. Production: the rarer band costs about a third more.
FREQUENCY_COST = ((4.0, 1.00), (3.5, 1.10), (3.0, 1.20), (0.0, 1.34))


def log(msg: str) -> None:
    print(msg, flush=True)


def fold(word: str) -> str:
    return word.replace("ß", "ss")


def read_norms(path: str) -> dict[str, float]:
    ratings: dict[str, float] = {}
    with open(path, encoding="utf-8") as f:
        next(f)
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 2:
                continue
            key = fold(parts[0].lower())
            if key not in ratings:
                try:
                    ratings[key] = float(parts[1])
                except ValueError:
                    pass
    return ratings


def banded(value: float, table: tuple[tuple[float, float], ...]) -> float:
    for floor, cost in table:
        if value >= floor:
            return cost
    return table[-1][1]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pool-dir", required=True)
    ap.add_argument("--neighbourhoods", default=None,
                    help="neighbourhoods.jsonl, for the ladder term")
    ap.add_argument("--norms", default=DEFAULT_NORMS)
    ap.add_argument("--out", default=DEFAULT_OUT)
    ap.add_argument("--easy", type=int, default=2500, help="size of the easy tier")
    ap.add_argument("--middle", type=int, default=1000)
    args = ap.parse_args()

    targets = json.load(open(os.path.join(args.pool_dir, "target_words.json"), encoding="utf-8"))
    ratings = read_norms(args.norms)

    ladder: dict[str, int] = {}
    if args.neighbourhoods and os.path.exists(args.neighbourhoods):
        names_file = os.path.join(HERE, "..", "backend", "german_names.txt")
        names = {l.strip() for l in open(names_file, encoding="utf-8") if l.strip()}
        with open(args.neighbourhoods, encoding="utf-8") as f:
            for line in f:
                entry = json.loads(line)
                ladder[entry["word"]] = sum(
                    1 for n in entry["top"]
                    if n not in names and zipf_frequency(n, "de") >= 3.5)
        log(f"ladder data for {len(ladder)} solutions")

    rows = []
    for number, word in enumerate(targets, start=1):
        rating = ratings.get(fold(word))
        if rating is None:
            base = 48.0 if word in CONCRETE_RESCUE else UNRATED_COST
        else:
            base = banded(rating, CONCRETENESS_COST)
        reach = ladder.get(word)
        # Gentle, because this term is the uncalibrated one.
        slope = 1.0 if reach is None else min(1.25, max(0.9, 1.25 - reach / 60.0))
        rows.append({
            "game": number, "word": word,
            "score": round(base * banded(zipf_frequency(word, "de"), FREQUENCY_COST) * slope, 1),
        })

    order = sorted(rows, key=lambda r: r["score"])
    for rank, row in enumerate(order):
        row["tier"] = "easy" if rank < args.easy else "middle" if rank < args.easy + args.middle else "hard"

    for tier in ("easy", "middle", "hard"):
        part = [r for r in rows if r["tier"] == tier]
        log(f"  {tier:7s} {len(part):5d} games, estimated "
            f"{statistics.median(r['score'] for r in part):.0f} guesses per solve")

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump({
            "generated": "scripts/classify-difficulty.py",
            "note": "internal planning data, deliberately not shipped to production",
            "games": rows,
        }, f, ensure_ascii=False, indent=1)
    log(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
