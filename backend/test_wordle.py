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
        previous = [("stern", ["GRAY", "GRAY", "GREEN", "GRAY", "GRAY"])]
        assert validate_hard_mode("herze", previous) is None

    def test_green_must_stay(self):
        previous = [("stern", ["GRAY", "GRAY", "GREEN", "GRAY", "GRAY"])]
        result = validate_hard_mode("hallo", previous)
        assert result is not None
        assert "Position 3" in result
        assert "E" in result

    def test_yellow_must_be_included(self):
        previous = [("stern", ["YELLOW", "GRAY", "GRAY", "GRAY", "GRAY"])]
        result = validate_hard_mode("hallo", previous)
        assert result is not None
        assert "S" in result

    def test_yellow_included_different_position(self):
        previous = [("stern", ["YELLOW", "GRAY", "GRAY", "GRAY", "GRAY"])]
        assert validate_hard_mode("basis", previous) is None

    def test_gray_no_restriction(self):
        previous = [("stern", ["GRAY", "GRAY", "GRAY", "GRAY", "GRAY"])]
        assert validate_hard_mode("stern", previous) is None

    def test_multiple_previous_guesses(self):
        previous = [
            ("stern", ["GRAY", "GRAY", "GREEN", "GRAY", "GRAY"]),
            ("berge", ["GRAY", "YELLOW", "GREEN", "GRAY", "GRAY"]),
        ]
        assert validate_hard_mode("kerze", previous) is None
        result = validate_hard_mode("kehle", previous)
        assert result is not None  # missing 'r'
