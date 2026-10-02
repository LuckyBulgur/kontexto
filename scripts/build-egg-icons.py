#!/usr/bin/env python3
"""Write the pictures of the hand-made easter egg scenes.

The scenes (``frontend/lib/easter-eggs/scenes.ts``) name their pictures by
Fluent Emoji Flat name, and ``frontend/data/easter-eggs/scene-icons.txt`` lists
every one of them. This script takes Microsoft's Fluent Emoji in the flat style
(MIT), as packaged by Iconify (``@iconify-json/fluent-emoji-flat``), and writes
one SVG per listed name to ``frontend/public/eggs/svg/``, removing every SVG
the list no longer names. The outputs are committed, so this only runs when a
scene gains or loses a picture.

Usage: build-egg-icons.py
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tarfile
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache", "easter-eggs")
ICON_LIST = os.path.join(ROOT, "frontend", "data", "easter-eggs", "scene-icons.txt")
SVG_OUT = os.path.join(ROOT, "frontend", "public", "eggs", "svg")

FLUENT_PACKAGE = "@iconify-json/fluent-emoji-flat"
FLUENT_VERSION = "1.2.6"
FLUENT_URL = f"https://registry.npmjs.org/{FLUENT_PACKAGE}/-/fluent-emoji-flat-{FLUENT_VERSION}.tgz"


def fetch(url: str, target: str) -> str:
    if not os.path.exists(target):
        os.makedirs(os.path.dirname(target), exist_ok=True)
        request = urllib.request.Request(url, headers={"User-Agent": "kontexto.de easter egg build"})
        with urllib.request.urlopen(request, timeout=120) as response, open(target + ".part", "wb") as f:
            f.write(response.read())
        os.replace(target + ".part", target)
    return target


def load_fluent() -> dict:
    archive = fetch(FLUENT_URL, os.path.join(CACHE, f"fluent-emoji-flat-{FLUENT_VERSION}.tgz"))
    with tarfile.open(archive, "r:gz") as tar:
        member = tar.extractfile("package/icons.json")
        if member is None:
            raise RuntimeError(f"icons.json missing from {archive}")
        return json.loads(member.read().decode("utf-8"))


def load_lines(path: str) -> list[str]:
    with open(path, encoding="utf-8") as f:
        return [line.split("#", 1)[0].strip() for line in f if line.split("#", 1)[0].strip()]


def svg_markup(icon: dict, width: int, height: int) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {icon.get("width", width)} '
        f'{icon.get("height", height)}">{icon["body"]}</svg>\n'
    )


def main() -> int:
    argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter).parse_args()

    fluent = load_fluent()
    icons: dict = fluent["icons"]
    aliases: dict = fluent.get("aliases", {})
    width, height = fluent.get("width", 32), fluent.get("height", 32)

    def resolve(name: str) -> str | None:
        seen = set()
        while name in aliases and name not in icons and name not in seen:
            seen.add(name)
            name = aliases[name]["parent"]
        return name if name in icons else None

    wanted = sorted(set(load_lines(ICON_LIST)))
    unknown = [name for name in wanted if resolve(name) is None]
    if unknown:
        print("\n".join(f"scene-icons.txt: no Fluent picture named {name}" for name in unknown), file=sys.stderr)
        return 1

    os.makedirs(SVG_OUT, exist_ok=True)
    for name in wanted:
        target = os.path.join(SVG_OUT, f"{name}.svg")
        markup = svg_markup(icons[resolve(name)], width, height)
        if not os.path.exists(target) or open(target, encoding="utf-8").read() != markup:
            with open(target, "w", encoding="utf-8", newline="\n") as f:
                f.write(markup)
    for stale in sorted(set(os.listdir(SVG_OUT)) - {f"{n}.svg" for n in wanted}):
        os.remove(os.path.join(SVG_OUT, stale))
        print(f"removed {stale}")

    size = sum(os.path.getsize(os.path.join(SVG_OUT, f"{n}.svg")) for n in wanted)
    print(f"{len(wanted)} pictures, {size // 1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
