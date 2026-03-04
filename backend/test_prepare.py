import numpy as np


def test_filter_vocabulary_removes_short_words():
    from prepare import filter_vocabulary
    fake_words = {"a": np.random.rand(300), "ab": np.random.rand(300),
                  "hund": np.random.rand(300), "katze": np.random.rand(300), "x": np.random.rand(300)}
    result = filter_vocabulary(fake_words)
    assert "a" not in result
    assert "x" not in result
    assert "hund" in result
    assert "katze" in result


def test_filter_vocabulary_removes_non_alpha():
    from prepare import filter_vocabulary
    fake_words = {"hund": np.random.rand(300), "test123": np.random.rand(300),
                  "hello-world": np.random.rand(300), "küche": np.random.rand(300),
                  "http://x": np.random.rand(300), "12345": np.random.rand(300)}
    result = filter_vocabulary(fake_words)
    assert "hund" in result
    assert "küche" in result
    assert "test123" not in result
    assert "http://x" not in result
    assert "12345" not in result


def test_filter_vocabulary_removes_stopwords():
    from prepare import filter_vocabulary
    fake_words = {"der": np.random.rand(300), "die": np.random.rand(300),
                  "und": np.random.rand(300), "hund": np.random.rand(300), "oder": np.random.rand(300)}
    result = filter_vocabulary(fake_words)
    assert "der" not in result
    assert "die" not in result
    assert "und" not in result
    assert "hund" in result


def test_filter_vocabulary_lowercases():
    from prepare import filter_vocabulary
    fake_words = {"Hund": np.random.rand(300), "KATZE": np.random.rand(300), "Schule": np.random.rand(300)}
    result = filter_vocabulary(fake_words)
    assert "hund" in result
    assert "katze" in result
    assert "schule" in result
    assert "Hund" not in result


def test_compute_rankings_returns_correct_ranks():
    from prepare import compute_rankings
    vectors = {"target": np.array([1.0, 0.0, 0.0]), "close": np.array([0.9, 0.1, 0.0]), "far": np.array([0.0, 0.0, 1.0])}
    vocab_list = ["target", "close", "far"]
    ranks = compute_rankings("target", vocab_list, vectors)
    assert ranks[0] == 1
    assert ranks[1] == 2
    assert ranks[2] == 3


def test_compute_rankings_dtype_is_uint16():
    from prepare import compute_rankings
    vectors = {"target": np.array([1.0, 0.0]), "other": np.array([0.5, 0.5])}
    vocab_list = ["target", "other"]
    ranks = compute_rankings("target", vocab_list, vectors)
    assert ranks.dtype == np.uint16


def test_create_bloom_filter_contains_known_words():
    from prepare import create_bloom_filter
    words = ["hund", "katze", "maus", "schule", "wasser"]
    bf = create_bloom_filter(words)
    for w in words:
        assert w in bf


def test_create_bloom_filter_rejects_unknown_words():
    from prepare import create_bloom_filter
    words = ["hund", "katze", "maus"]
    bf = create_bloom_filter(words)
    assert "xyzzyplugh" not in bf
    assert "qwertyuiop12345" not in bf


def test_create_lemma_map():
    from prepare import create_lemma_map
    vocab = ["hund", "katze", "schule", "wasser"]
    lmap = create_lemma_map(vocab)
    assert isinstance(lmap, dict)
    for inflected, base in lmap.items():
        assert base in vocab


def test_filter_vocabulary_respects_max_length():
    from prepare import filter_vocabulary
    fake_words = {
        "hund": np.random.rand(300),
        "blechbearbeitungsmaschinenreinigung": np.random.rand(300),
        "katze": np.random.rand(300),
    }
    result = filter_vocabulary(fake_words, max_length=25)
    assert "hund" in result
    assert "katze" in result
    assert "blechbearbeitungsmaschinenreinigung" not in result


def test_filter_vocabulary_respects_vocab_size():
    from prepare import filter_vocabulary
    # Use real German words that pass simplemma.is_known check
    words = [
        "hund", "katze", "maus", "haus", "baum", "berg", "feld", "wald",
        "fluss", "stadt", "land", "meer", "fisch", "vogel", "blume",
        "sonne", "mond", "stern", "wolke", "regen",
    ]
    fake_words = {w: np.random.rand(300) for w in words}
    result = filter_vocabulary(fake_words, vocab_size=10)
    assert len(result) == 10


def test_filter_vocabulary_removes_english_words():
    from prepare import filter_vocabulary
    fake_words = {
        "hund": np.random.rand(300),
        "employer": np.random.rand(300),
        "strategic": np.random.rand(300),
        "katze": np.random.rand(300),
        "leverage": np.random.rand(300),
        "voice": np.random.rand(300),
    }
    result = filter_vocabulary(fake_words)
    assert "hund" in result
    assert "katze" in result
    assert "employer" not in result
    assert "strategic" not in result
    assert "leverage" not in result
    assert "voice" not in result


def test_select_target_words_prefers_nouns():
    from prepare import select_target_words
    vocab = ["apfel", "birne", "schnell", "laufen", "haus", "kirsche"]
    vectors = {w: np.random.rand(300) for w in vocab}
    raw_words = {"Apfel", "apfel", "Birne", "birne", "schnell", "laufen", "Haus", "haus", "Kirsche", "kirsche"}
    result = select_target_words(vocab, vectors, raw_words=raw_words, n=10)
    for w in result:
        assert w[0].upper() + w[1:] in raw_words
