"""Creator URL restrictions and immutable first-come daily assignment."""

import asyncio
import os
import tempfile
from datetime import date, timedelta

import pytest

import creator_spot
from database import get_db, init_db


@pytest.mark.parametrize("clip,channel", [
    ("https://www.tiktok.com/@name/video/123", "https://www.tiktok.com/@name"),
    ("https://www.youtube.com/shorts/abc_123", "https://www.youtube.com/@name"),
    ("https://youtu.be/abc_123", "https://www.youtube.com/channel/abc_123"),
    ("https://www.twitch.tv/videos/123", "https://www.twitch.tv/name"),
    ("https://clips.twitch.tv/Clip_123", "https://www.twitch.tv/name"),
    ("https://www.instagram.com/reel/abc_123", "https://www.instagram.com/name"),
])
def test_allowed_platforms(clip, channel):
    assert creator_spot.social_url(clip, "clip")[1] == creator_spot.social_url(channel, "channel")[1]


@pytest.mark.parametrize("url", [
    "http://www.youtube.com/shorts/abc", "https://youtube.com.evil.test/shorts/abc",
    "https://evil.test/@name", "https://user@www.youtube.com/shorts/abc",
    "https://www.youtube.com:444/shorts/abc", "https://www.youtube.com/redirect?url=https://evil.test",
    "https://www.instagram.com/p/photo", "https://www.tiktok.com/@name",
])
def test_rejects_non_video_or_untrusted_url(url):
    with pytest.raises(creator_spot.SubmissionError):
        creator_spot.social_url(url, "clip")


def test_review_queue_and_day_snapshot(monkeypatch):
    monkeypatch.setenv("KONTEXTO_DEV", "1")

    async def scenario(path):
        await init_db(path)
        db = await get_db(path)
        try:
            empty = await creator_spot.today(db, 100, date.today())
            assert empty is None
            first = await creator_spot.submit(db, clip_url="https://www.youtube.com/shorts/first", channel_url="https://www.youtube.com/@first", channel_name="First", email="first@example.com", ip="1")
            second = await creator_spot.submit(db, clip_url="https://www.youtube.com/shorts/second", channel_url="https://www.youtube.com/@second", channel_name="Second", email=None, ip="2")
            assert await creator_spot.review(db, second, True)
            assert await creator_spot.review(db, first, True)
            assert not await creator_spot.review(db, first, False)
            assert await creator_spot.today(db, 100, date.today()) is None
            tomorrow = date.today() + timedelta(days=1)
            assert (await creator_spot.today(db, 101, tomorrow))["channel_name"] == "First"
            assert (await creator_spot.today(db, 101, tomorrow))["channel_name"] == "First"
            assert (await creator_spot.today(db, 102, tomorrow + timedelta(days=1)))["channel_name"] == "Second"
            rows = await creator_spot.list_submissions(db)
            assert next(row for row in rows if row["id"] == first)["email"] is None
        finally:
            await db.close()

    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as directory:
        asyncio.run(scenario(os.path.join(directory, "test.db")))


def test_admin_can_fill_only_an_empty_day_with_approved_clip(monkeypatch):
    monkeypatch.setenv("KONTEXTO_DEV", "1")

    async def scenario(path):
        await init_db(path)
        db = await get_db(path)
        try:
            first = await creator_spot.submit(db, clip_url="https://www.youtube.com/shorts/first", channel_url="https://www.youtube.com/@first", channel_name="First", email="first@example.com", ip="1")
            second = await creator_spot.submit(db, clip_url="https://www.youtube.com/shorts/second", channel_url="https://www.youtube.com/@second", channel_name="Second", email=None, ip="2")
            assert not await creator_spot.show_today(db, first, 100)  # still pending
            assert await creator_spot.review(db, first, True)
            assert await creator_spot.review(db, second, True)
            assert await creator_spot.today(db, 100, date.today()) is None
            assert await creator_spot.show_today(db, second, 100)
            assert await creator_spot.day_submission_id(db, 100) == second
            assert (await creator_spot.today(db, 100, date.today()))["channel_name"] == "Second"
            assert not await creator_spot.show_today(db, first, 100)
            assert not await creator_spot.show_today(db, second, 101)  # already shown
            assert await creator_spot.day_submission_id(db, 101) is None
            assert await creator_spot.show_today(db, first, 101)  # no prior day row
            rows = await creator_spot.list_submissions(db)
            assert next(row for row in rows if row["id"] == second)["email"] is None
        finally:
            await db.close()

    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as directory:
        asyncio.run(scenario(os.path.join(directory, "test.db")))
