"""Re-decide the solution pool and the reject list against one written rubric.

Why this exists
---------------
The pool was curated in four passes over two days, and the bar moved between
them: whole compound families were waved through as blocks, the same kind of
word was struck in one pass and kept in the next, and the reject list ended up
carrying 120 different free-text reasons, with 1.337 of its 1.882 entries under
three labels that say nothing ("struck in the last pass").

This script applies the verdicts of a single comparative pass. The words were
read in 70 semantic clusters instead of alphabetically, so that unequal
treatment inside a field became visible: the cluster that holds the word for
lynx also holds the ones for racoon and rhinoceros, and an alphabetical list
never puts them next to each other.

Every rejected word carries one of eight codes. The codes are the rubric:

    P  proper name, place or brand
    V  a variant of a word that is already in the pool
    U  subordinate term, the head word alone names the thing
    S  specialist, official or trade word
    L  regional or dialectal
    N  not known to every speaker
    K  three-part compound that names no everyday thing of its own
    W  not the base form of a noun
    Z  thirteen letters or more and no everyday thing behind them
    F  no opening word gets near it, measured and validated against play

The reasons that survived from the earlier passes are mapped onto the same
codes, mechanically, so that the whole list speaks one language. Where the old
free text carried information the code does not, it is kept in brackets.
"""

from __future__ import annotations

import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
POOL = ROOT / "backend/data/solution_pool.txt"
REJECTS = ROOT / "backend/data/solution_rejects.txt"
DECISIONS = ROOT / ".regen-work/decisions.tsv"
PROTECTED = ROOT / "backend/data/solution_protected.txt"

CODES = {
    "P": "Eigenname, Ort oder Marke",
    "V": "Variante eines Worts, das schon drin steht",
    "U": "Unterbegriff, das Grundwort benennt die Sache",
    "S": "Fach-, Amts- oder Berufswort",
    "L": "landschaftlich oder mundartlich",
    "N": "nicht jedem gelaeufig",
    "K": "dreigliedriges Kompositum ohne eigenes Alltagsding",
    "W": "keine Nennform eines Substantivs",
    "F": "von den Startwoertern aus nicht erreichbar, gemessen",
    "Z": "ab 13 Zeichen und kein Alltagsding, das jeder selbst erlebt",
}

#: From this length on, a word has to earn the typing. Below it, length is no
#: argument at all: short abstractions such as the words for secret, luxury and
#: panic are good rounds, and the player said so. Long ones are not, and the
#: measurement agrees: a solution the concreteness norms rate below 4,0 costs
#: 118 guesses against 48 for one at 7,0 and up.
LONG_WORD = 13

#: Old free-text reasons, mapped onto the codes. Everything not listed here is
#: decided by :func:`infer_code` from the word itself.
REASON_CODE = {
    "eigenname": "P", "marke": "P", "ortsname": "P", "nationalitaet": "P",
    "himmelsrichtung": "P", "vorname": "P", "nachname": "P", "stadt": "P",
    "movierte doppelform": "V", "movierte form": "V", "schreibvariante": "V",
    "verkleinerungsform": "V", "umgangssprachliche doppelform": "V",
    "doppelform": "V", "variante": "V", "abkuerzung": "V",
    "kurzform": "V",
    "unterbegriff, grundwort steht schon drin": "U",
    "wochentagskompositum": "U",
    "jargon": "S", "technikjargon": "S", "fachbegriff": "S", "amtsdeutsch": "S",
    "institution": "S", "fachgebiet": "S", "wirtschaftsjargon": "S",
    "berufsjargon": "S", "sportjargon": "S", "fachchemie": "S", "klinisch": "S",
    "technik": "S", "zu speziell": "S", "behoerde": "S", "recht": "S",
    "regional": "L", "dialekt": "L", "landschaftlich": "L",
    "verb": "W", "adjektiv": "W", "partizip": "W", "flexionsform": "W",
}

#: Reasons that carry no information, so nothing of them is worth keeping.
VAGUE = {
    "beim letzten durchgang gestrichen",
    "ableger oder nischenwort, vierter durchgang",
    "kennt man, benennt man aber nicht, vierter durchgang",
    "abstrakt",
}


def read_pool() -> list[str]:
    return [line.strip() for line in POOL.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.startswith("#")]


def read_rejects() -> dict[str, str]:
    out: dict[str, str] = {}
    for line in REJECTS.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            word, _, reason = line.partition("=")
            out[word.strip()] = reason.strip()
    return out


def read_protected() -> set[str]:
    """Words the player ruled on by hand, which no automatic gate may remove."""
    return {line.strip() for line in PROTECTED.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.startswith("#")}


def read_decisions() -> tuple[set[str], dict[str, str]]:
    keep: set[str] = set()
    drop: dict[str, str] = {}
    for line in DECISIONS.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        cells = line.split("\t")
        # The file is an append-only log of a reading pass, so a later line
        # is a later reading and overrides an earlier one. Without this a word
        # struck in one pass and taken back in the next lands in both sets, and
        # the strike silently wins.
        if cells[1] == "keep":
            keep.add(cells[0])
            drop.pop(cells[0], None)
        else:
            if cells[2] not in CODES:
                raise SystemExit(f"unknown code {cells[2]!r} for {cells[0]}")
            drop[cells[0]] = cells[2]
            keep.discard(cells[0])
    return keep, drop


#: Shortest string the dictionary splitter may call a constituent. Below this
#: it produces syllables rather than words, and "Dienstwagen" comes back as
#: three parts because "wa" and "gen" are listed as nouns.
MIN_PART = 4


def decompose(word: str) -> tuple[str, ...]:
    """Split a compound, or return the word itself.

    Wraps ``german_nouns.parse_compound`` and throws away what it cannot
    justify: a split is accepted only if every part is a word of at least
    ``MIN_PART`` letters that the corpus has actually seen, and if the parts
    spell the word when the linking elements are allowed for.
    """
    from german_nouns.lookup import Nouns
    from wordfreq import zipf_frequency

    global _nouns
    try:
        _nouns
    except NameError:
        _nouns = Nouns()
    try:
        raw = [p.lower() for p in _nouns.parse_compound(word.capitalize())]
    except Exception:
        return (word,)
    if len(raw) < 2:
        return (word,)
    if any(len(p) < MIN_PART or zipf_frequency(p, "de") < 2.5 for p in raw):
        return (word,)
    if not _spells(word, raw):
        return (word,)
    return tuple(raw)


def _spells(word: str, parts: list[str]) -> bool:
    """Whether the parts really spell the word, allowing linking elements."""
    links = ("", "s", "es", "n", "en", "er", "e", "ns")
    pos = 0
    for i, part in enumerate(parts):
        candidates = [part]
        if part.endswith("e"):
            candidates.append(part[:-1])
        for plain, umlaut in (("a", "ä"), ("o", "ö"), ("u", "ü"), ("au", "äu")):
            if plain in part:
                candidates.append(part.replace(plain, umlaut))
        hit = next((c for c in candidates if word.startswith(c, pos)), None)
        if hit is None:
            return False
        pos += len(hit)
        if i < len(parts) - 1:
            for link in sorted(links, key=len, reverse=True):
                if link and word.startswith(link, pos):
                    pos += len(link)
                    break
    return pos == len(word)


def infer_code(word: str, pool: set[str]) -> str:
    """Assign a code to a word whose old reason said nothing usable."""
    if word.endswith("in") and word[:-2] in pool:
        return "V"
    if word.endswith(("chen", "lein")) and len(word) > 7:
        return "V"
    parts = decompose(word)
    if len(parts) >= 3:
        return "K"
    if len(parts) == 2 and parts[-1] in pool:
        return "U"
    return "N"


def main() -> None:
    pool = read_pool()
    rejects = read_rejects()
    keep, drop = read_decisions()

    # A word on neither list is a candidate the generator proposed: striking it
    # writes it to the reject list, which is how the next run remembers not to
    # propose it again.
    fresh = set(drop) - set(pool) - set(rejects)

    # A measured gate is good at its job and wrong often enough that a human
    # ruling has to outrank it, so the protected list is restored last.
    protected = read_protected()
    overruled = sorted(protected & set(drop))
    new_pool = sorted(((set(pool) | keep) - set(drop)) | protected)
    new_set = set(new_pool)

    new_rejects: dict[str, str] = {}
    for word in sorted(set(rejects) | set(drop)):
        if word in new_set:
            continue
        if word in drop:
            code, note = drop[word], ""
        else:
            old = rejects[word]
            key = old.lower().strip()
            code = REASON_CODE.get(key)
            note = ""
            if code is None:
                code = infer_code(word, new_set)
                if key not in VAGUE:
                    note = f" [{old}]"
        new_rejects[word] = f"{code} {CODES[code]}{note}"

    write_pool(new_pool)
    write_rejects(new_rejects)

    added = sorted(new_set - set(pool))
    removed = sorted(set(pool) - new_set)
    if overruled:
        print(f"{len(overruled)} struck words restored by the protected list: "
              f"{', '.join(overruled[:8])}")
    print(f"pool {len(pool)} -> {len(new_pool)}  (+{len(added)} / -{len(removed)})")
    print(f"rejects {len(rejects)} -> {len(new_rejects)}  ({len(fresh)} newly refused candidates)")
    counts: dict[str, int] = {}
    for value in new_rejects.values():
        counts[value[0]] = counts.get(value[0], 0) + 1
    for code in sorted(counts, key=lambda c: -counts[c]):
        print(f"  {code} {CODES[code]}: {counts[code]}")


def de(number: int) -> str:
    """German thousands separator, as the rest of the repo writes numbers."""
    return f"{number:,}".replace(",", ".")


def de_years(words: int) -> str:
    return f"{words / 365:.1f}".replace(".", ",")


def write_pool(words: list[str]) -> None:
    header = f"""# The Kontexto solution pool: every word that may be an answer.
#
# The band comes from the original game, the filters are ours.
#
# **Where the words come from** (scripts/build-solution-pool.py). The archive of
# 1.461 Contexto answers says what that game draws from: median frequency rank
# 5.889, p90 24.699, mean length 6,0 letters, about 7% compounds, and a large
# share of abstract nouns (honesty, freedom, memory, luck, justice, registry).
# The pool this replaced sat at median rank 13.606, so it was drawn from a band
# roughly twice as rare, and that is why the game played harder than the
# original. The generator now walks the German frequency list to rank 25.000
# instead, which is where the original stops.
#
# **The gates that survive from this project** (all of them, unchanged): the
# word is in the vocabulary, the dictionary lists it as a common noun in its
# base form, it is no proper name, nothing on the profanity list, and it is
# German rather than an English loan that has not settled. A noun that the
# tagger reads as a verb or an adjective in lowercase is refused, which is what
# keeps particles and nominalised infinitives out.
#
# **The human gate.** Every candidate was read against the eight codes in
# backend/data/solution_rejects.txt, and the reading was done in frequency
# bands and semantic clusters rather than alphabetically, so that unequal
# treatment is visible. The deeper the band, the higher the bar: the German
# frequency list past rank 10.000 is mostly news, office and government
# vocabulary, and almost none of it is a word anyone says at home.
#
# **Two proxies are deliberately not gates.** The simulated player
# (scripts/playtest-pool.py) measures how the pool plays as a whole and is good
# at that, but per word it struck out the words for camera, clock, nose and
# Christmas. Corpus frequency is the other: it counts how often journalists
# write a word, so it undercounts household and children's words.
#
# The list is data, not output. Edit it by hand, keep it sorted, one word per
# line. scripts/recode-pool.py applies a reviewed pass to both files.
#
# {de(len(words))} words, about {de_years(len(words))} years of daily puzzles.

"""
    POOL.write_text(header + "\n".join(words) + "\n", encoding="utf-8")


def write_rejects(entries: dict[str, str]) -> None:
    codes = "\n".join(f"#   {code}  {text}" for code, text in CODES.items())
    header = f"""# Words that passed the automatic gates and were struck out by hand anyway.
# Kept so the next pass applies the same standard instead of arguing the same
# cases again. Format: word = code reason.
#
# The codes are the rubric. Nothing is struck without one:
#
{codes}
#
# Two rules carry most of the U entries:
#   - Basisebene (Rosch): a compound stays only if its head word alone does not
#     name the thing. "Wurst" names a Bratwurst, "Lampe" does not name a
#     Taschenlampe.
#   - known beats concrete and beats frequent: corpus frequency and the
#     concreteness norms are hints for the reading pass, never the decision.
#
# Text in brackets is the reason an earlier pass wrote down, kept where it says
# more than the code.
#
# {de(len(entries))} entries.

"""
    body = "\n".join(f"{word} = {reason}" for word, reason in entries.items())
    REJECTS.write_text(header + body + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
