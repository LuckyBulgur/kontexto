"""Propose a category for every solution, as the start of a reading pass.

How it proposes: every category in backend/data/categories.txt carries a few
seed words. A solution's own rank array says how close each seed sits to it,
and the category whose three best seeds sit closest (mean displayed rank) is
the proposal. Three and not all of them, because a field like "Weltall und
Wissenschaft" holds two clusters and a median over both would punish either.

What it is not: a decision. The proposal is right for most concrete nouns and
wrong often enough on the rest (an abstract word lands wherever its strongest
association points) that every line is read before it goes into
backend/data/solution_categories.txt. This is the same rule CLAUDE.md records
for the simulated player: a measured signal is a hint for the reading pass,
never the verdict.

Usage:
    python scripts/propose-categories.py --data-dir <dir> [--out proposals.tsv]
        [--compare backend/data/solution_categories.txt]

The data directory needs vocabulary.json, target_words.json, metadata.json,
core_words.json and games/. A solution of the pool without a game there (a word
added after that build) is listed with an empty proposal.
"""

from __future__ import annotations

import argparse
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from category_ranks import RankSource, read_pool  # noqa: E402

import categories as cat  # noqa: E402  (backend/, put on the path by category_ranks)

BEST_SEEDS = 3


def score(seed_ranks: list[int]) -> float:
    if not seed_ranks:
        return float("inf")
    best = sorted(seed_ranks)[:BEST_SEEDS]
    return float(np.mean(best))


def main() -> int:
    parser = argparse.ArgumentParser(description="propose a category per solution")
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--pool", default=os.path.join(cat.DATA_DIR, "solution_pool.txt"))
    parser.add_argument("--out", default="category-proposals.tsv")
    parser.add_argument("--compare", help="an assignment file to list disagreements against")
    args = parser.parse_args()

    catalogue = cat.read_catalogue()
    source = RankSource(args.data_dir)
    pool = read_pool(args.pool)

    all_seeds = sorted({seed for category in catalogue for seed in category.seeds})
    missing = [seed for seed in all_seeds if seed not in source.vocabulary or not source.core_mask[source.vocabulary[seed]]]
    if missing:
        print(f"seeds without a place on the scale (ignored): {' '.join(missing)}", file=sys.stderr)

    rows: list[tuple[str, str, float, str, float]] = []
    for number, word in enumerate(pool, 1):
        game = source.curated_game_of.get(word)
        if game is None:
            rows.append((word, "", float("inf"), "", float("inf")))
            continue
        ranks = source.display_ranks(game, all_seeds)
        scored = sorted(
            (score([ranks[s] for s in category.seeds if s in ranks and s != word]), category.id)
            for category in catalogue
        )
        (best_score, best), (second_score, second) = scored[0], scored[1]
        rows.append((word, best, best_score, second, second_score))
        if number % 250 == 0:
            print(f"{number}/{len(pool)}", file=sys.stderr)

    with open(args.out, "w", encoding="utf-8") as f:
        f.write("word\tproposal\tscore\trunner_up\trunner_up_score\n")
        for word, best, best_score, second, second_score in rows:
            f.write(f"{word}\t{best}\t{best_score:.0f}\t{second}\t{second_score:.0f}\n")

    counts: dict[str, int] = {}
    for _, best, *_ in rows:
        counts[best or "(no game)"] = counts.get(best or "(no game)", 0) + 1
    print(f"\n{'category':>12} {'proposed':>9}")
    for category in catalogue:
        print(f"{category.id:>12} {counts.get(category.id, 0):9d}")
    if "(no game)" in counts:
        print(f"{'(no game)':>12} {counts['(no game)']:9d}")

    if args.compare:
        decided = cat.read_assignment((c.id for c in catalogue), args.compare)
        differ = [(w, b, decided.get(w)) for w, b, *_ in rows if w in decided and b and decided[w] != b]
        print(f"\n{len(differ)} of {len(decided)} decided words differ from the proposal")
        for word, proposed, chosen in differ:
            print(f"  {word}: proposed {proposed}, decided {chosen or cat.UNCATEGORISED}")
    print(f"\nwrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
