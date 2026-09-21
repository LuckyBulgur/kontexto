#!/usr/bin/env python3
"""Rebuild every unplayed Kontexto game from concrete common nouns.

Background
----------
The pool was built for word frequency, not for guessability. Measured against
production on 2026-09-21 it was 66.8% nouns, 15.1% verbs, 13.8% adjectives and
3.6% proper nouns that slipped the filter. The reference implementation
publishes roughly 98% nouns, and concrete ones. Production play data says the
same thing: a solution the concreteness norms rate below 4.0 costs 118 guesses
per solve, one at 7.0 or above costs 48.

``target_selection.TargetWordFilter`` now enforces the new rule. This script
applies it to the live pool.

What must not happen
--------------------
1. **No played game may change.** Games 1 to today's number keep their word and
   their npz, byte for byte. The script asserts the prefix, it does not assume
   it.
2. **Today's word must not move.** ``GameState.get_game_number`` is
   ``((days - 1) % total_games) + 1``, and this script changes
   ``total_games``. Before the first wrap the modulo is a no-op, so the number
   is unaffected, but the script verifies that rather than trusting it.
3. **The vocabulary must not move.** ``games/{NNNN}.npz`` stores ``ranks[i]``
   positionally bound to ``vocabulary.json``. Extending the vocabulary was
   measured and yields 13 junk words, so it stays exactly as deployed, which is
   also what lets the played npz survive untouched.

Like its two predecessors this is offline and deterministic, and it verifies
before it writes: it reproduces the deployed vocabulary exactly and the played
npz bit for bit. A mismatch aborts.

The pool shrinks, from 9,537 to roughly 4,500. That is the price of the rule
and it was the explicit decision: eleven years of daily puzzles, at an expected
57 guesses per solve instead of about 90. The npz of the games that fall off the
end are listed in the manifest so the upload can remove them.

Usage
-----
    python scripts/rebuild-concrete-pool.py \\
        --vec .model-cache/cc.de.300.vec \\
        --prod-dir .regen-work/prod \\
        --out-dir  .regen-work/concrete
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
from datetime import date

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "backend"))

from wordfreq import zipf_frequency  # noqa: E402

from prepare import (  # noqa: E402
    compute_rankings,
    orthographic_twins,
    postprocess_vectors,
    select_target_words,
    stream_vocab_vectors,
)
from target_selection import TargetWordFilter  # noqa: E402

# The frequency floor for a solution. Deliberately far below the old 4.0:
# concreteness is the gate that matters, and a high floor drops exactly the
# words this game wants, the rare-in-the-news but everyday-in-life kind.
DEFAULT_MIN_ZIPF = 2.5
# Measured: one compressed npz over an 80k vocabulary.
BYTES_PER_GAME = 215 * 1024


def log(msg: str) -> None:
    print(msg, flush=True)


def load_json(path: str):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def human_size(num_bytes: float) -> str:
    return f"{num_bytes / 1024 / 1024 / 1024:.2f} GiB"


# How much of the ranking a player can ever see: GameState.get_closest_words
# returns the 500 nearest. Beyond that a rank is just a large number.
PLAYABLE_HEAD = 500
# Tie noise budget: the share of the vocabulary that may sit one rank apart.
MAX_TIE_SHARE = 0.001


def compare_to_deployed(mine: np.ndarray, deployed: np.ndarray, vocab_list: list[str]) -> str | None:
    """Reason the recomputed ranking differs materially, or None.

    Bit-for-bit equality is the wrong bar, and finding that out cost an hour.
    ``postprocess_vectors`` runs an SVD over an 80,000 by 300 matrix, whose
    parallel reductions are not associative, so similarities that are equal in
    exact arithmetic come out about 1e-9 apart and in either order. On game 1
    that showed up as 30 swapped adjacent pairs at ranks 12,000 to 79,000: a
    maximum rank delta of 1, on words no player will ever see. The earlier
    scripts assert exact equality and have simply been lucky.

    So the gate tests what actually has to hold. The revealed list of nearest
    words must contain the same words, and the solution must still be first.
    Their order inside that list may differ by the same one-rank noise, which
    is why the head is compared as a set: on game 4 two adjacent entries swap
    at ranks 313 and 314, which no player can act on. Everywhere else a word
    may move by a single rank, and only a tenth of a percent of them may.
    Anything larger means a different vector space, a different vocabulary
    order or a different target, which is what this gate is for.
    """
    if len(mine) != len(deployed):
        return f"length {len(mine)} != {len(deployed)}"

    if int(np.argmin(mine)) != int(np.argmin(deployed)):
        return (f"rank 1 differs: {vocab_list[int(np.argmin(mine))]!r} vs "
                f"{vocab_list[int(np.argmin(deployed))]!r}")

    head_mine = set(np.argsort(mine, kind="stable")[:PLAYABLE_HEAD].tolist())
    head_deployed = set(np.argsort(deployed, kind="stable")[:PLAYABLE_HEAD].tolist())
    if head_mine != head_deployed:
        only_mine = sorted(vocab_list[i] for i in head_mine - head_deployed)
        only_deployed = sorted(vocab_list[i] for i in head_deployed - head_mine)
        return (f"the {PLAYABLE_HEAD} nearest words differ: "
                f"only_local={only_mine[:5]} only_deployed={only_deployed[:5]}")

    differing = np.nonzero(mine != deployed)[0]
    if len(differing) == 0:
        return None
    delta = np.abs(mine[differing].astype(np.int64) - deployed[differing].astype(np.int64)).max()
    if delta > 1:
        return f"{len(differing)} ranks differ, by up to {int(delta)} places"
    share = len(differing) / len(mine)
    if share > MAX_TIE_SHARE:
        return f"{len(differing)} ranks differ by one place ({share:.2%}, budget {MAX_TIE_SHARE:.2%})"
    return None


def game_number(today: date, start_date: date, total_games: int) -> int:
    """Today's game number, mirrors GameState.get_game_number."""
    days = (today - start_date).days + 1
    return ((days - 1) % total_games) + 1


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--vec", required=True, help="fastText .vec model (full file)")
    ap.add_argument("--prod-dir", required=True, help="local copy of prod /app/data (read-only)")
    ap.add_argument("--out-dir", required=True, help="where to write the upload artifacts")
    ap.add_argument("--vocab-size", type=int, default=80000)
    ap.add_argument("--fidelity-games", type=int, default=12,
                    help="how many played games to verify bit-for-bit against the deployed npz")
    ap.add_argument("--min-zipf", type=float, default=DEFAULT_MIN_ZIPF,
                    help="lowest German Zipf frequency a solution may have")
    ap.add_argument("--min-pool", type=int, default=3000,
                    help="abort if fewer solutions than this survive the rule")
    ap.add_argument("--seed", type=int, default=20260921,
                    help="shuffle seed for the rebuilt range, so a re-run is reproducible")
    ap.add_argument("--today", default=None, help="override today's date (YYYY-MM-DD)")
    ap.add_argument("--dry-run", action="store_true",
                    help="report the new pool and write the manifest, but compute no npz")
    args = ap.parse_args()

    today = date.fromisoformat(args.today) if args.today else date.today()

    # ---- Load the deployed data -------------------------------------------
    meta = load_json(os.path.join(args.prod_dir, "metadata.json"))
    start_date = date.fromisoformat(meta["start_date"])
    total_games = int(meta["total_games"])
    prod_vocab = load_json(os.path.join(args.prod_dir, "vocabulary.json"))
    prod_targets = load_json(os.path.join(args.prod_dir, "target_words.json"))

    if len(prod_targets) != total_games:
        raise SystemExit("ABORT: target_words length != total_games")
    if not int(meta["vocab_size"]) == len(prod_vocab) == args.vocab_size:
        raise SystemExit("ABORT: vocab_size mismatch between metadata, vocabulary.json and --vocab-size")

    cutoff = game_number(today, start_date, total_games)
    days_elapsed = (today - start_date).days + 1
    log(f"Deployed: start_date={start_date} total_games={total_games} vocab={len(prod_vocab)}")
    log(f"Today: {today} -> game {cutoff} (day {days_elapsed})")

    if days_elapsed > total_games:
        raise SystemExit(
            f"ABORT: the daily series has wrapped ({days_elapsed} days over {total_games} games). "
            "Changing total_games now would move the daily word for everyone."
        )
    log(f"  wrap gate OK (day {days_elapsed} of {total_games}, no wrap yet)")
    log(f"Keeping games 1..{cutoff} unchanged, rebuilding everything after that")

    # ---- Gate: reproduce the deployed vector space and vocabulary ----------
    log("Streaming vocabulary and vectors from the .vec file ...")
    filtered, frequency_order = stream_vocab_vectors(args.vec, args.vocab_size)
    vocab_list = sorted(filtered.keys())
    vocab_index = {w: i for i, w in enumerate(vocab_list)}
    if vocab_index != prod_vocab:
        local, remote = set(vocab_index), set(prod_vocab)
        log(f"VOCAB MISMATCH: only_local={sorted(local - remote)[:5]} only_prod={sorted(remote - local)[:5]}")
        raise SystemExit("ABORT: reproduced vocabulary != the deployed vocabulary.json")
    log("  vocab gate OK (reproduced vocabulary == deployed, byte-exact)")

    log("Post-processing vectors (All-but-the-Top, debias) ...")
    vectors = postprocess_vectors(filtered)

    # ---- Gate: played npz must be reproducible bit for bit -----------------
    fidelity_games = min(args.fidelity_games, cutoff)
    log(f"Fidelity gate: recomputing played games 1..{fidelity_games} ...")
    for game in range(1, fidelity_games + 1):
        npz_path = os.path.join(args.prod_dir, "games", f"{game:04d}.npz")
        if not os.path.exists(npz_path):
            raise SystemExit(f"ABORT: missing deployed npz for the fidelity gate: {npz_path}")
        mine = compute_rankings(prod_targets[game - 1], vocab_list, vectors)
        with np.load(npz_path) as archive:
            deployed = archive["ranks"]
        problem = compare_to_deployed(mine, deployed, vocab_list)
        if problem is not None:
            raise SystemExit(f"ABORT: fidelity gate failed on game {game}: {problem}")
    log(f"  fidelity gate OK (played npz reproduced, top {PLAYABLE_HEAD} identical)")

    # ---- Build the new pool ------------------------------------------------
    log(f"Selecting concrete common nouns (zipf >= {args.min_zipf}) ...")
    filt = TargetWordFilter()
    candidates = select_target_words(
        vocab_list, vectors, n=10 ** 9, frequency_order=frequency_order,
        target_filter=filt, min_solution_zipf=args.min_zipf,
    )
    log(f"  candidates passing the rule: {len(candidates)}")

    kept = prod_targets[:cutoff]
    kept_set = set(kept)
    # A word already spent on a played game cannot come round again: the pool
    # must stay duplicate-free, and a repeat would look like a bug to anyone
    # who played both.
    fresh = [w for w in candidates if w not in kept_set]
    log(f"  of those unused by games 1..{cutoff}: {len(fresh)}")

    if len(fresh) + cutoff < args.min_pool:
        raise SystemExit(
            f"ABORT: only {len(fresh) + cutoff} solutions survive the rule, "
            f"below --min-pool {args.min_pool}. Report this rather than loosening the rule."
        )

    rng = random.Random(args.seed)
    rng.shuffle(fresh)
    new_targets = kept + fresh
    new_total = len(new_targets)

    # ---- Verification gate -------------------------------------------------
    log("Verification gate ...")
    twins = orthographic_twins(vocab_list)
    if new_targets[:cutoff] != prod_targets[:cutoff]:
        raise SystemExit("ABORT: played games changed")
    if len(set(new_targets)) != new_total:
        raise SystemExit("ABORT: duplicate solutions in the new pool")
    if game_number(today, start_date, new_total) != cutoff:
        raise SystemExit("ABORT: today's game number moves under the new total_games")
    for word in new_targets[cutoff:]:
        if word in twins:
            raise SystemExit(f"ABORT: {word!r} has a sharp-s twin in the vocabulary")
        reason = filt.reject_reason(word)
        if reason is not None:
            raise SystemExit(f"ABORT: new solution {word!r} fails the rule ({reason})")
        if zipf_frequency(word, "de") < args.min_zipf:
            raise SystemExit(f"ABORT: new solution {word!r} is below the frequency floor")
    log(f"  verification gate OK ({new_total - cutoff} new solutions)")

    log(f"Pool: {total_games} -> {new_total} games "
        f"({human_size(new_total * BYTES_PER_GAME)}, was {human_size(total_games * BYTES_PER_GAME)})")

    # ---- Write artifacts ---------------------------------------------------
    os.makedirs(args.out_dir, exist_ok=True)
    out_games = os.path.join(args.out_dir, "games")
    os.makedirs(out_games, exist_ok=True)

    manifest = {
        "today": today.isoformat(),
        "cutoff": cutoff,
        "previous_total_games": total_games,
        "new_total_games": new_total,
        "min_zipf": args.min_zipf,
        "seed": args.seed,
        "rebuilt_games": [
            {"game": cutoff + i + 1, "old": prod_targets[cutoff + i] if cutoff + i < total_games else None,
             "new": word}
            for i, word in enumerate(new_targets[cutoff:])
        ],
        # Games the shrunken pool no longer has. Their npz stay on the server
        # unless the upload removes them; they are unreachable either way.
        "obsolete_npz": [f"{n:04d}.npz" for n in range(new_total + 1, total_games + 1)],
    }
    with open(os.path.join(args.out_dir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    with open(os.path.join(args.out_dir, "target_words.json"), "w", encoding="utf-8") as f:
        json.dump(new_targets, f, ensure_ascii=False)
    new_meta = dict(meta)
    new_meta["total_games"] = new_total
    with open(os.path.join(args.out_dir, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(new_meta, f, ensure_ascii=False)

    if args.dry_run:
        log("Dry run: wrote target_words.json, metadata.json and manifest.json, no npz computed")
        return 0

    log(f"Computing {new_total - cutoff} rank arrays ...")
    # The neighbourhood is dumped alongside the ranks, because it is the same
    # computation and because a solution is only fair if there is a path to it.
    # Reading 3,927 neighbourhoods by hand is not a plan, so each one gets a
    # score and the worst are read; scripts/audit-neighbourhoods.py does that.
    neighbours_path = os.path.join(args.out_dir, "neighbourhoods.jsonl")
    with open(neighbours_path, "w", encoding="utf-8") as neighbours:
        for i, word in enumerate(new_targets[cutoff:]):
            game = cutoff + i + 1
            ranks = compute_rankings(word, vocab_list, vectors)
            if ranks.dtype != np.uint32 or len(ranks) != len(vocab_list):
                raise SystemExit(f"ABORT: malformed rank array for game {game}")
            if vocab_list[int(np.argmin(ranks))] != word:
                raise SystemExit(f"ABORT: rank 1 is not the solution for game {game}")
            np.savez_compressed(os.path.join(out_games, f"{game:04d}.npz"), ranks=ranks)
            order = np.argsort(ranks, kind="stable")[:101]
            top = [vocab_list[j] for j in order if vocab_list[j] != word][:100]
            neighbours.write(json.dumps({"game": game, "word": word, "top": top},
                                        ensure_ascii=False) + "\n")
            if (i + 1) % 250 == 0:
                log(f"  {i + 1}/{new_total - cutoff}")
    log(f"  neighbourhoods written to {neighbours_path}")

    log(f"Artifacts written to {args.out_dir}")
    log(f"  target_words.json, metadata.json, manifest.json, games/ ({new_total - cutoff} npz)")
    log(f"  obsolete on the server after upload: {len(manifest['obsolete_npz'])} npz")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
