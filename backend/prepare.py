"""Offline preparation script for Kontexto game data."""

import re
import json
import os
import pickle
import random
import argparse
import numpy as np
from pybloom_live import BloomFilter
import simplemma

GERMAN_STOPWORDS = {
    # Artikel
    "der", "die", "das", "den", "dem", "des", "ein", "eine", "einer", "eines",
    "einem", "einen",
    # Konjunktionen
    "und", "oder", "dass",
    # Pronomen
    "ich", "du", "er", "sie", "es", "wir", "ihr", "mir", "dir", "ihm",
    "uns", "euch", "ihnen", "mich", "dich", "sich",
    # Präpositionen
    "von", "mit", "auf", "für", "aus", "bei", "nach", "zu", "an", "in",
    "um", "bis", "zum", "zur", "im", "am", "ans", "ins", "vom", "beim",
    # Hilfsverben
    "ist", "sind", "war", "hat", "bin",
    # Partikel
    "nicht",
}

# Words that should never be target words (but remain in vocabulary for guessing)
# Adverbs, particles, conjunctions, pronouns, function words
EXCLUDED_TARGET_WORDS = {
    # Adverbien / Partikel
    "auch", "noch", "schon", "nur", "sehr", "mehr", "ganz", "gar", "ja", "nein",
    "so", "da", "hier", "dort", "dann", "wann", "wo", "nun", "bereits", "etwa",
    "fast", "kaum", "eher", "wohl", "denn", "mal", "eben", "halt", "bloß",
    "doch", "aber", "zwar", "sogar", "allerdings", "jedoch", "dennoch", "trotzdem",
    "immer", "nie", "oft", "manchmal", "selten", "vielleicht", "wahrscheinlich",
    "natürlich", "sicherlich", "tatsächlich", "eigentlich", "übrigens", "jedenfalls",
    "anscheinend", "offenbar", "durchaus", "insofern", "inzwischen", "weiterhin",
    "zudem", "überdies", "ebenfalls", "ebenso", "deshalb", "deswegen", "daher",
    "also", "nämlich", "sowohl", "zumindest", "wenigstens", "jetzt", "heute",
    "gestern", "morgen", "bald", "gerade", "vorher", "nachher", "oben", "unten",
    "vorn", "hinten", "rechts", "links", "außen", "innen", "überall", "nirgends",
    "irgendwo", "damals", "seither", "seitdem", "dabei", "dazu",
    "davon", "dafür", "dagegen", "darauf", "darin", "daraus", "damit", "danach",
    "daneben", "darunter", "darüber", "davor", "dazwischen", "hierher", "dorthin",
    # Konjunktionen
    "wenn", "weil", "obwohl", "während", "als", "wie", "ob", "falls", "damit",
    "sondern", "bevor", "nachdem", "sobald", "solange", "sofern", "indem",
    # Pronomen / Determiners
    "diese", "dieser", "dieses", "diesem", "diesen", "jede", "jeder", "jedes",
    "jedem", "jeden", "alle", "alles", "allem", "allen", "aller", "man",
    "kein", "keine", "keiner", "keines", "keinem", "keinen",
    "mein", "dein", "sein", "unser", "euer",
    "was", "wer", "wen", "wem", "welch", "welche", "welcher", "welches",
    "etwas", "nichts", "jemand", "niemand", "irgendwas", "irgendwer",
    # Hilfs-/Modalverben
    "haben", "sein", "werden", "können", "müssen", "sollen", "wollen",
    "dürfen", "mögen", "wurde", "würde", "hätte", "wäre",
    # Sonstige Funktionswörter
    "viel", "viele", "wenig", "wenige", "andere", "anderer", "anderes",
    "anderem", "anderen", "einige", "einiger", "einiges", "einigem", "einigen",
    "mehrere", "mehrerer", "mehreres", "mehrerem", "mehreren",
    "selbst", "selber", "zusammen", "allein", "gegenseitig",
}

_ALPHA_RE = re.compile(r"^[a-zäöüß]+$")


def filter_vocabulary(words: dict[str, np.ndarray], min_length: int = 2, max_length: int = 25, vocab_size: int = 0) -> tuple[dict[str, np.ndarray], list[str]]:
    filtered: dict[str, np.ndarray] = {}
    frequency_order: list[str] = []
    for word, vec in words.items():
        w = word.lower()
        if len(w) < min_length or len(w) > max_length:
            continue
        if not _ALPHA_RE.match(w):
            continue
        if w in GERMAN_STOPWORDS:
            continue
        if not simplemma.is_known(w, lang="de"):
            continue
        if w not in filtered:
            filtered[w] = vec
            frequency_order.append(w)
        if vocab_size > 0 and len(filtered) >= vocab_size:
            break
    return filtered, frequency_order


def postprocess_vectors(vectors: dict[str, np.ndarray], n_components: int = 3) -> dict[str, np.ndarray]:
    """Remove mean and top principal components from vectors (All-but-the-Top)."""
    words = list(vectors.keys())
    mat = np.array([vectors[w] for w in words], dtype=np.float32)
    mean = mat.mean(axis=0)
    mat -= mean
    u, s, vt = np.linalg.svd(mat, full_matrices=False)
    top = vt[:n_components]
    mat -= mat @ top.T @ top
    return {w: mat[i] for i, w in enumerate(words)}


def compute_rankings(target_word: str, vocab_list: list[str], vectors: dict[str, np.ndarray]) -> np.ndarray:
    target_vec = vectors[target_word]
    target_norm = target_vec / np.linalg.norm(target_vec)
    mat = np.array([vectors[w] for w in vocab_list], dtype=np.float32)
    norms = np.linalg.norm(mat, axis=1, keepdims=True)
    norms = np.maximum(norms, 1e-10)
    mat_normed = mat / norms
    similarities = mat_normed @ target_norm.astype(np.float32)
    order = np.argsort(-similarities)
    ranks = np.empty(len(vocab_list), dtype=np.uint32)
    ranks[order] = np.arange(1, len(vocab_list) + 1, dtype=np.uint32)
    return ranks


def create_bloom_filter(words: list[str], error_rate: float = 0.001) -> BloomFilter:
    bf = BloomFilter(capacity=len(words), error_rate=error_rate)
    for w in words:
        bf.add(w)
    return bf


def create_lemma_map(vocab: list[str]) -> dict[str, str]:
    vocab_set = set(vocab)
    lemma_map: dict[str, str] = {}
    for word in vocab:
        lemma = simplemma.lemmatize(word, lang="de").lower()
        if lemma != word and lemma in vocab_set:
            lemma_map[word] = lemma
    return lemma_map


def load_fasttext_vectors(path: str) -> tuple[dict[str, np.ndarray], set[str]]:
    if path.endswith(".bin"):
        import fasttext
        model = fasttext.load_model(path)
        words = model.get_words()
        raw_words = set(words)
        return {w: model.get_word_vector(w) for w in words}, raw_words
    else:
        vectors: dict[str, np.ndarray] = {}
        raw_words: set[str] = set()
        with open(path, "r", encoding="utf-8") as f:
            f.readline()
            for line in f:
                parts = line.rstrip().split(" ")
                word = parts[0]
                raw_words.add(word)
                vec = np.array([float(x) for x in parts[1:]], dtype=np.float32)
                vectors[word] = vec
        return vectors, raw_words


def select_target_words(vocab: list[str], vectors: dict[str, np.ndarray], n: int = 2000, frequency_order: list[str] | None = None) -> list[str]:
    candidates = set()
    for w in vocab:
        if len(w) < 3 or len(w) > 15:
            continue
        if w not in vectors:
            continue
        if w in EXCLUDED_TARGET_WORDS:
            continue
        # Only allow base forms as targets (skip inflected forms)
        lemma = simplemma.lemmatize(w, lang="de")
        if lemma.lower() != w:
            continue
        candidates.add(w)
    # Select the most frequent candidates, then shuffle for varied difficulty
    if frequency_order is not None:
        ordered = [w for w in frequency_order if w in candidates]
    else:
        ordered = list(candidates)
    # Take top N by frequency, then shuffle so difficulty varies day to day
    ordered = ordered[:n]
    rng = random.Random(42)
    rng.shuffle(ordered)
    return ordered


def run_pipeline(output_dir: str, num_games: int, fasttext_path: str, start_date: str, vocab_size: int = 100000) -> None:
    print(f"Loading vectors from {fasttext_path}...")
    raw_vectors, raw_words = load_fasttext_vectors(fasttext_path)
    print(f"  Loaded {len(raw_vectors)} raw vectors.")

    print("Filtering vocabulary...")
    filtered, frequency_order = filter_vocabulary(raw_vectors, vocab_size=vocab_size)
    vocab_list = sorted(filtered.keys())
    vocab_index = {w: i for i, w in enumerate(vocab_list)}
    print(f"  Filtered to {len(vocab_list)} words (max {vocab_size}).")

    print("Post-processing vectors (All-but-the-Top)...")
    filtered = postprocess_vectors(filtered)
    print(f"  Removed mean and top 3 principal components.")

    print("Selecting target words (frequent words)...")
    targets = select_target_words(vocab_list, filtered, n=min(num_games * 2, len(vocab_list)), frequency_order=frequency_order)
    if len(targets) < num_games:
        raise ValueError(f"Not enough target words ({len(targets)}) for {num_games} games.")
    targets = targets[:num_games]
    print(f"  Selected {len(targets)} target words.")

    print("Creating lemma map...")
    lemma_map = create_lemma_map(vocab_list)
    print(f"  Mapped {len(lemma_map)} inflected forms.")

    print("Creating bloom filter...")
    all_known_words = set(vocab_list) | set(lemma_map.keys()) | GERMAN_STOPWORDS
    bf = create_bloom_filter(list(all_known_words))

    os.makedirs(output_dir, exist_ok=True)
    games_dir = os.path.join(output_dir, "games")
    os.makedirs(games_dir, exist_ok=True)

    with open(os.path.join(output_dir, "vocabulary.json"), "w", encoding="utf-8") as f:
        json.dump(vocab_index, f, ensure_ascii=False)
    with open(os.path.join(output_dir, "lemma_map.json"), "w", encoding="utf-8") as f:
        json.dump(lemma_map, f, ensure_ascii=False)
    with open(os.path.join(output_dir, "bloom.bin"), "wb") as f:
        pickle.dump(bf, f)
    with open(os.path.join(output_dir, "target_words.json"), "w", encoding="utf-8") as f:
        json.dump(targets, f, ensure_ascii=False)
    metadata = {"start_date": start_date, "total_games": num_games, "vocab_size": len(vocab_list)}
    with open(os.path.join(output_dir, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)

    print(f"Computing rankings for {num_games} games...")
    for i, target in enumerate(targets, start=1):
        ranks = compute_rankings(target, vocab_list, filtered)
        np.savez_compressed(os.path.join(games_dir, f"{i:04d}.npz"), ranks=ranks)
        if i % 50 == 0 or i == num_games:
            print(f"  {i}/{num_games} games computed.")
    print(f"Done! Output written to {output_dir}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Prepare Kontexto game data")
    parser.add_argument("--fasttext", default="cc.de.300.bin", help="Path to fastText model file")
    parser.add_argument("--output", default="data", help="Output directory")
    parser.add_argument("--games", type=int, default=3000, help="Number of games to generate")
    parser.add_argument("--start-date", default="2026-03-06", help="Start date (YYYY-MM-DD)")
    parser.add_argument("--vocab-size", type=int, default=100000, help="Max vocabulary size")
    args = parser.parse_args()
    run_pipeline(output_dir=args.output, num_games=args.games, fasttext_path=args.fasttext, start_date=args.start_date, vocab_size=args.vocab_size)
