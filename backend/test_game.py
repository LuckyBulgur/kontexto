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
        result = gs.guess("apfel", 1)
        assert result is not None
        assert result["word"] == "apfel"
        assert result["rank"] == 1
        assert result["total"] == 5

    def test_lemmatized_guess(self, gs):
        result = gs.guess("Äpfel", 1)
        assert result is not None
        assert result["word"] == "apfel"
        assert result["rank"] == 1

    def test_unknown_guess(self, gs):
        assert gs.guess("xyz123", 1) is None


class TestGetTip:
    def test_easy_tip(self, gs):
        result = gs.get_tip(game_number=1, difficulty="easy", best_rank=4)
        assert result is not None
        assert result["rank"] <= 4

    def test_medium_tip(self, gs):
        result = gs.get_tip(game_number=1, difficulty="medium", best_rank=4)
        assert result is not None
        assert result["rank"] <= 4

    def test_hard_tip(self, gs):
        result = gs.get_tip(game_number=1, difficulty="hard", best_rank=4)
        assert result is not None

    def test_tip_returns_word_and_rank(self, gs):
        result = gs.get_tip(game_number=1, difficulty="easy", best_rank=1000)
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


class TestGetClosestWords:
    def test_returns_closest_words(self, gs):
        result = gs.get_closest_words(1)
        assert len(result) == 5
        assert result[0]["rank"] == 1
        assert result[0]["word"] == "apfel"
        assert result[4]["rank"] == 5

    def test_words_ordered_by_rank(self, gs):
        result = gs.get_closest_words(1)
        ranks = [r["rank"] for r in result]
        assert ranks == sorted(ranks)


class TestRandomGameNumber:
    def test_picks_within_pool(self, gs):
        # total_games == 3; with nothing excluded the choice is in 1..3.
        for _ in range(50):
            assert gs.random_game_number(set()) in {1, 2, 3}

    def test_respects_exclusion(self, gs):
        for _ in range(50):
            assert gs.random_game_number({1, 3}) == 2

    def test_returns_none_when_all_excluded(self, gs):
        assert gs.random_game_number({1, 2, 3}) is None

    def test_total_games(self, gs):
        assert gs.total_games() == 3


class TestLoadGame:
    def test_load_caches(self, data_dir):
        state = GameState(data_dir)
        state.load_game(1)
        ranks, rank_to_index = state._get_game(1)
        assert len(ranks) == 5
        assert len(rank_to_index) == 6

    def test_load_same_game_skips(self, gs):
        ranks_before, _ = gs._get_game(1)
        gs.load_game(1)
        ranks_after, _ = gs._get_game(1)
        assert ranks_after is ranks_before

    def test_rank_to_index_is_inverse_permutation(self, data_dir):
        state = GameState(data_dir)
        ranks, rank_to_index = state._get_game(1)
        for index, rank in enumerate(ranks):
            assert rank_to_index[rank] == index


def _write_game(data_dir: str, number: int, ranks: list[int]) -> None:
    path = os.path.join(data_dir, "games", f"{number:04d}.npz")
    np.savez_compressed(path, ranks=np.array(ranks, dtype=np.uint16))


class TestGameCacheLru:
    def test_evicts_oldest_beyond_capacity(self, data_dir, monkeypatch):
        import game as game_module
        monkeypatch.setattr(game_module, "GAME_CACHE_SIZE", 2)
        _write_game(data_dir, 2, [2, 1, 3, 4, 5])
        _write_game(data_dir, 3, [3, 2, 1, 4, 5])
        state = GameState(data_dir)
        state.load_game(1)
        state.load_game(2)
        state.load_game(3)
        assert set(state._game_cache) == {2, 3}

    def test_hit_refreshes_recency(self, data_dir, monkeypatch):
        import game as game_module
        monkeypatch.setattr(game_module, "GAME_CACHE_SIZE", 2)
        _write_game(data_dir, 2, [2, 1, 3, 4, 5])
        _write_game(data_dir, 3, [3, 2, 1, 4, 5])
        state = GameState(data_dir)
        state.load_game(1)
        state.load_game(2)
        # A lookup on game 1 must mark it most recently used, so loading
        # game 3 evicts game 2 instead.
        assert state.guess("apfel", 1)["rank"] == 1
        state.load_game(3)
        assert set(state._game_cache) == {1, 3}

    def test_reloads_evicted_game_transparently(self, data_dir, monkeypatch):
        import game as game_module
        monkeypatch.setattr(game_module, "GAME_CACHE_SIZE", 1)
        _write_game(data_dir, 2, [2, 1, 3, 4, 5])
        state = GameState(data_dir)
        state.load_game(1)
        state.load_game(2)
        assert set(state._game_cache) == {2}
        # Game 1 was evicted; a guess against it must reload from disk.
        result = state.guess("birne", 1)
        assert result == {"word": "birne", "rank": 2, "total": 5}
        assert set(state._game_cache) == {1}
