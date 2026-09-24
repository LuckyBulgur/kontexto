"""scripts/apply-pool.py: a new pool as a new order of existing rank arrays."""

import json
import os
import subprocess
import sys

import numpy as np
import pytest

SCRIPT = os.path.join(os.path.dirname(__file__), "..", "scripts", "apply-pool.py")
WORDS = ["apfel", "birne", "kirsche", "auto", "haus", "baum"]


@pytest.fixture
def deployed(tmp_path):
    data = tmp_path / "data"
    (data / "games").mkdir(parents=True)
    vocab = {w: i for i, w in enumerate(WORDS)}
    (data / "vocabulary.json").write_text(json.dumps(vocab), encoding="utf-8")
    (data / "target_words.json").write_text(json.dumps(WORDS), encoding="utf-8")
    meta = {"start_date": "2026-01-01", "total_games": len(WORDS), "first_curated_game": 2}
    (data / "metadata.json").write_text(json.dumps(meta), encoding="utf-8")
    (data / "core_words.json").write_text(json.dumps(WORDS), encoding="utf-8")
    for number, word in enumerate(WORDS, start=1):
        ranks = np.arange(2, len(WORDS) + 2, dtype=np.uint32)
        ranks[vocab[word]] = 1
        np.savez_compressed(data / "games" / f"{number:04d}.npz", ranks=ranks)
    return data


def run(data, out, pool, keep=2, today="2026-01-02"):
    pool_file = data.parent / "pool.txt"
    pool_file.write_text("# pool\n" + "\n".join(pool) + "\n", encoding="utf-8")
    return subprocess.run(
        [sys.executable, SCRIPT, "--data-dir", str(data), "--out-dir", str(out),
         "--keep-through", str(keep), "--pool", str(pool_file), "--today", today],
        capture_output=True, text=True,
    )


def test_played_games_keep_their_word_and_struck_words_are_gone(deployed, tmp_path):
    out = tmp_path / "out"
    result = run(deployed, out, ["kirsche", "haus", "baum"])
    assert result.returncode == 0, result.stdout + result.stderr
    targets = json.loads((out / "target_words.json").read_text(encoding="utf-8"))
    assert targets[:2] == ["apfel", "birne"]
    assert sorted(targets[2:]) == ["baum", "haus", "kirsche"]
    meta = json.loads((out / "metadata.json").read_text(encoding="utf-8"))
    assert meta["total_games"] == 5
    assert meta["first_curated_game"] == 3
    vocab = {w: i for i, w in enumerate(WORDS)}
    for number, word in enumerate(targets, start=1):
        with np.load(out / "games" / f"{number:04d}.npz") as arrays:
            assert arrays["ranks"][vocab[word]] == 1
    manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["struck"] == ["auto"]
    assert (out / "core_words.json").exists()


def test_a_word_without_an_array_is_refused(deployed, tmp_path):
    result = run(deployed, tmp_path / "out", ["kirsche", "zebra"])
    assert result.returncode != 0
    assert "no rank array" in result.stdout + result.stderr


def test_a_cutoff_before_today_is_refused(deployed, tmp_path):
    result = run(deployed, tmp_path / "out", ["kirsche"], keep=1, today="2026-01-03")
    assert result.returncode != 0
    assert "before today's game" in result.stdout + result.stderr
