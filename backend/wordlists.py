"""Word lists and the profanity engine, shared by the offline pipeline and the runtime.

Split out of ``target_selection`` so that the API can use them without it. That
module imports HanTa and wordfreq at import time, which is right for an offline
pipeline and wrong for a request path: the nickname filter needs a few
frozensets, not a POS tagger.

Two questions live here, and they are deliberately not the same list:

``SOLUTION_BLOCKLIST``
    May this word be the *solution* of a puzzle? Hand-maintained, matched
    exactly, and narrow on purpose. Every word stays fully guessable; this only
    governs the answer.

The profanity tiers under ``data/``
    May a *user* write this, as a nickname, a live-chat guess or in one of the
    free-text fields (attribution survey, word rating)? Built on the vendored
    LDNOOBW list plus two hand-maintained ones it lacks entirely: National
    Socialist names, slogans and slurs (``profanity_extremism.txt``) and the
    English vulgar register (``profanity_en.txt``). Matched over a normalised
    form that survives leetspeak, Unicode confusables, stretched letters and
    letters spelled out with gaps, plus a separate pass for extremist number
    codes (1488, HH88), which the leetspeak fold would otherwise turn into
    letters.

Letting the second list decide the first would ban harmless puzzle words; using
the first for user text would miss almost everything.
"""

from __future__ import annotations

import re
import unicodedata
from pathlib import Path

_DATA_DIR = Path(__file__).parent / "data"


# --- Solutions --------------------------------------------------------------

# Vulgar, sexual/FSK18, and strongly offensive terms, never acceptable as a
# puzzle *solution* (they stay fully guessable; this only governs the answer).
# Content policy after solutions like ``Arsch`` surfaced. Scope is deliberate:
# unambiguously crude/sexual/insulting words and slurs only. Homographs whose
# dominant sense is harmless (``Schwanz`` = tail, ``Sack`` = bag, ``Eier`` =
# eggs, ``geil`` = colloquial "great", ``blasen`` = to blow / bubbles) are NOT
# here; they remain valid solutions. Mild everyday words (``nackt``, ``kotzen``,
# ``pinkeln``, ``popel``, ``furz``) are also kept; only the taboo register is
# removed. Entries are ß→ss-folded and matched folded (see ``reject_reason``),
# so ``scheiße``/``scheisse`` are both caught by the single ``scheisse`` entry.
SOLUTION_BLOCKLIST: frozenset[str] = frozenset({
    # sexual / genital / explicit (FSK18)
    "penis", "vagina", "vulva", "klitoris", "hoden", "sperma", "samenerguss",
    "ejakulation", "ejakulieren", "masturbation", "masturbieren",
    "onanie", "onanieren", "orgasmus", "porno", "pornografie", "pornographie",
    "dildo", "vibrator", "muschi", "möse", "fotze", "votze", "pimmel",
    "schwanzlutscher", "morgenlatte", "titte", "titten", "tittchen",
    "nutte", "nutten", "hure", "huren", "flittchen", "bordell",
    "ficken", "fick", "ficker", "vögeln", "bumsen", "poppen", "pimpern",
    # vulgar excretory / body (taboo register)
    "arsch", "arschloch", "arschficker", "arschlecker", "arschgeige",
    "arschkriecher", "scheisse", "scheiss", "scheisser", "kacke", "kacken",
    "kackwurst", "pisse", "pissen", "pisser", "pisst",
    # strong insults
    "hurensohn", "wichser", "wichsen", "wichse", "wixer", "wixen",
    "schlampe", "missgeburt", "hackfresse", "vollpfosten", "schwuchtel",
    # slurs (some duplicated in NAME_BLOCKLIST; kept here for category clarity)
    "kampflesbe", "spasti", "spast", "mongo", "kanake", "bimbo",
    "neger", "nigger", "analritter",
    # sexual violence, disturbing for a casual puzzle
    "vergewaltigung", "vergewaltigen", "vergewaltiger",
    # English loanwords. They are the gap this list had until 2026-09-21:
    # every entry above is German, but a German web corpus carries the English
    # vulgar register at a frequency that clears any threshold (``pussy`` sits
    # at German Zipf 3,9), and neither the foreign-word gate nor the German
    # profanity tiers catch them. ``pussy`` reached a generated Woerdle
    # solution list that way. Homographs stay out, same rule as above:
    # ``dick`` is a German adjective, ``sex`` and ``porno`` are German nouns
    # with an everyday sense, so only ``porno`` (already listed) is judged on
    # its own register.
    "pussy", "fuck", "fucking", "fucker", "motherfucker", "shit", "bullshit",
    "bitch", "cunt", "cock", "whore", "slut", "boobs", "tits", "wanker",
    "asshole", "blowjob", "handjob", "cumshot", "gangbang", "milf", "porn",
    "nigga", "faggot", "retard", "bastard",
})


# --- Normalisation ----------------------------------------------------------

# Characters that carry no width and exist only to break a word apart.
_INVISIBLE = "​‌‍‎‏⁠﻿­"

# Non-Latin letters that render like a Latin one. A nickname spelled with a
# Cyrillic "а" reads as "arsch" and matches nothing without this table.
_CONFUSABLES = {
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y",
    "і": "i", "ј": "j", "ѕ": "s", "к": "k", "м": "m", "н": "h", "т": "t",
    "в": "b", "г": "r", "ԁ": "d", "ɡ": "g",
    "α": "a", "ο": "o", "ν": "v", "ρ": "p", "ε": "e", "ι": "i", "κ": "k",
    "τ": "t", "υ": "u", "χ": "x", "μ": "u",
}

# Digits and punctuation used as letters. Applied after the umlaut fold, so a
# transliterated "ae" is never touched again.
_LEET = {
    "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "6": "g", "7": "t",
    "8": "b", "9": "g", "@": "a", "$": "s", "!": "i", "|": "l", "+": "t",
    "(": "c", "€": "e", "£": "l",
}

_UMLAUTS = (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss"))


def _fold(text: str) -> str:
    """Everything the normalisation does except leetspeak and the space pass.

    Kept apart because two forms are built from it. Both map one character to
    one character from here on, so a position in one is the same position in
    the other, which is what lets an exemption found in the digit form blank the
    same span of the leetspeak form.
    """
    cleaned = "".join(ch for ch in text if ch not in _INVISIBLE)

    # The umlauts go first, before NFKD gets to decompose them. NFKD would turn
    # them into a bare vowel plus a combining mark, the mark would be dropped,
    # and the German spelling of the fold would be lost.
    lowered = cleaned.lower()
    for source, target in _UMLAUTS:
        lowered = lowered.replace(source, target)

    decomposed = unicodedata.normalize("NFKD", lowered)
    stripped = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return "".join(_CONFUSABLES.get(ch, ch) for ch in stripped)


def _spaces(text: str) -> str:
    """Reduce every non-alphanumeric character to a space."""
    return "".join(ch if ch.isalnum() else " " for ch in text)


def _digit_form(text: str) -> str:
    """The same normalisation without leetspeak, so digits stay digits.

    Read by the two passes that need a real number: the extremist codes, and
    the name exemption, which must see ``Nazim99`` as a name plus a number and
    not as ``nazimgg``.
    """
    return _spaces(_fold(text))


def normalize_for_profanity_check(text: str) -> str:
    """Fold a string into the shape the lists are matched against.

    In order: strip invisible characters, lowercase, transliterate umlauts and
    the sharp s the German way, decompose and drop the remaining combining marks
    (so ``ȧrsch`` loses its dot), map look-alike letters to Latin, resolve
    leetspeak, and finally reduce every remaining non-alphanumeric character to a
    space so punctuation and decoration cannot hide a word.

    The result keeps its spaces: the callers need to decide for themselves what
    counts as one token, and a joined string cannot be split again.
    """
    return _spaces("".join(_LEET.get(ch, ch) for ch in _fold(text)))


def _squeeze(text: str) -> str:
    """Collapse every run of the same character to a single one.

    ``aaarsch`` and ``aaaarsch`` both become ``arsch``. Run against a second
    copy of the text rather than replacing it, because the squeeze also turns
    ``Anne`` into ``Ane`` and would lose real German double letters.
    """
    out: list[str] = []
    for ch in text:
        if not out or out[-1] != ch:
            out.append(ch)
    return "".join(out)


# --- Term files -------------------------------------------------------------


def load_term_file(path: Path) -> list[str]:
    """Read one term per line, skipping blanks and ``#`` comments.

    Terms are normalised on load and stripped of their spaces, so a multi-word
    entry like ``am arsch vorbei`` is matched against a joined haystack, which
    is the only form a nickname ever has.
    """
    if not path.exists():
        return []
    terms: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        entry = line.strip()
        if not entry or entry.startswith("#"):
            continue
        folded = normalize_for_profanity_check(entry).replace(" ", "")
        if folded:
            terms.append(folded)
    return terms


def _by_length(terms: list[str]) -> tuple[str, ...]:
    """Longest first, so ``hurensohn`` wins over ``hure``.

    The reflected nickname shows the term that matched, and it should show the
    stronger one.
    """
    return tuple(sorted(set(terms), key=lambda term: (-len(term), term)))


def _load_phrases(path: Path) -> list[tuple[str, ...]]:
    """The entries of a term file that are written as more than one word.

    ``load_term_file`` joins them, which is the form a nickname has. Free text
    keeps its gaps, so the same entry is also kept word by word and matched as
    a phrase (see ``PHRASE_PATTERNS``).
    """
    if not path.exists():
        return []
    phrases: list[tuple[str, ...]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        entry = line.strip()
        if not entry or entry.startswith("#"):
            continue
        words = tuple(normalize_for_profanity_check(entry).split())
        if len(words) > 1:
            phrases.append(words)
    return phrases


# The substring tier is three files, one per source, so each carries its own
# header and its own measurement. They are matched as one.
STRICT_FILES: tuple[str, ...] = (
    # Derived from the vendored LDNOOBW list.
    "profanity_de_strict.txt",
    # Hand-maintained: National Socialism, antisemitic and racist slurs,
    # paedophilia. The vendored list has none of it.
    "profanity_extremism.txt",
    # Hand-maintained: the English vulgar register.
    "profanity_en.txt",
)

# Substring tier: caught anywhere inside a word, because that is the shape a
# word list is evaded with (``arschgeige1``, ``xxfotzexx``). Everything here is
# strong enough that a legitimate German word containing it is the exception,
# and those exceptions are listed in the allowlist.
STRICT_TERMS: tuple[str, ...] = _by_length(
    [term for name in STRICT_FILES for term in load_term_file(_DATA_DIR / name)]
)

# Exact-token tier: only a whole word counts. These are short or ambiguous
# (``mist``, ``depp``, ``after``) and would otherwise eat ``Mistel``,
# ``Doppelpunkt`` and ``Botschafter``.
WORD_TERMS: frozenset[str] = frozenset(load_term_file(_DATA_DIR / "profanity_de_word.txt"))

# Legitimate German words that carry a strict term inside them. Measured, not
# guessed: scripts/classify-profanity-list.py derives this from wordfreq's
# 50.000 most frequent German words plus german_names.txt.
ALLOWED_TERMS: tuple[str, ...] = _by_length(load_term_file(_DATA_DIR / "profanity_de_allow.txt"))
_ALLOWED_WITH_SQUEEZED: tuple[str, ...] = _by_length(
    [*ALLOWED_TERMS, *(_squeeze(term) for term in ALLOWED_TERMS)]
)

# First names that begin with a strict term (Nazim, Nazir, Nazife). They cannot
# go into the substring allowlist: allowing ``nazif`` would also clear
# ``Nazifan``. So they are exempt only as a whole token, optionally followed by
# a number, which is the shape a name takes in a nickname.
ALLOWED_TOKENS: frozenset[str] = frozenset(load_term_file(_DATA_DIR / "profanity_allow_tokens.txt"))


def _phrase_pattern(words: tuple[str, ...]) -> re.Pattern[str]:
    # A word boundary on both ends and any run of spaces, or none, between the
    # words: "Sieg Heil" and "sieg  heil!" match, "Wettsieg heilt" does not.
    body = r"\s*".join(re.escape(word) for word in words)
    return re.compile(rf"(?<![a-z0-9]){body}(?![a-z0-9])")


# Multi-word entries, matched across the gaps of free text. A nickname is joined
# before matching and needs none of this: the joined form of every phrase is in
# STRICT_TERMS already.
PHRASE_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = tuple(
    ("".join(words), _phrase_pattern(words))
    for name in STRICT_FILES
    for words in _load_phrases(_DATA_DIR / name)
)

# Extremist number codes, matched over the digit form, each with the canonical
# spelling it reports, so the reflected nickname does not depend on how it was
# typed. A bare 88 or 18 is deliberately not a code: it is a birth year or an
# age far more often than a signal, and ``Max88`` is an ordinary name.
_CODES: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("1488", re.compile(r"(?<!\d)14\s*88(?!\d)")),
    ("14words", re.compile(r"(?<!\d)14\s*words(?![a-z])")),
    ("hh88", re.compile(r"(?<![a-z])hh\s*88(?!\d)")),
    ("88hh", re.compile(r"(?<!\d)88\s*hh(?![a-z])")),
    ("sieg88", re.compile(r"(?<![a-z])sieg\s*(?:88|18)(?!\d)")),
    ("heil88", re.compile(r"(?<![a-z])heil\s*(?:88|18)(?!\d)")),
    ("combat18", re.compile(r"(?<![a-z])combat\s*18(?!\d)")),
)

# A run of at least this many single characters is read as one spelled-out word.
_SPELLED_RUN = 3

_EXEMPT_TOKEN = re.compile(r"([a-z]+)\d*")


def _blank_exempt_tokens(normalized: str, digits: str) -> str:
    """Blank every whole-token name exemption out of the normalised text.

    Found in the digit form, where ``Nazim99`` is a name and a number, and
    blanked at the same positions of the leetspeak form, where the same token
    reads ``nazimgg``. The two forms are position-aligned, see ``_fold``.
    """
    if not ALLOWED_TOKENS:
        return normalized
    chars = list(normalized)
    for match in re.finditer(r"\S+", digits):
        token = _EXEMPT_TOKEN.fullmatch(match.group())
        if token and token.group(1) in ALLOWED_TOKENS:
            chars[match.start():match.end()] = " " * (match.end() - match.start())
    return "".join(chars)


def _spelled_runs(tokens: list[str]) -> list[str]:
    """Join every run of single characters into the word it spells.

    ``h i t l e r`` and ``h.i.t.l.e.r`` arrive as six one-letter tokens. A token
    of two letters or more is never joined, so "Star Schule" stays two words.
    """
    runs: list[str] = []
    current: list[str] = []
    for token in [*tokens, ""]:
        if len(token) == 1:
            current.append(token)
            continue
        if len(current) >= _SPELLED_RUN:
            runs.append("".join(current))
        current = []
    return runs


def _strip_allowed(haystack: str) -> str:
    """Remove every allowlisted word from the haystack before scanning.

    ``marschall99`` loses its ``marschall`` and stops carrying ``arsch``.
    Removal, not skipping, because the leftovers still have to be scanned:
    ``arschmarschall`` must remain a hit.

    Every entry is also removed in its squeezed spelling, because the squeezed
    copy of the haystack is scanned too: ``zusammengelegt`` squeezes to
    ``zusamengelegt``, which no longer carries ``sammengeleg`` but still
    carries ``mengele``.
    """
    for allowed in _ALLOWED_WITH_SQUEEZED:
        if allowed in haystack:
            haystack = haystack.replace(allowed, " ")
    return haystack


def find_profanity(text: str, *, collapse_words: bool = False) -> str | None:
    """The blocklist term this text carries, or ``None``.

    Returns the canonical list entry rather than the user's spelling, so the
    caller can build a deterministic replacement from it.

    ``collapse_words`` decides what a haystack is, and the two callers need
    different answers:

    - False (free text): every token is its own haystack. Joining the whole
      text would invent words across the gaps, and "Star Schule" would read as
      profane. Two narrow joins are made anyway, because neither can invent a
      word: a run of single letters is read as the word it spells
      (``h i t l e r``), and a multi-word list entry is matched as a phrase with
      a word boundary on both ends (``Sieg Heil``).
    - True (a single nickname): the whole string is joined first, because a
      nickname is one token and the spaces in it are decoration.
    """
    digits = _digit_form(text)
    for code, pattern in _CODES:
        if pattern.search(digits):
            return code

    normalized = _blank_exempt_tokens(normalize_for_profanity_check(text), digits)
    tokens = normalized.split()
    if not tokens:
        return None

    # The exact-token tier never sees the joined form: "der depp" joined is
    # "derdepp", which is not the word "depp" and must not be one.
    for token in tokens:
        for candidate in (token, _squeeze(token)):
            if candidate in WORD_TERMS:
                return candidate

    haystacks = ["".join(tokens)] if collapse_words else [*tokens, *_spelled_runs(tokens)]
    for haystack in haystacks:
        for candidate in (haystack, _squeeze(haystack)):
            cleaned = _strip_allowed(candidate)
            for term in STRICT_TERMS:
                if term in cleaned:
                    return term

    if not collapse_words:
        # The digit form too, because leetspeak reads the "!" of "sieg heil!"
        # as an i and the phrase would lose its closing word boundary.
        spaced = " ".join(tokens)
        squeezed = " ".join(_squeeze(token) for token in tokens)
        for candidate in (spaced, squeezed, " ".join(digits.split())):
            for phrase, pattern in PHRASE_PATTERNS:
                if pattern.search(candidate):
                    return phrase
    return None


def contains_profanity(text: str, *, collapse_words: bool = False) -> bool:
    """Whether the text carries a blocklisted word. See ``find_profanity``."""
    return find_profanity(text, collapse_words=collapse_words) is not None
