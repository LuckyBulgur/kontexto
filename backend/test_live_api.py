"""Tests for the live chat HTTP surface.

The host page's poll is held to the same boundary as every other room response:
the game number is the answer, and it does not leave the server while the round
is open (see rooms.py). The host page is on stream, so that matters here.
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
        # The OBS overlay is gone, and its token with it.
        assert "overlay_token" not in body
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


class TestOverlayRemoved:
    def test_the_overlay_endpoint_is_gone(self, client):
        created = _create(client).json()
        res = client.get("/api/live/overlay/state", params={"token": created["koop_id"]})
        # "overlay" now reads as a room id like any other, and there is none.
        assert res.status_code in (404, 422)


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
        assert {c["channel"] for a in active for c in a["channels"]} == {"kontexto", "zweiter"}


class TestHostMessages:
    """The operator's note reaches the host page and nothing the audience sees."""

    def _admin(self):
        import auth

        return {"Authorization": f"Bearer {auth.issue_session_token()}"}

    def test_admin_endpoints_need_a_session(self, client):
        created = _create(client).json()
        assert client.get("/api/admin/live-streams").status_code == 401
        res = client.post(
            f"/api/admin/live-streams/{created['koop_id']}/message", json={"text": "Danke"}
        )
        assert res.status_code == 401
        res = client.get(
            "/api/admin/live-streams", headers={"Authorization": "Bearer falsch"}
        )
        assert res.status_code == 401

    def test_the_admin_sees_running_streams(self, client):
        created = _create(client).json()
        _create(client, channel="zweiter")
        res = client.get("/api/admin/live-streams", headers=self._admin())
        assert res.status_code == 200
        body = res.json()
        assert body["server_time"].endswith("Z")
        channels = {s["channels"][0]["channel"]: s for s in body["streams"]}
        assert set(channels) == {"kontexto", "zweiter"}
        stream = channels["kontexto"]
        assert stream["koop_id"] == created["koop_id"]
        assert stream["messages"] == []
        # The admin reads along; the answer is not part of that.
        assert "game_number" not in stream
        assert "target" not in stream

    def test_note_reaches_the_host_once(self, client):
        created = _create(client).json()
        kid, token = created["koop_id"], created["player_token"]

        res = client.post(
            f"/api/admin/live-streams/{kid}/message",
            json={"text": "  Danke für\nden Stream!  "},
            headers=self._admin(),
        )
        assert res.status_code == 200
        message_id = res.json()["id"]

        host = client.get(f"/api/live/{kid}", params={"token": token}).json()
        assert [(m["id"], m["text"]) for m in host["messages"]] == [
            (message_id, "Danke für den Stream!")
        ]

        admin = client.get("/api/admin/live-streams", headers=self._admin()).json()
        [entry] = admin["streams"][0]["messages"]
        assert entry["seen_at"] is None

        res = client.post(
            f"/api/live/{kid}/messages/seen",
            json={"player_token": token, "up_to_id": message_id},
        )
        assert res.status_code == 200 and res.json()["marked"] == 1
        # A retry of the same ack changes nothing.
        res = client.post(
            f"/api/live/{kid}/messages/seen",
            json={"player_token": token, "up_to_id": message_id},
        )
        assert res.json()["marked"] == 0

        host = client.get(f"/api/live/{kid}", params={"token": token}).json()
        assert host["messages"] == []
        admin = client.get("/api/admin/live-streams", headers=self._admin()).json()
        assert admin["streams"][0]["messages"][0]["seen_at"].endswith("Z")

    def test_a_foreign_token_cannot_ack(self, client):
        created = _create(client).json()
        kid = created["koop_id"]
        message_id = client.post(
            f"/api/admin/live-streams/{kid}/message", json={"text": "Hallo"},
            headers=self._admin(),
        ).json()["id"]
        res = client.post(
            f"/api/live/{kid}/messages/seen",
            json={"player_token": "fremd", "up_to_id": message_id},
        )
        assert res.status_code == 404
        host = client.get(f"/api/live/{kid}", params={"token": created["player_token"]})
        assert len(host.json()["messages"]) == 1

    def test_refusals(self, client):
        created = _create(client).json()
        kid = created["koop_id"]
        url = f"/api/admin/live-streams/{kid}/message"

        res = client.post(url, json={"text": " ​ "}, headers=self._admin())
        assert res.status_code == 422 and res.json()["error"] == "bad_message"
        res = client.post(url, json={"text": "x" * 281}, headers=self._admin())
        assert res.status_code == 422 and res.json()["error"] == "bad_message"
        res = client.post(url, json={"text": "a", "extra": 1}, headers=self._admin())
        assert res.status_code == 422

        for i in range(5):
            assert client.post(url, json={"text": f"n{i}"}, headers=self._admin()).status_code == 200
        res = client.post(url, json={"text": "zu viel"}, headers=self._admin())
        assert res.status_code == 409 and res.json()["error"] == "too_many_pending"

        client.post(f"/api/live/{kid}/stop", json={"player_token": created["player_token"]})
        res = client.post(url, json={"text": "zu spät"}, headers=self._admin())
        assert res.status_code == 404 and res.json()["error"] == "room_not_found"
        res = client.post(
            "/api/admin/live-streams/fehlt/message", json={"text": "Hallo"},
            headers=self._admin(),
        )
        assert res.status_code == 404

    def test_debug_seam_is_closed_outside_dev(self, client, monkeypatch):
        created = _create(client).json()
        monkeypatch.delenv("KONTEXTO_DEV", raising=False)
        res = client.post(
            f"/api/live/{created['koop_id']}/debug-host-message", json={"text": "Hallo"}
        )
        assert res.status_code == 404
        monkeypatch.setenv("KONTEXTO_DEV", "1")
        res = client.post(
            f"/api/live/{created['koop_id']}/debug-host-message", json={"text": "Hallo"}
        )
        assert res.status_code == 200


class TestAdminEnd:
    """The operator ends a stream round: the chat stops, the board stays."""

    def _admin(self):
        import auth

        return {"Authorization": f"Bearer {auth.issue_session_token()}"}

    def test_needs_a_session(self, client):
        created = _create(client).json()
        res = client.post(f"/api/admin/live-streams/{created['koop_id']}/end")
        assert res.status_code == 401
        host = client.get(
            f"/api/live/{created['koop_id']}", params={"token": created["player_token"]}
        )
        assert host.status_code == 200

    def test_ends_the_binding_and_keeps_the_board(self, client):
        created = _create(client).json()
        kid = created["koop_id"]
        client.post(
            f"/api/admin/live-streams/{kid}/message", json={"text": "Danke"},
            headers=self._admin(),
        )

        res = client.post(f"/api/admin/live-streams/{kid}/end", headers=self._admin())
        assert res.status_code == 200 and res.json()["stopped"] is True

        # Gone from the dashboard and from the host's chat panel.
        admin = client.get("/api/admin/live-streams", headers=self._admin()).json()
        assert admin["streams"] == []
        host = client.get(f"/api/live/{kid}", params={"token": created["player_token"]})
        assert host.status_code == 404

        # The koop room survives, so the streamer can still reveal the word.
        assert client.get(f"/api/koop/{kid}").status_code == 200
        # The channel is free for a new round.
        assert _create(client).status_code == 200

    def test_a_second_end_is_a_404(self, client):
        created = _create(client).json()
        url = f"/api/admin/live-streams/{created['koop_id']}/end"
        assert client.post(url, headers=self._admin()).status_code == 200
        res = client.post(url, headers=self._admin())
        assert res.status_code == 404 and res.json()["error"] == "room_not_found"
        res = client.post("/api/admin/live-streams/fehlt/end", headers=self._admin())
        assert res.status_code == 404


class TestHostPresenceApi:
    def test_the_host_poll_raises_the_stamp(self, client):
        import asyncio

        import main as main_module
        from database import get_db

        created = _create(client).json()
        kid = created["koop_id"]

        async def age_and_read(age: bool):
            db = await get_db(main_module._db_path)
            try:
                if age:
                    await db.execute(
                        "UPDATE live_rooms SET host_seen_at = datetime('now', '-4 minutes') "
                        "WHERE koop_id = ?",
                        (kid,),
                    )
                    await db.commit()
                cursor = await db.execute(
                    "SELECT host_seen_at FROM live_rooms WHERE koop_id = ?", (kid,)
                )
                return (await cursor.fetchone())["host_seen_at"]
            finally:
                await db.close()

        old = asyncio.run(age_and_read(True))
        main_module._host_touched.clear()
        res = client.get(f"/api/live/{kid}", params={"token": created["player_token"]})
        assert res.status_code == 200
        assert asyncio.run(age_and_read(False)) > old


def _both(client, twitch="kontexto", tiktok="kontexto.de", **extra):
    return client.post("/api/live", json={
        "channels": [
            {"platform": "twitch", "channel": twitch},
            {"platform": "tiktok", "channel": tiktok},
        ],
        "game_source": "today",
        **extra,
    })


class TestTwoChats:
    """One room reads Twitch and TikTok at once, and the host manages both."""

    @pytest.fixture(autouse=True)
    def _tiktok_key(self, monkeypatch):
        monkeypatch.setenv("KONTEXTO_EULER_API_KEY", "test-key")

    def test_a_room_binds_both_platforms(self, client):
        res = _both(client)
        assert res.status_code == 200
        body = res.json()
        assert [(c["platform"], c["channel"]) for c in body["channels"]] == [
            ("twitch", "kontexto"), ("tiktok", "kontexto.de"),
        ]
        # The flat fields describe the oldest chat, for pages from before.
        assert (body["platform"], body["channel"]) == ("twitch", "kontexto")
        assert "game_number" not in body

    def test_a_busy_second_chat_refuses_the_whole_room(self, client):
        assert _create(client, platform="tiktok", channel="belegt").status_code == 200
        res = _both(client, tiktok="belegt")
        assert res.status_code == 409
        assert res.json() == {
            "error": "channel_busy",
            "message": "Für diesen Kanal läuft schon eine Runde",
            "platform": "tiktok",
        }
        # The Twitch half did not stay behind: the channel is free again.
        assert _create(client, channel="kontexto").status_code == 200

    def test_a_refusal_names_its_platform(self, client):
        res = _both(client, tiktok="endet.")
        assert res.status_code == 422
        assert res.json()["platform"] == "tiktok"

    def test_one_chat_per_platform(self, client):
        res = client.post("/api/live", json={"channels": [
            {"platform": "twitch", "channel": "erster"},
            {"platform": "twitch", "channel": "zweiter"},
        ]})
        assert res.status_code == 422

    def test_both_forms_at_once_are_refused(self, client):
        res = client.post("/api/live", json={
            "channels": [{"platform": "twitch", "channel": "erster"}],
            "channel": "erster",
        })
        assert res.status_code == 422

    def test_the_tiktok_cap_counts_chats(self, client, monkeypatch):
        monkeypatch.setenv("KONTEXTO_TIKTOK_MAX_ROOMS", "1")
        assert _both(client).status_code == 200
        res = _both(client, twitch="andere", tiktok="anderer")
        assert res.status_code == 503
        assert res.json()["error"] == "platform_full"

    def test_a_chat_is_added_and_removed_during_the_round(self, client):
        created = _create(client).json()
        kid, token = created["koop_id"], created["player_token"]

        res = client.post(f"/api/live/{kid}/channels", json={
            "player_token": token, "platform": "tiktok", "channel": "@Kontexto.de",
        })
        assert res.status_code == 200
        assert [c["platform"] for c in res.json()["channels"]] == ["twitch", "tiktok"]

        res = client.post(f"/api/live/{kid}/channels", json={
            "player_token": token, "platform": "tiktok", "channel": "noch.einer",
        })
        assert res.status_code == 409
        assert res.json()["error"] == "platform_bound"

        res = client.post(f"/api/live/{kid}/channels/remove", json={
            "player_token": token, "platform": "twitch",
        })
        assert res.status_code == 200
        body = res.json()
        assert [c["platform"] for c in body["channels"]] == ["tiktok"]
        assert body["platform"] == "tiktok"

        res = client.post(f"/api/live/{kid}/channels/remove", json={
            "player_token": token, "platform": "tiktok",
        })
        assert res.status_code == 409
        assert res.json()["error"] == "last_channel"

    def test_an_added_channel_must_be_free(self, client):
        _create(client, platform="tiktok", channel="belegt")
        created = _create(client).json()
        res = client.post(f"/api/live/{created['koop_id']}/channels", json={
            "player_token": created["player_token"], "platform": "tiktok", "channel": "belegt",
        })
        assert res.status_code == 409
        assert res.json()["error"] == "channel_busy"

    def test_a_chat_is_paused_and_resumed_by_the_host(self, client):
        created = _both(client).json()
        kid, token = created["koop_id"], created["player_token"]
        res = client.post(f"/api/live/{kid}/channels/pause", json={
            "player_token": token, "platform": "tiktok", "paused": True,
        })
        assert res.status_code == 200
        assert {c["platform"]: c["paused"] for c in res.json()["channels"]} == {
            "twitch": False, "tiktok": True,
        }
        res = client.post(f"/api/live/{kid}/channels/pause", json={
            "player_token": token, "platform": "tiktok", "paused": False,
        })
        assert not any(c["paused"] for c in res.json()["channels"])

    def test_managing_chats_needs_the_host_token(self, client):
        created = _both(client).json()
        kid = created["koop_id"]
        for path, extra in (
            ("channels", {"platform": "twitch", "channel": "fremd"}),
            ("channels/remove", {"platform": "twitch"}),
            ("channels/pause", {"platform": "twitch", "paused": True}),
        ):
            for token in ("fremd", created["koop_id"]):
                res = client.post(f"/api/live/{kid}/{path}", json={"player_token": token, **extra})
                assert res.status_code == 404, path
                assert res.json()["error"] == "room_not_found"
        # A platform the room does not read looks the same.
        single = _create(client, channel="einzeln").json()
        res = client.post(f"/api/live/{single['koop_id']}/channels/pause", json={
            "player_token": single["player_token"], "platform": "tiktok", "paused": True,
        })
        assert res.status_code == 404

    def test_the_debug_seam_names_the_chat(self, client, monkeypatch):
        import live_ingest
        import main as main_module

        monkeypatch.setenv("KONTEXTO_DEV", "1")
        # The ingest runs in the WS worker only; the test client is an API
        # worker, so one is put in place by hand, without chat sockets.
        monkeypatch.setattr(live_ingest, "OFFLINE", True)
        monkeypatch.setattr(
            live_ingest, "_ingest",
            live_ingest.LiveChatIngest(main_module._db_path, main_module._resolve_room_guess),
        )
        created = _both(client).json()
        kid = created["koop_id"]
        for platform, word, viewer in (("tiktok", "kirsche", "tt:1"), (None, "birne", "2")):
            data = {"external_id": viewer, "display_name": "Mara", "text": word}
            if platform:
                data["platform"] = platform
            assert client.post(f"/api/live/{kid}/debug-message", json=data).status_code == 200
        guesses = client.get(f"/api/koop/{kid}/guesses").json()["guesses"]
        assert [(g["word"], g["source"]) for g in guesses] == [
            ("kirsche", "tiktok"), ("birne", "twitch"),
        ]
        host = client.get(f"/api/live/{kid}", params={"token": created["player_token"]}).json()
        assert {v["platform"] for v in host["top"]} == {"twitch", "tiktok"}

    def test_the_admin_sees_every_chat(self, client):
        import auth

        _both(client)
        res = client.get(
            "/api/admin/live-streams",
            headers={"Authorization": f"Bearer {auth.issue_session_token()}"},
        )
        stream = res.json()["streams"][0]
        assert [(c["platform"], c["paused"]) for c in stream["channels"]] == [
            ("twitch", False), ("tiktok", False),
        ]


class TestHostPoll:
    def test_events_and_boards_ride_on_the_poll(self, client, monkeypatch):
        import live_ingest
        import main as main_module

        monkeypatch.setenv("KONTEXTO_DEV", "1")
        monkeypatch.setattr(live_ingest, "OFFLINE", True)
        monkeypatch.setattr(
            live_ingest, "_ingest",
            live_ingest.LiveChatIngest(main_module._db_path, main_module._resolve_room_guess),
        )
        created = client.post("/api/live", json={"platform": "twitch", "channel": "kontexto"}).json()
        kid, token = created["koop_id"], created["player_token"]

        res = client.post(f"/api/live/{kid}/debug-event", json={
            "kind": "gift_bomb", "event_id": "b1", "display_name": "Mara", "amount": 5,
            "badges": "subscriber/12",
        })
        assert res.json() == {"stored": True}
        assert client.post(f"/api/live/{kid}/debug-event", json={
            "kind": "nonsense", "event_id": "b2", "display_name": "Mara",
        }).status_code == 422

        body = client.get(f"/api/live/{kid}", params={"token": token}).json()
        [event] = body["events"]
        assert (event["kind"], event["amount"], event["actor"]) == ("gift_bomb", 5, "Mara")
        assert event["badges"] == [{"set_id": "subscriber", "version": "12"}]
        assert set(body["boards"]) == {"busy", "sharp", "finders"}
        assert "game_number" not in body

        again = client.get(f"/api/live/{kid}", params={"token": token,
                                                        "events_after": event["id"]}).json()
        assert again["events"] == []

    def test_the_event_seam_is_closed_in_production(self, client, monkeypatch):
        monkeypatch.delenv("KONTEXTO_DEV", raising=False)
        res = client.post("/api/live/abc/debug-event", json={
            "kind": "cheer", "event_id": "c1", "display_name": "Mara",
        })
        assert res.status_code == 404
