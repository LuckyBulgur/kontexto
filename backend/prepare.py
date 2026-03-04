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
    "der", "die", "das", "den", "dem", "des", "ein", "eine", "einer", "eines",
    "einem", "einen", "und", "oder", "aber", "doch", "wenn", "weil", "dass",
    "als", "wie", "auch", "noch", "schon", "nur", "nicht", "kein", "keine",
    "keiner", "keines", "keinem", "keinen", "ich", "du", "er", "sie", "es",
    "wir", "ihr", "sie", "mir", "dir", "ihm", "uns", "euch", "ihnen",
    "mein", "dein", "sein", "unser", "euer", "mich", "dich", "sich",
    "von", "mit", "auf", "für", "aus", "bei", "nach", "seit", "vor",
    "bis", "durch", "gegen", "ohne", "um", "über", "unter", "zwischen",
    "neben", "hinter", "ist", "sind", "war", "waren", "hat", "haben",
    "wird", "werden", "kann", "können", "muss", "müssen", "soll", "sollen",
    "will", "wollen", "darf", "dürfen", "mag", "mögen", "wurde", "würde",
    "hätte", "wäre", "zum", "zur", "im", "am", "ans", "ins", "vom",
    "beim", "aufs", "fürs", "ums", "übers", "unters", "so", "da", "hier",
    "dort", "dann", "wann", "wo", "was", "wer", "wen", "wem", "welch",
    "diese", "dieser", "dieses", "diesem", "diesen", "jede", "jeder",
    "jedes", "jedem", "jeden", "alle", "alles", "allem", "allen", "aller",
    "man", "mehr", "sehr", "viel", "viele", "ganz", "gar", "ja", "nein",
    "zu", "an", "ab", "in",
}

_ALPHA_RE = re.compile(r"^[a-zäöüß]+$")


def filter_vocabulary(words: dict[str, np.ndarray], min_length: int = 2) -> dict[str, np.ndarray]:
    filtered: dict[str, np.ndarray] = {}
    for word, vec in words.items():
        w = word.lower()
        if len(w) < min_length:
            continue
        if not _ALPHA_RE.match(w):
            continue
        if w in GERMAN_STOPWORDS:
            continue
        if w not in filtered:
            filtered[w] = vec
    return filtered


def compute_rankings(target_word: str, vocab_list: list[str], vectors: dict[str, np.ndarray]) -> np.ndarray:
    target_vec = vectors[target_word]
    target_norm = target_vec / np.linalg.norm(target_vec)
    mat = np.array([vectors[w] for w in vocab_list], dtype=np.float32)
    norms = np.linalg.norm(mat, axis=1, keepdims=True)
    norms = np.maximum(norms, 1e-10)
    mat_normed = mat / norms
    similarities = mat_normed @ target_norm.astype(np.float32)
    order = np.argsort(-similarities)
    ranks = np.empty(len(vocab_list), dtype=np.uint16)
    ranks[order] = np.arange(1, len(vocab_list) + 1, dtype=np.uint16)
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
        lemma = simplemma.lemmatize(word, lang="de")
        if lemma != word and lemma in vocab_set:
            lemma_map[word] = lemma
    return lemma_map


def load_fasttext_vectors(path: str) -> dict[str, np.ndarray]:
    if path.endswith(".bin"):
        import fasttext
        model = fasttext.load_model(path)
        words = model.get_words()
        return {w: model.get_word_vector(w) for w in words}
    else:
        vectors: dict[str, np.ndarray] = {}
        with open(path, "r", encoding="utf-8") as f:
            f.readline()
            for line in f:
                parts = line.rstrip().split(" ")
                word = parts[0]
                vec = np.array([float(x) for x in parts[1:]], dtype=np.float32)
                vectors[word] = vec
        return vectors


def select_target_words(vocab: list[str], vectors: dict[str, np.ndarray], n: int = 2000) -> list[str]:
    candidates = [w for w in vocab if 3 <= len(w) <= 15 and w in vectors]
    rng = random.Random(42)
    rng.shuffle(candidates)
    return candidates[:n]


def run_pipeline(output_dir: str, num_games: int, fasttext_path: str, start_date: str) -> None:
    print(f"Loading vectors from {fasttext_path}...")
    raw_vectors = load_fasttext_vectors(fasttext_path)
    print(f"  Loaded {len(raw_vectors)} raw vectors.")

    print("Filtering vocabulary...")
    filtered = filter_vocabulary(raw_vectors)
    vocab_list = sorted(filtered.keys())
    vocab_index = {w: i for i, w in enumerate(vocab_list)}
    print(f"  Filtered to {len(vocab_list)} words.")

    print("Selecting target words...")
    targets = select_target_words(vocab_list, filtered, n=min(num_games * 2, len(vocab_list)))
    if len(targets) < num_games:
        raise ValueError(f"Not enough target words ({len(targets)}) for {num_games} games.")
    targets = targets[:num_games]
    print(f"  Selected {len(targets)} target words.")

    print("Creating lemma map...")
    lemma_map = create_lemma_map(vocab_list)
    print(f"  Mapped {len(lemma_map)} inflected forms.")

    print("Creating bloom filter...")
    all_known_words = set(vocab_list) | set(lemma_map.keys())
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
    parser.add_argument("--games", type=int, default=1000, help="Number of games to generate")
    parser.add_argument("--start-date", default="2026-03-04", help="Start date (YYYY-MM-DD)")
    args = parser.parse_args()
    run_pipeline(output_dir=args.output, num_games=args.games, fasttext_path=args.fasttext, start_date=args.start_date)
