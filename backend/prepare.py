"""Offline preparation script for Kontexto game data."""

import re
import json
import os
import pickle
import random
import argparse
from collections import defaultdict
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
    # Präpositionen, die einen obskuren Nomen-Homograph haben und sonst
    # durchrutschen (z. B. „Unter" = Spielkarte); überwiegend Funktionswörter.
    "unter", "gegen", "trotz",
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


def vocab_word_ok(w: str, min_length: int = 2, max_length: int = 25) -> bool:
    """Whether a lowercased token belongs in the guessable vocabulary.

    The single source of truth for vocabulary membership: a German word of the
    right length, all-alphabetic (incl. umlauts/ß), not a stopword, and known to
    simplemma. Shared by ``filter_vocabulary`` and the streaming loader used by
    the future-game regeneration tool, so both reproduce the same vocabulary.
    """
    if len(w) < min_length or len(w) > max_length:
        return False
    if not _ALPHA_RE.match(w):
        return False
    if w in GERMAN_STOPWORDS:
        return False
    if not simplemma.is_known(w, lang="de"):
        return False
    return True


def filter_vocabulary(words: dict[str, np.ndarray], min_length: int = 2, max_length: int = 25, vocab_size: int = 0) -> tuple[dict[str, np.ndarray], list[str]]:
    filtered: dict[str, np.ndarray] = {}
    frequency_order: list[str] = []
    for word, vec in words.items():
        w = word.lower()
        if not vocab_word_ok(w, min_length, max_length):
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


def orthographic_twins(vocab: list[str]) -> set[str]:
    """Vocabulary words that share their ß→ss-folded form with a *different* word.

    A German web corpus keeps both spellings of pre-1996-reform doublets
    (``anläßlich``/``anlässlich``), and ß/ss also forms genuine minimal pairs
    (``Maße``/``Masse``). Either way, a *solution* word with such a near-twin in
    the guessable vocabulary is unfair: a player can type the twin, be certain
    they are right, and still not win, because it is a separate ranked entry
    (this happened with the solution ``anlässlich`` while ``anläßlich`` sat at
    rank 2). Such words are therefore dropped from the target pool — they remain
    fully guessable. Runtime ß↔ss folding is deliberately avoided, because it
    would wrongly merge the genuine minimal pairs.
    """
    groups: dict[str, list[str]] = defaultdict(list)
    for w in vocab:
        groups[w.replace("ß", "ss")].append(w)
    return {w for members in groups.values() if len(members) > 1 for w in members}


def select_target_words(
    vocab: list[str],
    vectors: dict[str, np.ndarray],
    n: int = 2000,
    frequency_order: list[str] | None = None,
    target_filter: "TargetWordFilter | None" = None,
    min_solution_zipf: float = 4.0,
) -> list[str]:
    """Pick the *n* most frequent words that are sensible German solutions.

    Candidates are walked in descending frequency and kept only if they pass the
    semantic :class:`TargetWordFilter` (a guessable German content word — common
    noun, verb or adjective — never a proper noun, foreign or religious word, or
    fragment) *and* are common enough that essentially everyone knows them
    (German Zipf frequency ≥ ``min_solution_zipf``; 4.0 ≈ a few per million).
    The top *n* survivors are then shuffled so daily difficulty varies.
    """
    if target_filter is None:
        from target_selection import TargetWordFilter

        target_filter = TargetWordFilter()
    from wordfreq import zipf_frequency

    vocab_set = set(vocab)
    # Words with a ß/ss orthographic twin in the vocabulary are unfair solutions.
    twins = orthographic_twins(vocab)
    source = frequency_order if frequency_order is not None else vocab
    seen: set[str] = set()
    ordered: list[str] = []
    for w in source:
        if w in seen or w not in vocab_set:
            continue
        if len(w) < 3 or len(w) > 15 or w not in vectors:
            continue
        if w in EXCLUDED_TARGET_WORDS:
            continue
        if w in twins:
            continue
        # Common enough that virtually everyone knows the word.
        if zipf_frequency(w, "de") < min_solution_zipf:
            continue
        # Only allow base forms as targets (skip inflected forms).
        if simplemma.lemmatize(w, lang="de").lower() != w:
            continue
        if not target_filter.is_valid_target(w):
            continue
        seen.add(w)
        ordered.append(w)
        if len(ordered) >= n:
            break
    # Shuffle the frequency-bounded pool so difficulty varies day to day.
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
