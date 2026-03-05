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
        candidates.add(w)
    # Prefer frequent words as targets: walk frequency_order and pick candidates
    if frequency_order is not None:
        ordered = [w for w in frequency_order if w in candidates]
    else:
        ordered = list(candidates)
    rng = random.Random(42)
    rng.shuffle(ordered)
    # Sort so most frequent come first, then shuffle within that constraint
    if frequency_order is not None:
        freq_rank = {w: i for i, w in enumerate(frequency_order)}
        ordered.sort(key=lambda w: freq_rank.get(w, len(frequency_order)))
    return ordered[:n]


def run_pipeline(output_dir: str, num_games: int, fasttext_path: str, start_date: str, vocab_size: int = 50000) -> None:
    print(f"Loading vectors from {fasttext_path}...")
    raw_vectors, raw_words = load_fasttext_vectors(fasttext_path)
    print(f"  Loaded {len(raw_vectors)} raw vectors.")

    print("Filtering vocabulary...")
    filtered, frequency_order = filter_vocabulary(raw_vectors, vocab_size=vocab_size)
    vocab_list = sorted(filtered.keys())
    vocab_index = {w: i for i, w in enumerate(vocab_list)}
    print(f"  Filtered to {len(vocab_list)} words (max {vocab_size}).")

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
    parser.add_argument("--games", type=int, default=3000, help="Number of games to generate")
    parser.add_argument("--start-date", default="2026-03-05", help="Start date (YYYY-MM-DD)")
    parser.add_argument("--vocab-size", type=int, default=50000, help="Max vocabulary size")
    args = parser.parse_args()
    run_pipeline(output_dir=args.output, num_games=args.games, fasttext_path=args.fasttext, start_date=args.start_date, vocab_size=args.vocab_size)
