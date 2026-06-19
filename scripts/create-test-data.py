"""Generate mock game data for local testing and E2E (no fastText needed).

Writes Kontexto data (vocabulary, bloom filter, lemma map, target words,
per-game rank arrays) plus a minimal Wordle dataset. Output defaults to
`../data`; pass `--output <dir>` to write an isolated set (e.g. `data-e2e`)
without clobbering a working local dataset.

Determinism: the RNG is seeded, and the Wordle solution list holds a single
word, so the daily Wordle answer is always known to E2E tests
(`solutions[game_number % 1]`). The Kontexto target of the day is discovered by
tests via `/api/reveal`, so its exact value does not need to be pinned here.
"""

import argparse
import json
import os
import pickle
import random

import numpy as np
from pybloom_live import BloomFilter
import simplemma

WORDS = [
    "apfel", "birne", "kirsche", "banane", "orange", "zitrone", "traube", "melone",
    "himbeere", "erdbeere", "auto", "fahrrad", "bus", "zug", "flugzeug", "schiff",
    "haus", "wohnung", "garten", "fenster", "tür", "dach", "wand", "treppe",
    "hund", "katze", "vogel", "fisch", "pferd", "kuh", "schwein", "huhn",
    "baum", "blume", "gras", "wald", "berg", "see", "fluss", "meer",
    "sonne", "mond", "stern", "wolke", "regen", "schnee", "wind", "sturm",
    "buch", "stift", "papier", "tisch", "stuhl", "lampe", "bild", "uhr",
    "brot", "käse", "milch", "wasser", "kaffee", "tee", "saft", "bier",
    "stadt", "dorf", "straße", "brücke", "kirche", "schule", "markt", "platz",
    "musik", "lied", "tanz", "film", "spiel", "sport", "kunst", "farbe",
    "freund", "kind", "frau", "mann", "familie", "lehrer", "arzt", "koch",
    "arbeit", "geld", "zeit", "leben", "liebe", "glück", "kraft", "ruhe",
    "feuer", "erde", "luft", "licht", "nacht", "tag", "morgen", "abend",
    "hand", "auge", "herz", "kopf", "fuß", "arm", "bein", "mund",
    "rot", "blau", "grün", "gelb", "weiß", "schwarz", "braun", "rosa",
    "groß", "klein", "schnell", "langsam", "warm", "kalt", "hell", "dunkel",
    "neu", "alt", "jung", "stark", "laut", "leise", "süß", "sauer",
    "schön", "gut", "schlecht", "richtig", "falsch", "wichtig", "einfach", "schwer",
]

# Five-letter German words for the Wordle mock. `WORDLE_SOLUTIONS` holds a single
# entry on purpose so the daily answer is deterministic for E2E
# (`solutions[game_number % 1]` is always "feuer").
WORDLE_VALID = [
    "feuer", "regen", "stuhl", "tisch", "milch", "katze", "blume", "vogel",
    "apfel", "birne", "mauer", "segel", "tafel", "wagen", "woche", "sonne",
    "licht", "nacht", "leben",
]
WORDLE_SOLUTIONS = ["feuer"]


def build_kontexto(output: str) -> None:
    os.makedirs(os.path.join(output, "games"), exist_ok=True)

    vocab = {w: i for i, w in enumerate(WORDS)}
    with open(os.path.join(output, "vocabulary.json"), "w", encoding="utf-8") as f:
        json.dump(vocab, f, ensure_ascii=False, indent=2)

    # BloomFilter is serialized with pickle - this is required by the pybloom_live library
    bf = BloomFilter(capacity=len(WORDS) * 3, error_rate=0.001)
    lemma_map = {}
    for w in WORDS:
        bf.add(w)
        forms = simplemma.text_lemmatizer(w, lang="de")
        for form in forms:
            if form != w:
                lemma_map[form] = w
                bf.add(form)

    with open(os.path.join(output, "bloom.bin"), "wb") as f:
        pickle.dump(bf, f)

    with open(os.path.join(output, "lemma_map.json"), "w", encoding="utf-8") as f:
        json.dump(lemma_map, f, ensure_ascii=False, indent=2)

    targets = random.sample(WORDS[:40], min(10, len(WORDS)))
    with open(os.path.join(output, "target_words.json"), "w", encoding="utf-8") as f:
        json.dump(targets, f, ensure_ascii=False)

    metadata = {"start_date": "2026-03-01", "vocab_size": len(WORDS)}
    with open(os.path.join(output, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    for i, target in enumerate(targets, 1):
        target_idx = vocab[target]
        ranks = np.zeros(len(WORDS), dtype=np.uint16)
        distances = np.array([abs(vocab[w] - target_idx) + random.random() for w in WORDS])
        order = np.argsort(distances)
        ranks[order] = np.arange(1, len(WORDS) + 1, dtype=np.uint16)
        np.savez_compressed(os.path.join(output, "games", f"{i:04d}.npz"), ranks=ranks)

    print(f"  Kontexto vocabulary: {len(WORDS)} words")
    print(f"  Kontexto games: {len(targets)}")
    print(f"  Kontexto targets: {targets}")


def build_wordle(output: str) -> None:
    wordle_dir = os.path.join(output, "wordle")
    os.makedirs(wordle_dir, exist_ok=True)
    with open(os.path.join(wordle_dir, "solutions.json"), "w", encoding="utf-8") as f:
        json.dump(WORDLE_SOLUTIONS, f, ensure_ascii=False)
    with open(os.path.join(wordle_dir, "valid_words.json"), "w", encoding="utf-8") as f:
        json.dump(WORDLE_VALID, f, ensure_ascii=False)
    print(f"  Wordle solutions: {len(WORDLE_SOLUTIONS)} (deterministic: {WORDLE_SOLUTIONS[0]})")
    print(f"  Wordle valid words: {len(WORDLE_VALID)}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    default_output = os.path.join(os.path.dirname(__file__), "..", "data")
    parser.add_argument(
        "--output", default=default_output,
        help="Target data directory (default: ../data). Use e.g. ../data-e2e for tests.",
    )
    parser.add_argument("--seed", type=int, default=42, help="RNG seed for reproducibility.")
    args = parser.parse_args()

    random.seed(args.seed)
    output = os.path.abspath(args.output)
    os.makedirs(output, exist_ok=True)

    build_kontexto(output)
    build_wordle(output)

    print(f"Test data created in {output}/")


if __name__ == "__main__":
    main()
