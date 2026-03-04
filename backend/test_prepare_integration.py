import json
import os
import tempfile
import numpy as np
from unittest.mock import patch
from prepare import run_pipeline


def _make_fake_vectors(n_words=100, dim=10):
    np.random.seed(42)
    base_words = [
        "hund", "katze", "maus", "schule", "wasser", "haus", "baum", "auto",
        "stadt", "land", "berg", "fluss", "tisch", "stuhl", "buch", "bild",
        "kind", "mann", "frau", "tier", "vogel", "fisch", "blume", "sonne",
        "mond", "stern", "wolke", "regen", "schnee", "wind", "feuer",
        "erde", "luft", "licht", "zeit", "weg", "fenster", "garten",
        "straße", "turm", "kirche", "markt", "platz", "wald", "wiese", "feld", "see",
    ]
    extra = ["der", "die", "und", "123abc", "a", "http://x.com"]
    all_words = base_words + extra
    return {w: np.random.rand(dim).astype(np.float32) for w in all_words[:n_words]}


def test_run_pipeline_creates_all_files():
    fake_vectors = _make_fake_vectors(n_words=53, dim=10)
    with tempfile.TemporaryDirectory() as tmpdir:
        with patch("prepare.load_fasttext_vectors", return_value=fake_vectors):
            run_pipeline(output_dir=tmpdir, num_games=3, fasttext_path="fake.bin", start_date="2026-03-04")
        assert os.path.isfile(os.path.join(tmpdir, "vocabulary.json"))
        assert os.path.isfile(os.path.join(tmpdir, "lemma_map.json"))
        assert os.path.isfile(os.path.join(tmpdir, "bloom.bin"))
        assert os.path.isfile(os.path.join(tmpdir, "metadata.json"))
        assert os.path.isdir(os.path.join(tmpdir, "games"))
        for i in range(1, 4):
            assert os.path.isfile(os.path.join(tmpdir, "games", f"{i:04d}.npz"))


def test_run_pipeline_vocabulary_is_filtered():
    fake_vectors = _make_fake_vectors(n_words=53, dim=10)
    with tempfile.TemporaryDirectory() as tmpdir:
        with patch("prepare.load_fasttext_vectors", return_value=fake_vectors):
            run_pipeline(output_dir=tmpdir, num_games=1, fasttext_path="fake.bin", start_date="2026-03-04")
        with open(os.path.join(tmpdir, "vocabulary.json")) as f:
            vocab = json.load(f)
        assert "der" not in vocab
        assert "die" not in vocab
        assert "und" not in vocab
        assert "123abc" not in vocab
        assert "a" not in vocab
        assert "hund" in vocab


def test_run_pipeline_game_ranks_are_valid():
    fake_vectors = _make_fake_vectors(n_words=53, dim=10)
    with tempfile.TemporaryDirectory() as tmpdir:
        with patch("prepare.load_fasttext_vectors", return_value=fake_vectors):
            run_pipeline(output_dir=tmpdir, num_games=1, fasttext_path="fake.bin", start_date="2026-03-04")
        with open(os.path.join(tmpdir, "vocabulary.json")) as f:
            vocab = json.load(f)
        n_words = len(vocab)
        data = np.load(os.path.join(tmpdir, "games", "0001.npz"))
        ranks = data["ranks"]
        assert ranks.dtype == np.uint16
        assert len(ranks) == n_words
        assert ranks.min() == 1
        assert ranks.max() == n_words
        assert len(set(ranks.tolist())) == n_words
