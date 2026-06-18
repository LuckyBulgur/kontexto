"""Semantic filter for choosing Kontexto solution (target) words.

Background: target words used to be drawn straight from the top of the
fastText frequency list. In a web-crawl corpus that band is dense with proper
nouns (first names, surnames, cities, brands) and English web vocabulary, all
of which slip through a lowercasing + "is a known lemma" filter. The result was
solutions like ``emma``, ``merkel``, ``berlin``, ``school`` or ``music`` —
unfair for a *semantic* guessing game, because the neighbourhood of a name is
just other names.

This module guarantees that a target word is a genuine, guessable German
content word — a common noun, a full verb, or an adjective — and never a proper
noun, foreign word, or rare fragment. It layers four offline, deterministic
signals (no network, reproducible builds):

* **HanTa** (Hanover Tagger) — German POS tagging. The capitalised form must
  read as a common noun (``NN``); the lower-case form rescues verbs (``VV*``)
  and adjectives (``ADJ*``). Anything whose best reading is a proper noun
  (``NE``) is rejected.
* **german-nouns** (a Wiktionary-derived lexicon) — distinguishes a true common
  noun (a ``Substantiv`` entry with a declension table) from a mere given
  name / surname (``Vorname`` / ``Nachname`` / ``Eigenname``). This both
  *rescues* common nouns that double as a surname (``löwe``, ``rose``,
  ``stein``, ``sommer``) and *rejects* names that HanTa happens to tag ``NN``
  but that have no common-noun sense (``gloria`` style entries are kept; pure
  names like ``lotte`` are not).
* A bundled **name gazetteer** (`german_names.txt`, ~35k given names and
  surnames) — catches names that HanTa mis-tags ``NN`` *and* that Wiktionary
  does not even list as common nouns (``torsten``, ``jörn``). A gazetteer word
  survives only if it carries a genuine common-noun dictionary sense.
* **wordfreq** — German vs. English Zipf frequency. A high English frequency
  with a clear gap over German marks a foreign word (``music``) that HanTa
  tagged as a common noun. Established loanwords (``team``, ``code``) stay.

Precision over recall: it is fine to drop a borderline good word, never fine to
keep a name. The candidate pool is far larger than the number of games needed.
"""

from __future__ import annotations

import os

from HanTa import HanoverTagger as hnt
from wordfreq import zipf_frequency

# POS labels (in german-nouns) that mark a token as a proper noun rather than a
# common noun. A dictionary entry carrying any of these is not, on its own,
# evidence that the word is a common noun.
_PROPER_NOUN_POS = frozenset({"Vorname", "Nachname", "Eigenname", "Toponym",
                              "Familienname", "Patronym", "Künstlername",
                              "Abkürzung"})

# Tokens that must never be a solution and that no gazetteer / POS / dictionary
# signal reliably removes: brands, abbreviations, residual names/places that
# carry an obscure common-noun Wiktionary entry, and slurs / sensitive terms a
# word game should not surface. Hand-maintained; extend from the target audit.
NAME_BLOCKLIST: frozenset[str] = frozenset({
    # residual names / places with an obscure noun homograph
    "mac", "tate", "dixie", "maya", "alba", "este", "bosse", "lander",
    "russ", "florin", "asta", "dave", "devon", "bartel", "dino", "milan",
    "kai", "khan", "mars", "rom", "eden", "flora",
    # place / country names that slip past HanTa's NE tag
    "hamm", "homburg", "erlangen", "bremen", "münster", "china", "polen",
    "schweden", "jersey", "boston", "manchester",
    # brands / platforms
    "benz", "bmw", "xbox", "audi", "opel", "adidas", "nike", "google",
    "iphone", "android", "windows", "facebook", "youtube", "twitter",
    "instagram", "tiktok", "whatsapp", "amazon", "paypal", "netflix",
    "spotify", "samsung", "microsoft", "apple", "ebay", "telekom",
    # abbreviations that survive as "words"
    "abc", "abt", "dez", "jul", "navi",
    # blatant anglicisms with an everyday German equivalent (Denglisch); the
    # frequency filter keeps established loanwords (team, training, station) but
    # cannot separate these, so they are listed explicitly
    "beach", "account", "challenge", "apartment", "dinner", "shopping",
    "comedy", "empire", "campus", "crash", "coach", "award", "beauty",
    "client", "community", "button", "air", "gate", "fake", "tip", "tool",
    "user", "wifi", "bike", "cape", "grant", "mini", "cover",
    # bare fragments / archaic stubs that read as noise
    "mär", "par", "sur", "gran", "ried", "net", "abc",
    # slurs / sensitive terms — never acceptable as a puzzle solution
    "jude", "mohr", "neger", "zigeuner",
})

# Narrowly religious terms — excluded as solutions by content policy. Only
# unmistakably religious words; holidays (ostern, weihnachten) and secular-
# dominant homographs (himmel = sky, kreuz = intersection, messe = trade fair,
# seele, wunder) are deliberately NOT here. Exact-match (no substrings), so
# secular compounds like "messer"/"norden"/"durchmesser" are unaffected.
RELIGION_BLOCKLIST: frozenset[str] = frozenset({
    "gott", "gottheit", "götze", "gottesdienst", "gotteshaus",
    "kirche", "kirchturm", "kirchengemeinde", "kirchengebäude", "kirchspiel",
    "klosterkirche", "dorfkirche", "pfarrkirche", "landeskirche", "stadtkirche",
    "kloster", "kapelle", "altar", "hochaltar", "kruzifix", "rosenkranz",
    "bibel", "biblisch", "koran", "tora", "thora",
    "islam", "islamisch", "islamismus", "muslim", "muslime", "moslem", "moschee",
    "christ", "christen", "christentum", "christlich", "christus", "jesus",
    "judentum", "jüdisch", "synagoge", "rabbiner", "rabbi",
    "buddhismus", "buddha", "buddhistisch", "hinduismus", "hinduistisch",
    "papst", "papsttum", "bischof", "erzbischof", "kardinal",
    "pfarrer", "pfarrei", "pfarre", "pfarrhaus", "priester", "priesterin",
    "prediger", "predigt", "mönch", "nonne", "pastor",
    "religion", "religionen", "religiös", "sakrament", "messias",
    "prophet", "prophetin", "bischofsweihe", "priesterweihe",
    "hölle", "paradies", "sünde", "sündig", "sünder", "gebet", "heiligtum",
    "allah", "koscher", "ramadan", "sabbat", "tempel", "dom",
})

# Vulgar, sexual/FSK18, and strongly offensive terms — never acceptable as a
# puzzle *solution* (they stay fully guessable; this only governs the answer).
# Content policy after solutions like ``Arsch`` surfaced. Scope is deliberate:
# unambiguously crude/sexual/insulting words and slurs only. Homographs whose
# dominant sense is harmless (``Schwanz`` = tail, ``Sack`` = bag, ``Eier`` =
# eggs, ``geil`` = colloquial "great", ``blasen`` = to blow / bubbles) are NOT
# here — they remain valid solutions. Mild everyday words (``nackt``, ``kotzen``,
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
    # sexual violence — disturbing for a casual puzzle
    "vergewaltigung", "vergewaltigen", "vergewaltiger",
})

_NAMES_FILE = os.path.join(os.path.dirname(__file__), "german_names.txt")

# Everyday common nouns whose dominant meaning is a concrete, guessable word but
# that HanTa reads as a proper noun (``NE``) because the token is also a common
# German surname. They cannot be recovered automatically: in the dictionary they
# look exactly like a dominant name with an obscure noun homograph (``dirk`` =
# a halyard, ``franziska`` = a throwing axe), so each entry here is hand-verified
# as a word players would recognise as a thing, not a name. This allowlist is the
# ONLY way an ``NE`` / gazetteer word is kept — never add a name to it.
NOUN_RESCUE: frozenset[str] = frozenset({
    # animals & nature
    "löwe", "wolf", "fuchs", "vogel", "hahn", "rose", "linde", "busch",
    "wald", "baum", "berg", "fels", "mond", "stern", "horn", "blume",
    # people by trade / role (concrete, guessable; name sense secondary)
    "bäcker", "baumeister", "maurer", "koch", "jäger", "förster", "gärtner",
    "schmied", "schuster", "reiter", "engel",
    # concrete things that happen to be surnames
    "fund", "hebel", "schädel", "kiefer", "vulkan", "trockner", "kreuzer",
    "volt", "anker", "pfeil", "schild", "kranz", "graf",
})


def _load_gazetteer(path: str) -> frozenset[str]:
    try:
        with open(path, encoding="utf-8") as f:
            return frozenset(line.strip() for line in f if line.strip())
    except FileNotFoundError:
        return frozenset()


class TargetWordFilter:
    """Decides whether a (lowercased, base-form) German word may be a target.

    The filter owns a HanTa tagger and a Wiktionary noun lexicon; it is safe to
    reuse across the whole candidate set and caches per-word POS analysis.
    """

    _VERB_PREFIX = "VV"   # full verbs: VV(INF), VV(FIN), VV(IMP), VV(PP)
    _ADJ_PREFIX = "ADJ"   # ADJ(A) attributive, ADJ(D) predicative/adverbial

    def __init__(
        self,
        *,
        min_zipf_de: float = 2.0,
        foreign_en_floor: float = 4.0,
        foreign_margin: float = 1.0,
        model: str = "morphmodel_ger.pgz",
        names_file: str = _NAMES_FILE,
    ) -> None:
        self._tagger = hnt.HanoverTagger(model)
        self.min_zipf_de = min_zipf_de
        self.foreign_en_floor = foreign_en_floor
        self.foreign_margin = foreign_margin
        # A gazetteer of given names and surnames. Place names are deliberately
        # NOT bulk-loaded here: most are caught by HanTa's NE tag, and the few
        # that slip through (``rom``, ``hamm``) go in NAME_BLOCKLIST — a broad
        # town list would wrongly bury common words (``laufen``, ``essen``,
        # ``stein``, ``hof``) that merely happen to be town names too.
        self._names = _load_gazetteer(names_file)

        # german-nouns is imported lazily so the module can be inspected without
        # the (heavier) Wiktionary lexicon being importable.
        from german_nouns.lookup import Nouns

        self._nouns = Nouns()
        self._analyze_cache: dict[str, tuple[str, str]] = {}
        self._noun_sense_cache: dict[str, bool] = {}

    @staticmethod
    def _normalize(text: str) -> str:
        """Fold case and the ß/ss orthography so lemma comparison is robust."""
        return text.lower().replace("ß", "ss")

    def _analyze(self, form: str) -> tuple[str, str]:
        """HanTa (lemma, STTS-POS) for a surface form (cached)."""
        cached = self._analyze_cache.get(form)
        if cached is None:
            cached = self._tagger.analyze(form)
            self._analyze_cache[form] = cached
        return cached

    def _pos(self, form: str) -> str:
        """Most probable STTS POS tag for a surface form (cached)."""
        return self._analyze(form)[1]

    def _is_base_form(self, word: str, form: str) -> bool:
        """Whether *word* equals HanTa's lemma for *form* (i.e. not inflected).

        Catches plurals (``stunden`` → ``Stunde``) and participles / conjugated
        verbs (``verwendet`` → ``verwenden``) that the simplemma base-form check
        misses, while tolerating the ß/ss spelling reform.
        """
        return self._normalize(self._analyze(form)[0]) == self._normalize(word)

    def _has_common_noun_sense(self, word: str) -> bool:
        """Whether Wiktionary lists *word* as a declinable common noun.

        True only if some entry is a ``Substantiv`` with **no** proper-noun tag
        and an actual declension table or gender — i.e. a real common noun
        (``Sommer``, ``Löwe``), not merely a name that also has a Wiktionary
        page (``Sebastian``, ``Lotte``).
        """
        cached = self._noun_sense_cache.get(word)
        if cached is not None:
            return cached
        result = False
        for entry in self._nouns[word.capitalize()] or ():
            pos = set(entry.get("pos") or ())
            if "Substantiv" in pos and not (pos & _PROPER_NOUN_POS):
                if entry.get("genus") or entry.get("flexion"):
                    result = True
                    break
        self._noun_sense_cache[word] = result
        return result

    def _is_foreign(self, zipf_de: float, zipf_en: float) -> bool:
        """A word that is common in English and clearly more English than German.

        Established German loanwords (``team``, ``code``, ``training``) have a
        small or negative gap and are kept; true foreign words (``music``,
        ``house``, ``school``) sit well above their German frequency.
        """
        return zipf_en >= self.foreign_en_floor and (zipf_en - zipf_de) >= self.foreign_margin

    def reject_reason(self, word: str) -> str | None:
        """Return a reason code if the word is unsuitable, else ``None``.

        Reason codes: ``offensive``, ``too_rare``, ``proper_noun``,
        ``religious``, ``foreign``, ``inflected``, ``non_content``.
        """
        # ß→ss-folded so "scheiße" matches the "scheisse" entry; umlauts are
        # left intact (the blocklist lists them as they appear in the vocab).
        if word.replace("ß", "ss") in PROFANITY_BLOCKLIST:
            return "offensive"
        if word in NAME_BLOCKLIST:
            return "proper_noun"
        if word in RELIGION_BLOCKLIST:
            return "religious"

        zipf_de = zipf_frequency(word, "de")
        zipf_en = zipf_frequency(word, "en")

        if zipf_de < self.min_zipf_de:
            return "too_rare"

        cap = word.capitalize()
        cap_pos = self._pos(cap)
        low_pos = self._pos(word)
        noun_sense = self._has_common_noun_sense(word)

        def accept_noun() -> str | None:
            if not self._is_base_form(word, cap):   # reject plurals (stunden → Stunde)
                return "inflected"
            if self._is_foreign(zipf_de, zipf_en):
                return "foreign"
            return None

        if word in self._names:
            # A known name token. It survives only as a genuine common noun:
            # HanTa must read the capitalised form as NN *and* Wiktionary must
            # list a common-noun sense (``sommer``, ``könig``) — this rejects
            # pure names HanTa mis-tags NN (``sebastian``, ``torsten``). A few
            # concrete nouns that HanTa tags NE come back via the rescue list
            # (``löwe``, ``rose``); names with an obscure noun homograph
            # (``dirk`` = a halyard) stay rejected.
            if (cap_pos == "NN" and noun_sense) or word in NOUN_RESCUE:
                return accept_noun()
            return "proper_noun"

        # Not a known name. Prefer the noun reading: a common-noun dictionary
        # sense or an NN tag (covers compounds Wiktionary lacks) wins, even when
        # HanTa mis-reads the lower-cased form as an adjective (``haartrockner``).
        if noun_sense or cap_pos == "NN" or word in NOUN_RESCUE:
            return accept_noun()

        # Verbs and adjectives read in lower case (their capitalised form is a
        # nominalised infinitive or surname). Require a base form to drop
        # participles and conjugations (``verwendet`` → ``verwenden``).
        if low_pos.startswith(self._VERB_PREFIX) or low_pos.startswith(self._ADJ_PREFIX):
            if not self._is_base_form(word, word):
                return "inflected"
            if self._is_foreign(zipf_de, zipf_en):
                return "foreign"
            return None

        if cap_pos == "NE":
            return "proper_noun"

        # Foreign material (FM), unclassifiable tokens (XY), particles, etc.
        return "non_content"

    def is_valid_target(self, word: str) -> bool:
        """True iff the word is a sensible German content-word solution."""
        return self.reject_reason(word) is None
