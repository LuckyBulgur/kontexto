import pytest
from wordle import evaluate, validate_hard_mode


class TestEvaluate:
    def test_all_correct(self):
        assert evaluate("hallo", "hallo") == ["GREEN", "GREEN", "GREEN", "GREEN", "GREEN"]

    def test_all_wrong(self):
        assert evaluate("qwxyz", "hallo") == ["GRAY", "GRAY", "GRAY", "GRAY", "GRAY"]

    def test_correct_position(self):
        result = evaluate("hecke", "hallo")
        assert result[0] == "GREEN"  # h correct

    def test_wrong_position(self):
        result = evaluate("lahme", "hallo")
        assert result[0] == "YELLOW"  # l is in hallo but not at pos 0

    def test_duplicate_letter_one_in_target(self):
        # target "hallo" has one 'a'. Guess "alarm" has 'a' at pos 0 and 2.
        result = evaluate("alarm", "hallo")
        assert result[0] == "YELLOW"  # first a: yellow
        assert result[2] == "GRAY"    # second a: gray (consumed)

    def test_duplicate_in_guess_both_present(self):
        # target "knall", guess "llama" - target has l at pos 3,4
        result = evaluate("llama", "knall")
        assert result[0] == "YELLOW"
        assert result[1] == "YELLOW"

    def test_duplicate_green_priority(self):
        # target "alles", guess "lilie"
        result = evaluate("lilie", "alles")
        assert result[0] == "YELLOW"  # l in word, wrong pos
        assert result[2] == "GREEN"   # l correct pos


class TestValidateHardMode:
    def test_valid_guess(self):
        # 'h' GREEN at pos 0 -> new guess must have 'h' at pos 0
        previous = [("hallo", ["GREEN", "GRAY", "GRAY", "GRAY", "GRAY"])]
        assert validate_hard_mode("heute", previous) is None  # h at pos 0 ✓

    def test_green_must_stay(self):
        # 'h' GREEN at pos 0 -> must have 'h' at pos 0
        previous = [("hallo", ["GREEN", "GRAY", "GRAY", "GRAY", "GRAY"])]
        result = validate_hard_mode("stern", previous)  # no h at pos 0
        assert result is not None
        assert "Position 1" in result
        assert "H" in result

    def test_green_wrong_position_rejected(self):
        # 'h' GREEN at pos 0 -> must be at pos 0, not just present anywhere
        previous = [("hallo", ["GREEN", "GRAY", "GRAY", "GRAY", "GRAY"])]
        result = validate_hard_mode("lehre", previous)  # has 'h' but at pos 2, not 0
        assert result is not None
        assert "Position 1" in result

    def test_yellow_must_be_included(self):
        previous = [("stern", ["YELLOW", "GRAY", "GRAY", "GRAY", "GRAY"])]
        result = validate_hard_mode("hallo", previous)  # no 's'
        assert result is not None
        assert "S" in result

    def test_yellow_included_different_position(self):
        previous = [("stern", ["YELLOW", "GRAY", "GRAY", "GRAY", "GRAY"])]
        assert validate_hard_mode("basis", previous) is None  # has 's'

    def test_gray_no_restriction(self):
        previous = [("stern", ["GRAY", "GRAY", "GRAY", "GRAY", "GRAY"])]
        assert validate_hard_mode("stern", previous) is None

    def test_multiple_previous_guesses(self):
        previous = [
            ("hallo", ["GREEN", "GRAY", "GRAY", "YELLOW", "GRAY"]),  # h at pos 0 GREEN, l YELLOW
            ("hilfe", ["GREEN", "GRAY", "GRAY", "GRAY", "YELLOW"]),  # h at pos 0 GREEN, e YELLOW
        ]
        # Must have: h at pos 0, l somewhere, e somewhere
        assert validate_hard_mode("heule", previous) is None  # h at 0, e at 1+4, l at 3 ✓ (wait u at 2, l at 3, e at 4)
        result = validate_hard_mode("hunde", previous)
        assert result is not None  # missing 'l'
