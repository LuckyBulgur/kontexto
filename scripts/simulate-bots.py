#!/usr/bin/env python3
"""Play the server players' Kontexto model offline and report how it plays.

``backend/room_bots.py`` decides every move from the best rank so far, so the
model can be measured without a server, a database or a vector file: all it
needs is the list of ranks the hint words sit at. With ``--data-dir`` that list
comes from the real rank arrays through ``GameState``; without it a synthetic
scale is drawn at the production density (14.840 hint words on a scale of
50.908, CLAUDE.md, 2026-09-25).

The person it is compared with is a log-normal fitted to the two numbers
measured on production: median 35 guesses, 4% of rounds over 80. A duel is won
by the fewer guesses, so the win rate below is the share of duels a person
drawn from that curve wins against one server player (ties count half).

Usage
-----
    python scripts/simulate-bots.py --rounds 4000
    python scripts/simulate-bots.py --data-dir data --rounds 500
"""

from __future__ import annotations

import argparse
import bisect
import math
import os
import random
import statistics
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "backend"))

from room_bots import draw_skill, plan_kontexto_move  # noqa: E402

SCALE = 50_908
HINT_WORDS = 14_840
HUMAN_MEDIAN = 35.0
HUMAN_OVER_80 = 0.04
BUDGET = 300


def nearest(hints: list[int], target: int, skip: set[int]) -> int | None:
    """The search ``GameState._nearest_hint`` runs, on a plain sorted list."""
    lo = bisect.bisect_right(hints, target) - 1
    hi = lo + 1
    while lo >= 0 or hi < len(hints):
        if lo >= 0 and hints[lo] not in skip:
            return hints[lo]
        if hi < len(hints) and hints[hi] not in skip:
            return hints[hi]
        lo -= 1
        hi += 1
    return None


class SyntheticGame:
    def __init__(self, rng: random.Random) -> None:
        self.hints = sorted(rng.sample(range(2, SCALE + 1), HINT_WORDS))
        self.rng = rng

    def opener(self, used: set[int]) -> int | None:
        # Everyday opening words land anywhere from a few hundred to the far
        # end; log-uniform matches how the real openers spread over a game.
        target = int(math.exp(self.rng.uniform(math.log(300), math.log(SCALE))))
        return nearest(self.hints, target, used)

    def near(self, rank: int, used: set[int]) -> int | None:
        return nearest(self.hints, max(2, rank), used)


class RealGame:
    def __init__(self, gs, number: int, rng: random.Random) -> None:
        from room_bots import OPENERS

        self.gs, self.number, self.rng = gs, number, rng
        self.openers = list(OPENERS)

    def opener(self, used: set[int]) -> int | None:
        for word in self.rng.sample(self.openers, len(self.openers)):
            scored = self.gs.guess(word, self.number, correct_typos=False)
            if scored is not None and scored["rank"] not in used:
                return int(scored["rank"])
        return None

    def near(self, rank: int, used: set[int]) -> int | None:
        entry = self.gs.word_near_rank(self.number, rank, used)
        return int(entry["rank"]) if entry else None


def play(game, rng: random.Random) -> tuple[int, bool]:
    skill = draw_skill(rng)
    openers = rng.randint(1, 3)
    used: set[int] = set()
    best: int | None = None
    guesses = 0
    while guesses < BUDGET:
        move = plan_kontexto_move(rng, skill, best, guesses, openers)
        if move.kind == "opener":
            rank = game.opener(used) or game.near((best or 1000) * 2, used)
        elif move.kind == "solve":
            rank = 1
        else:
            rank = game.near(move.rank, used)
        if rank is None:
            break
        guesses += 1
        used.add(rank)
        best = rank if best is None else min(best, rank)
        if rank == 1:
            return guesses, True
    return guesses, False


def human_sigma() -> float:
    # P(X > 80) = HUMAN_OVER_80 for a log-normal with the measured median.
    z = statistics.NormalDist().inv_cdf(1.0 - HUMAN_OVER_80)
    return math.log(80.0 / HUMAN_MEDIAN) / z


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--rounds", type=int, default=4000)
    ap.add_argument("--seed", type=int, default=20260930)
    ap.add_argument("--data-dir", default=None,
                    help="play the real rank arrays of this data directory")
    args = ap.parse_args()

    rng = random.Random(args.seed)
    gs = None
    numbers: list[int] = []
    if args.data_dir:
        from game import GameState

        gs = GameState(args.data_dir)
        numbers = list(range(gs.first_curated_game(), gs.total_games() + 1))

    results: list[tuple[int, bool]] = []
    synthetic = None
    for i in range(args.rounds):
        if gs is not None:
            game = RealGame(gs, rng.choice(numbers), rng)
        else:
            # A fresh scale every 200 rounds keeps one lucky draw from carrying
            # the whole measurement.
            if synthetic is None or i % 200 == 0:
                synthetic = SyntheticGame(random.Random(rng.random()))
            synthetic.rng = rng
            game = synthetic
        results.append(play(game, rng))

    solved = sorted(g for g, ok in results if ok)
    counts = sorted(g for g, _ in results)
    q = statistics.quantiles(counts, n=10)
    sigma = human_sigma()
    wins = 0.0
    for bot_guesses, bot_solved in results:
        human = rng.lognormvariate(math.log(HUMAN_MEDIAN), sigma)
        human = max(1, round(human))
        if not bot_solved or human < bot_guesses:
            wins += 1.0
        elif human == bot_guesses:
            wins += 0.5

    print(f"rounds            {len(results)}")
    print(f"solved            {len(solved) / len(results):.1%}")
    print(f"median guesses    {statistics.median(counts):.0f}")
    print(f"p10 / p90         {q[0]:.0f} / {q[-1]:.0f}")
    print(f"over 80           {sum(1 for g in counts if g > 80) / len(counts):.1%}")
    print(f"person wins       {wins / len(results):.1%}  (person: median {HUMAN_MEDIAN:.0f}, "
          f"sigma {sigma:.2f})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
