#!/usr/bin/env python3
"""Extract German 5-letter words from Hugo0/wordle data.

Source: https://github.com/Hugo0/wordle (PolyForm Noncommercial 1.0.0)
Filters: len == 5, only a-z characters, no umlauts/special chars.
Output: data/wordle/solutions.json (daily tier), data/wordle/valid_words.json (valid tier)
"""

import json
import os
import re
import urllib.request

WORDS_URL = "https://raw.githubusercontent.com/Hugo0/wordle/main/data/languages/de/words.json"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "wordle")


def download_words(url: str) -> dict:
    print(f"Downloading {url} ...")
    with urllib.request.urlopen(url) as resp:
        return json.loads(resp.read().decode("utf-8"))


def is_valid_word(word: str) -> bool:
    return len(word) == 5 and bool(re.fullmatch(r"[a-z]+", word))


def main():
    data = download_words(WORDS_URL)
    words = data.get("words", [])

    solutions = []
    valid_words = []
    blocked = 0
    filtered = 0

    for entry in words:
        word = entry["word"].lower()
        tier = entry.get("tier", "valid")

        if not is_valid_word(word):
            filtered += 1
            continue

        if tier == "blocked":
            blocked += 1
            continue

        if tier == "daily":
            solutions.append(word)
        else:
            valid_words.append(word)

    solutions = list(dict.fromkeys(solutions))
    valid_words = list(dict.fromkeys(valid_words))

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    solutions_path = os.path.join(OUTPUT_DIR, "solutions.json")
    valid_path = os.path.join(OUTPUT_DIR, "valid_words.json")

    with open(solutions_path, "w", encoding="utf-8") as f:
        json.dump(solutions, f, ensure_ascii=False)

    with open(valid_path, "w", encoding="utf-8") as f:
        json.dump(valid_words, f, ensure_ascii=False)

    print(f"Solutions:    {len(solutions)} words -> {solutions_path}")
    print(f"Valid words:  {len(valid_words)} words -> {valid_path}")
    print(f"Filtered out: {filtered} (non a-z or wrong length)")
    print(f"Blocked:      {blocked}")


if __name__ == "__main__":
    main()
