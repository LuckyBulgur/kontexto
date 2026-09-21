"""The one nickname rule, for every room in the game.

A name is the only free text this game has, it is shown to everyone in the room,
and an invite link gets forwarded. So the rule cannot live in the matchmaking
queue alone; it lives here and every mode calls it.

An abusive name is not rejected, it is **bent back onto its author**: whoever
types ``Hurensohn`` plays the round as ``Ich bin H*******n``. That is on purpose
and it is three decisions at once.

* The insult is taken away from the room. Nobody else has to read it, the word
  itself never reaches the player list unmasked, and an ad-funded page stays
  presentable.
* The player still gets an answer, and it is the one they earned.
* Nothing tells them the filter fired. No error, no toast, no second try. A
  rejection with a message is a probe: type, read the error, adjust, repeat. A
  silent rename gives the prober nothing to calibrate against.

The module is deliberately free of imports from the modes, so ``duel``, ``koop``,
``arena``, ``wordle_duel`` and ``matchmaking`` can all depend on it.
"""

from __future__ import annotations

import random

from wordlists import find_profanity

# What a player may type. The API models carry the same bound.
MAX_TYPED_NICKNAME = 20

# What the server may produce. Longer than the typed bound, because "Ich bin "
# costs eight characters before the masked word starts.
MAX_STORED_NICKNAME = 24

_FRAME = "Ich bin "


# --- Generated names --------------------------------------------------------

_ADJECTIVES = (
    "Flinke", "Stille", "Kluge", "Wache", "Kuehne", "Feine", "Ruhige", "Helle",
    "Rasche", "Zaehe", "Muntere", "Weise", "Frische", "Kesse", "Sanfte", "Freche",
)

_NOUNS = (
    "Eule", "Otter", "Elster", "Dohle", "Amsel", "Marder", "Luchs", "Gemse",
    "Robbe", "Biene", "Hummel", "Libelle", "Forelle", "Krabbe", "Kroete", "Meise",
)


def generate_nickname() -> str:
    """A neutral German name for a player who did not choose one.

    Two words plus a small number: short enough to read in a player list, varied
    enough that a room of eight rarely shows the same name twice.
    """
    return f"{random.choice(_ADJECTIVES)} {random.choice(_NOUNS)} {random.randint(2, 99)}"


# --- The rule ---------------------------------------------------------------


def mask_term(term: str) -> str:
    """Spell a blocklist term with its middle starred out.

    ``hurensohn`` becomes ``H*******n``. First and last letter survive, so the
    word stays recognisable to the one person who is supposed to recognise it,
    and unreadable as an insult to everyone else. Three letters or fewer keep
    only their first, because a mask of one star hides nothing.

    The term comes from the blocklist, never from the typed text, so the mask is
    the same for ``HURENSOHN``, ``h u r e n s o h n`` and ``hur3nsohn``.
    """
    if len(term) <= 3:
        return term[0].upper() + "*" * (len(term) - 1)

    body = "*" * (len(term) - 2)
    # "Ich bin " plus first letter plus last letter is ten characters; whatever
    # is left of the budget is the star run. A very long entry (a whole phrase,
    # of which the list has some) would otherwise blow up every player list.
    budget = MAX_STORED_NICKNAME - len(_FRAME) - 2
    if len(body) > budget:
        body = "*" * budget
    return term[0].upper() + body + term[-1]


def is_nickname_shaped(name: str) -> bool:
    """Whether the string is usable as a name at all, profanity aside.

    Length and control characters only. A name that fails here has nothing to
    reflect back, so it gets a generated one.
    """
    stripped = name.strip()
    if not 1 <= len(stripped) <= MAX_TYPED_NICKNAME:
        return False
    return all(ord(ch) >= 32 for ch in stripped)


def sanitize_nickname(requested: str | None) -> str:
    """The name this player will carry into the room.

    Clean input is returned as typed. An unusable one (empty, over-long, control
    characters) gets a generated name. An abusive one gets the masked reflection.

    Idempotent: ``Ich bin H*******n`` carries no term any more, so running this
    twice changes nothing. That matters because the matchmaking path hands
    already-sanitized names on to the room constructors, which sanitize again.
    """
    if requested is None or not is_nickname_shaped(requested):
        return generate_nickname()

    stripped = requested.strip()
    term = find_profanity(stripped, collapse_words=True)
    if term is None:
        return stripped
    return _FRAME + mask_term(term)
