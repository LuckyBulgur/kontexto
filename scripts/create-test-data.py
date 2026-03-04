"""Generate mock game data for local testing (no fastText needed)."""

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

def main():
    output = os.path.join(os.path.dirname(__file__), "..", "data")
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

    print(f"Test data created in {output}/")
    print(f"  Vocabulary: {len(WORDS)} words")
    print(f"  Games: {len(targets)}")
    print(f"  Targets: {targets}")

if __name__ == "__main__":
    main()
