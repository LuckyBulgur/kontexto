"""Semantic filter for choosing Kontexto solution (target) words.

Background: target words used to be drawn straight from the top of the
fastText frequency list. In a web-crawl corpus that band is dense with proper
nouns (first names, surnames, cities, brands) and English web vocabulary, all
of which slip through a lowercasing + "is a known lemma" filter. The result was
solutions like ``emma``, ``merkel``, ``berlin``, ``school`` or ``music``. Those are
unfair for a *semantic* guessing game, because the neighbourhood of a name is
just other names.

This module guarantees that a target word is a genuine, guessable German
content word, and never a proper noun, foreign word, or rare fragment.

Since 2026-09-21 it guarantees two further things, both defaults and both
switchable off for the scripts that maintain older pools: a target is a **common
noun** (``nouns_only``), and it is **concrete** (``require_concrete``). Verbs and
adjectives stay legal guesses, they just stop being solutions. The reasons are
measured and written up in ``docs/plans/2026-09-21-concrete-noun-pool.md``.

It layers five offline, deterministic signals (no network, reproducible builds):

* **HanTa** (Hanover Tagger): German POS tagging. The capitalised form must
  read as a common noun (``NN``); the lower-case form rescues verbs (``VV*``)
  and adjectives (``ADJ*``). Anything whose best reading is a proper noun
  (``NE``) is rejected.
* **german-nouns** (a Wiktionary-derived lexicon): distinguishes a true common
  noun (a ``Substantiv`` entry with a declension table) from a mere given
  name / surname (``Vorname`` / ``Nachname`` / ``Eigenname``). This both
  *rescues* common nouns that double as a surname (``löwe``, ``rose``,
  ``stein``, ``sommer``) and *rejects* names that HanTa happens to tag ``NN``
  but that have no common-noun sense (``gloria`` style entries are kept; pure
  names like ``lotte`` are not).
* A bundled **name gazetteer** (`german_names.txt`, ~35k given names and
  surnames): catches names that HanTa mis-tags ``NN`` *and* that Wiktionary
  does not even list as common nouns (``torsten``, ``jörn``). A gazetteer word
  survives only if it carries a genuine common-noun dictionary sense.
* **wordfreq**: German vs. English Zipf frequency. A high English frequency
  with a clear gap over German marks a foreign word (``music``) that HanTa
  tagged as a common noun. Established loanwords (``team``, ``code``) stay.
* **Concreteness norms** (``data/concrete_nouns.txt``, derived by
  ``scripts/build-concreteness-list.py``): a target must name something a
  player can picture. This is what separates a fair compound from an
  administrative one, which no suffix rule manages.

Precision over recall: it is fine to drop a borderline good word, never fine to
keep a name. The candidate pool is far larger than the number of games needed.
"""

from __future__ import annotations

import os

from HanTa import HanoverTagger as hnt
from wordfreq import zipf_frequency

from wordlists import SOLUTION_BLOCKLIST

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
    # surnames and brands found in the 2026-09-20 pool extension: none of them
    # has an everyday common-noun sense, unlike the many surnames that do
    # (bergmann, hahn, fuhrmann, koch) and that the filter rightly rescues.
    "hübner", "riedel", "orion",
    # brands / platforms
    "jeep", "benz", "bmw", "xbox", "audi", "opel", "adidas", "nike", "google",
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
    # slurs / sensitive terms, never acceptable as a puzzle solution
    "jude", "mohr", "neger", "zigeuner",
})

# Narrowly religious terms, excluded as solutions by content policy. Only
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
    # Found by the hand audit of the rebuilt pool, 2026-09-21: church buildings
    # that carry a saint's name, liturgical objects and roles, and the church
    # calendar. Secular homographs stay out of this list, as before.
    "altarraum", "basilika", "beichtstuhl", "burka", "christkind",
    "christuskirche", "diakon", "domkapitel", "domkirche", "erstkommunion",
    "firmung", "frauenkirche", "gebetbuch", "gesangbuch", "gipfelkreuz",
    "holzkreuz", "hostie", "jesuskind", "johanneskirche", "kanzel",
    "kathedrale", "kelch", "kirchenmusiker", "kirchenraum", "kirchenschiff",
    "klosterhof", "kreuzgang", "kreuzweg", "krippenspiel", "krypta",
    "marienkirche", "martinskirche", "messdiener", "minarett", "monstranz",
    "nikolaikirche", "organist", "osternacht", "palmsonntag", "petersdom",
    "peterskirche", "petersplatz", "pilger", "posaunenchor",
    "priesterseminar", "prozession", "sakristei", "schlosskapelle",
    "schlosskirche", "schrein", "schutzengel", "sternsinger", "stiftskirche",
    "tabernakel", "wallfahrer", "weihrauch",
})

# Words that clear every automatic gate and still must not be a solution. The
# file carries the reasons, grouped: word classes the tagger misreads, brands,
# places, nationalities, weapons and atrocity, drugs, sexual content, dated
# terms for people, and words no player could converge on. It is the written
# result of reading every proposed solution by hand.
_UNFAIR_FILE = os.path.join(os.path.dirname(__file__), "data", "unfair_targets.txt")


_NAMES_FILE = os.path.join(os.path.dirname(__file__), "german_names.txt")

# Vocabulary words the German affective norms rate as concrete, generated by
# ``scripts/build-concreteness-list.py``. Measured against production on
# 2026-09-21, this is the strongest single predictor of how hard a solution
# plays: below 4.0 a target costs 118 guesses per solve, at 7.0 and above 48.
# Frequency, the signal the pool used to be built on, separates the same words
# by barely a third. The threshold baked into the file is 6.0.
_CONCRETE_FILE = os.path.join(os.path.dirname(__file__), "data", "concrete_nouns.txt")

# Everyday common nouns whose dominant meaning is a concrete, guessable word but
# that HanTa reads as a proper noun (``NE``) because the token is also a common
# German surname. They cannot be recovered automatically: in the dictionary they
# look exactly like a dominant name with an obscure noun homograph (``dirk`` =
# a halyard, ``franziska`` = a throwing axe), so each entry here is hand-verified
# as a word players would recognise as a thing, not a name. This allowlist is the
# ONLY way an ``NE`` / gazetteer word is kept; never add a name to it.
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


# Everyday, unmistakably picturable things that the concreteness norms simply
# do not list. The norms are automatically generated and their coverage has
# holes: they carry an entry for the German words for DIY store and cotton, but
# none at all for the word for tree. Each entry here was checked to be unrated
# (not merely rated low) and to pass every other gate. It is deliberately short:
# 889 vocabulary words are unrated and otherwise valid, and the overwhelming
# majority of those are function words, brands and slurs that the concreteness
# gate is quietly doing a good job of removing.
CONCRETE_RESCUE: frozenset[str] = frozenset({
    # plants and nature
    "baum", "tanne", "palme", "samen", "tsunami", "hurrikan",
    # food
    "popcorn", "pommes", "zucchini", "avocado", "brokkoli", "lasagne",
    "cappuccino",
    # things and devices
    "akku", "drohne", "tablette", "granate", "domino", "snowboard",
    "skateboard", "dirndl", "schmiede",
    # animals and the body
    "känguru", "wade",
})


def _load_gazetteer(path: str) -> frozenset[str]:
    try:
        with open(path, encoding="utf-8") as f:
            return frozenset(line.strip() for line in f if line.strip())
    except FileNotFoundError:
        return frozenset()


def _load_word_list(path: str) -> frozenset[str]:
    """One word per line. Blanks are skipped, and ``#`` starts a comment.

    A comment may follow a word on its own line, so a single entry can carry the
    reason it is there without a paragraph above it.
    """
    try:
        with open(path, encoding="utf-8") as f:
            words = (line.split("#", 1)[0].strip() for line in f)
            return frozenset(w for w in words if w)
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
        nouns_only: bool = True,
        require_concrete: bool = True,
        concrete_file: str = _CONCRETE_FILE,
    ) -> None:
        self._tagger = hnt.HanoverTagger(model)
        self.min_zipf_de = min_zipf_de
        self.foreign_en_floor = foreign_en_floor
        self.foreign_margin = foreign_margin
        # The two product rules that make a solution guessable rather than
        # merely legal. Both default to on, because that is what the live pool
        # is built from. The scripts that maintain the older Kontexto and
        # Woerdle pools switch them off explicitly, so their behaviour does not
        # change under them.
        self.nouns_only = nouns_only
        self.require_concrete = require_concrete
        self._concrete = _load_word_list(concrete_file) if require_concrete else frozenset()
        # The hand audit applies to the product rule only: the older pools were
        # built before it existed and must stay reproducible.
        self._unfair = _load_word_list(_UNFAIR_FILE) if nouns_only else frozenset()
        if require_concrete and not self._concrete:
            raise RuntimeError(
                f"concreteness list missing or empty: {concrete_file}. "
                "Run scripts/build-concreteness-list.py, or pass require_concrete=False."
            )
        # A gazetteer of given names and surnames. Place names are deliberately
        # NOT bulk-loaded here: most are caught by HanTa's NE tag, and the few
        # that slip through (``rom``, ``hamm``) go in NAME_BLOCKLIST. A broad
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
        and an actual declension table or gender, i.e. a real common noun
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
        ``religious``, ``foreign``, ``inflected``, ``non_content``,
        ``not_noun``, ``abstract``, ``unfair``.
        """
        # ß→ss-folded so "scheiße" matches the "scheisse" entry; umlauts are
        # left intact (the blocklist lists them as they appear in the vocab).
        if word.replace("ß", "ss") in SOLUTION_BLOCKLIST:
            return "offensive"
        if word in NAME_BLOCKLIST:
            return "proper_noun"
        if word in self._unfair:
            return "unfair"
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
            # An unrated word is rejected too: the norms cover 54% of the
            # vocabulary, the pool is far larger than the games needed, and a
            # word nothing vouches for is exactly the kind that plays badly.
            if (self.require_concrete
                    and word not in self._concrete
                    and word not in CONCRETE_RESCUE):
                return "abstract"
            return None

        if word in self._names:
            # A known name token. It survives only as a genuine common noun:
            # HanTa must read the capitalised form as NN *and* Wiktionary must
            # list a common-noun sense (``sommer``, ``könig``). This rejects
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
            # A nominalised infinitive still reads as NN when capitalised, so
            # the noun path would quietly re-admit the verbs the product rule
            # just excluded. A genuine noun is never tagged VV in lower case;
            # the ones HanTa mis-reads come back as ADJ, and those are handled
            # by the branch below.
            # A dictionary noun entry settles it; without one, a VV reading in
            # lower case means the word only looks like a noun capitalised.
            if (self.nouns_only
                    and low_pos.startswith(self._VERB_PREFIX)
                    and not noun_sense):
                return "not_noun"
            return accept_noun()

        # Verbs and adjectives read in lower case (their capitalised form is a
        # nominalised infinitive or surname). Require a base form to drop
        # participles and conjugations (``verwendet`` → ``verwenden``).
        if low_pos.startswith(self._VERB_PREFIX) or low_pos.startswith(self._ADJ_PREFIX):
            # They remain legal *guesses*; this filter only decides solutions.
            # Production data: an adjective solution costs 115 guesses per solve
            # against 73 for a concrete noun, and the reference implementation
            # publishes roughly 98% nouns.
            if self.nouns_only:
                return "not_noun"
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
