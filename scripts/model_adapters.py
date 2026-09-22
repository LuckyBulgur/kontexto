"""The candidate embedding models, each behind one function.

Every adapter takes a list of words and returns ``{word: vector}``. What they
do internally differs a lot, and that is the point of the comparison:

``fasttext``        what the game ships today: static vectors from Common Crawl
                    plus Wikipedia, with this project's debias (mean and the
                    top three principal components removed, fitted on the core).
``fasttext-raw``    the same vectors without the debias, to show what the
                    debias is worth.
``potion``          Model2Vec, a 2025 distillation of BGE-M3 into static
                    vectors. Averages subword vectors, which is the failure
                    mode the string-contamination measure was written for.
``bge-m3``          the sentence transformer that currently ranks first for
                    German, each word encoded on its own.
``bge-m3-satz``     the same model, but the word wrapped in a short German
                    sentence, because a transformer was trained on sentences
                    and a bare token is out of distribution for it.
``e5-large``        multilingual E5, which wants its documented ``query:``
                    prefix.
``gbert``           a German BERT, mean pooled. The monolingual baseline.
``numberbatch``     ConceptNet Numberbatch, retrofitted onto a knowledge graph
                    and the winner of the SemEval task this bench measures.
``fasttext+bge``    both spaces normalised and concatenated, which is the
                    cheapest way to ask whether they know different things.

Each matrix is cached under ``.regen-work/embeddings`` so a second run is fast.
"""

from __future__ import annotations

import json
import pathlib
import sys

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
CACHE = ROOT / ".regen-work" / "embeddings"
CACHE.mkdir(parents=True, exist_ok=True)
VEC_FILE = ROOT / ".model-cache" / "cc.de.300.vec"
NUMBERBATCH = ROOT / ".model-cache" / "numberbatch-de.txt"


def _cached(name: str, words: list[str], build):
    """Compute vectors once per model and reuse them across runs."""
    key = CACHE / f"{name}-{len(words)}"
    npy, txt = key.with_suffix(".npy"), key.with_suffix(".json")
    if npy.exists() and txt.exists():
        have = json.load(open(txt, encoding="utf-8"))
        matrix = np.load(npy)
        return dict(zip(have, matrix))
    out = build(words)
    have = [w for w in words if w in out]
    if have:
        np.save(npy, np.vstack([out[w] for w in have]))
        json.dump(have, open(txt, "w", encoding="utf-8"))
    return out


def _stream_fasttext(words: list[str]) -> dict[str, np.ndarray]:
    wanted = set(words)
    out: dict[str, np.ndarray] = {}
    with open(VEC_FILE, encoding="utf-8", errors="replace") as handle:
        next(handle)
        for line in handle:
            parts = line.rstrip().split(" ")
            word = parts[0].lower()
            if word in wanted and word not in out:
                out[word] = np.asarray(parts[1:], dtype=np.float32)
                if len(out) == len(wanted):
                    break
    return out


def fasttext(words: list[str]) -> dict[str, np.ndarray]:
    def build(ws):
        from prepare import postprocess_vectors
        raw = _stream_fasttext(ws)
        # The served data fits the debias on the core lexicon, so the bench has
        # to do the same or it measures a space the game never serves.
        core = set(json.load(open(ROOT / ".regen-work" / "core-ship" / "core_words.json",
                                  encoding="utf-8")))
        fit = {w for w in raw if w in core} or set(raw)
        return postprocess_vectors(raw, fit_words=fit)
    return _cached("fasttext", words, build)


def fasttext_raw(words: list[str]) -> dict[str, np.ndarray]:
    return _cached("fasttext-raw", words, _stream_fasttext)


def _sentence_model(model_id: str, prefix: str = "", template: str = "{}",
                    trust: bool = False):
    def build(words: list[str]) -> dict[str, np.ndarray]:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer(model_id, trust_remote_code=trust)
        texts = [prefix + template.format(w) for w in words]
        matrix = model.encode(texts, batch_size=64, show_progress_bar=True,
                              convert_to_numpy=True, normalize_embeddings=True)
        return dict(zip(words, matrix))
    return build


def bge_m3(words: list[str]) -> dict[str, np.ndarray]:
    return _cached("bge-m3", words, _sentence_model("BAAI/bge-m3"))


def bge_m3_sentence(words: list[str]) -> dict[str, np.ndarray]:
    return _cached("bge-m3-satz", words,
                   _sentence_model("BAAI/bge-m3", template="Das Wort „{}“."))


def e5_large(words: list[str]) -> dict[str, np.ndarray]:
    return _cached("e5-large", words,
                   _sentence_model("intfloat/multilingual-e5-large", prefix="query: "))


def gbert(words: list[str]) -> dict[str, np.ndarray]:
    return _cached("gbert", words, _sentence_model("deepset/gbert-large"))


def potion(words: list[str]) -> dict[str, np.ndarray]:
    def build(ws):
        from model2vec import StaticModel
        model = StaticModel.from_pretrained("minishlab/potion-multilingual-128M")
        return dict(zip(ws, model.encode(ws, show_progress_bar=False)))
    return _cached("potion", words, build)


def numberbatch(words: list[str]) -> dict[str, np.ndarray]:
    def build(ws):
        if not NUMBERBATCH.exists():
            raise FileNotFoundError(
                "run scripts/fetch-numberbatch.sh first (3,2 GB download)")
        wanted = set(ws)
        out: dict[str, np.ndarray] = {}
        with open(NUMBERBATCH, encoding="utf-8", errors="replace") as handle:
            for line in handle:
                parts = line.rstrip().split(" ")
                word = parts[0].rsplit("/", 1)[-1].lower()
                if word in wanted and word not in out:
                    out[word] = np.asarray(parts[1:], dtype=np.float32)
        return out
    return _cached("numberbatch", words, build)


def _combine(*adapters):
    def build(words: list[str]) -> dict[str, np.ndarray]:
        spaces = [a(words) for a in adapters]
        shared = set(spaces[0])
        for space in spaces[1:]:
            shared &= set(space)
        out = {}
        for word in shared:
            pieces = []
            for space in spaces:
                vector = space[word].astype(np.float32)
                norm = np.linalg.norm(vector)
                pieces.append(vector / norm if norm else vector)
            out[word] = np.concatenate(pieces)
        return out
    return build


def fasttext_plus_bge(words: list[str]) -> dict[str, np.ndarray]:
    return _combine(fasttext, bge_m3)(words)


def fasttext_plus_numberbatch(words: list[str]) -> dict[str, np.ndarray]:
    return _combine(fasttext, numberbatch)(words)


MODELS = {
    "fasttext": fasttext,
    "fasttext-raw": fasttext_raw,
    "potion": potion,
    "bge-m3": bge_m3,
    "bge-m3-satz": bge_m3_sentence,
    "e5-large": e5_large,
    "gbert": gbert,
    "numberbatch": numberbatch,
    "fasttext+bge": fasttext_plus_bge,
    "fasttext+numberbatch": fasttext_plus_numberbatch,
}


OPENTHESAURUS = ROOT / ".model-cache" / "openthesaurus.txt"

#: Retrofitting strength: how hard a word is pulled towards its synonyms
#: against how hard it is held at its original place. Faruqui et al. 2015 use
#: one pull per neighbour against one hold, which is the 1.0 here.
RETROFIT_ALPHA = 1.0
RETROFIT_ROUNDS = 12


def _thesaurus_groups() -> list[list[str]]:
    """Synonym groups from OpenThesaurus, stripped of the usage markers.

    Entries carry parenthesised notes such as the marks for colloquial or
    technical usage, and those are not part of the word.
    """
    import re
    groups = []
    for line in OPENTHESAURUS.read_text(encoding="utf-8").splitlines():
        words = []
        for part in line.split(";"):
            word = re.sub(r"\([^)]*\)", "", part).strip().lower()
            if word and " " not in word and word.isalpha():
                words.append(word)
        if len(words) > 1:
            groups.append(words)
    return groups


def _retrofit(base, name: str):
    """Pull a space towards a German synonym graph, after Faruqui et al. 2015.

    The game asks how related two words are, and a distributional space answers
    how alike their contexts are. Those differ most exactly where this project
    hurts, so the synonym graph is the cheapest way to add real relations to a
    space that only ever saw text.
    """
    def build(words: list[str]) -> dict[str, np.ndarray]:
        space = base(words)
        have = [w for w in words if w in space]
        # The index has to number the rows of the matrix, not the input list:
        # a word the base space does not cover shifts every later position.
        index = {w: i for i, w in enumerate(have)}
        matrix = np.vstack([space[w] for w in have]).astype(np.float32)
        matrix /= np.maximum(np.linalg.norm(matrix, axis=1, keepdims=True), 1e-9)
        original = matrix.copy()

        neighbours: dict[int, list[int]] = {}
        for group in _thesaurus_groups():
            present = [index[w] for w in group if w in index]
            for i in present:
                neighbours.setdefault(i, []).extend(j for j in present if j != i)
        linked = [(i, np.array(sorted(set(js)))) for i, js in neighbours.items() if js]
        for _ in range(RETROFIT_ROUNDS):
            for i, js in linked:
                pull = matrix[js].sum(axis=0)
                matrix[i] = (pull + RETROFIT_ALPHA * len(js) * original[i]) / (2.0 * len(js))
            matrix /= np.maximum(np.linalg.norm(matrix, axis=1, keepdims=True), 1e-9)
        return {w: matrix[i] for i, w in enumerate(have)}
    return lambda words: _cached(name, words, build)


fasttext_retrofit = _retrofit(fasttext, "fasttext-retrofit")
bge_retrofit = _retrofit(bge_m3_sentence, "bge-satz-retrofit")

MODELS["fasttext-retrofit"] = fasttext_retrofit
MODELS["bge-satz-retrofit"] = bge_retrofit
