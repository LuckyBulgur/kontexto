"""The game number is the answer, so a room does not hand it out mid-round.

``/api/reveal``, ``/api/closest`` and ``/api/wordle/reveal`` serve the target
word for any game number, to anybody. That is fine for a solo player spoiling
their own game and fatal in a room, where the number belongs to the opponent's
puzzle as much as to one's own. These tests hold the boundary described in
rooms.py from the outside: no room response and no socket frame carries the
number while a round is open, a client cannot pick the number at creation, and
the reveal endpoint of each mode answers only once the caller's round is over.
"""

import asyncio
import json
import os
import pathlib
import pickle  # nosec - the bloom fixture is written the way prepare.py writes it
import tempfile

import aiosqlite
import numpy as np
import pytest
from fastapi.testclient import TestClient
from pybloom_live import BloomFilter


@pytest.fixture
def data_dir():
    """A minimal dataset: two Kontexto games and two Wordle solutions.

    ``ignore_cleanup_errors`` because of the socket test: on Windows a sqlite
    handle the disconnect path has not closed yet keeps duels.db locked, and the
    unlink then fails with WinError 32. The test has run by that point; a
    leftover file in the system temp directory is not worth a red suite.
    """
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        vocab = {"apfel": 0, "birne": 1, "kirsche": 2, "auto": 3, "haus": 4}
        with open(os.path.join(tmpdir, "vocabulary.json"), "w") as f:
            json.dump(vocab, f)
        with open(os.path.join(tmpdir, "lemma_map.json"), "w") as f:
            json.dump({}, f)

        bloom = BloomFilter(capacity=100, error_rate=0.01)
        for word in vocab:
            bloom.add(word)
        with open(os.path.join(tmpdir, "bloom.bin"), "wb") as f:  # nosec
            pickle.dump(bloom, f)

        with open(os.path.join(tmpdir, "target_words.json"), "w") as f:
            json.dump(["apfel", "birne"], f)
        with open(os.path.join(tmpdir, "metadata.json"), "w") as f:
            json.dump({"start_date": "2026-01-01", "vocab_size": 5}, f)

        games = os.path.join(tmpdir, "games")
        os.makedirs(games)
        # Game 1: apfel is rank 1, birne rank 2. Game 2 swaps the two.
        np.savez_compressed(
            os.path.join(games, "0001.npz"),
            ranks=np.array([1, 2, 3, 4, 5], dtype=np.uint16),
        )
        np.savez_compressed(
            os.path.join(games, "0002.npz"),
            ranks=np.array([2, 1, 3, 4, 5], dtype=np.uint16),
        )

        wordle_dir = os.path.join(tmpdir, "wordle")
        os.makedirs(wordle_dir)
        with open(os.path.join(wordle_dir, "solutions.json"), "w") as f:
            json.dump(["hallo", "stern"], f)
        with open(os.path.join(wordle_dir, "valid_words.json"), "w") as f:
            json.dump(["hallo", "stern", "birne", "apfel"], f)

        yield tmpdir


@pytest.fixture
def client(data_dir):
    os.environ["KONTEXTO_DATA_DIR"] = data_dir
    os.environ["KONTEXTO_FORCE_GAME"] = "1"

    import main as main_module
    main_module._game_state = None
    main_module._wordle_state = None

    with TestClient(main_module.app) as test_client:
        yield test_client

    del os.environ["KONTEXTO_DATA_DIR"]
    del os.environ["KONTEXTO_FORCE_GAME"]
    main_module._game_state = None
    main_module._wordle_state = None


def _db_path() -> str:
    """The database the running app opened, not a guess at its name."""
    import main as main_module
    return main_module._db_path


def _sql(query: str, params: tuple):
    """Run one statement against the running app's database."""
    async def run():
        conn = await aiosqlite.connect(_db_path())
        conn.row_factory = aiosqlite.Row
        try:
            cursor = await conn.execute(query, params)
            rows = await cursor.fetchall()
            await conn.commit()
            return rows
        finally:
            await conn.close()

    return asyncio.run(run())


def _create_duel(client, nickname="Alice"):
    return client.post(
        "/api/duel",
        json={"game_source": "today", "nickname": nickname, "tips_allowed": True},
    ).json()


def _create_koop(client, nickname="Alice"):
    return client.post(
        "/api/koop",
        json={"game_source": "today", "nickname": nickname, "tips_allowed": True},
    ).json()


def _create_arena(client, nickname="Alice"):
    return client.post(
        "/api/arena",
        json={"mode": "royale", "game_source": "today", "nickname": nickname},
    ).json()


def _wordle_daily(client):
    """Today's Wordle number and its solution, as the server computes them.

    Unlike Kontexto, the Wordle number is derived from the date and cannot be
    forced by an environment variable, so a test asserts against this rather
    than against a literal.
    """
    number = client.get("/api/wordle/game").json()["game_number"]
    solutions = ["hallo", "stern"]
    return number, solutions[number % len(solutions)]


def _create_wordle_duel(client, nickname="Alice"):
    return client.post(
        "/api/wordle/duel", json={"nickname": nickname, "game_source": "today"}
    ).json()


class TestNoNumberWhileTheRoundIsOpen:
    def test_duel_state_and_join_carry_the_round_only(self, client):
        created = _create_duel(client)
        state = client.get(f"/api/duel/{created['duel_id']}").json()
        assert "game_number" not in state
        assert state["round"] == 1

        joined = client.post(
            f"/api/duel/{created['duel_id']}/join", json={"nickname": "Bob"}
        ).json()
        assert "game_number" not in joined
        assert joined["round"] == 1

    def test_koop_state_and_join_carry_the_round_only(self, client):
        created = _create_koop(client)
        state = client.get(f"/api/koop/{created['koop_id']}").json()
        assert "game_number" not in state
        assert state["round"] == 1

        joined = client.post(
            f"/api/koop/{created['koop_id']}/join", json={"nickname": "Bob"}
        ).json()
        assert "game_number" not in joined

    def test_arena_state_and_join_carry_the_round_only(self, client):
        created = _create_arena(client)
        state = client.get(f"/api/arena/{created['arena_id']}").json()
        assert "game_number" not in state
        assert state["round"] == 1

        joined = client.post(
            f"/api/arena/{created['arena_id']}/join", json={"nickname": "Bob"}
        ).json()
        assert "game_number" not in joined

    def test_wordle_duel_state_and_join_carry_the_round_only(self, client):
        created = _create_wordle_duel(client)
        state = client.get(f"/api/wordle/duel/{created['duel_id']}").json()
        assert "game_number" not in state
        assert state["round"] == 1

        joined = client.post(
            f"/api/wordle/duel/{created['duel_id']}/join", json={"nickname": "Bob"}
        ).json()
        assert "game_number" not in joined
        assert joined["round"] == 1

    def test_the_rematch_answers_with_the_round(self, client):
        created = _create_duel(client)
        resp = client.post(
            f"/api/duel/{created['duel_id']}/next-game",
            json={"player_token": created["player_token"]},
        )
        assert resp.status_code == 200
        assert resp.json()["round"] == 2
        assert "game_number" not in resp.json()

    def test_the_arena_socket_frame_carries_no_number(self, client):
        """The arena used to broadcast its whole row, game number included."""
        created = _create_arena(client)
        url = f"/ws/arena/{created['arena_id']}?token={created['player_token']}"
        with client.websocket_connect(url) as socket:
            frame = socket.receive_json()
        assert frame["type"] == "state"
        assert "game_number" not in frame
        assert frame["round"] == 1

    def test_no_diff_frame_can_carry_the_number(self):
        """The poll loops build their frames by hand, so no model strips them.

        Three of the four loops are written inline in an endless coroutine and
        cannot be stepped from a test. The durable guard is that the module does
        not read the column at all, which no frame can then contain.
        """
        module = pathlib.Path(__file__).with_name("websocket_manager.py")
        source = module.read_text(encoding="utf-8")
        assert "game_number" not in source


class TestTheServerPicksTheGame:
    @pytest.mark.parametrize(
        "path,payload",
        [
            ("/api/duel", {"game_number": 2, "nickname": "Alice", "tips_allowed": True}),
            ("/api/koop", {"game_number": 2, "nickname": "Alice", "tips_allowed": True}),
            ("/api/arena", {"mode": "royale", "game_number": 2, "nickname": "Alice"}),
            ("/api/wordle/duel", {"nickname": "Alice", "game_number": 2}),
        ],
    )
    def test_a_client_supplied_game_number_is_refused(self, client, path, payload):
        assert client.post(path, json=payload).status_code == 422

    def test_a_random_room_is_never_todays_daily(self, client):
        """Otherwise the invite spoils the daily the guest has not played yet."""
        created = client.post(
            "/api/duel",
            json={"game_source": "random", "nickname": "Alice", "tips_allowed": True},
        ).json()
        rows = _sql("SELECT game_number FROM duels WHERE id = ?", (created["duel_id"],))
        assert rows[0]["game_number"] != 1


class TestRoomReveal:
    def test_duel_refuses_while_the_player_is_still_guessing(self, client):
        created = _create_duel(client)
        resp = client.post(
            f"/api/duel/{created['duel_id']}/reveal",
            json={"player_token": created["player_token"]},
        )
        assert resp.status_code == 409
        assert resp.json()["error"] == "round_open"
        # A refusal must not contain the thing it refuses.
        assert "apfel" not in resp.text

    def test_duel_refuses_a_token_from_another_room(self, client):
        created = _create_duel(client)
        outsider = _create_duel(client, nickname="Mallory")
        resp = client.post(
            f"/api/duel/{created['duel_id']}/reveal",
            json={"player_token": outsider["player_token"]},
        )
        assert resp.status_code == 404
        assert resp.json()["error"] == "player_not_found"

    def test_duel_answers_once_the_player_has_solved(self, client):
        created = _create_duel(client)
        client.post(
            f"/api/duel/{created['duel_id']}/guess",
            json={"word": "apfel", "player_token": created["player_token"]},
        )
        resp = client.post(
            f"/api/duel/{created['duel_id']}/reveal",
            json={"player_token": created["player_token"]},
        )
        assert resp.status_code == 200
        assert resp.json() == {"word": "apfel", "game_number": 1, "round": 1}

    def test_the_opponent_of_a_solver_still_gets_nothing(self, client):
        """A duel does not end when the first player solves it."""
        created = _create_duel(client)
        joined = client.post(
            f"/api/duel/{created['duel_id']}/join", json={"nickname": "Bob"}
        ).json()
        client.post(
            f"/api/duel/{created['duel_id']}/guess",
            json={"word": "apfel", "player_token": created["player_token"]},
        )
        resp = client.post(
            f"/api/duel/{created['duel_id']}/reveal",
            json={"player_token": joined["player_token"]},
        )
        assert resp.status_code == 409

    def test_koop_refuses_while_the_team_is_still_guessing(self, client):
        created = _create_koop(client)
        resp = client.post(
            f"/api/koop/{created['koop_id']}/reveal",
            json={"player_token": created["player_token"]},
        )
        assert resp.status_code == 409

    def test_koop_answers_after_giving_up(self, client):
        created = _create_koop(client)
        gave_up = client.post(
            f"/api/koop/{created['koop_id']}/give-up",
            json={"player_token": created["player_token"]},
        ).json()
        assert gave_up == {"word": "apfel", "game_number": 1, "round": 1}

        resp = client.post(
            f"/api/koop/{created['koop_id']}/reveal",
            json={"player_token": created["player_token"]},
        )
        assert resp.status_code == 200
        assert resp.json()["game_number"] == 1

    def test_arena_refuses_while_the_round_runs(self, client):
        created = _create_arena(client)
        resp = client.post(
            f"/api/arena/{created['arena_id']}/reveal",
            json={"player_token": created["player_token"]},
        )
        assert resp.status_code == 409

    def test_arena_answers_once_it_is_finished(self, client):
        created = _create_arena(client)
        _sql(
            "UPDATE arenas SET status = 'finished' WHERE id = ?",
            (created["arena_id"],),
        )
        resp = client.post(
            f"/api/arena/{created['arena_id']}/reveal",
            json={"player_token": created["player_token"]},
        )
        assert resp.status_code == 200
        assert resp.json() == {"word": "apfel", "game_number": 1, "round": 1}

    def test_wordle_duel_refuses_while_guesses_are_left(self, client):
        created = _create_wordle_duel(client)
        resp = client.post(
            f"/api/wordle/duel/{created['duel_id']}/reveal",
            json={"player_token": created["player_token"]},
        )
        assert resp.status_code == 409
        assert _wordle_daily(client)[1] not in resp.text

    def test_wordle_duel_answers_after_six_guesses(self, client):
        created = _create_wordle_duel(client)
        number, solution = _wordle_daily(client)
        for _ in range(6):
            client.post(
                f"/api/wordle/duel/{created['duel_id']}/guess",
                json={
                    "word": "birne" if solution != "birne" else "apfel",
                    "player_token": created["player_token"],
                },
            )
        resp = client.post(
            f"/api/wordle/duel/{created['duel_id']}/reveal",
            json={"player_token": created["player_token"]},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["word"] == solution
        assert body["game_number"] == number
        assert body["round"] == 1

    def test_wordle_duel_answers_a_solver_right_away(self, client):
        created = _create_wordle_duel(client)
        _, solution = _wordle_daily(client)
        client.post(
            f"/api/wordle/duel/{created['duel_id']}/guess",
            json={"word": solution, "player_token": created["player_token"]},
        )
        resp = client.post(
            f"/api/wordle/duel/{created['duel_id']}/reveal",
            json={"player_token": created["player_token"]},
        )
        assert resp.status_code == 200
        assert resp.json()["word"] == solution

    def test_an_unknown_room_is_a_404(self, client):
        resp = client.post("/api/duel/XXXXXX/reveal", json={"player_token": "bogus"})
        assert resp.status_code == 404
