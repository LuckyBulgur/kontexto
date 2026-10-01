"""Measure the categories against a real data directory.

Two questions, one table:

1. **Is every field big enough?** The playable count is the curated games of
   that data directory whose solution is filed under the field, without the
   games struck under code J. categories.MIN_PLAYABLE is the floor.
2. **How much does seeing the field help?** The foothold of a solution is the
   best displayed rank any of the twenty opening words reaches (the measure
   CLAUDE.md validated against 600 live rounds, Spearman 0,614). Showing the
   field adds the field's seed words to what a player types first, so the
   foothold *with* the field is the best rank over the openers and the seeds
   together. The gap between the two medians is what the hint is worth.

   A field whose median foothold with the field drops to about 10 nearly names
   the answer and should be merged into a broader one.

Usage:
    python scripts/measure-categories.py --data-dir <dir> [--markdown]

The solution itself is left out of both word lists, so a solution that is an
opening word or a seed does not count as found on the first guess.
"""

from __future__ import annotations

import argparse
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from category_ranks import OPENERS, RankSource  # noqa: E402

import categories as cat  # noqa: E402
import core_lexicon  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="measure the solution categories")
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--markdown", action="store_true", help="print a Markdown table")
    args = parser.parse_args()

    source = RankSource(args.data_dir)
    shipped = cat.get_categories()
    unfit = core_lexicon.load_child_unfit_solutions()

    per_field: dict[str, list[tuple[int, int]]] = {c.id: [] for c in shipped.catalogue}
    without_field = 0
    unassigned: list[str] = []
    for number, word in source.curated_games():
        if word in unfit:
            continue
        field = shipped.of_word(word)
        if field is None:
            if not shipped.knows(word):
                unassigned.append(word)
            without_field += 1
            continue
        seeds = shipped.get(field).seeds
        words = sorted((set(OPENERS) | set(seeds)) - {word})
        ranks = source.display_ranks(number, words)
        plain = min((ranks[w] for w in OPENERS if w in ranks and w != word), default=0)
        hinted = min((ranks[w] for w in words if w in ranks), default=0)
        per_field[field].append((plain, hinted))

    rows = []
    for category in shipped.catalogue:
        games = per_field[category.id]
        plain = int(np.median([p for p, _ in games])) if games else 0
        hinted = int(np.median([h for _, h in games])) if games else 0
        rows.append((category, len(games), plain, hinted))

    all_plain = [p for games in per_field.values() for p, _ in games]
    all_hinted = [h for games in per_field.values() for _, h in games]

    if args.markdown:
        print("| Kategorie | spielbar | Fußhalt ohne | Fußhalt mit |")
        print("|-|-:|-:|-:|")
        for category, count, plain, hinted in rows:
            print(f"| {category.name} | {count} | {plain} | {hinted} |")
        print(f"| alle | {len(all_plain)} | {int(np.median(all_plain))} | {int(np.median(all_hinted))} |")
    else:
        print(f"{'field':>12} {'playable':>9} {'foothold':>9} {'with field':>11}")
        for category, count, plain, hinted in rows:
            flag = "  below floor" if count < cat.MIN_PLAYABLE else ""
            print(f"{category.id:>12} {count:9d} {plain:9d} {hinted:11d}{flag}")
        print(f"{'all':>12} {len(all_plain):9d} {int(np.median(all_plain)):9d} {int(np.median(all_hinted)):11d}")
    print(f"\n{without_field} playable games show no field", file=sys.stderr)
    if unassigned:
        print(f"{len(unassigned)} curated solutions are missing from the assignment: "
              f"{' '.join(sorted(unassigned)[:20])}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
