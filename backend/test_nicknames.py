"""Tests for the profanity engine and the one nickname rule.

Two halves, and the second one is the harder half. Catching an insult is easy;
the work is in *not* catching ordinary German, where ``arsch`` sits inside
``Marschall``, ``ruck`` inside ``Druck`` and ``ische`` inside every second
adjective. A filter that rejects "Marschieren" is a worse product than no filter.
"""

import pytest

from nicknames import (
    MAX_STORED_NICKNAME,
    generate_nickname,
    mask_term,
    sanitize_nickname,
)
from wordlists import SOLUTION_BLOCKLIST, contains_profanity, find_profanity


class TestDetection:
    @pytest.mark.parametrize("text", [
        "Hurensohn",
        "xxWichserxx",
        "arschgeige1",
        "Möse",
        "Fotze",
        "Schlampe",
    ])
    def test_an_insult_is_found(self, text):
        assert contains_profanity(text, collapse_words=True)

    @pytest.mark.parametrize("text,term", [
        ("f1ck", "fick"),
        ("4rschl0ch", "arschloch"),
        ("$chl4mpe", "schlampe"),
        ("aaarsch", "arsch"),
        ("aaaaaarschloch", "arschloch"),
        ("arsch!", "arsch"),
        ("a.r.s.c.h.l.o.c.h", "arschloch"),
    ])
    def test_an_evasion_is_found(self, text, term):
        assert find_profanity(text, collapse_words=True) == term

    def test_a_cyrillic_look_alike_is_found(self):
        assert find_profanity("аrschloch", collapse_words=True) == "arschloch"

    def test_a_zero_width_character_is_found(self):
        assert find_profanity("Hu​rensohn", collapse_words=True) == "hurensohn"

    def test_a_combining_mark_is_found(self):
        assert find_profanity("ȧrschloch", collapse_words=True) == "arschloch"

    def test_the_longest_term_wins(self):
        """The reflected name should show the stronger word, not its stem."""
        assert find_profanity("Hurensohn", collapse_words=True) == "hurensohn"

    @pytest.mark.parametrize("text", [
        # The substring tier, against the German that surrounds it.
        "Marschall", "Marschieren", "Einmarsch", "Feldmarschall", "Barsch",
        "Haarschnitt", "Nachbarschaft", "Warschau", "Mongolei",
        # The exact-token tier, which exists for exactly these.
        "Mistel", "Methoden", "Auspuff", "Botschafter", "Nussknacker",
        "Doppelpunkt", "Homogen", "Georgien",
        # Words the vendored list carries that this project does not enforce.
        "Druck", "Augenblick", "Ecke", "Bescheinigung", "Entscheidung",
        "Nilpferd", "Ameisenbaer", "Bohnenstange", "Nebelkraehe", "Horst",
        # Ordinary names and the generated ones.
        "Marlene", "Anna", "Thure",
    ])
    def test_ordinary_german_passes(self, text):
        assert find_profanity(text, collapse_words=True) is None

    def test_free_text_does_not_invent_words_across_a_gap(self):
        """Joining free text would read "Star Schule" as profane."""
        assert not contains_profanity("Star Schule")

    def test_a_nickname_is_joined_before_matching(self):
        """A nickname is one token; the spaces in it are decoration."""
        assert contains_profanity("H u r e n s o h n", collapse_words=True)
        assert not contains_profanity("H u r e n s o h n")

    def test_a_generated_name_survives_the_filter(self):
        for _ in range(200):
            assert not contains_profanity(generate_nickname(), collapse_words=True)

    def test_the_solution_list_keeps_its_deliberate_homographs(self):
        """Solutions and user text are two questions. This is the first one."""
        for word in ("schwanz", "sack", "eier", "geil", "blasen", "nackt", "furz"):
            assert word not in SOLUTION_BLOCKLIST


class TestMasking:
    @pytest.mark.parametrize("term,masked", [
        ("hurensohn", "H*******n"),
        ("fotze", "F***e"),
        ("wichser", "W*****r"),
        ("fick", "F**k"),
    ])
    def test_the_first_and_last_letter_survive(self, term, masked):
        assert mask_term(term) == masked

    def test_a_very_short_term_keeps_only_its_first_letter(self):
        assert mask_term("aas") == "A**"

    def test_a_long_term_is_cut_to_the_display_budget(self):
        masked = mask_term("ichwilldichficken")
        assert masked == "I**************n"
        assert len("Ich bin " + masked) == MAX_STORED_NICKNAME


class TestSanitize:
    def test_a_plain_name_is_returned_as_typed(self):
        assert sanitize_nickname("Marlene") == "Marlene"
        assert sanitize_nickname("  Marlene  ") == "Marlene"

    def test_an_insult_is_reflected_back_masked(self):
        assert sanitize_nickname("Hurensohn") == "Ich bin H*******n"

    def test_the_spelling_does_not_change_the_reflection(self):
        """The mask is built from the list entry, not from what was typed."""
        for spelling in ("HURENSOHN", "hur3nsohn", "xxHurensohnxx", "Hu​rensohn"):
            assert sanitize_nickname(spelling) == "Ich bin H*******n"

    def test_the_reflection_is_idempotent(self):
        """The matchmaking path sanitizes, then the room constructor does again."""
        once = sanitize_nickname("Hurensohn")
        assert sanitize_nickname(once) == once

    def test_the_reflection_fits_the_stored_bound(self):
        for term in ("hurensohn", "vergewaltigung", "ichwilldichficken"):
            assert len(sanitize_nickname(term)) <= MAX_STORED_NICKNAME

    @pytest.mark.parametrize("name", ["", "   ", "x" * 21, "Anna\u0007", None])
    def test_an_unusable_name_gets_a_generated_one(self, name):
        result = sanitize_nickname(name)
        assert result
        assert result != name
        assert not contains_profanity(result, collapse_words=True)
