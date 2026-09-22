"""Let the candidate embedding models compete on what this game actually asks.

Why a bench of its own
----------------------
Swapping the model means recomputing every game, which is half an hour per
candidate, so the comparison has to happen before that. Everything here runs
against a ``{word: vector}`` matrix over the core lexicon and needs neither the
backend nor the ``games/*.npz`` files.

The five measures, and what each one catches
--------------------------------------------
1. **Relatedness against a human gold standard.** SemEval-2017 Task 2, German
   monolingual, 500 word pairs scored by people. This is the published task for
   exactly the question the game asks, "how related are these two words", and
   the Spearman correlation is the headline number.
2. **The foothold.** For each solution, the best rank reachable from the 500
   most frequent core words, which is roughly what a player types before they
   have a direction. A model can have perfect neighbours and still be
   unplayable if nothing common points at the answer.
3. **String contamination.** The share of the ten nearest neighbours that merely
   share a long substring with the word. This is how a subword model fails:
   Model2Vec answers the word for fridge with wardrobe and cooling, which look
   related to an algorithm and absurd to a player.
4. **The polysemy trap.** For words with two readings, whether the neighbourhood
   belongs to the wrong one. The German word for law also reads as an adverb,
   and fastText returns rather, quite, very, which no player can climb.
5. **Playing it.** A simulated player walking the matrix, same rules as
   ``playtest-pool.py`` but offline, reported for concrete and abstract
   solutions apart, because that split is where the models differ.

Adding a model means adding one entry to ``MODELS``: a name and a callable that
returns ``{word: numpy vector}`` for the words it is given.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import random
import statistics
import sys

import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(HERE))

CACHE = ROOT / ".model-cache"
GOLD = CACHE / "gold" / "semeval-de-test.tsv"

#: Words with two readings, and the reading the game means. A model that puts
#: the other one in the neighbourhood makes the round unplayable.
POLYSEMY = {
    "recht": ("gesetz", "gericht", "anspruch"),
    "bank": ("geld", "konto", "sparkasse"),
    "schloss": ("burg", "palast", "tür"),
    "hahn": ("huhn", "wasser", "küche"),
    "gericht": ("richter", "urteil", "essen"),
    "ball": ("spiel", "werfen", "tanz"),
    "kiefer": ("baum", "zahn", "gesicht"),
}

PROBES = ["kühlschrank", "hund", "schmetterling", "erinnerung", "ordnung",
          "geheimnis", "erfolg", "vertrag", "fahrrad", "freiheit", "zwiebel",
          "gewitter", "krankenhaus", "musik", "angst", "brief"]


def load_core() -> list[str]:
    data = ROOT / ".regen-work" / "core-ship"
    return sorted(json.load(open(data / "core_words.json", encoding="utf-8")))


def load_concreteness() -> dict[str, float]:
    out: dict[str, float] = {}
    path = CACHE / "affective_norms.txt"
    for i, line in enumerate(open(path, encoding="utf-8")):
        if i == 0:
            continue
        parts = line.rstrip("\n").split("\t")
        if len(parts) > 1:
            try:
                out[parts[0].lower()] = float(parts[1])
            except ValueError:
                pass
    return out


def normalise(matrix: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return matrix / norms


def spearman(a: list[float], b: list[float]) -> float:
    def ranks(values: list[float]) -> np.ndarray:
        order = np.argsort(values)
        out = np.empty(len(values))
        out[order] = np.arange(len(values), dtype=float)
        return out
    ra, rb = ranks(a), ranks(b)
    ra -= ra.mean()
    rb -= rb.mean()
    denom = np.sqrt((ra ** 2).sum() * (rb ** 2).sum())
    return float((ra * rb).sum() / denom) if denom else 0.0


def gold_pairs() -> list[tuple[str, str, float]]:
    """The SemEval German pairs, lowercased and without the multiword entries.

    The published file keeps German capitalisation and holds a few phrases; the
    game only ever ranks single lowercase words, so those are what is compared.
    """
    out = []
    for line in open(GOLD, encoding="utf-8"):
        left, right, score = line.rstrip("\n").split("\t")
        if " " in left or " " in right:
            continue
        out.append((left.lower(), right.lower(), float(score)))
    return out


def gold_correlation(vectors) -> tuple[float, int]:
    """Spearman against the SemEval German pairs, on the pairs the model covers."""
    got, gold = [], []
    for left, right, score in gold_pairs():
        if left in vectors and right in vectors:
            a, b = vectors[left], vectors[right]
            denom = np.linalg.norm(a) * np.linalg.norm(b)
            if denom:
                got.append(float(a @ b / denom))
                gold.append(score)
    return (spearman(got, gold) if len(got) > 10 else float("nan")), len(got)


def shared_run(a: str, b: str, length: int = 4) -> bool:
    """Whether two words share a substring of at least ``length`` characters."""
    if len(a) < length or len(b) < length:
        return False
    grams = {a[i:i + length] for i in range(len(a) - length + 1)}
    return any(b[i:i + length] in grams for i in range(len(b) - length + 1))


def neighbours(matrix: np.ndarray, index: dict[str, int], words: list[str],
               word: str, count: int = 10) -> list[str]:
    sims = matrix @ matrix[index[word]]
    order = np.argsort(-sims)[:count + 1]
    return [words[i] for i in order if words[i] != word][:count]


#: What a player opens with, taken verbatim from scripts/playtest-pool.py:
#: everyday words spread across the space, the way a person starts a round.
OPENERS = [
    "haus", "wasser", "mensch", "tier", "stadt", "essen", "auto", "baum",
    "arbeit", "kind", "musik", "farbe", "körper", "maschine", "kleidung",
    "sport", "tisch", "papier", "wetter", "schule",
]
#: A guess a player would actually type, and the lower floor once the trail is
#: warm and they start naming things precisely.
GUESSABLE_MIN_ZIPF = 3.6
NEAR_MIN_ZIPF = 2.5


def play(matrix: np.ndarray, index: dict[str, int], words: list[str],
         target: str, budget: int, guessable: np.ndarray,
         near_guessable: np.ndarray) -> int:
    """The player from scripts/playtest-pool.py, run offline against a matrix.

    The rules are copied rather than reinvented, because a bench whose player
    differs from the one that measured the live pool cannot be compared with
    it. It opens with the fixed everyday words, then triangulates from its five
    best guesses weighted by 1/log(rank): chasing only the single best walks
    into a cluster of near synonyms and circles there.
    """
    sims = matrix @ matrix[index[target]]
    order = np.argsort(-sims)
    rank = np.empty(len(words), dtype=np.int32)
    rank[order] = np.arange(1, len(words) + 1)

    tried: set[str] = set()
    history: list[tuple[str, int]] = []
    best_word, best_rank = None, None
    for word in OPENERS:
        if word not in index:
            continue
        position = int(rank[index[word]])
        tried.add(word)
        history.append((word, position))
        if best_rank is None or position < best_rank:
            best_word, best_rank = word, position
        if position == 1:
            return len(tried)

    while best_rank != 1 and len(tried) < budget and best_word is not None:
        anchors = sorted(history, key=lambda h: h[1])[:5]
        direction = np.zeros(matrix.shape[1], dtype=np.float32)
        for word_at, rank_at in anchors:
            direction += matrix[index[word_at]] / float(np.log(rank_at + 2.0))
        norm = float(np.linalg.norm(direction))
        if norm < 1e-9:
            break
        similarity = matrix @ (direction / norm)
        similarity[~(near_guessable if best_rank <= 50 else guessable)] = -2.0
        for word in tried:
            similarity[index[word]] = -2.0
        pick = int(np.argmax(similarity))
        if similarity[pick] <= -1.0:
            break
        guess = words[pick]
        position = int(rank[pick])
        tried.add(guess)
        history.append((guess, position))
        if position < best_rank:
            best_word, best_rank = guess, position
        if position == 1:
            return len(tried)
    return budget + 1


def evaluate(name: str, embed, core: list[str], concreteness: dict[str, float],
             rounds: int, budget: int) -> dict:
    # One pass over everything the bench needs, so a model that fits a
    # transform (the debias) fits it on the whole lexicon and not on a subset.
    extra = sorted({w for a, b, _ in gold_pairs() for w in (a, b)} - set(core))
    vectors = embed(core + extra)
    words = [w for w in core if w in vectors]
    if len(words) < 1000:
        return {"model": name, "error": f"only {len(words)} of {len(core)} words covered"}
    matrix = normalise(np.vstack([vectors[w] for w in words]).astype(np.float32))
    index = {w: i for i, w in enumerate(words)}

    from wordfreq import zipf_frequency
    zipfs = np.array([zipf_frequency(w, "de") for w in words], dtype=np.float32)
    guessable = zipfs >= GUESSABLE_MIN_ZIPF
    near_guessable = zipfs >= NEAR_MIN_ZIPF
    # The foothold is what the opening words reach, not what the most frequent
    # words reach: the frequency top of the lexicon is particles and
    # conjunctions, and how close those sit to a noun says nothing about a
    # player. Measuring it that way once produced a confident wrong answer.
    opener_idx = np.array([index[w] for w in OPENERS if w in index])

    def foothold(word: str) -> int:
        sims = matrix @ matrix[index[word]]
        order = np.argsort(-sims)
        rank = np.empty(len(words), dtype=np.int32)
        rank[order] = np.arange(1, len(words) + 1)
        return int(rank[opener_idx].min())

    rng = random.Random(4711)
    concrete = [w for w in words if concreteness.get(w, 0) >= 6.5]
    abstract = [w for w in words if 0 < concreteness.get(w, 99) < 4.5]
    sample_c = rng.sample(concrete, min(rounds, len(concrete)))
    sample_a = rng.sample(abstract, min(rounds, len(abstract)))

    contamination = []
    for probe in PROBES:
        if probe in index:
            near = neighbours(matrix, index, words, probe, 10)
            contamination.append(sum(shared_run(probe, n) for n in near) / 10)

    traps = []
    for word, wanted in POLYSEMY.items():
        if word in index:
            near = set(neighbours(matrix, index, words, word, 25))
            traps.append(any(w in near for w in wanted))

    rho, covered = gold_correlation(vectors)
    played_c = [play(matrix, index, words, w, budget, guessable, near_guessable)
                for w in sample_c]
    played_a = [play(matrix, index, words, w, budget, guessable, near_guessable)
                for w in sample_a]

    return {
        "model": name,
        "words": len(words),
        "semeval_rho": round(rho, 3),
        "semeval_pairs": covered,
        "foothold_concrete": int(statistics.median(foothold(w) for w in sample_c)),
        "foothold_abstract": int(statistics.median(foothold(w) for w in sample_a)),
        "string_contamination": round(statistics.mean(contamination), 2) if contamination else None,
        "polysemy_hits": f"{sum(traps)}/{len(traps)}",
        "play_concrete_median": int(statistics.median(played_c)),
        "play_abstract_median": int(statistics.median(played_a)),
        "play_concrete_over80": round(100 * sum(1 for x in played_c if x > 80) / len(played_c), 1),
        "play_abstract_over80": round(100 * sum(1 for x in played_a if x > 80) / len(played_a), 1),
        "samples": {p: neighbours(matrix, index, words, p, 8) for p in PROBES[:6] if p in index},
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="compare embedding models for this game")
    parser.add_argument("--models", default="all", help="comma separated names, or all")
    parser.add_argument("--rounds", type=int, default=80)
    parser.add_argument("--budget", type=int, default=120)
    parser.add_argument("--out", default=str(ROOT / ".regen-work" / "benchmark.json"))
    args = parser.parse_args()

    import model_adapters

    core = load_core()
    concreteness = load_concreteness()
    wanted = (list(model_adapters.MODELS) if args.models == "all"
              else [n.strip() for n in args.models.split(",")])

    results = []
    for name in wanted:
        print(f"\n=== {name}", flush=True)
        try:
            result = evaluate(name, model_adapters.MODELS[name], core, concreteness,
                              args.rounds, args.budget)
        except Exception as error:  # a candidate that cannot load is a result too
            result = {"model": name, "error": f"{type(error).__name__}: {error}"}
        results.append(result)
        print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)
        json.dump(results, open(args.out, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=2)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
