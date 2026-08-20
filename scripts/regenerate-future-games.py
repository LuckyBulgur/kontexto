#!/usr/bin/env python3
"""Surgically regenerate only the FUTURE Kontexto/Wördle solutions on production.

Background
----------
Two classes of solution must never appear:
  * offensive / FSK18 / insulting words (e.g. ``Arsch``), now blocked by
    ``target_selection.PROFANITY_BLOCKLIST``;
  * ß/ss orthographic twins (solution ``anlässlich`` while ``anläßlich`` sits at
    rank 2), now excluded by ``prepare.orthographic_twins`` /
    ``select_target_words``.

We must fix the live game pool WITHOUT disturbing games that have already been
played. Past and today's games stay byte-identical; only games strictly after
today are rewritten, and even then only the individual games whose solution is
actually bad. ``duels.db`` (analytics + duels) is never touched.

Why this is safe
----------------
``games/{NNNN}.npz`` stores ``ranks[i]`` = the rank of ``index_to_word[i]``,
positionally bound to ``vocabulary.json``. The vocabulary is built independently
of solution selection, so a filter change leaves ``vocabulary.json`` /
``lemma_map.json`` / ``bloom.bin`` untouched. We therefore keep those files and
prod's past npz, and only rewrite ``target_words.json`` plus the npz of the few
replaced future games, all computed against prod's exact vocabulary order.

This script is offline and deterministic. It verifies, before writing anything,
that it reproduces prod's vocabulary exactly and prod's past npz bit-for-bit
(the fidelity gate); a mismatch aborts. Run it against a local copy of prod's
data (pulled read-only) and the cached fastText ``.vec``; it writes only the
artifacts to upload.

Usage
-----
    python scripts/regenerate-future-games.py \
        --vec .model-cache/cc.de.300.vec \
        --prod-dir .regen-work/prod \
        --out-dir  .regen-work/out
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import date, timedelta

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "backend"))

from wordfreq import zipf_frequency  # noqa: E402

from prepare import (  # noqa: E402
    EXCLUDED_TARGET_WORDS,
    GERMAN_STOPWORDS,
    compute_rankings,
    orthographic_twins,
    postprocess_vectors,
    select_target_words,
    vocab_word_ok,
)
from target_selection import TargetWordFilter  # noqa: E402

# Wördle's daily series epoch, must match backend/wordle.py (WordleState.epoch).
WORDLE_EPOCH = date(2026, 3, 28)
# Looser frequency bar for Wördle solutions, must match scripts/prepare-wordle-data.py.
WORDLE_MIN_ZIPF = 3.0
# Every clean 5-letter word at zde>=3.0 is already a live Wördle solution, so
# replacements for the few offensive future answers must come from just below
# that bar. zde>=2.5 words are still recognisable, and Wördle answers are
# deducible from letter feedback regardless. We pick the most frequent first.
WORDLE_REPLACEMENT_MIN_ZIPF = 2.5
SOLUTION_MIN_ZIPF = 4.0  # Kontexto, must match prepare.select_target_words default
FIVE_LETTER = re.compile(r"^[a-z]{5}$")


def log(msg: str) -> None:
    print(msg, flush=True)


def load_json(path: str):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def stream_vocab_vectors(vec_path: str, vocab_size: int) -> tuple[dict[str, np.ndarray], list[str]]:
    """Reproduce prod's vocabulary + raw vectors from a fastText ``.vec`` file.

    Streams the file in frequency (file) order and keeps the first-seen cased
    variant of each lowercased word, exactly ``filter_vocabulary``'s semantics,
    but without loading all ~2M vectors into memory. Shares the membership
    predicate (``vocab_word_ok``) with ``filter_vocabulary`` so the result is
    identical; the caller still asserts equality against prod's vocabulary.json.
    """
    filtered: dict[str, np.ndarray] = {}
    frequency_order: list[str] = []
    with open(vec_path, "r", encoding="utf-8") as f:
        f.readline()  # header: "<count> <dim>"
        for line in f:
            parts = line.rstrip("\n").split(" ")
            w = parts[0].lower()
            if not vocab_word_ok(w):
                continue
            if w not in filtered:
                filtered[w] = np.asarray(parts[1:], dtype=np.float32)
                frequency_order.append(w)
            if len(filtered) >= vocab_size:
                break
    return filtered, frequency_order


def kontexto_game_number(today: date, start_date: date, total_games: int) -> int:
    """Today's Kontexto game number, mirrors GameState.get_game_number."""
    days = (today - start_date).days + 1
    return ((days - 1) % total_games) + 1


def fold(w: str) -> str:
    return w.replace("ß", "ss")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--vec", required=True, help="fastText .vec model (full file)")
    ap.add_argument("--prod-dir", required=True, help="local copy of prod /app/data (read-only)")
    ap.add_argument("--out-dir", required=True, help="where to write upload artifacts")
    ap.add_argument("--today", default=None, help="override today's date (YYYY-MM-DD); default: real today")
    ap.add_argument("--vocab-size", type=int, default=80000)
    ap.add_argument("--fidelity-games", type=int, default=12,
                    help="how many past games to verify bit-for-bit against prod npz")
    args = ap.parse_args()

    today = date.fromisoformat(args.today) if args.today else date.today()

    # ---- Load prod data ----------------------------------------------------
    meta = load_json(os.path.join(args.prod_dir, "metadata.json"))
    start_date = date.fromisoformat(meta["start_date"])
    total_games = int(meta["total_games"])
    prod_vocab = load_json(os.path.join(args.prod_dir, "vocabulary.json"))
    prod_targets = load_json(os.path.join(args.prod_dir, "target_words.json"))
    prod_wordle = load_json(os.path.join(args.prod_dir, "wordle", "solutions.json"))

    assert len(prod_targets) == total_games, "target_words length != total_games"
    assert int(meta["vocab_size"]) == len(prod_vocab) == args.vocab_size, "vocab_size mismatch"

    log(f"Prod: start_date={start_date} total_games={total_games} vocab={len(prod_vocab)}")
    log(f"Today: {today}")

    # ---- B1: reproduce prod vector space + vocab gate ----------------------
    log("Streaming vocabulary + vectors from .vec ...")
    filtered, _freq = stream_vocab_vectors(args.vec, args.vocab_size)
    vocab_list = sorted(filtered.keys())
    vocab_index = {w: i for i, w in enumerate(vocab_list)}
    if vocab_index != prod_vocab:
        a, b = set(vocab_index), set(prod_vocab)
        log(f"VOCAB MISMATCH: only_local={sorted(a-b)[:5]} only_prod={sorted(b-a)[:5]}")
        raise SystemExit("ABORT: reproduced vocabulary != prod vocabulary.json")
    log("  vocab gate OK (reproduced vocabulary == prod, byte-exact)")

    log("Post-processing vectors (All-but-the-Top, debias) ...")
    vectors = postprocess_vectors(filtered)

    # ---- B1: fidelity gate (recompute past npz, must match prod bit-for-bit)
    log(f"Fidelity gate: recomputing past games 1..{args.fidelity_games} ...")
    for game in range(1, args.fidelity_games + 1):
        npz_path = os.path.join(args.prod_dir, "games", f"{game:04d}.npz")
        if not os.path.exists(npz_path):
            raise SystemExit(f"ABORT: missing prod npz for fidelity gate: {npz_path}")
        mine = compute_rankings(prod_targets[game - 1], vocab_list, vectors)
        prod_ranks = np.load(npz_path)["ranks"]
        if not np.array_equal(mine, prod_ranks):
            diff = int(np.sum(mine != prod_ranks))
            raise SystemExit(f"ABORT: fidelity gate failed on game {game} ({diff} ranks differ)")
    log("  fidelity gate OK (past npz reproduced bit-for-bit)")

    # ---- Cutoffs -----------------------------------------------------------
    k_cutoff = kontexto_game_number(today, start_date, total_games)  # preserve games 1..k_cutoff
    w_today = (today - WORDLE_EPOCH).days                            # preserve wordle idx 0..w_today
    log(f"Kontexto cutoff: preserve games 1..{k_cutoff}, rewrite {k_cutoff + 1}..{total_games}")
    log(f"Wördle cutoff:   preserve indices 0..{w_today}, rewrite {w_today + 1}..{len(prod_wordle) - 1}")

    filt = TargetWordFilter()

    # ---- B2: merged Kontexto target list -----------------------------------
    twins = orthographic_twins(vocab_list)

    def is_bad_target(w: str) -> str | None:
        if w in twins:
            return "twin"
        reason = filt.reject_reason(w)
        if reason == "offensive":
            return "offensive"
        return None  # any other (pre-existing) reason is left alone for past parity

    log("Building clean replacement pool (this respects all existing gates) ...")
    clean_pool = select_target_words(
        vocab_list, vectors, n=10**9, frequency_order=_freq, target_filter=filt,
        min_solution_zipf=SOLUTION_MIN_ZIPF,
    )
    log(f"  clean pool size: {len(clean_pool)}")

    used = set(prod_targets)
    spare_iter = (w for w in clean_pool if w not in used)

    merged_targets = list(prod_targets)
    k_replacements = []  # (game_number, old, new, why)
    past_flagged = []    # (game_number, word, why), preserved, reported only
    for idx in range(total_games):
        game = idx + 1
        why = is_bad_target(prod_targets[idx])
        if why is None:
            continue
        if game <= k_cutoff:
            past_flagged.append((game, prod_targets[idx], why))
            continue
        new = next(spare_iter, None)
        if new is None:
            raise SystemExit("ABORT: ran out of clean replacement words for Kontexto")
        merged_targets[idx] = new
        used.add(new)
        k_replacements.append((game, prod_targets[idx], new, why))

    # ---- B3: Wördle splice -------------------------------------------------
    log("Building Wördle replacement spares (most frequent first, below the 3.0 bar) ...")
    w_used = set(prod_wordle)
    wordle_spares = sorted(
        (w for w in vocab_list
         if FIVE_LETTER.match(w)
         and w not in w_used
         and w not in GERMAN_STOPWORDS
         and w not in EXCLUDED_TARGET_WORDS
         and zipf_frequency(w, "de") >= WORDLE_REPLACEMENT_MIN_ZIPF
         and filt.is_valid_target(w)),
        key=lambda w: -zipf_frequency(w, "de"),
    )
    log(f"  Wördle spare words available: {len(wordle_spares)}")
    w_spare_iter = iter(wordle_spares)
    merged_wordle = list(prod_wordle)
    w_replacements = []      # (index, old, new)
    w_past_flagged = []      # (index, word), preserved
    for i, w in enumerate(prod_wordle):
        if filt.reject_reason(w) != "offensive":
            continue
        if i <= w_today:
            w_past_flagged.append((i, w))
            continue
        new = next(w_spare_iter, None)
        if new is None:
            raise SystemExit("ABORT: ran out of clean replacement words for Wördle")
        merged_wordle[i] = new
        w_used.add(new)
        w_replacements.append((i, w, new))

    # ---- B4: verification gate ---------------------------------------------
    log("Verification gate ...")
    # Past parity
    assert merged_targets[:k_cutoff] == prod_targets[:k_cutoff], "Kontexto past games changed!"
    assert merged_wordle[:w_today + 1] == prod_wordle[:w_today + 1], "Wördle past indices changed!"
    # Lengths
    assert len(merged_targets) == total_games, "Kontexto length changed"
    assert len(merged_wordle) == len(prod_wordle), "Wördle length changed"
    # No duplicates
    assert len(set(merged_targets)) == len(merged_targets), "duplicate Kontexto targets"
    # Future cleanliness
    for idx in range(k_cutoff, total_games):
        w = merged_targets[idx]
        assert w not in twins, f"future Kontexto target {w!r} still a ß/ss twin"
        assert filt.reject_reason(w) != "offensive", f"future Kontexto target {w!r} still offensive"
    for i in range(w_today + 1, len(merged_wordle)):
        w = merged_wordle[i]
        assert filt.reject_reason(w) != "offensive", f"future Wördle solution {w!r} still offensive"
    # Replaced npz integrity
    out_games = os.path.join(args.out_dir, "games")
    os.makedirs(out_games, exist_ok=True)
    for game, _old, new, _why in k_replacements:
        ranks = compute_rankings(new, vocab_list, vectors)
        assert ranks.dtype == np.uint32 and len(ranks) == len(vocab_list)
        assert vocab_list[int(np.argmin(ranks))] == new, f"rank-1 != target for game {game}"
        np.savez_compressed(os.path.join(out_games, f"{game:04d}.npz"), ranks=ranks)
    log("  verification gate OK")

    # ---- Write artifacts ---------------------------------------------------
    os.makedirs(os.path.join(args.out_dir, "wordle"), exist_ok=True)
    with open(os.path.join(args.out_dir, "target_words.json"), "w", encoding="utf-8") as f:
        json.dump(merged_targets, f, ensure_ascii=False)
    with open(os.path.join(args.out_dir, "wordle", "solutions.json"), "w", encoding="utf-8") as f:
        json.dump(merged_wordle, f, ensure_ascii=False)
    manifest = {
        "today": today.isoformat(),
        "kontexto_cutoff": k_cutoff,
        "wordle_cutoff_index": w_today,
        "kontexto_replaced_games": [g for g, *_ in k_replacements],
        "wordle_replaced_indices": [i for i, *_ in w_replacements],
        "kontexto_replacements": [{"game": g, "old": o, "new": n, "why": w} for g, o, n, w in k_replacements],
        "wordle_replacements": [{"index": i, "old": o, "new": n} for i, o, n in w_replacements],
        "kontexto_past_flagged": [{"game": g, "word": w, "why": y} for g, w, y in past_flagged],
        "wordle_past_flagged": [{"index": i, "word": w} for i, w in w_past_flagged],
    }
    with open(os.path.join(args.out_dir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    # ---- Audit summary -----------------------------------------------------
    log("")
    log("=" * 64)
    log(f"Kontexto: {len(k_replacements)} future games rewritten "
        f"(of {total_games - k_cutoff} future games)")
    for g, o, n, why in k_replacements:
        log(f"  game {g:4d}: {o!r} -> {n!r}   [{why}]")
    log(f"Wördle: {len(w_replacements)} future solutions rewritten")
    for i, o, n in w_replacements:
        log(f"  index {i:4d}: {o!r} -> {n!r}")
    if past_flagged or w_past_flagged:
        log("")
        log("PRESERVED past/today games that are flagged (NOT changed, per policy):")
        for g, w, why in past_flagged:
            log(f"  Kontexto game {g}: {w!r} [{why}]")
        for i, w in w_past_flagged:
            log(f"  Wördle index {i}: {w!r}")
    log("=" * 64)
    log(f"Artifacts written to {args.out_dir}")
    log(f"  target_words.json, wordle/solutions.json, manifest.json, "
        f"games/ ({len(k_replacements)} npz)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
