"""Tests for scripts/extend-game-pool.py.

The script's job is to add games without disturbing a running series, so the
tests are about exactly that: the prefix stays intact, nothing is duplicated,
only ``total_games`` moves in the metadata, and the gates refuse the cases that
would shift the daily schedule or write against a vocabulary that is not prod's.

The heavy parts (HanTa, the Wiktionary lexicon) are the real ones. A mocked
target filter would test the plumbing and none of the gates.
"""

import importlib.util
import json
import os
import sys
import tempfile
from datetime import date, timedelta

import numpy as np
import pytest

_HERE = os.path.dirname(os.path.abspath(__file__))
_SCRIPT = os.path.join(_HERE, "..", "scripts", "extend-game-pool.py")


def _load_script():
    spec = importlib.util.spec_from_file_location("extend_game_pool", _SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


extend = _load_script()

# Common German nouns, verbs and adjectives that the target filter accepts. The
# list is deliberately ordinary: the point is a pool with more candidates than
# the fixture uses, so the append has something to draw from.
WORDS = [
    "haus", "baum", "wasser", "strasse", "garten", "fenster", "wolke", "regen",
    "schnee", "wind", "feuer", "berg", "fluss", "wald", "wiese", "stadt",
    "dorf", "kirche", "markt", "brücke", "turm", "hafen", "schiff", "wagen",
    "brief", "buch", "bild", "tisch", "stuhl", "lampe", "teller", "messer",
    "hund", "katze", "vogel", "fisch", "pferd", "blume", "wurzel", "zweig",
    "sonne", "mond", "stern", "himmel", "insel", "küste", "welle", "sand",
    "brot", "milch", "zucker", "salz", "suppe", "kuchen", "apfel", "birne",
]


def _write_vec(path: str, words: list[str], dim: int = 24) -> None:
    """A fastText .vec file in the format stream_vocab_vectors expects."""
    rng = np.random.default_rng(7)
    with open(path, "w", encoding="utf-8") as f:
        f.write(f"{len(words)} {dim}\n")
        for word in words:
            vector = rng.normal(size=dim).astype(np.float32)
            f.write(word + " " + " ".join(f"{v:.6f}" for v in vector) + "\n")


def _build_prod(tmpdir: str, vec_path: str, targets: list[str], start_date: date) -> str:
    """A prod data directory the script can reproduce exactly.

    Built with the script's own reader on purpose: the vocab gate's job is to
    catch a *different* vocabulary, and a fixture that could not pass it would
    only ever test the abort path.
    """
    prod = os.path.join(tmpdir, "prod")
    os.makedirs(os.path.join(prod, "games"))

    filtered, _order = extend.stream_vocab_vectors(vec_path, 10**9)
    vocab_list = sorted(filtered)
    vectors = extend.postprocess_vectors(filtered)

    with open(os.path.join(prod, "vocabulary.json"), "w", encoding="utf-8") as f:
        json.dump({w: i for i, w in enumerate(vocab_list)}, f, ensure_ascii=False)
    with open(os.path.join(prod, "target_words.json"), "w", encoding="utf-8") as f:
        json.dump(targets, f, ensure_ascii=False)
    with open(os.path.join(prod, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(
            {
                "start_date": start_date.isoformat(),
                "total_games": len(targets),
                "vocab_size": len(vocab_list),
            },
            f,
        )
    for i, word in enumerate(targets, start=1):
        ranks = extend.compute_rankings(word, vocab_list, vectors)
        np.savez_compressed(os.path.join(prod, "games", f"{i:04d}.npz"), ranks=ranks)
    return prod


@pytest.fixture(scope="module")
def workspace():
    with tempfile.TemporaryDirectory() as tmpdir:
        vec_path = os.path.join(tmpdir, "model.vec")
        _write_vec(vec_path, WORDS)
        filtered, _ = extend.stream_vocab_vectors(vec_path, 10**9)
        yield {"dir": tmpdir, "vec": vec_path, "vocab_size": len(filtered)}


def _run(args: list[str]) -> int:
    argv = sys.argv
    sys.argv = ["extend-game-pool.py", *args]
    try:
        return extend.main()
    finally:
        sys.argv = argv


def _scenario(workspace, *, targets: list[str], today: date, start: date, out_name: str,
              target_total: int, extra: list[str] | None = None):
    case = os.path.join(workspace["dir"], out_name)
    os.makedirs(case, exist_ok=True)
    prod = _build_prod(case, workspace["vec"], targets, start)
    out = os.path.join(case, "out")
    args = [
        "--vec", workspace["vec"],
        "--prod-dir", prod,
        "--out-dir", out,
        "--target-total", str(target_total),
        "--vocab-size", str(workspace["vocab_size"]),
        "--fidelity-games", str(min(3, len(targets))),
        "--today", today.isoformat(),
        *(extra or []),
    ]
    return prod, out, args


class TestAppend:
    def test_appends_without_touching_the_existing_pool(self, workspace):
        start = date(2026, 3, 6)
        targets = WORDS[:4]
        prod, out, args = _scenario(
            workspace, targets=targets, today=start + timedelta(days=2), start=start,
            out_name="append", target_total=8,
        )
        assert _run(args) == 0

        merged = json.load(open(os.path.join(out, "target_words.json"), encoding="utf-8"))
        assert merged[:4] == targets, "the existing list must stay an exact prefix"
        assert len(merged) == 8
        assert len(set(merged)) == 8, "no solution may appear twice"

        new_meta = json.load(open(os.path.join(out, "metadata.json"), encoding="utf-8"))
        old_meta = json.load(open(os.path.join(prod, "metadata.json"), encoding="utf-8"))
        assert new_meta["total_games"] == 8
        assert new_meta["start_date"] == old_meta["start_date"]
        assert new_meta["vocab_size"] == old_meta["vocab_size"]

        # Only the new games are written, and each one ranks its own target first.
        written = sorted(os.listdir(os.path.join(out, "games")))
        assert written == ["0005.npz", "0006.npz", "0007.npz", "0008.npz"]
        vocab = json.load(open(os.path.join(prod, "vocabulary.json"), encoding="utf-8"))
        index_to_word = [""] * len(vocab)
        for word, i in vocab.items():
            index_to_word[i] = word
        for offset, name in enumerate(written):
            ranks = np.load(os.path.join(out, "games", name))["ranks"]
            assert index_to_word[int(np.argmin(ranks))] == merged[4 + offset]

    def test_the_manifest_records_what_was_appended(self, workspace):
        start = date(2026, 3, 6)
        _, out, args = _scenario(
            workspace, targets=WORDS[:4], today=start + timedelta(days=1), start=start,
            out_name="manifest", target_total=7,
        )
        assert _run(args) == 0
        manifest = json.load(open(os.path.join(out, "manifest.json"), encoding="utf-8"))
        assert manifest["previous_total_games"] == 4
        assert manifest["new_total_games"] == 7
        assert manifest["appended"] == 3
        assert manifest["first_new_game"] == 5
        assert manifest["last_new_game"] == 7
        assert len(manifest["appended_words"]) == 3

    def test_a_rerun_is_reproducible(self, workspace):
        start = date(2026, 3, 6)
        results = []
        for run_index in (1, 2):
            _, out, args = _scenario(
                workspace, targets=WORDS[:4], today=start, start=start,
                out_name=f"repeat{run_index}", target_total=7,
            )
            assert _run(args) == 0
            results.append(json.load(open(os.path.join(out, "target_words.json"), encoding="utf-8")))
        assert results[0] == results[1], "the same input must produce the same pool"


class TestGates:
    def test_refuses_once_the_daily_series_has_wrapped(self, workspace):
        """After a wrap, raising total_games moves every future daily word."""
        start = date(2026, 3, 6)
        _, _, args = _scenario(
            workspace, targets=WORDS[:4], today=start + timedelta(days=9), start=start,
            out_name="wrapped", target_total=8,
        )
        with pytest.raises(SystemExit) as exit_info:
            _run(args)
        assert "wrapped" in str(exit_info.value)

    def test_accepts_on_the_last_day_before_the_wrap(self, workspace):
        start = date(2026, 3, 6)
        # Day 4 of a pool of 4 is the last day that is still in the first pass.
        _, _, args = _scenario(
            workspace, targets=WORDS[:4], today=start + timedelta(days=3), start=start,
            out_name="edge", target_total=6,
        )
        assert _run(args) == 0

    def test_refuses_a_target_total_that_is_not_an_increase(self, workspace):
        start = date(2026, 3, 6)
        _, _, args = _scenario(
            workspace, targets=WORDS[:4], today=start, start=start,
            out_name="noop", target_total=4,
        )
        with pytest.raises(SystemExit) as exit_info:
            _run(args)
        assert "not larger" in str(exit_info.value)

    def test_refuses_a_vocabulary_that_is_not_prods(self, workspace):
        """The vocab gate is what makes appending safe: the rank arrays are bound
        to the vocabulary by position, so a different one silently corrupts every
        appended game."""
        start = date(2026, 3, 6)
        prod, _, args = _scenario(
            workspace, targets=WORDS[:4], today=start, start=start,
            out_name="badvocab", target_total=6,
        )
        vocab_path = os.path.join(prod, "vocabulary.json")
        vocab = json.load(open(vocab_path, encoding="utf-8"))
        removed = sorted(vocab)[0]
        del vocab[removed]
        with open(vocab_path, "w", encoding="utf-8") as f:
            json.dump(vocab, f, ensure_ascii=False)
        # vocab_size in the metadata still matches --vocab-size, so the run gets
        # past the cheap check and has to be stopped by the gate itself.
        with pytest.raises(SystemExit) as exit_info:
            _run(args)
        assert "vocab" in str(exit_info.value).lower()

    def test_refuses_when_an_existing_npz_does_not_reproduce(self, workspace):
        start = date(2026, 3, 6)
        prod, _, args = _scenario(
            workspace, targets=WORDS[:4], today=start, start=start,
            out_name="badnpz", target_total=6,
        )
        path = os.path.join(prod, "games", "0002.npz")
        ranks = np.load(path)["ranks"].copy()
        ranks[0], ranks[1] = ranks[1], ranks[0]
        np.savez_compressed(path, ranks=ranks)
        with pytest.raises(SystemExit) as exit_info:
            _run(args)
        assert "fidelity" in str(exit_info.value)

    def test_refuses_when_the_vocabulary_cannot_fill_the_pool(self, workspace):
        start = date(2026, 3, 6)
        _, _, args = _scenario(
            workspace, targets=WORDS[:4], today=start, start=start,
            out_name="toobig", target_total=5000,
        )
        with pytest.raises(SystemExit) as exit_info:
            _run(args)
        assert "clean unused words available" in str(exit_info.value)
