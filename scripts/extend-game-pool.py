#!/usr/bin/env python3
"""Grow the Kontexto game pool on production without touching a single existing game.

Background
----------
Every mode that is not the daily puzzle draws a random game from the pool:
Unendlich, the solo modes, every multiplayer rematch and every matchmade round.
With more modes the same pool is drawn from far more often, so solutions start
repeating. This script appends new games to the end of the pool.

What must not happen
--------------------
1. **No existing game may change.** ``games/{NNNN}.npz`` stores ``ranks[i]`` =
   the rank of ``index_to_word[i]``, positionally bound to ``vocabulary.json``.
   Appending targets touches neither the vocabulary nor any existing npz, and
   the new ``target_words.json`` keeps the old list as its exact prefix.
2. **Today's word must not move.** ``GameState.get_game_number`` is
   ``((days - 1) % total_games) + 1``. Raising ``total_games`` only changes that
   result once the series has wrapped at least once. The script therefore
   refuses to run after the first wrap, rather than silently shifting the daily
   schedule for everyone mid-series.
3. **No solution may appear twice.** Every appended target is checked against
   the full existing list and against the other appended ones.

Like ``regenerate-future-games.py``, this is offline and deterministic, and it
verifies before it writes: it reproduces prod's vocabulary exactly and prod's
existing npz bit-for-bit (the fidelity gate). A mismatch aborts. Run it against
a read-only copy of prod's data and the cached fastText ``.vec``; it writes only
the artifacts to upload, and never uploads them.

Cost, measured
--------------
One npz over an 80k vocabulary is about 215 KiB. Going from 2,400 to 10,000
games therefore adds roughly 1.6 GiB to ``/app/data`` and to the upload. The
data lives in the ``kontexto-data`` volume, not in the image, so the Docker
build is unaffected. The script prints the estimate for the chosen size before
it computes anything.

Usage
-----
    python scripts/extend-game-pool.py \\
        --vec .model-cache/cc.de.300.vec \\
        --prod-dir .regen-work/prod \\
        --out-dir  .regen-work/out \\
        --target-total 10000
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
    vocab_word_ok,
)
from target_selection import TargetWordFilter  # noqa: E402

# The frequency bar prepare.py uses for a daily solution. Words above it are
# ones essentially everybody knows.
STANDARD_MIN_ZIPF = 4.0
# How far the bar may be lowered when the standard band cannot fill the pool.
# Below 3.0 the words stop being fair for a game whose whole premise is that the
# solution is a word the player already has.
DEFAULT_MIN_ZIPF_FLOOR = 3.0
# Measured: one compressed npz over an 80k vocabulary.
BYTES_PER_GAME = 215 * 1024


def log(msg: str) -> None:
    print(msg, flush=True)


def load_json(path: str):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def stream_vocab_vectors(vec_path: str, vocab_size: int) -> tuple[dict[str, np.ndarray], list[str]]:
    """Reproduce prod's vocabulary and raw vectors from a fastText ``.vec`` file.

    Same semantics as ``prepare.filter_vocabulary`` (first-seen cased variant per
    lowercased word, in frequency order) without holding all ~2M vectors in
    memory. Shares the membership predicate, and the caller still asserts the
    result against prod's vocabulary.json.
    """
    filtered: dict[str, np.ndarray] = {}
    frequency_order: list[str] = []
    with open(vec_path, "r", encoding="utf-8") as f:
        f.readline()  # header: "<count> <dim>"
        for line in f:
            parts = line.rstrip("\n").split(" ")
            word = parts[0].lower()
            if not vocab_word_ok(word):
                continue
            if word not in filtered:
                filtered[word] = np.asarray(parts[1:], dtype=np.float32)
                frequency_order.append(word)
            if len(filtered) >= vocab_size:
                break
    return filtered, frequency_order


def human_size(num_bytes: float) -> str:
    return f"{num_bytes / 1024 / 1024 / 1024:.2f} GiB"


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--vec", required=True, help="fastText .vec model (full file)")
    ap.add_argument("--prod-dir", required=True, help="local copy of prod /app/data (read-only)")
    ap.add_argument("--out-dir", required=True, help="where to write the upload artifacts")
    ap.add_argument("--target-total", type=int, default=10000, help="pool size to grow to")
    ap.add_argument("--vocab-size", type=int, default=80000)
    ap.add_argument("--fidelity-games", type=int, default=12,
                    help="how many existing games to verify bit-for-bit against prod npz")
    ap.add_argument("--min-zipf-floor", type=float, default=DEFAULT_MIN_ZIPF_FLOOR,
                    help="lowest German Zipf frequency an appended solution may have")
    ap.add_argument("--seed", type=int, default=20260920,
                    help="shuffle seed for the appended range, so a re-run is reproducible")
    ap.add_argument("--today", default=None, help="override today's date (YYYY-MM-DD)")
    args = ap.parse_args()

    today = date.fromisoformat(args.today) if args.today else date.today()

    # ---- Load prod data ----------------------------------------------------
    meta = load_json(os.path.join(args.prod_dir, "metadata.json"))
    start_date = date.fromisoformat(meta["start_date"])
    total_games = int(meta["total_games"])
    prod_vocab = load_json(os.path.join(args.prod_dir, "vocabulary.json"))
    prod_targets = load_json(os.path.join(args.prod_dir, "target_words.json"))

    if len(prod_targets) != total_games:
        raise SystemExit("ABORT: target_words length != total_games")
    if not int(meta["vocab_size"]) == len(prod_vocab) == args.vocab_size:
        raise SystemExit("ABORT: vocab_size mismatch between metadata, vocabulary.json and --vocab-size")
    if args.target_total <= total_games:
        raise SystemExit(
            f"ABORT: --target-total {args.target_total} is not larger than the current pool ({total_games})"
        )

    needed = args.target_total - total_games
    log(f"Prod: start_date={start_date} total_games={total_games} vocab={len(prod_vocab)}")
    log(f"Today: {today}")
    log(f"Appending {needed} games -> new total {args.target_total}")
    log(f"  estimated new data: {human_size(needed * BYTES_PER_GAME)} "
        f"(pool after: {human_size(args.target_total * BYTES_PER_GAME)})")

    # ---- Gate: the daily series must not have wrapped yet -------------------
    # Today's game is ((days - 1) % total_games) + 1. Before the first wrap the
    # modulo is a no-op, so raising total_games changes nothing. After it, every
    # future daily would shift, which is not a thing to do to a running series.
    days_elapsed = (today - start_date).days + 1
    if days_elapsed > total_games:
        raise SystemExit(
            f"ABORT: the daily series has already wrapped ({days_elapsed} days over a pool of "
            f"{total_games}). Growing the pool now would move every future daily word."
        )
    log(f"  wrap gate OK (day {days_elapsed} of {total_games}, no wrap yet)")

    # ---- Gate: reproduce prod's vector space and vocabulary ----------------
    log("Streaming vocabulary and vectors from the .vec file ...")
    filtered, frequency_order = stream_vocab_vectors(args.vec, args.vocab_size)
    vocab_list = sorted(filtered.keys())
    vocab_index = {w: i for i, w in enumerate(vocab_list)}
    if vocab_index != prod_vocab:
        local, remote = set(vocab_index), set(prod_vocab)
        log(f"VOCAB MISMATCH: only_local={sorted(local - remote)[:5]} only_prod={sorted(remote - local)[:5]}")
        raise SystemExit("ABORT: reproduced vocabulary != prod vocabulary.json")
    log("  vocab gate OK (reproduced vocabulary == prod, byte-exact)")

    log("Post-processing vectors (All-but-the-Top, debias) ...")
    vectors = postprocess_vectors(filtered)

    # ---- Gate: existing npz must be reproducible bit-for-bit ---------------
    log(f"Fidelity gate: recomputing existing games 1..{args.fidelity_games} ...")
    for game in range(1, args.fidelity_games + 1):
        npz_path = os.path.join(args.prod_dir, "games", f"{game:04d}.npz")
        if not os.path.exists(npz_path):
            raise SystemExit(f"ABORT: missing prod npz for fidelity gate: {npz_path}")
        mine = compute_rankings(prod_targets[game - 1], vocab_list, vectors)
        prod_ranks = np.load(npz_path)["ranks"]
        if not np.array_equal(mine, prod_ranks):
            differing = int(np.sum(mine != prod_ranks))
            raise SystemExit(f"ABORT: fidelity gate failed on game {game} ({differing} ranks differ)")
    log("  fidelity gate OK (existing npz reproduced bit-for-bit)")

    # ---- Pick the appended targets -----------------------------------------
    filt = TargetWordFilter()
    twins = orthographic_twins(vocab_list)
    used = set(prod_targets)

    log(f"Building the candidate pool down to Zipf {args.min_zipf_floor} ...")
    candidates = select_target_words(
        vocab_list, vectors, n=10**9, frequency_order=frequency_order,
        target_filter=filt, min_solution_zipf=args.min_zipf_floor,
    )
    # select_target_words shuffles its result so daily difficulty varies. Here we
    # want the most frequent words first, so the pool grows with the best
    # remaining solutions rather than an arbitrary slice of them.
    candidates.sort(key=lambda w: -zipf_frequency(w, "de"))
    fresh = [w for w in candidates if w not in used and w not in twins]
    log(f"  candidates: {len(candidates)}, of them unused and clean: {len(fresh)}")

    above_standard = sum(1 for w in fresh if zipf_frequency(w, "de") >= STANDARD_MIN_ZIPF)
    log(f"  of those, {above_standard} are at or above the standard bar (Zipf {STANDARD_MIN_ZIPF})")

    if len(fresh) < needed:
        raise SystemExit(
            f"ABORT: only {len(fresh)} clean unused words available, {needed} needed. "
            f"Either lower --min-zipf-floor (currently {args.min_zipf_floor}, and below 3.0 the "
            f"words stop being fair) or lower --target-total."
        )

    appended = fresh[:needed]
    # A fixed seed keeps a re-run byte-identical; shuffling keeps the appended
    # range from running strictly easiest-first for years.
    random.Random(args.seed).shuffle(appended)

    # ---- Verification gate --------------------------------------------------
    log("Verification gate ...")
    merged = list(prod_targets) + appended
    if merged[:total_games] != prod_targets:
        raise SystemExit("ABORT: existing target list is no longer an exact prefix")
    if len(merged) != args.target_total:
        raise SystemExit("ABORT: merged length != target total")
    if len(set(merged)) != len(merged):
        raise SystemExit("ABORT: duplicate target words after the append")
    for word in appended:
        if word in twins:
            raise SystemExit(f"ABORT: appended target {word!r} is a twin")
        if filt.reject_reason(word) is not None:
            raise SystemExit(f"ABORT: appended target {word!r} fails the target filter")
    log("  target list OK (prefix intact, no duplicates, all appended words clean)")

    # ---- Write artifacts ----------------------------------------------------
    out_games = os.path.join(args.out_dir, "games")
    os.makedirs(out_games, exist_ok=True)
    log(f"Computing {needed} rank arrays ...")
    for offset, word in enumerate(appended):
        game = total_games + offset + 1
        ranks = compute_rankings(word, vocab_list, vectors)
        if ranks.dtype != np.uint32 or len(ranks) != len(vocab_list):
            raise SystemExit(f"ABORT: bad rank array for game {game}")
        if vocab_list[int(np.argmin(ranks))] != word:
            raise SystemExit(f"ABORT: rank 1 is not the target for game {game}")
        np.savez_compressed(os.path.join(out_games, f"{game:04d}.npz"), ranks=ranks)
        if (offset + 1) % 250 == 0 or offset + 1 == needed:
            log(f"  {offset + 1}/{needed}")

    with open(os.path.join(args.out_dir, "target_words.json"), "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False)

    # Only total_games changes. start_date and vocab_size stay exactly as prod
    # has them, because both are load-bearing for existing games.
    new_meta = dict(meta)
    new_meta["total_games"] = args.target_total
    with open(os.path.join(args.out_dir, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(new_meta, f, ensure_ascii=False)

    manifest = {
        "today": today.isoformat(),
        "previous_total_games": total_games,
        "new_total_games": args.target_total,
        "appended": needed,
        "min_zipf_floor": args.min_zipf_floor,
        "appended_above_standard_bar": sum(
            1 for w in appended if zipf_frequency(w, "de") >= STANDARD_MIN_ZIPF
        ),
        "seed": args.seed,
        "first_new_game": total_games + 1,
        "last_new_game": args.target_total,
        "appended_words": appended,
    }
    with open(os.path.join(args.out_dir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    log("")
    log("=" * 64)
    log(f"Appended games {total_games + 1}..{args.target_total} ({needed} new)")
    log(f"  at or above Zipf {STANDARD_MIN_ZIPF}: {manifest['appended_above_standard_bar']}")
    log(f"  below it, down to {args.min_zipf_floor}: {needed - manifest['appended_above_standard_bar']}")
    log("=" * 64)
    log(f"Artifacts in {args.out_dir}:")
    log(f"  games/ ({needed} new npz), target_words.json, metadata.json, manifest.json")
    log("Nothing was uploaded. The upload runbook is in")
    log("  docs/plans/2026-09-20-mode-expansion-upload.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
