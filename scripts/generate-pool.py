"""Generate the solution pool the way the original picks its answers.

What this reconstructs
----------------------
The archive of 1.461 Contexto answers gives away how that game selects. Sorted
into frequency bands of the English word list, its answers form a clear curve:

    rank      1-  500     11,8% of the band taken
    rank    500- 1000     17,4%      <- the peak
    rank   1000- 2000     17,2%
    rank   2000- 4000     11,6%
    rank   4000- 8000      7,8%
    rank   8000-16000      3,9%
    rank  16000-32000      1,3%
    rank  32000-64000      0,24%
    rank  64000+           0,008%

It peaks just past the thousand most frequent words and falls off
geometrically. It is not a frequency cut with a hard edge, and it is not
uniform over a vocabulary: it is a weighting. Everything the pool felt wrong
about followed from missing that. A hard cut at one Zipf value gave a pool
whose median frequency rank was 13.606 where the original sits at 5.889.

So this script reproduces the **shape**, not the threshold:

1. Collect every eligible German noun up to ``MAX_RANK`` using the project's
   own gates, which are unchanged: in the vocabulary, a common noun in its base
   form, no proper name, nothing on the profanity list, not an English loan
   that never settled, and not already refused by hand in
   ``solution_rejects.txt``.
2. Give every band the share of the pool the original gives it.
3. Inside a band, take the words with the best **foothold**, the best rank any
   of the twenty opening words reaches for that solution. That measure predicts
   real difficulty (Spearman 0,614 against 600 played rounds), so filling a
   band by foothold is what keeps the game easy while the band shape keeps it
   faithful.
4. Add back the words the player ruled on by hand
   (``solution_protected.txt``), which no automatic step may drop.

Both knobs are explicit: ``--size`` says how many puzzles are wanted and
``--max-foothold`` how hard the hardest of them may be. The script prints the
resulting profile next to the original's so the two can be compared.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys

import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(HERE))

DATA = ROOT / "backend" / "data"
#: Deepest rank the original still draws from, where its curve has all but
#: vanished. Beyond this it took 11 of 136.000 words.
MAX_RANK = 64_000
#: Measured on the 1.461 answers of the original: the share of each band it
#: takes. The numbers are relative weights, not absolute rates.
CONTEXTO_CURVE = [
    (1, 500, 59), (500, 1000, 87), (1000, 2000, 172), (2000, 4000, 232),
    (4000, 8000, 310), (8000, 16000, 309), (16000, 32000, 204), (32000, 64000, 77),
]


def read_word_file(path: pathlib.Path) -> set[str]:
    return {line.strip() for line in path.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.startswith("#")}


def read_rejects() -> set[str]:
    return {line.split("=")[0].strip()
            for line in (DATA / "solution_rejects.txt").read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.startswith("#") and "=" in line}


def eligible(data_dir: pathlib.Path, max_rank: int) -> list[tuple[str, int]]:
    """Every German noun the project's own gates accept, with its rank."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("gen", HERE / "build-solution-pool.py")
    gen = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gen)
    from wordfreq import top_n_list, zipf_frequency
    from HanTa import HanoverTagger as hnt
    from german_nouns.lookup import Nouns
    import target_selection as ts
    from wordlists import SOLUTION_BLOCKLIST

    vocabulary = set(json.load(open(data_dir / "vocabulary.json", encoding="utf-8")))
    refused = read_rejects() | {w.lower() for w in SOLUTION_BLOCKLIST}
    closed_class = read_word_file(gen.FUNCTION_WORDS_FILE)
    tagger = hnt.HanoverTagger("morphmodel_ger.pgz")
    dictionary = Nouns()
    word_filter = ts.TargetWordFilter(min_zipf_de=0.0, require_concrete=False)

    def is_noun(word: str) -> bool:
        if word in closed_class:
            return False
        try:
            entries = dictionary[word.capitalize()]
        except Exception:
            return False
        if not entries or not any(isinstance(e, dict) and str(e.get("lemma", "")).lower() == word
                                  for e in entries):
            return False
        tag = tagger.analyze(word.capitalize(), taglevel=1)
        if not tag or tag[1] != "NN" or str(tag[0]).lower() != word:
            return False
        lemma, pos = tagger.analyze(word, taglevel=1)
        if pos.startswith(("ADJ", "APPR", "VA", "PTK", "KO")):
            return False
        if pos.startswith("VV") and (pos == "VV(INF)" or str(lemma).lower() != word):
            return False
        return True

    out = []
    for rank, word in enumerate(top_n_list("de", max_rank), start=1):
        if word in refused or word not in vocabulary or not word.isalpha() or len(word) < 3:
            continue
        if zipf_frequency(word, "en") - zipf_frequency(word, "de") >= gen.FOREIGN_MARGIN:
            continue
        if not is_noun(word) or not word_filter.is_valid_target(word):
            continue
        out.append((word, rank))
    return out


def footholds(words: list[str], data_dir: pathlib.Path) -> dict[str, int]:
    """The best rank any opening word reaches, for every word given."""
    import model_adapters as ma
    import importlib.util
    spec = importlib.util.spec_from_file_location("bench", HERE / "benchmark-embeddings.py")
    bench = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bench)

    core = sorted(json.load(open(data_dir / "core_words.json", encoding="utf-8")))
    universe = sorted(set(core) | set(words))
    space = ma.fasttext(universe)
    have = [w for w in universe if w in space]
    index = {w: i for i, w in enumerate(have)}
    matrix = np.vstack([space[w] for w in have]).astype(np.float32)
    matrix /= np.maximum(np.linalg.norm(matrix, axis=1, keepdims=True), 1e-9)
    openers = np.array([index[w] for w in bench.OPENERS if w in index])

    out: dict[str, int] = {}
    for word in words:
        if word not in index:
            continue
        sims = matrix @ matrix[index[word]]
        order = np.argsort(-sims)
        rank = np.empty(len(have), dtype=np.int32)
        rank[order] = np.arange(1, len(have) + 1)
        out[word] = int(rank[openers].min())
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="generate the pool on the original's curve")
    parser.add_argument("--data-dir", default=str(ROOT / ".regen-work" / "core-v2"))
    parser.add_argument("--size", type=int, default=2700, help="puzzles wanted")
    parser.add_argument("--max-foothold", type=int, default=400,
                        help="how hard the hardest solution may be")
    parser.add_argument("--out", default=str(DATA / "solution_pool.txt"))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    data_dir = pathlib.Path(args.data_dir)

    pool_now = read_word_file(DATA / "solution_pool.txt")
    candidates = eligible(data_dir, MAX_RANK)
    # Words already in the pool stay candidates: they passed the reading pass,
    # and the curve decides how many of each band survive, not where they came
    # from.
    known = {w: r for w, r in candidates}
    from wordfreq import top_n_list
    ranking = {w: i + 1 for i, w in enumerate(top_n_list("de", 200_000))}
    for word in pool_now:
        if word not in known:
            known[word] = ranking.get(word, MAX_RANK)
    print(f"{len(known)} eligible words, {len(pool_now)} of them in today's pool")

    foot = footholds(sorted(known), data_dir)
    total_weight = sum(w for _, _, w in CONTEXTO_CURVE)
    protected = read_word_file(DATA / "solution_protected.txt")

    chosen: list[str] = []
    print(f"\n{'band':>16} {'wanted':>7} {'eligible':>9} {'taken':>6} {'median foothold':>16}")
    for lo, hi, weight in CONTEXTO_CURVE:
        want = round(args.size * weight / total_weight)
        band = [w for w, r in known.items() if lo <= r < hi and foot.get(w, 10 ** 9) <= args.max_foothold]
        band.sort(key=lambda w: foot[w])
        take = band[:want]
        chosen.extend(take)
        median = int(np.median([foot[w] for w in take])) if take else 0
        print(f"{lo:7d}-{hi:<8d} {want:7d} {len(band):9d} {len(take):6d} {median:16d}")

    final = sorted(set(chosen) | (protected & set(known)))
    print(f"\npool {len(final)} words, {len(final) - len(set(chosen))} added by the protected list")

    ranks = sorted(ranking.get(w, MAX_RANK) for w in final)
    print(f"median frequency rank {ranks[len(ranks) // 2]} (the original: 5.889)")
    print(f"p90 frequency rank    {ranks[int(0.9 * len(ranks))]} (the original: 24.699)")
    print(f"mean length           {sum(len(w) for w in final) / len(final):.1f} (the original: 6,0)")

    if args.dry_run:
        return 0
    target = pathlib.Path(args.out)
    # Keep whatever header the file already carries; a fresh file gets none,
    # because scripts/recode-pool.py writes the documented one.
    header = (target.read_text(encoding="utf-8").split("\n\n", 1)[0] + "\n\n"
              if target.exists() else "")
    target.write_text(header + "\n".join(final) + "\n", encoding="utf-8")
    print(f"written to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
