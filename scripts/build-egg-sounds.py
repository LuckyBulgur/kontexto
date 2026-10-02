#!/usr/bin/env python3
"""Fetch and prepare the easter egg sounds.

Reads ``frontend/data/easter-eggs/sounds.json`` (id, source URL, license, how
many seconds to keep), downloads every source into a gitignored cache and writes
``frontend/public/eggs/sfx/<id>.mp3``. Every file is prepared the way
``public/sounds/klopfen.mp3`` was: mono, leading silence cut, levelled to about
-25 LUFS with true peaks at -6 dBFS so nothing clips, a short fade at the end so
a cut never clicks. The page plays them at a lower volume on top of that.

Every source is CC0. Needs ``ffmpeg`` on the path. The outputs are committed, so
this only runs when the manifest changes.

Usage: build-egg-sounds.py [--force]
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "frontend", "data", "easter-eggs", "sounds.json")
CACHE = os.path.join(ROOT, ".cache", "easter-eggs", "sfx-src")
OUT = os.path.join(ROOT, "frontend", "public", "eggs", "sfx")
FADE_SECONDS = 0.25
USER_AGENT = "Mozilla/5.0 (kontexto.de easter egg build)"


def fetch(url: str, target: str) -> None:
    if os.path.exists(target) and os.path.getsize(target) > 0:
        return
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response, open(target + ".part", "wb") as f:
        shutil.copyfileobj(response, f)
    os.replace(target + ".part", target)


def prepare(source: str, target: str, seconds: float) -> None:
    fade_start = max(0.0, seconds - FADE_SECONDS)
    audio_filter = ",".join(
        [
            "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02",
            f"atrim=0:{seconds}",
            f"afade=t=out:st={fade_start}:d={FADE_SECONDS}",
            "loudnorm=I=-25:TP=-6:LRA=11",
        ]
    )
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", source,
            "-af", audio_filter,
            "-ac", "1", "-ar", "44100",
            "-codec:a", "libmp3lame", "-b:a", "64k",
            target,
        ],
        check=True,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--force", action="store_true", help="rebuild files that already exist")
    args = parser.parse_args()

    if shutil.which("ffmpeg") is None:
        print("ffmpeg is not on the path.", file=sys.stderr)
        return 1

    with open(MANIFEST, encoding="utf-8") as f:
        sounds = json.load(f)
    os.makedirs(CACHE, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)

    wanted = set()
    failures = 0
    for sound in sounds:
        sound_id = sound["id"]
        wanted.add(f"{sound_id}.mp3")
        target = os.path.join(OUT, f"{sound_id}.mp3")
        if os.path.exists(target) and not args.force:
            continue
        source = os.path.join(CACHE, os.path.basename(sound["source"]))
        try:
            fetch(sound["source"], source)
            prepare(source, target, float(sound["seconds"]))
        except (OSError, subprocess.CalledProcessError) as error:
            failures += 1
            print(f"{sound_id}: {error}", file=sys.stderr)
            continue
        print(f"{sound_id}: {os.path.getsize(target) // 1024} KB")

    stale = sorted(name for name in os.listdir(OUT) if name.endswith(".mp3") and name not in wanted)
    for name in stale:
        os.remove(os.path.join(OUT, name))
        print(f"removed {name}")

    total = sum(os.path.getsize(os.path.join(OUT, n)) for n in os.listdir(OUT))
    print(f"{len(wanted)} sounds, {total // 1024} KB, {failures} failed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
