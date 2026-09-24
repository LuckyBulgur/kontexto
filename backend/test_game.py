"""Tests for game logic."""

import json
import os
import pickle
import tempfile

import numpy as np
import pytest
from pybloom_live import BloomFilter

import core_lexicon
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

    def test_legacy_games_are_not_drawn(self, data_dir):
        # Games below first_curated_game kept the words the old pool gave them
        # and never passed the rule that a solution is a concrete common noun.
        # The daily series walked past them; the random modes must not hand
        # them out again.
        meta = json.load(open(os.path.join(data_dir, "metadata.json"), encoding="utf-8"))
        meta["first_curated_game"] = 3
        with open(os.path.join(data_dir, "metadata.json"), "w", encoding="utf-8") as f:
            json.dump(meta, f)
        state = GameState(data_dir)
        assert state.first_curated_game() == 3
        assert {state.random_game_number(set()) for _ in range(50)} == {3}
        assert state.random_game_numbers(2, set()) is None
        assert state.random_game_number({3}) is None

    def test_without_the_key_every_game_is_drawn(self, gs):
        assert gs.first_curated_game() == 1
        assert {gs.random_game_number(set()) for _ in range(80)} == {1, 2, 3}


class TestCoreLexicon:
    """The scale a rank is read against.

    The vocabulary is a frequency cut and most of it is rare compounds and
    inflected forms; counting them pushed the displayed rank up by about a
    factor of five. The counted lexicon is what counts, and since 2026-09-22 it
    is also the whole of what can be guessed: a form outside it either folds
    onto the counted word it belongs to, or it is refused. Two words sharing a
    number is the one thing a rank must not do.
    """

    @pytest.fixture
    def core_dir(self, data_dir):
        # apfel, kirsche and haus count; birne folds onto kirsche and auto is
        # carried by the vocabulary but holds no place, so it is refused.
        core_lexicon.write_core_words(data_dir, ["apfel", "kirsche", "haus"])
        core_lexicon.write_fold_map(data_dir, {"birne": "kirsche"})
        return data_dir

    def test_ranks_count_core_words_only(self, core_dir):
        state = GameState(core_dir)
        assert state.core_size == 3
        assert state.guess("apfel", 1)["rank"] == 1
        assert state.guess("kirsche", 1)["rank"] == 2
        assert state.guess("haus", 1)["rank"] == 3

    def test_every_counted_word_has_its_own_number(self, core_dir):
        state = GameState(core_dir)
        ranks = [state.guess(w, 1)["rank"] for w in ("apfel", "kirsche", "haus")]
        assert ranks == sorted(set(ranks))

    def test_a_form_is_scored_as_the_word_it_belongs_to(self, core_dir):
        state = GameState(core_dir)
        folded = state.guess("birne", 1)
        # The row shows the counted word, so it cannot read as a second word
        # sitting on the same number.
        assert folded["word"] == "kirsche"
        assert folded["rank"] == state.guess("kirsche", 1)["rank"]

    def test_a_word_with_no_place_is_refused(self, core_dir):
        state = GameState(core_dir)
        # Before 2026-09-22 this came back with the number of the counted word
        # ahead of it, which is what put two words on one rank.
        assert state.guess("auto", 1, correct_typos=False) is None

    def test_rank_one_stays_unique_to_the_solution(self, core_dir):
        state = GameState(core_dir)
        scored = [(w, state.guess(w, 1)) for w in ("apfel", "birne", "kirsche", "auto", "haus")]
        first = [w for w, r in scored if r is not None and r["rank"] == 1]
        assert first == ["apfel"]

    def test_total_is_the_core_size(self, core_dir):
        state = GameState(core_dir)
        assert state.guess("kirsche", 1)["total"] == 3
        assert state.display_total() == 3

    def test_closest_words_are_core_words(self, core_dir):
        state = GameState(core_dir)
        assert state.get_closest_words(1) == [
            {"word": "apfel", "rank": 1},
            {"word": "kirsche", "rank": 2},
            {"word": "haus", "rank": 3},
        ]

    def test_word_at_rank_follows_the_core(self, core_dir):
        state = GameState(core_dir)
        assert state.word_at_rank(1, 2) == {"word": "kirsche", "rank": 2}
        assert state.word_at_rank(1, 3) == {"word": "haus", "rank": 3}
        assert state.word_at_rank(1, 4) is None

    def test_tip_stays_inside_the_core(self, core_dir):
        state = GameState(core_dir)
        tip = state.get_tip(1, "medium", best_rank=3)
        assert tip is not None
        assert tip["word"] in {"kirsche", "haus"}
        assert 2 <= tip["rank"] <= 3

    def test_a_solution_outside_the_core_still_owns_rank_one(self, data_dir):
        # The pool builder keeps every solution in the lexicon; this is the
        # guard for a data directory where that went wrong. Without it the
        # nearest counted word would be reported as rank 1, and the client would
        # call the round solved on the wrong word.
        core_lexicon.write_core_words(data_dir, ["kirsche", "haus"])
        state = GameState(data_dir)
        assert state.guess("apfel", 1)["rank"] == 1      # apfel is the solution
        assert state.guess("kirsche", 1)["rank"] == 2
        assert state.guess("haus", 1)["rank"] == 3

    def test_the_lemma_index_still_resolves_a_form(self, data_dir):
        # A directory whose fold map does not name a form falls back on the
        # surface form index the game builds for typo correction.
        core_lexicon.write_core_words(data_dir, ["apfel", "kirsche", "haus"])
        state = GameState(data_dir)
        state.lemma_map["aepfel"] = "apfel"
        state.bloom.add("aepfel")
        assert state.guess("aepfel", 1)["word"] == "apfel"

    def test_without_a_core_the_whole_vocabulary_counts(self, data_dir):
        state = GameState(data_dir)
        assert state.core_mask is None
        assert state.display_total() == 5
        assert state.guess("haus", 1)["rank"] == 5
        assert state.guess("haus", 1)["total"] == 5

    def test_an_empty_core_file_is_ignored(self, data_dir):
        core_lexicon.write_core_words(data_dir, [])
        state = GameState(data_dir)
        assert state.core_mask is None
        assert state.display_total() == 5

    def test_core_words_outside_the_vocabulary_are_ignored(self, data_dir):
        core_lexicon.write_core_words(data_dir, ["apfel", "gibtesnicht"])
        state = GameState(data_dir)
        assert state.core_size == 1
        assert state.guess("apfel", 1)["rank"] == 1


class TestEverydayHints:
    """What the game hands out is drawn from the everyday list.

    The scale counts every base form since 2026-09-24, rare compounds included,
    and a tip naming one of those is the thing the everyday list exists to keep
    out. So a single word handed out, a tip or the Leiter opening word, skips
    them and reports the rank the everyday word really holds. Every list the
    game shows (the neighbour list, the Sudden Death runners-up) is a run of
    consecutive ranks instead, because a list with gaps reads as a bug.
    """

    @pytest.fixture
    def hint_dir(self, data_dir):
        # All five count; only auto and haus are everyday words besides the
        # solution. Ranks: apfel 1, birne 2, kirsche 3, auto 4, haus 5.
        core_lexicon.write_core_words(data_dir, ["apfel", "birne", "kirsche", "auto", "haus"])
        core_lexicon.write_everyday_words(data_dir, ["apfel", "auto", "haus"])
        return data_dir

    def test_the_scale_still_counts_every_word(self, hint_dir):
        state = GameState(hint_dir)
        assert state.display_total() == 5
        assert state.guess("birne", 1)["rank"] == 2

    def test_a_tip_names_an_everyday_word_at_its_own_rank(self, hint_dir):
        tip = GameState(hint_dir).get_tip(1, "medium", best_rank=3)
        assert tip == {"word": "auto", "rank": 4}

    def test_a_tip_skips_what_was_guessed(self, hint_dir):
        tip = GameState(hint_dir).get_tip(1, "medium", best_rank=3, guessed_ranks=[4])
        assert tip == {"word": "haus", "rank": 5}

    def test_no_tip_once_every_everyday_word_was_guessed(self, hint_dir):
        assert GameState(hint_dir).get_tip(1, "easy", best_rank=5, guessed_ranks=[4, 5]) is None

    def test_the_neighbour_list_has_no_gaps(self, hint_dir):
        assert GameState(hint_dir).get_closest_words(1) == [
            {"word": "apfel", "rank": 1},
            {"word": "birne", "rank": 2},
            {"word": "kirsche", "rank": 3},
            {"word": "auto", "rank": 4},
            {"word": "haus", "rank": 5},
        ]

    def test_word_at_rank_moves_outward_to_an_everyday_word(self, hint_dir):
        state = GameState(hint_dir)
        assert state.word_at_rank(1, 2) == {"word": "auto", "rank": 4}
        assert state.word_at_rank(1, 5) == {"word": "haus", "rank": 5}
        assert state.word_at_rank(1, 6) is None
        assert state.word_at_rank(1, 1) is None

    def test_words_at_ranks_are_the_exact_ranks_without_gaps(self, hint_dir):
        assert GameState(hint_dir).words_at_ranks(1, [4, 2, 3, 2, 1, 9]) == [
            {"word": "birne", "rank": 2},
            {"word": "kirsche", "rank": 3},
            {"word": "auto", "rank": 4},
        ]

    def test_an_everyday_word_holding_no_number_is_never_handed_out(self, data_dir):
        # "heute" is everyday German and on the stop list; it stays on the
        # everyday list because the vectors are debiased on it.
        core_lexicon.write_core_words(data_dir, ["apfel", "kirsche", "haus"])
        core_lexicon.write_everyday_words(data_dir, ["apfel", "birne", "haus"])
        state = GameState(data_dir)
        assert state.word_at_rank(1, 2) == {"word": "haus", "rank": 3}

    def test_without_the_file_the_scale_is_the_everyday_list(self, data_dir):
        core_lexicon.write_core_words(data_dir, ["apfel", "kirsche", "haus"])
        state = GameState(data_dir)
        assert state.hint_mask is None
        assert state.word_at_rank(1, 2) == {"word": "kirsche", "rank": 2}

    def test_a_stop_word_is_refused_as_too_general(self, gs):
        assert gs.is_uncounted("und") is True
        assert gs.is_uncounted("heute") is True
        assert gs.is_uncounted("apfel") is False


class TestBuildLexicon:
    VOCAB = ["hund", "hunde", "haus", "xylophon", "und", "ab", "malen", "malt", "mal",
             "liebe", "lieb", "akten", "akte", "akt", "meinem", "mein", "laut"]
    LEMMA = {"hunde": "hund"}
    #: (pos, lemma) capitalised, then as written. Standing in for spaCy, which
    #: the build reads once over the whole vocabulary and never at runtime.
    CLASSES = {
        "hund": ("NOUN", "hund", "NOUN", "hund"),
        "hunde": ("NOUN", "hund", "NOUN", "hunde"),
        "haus": ("NOUN", "haus", "NOUN", "haus"),
        "xylophon": ("NOUN", "xylophon", "NOUN", "xylophon"),
        "und": ("CCONJ", "und", "CCONJ", "und"),
        "ab": ("ADP", "ab", "ADP", "ab"),
        # The infinitive reads as itself and ends like a declined ``mal``;
        # ``malt`` is what proves it is a verb.
        "malen": ("NOUN", "malen", "VERB", "malen"),
        "malt": ("VERB", "malen", "VERB", "malen"),
        "mal": ("ADV", "mal", "ADV", "mal"),
        # The noun reads as a declined ``lieb``; the capitalised reading and
        # the frequency say otherwise.
        "liebe": ("NOUN", "liebe", "ADJ", "liebe"),
        "lieb": ("ADJ", "lieb", "ADJ", "lieb"),
        # spaCy's own chain: the files read as the file, the file as the act.
        "akten": ("NOUN", "akte", "NOUN", "akte"),
        "akte": ("NOUN", "akt", "NOUN", "akte"),
        "akt": ("NOUN", "akt", "NOUN", "akt"),
        "meinem": ("DET", "mein", "DET", "mein"),
        "mein": ("DET", "mein", "DET", "mein"),
        # A preposition by class, a content word by use: "laut" is loud.
        "laut": ("ADP", "laut", "ADP", "laut"),
    }
    STOP = frozenset({"und", "mein", "ab"})

    def build(self, **kwargs):
        kwargs.setdefault("classes", self.CLASSES)
        kwargs.setdefault("stopwords", self.STOP)
        return core_lexicon.build_lexicon(self.VOCAB, self.LEMMA, **kwargs)

    def test_keeps_one_entry_per_lemma(self):
        lex = self.build()
        assert "hund" in lex.scale
        assert "hunde" not in lex.scale
        assert lex.fold["hunde"] == "hund"

    def test_a_rare_word_counts(self):
        # The original game ranks "leggings" at 25.638 rather than refusing it;
        # frequency decides the everyday list, never whether a word counts.
        lex = self.build(min_zipf=7.0)
        assert "xylophon" in lex.scale
        assert "xylophon" not in lex.everyday

    def test_the_frequency_floor_shapes_the_everyday_list(self):
        lex = self.build(min_zipf=4.0)
        assert "haus" in lex.everyday
        assert "xylophon" not in lex.everyday

    def test_a_word_players_type_is_an_everyday_word(self):
        # Corpus frequency gets the words for body part and weekday wrong just
        # under the floor, and players typed them by the hundred.
        lex = self.build(min_zipf=7.0, guess_counts={"xylophon": 40}, min_guesses=10)
        assert "xylophon" in lex.everyday

    def test_a_stop_word_holds_no_place(self):
        lex = self.build()
        assert "und" not in lex.scale and "und" not in lex.fold

    def test_a_form_of_a_stop_word_is_refused_with_it(self):
        lex = self.build()
        assert "meinem" not in lex.scale and "meinem" not in lex.fold

    def test_a_closed_class_reading_does_not_refuse_a_word(self):
        assert "laut" in self.build().scale

    def test_an_infinitive_keeps_its_ending(self):
        # Stripping "-en" from verbs scored malen as mal and lieben as lieb,
        # 5.505 real guesses on production.
        lex = self.build()
        assert "malen" in lex.scale
        assert lex.fold.get("malt") == "malen"

    def test_a_noun_in_e_is_not_a_declined_adjective(self):
        lex = self.build()
        assert "liebe" in lex.scale
        assert "liebe" not in lex.fold

    def test_a_fold_does_not_follow_a_chain(self):
        lex = self.build()
        assert lex.fold.get("akte") == "akt"
        assert "akten" in lex.scale

    def test_the_everyday_list_can_be_frozen(self):
        # A rebuild passes the deployed list, because the vectors are debiased
        # on it and a list that moved would move every rank of every game.
        lex = self.build(everyday={"xylophon", "und", "gibtesnicht"})
        assert lex.everyday == ["und", "xylophon"]
        assert "und" not in lex.scale

    def test_drops_very_short_forms(self):
        assert "ab" not in self.build(min_length=3).scale

    def test_keep_wins_over_the_floor(self):
        lex = self.build(min_zipf=7.0, keep={"xylophon", "nichtimvokabular"})
        assert "xylophon" in lex.everyday
        assert "nichtimvokabular" not in lex.scale

    def test_a_solution_is_never_folded_away(self):
        # A solution scored as some other word would report the round solved on
        # the wrong one, so keep wins over the fold as well.
        lex = self.build(keep={"hunde"})
        assert "hunde" in lex.scale
        assert "hunde" not in lex.fold

    def test_an_everyday_word_is_never_folded_away(self):
        lex = self.build(everyday={"hunde"})
        assert "hunde" in lex.scale
        assert "hunde" not in lex.fold

    def test_a_fold_always_lands_on_a_counted_word(self):
        lex = self.build()
        assert set(lex.fold.values()) <= set(lex.scale)
        assert not set(lex.fold) & set(lex.scale)

    def test_write_lexicon_round_trip(self, data_dir):
        lex = core_lexicon.Lexicon(scale=["haus", "hund"], fold={"hunde": "hund"}, everyday=["haus"])
        core_lexicon.write_lexicon(data_dir, lex)
        assert core_lexicon.load_core_words(data_dir) == ["haus", "hund"]
        assert core_lexicon.load_fold_map(data_dir) == {"hunde": "hund"}
        assert core_lexicon.load_everyday_words(data_dir) == ["haus"]

    def test_fold_map_round_trip(self, data_dir):
        core_lexicon.write_fold_map(data_dir, {"hunde": "hund"})
        assert core_lexicon.load_fold_map(data_dir) == {"hunde": "hund"}

    def test_fold_map_is_empty_without_a_file(self, data_dir):
        assert core_lexicon.load_fold_map(data_dir) == {}

    def test_load_returns_none_without_a_file(self, data_dir):
        assert core_lexicon.load_core_words(data_dir) is None

    def test_round_trip(self, data_dir):
        core_lexicon.write_core_words(data_dir, ["apfel", "haus"])
        assert core_lexicon.load_core_words(data_dir) == ["apfel", "haus"]


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
        assert result == {"word": "birne", "rank": 2, "total": 5,
                          "corrected_from": None}
        assert set(state._game_cache) == {1}
