"""Solution categories: the shipped data, the filtered draw, and every room door.

Three layers, each held on its own:

* **The data** (``data/categories.txt``, ``data/solution_categories.txt``). It
  is hand-kept, so a typo must fail here rather than quietly drop a field: every
  pool word has exactly one line, every field is big enough to play, and no
  solution sits in a field whose own name would show it.
* **The draw** (``GameState``). A filter never hands out a game outside it, and
  it keeps every rule the unfiltered draw already had: never the daily, never a
  game before the first curated one, never a struck game.
* **The doors** (``main.py``). The solo endpoint and all four room kinds take a
  filter; a room shows the round's field only when it was created to show it,
  so nobody in a room sees it alone, and no response gains the game number.
"""

import asyncio
import json
import os
import pickle  # nosec - the bloom fixture is written the way prepare.py writes it
import tempfile

import aiosqlite
import numpy as np
import pytest
from fastapi.testclient import TestClient
from pybloom_live import BloomFilter

import categories as cat
import core_lexicon
from database import init_db
from game import GameState

POOL_FILE = os.path.join(cat.DATA_DIR, "solution_pool.txt")
REAL_DATA_DIR = os.environ.get(
    "KONTEXTO_DATA_DIR", os.path.join(os.path.dirname(__file__), "..", "data")
)


def _pool() -> list[str]:
    with open(POOL_FILE, encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip() and not line.startswith("#")]


def _assignment_words() -> list[str]:
    """The assignment's words in file order, for the sort check."""
    with open(cat.ASSIGNMENT_FILE, encoding="utf-8") as f:
        return [line.split(" = ")[0].strip() for line in f
                if line.strip() and not line.startswith("#")]


# --- the shipped data -------------------------------------------------------


class TestShippedData:
    def test_the_catalogue_parses_and_every_field_has_seeds(self):
        catalogue = cat.read_catalogue()
        assert len(catalogue) >= 10
        for category in catalogue:
            assert category.name.strip()
            assert len(category.seeds) >= 5, category.id
            assert len(set(category.seeds)) == len(category.seeds), category.id
            assert all(seed == seed.lower() for seed in category.seeds), category.id

    def test_every_pool_word_has_exactly_one_line(self):
        fields = cat.get_categories()
        pool = _pool()
        assert set(_assignment_words()) == set(pool)
        assert all(fields.knows(word) for word in pool)

    def test_the_assignment_is_sorted_like_the_pool(self):
        assert _assignment_words() == _pool()

    def test_every_field_is_big_enough_to_play(self):
        fields = cat.get_categories()
        counts: dict[str, int] = {}
        for word in _pool():
            field = fields.of_word(word)
            if field is not None:
                counts[field] = counts.get(field, 0) + 1
        small = {ident: counts.get(ident, 0) for ident in fields.ids
                 if counts.get(ident, 0) < cat.MIN_PLAYABLE}
        assert small == {}

    def test_no_solution_sits_in_a_field_its_name_gives_away(self):
        fields = cat.get_categories()
        exposed = []
        for word in _pool():
            field = fields.of_word(word)
            if field is not None and word in cat.name_forms(fields.get(field).name):
                exposed.append((word, field))
        assert exposed == []

    def test_the_word_on_the_round_header_has_no_field(self):
        # The round header reads "Kategorie: <name>", so the solution
        # "kategorie" would be printed above its own board.
        assert cat.get_categories().of_word("kategorie") is None

    def test_a_struck_solution_is_not_in_the_assignment(self):
        unfit = core_lexicon.load_child_unfit_solutions()
        fields = cat.get_categories()
        assert [w for w in unfit if fields.of_word(w) is not None] == []


real_data = pytest.mark.skipif(
    not os.path.exists(os.path.join(REAL_DATA_DIR, core_lexicon.EVERYDAY_FILE)),
    reason="needs a real data directory",
)


@real_data
def test_every_field_is_big_enough_on_the_deployed_data():
    counts = GameState(REAL_DATA_DIR).category_counts()
    fields = cat.get_categories()
    assert {i: counts.get(i, 0) for i in fields.ids if counts.get(i, 0) < cat.MIN_PLAYABLE} == {}


# --- the module -------------------------------------------------------------


class TestModule:
    def test_name_forms_strip_plural_endings(self):
        assert {"tier", "tiere"} <= cat.name_forms("Tiere")
        assert {"mensch", "familie"} <= cat.name_forms("Familie und Menschen")
        assert "material" in cat.name_forms("Stoffe und Materialien")
        assert "und" not in cat.name_forms("Essen und Trinken")

    def test_parse_accepts_a_query_and_a_list(self):
        fields = cat.get_categories()
        assert fields.parse("animals, food,") == frozenset({"animals", "food"})
        assert fields.parse(["food"]) == frozenset({"food"})
        assert fields.parse("") == frozenset()
        assert fields.parse(None) == frozenset()

    def test_parse_refuses_an_unknown_id(self):
        with pytest.raises(cat.CategoryError):
            cat.get_categories().parse("animals,dragons")

    def test_a_stored_filter_round_trips_in_catalogue_order(self):
        stored = cat.encode_filter(["food", "animals"])
        assert stored == "animals,food"
        assert cat.decode_filter(stored) == ["animals", "food"]

    def test_a_stored_id_the_catalogue_dropped_is_ignored(self):
        assert cat.decode_filter("animals,merged") == ["animals"]
        assert cat.decode_filter("") == []

    def test_a_malformed_assignment_line_fails_loudly(self, tmp_path):
        bad = tmp_path / "assignment.txt"
        bad.write_text("hund = dragons\n", encoding="utf-8")
        with pytest.raises(cat.CategoryError):
            cat.read_assignment(["animals"], str(bad))
        twice = tmp_path / "twice.txt"
        twice.write_text("hund = animals\nhund = animals\n", encoding="utf-8")
        with pytest.raises(cat.CategoryError):
            cat.read_assignment(["animals"], str(twice))


# --- the draw and the doors -------------------------------------------------

# Game 1 is the daily (KONTEXTO_FORCE_GAME). Fields come from the shipped
# assignment: apfel, birne, kirsche are food; hund, katze animals; auto
# transport; tier has none.
TARGETS = ["apfel", "birne", "kirsche", "hund", "katze", "auto", "tier"]
VOCAB = TARGETS + ["haus"]


@pytest.fixture
def data_dir():
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        vocab = {word: index for index, word in enumerate(VOCAB)}
        with open(os.path.join(tmpdir, "vocabulary.json"), "w", encoding="utf-8") as f:
            json.dump(vocab, f)
        with open(os.path.join(tmpdir, "lemma_map.json"), "w", encoding="utf-8") as f:
            json.dump({}, f)
        bloom = BloomFilter(capacity=100, error_rate=0.01)
        for word in vocab:
            bloom.add(word)
        with open(os.path.join(tmpdir, "bloom.bin"), "wb") as f:  # nosec
            pickle.dump(bloom, f)
        with open(os.path.join(tmpdir, "target_words.json"), "w", encoding="utf-8") as f:
            json.dump(TARGETS, f)
        with open(os.path.join(tmpdir, "metadata.json"), "w", encoding="utf-8") as f:
            json.dump({"start_date": "2026-01-01", "vocab_size": len(VOCAB)}, f)
        games = os.path.join(tmpdir, "games")
        os.makedirs(games)
        for number, target in enumerate(TARGETS, start=1):
            order = [target] + [w for w in VOCAB if w != target]
            ranks = np.zeros(len(VOCAB), dtype=np.uint16)
            for rank, word in enumerate(order, start=1):
                ranks[vocab[word]] = rank
            np.savez_compressed(os.path.join(games, f"{number:04d}.npz"), ranks=ranks)
        yield tmpdir


@pytest.fixture
def client(data_dir):
    os.environ["KONTEXTO_DATA_DIR"] = data_dir
    os.environ["KONTEXTO_FORCE_GAME"] = "1"
    import main as main_module
    main_module._game_state = None
    main_module._category_counts_cache = None
    with TestClient(main_module.app) as test_client:
        yield test_client
    os.environ.pop("KONTEXTO_DATA_DIR", None)
    os.environ.pop("KONTEXTO_FORCE_GAME", None)
    main_module._game_state = None
    main_module._category_counts_cache = None


def _game_of(word: str) -> int:
    return TARGETS.index(word) + 1


class TestDraw:
    def test_a_filter_draws_only_inside_it(self, data_dir):
        state = GameState(data_dir)
        drawn = {state.random_game_number(set(), frozenset({"animals"})) for _ in range(60)}
        assert drawn == {_game_of("hund"), _game_of("katze")}

    def test_several_fields_draw_from_their_union(self, data_dir):
        state = GameState(data_dir)
        drawn = {state.random_game_number(set(), frozenset({"animals", "transport"})) for _ in range(80)}
        assert drawn == {_game_of("hund"), _game_of("katze"), _game_of("auto")}

    def test_no_filter_still_draws_a_game_without_a_field(self, data_dir):
        state = GameState(data_dir)
        drawn = {state.random_game_number(set()) for _ in range(200)}
        assert _game_of("tier") in drawn

    def test_a_filter_keeps_the_exclusions(self, data_dir):
        state = GameState(data_dir)
        assert state.random_game_number({_game_of("hund"), _game_of("katze")}, frozenset({"animals"})) is None
        assert state.random_game_numbers(3, set(), frozenset({"animals"})) is None
        assert sorted(state.random_game_numbers(2, set(), frozenset({"animals"}))) == [4, 5]

    def test_a_filter_skips_struck_games(self, data_dir, monkeypatch):
        state = GameState(data_dir)
        monkeypatch.setattr(state, "unfit_games", frozenset({_game_of("hund")}))
        drawn = {state.random_game_number(set(), frozenset({"animals"})) for _ in range(40)}
        assert drawn == {_game_of("katze")}

    def test_counts_cover_the_fields_with_games(self, data_dir):
        assert GameState(data_dir).category_counts() == {"food": 3, "animals": 2, "transport": 1}


class TestSoloEndpoints:
    def test_the_catalogue_lists_fields_with_games_in_picker_order(self, client):
        body = client.get("/api/categories").json()["categories"]
        ids = [entry["id"] for entry in body]
        order = list(cat.get_categories().ids)
        assert ids == [i for i in order if i in {"food", "animals", "transport"}]
        assert {entry["id"]: entry["count"] for entry in body} == {"food": 3, "animals": 2, "transport": 1}
        assert all(entry["name"] for entry in body)

    def test_next_draws_inside_the_filter_and_names_the_field(self, client):
        for _ in range(20):
            body = client.get("/api/infinite/next", params={"categories": "animals"}).json()
            assert body["gameNumber"] in {_game_of("hund"), _game_of("katze")}
            assert body["category"]["id"] == "animals"
            assert body["category"]["name"] == cat.get_categories().get("animals").name

    def test_next_never_hands_out_the_daily_through_a_filter(self, client):
        # apfel (game 1) is the daily and food; only birne and kirsche remain.
        drawn = {client.get("/api/infinite/next", params={"categories": "food"}).json()["gameNumber"]
                 for _ in range(30)}
        assert drawn == {_game_of("birne"), _game_of("kirsche")}

    def test_next_refuses_an_unknown_field(self, client):
        res = client.get("/api/infinite/next", params={"categories": "dragons"})
        assert res.status_code == 400
        assert res.json()["error"] == "invalid_category"

    def test_next_without_a_filter_is_unchanged(self, client):
        body = client.get("/api/infinite/next").json()
        assert body["gameNumber"] != 1
        assert "category" in body

    def test_a_category_start_is_counted_once_per_field(self, client, monkeypatch):
        import analytics
        recorded: list[tuple[str, str]] = []
        real = analytics.record_action

        async def capture(db_path, metric, dimension, **kwargs):
            recorded.append((metric, dimension))
            return await real(db_path, metric, dimension, **kwargs)

        monkeypatch.setattr(analytics, "record_action", capture)
        game = _game_of("hund")
        for _ in range(2):  # a reload sends the opening guess again
            res = client.post(
                f"/api/guess?game={game}&infinite=true&mode=categories",
                json={"word": "haus", "first": True},
                headers={"user-agent": "Mozilla/5.0 (Windows NT 10.0) Firefox/130.0"},
            )
            assert res.status_code == 200
        assert [d for m, d in recorded if m == analytics.CATEGORY_START_METRIC] == ["animals"]
        assert ("starts", "categories") in recorded

    def test_another_mode_counts_no_category_start(self, client, monkeypatch):
        import analytics
        recorded: list[str] = []
        real = analytics.record_action

        async def capture(db_path, metric, dimension, **kwargs):
            recorded.append(metric)
            return await real(db_path, metric, dimension, **kwargs)

        monkeypatch.setattr(analytics, "record_action", capture)
        res = client.post(
            f"/api/guess?game={_game_of('hund')}&infinite=true",
            json={"word": "haus", "first": True},
            headers={"user-agent": "Mozilla/5.0 (Windows NT 10.0) Firefox/130.0"},
        )
        assert res.status_code == 200
        assert analytics.CATEGORY_START_METRIC not in recorded


def _sql(query: str, params: tuple):
    import main as main_module

    async def run():
        conn = await aiosqlite.connect(main_module._db_path)
        conn.row_factory = aiosqlite.Row
        try:
            cursor = await conn.execute(query, params)
            rows = await cursor.fetchall()
            await conn.commit()
            return rows
        finally:
            await conn.close()

    return asyncio.run(run())


def _room_game(table: str, room_id: str) -> int:
    return _sql(f"SELECT game_number FROM {table} WHERE id = ?", (room_id,))[0]["game_number"]  # nosec - fixed table names


class TestRooms:
    def test_a_duel_with_a_shown_field_tells_both_players(self, client):
        created = client.post("/api/duel", json={
            "game_source": "random", "nickname": "Alice", "tips_allowed": True,
            "categories": ["animals"], "show_category": True,
        })
        assert created.status_code == 200
        duel_id = created.json()["duel_id"]
        assert _room_game("duels", duel_id) in {_game_of("hund"), _game_of("katze")}

        joined = client.post(f"/api/duel/{duel_id}/join", json={"nickname": "Bob"}).json()
        state = client.get(f"/api/duel/{duel_id}").json()
        for body in (joined, state):
            assert body["categories"] == ["animals"]
            assert body["show_category"] is True
            assert body["category"]["id"] == "animals"
            assert "game_number" not in body

    def test_a_filter_without_the_switch_shows_nobody_the_field(self, client):
        created = client.post("/api/duel", json={
            "game_source": "random", "nickname": "Alice", "tips_allowed": True,
            "categories": ["food", "animals"],
        }).json()
        state = client.get(f"/api/duel/{created['duel_id']}").json()
        assert state["categories"] == ["animals", "food"]
        assert state["category"] is None

    def test_next_game_stays_inside_the_filter(self, client):
        created = client.post("/api/duel", json={
            "game_source": "random", "nickname": "Alice", "tips_allowed": True,
            "categories": ["animals"], "show_category": True,
        }).json()
        duel_id, token = created["duel_id"], created["player_token"]
        first = _room_game("duels", duel_id)
        res = client.post(f"/api/duel/{duel_id}/next-game", json={"player_token": token})
        assert res.status_code == 200
        assert res.json()["category"]["id"] == "animals"
        assert "game_number" not in res.json()
        second = _room_game("duels", duel_id)
        assert {first, second} == {_game_of("hund"), _game_of("katze")}

    def test_a_field_never_goes_with_the_daily(self, client):
        for body in (
            {"categories": ["animals"]},
            {"show_category": True},
        ):
            res = client.post("/api/duel", json={
                "game_source": "today", "nickname": "Alice", "tips_allowed": True, **body,
            })
            assert res.status_code == 422

    def test_an_unknown_field_is_refused_at_every_door(self, client):
        bad = {"categories": ["dragons"]}
        assert client.post("/api/duel", json={"nickname": "A", **bad}).status_code == 422
        assert client.post("/api/koop", json={"nickname": "A", **bad}).status_code == 422
        assert client.post("/api/arena", json={"mode": "royale", "nickname": "A", **bad}).status_code == 422
        assert client.post("/api/live", json={"platform": "twitch", "channel": "kontexto", **bad}).status_code == 422

    def test_a_koop_shows_the_field_in_its_state(self, client):
        created = client.post("/api/koop", json={
            "nickname": "Alice", "categories": ["transport"], "show_category": True,
        }).json()
        state = client.get(f"/api/koop/{created['koop_id']}").json()
        assert state["category"]["id"] == "transport"
        assert "game_number" not in state

    def test_an_arena_shows_the_field_and_keeps_it_on_rematch(self, client):
        created = client.post("/api/arena", json={
            "mode": "royale", "nickname": "Alice", "categories": ["animals"], "show_category": True,
        }).json()
        arena_id = created["arena_id"]
        state = client.get(f"/api/arena/{arena_id}").json()
        assert state["category"]["id"] == "animals"
        assert "game_number" not in state

        with client.websocket_connect(f"/ws/arena/{arena_id}?token={created['player_token']}") as ws:
            frame = ws.receive_json()
        assert frame["type"] == "state"
        assert frame["category"]["id"] == "animals"
        assert "game_number" not in frame

    def test_a_live_room_puts_the_field_on_the_overlay_only_when_asked(self, client):
        shown = client.post("/api/live", json={
            "platform": "twitch", "channel": "kontexto", "categories": ["food"], "show_category": True,
        }).json()
        overlay = client.get("/api/live/overlay/state", params={"token": shown["overlay_token"]}).json()
        assert overlay["category"]["id"] == "food"
        assert "game_number" not in overlay

        hidden = client.post("/api/live", json={
            "platform": "twitch", "channel": "zweiterkanal", "categories": ["food"],
        }).json()
        overlay = client.get("/api/live/overlay/state", params={"token": hidden["overlay_token"]}).json()
        assert overlay["category"] is None

    def test_a_room_without_fields_is_what_it_always_was(self, client):
        created = client.post("/api/duel", json={"nickname": "Alice"}).json()
        state = client.get(f"/api/duel/{created['duel_id']}").json()
        assert state["categories"] == []
        assert state["show_category"] is False
        assert state["category"] is None


# --- the migration ----------------------------------------------------------


def test_the_migration_adds_the_columns_to_an_old_database(tmp_path):
    path = str(tmp_path / "old.db")

    async def run():
        conn = await aiosqlite.connect(path)
        try:
            await conn.executescript(
                "CREATE TABLE duels (id TEXT PRIMARY KEY, game_number INTEGER NOT NULL, "
                "created_by TEXT NOT NULL, tips_allowed BOOLEAN NOT NULL DEFAULT 1);"
                "INSERT INTO duels (id, game_number, created_by) VALUES ('old', 5, 'Alice');"
                "CREATE TABLE koops (id TEXT PRIMARY KEY, game_number INTEGER NOT NULL, "
                "created_by TEXT NOT NULL, tips_allowed BOOLEAN NOT NULL DEFAULT 1, "
                "solved BOOLEAN NOT NULL DEFAULT 0, solved_by TEXT, best_rank INTEGER);"
                "CREATE TABLE arenas (id TEXT PRIMARY KEY, mode TEXT NOT NULL, "
                "game_number INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'lobby', "
                "phase INTEGER NOT NULL DEFAULT 0, deadline_at TEXT, started_at TEXT, "
                "finished_at TEXT, winner TEXT, round INTEGER NOT NULL DEFAULT 1, "
                "played_games TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL, "
                "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, "
                "last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP);"
            )
            await conn.commit()
        finally:
            await conn.close()

        await init_db(path)
        await init_db(path)  # a second worker running it again is a no-op

        conn = await aiosqlite.connect(path)
        conn.row_factory = aiosqlite.Row
        try:
            for table in ("duels", "koops", "arenas"):
                cursor = await conn.execute(f"PRAGMA table_info({table})")  # nosec - fixed names
                columns = {row["name"] for row in await cursor.fetchall()}
                assert {"categories", "show_category"} <= columns, table
            cursor = await conn.execute("SELECT categories, show_category FROM duels WHERE id = 'old'")
            row = await cursor.fetchone()
            assert (row["categories"], row["show_category"]) == ("", 0)
        finally:
            await conn.close()

    asyncio.run(run())
