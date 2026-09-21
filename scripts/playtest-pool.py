#!/usr/bin/env python3
"""Play sampled rounds end to end against a running backend and report each one.

The filters and the neighbourhood audit both reason about the pool from the
outside. This plays it. For each sampled game it drives ``/api/guess`` the way
a competent player does: open with everyday words, then follow the best guess
so far by guessing its nearest common neighbour, and keep going until the
solution is found or the budget runs out.

The simulated player uses the same vector space the game scores with, which
makes it an optimistic player, not a typical one. That is the point: if this
player cannot find the word, nobody can, and the round is unfair. The number to
read is not the average, it is the list of rounds that ran out of guesses.

Usage
-----
    python scripts/playtest-pool.py \\
        --vec .model-cache/cc.de.300.vec \\
        --data-dir .regen-work/serve \\
        --api http://127.0.0.1:8000/api \\
        --rounds 30
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import urllib.error
import urllib.request

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "backend"))

from wordfreq import zipf_frequency  # noqa: E402

from prepare import postprocess_vectors, stream_vocab_vectors  # noqa: E402

# What a player opens with: everyday, spread across the semantic space, the way
# a person actually starts a round.
OPENERS = [
    "haus", "wasser", "mensch", "tier", "stadt", "essen", "auto", "baum",
    "arbeit", "kind", "musik", "farbe", "körper", "maschine", "kleidung",
    "sport", "tisch", "papier", "wetter", "schule",
]
# A guess the simulated player may make must be a word a person would type.
GUESSABLE_MIN_ZIPF = 3.6
# The floor a solution itself clears, used once the player is closing in.
NEAR_MIN_ZIPF = 2.5


def log(msg: str) -> None:
    print(msg, flush=True)


def guess(api: str, game: int, word: str) -> int | None:
    """Rank of *word* in *game*, or None if the backend will not score it."""
    # infinite=true skips the date gate: every pre-computed game is playable on
    # demand, which is exactly how the random modes reach the pool anyway.
    body = json.dumps({"word": word}).encode()
    request = urllib.request.Request(
        f"{api}/guess?game={game}&infinite=true", data=body,
        headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return int(json.load(response)["rank"])
    except urllib.error.HTTPError:
        return None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--vec", required=True)
    ap.add_argument("--data-dir", required=True, help="the data directory the backend serves")
    ap.add_argument("--api", default="http://127.0.0.1:8000/api")
    ap.add_argument("--rounds", type=int, default=30)
    ap.add_argument("--budget", type=int, default=120, help="guesses a round may take")
    ap.add_argument("--seed", type=int, default=20260921)
    ap.add_argument("--vocab-size", type=int, default=80000)
    ap.add_argument("--out", default=None, help="write the per-round report as JSON")
    args = ap.parse_args()

    targets = json.load(open(os.path.join(args.data_dir, "target_words.json"), encoding="utf-8"))
    meta = json.load(open(os.path.join(args.data_dir, "metadata.json"), encoding="utf-8"))
    cutoff = 106  # games up to here are the old pool and are not under test

    rng = random.Random(args.seed)
    games = rng.sample(range(cutoff + 1, int(meta["total_games"]) + 1), args.rounds)
    games.sort()

    log("Loading the vector space the simulated player thinks with ...")
    filtered, _ = stream_vocab_vectors(args.vec, args.vocab_size)
    vocab_list = sorted(filtered)
    vectors = postprocess_vectors(filtered)
    index = {w: i for i, w in enumerate(vocab_list)}

    matrix = np.array([vectors[w] for w in vocab_list], dtype=np.float32)
    matrix /= np.maximum(np.linalg.norm(matrix, axis=1, keepdims=True), 1e-10)
    zipfs = np.array([zipf_frequency(w, "de") for w in vocab_list], dtype=np.float32)
    guessable = zipfs >= GUESSABLE_MIN_ZIPF
    # Once the trail is warm the player starts naming things precisely, so the
    # floor drops to what a solution itself has to clear.
    near_guessable = zipfs >= NEAR_MIN_ZIPF
    log(f"  {int(guessable.sum())} of {len(vocab_list)} words are ones a player would type")

    report = []
    for game in games:
        target = targets[game - 1]
        tried: set[str] = set()
        best_word, best_rank = None, None
        history: list[tuple[str, int]] = []

        for word in OPENERS:
            if word not in index:
                continue
            rank = guess(args.api, game, word)
            tried.add(word)
            if rank is None:
                continue
            history.append((word, rank))
            if best_rank is None or rank < best_rank:
                best_word, best_rank = word, rank
            if rank == 1:
                break

        while best_rank != 1 and len(tried) < args.budget and best_word is not None:
            # Triangulate the way a player does, from every guess so far and not
            # only from the best one. Chasing the single best guess walks into a
            # cluster of near-synonyms and circles there; the ranks of the other
            # guesses are what point out of it. Weight by 1/log(rank), so a
            # guess at rank 3 pulls hard and one at rank 40,000 barely at all.
            anchors = sorted(history, key=lambda h: h[1])[:5]
            direction = np.zeros(matrix.shape[1], dtype=np.float32)
            for word_at, rank_at in anchors:
                if word_at in index:
                    direction += matrix[index[word_at]] / float(np.log(rank_at + 2.0))
            norm = float(np.linalg.norm(direction))
            if norm < 1e-9:
                break
            similarity = matrix @ (direction / norm)
            # A player who is already close stops typing everyday words and
            # starts naming things precisely, so the frequency floor lifts once
            # the trail is warm.
            if best_rank is not None and best_rank <= 50:
                similarity[~near_guessable] = -2.0
            else:
                similarity[~guessable] = -2.0
            for w in tried:
                if w in index:
                    similarity[index[w]] = -2.0
            candidate = vocab_list[int(np.argmax(similarity))]
            rank = guess(args.api, game, candidate)
            tried.add(candidate)
            if rank is None:
                continue
            history.append((candidate, rank))
            if rank < best_rank:
                best_word, best_rank = candidate, rank

        solved = best_rank == 1
        report.append({
            "game": game, "word": target, "guesses": len(tried),
            "solved": solved, "best_rank": best_rank,
            "opening_ranks": [r for _, r in history[:5]],
            "path": [w for w, _ in history[-6:]],
        })
        mark = "solved" if solved else f"GAVE UP at rank {best_rank}"
        log(f"  game {game:5d}  {target:24s} {len(tried):4d} guesses  {mark}")

    solved = [r for r in report if r["solved"]]
    log(f"\n{len(solved)}/{len(report)} rounds solved")
    if solved:
        log(f"  guesses when solved: min {min(r['guesses'] for r in solved)}, "
            f"median {sorted(r['guesses'] for r in solved)[len(solved) // 2]}, "
            f"max {max(r['guesses'] for r in solved)}")
    unsolved = [r for r in report if not r["solved"]]
    if unsolved:
        log("  unsolved, read these:")
        for r in unsolved:
            log(f"    game {r['game']}: {r['word']} (best rank {r['best_rank']}, "
                f"last tried {', '.join(r['path'])})")

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=1)
        log(f"\nreport written to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
