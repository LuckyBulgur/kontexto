#!/usr/bin/env python3
"""Score every solution's neighbourhood for whether a player can climb to it.

A Kontexto round is only fair if the words around the solution are words a
player would plausibly type. A solution can pass every filter and still be
unplayable: if its hundred nearest neighbours are all rare compounds sharing
its own head, or all surnames, there is no ladder, only the answer.

So each solution is scored by how many of its hundred nearest neighbours are
**reachable**: an ordinary German word, frequent enough to be guessed, not a
name, and not merely the solution with something glued to it. The score is a
count out of 100, and the ones at the bottom are printed for a human to read.

The threshold is not a hard gate by default. It is a reading list: the script
prints the worst neighbourhoods with their words, and ``--fail-below`` turns it
into a gate once the number has been agreed.

Usage
-----
    python scripts/audit-neighbourhoods.py \\
        --neighbourhoods .regen-work/concrete/neighbourhoods.jsonl \\
        --worst 150
"""

from __future__ import annotations

import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "backend"))

from wordfreq import zipf_frequency  # noqa: E402

# A neighbour below this is not a word a player reaches for. It is not the bar
# for a *solution*, which is deliberately much lower: a rare solution with
# common neighbours is a good round, a common solution with rare neighbours is
# not.
NEIGHBOUR_MIN_ZIPF = 3.5
# The shortest stem that counts as sharing morphology, so that a neighbour list
# made only of the solution's own compounds does not look like a semantic path.
MORPH_STEM = 5


def log(msg: str) -> None:
    print(msg, flush=True)


def shares_morphology(word: str, neighbour: str) -> bool:
    """Whether the neighbour is the solution with something glued to it."""
    if len(word) < MORPH_STEM:
        return False
    stem = word[:MORPH_STEM]
    return neighbour.startswith(stem) or word in neighbour or neighbour in word


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--neighbourhoods", default=".regen-work/concrete/neighbourhoods.jsonl")
    ap.add_argument("--names", default=os.path.join(HERE, "..", "backend", "german_names.txt"))
    ap.add_argument("--worst", type=int, default=150, help="how many to print for reading")
    ap.add_argument("--show", type=int, default=12, help="neighbours printed per entry")
    ap.add_argument("--fail-below", type=int, default=None,
                    help="exit non-zero if any solution scores below this")
    ap.add_argument("--out", default=None, help="write every score as JSON here")
    args = ap.parse_args()

    names: set[str] = set()
    if os.path.exists(args.names):
        with open(args.names, encoding="utf-8") as f:
            names = {line.strip() for line in f if line.strip()}

    zipf_cache: dict[str, float] = {}

    def zipf(word: str) -> float:
        if word not in zipf_cache:
            zipf_cache[word] = zipf_frequency(word, "de")
        return zipf_cache[word]

    scored = []
    with open(args.neighbourhoods, encoding="utf-8") as f:
        for line in f:
            entry = json.loads(line)
            word, top = entry["word"], entry["top"]
            # Two different failures, measured separately.
            #
            # "reachable" asks whether there is a ladder: neighbours a player
            # would actually type. Morphological relatives are excluded from the
            # count because a list of the solution's own compounds is not a
            # semantic path, but they stay in the printed sample, since for a
            # compound solution they are how a player closes the last step.
            reachable = [n for n in top
                         if zipf(n) >= NEIGHBOUR_MIN_ZIPF
                         and n not in names
                         and not shares_morphology(word, n)]
            # "name_share" asks whether the neighbourhood is broken. When the
            # embedding read the solution as a name, its neighbours are other
            # names and the round is unwinnable by meaning. This is the signal
            # that actually finds bad solutions.
            named = [n for n in top if n in names]
            scored.append({
                "game": entry["game"],
                "word": word,
                "reachable": len(reachable),
                "name_share": len(named),
                "sample": (reachable or top)[:args.show],
                "names": named[:args.show],
            })

    by_names = sorted(scored, key=lambda e: -e["name_share"])
    log(f"{len(scored)} solutions audited\n")
    log("Neighbourhoods dominated by proper names (the embedding read the "
        "solution as a name):")
    for entry in by_names[:40]:
        if entry["name_share"] < 10:
            break
        log(f"  {entry['name_share']:3d}/100 names  game {entry['game']:5d}  "
            f"{entry['word']:22s} {', '.join(entry['names'][:8])}")
    log("")

    scored.sort(key=lambda e: e["reachable"])
    total = len(scored)
    if not total:
        raise SystemExit("ABORT: no neighbourhoods to audit")

    counts = [e["reachable"] for e in scored]

    log(f"  reachable neighbours out of 100: min {counts[0]}, median "
        f"{counts[total // 2]}, max {counts[-1]}")
    for bar in (5, 10, 20, 30):
        log(f"  below {bar}: {sum(1 for c in counts if c < bar)}")

    log(f"\nWorst {min(args.worst, total)}, for reading:")
    for entry in scored[:args.worst]:
        log(f"  {entry['reachable']:3d}  game {entry['game']:5d}  {entry['word']:24s} "
            f"{', '.join(entry['sample'])}")

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(scored, f, ensure_ascii=False, indent=1)
        log(f"\nscores written to {args.out}")

    if args.fail_below is not None:
        bad = [e for e in scored if e["reachable"] < args.fail_below]
        if bad:
            log(f"\n{len(bad)} solutions score below {args.fail_below}")
            return 1
        log(f"\nevery solution has at least {args.fail_below} reachable neighbours")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
