"""Tests for game logic."""

import json
import os
import pickle
import tempfile

import numpy as np
import pytest
from pybloom_live import BloomFilter

from game import GameState


@pytest.fixture
def data_dir():
    """Create a temporary data directory with all required files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        vocab = {"apfel": 0, "birne": 1, "kirsche": 2, "auto": 3, "haus": 4}
        with open(os.path.join(tmpdir, "vocabulary.json"), "w", encoding="utf-8") as f:
            json.dump(vocab, f)

        lemma_map = {"äpfel": "apfel", "häuser": "haus", "autos": "auto", "haus": "heim"}
        with open(os.path.join(tmpdir, "lemma_map.json"), "w", encoding="utf-8") as f:
            json.dump(lemma_map, f)

        bf = BloomFilter(capacity=100, error_rate=0.01)
        for w in list(vocab.keys()) + list(lemma_map.keys()):
            bf.add(w)
        with open(os.path.join(tmpdir, "bloom.bin"), "wb") as f:
            pickle.dump(bf, f)

        targets = ["apfel", "birne", "kirsche"]
        with open(os.path.join(tmpdir, "target_words.json"), "w", encoding="utf-8") as f:
            json.dump(targets, f)

        metadata = {"start_date": "2026-01-01", "vocab_size": 5, "total_games": 3}
        with open(os.path.join(tmpdir, "metadata.json"), "w", encoding="utf-8") as f:
            json.dump(metadata, f)

        games_dir = os.path.join(tmpdir, "games")
        os.makedirs(games_dir)

        ranks = np.array([1, 2, 3, 4, 5], dtype=np.uint16)
        np.savez_compressed(os.path.join(games_dir, "0001.npz"), ranks=ranks)

        yield tmpdir


@pytest.fixture
def gs(data_dir):
    """Create a GameState instance."""
    state = GameState(data_dir)
    state.load_game(1)
    return state


class TestGameStateInit:
    def test_vocabulary_loaded(self, gs):
        assert len(gs.vocabulary) == 5
        assert "apfel" in gs.vocabulary

    def test_index_to_word(self, gs):
        assert gs.index_to_word[0] == "apfel"
        assert gs.index_to_word[1] == "birne"

    def test_lemma_map_loaded(self, gs):
        assert gs.lemma_map["äpfel"] == "apfel"

    def test_metadata_loaded(self, gs):
        assert gs.metadata["vocab_size"] == 5


class TestNormalizeWord:
    def test_known_word(self, gs):
        assert gs.normalize_word("Apfel") == "apfel"

    def test_lemmatized_word(self, gs):
        assert gs.normalize_word("Äpfel") == "apfel"

    def test_unknown_word(self, gs):
        assert gs.normalize_word("xyz123") is None

    def test_word_not_in_vocab(self, gs):
        # Word in bloom but not in vocab or lemma_map
        assert gs.normalize_word("qwertz") is None

    def test_vocab_word_not_remapped_even_if_in_lemma_map(self, gs):
        """'haus' is in vocab AND in lemma_map (-> 'heim'). Should stay 'haus'."""
        assert gs.normalize_word("haus") == "haus"


class TestGuess:
    def test_valid_guess(self, gs):
        result = gs.guess("apfel")
        assert result is not None
        assert result["word"] == "apfel"
        assert result["rank"] == 1
        assert result["total"] == 5

    def test_lemmatized_guess(self, gs):
        result = gs.guess("Äpfel")
        assert result is not None
        assert result["word"] == "apfel"
        assert result["rank"] == 1

    def test_unknown_guess(self, gs):
        assert gs.guess("xyz123") is None


class TestGetTip:
    def test_easy_tip(self, gs):
        result = gs.get_tip(difficulty="easy", best_rank=4)
        assert result is not None
        assert result["rank"] <= 4

    def test_medium_tip(self, gs):
        result = gs.get_tip(difficulty="medium", best_rank=4)
        assert result is not None
        assert result["rank"] <= 4

    def test_hard_tip(self, gs):
        result = gs.get_tip(difficulty="hard", best_rank=4)
        assert result is not None

    def test_tip_returns_word_and_rank(self, gs):
        result = gs.get_tip(difficulty="easy", best_rank=1000)
        assert "word" in result
        assert "rank" in result


class TestGetGameNumber:
    def test_game_number_from_date(self, gs):
        from datetime import date
        test_date = date(2026, 1, 3)
        assert gs.get_game_number(test_date) == 3

    def test_game_number_day_one(self, gs):
        from datetime import date
        test_date = date(2026, 1, 1)
        assert gs.get_game_number(test_date) == 1

    def test_game_number_wraps_around(self, gs):
        from datetime import date
        # Day 4 with 3 total_games → ((4-1) % 3) + 1 = 1
        assert gs.get_game_number(date(2026, 1, 4)) == 1
        # Day 5 → ((5-1) % 3) + 1 = 2
        assert gs.get_game_number(date(2026, 1, 5)) == 2
        # Day 6 → ((6-1) % 3) + 1 = 3
        assert gs.get_game_number(date(2026, 1, 6)) == 3
        # Day 7 → wraps again to 1
        assert gs.get_game_number(date(2026, 1, 7)) == 1


class TestLoadGame:
    def test_load_caches(self, data_dir):
        state = GameState(data_dir)
        state.load_game(1)
        assert state.current_game_number == 1
        assert len(state.current_rankings) == 5

    def test_load_same_game_skips(self, gs):
        rankings_before = gs.current_rankings
        gs.load_game(1)
        assert gs.current_rankings is rankings_before
