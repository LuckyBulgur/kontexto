#!/usr/bin/env python3
"""Build the word list and the pictures of the easter eggs.

Which word shows which picture is not invented here. Two published sources do
the work and this script joins them:

* the German emoji annotations of Unicode CLDR (``cldr-json``,
  ``cldr-annotations-full/annotations/de``), which give every emoji its German
  name and keywords: the ghost is ``Gespenst`` with the keyword ``Geist``;
* Microsoft's Fluent Emoji in the flat style (MIT), as packaged by Iconify
  (``@iconify-json/fluent-emoji-flat``), which give every emoji an SVG and map
  its code point to a name.

A keyword counts only when it is a single word on the counted scale
(``core_words.json`` of the production build, passed with ``--core``), because
a word the game refuses would never reach a player as a guess. The emoji's own
name beats a capitalised keyword (a noun in CLDR's German), which beats a lower
case one (an adjective or a verb); lower case keywords are taken only when
``picks.txt`` names them, since most of them are moods and not things.

Three hand lists in ``frontend/data/easter-eggs/`` decide the rest:

* ``rejects.txt``: matches that are wrong, too weak to picture, or unfit for a
  game school classes play (alcohol, tobacco, weapons, religious symbols);
* ``picks.txt``: ``word: icon motion sound``, overriding the picture, the
  motion or adding a sound; ``*`` keeps what the sources gave, ``-`` means none;
* ``extra-icons.txt``: pictures the hand-made scenes use without a word.

On top of the hand lists every word is checked against the stop words, the hint
blocklist and the profanity engine of the backend, so the catalogue can never
put on screen what the game refuses to name on its own. ``klopfen`` (the knock,
``lib/knock-sound.ts``) and ``erdnuss`` (the mascot, ``lib/mascot.ts``) have
their own easter eggs and are left out.

Writes ``frontend/lib/easter-eggs/catalog.generated.ts`` and one SVG per used
picture under ``frontend/public/eggs/svg/``; both are committed.

Usage: build-easter-eggs.py --core <core_words.json>
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tarfile
import urllib.request
from dataclasses import dataclass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "backend"))

import wordlists  # noqa: E402  (needs the backend on the path first)

CACHE = os.path.join(ROOT, ".cache", "easter-eggs")
DATA = os.path.join(ROOT, "frontend", "data", "easter-eggs")
SVG_OUT = os.path.join(ROOT, "frontend", "public", "eggs", "svg")
TS_OUT = os.path.join(ROOT, "frontend", "lib", "easter-eggs", "catalog.generated.ts")
SOUNDS = os.path.join(DATA, "sounds.json")
BACKEND_DATA = os.path.join(ROOT, "backend", "data")

CLDR_URL = (
    "https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/"
    "cldr-annotations-full/annotations/de/annotations.json"
)
FLUENT_PACKAGE = "@iconify-json/fluent-emoji-flat"
FLUENT_VERSION = "1.2.6"
FLUENT_URL = f"https://registry.npmjs.org/{FLUENT_PACKAGE}/-/fluent-emoji-flat-{FLUENT_VERSION}.tgz"

MOTIONS = ("fly", "run", "drive", "swim", "rain", "rise", "pop", "bounce", "spin")
OWN_EGGS = frozenset({"klopfen", "erdnuss"})

# The motion a picture gets unless picks.txt says otherwise, by its emoji group.
GROUP_MOTION = {
    "Animals & Nature": "run",
    "Food & Drink": "rain",
    "Travel & Places": "pop",
    "Activities": "bounce",
    "Objects": "pop",
    "People & Body": "rise",
    "Smileys & Emotion": "rise",
    "Symbols": "pop",
    "Flags": "fly",
}
# Within a group, names that move differently.
NAME_MOTION = (
    (re.compile(r"bird|eagle|owl|duck|dove|parrot|swan|flamingo|peacock|bat$|bee|butterfly|fly$|mosquito|"
                r"cricket|beetle|ladybird|lady-beetle|feather|wing|phoenix|dodo|goose|rooster|chick"), "fly"),
    (re.compile(r"fish|whale|dolphin|shark|octopus|squid|jellyfish|seal|crab|lobster|shrimp|oyster|coral|otter"), "swim"),
    (re.compile(r"car$|automobile|bus$|minibus|trolleybus|taxi|truck|lorry|tractor|ambulance|fire-engine|"
                r"police-car|motorcycle|scooter|bicycle|locomotive|train|tram|railway|metro|racing-car|"
                r"sport-utility|pickup|ship|boat|ferry|canoe|sailboat|speedboat|skateboard|roller-skate|sled"), "drive"),
    (re.compile(r"airplane|helicopter|rocket|ufo|flying-saucer|satellite|parachute|balloon|kite|comet|"
                r"shooting-star|small-airplane"), "fly"),
    (re.compile(r"snowflake|droplet|leaf|blossom|confetti|sparkles|star$|coin|banknote|money"), "rain"),
    (re.compile(r"heart|bubble|ghost"), "rise"),
    (re.compile(r"ball$|soccer|basketball|volleyball|tennis|baseball|softball|rugby|football|bowling|ping-pong"), "bounce"),
    (re.compile(r"cyclone|tornado|gear|wheel|compass|dizzy|disk|globe"), "spin"),
)


@dataclass
class Entry:
    icon: str
    motion: str
    sound: str | None
    strength: int


def fetch(url: str, target: str) -> str:
    if not os.path.exists(target):
        os.makedirs(os.path.dirname(target), exist_ok=True)
        request = urllib.request.Request(url, headers={"User-Agent": "kontexto.de easter egg build"})
        with urllib.request.urlopen(request, timeout=120) as response, open(target + ".part", "wb") as f:
            f.write(response.read())
        os.replace(target + ".part", target)
    return target


def load_fluent() -> tuple[dict, dict[str, str], dict[str, str]]:
    archive = fetch(FLUENT_URL, os.path.join(CACHE, f"fluent-emoji-flat-{FLUENT_VERSION}.tgz"))
    with tarfile.open(archive, "r:gz") as tar:
        def read(name: str):
            member = tar.extractfile(f"package/{name}")
            if member is None:
                raise RuntimeError(f"{name} missing from {archive}")
            return json.loads(member.read().decode("utf-8"))

        icons = read("icons.json")
        chars = read("chars.json")
        metadata = read("metadata.json")
    group_of = {name: group for group, names in metadata["categories"].items() for name in names}
    return icons, chars, group_of


def load_lines(path: str) -> list[str]:
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        return [line.split("#", 1)[0].strip() for line in f if line.split("#", 1)[0].strip()]


def load_picks(path: str) -> dict[str, tuple[str, str, str]]:
    picks: dict[str, tuple[str, str, str]] = {}
    for line in load_lines(path):
        word, _, rest = line.partition(":")
        parts = rest.split()
        if not word or len(parts) != 3:
            raise SystemExit(f"picks.txt: cannot read {line!r}, expected 'word: icon motion sound'")
        key = word.strip().lower()
        if key in picks:
            raise SystemExit(f"picks.txt: {key} twice")
        picks[key] = (parts[0], parts[1], parts[2])
    return picks


def codepoints(glyph: str) -> str:
    return "-".join(f"{ord(c):x}" for c in glyph if ord(c) != 0xFE0F)


def motion_for(icon: str, group_of: dict[str, str]) -> str:
    for pattern, motion in NAME_MOTION:
        if pattern.search(icon):
            return motion
    return GROUP_MOTION.get(group_of.get(icon, ""), "pop")


def svg_markup(icon: dict, width: int, height: int) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {icon.get("width", width)} '
        f'{icon.get("height", height)}">{icon["body"]}</svg>\n'
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--core", required=True, help="core_words.json of the production build")
    parser.add_argument("--list", action="store_true", help="print every word with its picture")
    args = parser.parse_args()

    with open(args.core, encoding="utf-8") as f:
        core = set(json.load(f))
    with open(fetch(CLDR_URL, os.path.join(CACHE, "cldr-annotations-de.json")), encoding="utf-8") as f:
        annotations = json.load(f)["annotations"]["annotations"]
    fluent, chars, group_of = load_fluent()
    icons: dict = fluent["icons"]
    aliases: dict = fluent.get("aliases", {})
    width, height = fluent.get("width", 32), fluent.get("height", 32)

    def resolve(name: str) -> str | None:
        seen = set()
        while name in aliases and name not in icons and name not in seen:
            seen.add(name)
            name = aliases[name]["parent"]
        return name if name in icons else None

    with open(SOUNDS, encoding="utf-8") as f:
        sound_ids = {s["id"] for s in json.load(f)}
    rejects = set(load_lines(os.path.join(DATA, "rejects.txt")))
    picks = load_picks(os.path.join(DATA, "picks.txt"))
    extra_icons = load_lines(os.path.join(DATA, "extra-icons.txt"))
    stopwords = set(load_lines(os.path.join(BACKEND_DATA, "stopwords_de.txt")))
    hint_blocked = set(load_lines(os.path.join(BACKEND_DATA, "hint_blocklist_de.txt")))

    found: dict[str, tuple[int, str]] = {}
    for glyph, entry in annotations.items():
        icon = chars.get(codepoints(glyph))
        if not icon or resolve(icon) is None:
            continue
        name = (entry.get("tts") or [""])[0]
        for keyword in [name, *entry.get("default", [])]:
            if not keyword or " " in keyword or "-" in keyword:
                continue
            word = keyword.lower()
            if word not in core:
                continue
            strength = 0 if keyword == name else (1 if keyword[0].isupper() else 2)
            if word not in found or strength < found[word][0]:
                found[word] = (strength, icon)

    problems: list[str] = []
    typed_only: list[str] = []
    catalog: dict[str, Entry] = {}
    for word, (strength, icon) in found.items():
        if strength == 2 and word not in picks:
            continue
        catalog[word] = Entry(icon, motion_for(icon, group_of), None, strength)

    for word, (icon, motion, sound) in picks.items():
        base = catalog.get(word)
        if icon == "*":
            if base is None:
                problems.append(f"picks.txt: {word} keeps its picture but the sources give it none")
                continue
            icon = base.icon
        if resolve(icon) is None:
            problems.append(f"picks.txt: {word}: no Fluent picture named {icon}")
            continue
        if word not in core:
            # Not a word of its own on the scale (it folds onto another, or the
            # game refuses it), but typing it still fires: the input path
            # matches what the player typed, before the server answers.
            typed_only.append(word)
        if motion == "*":
            motion = base.motion if base and base.icon == icon else motion_for(icon, group_of)
        if motion not in MOTIONS:
            problems.append(f"picks.txt: {word}: unknown motion {motion}")
            continue
        if sound not in ("-", "*") and sound not in sound_ids:
            problems.append(f"picks.txt: {word}: unknown sound {sound}")
            continue
        catalog[word] = Entry(icon, motion, None if sound in ("-", "*") else sound, base.strength if base else 0)

    for word in list(catalog):
        reason = None
        if word in rejects:
            reason = "rejects.txt"
        elif word in OWN_EGGS:
            reason = "own easter egg"
        elif word in stopwords:
            reason = "stop word"
        elif word in hint_blocked:
            reason = "hint blocklist"
        elif wordlists.contains_profanity(word):
            reason = "profanity"
        if reason:
            if word in picks and reason != "rejects.txt":
                problems.append(f"picks.txt: {word} is refused ({reason})")
            del catalog[word]

    for word in rejects:
        if word in picks:
            problems.append(f"{word} is in both picks.txt and rejects.txt")
    for icon in extra_icons:
        if resolve(icon) is None:
            problems.append(f"extra-icons.txt: no Fluent picture named {icon}")

    if problems:
        print("\n".join(problems), file=sys.stderr)
        return 1

    used = sorted({e.icon for e in catalog.values()} | set(extra_icons))
    os.makedirs(SVG_OUT, exist_ok=True)
    for name in used:
        target = os.path.join(SVG_OUT, f"{name}.svg")
        markup = svg_markup(icons[resolve(name)], width, height)
        if not os.path.exists(target) or open(target, encoding="utf-8").read() != markup:
            with open(target, "w", encoding="utf-8", newline="\n") as f:
                f.write(markup)
    for stale in sorted(set(os.listdir(SVG_OUT)) - {f"{n}.svg" for n in used}):
        os.remove(os.path.join(SVG_OUT, stale))

    lines = [
        "// Generated by scripts/build-easter-eggs.py from Unicode CLDR (German emoji",
        "// annotations) and Microsoft Fluent Emoji Flat (MIT). Do not edit by hand:",
        "// change frontend/data/easter-eggs/{picks,rejects,extra-icons}.txt and rebuild.",
        'import type { EggMotion } from "./types";',
        "",
        "/** word -> [picture under /eggs/svg/, motion, sound under /eggs/sfx/ or null] */",
        "export const EGG_CATALOG: ReadonlyMap<string, readonly [string, EggMotion, string | null]> = new Map([",
    ]
    for word in sorted(catalog):
        e = catalog[word]
        sound = json.dumps(e.sound) if e.sound else "null"
        lines.append(f"  [{json.dumps(word, ensure_ascii=False)}, [{json.dumps(e.icon)}, {json.dumps(e.motion)}, {sound}]],")
    lines += ["]);", "", f"export const EGG_ICON_COUNT = {len(used)};", ""]
    os.makedirs(os.path.dirname(TS_OUT), exist_ok=True)
    with open(TS_OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))

    if args.list:
        for word in sorted(catalog):
            e = catalog[word]
            print(f"{word}: {e.icon} {e.motion} {e.sound or '-'}")
    with_sound = sum(1 for e in catalog.values() if e.sound)
    size = sum(os.path.getsize(os.path.join(SVG_OUT, f"{n}.svg")) for n in used)
    print(f"{len(catalog)} words, {with_sound} with a sound, {len(used)} pictures, {size // 1024} KB")
    if typed_only:
        print(f"{len(typed_only)} fire on typing only, not on the scale: {', '.join(sorted(typed_only))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
