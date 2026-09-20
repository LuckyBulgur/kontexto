"""Hand-maintained word lists shared by the offline pipeline and the runtime.

Split out of ``target_selection`` so that the API can use them without it. That
module imports HanTa and wordfreq at import time, which is right for an offline
pipeline and wrong for a request path: the matchmaking nickname filter needs one
frozenset, not a POS tagger.
"""

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
PROFANITY_BLOCKLIST: frozenset[str] = frozenset({
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

