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
    May a *user* write this, as a nickname or in the survey free text? Built on
    the vendored LDNOOBW list, matched over a normalised form that survives
    leetspeak, Unicode confusables and stretched letters.

Letting the second list decide the first would ban harmless puzzle words; using
the first for user text would miss almost everything.
"""

from __future__ import annotations

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
    cleaned = "".join(ch for ch in text if ch not in _INVISIBLE)

    # The umlauts go first, before NFKD gets to decompose them. NFKD would turn
    # them into a bare vowel plus a combining mark, the mark would be dropped,
    # and the German spelling of the fold would be lost.
    lowered = cleaned.lower()
    for source, target in _UMLAUTS:
        lowered = lowered.replace(source, target)

    decomposed = unicodedata.normalize("NFKD", lowered)
    stripped = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    mapped = "".join(_CONFUSABLES.get(ch, ch) for ch in stripped)
    mapped = "".join(_LEET.get(ch, ch) for ch in mapped)

    return "".join(ch if ch.isalnum() else " " for ch in mapped)


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


# Substring tier: caught anywhere inside a word, because that is the shape a
# word list is evaded with (``arschgeige1``, ``xxfotzexx``). Everything here is
# strong enough that a legitimate German word containing it is the exception,
# and those exceptions are listed in the allowlist.
STRICT_TERMS: tuple[str, ...] = _by_length(load_term_file(_DATA_DIR / "profanity_de_strict.txt"))

# Exact-token tier: only a whole word counts. These are short or ambiguous
# (``mist``, ``depp``, ``after``) and would otherwise eat ``Mistel``,
# ``Doppelpunkt`` and ``Botschafter``.
WORD_TERMS: frozenset[str] = frozenset(load_term_file(_DATA_DIR / "profanity_de_word.txt"))

# Legitimate German words that carry a strict term inside them. Measured, not
# guessed: scripts/classify-profanity-list.py derives this from wordfreq's
# 50.000 most frequent German words plus german_names.txt.
ALLOWED_TERMS: tuple[str, ...] = _by_length(load_term_file(_DATA_DIR / "profanity_de_allow.txt"))


def _strip_allowed(haystack: str) -> str:
    """Remove every allowlisted word from the haystack before scanning.

    ``marschall99`` loses its ``marschall`` and stops carrying ``arsch``.
    Removal, not skipping, because the leftovers still have to be scanned:
    ``arschmarschall`` must remain a hit.
    """
    for allowed in ALLOWED_TERMS:
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
      profane. The cost is that a word spelled with spaces between its letters
      gets through, which is the right trade for a comment nobody has to read.
    - True (a single nickname): the whole string is joined first, because a
      nickname is one token and the spaces in it are decoration.
    """
    normalized = normalize_for_profanity_check(text)
    tokens = normalized.split()
    if not tokens:
        return None

    # The exact-token tier never sees the joined form: "der depp" joined is
    # "derdepp", which is not the word "depp" and must not be one.
    for token in tokens:
        for candidate in (token, _squeeze(token)):
            if candidate in WORD_TERMS:
                return candidate

    haystacks = ["".join(tokens)] if collapse_words else tokens
    for haystack in haystacks:
        for candidate in (haystack, _squeeze(haystack)):
            cleaned = _strip_allowed(candidate)
            for term in STRICT_TERMS:
                if term in cleaned:
                    return term
    return None


def contains_profanity(text: str, *, collapse_words: bool = False) -> bool:
    """Whether the text carries a blocklisted word. See ``find_profanity``."""
    return find_profanity(text, collapse_words=collapse_words) is not None
