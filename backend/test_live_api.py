"""Tests for the live chat HTTP surface.

Four endpoints, and the one that matters most is the overlay: it sits on a public
stream, so it is held to the same boundary as every other room response. The
game number is the answer, and it does not leave the server while the round is
open (see rooms.py).
"""

import json
import os
import pickle  # nosec - bloom filter fixtures
import tempfile

import numpy as np
import pytest
from fastapi.testclient import TestClient
from pybloom_live import BloomFilter


@pytest.fixture
def game_data_dir():
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        vocab = {"apfel": 0, "birne": 1, "kirsche": 2, "auto": 3, "haus": 4}
        with open(os.path.join(tmpdir, "vocabulary.json"), "w") as f:
            json.dump(vocab, f)

        lemma_map = {"aepfel": "apfel"}
        with open(os.path.join(tmpdir, "lemma_map.json"), "w") as f:
            json.dump(lemma_map, f)

        bf = BloomFilter(capacity=100, error_rate=0.01)
        for w in list(vocab.keys()) + list(lemma_map.keys()):
            bf.add(w)
        with open(os.path.join(tmpdir, "bloom.bin"), "wb") as f:  # nosec
            pickle.dump(bf, f)

        with open(os.path.join(tmpdir, "target_words.json"), "w") as f:
            json.dump(["apfel", "birne"], f)

        with open(os.path.join(tmpdir, "metadata.json"), "w") as f:
            json.dump({"start_date": "2026-01-01", "vocab_size": 5}, f)

        games_dir = os.path.join(tmpdir, "games")
        os.makedirs(games_dir)
        np.savez_compressed(
            os.path.join(games_dir, "0001.npz"),
            ranks=np.array([1, 2, 3, 4, 5], dtype=np.uint16),
        )
        yield tmpdir


@pytest.fixture
def client(game_data_dir):
    os.environ["KONTEXTO_DATA_DIR"] = game_data_dir
    os.environ["KONTEXTO_FORCE_GAME"] = "1"

    import main as main_module
    main_module._game_state = None

    from main import app
    with TestClient(app) as test_client:
        yield test_client

    os.environ.pop("KONTEXTO_DATA_DIR", None)
    os.environ.pop("KONTEXTO_FORCE_GAME", None)
    main_module._game_state = None


def _create(client, channel="kontexto", **extra):
    payload = {
        "platform": "twitch",
        "channel": channel,
        "game_source": "today",
        **extra,
    }
    return client.post("/api/live", json=payload)


class TestTikTok:
    """TikTok is offered only with the operator's key, and only up to a cap."""

    def test_without_a_key_tiktok_is_not_offered(self, client, monkeypatch):
        monkeypatch.delenv("KONTEXTO_EULER_API_KEY", raising=False)
        assert client.get("/api/live/platforms").json() == {"platforms": ["twitch"]}
        res = _create(client, platform="tiktok")
        assert res.status_code == 503
        assert res.json()["error"] == "platform_unavailable"

    def test_with_a_key_a_tiktok_room_is_bound(self, client, monkeypatch):
        monkeypatch.setenv("KONTEXTO_EULER_API_KEY", "test-key")
        assert client.get("/api/live/platforms").json() == {"platforms": ["twitch", "tiktok"]}
        res = _create(client, platform="tiktok", channel="https://www.tiktok.com/@Kontexto.de/live")
        assert res.status_code == 200
        body = res.json()
        assert body["platform"] == "tiktok"
        assert body["channel"] == "kontexto.de"
        assert "game_number" not in body

    def test_a_tiktok_refusal_names_tiktok(self, client, monkeypatch):
        monkeypatch.setenv("KONTEXTO_EULER_API_KEY", "test-key")
        res = _create(client, platform="tiktok", channel="endet.")
        assert res.status_code == 422
        assert res.json()["error"] == "bad_channel"
        assert "TikTok" in res.json()["message"]

    def test_the_same_handle_may_play_on_both_platforms(self, client, monkeypatch):
        monkeypatch.setenv("KONTEXTO_EULER_API_KEY", "test-key")
        assert _create(client, channel="kontexto").status_code == 200
        assert _create(client, platform="tiktok", channel="kontexto").status_code == 200
        assert _create(client, platform="tiktok", channel="kontexto").status_code == 409

    def test_the_cap_refuses_one_room_too_many(self, client, monkeypatch):
        monkeypatch.setenv("KONTEXTO_EULER_API_KEY", "test-key")
        monkeypatch.setenv("KONTEXTO_TIKTOK_MAX_ROOMS", "2")
        assert _create(client, platform="tiktok", channel="erster").status_code == 200
        assert _create(client, platform="tiktok", channel="zweiter").status_code == 200
        res = _create(client, platform="tiktok", channel="dritter")
        assert res.status_code == 503
        assert res.json()["error"] == "platform_full"
        # The cap is TikTok's alone; Twitch is not billed by anybody.
        assert _create(client, channel="twitchkanal").status_code == 200

    def test_an_unknown_platform_is_a_422(self, client):
        assert _create(client, platform="youtube").status_code == 422


class TestCreate:
    def test_a_room_is_bound_to_a_channel(self, client):
        res = _create(client)
        assert res.status_code == 200
        body = res.json()
        assert body["channel"] == "kontexto"
        assert body["platform"] == "twitch"
        assert body["chat_state"] == "connecting"
        assert body["require_prefix"] is False
        assert body["player_token"]
        assert body["overlay_token"]
        assert body["player_token"] != body["overlay_token"]
        # The number is the answer and does not ride along.
        assert "game_number" not in body

    def test_a_pasted_url_is_accepted(self, client):
        res = _create(client, channel="https://twitch.tv/KontextoDE")
        assert res.status_code == 200
        assert res.json()["channel"] == "kontextode"

    def test_an_impossible_channel_is_refused(self, client):
        res = _create(client, channel="hat leerzeichen")
        assert res.status_code == 422
        assert res.json()["error"] == "bad_channel"

    def test_one_room_per_channel(self, client):
        assert _create(client).status_code == 200
        res = _create(client)
        assert res.status_code == 409
        assert res.json()["error"] == "channel_busy"

    def test_a_busy_channel_leaves_no_orphan_room(self, client):
        first = _create(client).json()
        _create(client)
        # The koop room of the refused call must not survive, or every retry
        # would leave a dead room behind for an hour.
        import asyncio
        import main as main_module
        from database import get_db

        async def count():
            db = await get_db(main_module._db_path)
            try:
                cursor = await db.execute("SELECT COUNT(*) FROM koops")
                return (await cursor.fetchone())[0]
            finally:
                await db.close()

        assert asyncio.run(count()) == 1
        assert first["koop_id"]

    def test_the_client_may_not_choose_the_puzzle(self, client):
        res = client.post("/api/live", json={
            "platform": "twitch",
            "channel": "kontexto",
            "game_number": 1,
        })
        assert res.status_code == 422

    def test_the_host_plays_under_the_channel_name(self, client):
        # No nickname was sent, and none was asked for: the channel is the name
        # the audience already knows.
        created = _create(client).json()
        state = client.get(f"/api/koop/{created['koop_id']}").json()
        # Two rows and never more: the host, and one standing for the whole chat.
        assert [p["nickname"] for p in state["players"]] == ["kontexto", "Der Chat"]

    def test_a_host_may_still_choose_another_name(self, client):
        created = _create(client, nickname="Der Moderator").json()
        state = client.get(f"/api/koop/{created['koop_id']}").json()
        assert state["players"][0]["nickname"] == "Der Moderator"

    def test_prefix_mode_is_stored(self, client):
        res = _create(client, require_prefix=True)
        assert res.json()["require_prefix"] is True


class TestRead:
    def test_the_host_sees_the_connection(self, client):
        created = _create(client).json()
        res = client.get(
            f"/api/live/{created['koop_id']}",
            params={"token": created["player_token"]},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["channel"] == "kontexto"
        assert body["top"] == []
        assert "game_number" not in body

    def test_a_foreign_token_is_a_404(self, client):
        created = _create(client).json()
        res = client.get(
            f"/api/live/{created['koop_id']}", params={"token": "fremd"}
        )
        assert res.status_code == 404
        assert res.json()["error"] == "room_not_found"

    def test_an_unknown_room_is_a_404(self, client):
        res = client.get("/api/live/abcdef", params={"token": "x"})
        assert res.status_code == 404


class TestOverlay:
    def test_the_overlay_shows_the_board_without_the_answer(self, client):
        created = _create(client).json()
        client.post(f"/api/koop/{created['koop_id']}/guess", json={
            "word": "kirsche", "player_token": created["player_token"],
        })

        res = client.get(
            "/api/live/overlay/state", params={"token": created["overlay_token"]}
        )
        assert res.status_code == 200
        body = res.json()
        assert body["round"] == 1
        assert body["channel"] == "kontexto"
        assert body["solved"] is False
        assert body["recent"][0]["word"] == "kirsche"
        assert body["total"] > 0
        assert "game_number" not in body
        assert "word" not in body

    def test_the_overlay_needs_its_own_token(self, client):
        created = _create(client).json()
        # Neither the room id nor the host's token opens it.
        assert client.get(
            "/api/live/overlay/state", params={"token": created["koop_id"]}
        ).status_code == 404
        assert client.get(
            "/api/live/overlay/state", params={"token": created["player_token"]}
        ).status_code == 404

    def test_a_solved_round_names_the_solver(self, client):
        created = _create(client).json()
        client.post(f"/api/koop/{created['koop_id']}/guess", json={
            "word": "apfel", "player_token": created["player_token"],
        })
        body = client.get(
            "/api/live/overlay/state", params={"token": created["overlay_token"]}
        ).json()
        assert body["solved"] is True
        assert body["solved_by"] == "kontexto"
        # Still no number: the reveal endpoint hands that out, token-checked.
        assert "game_number" not in body


class TestStop:
    def test_the_host_can_unbind(self, client):
        created = _create(client).json()
        res = client.post(f"/api/live/{created['koop_id']}/stop", json={
            "player_token": created["player_token"],
        })
        assert res.status_code == 200
        assert res.json()["stopped"] is True

        # The koop room survives, so the host can still reveal the word.
        state = client.get(f"/api/koop/{created['koop_id']}")
        assert state.status_code == 200
        # The channel is free again.
        assert _create(client).status_code == 200

    def test_a_foreign_token_cannot_unbind(self, client):
        created = _create(client).json()
        res = client.post(f"/api/live/{created['koop_id']}/stop", json={
            "player_token": "fremd",
        })
        assert res.status_code == 404


class TestAdminStats:
    def test_stream_figures_reach_the_dashboard(self, client):
        _create(client)
        _create(client, channel="zweiter")

        import main as main_module

        # The dashboard is passkey-protected; the shape is what is under test.
        res = client.get("/api/admin/stats")
        assert res.status_code == 401

        import asyncio
        from database import get_db
        import live_chat

        async def read():
            db = await get_db(main_module._db_path)
            try:
                return (
                    await live_chat.stream_totals(db),
                    await live_chat.stream_stats(db),
                    await live_chat.active_streams(db),
                )
            finally:
                await db.close()

        totals, channels, active = asyncio.run(read())
        assert totals["channels"] == 2
        assert totals["sessions"] == 2
        assert totals["rounds"] == 2
        assert {c["channel"] for c in channels} == {"kontexto", "zweiter"}
        assert {a["channel"] for a in active} == {"kontexto", "zweiter"}
