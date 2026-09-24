"""Tests for the profanity engine and the one nickname rule.

Two halves, and the second one is the harder half. Catching an insult is easy;
the work is in *not* catching ordinary German, where ``arsch`` sits inside
``Marschall``, ``ruck`` inside ``Druck`` and ``ische`` inside every second
adjective. A filter that rejects "Marschieren" is a worse product than no filter.
"""

from pathlib import Path

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
        assert contains_profanity("Hu ren sohn", collapse_words=True)
        assert not contains_profanity("Hu ren sohn")

    @pytest.mark.parametrize("text", [
        "H u r e n s o h n",
        "h.i.t.l.e.r ist toll",
        "das war h-i-t-l-e-r",
    ])
    def test_free_text_reads_a_spelled_out_word(self, text):
        """A run of single letters cannot invent a word across a real gap."""
        assert contains_profanity(text)

    def test_single_letters_next_to_words_stay_apart(self):
        assert not contains_profanity("Plan B a la carte")
        assert not contains_profanity("E T A Hoffmann")

    def test_a_generated_name_survives_the_filter(self):
        for _ in range(200):
            assert not contains_profanity(generate_nickname(), collapse_words=True)

    def test_every_solution_passes(self):
        """A word the filter flags cannot be the answer of a live-chat round.

        The live overlay drops flagged guesses except the solution. The one
        listed here is a real solution and a deliberate insult at once (``idiot``
        was struck on 2026-09-24 as unfit for children); anything
        else the filter reaches in the pool is a false positive to fix in the
        lists, which is how ``Sparschwein`` was found.
        """
        pool = (Path(__file__).parent / "data" / "solution_pool.txt").read_text(encoding="utf-8")
        words = [line.strip() for line in pool.splitlines()
                 if line.strip() and not line.startswith("#")]
        flagged = {word for word in words if contains_profanity(word, collapse_words=True)}
        assert flagged == {"kamel"}

    def test_the_names_corpus_passes(self):
        """The names a nickname is drawn from, measured against every tier.

        Each of these is a deliberate decision, not an accident: a real insult
        that also happens to be listed as a name. A new list entry that reaches
        any other name fails here until it is reviewed.
        """
        names = (Path(__file__).parent / "german_names.txt").read_text(encoding="utf-8")
        flagged = {name.strip().lower() for name in names.splitlines()
                   if name.strip() and contains_profanity(name, collapse_words=True)}
        assert flagged == {
            "cock", "dildora", "hitlerike", "kamel", "ludde", "lude", "mist", "rowdy",
        }

    def test_the_solution_list_keeps_its_deliberate_homographs(self):
        """Solutions and user text are two questions. This is the first one."""
        for word in ("schwanz", "sack", "eier", "geil", "blasen", "nackt", "furz"):
            assert word not in SOLUTION_BLOCKLIST


class TestExtremism:
    """The category the vendored list never had, and the reason it was added."""

    @pytest.mark.parametrize("text,term", [
        ("Hitler", "hitler"),
        ("H1tl3r", "hitler"),
        ("Hítler", "hitler"),
        ("Нitler", "hitler"),
        ("adolf_hitler88", "hitler"),
        ("HeilHitler", "heilhitler"),
        ("xxNazixx", "nazi"),
        ("Nazifan", "nazi"),
        ("Judensau", "judensau"),
        ("Goebbels", "goebbels"),
        ("Kinderschänder", "kinderschaender"),
    ])
    def test_a_nickname_is_found(self, text, term):
        assert find_profanity(text, collapse_words=True) == term

    @pytest.mark.parametrize("text,code", [
        ("1488", "1488"),
        ("Max1488", "1488"),
        ("14 88", "1488"),
        ("HH88", "hh88"),
        ("hh_88", "hh88"),
        ("88HH", "88hh"),
        ("Sieg88", "sieg88"),
        ("Heil 18", "heil88"),
        ("Combat 18", "combat18"),
        ("14words", "14words"),
    ])
    def test_a_number_code_is_found(self, text, code):
        """Leetspeak would read 1488 as letters, so codes have their own pass."""
        assert find_profanity(text, collapse_words=True) == code
        assert find_profanity(text) == code

    @pytest.mark.parametrize("text", [
        "Sieg Heil",
        "sieg  heil!",
        "Juden raus",
        "Arbeit macht frei",
        "white power",
        "hitler war gut",
    ])
    def test_free_text_is_found(self, text):
        assert contains_profanity(text)

    @pytest.mark.parametrize("text", [
        # A birth year or an age is not a code.
        "Max88", "Jahrgang 1988", "Anna18", "Lisa 88", "Ahh88",
        # Names that begin with nazi, exempt as a whole token only.
        "Nazim", "Nazim99", "Nazir", "Nazife", "Ignazio",
        # Words and names the substring tier reaches from inside.
        "Torpedo", "Cocktail", "Hitchcock", "Therapeut", "Fagott", "Deichmann",
        "zusammengelegt", "Ansporn", "Shitstorm", "Smartwatch", "Sparschwein",
        "Schwarzenegger", "misst", "warscheinlich", "Bulgarier",
        "Hamburg HH", "Jude",
    ])
    def test_ordinary_text_passes(self, text):
        assert find_profanity(text, collapse_words=True) is None
        assert find_profanity(text) is None

    def test_free_text_near_a_phrase_passes(self):
        """The phrase needs a word boundary on both ends."""
        assert not contains_profanity("Wettsieg heilt alles")
        assert not contains_profanity("Die Juden rauschten nicht")

    def test_an_exempt_name_does_not_clear_the_rest(self):
        assert find_profanity("Nazim Hitler", collapse_words=True) == "hitler"
        assert find_profanity("Nazim ist ein Nazi") == "nazi"

    def test_the_reflection_masks_the_name(self):
        assert sanitize_nickname("Hitler") == "Ich bin H****r"
        assert sanitize_nickname("1488") == "Ich bin 1**8"
        assert sanitize_nickname(sanitize_nickname("HH88")) == sanitize_nickname("HH88")


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
