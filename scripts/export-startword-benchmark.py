#!/usr/bin/env python3
"""Misst, wie gut sich Kandidatenwörter als Kontexto-Startwort eignen.

Die Startwort-Empfehlungen auf der Seite waren bisher Behauptungen: „breite
Alltagsbegriffe funktionieren gut“. Dieses Skript belegt sie mit Zahlen aus den
tatsächlich ausgelieferten Rätseln, was kein Wettbewerber reproduzieren kann,
weil dafür die vorberechneten Ranglisten nötig sind.

Gemessen wird pro Kandidat über alle vorhandenen Spiele:

* **Median-Rang** als robuster Mittelwert (unempfindlich gegen Ausreißer).
* **bester und schlechtester Rang** als Spannweite.
* **Trefferquote unter Rang 300 bzw. 1500**, also wie oft das Wort grün
  beziehungsweise mindestens gelb ausfällt.
* **Streuung** als Interquartilsabstand. Das ist die eigentlich entscheidende
  Größe: Ein Startwort ist nicht dadurch gut, dass es niedrige Ränge liefert,
  sondern dadurch, dass sein Rang je nach Zielwort stark schwankt. Ein Wort mit
  konstantem Rang trägt keine Information, egal wie niedrig dieser Rang ist.

Alle Daten sind read-only; das Skript verändert nichts im Datenverzeichnis.

Aufruf auf dem Server::

    python3 scripts/export-startword-benchmark.py \\
        --data /opt/kontexto/data \\
        --out frontend/content/data/startword-benchmark.json
"""

from __future__ import annotations

import argparse
import json
import os
import statistics

import numpy as np

# Kandidaten aus drei Gruppen, damit die Auswertung nicht nur bestätigt, was
# man ohnehin empfiehlt: breite Alltagswörter, die getestet werden sollen;
# mittelbreite Begriffe als Kontrollgruppe; bewusst enge Spezialbegriffe als
# Gegenprobe. Verben und Adjektive sind absichtlich dabei, weil die Empfehlung
# „nicht nur Substantive“ ebenfalls belegt werden soll.
CANDIDATES = [
    # breit erwartet
    "mensch", "zeit", "wasser", "arbeit", "haus", "leben", "welt", "gefühl",
    "hand", "weg", "kind", "stadt", "tier", "körper", "natur", "licht",
    # Verben und Adjektive
    "gehen", "machen", "sehen", "sprechen", "bauen", "groß", "klein", "alt",
    "schnell", "warm", "hell", "schwer",
    # mittelbreit
    "musik", "essen", "geld", "sport", "farbe", "buch", "wetter", "maschine",
    "pflanze", "krankheit", "spiel", "reise",
    # bewusst eng, als Gegenprobe
    "thermodynamik", "quastenflosser", "grundbuch", "zellmembran",
    "hydraulik", "sonett",
]


def load_vocabulary(data_dir: str) -> dict[str, int]:
    with open(os.path.join(data_dir, "vocabulary.json"), encoding="utf-8") as f:
        return json.load(f)


def collect_ranks(data_dir: str, indices: list[int]) -> tuple[list[list[int]], int]:
    """Sammelt je Kandidat die Raenge ueber alle Spiele.

    Bewusst streamend: Ein einzelnes Rangarray belegt 80.000 * 4 Byte, alle 2.400
    Spiele gleichzeitig waeren rund 770 MB. Der Server liefert nebenbei die Seite
    aus, deshalb wird jede Datei einzeln geoeffnet, auf die wenigen benoetigten
    Positionen reduziert und sofort wieder freigegeben. Der Speicherbedarf haengt
    damit an der Zahl der Kandidaten, nicht an der Zahl der Spiele.
    """
    games_dir = os.path.join(data_dir, "games")
    files = sorted(f for f in os.listdir(games_dir) if f.endswith(".npz"))
    if not files:
        raise SystemExit(f"Keine Spieldaten in {games_dir}")

    idx = np.asarray(indices, dtype=np.int64)
    collected: list[list[int]] = [[] for _ in indices]
    for name in files:
        with np.load(os.path.join(games_dir, name)) as npz:
            picked = npz["ranks"][idx]
        for slot, value in enumerate(picked.tolist()):
            collected[slot].append(int(value))
    return collected, len(files)


def evaluate(word: str, values: list[int]) -> dict | None:
    if not values:
        return None
    values = list(values)
    values.sort()
    q1, q3 = (
        statistics.quantiles(values, n=4)[0],
        statistics.quantiles(values, n=4)[2],
    ) if len(values) >= 4 else (values[0], values[-1])
    n = len(values)
    return {
        "word": word,
        "games": n,
        "median": int(statistics.median(values)),
        "best": values[0],
        "worst": values[-1],
        "iqr": int(q3 - q1),
        "share_under_300": round(sum(v <= 300 for v in values) / n, 4),
        "share_under_1500": round(sum(v <= 1500 for v in values) / n, 4),
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--data", default="/opt/kontexto/data",
                    help="Datenverzeichnis mit vocabulary.json und games/")
    ap.add_argument("--out", default="frontend/content/data/startword-benchmark.json")
    args = ap.parse_args()

    vocab = load_vocabulary(args.data)

    present: list[tuple[str, int]] = []
    missing: list[str] = []
    for word in CANDIDATES:
        index = vocab.get(word)
        if index is None:
            missing.append(word)
        else:
            present.append((word, index))

    collected, games_count = collect_ranks(args.data, [i for _, i in present])

    results = []
    for (word, _), values in zip(present, collected):
        row = evaluate(word, values)
        if row:
            results.append(row)

    # Sortierung nach Median: das ist die Spalte, nach der Leserinnen und Leser
    # die Tabelle zuerst lesen. Die Streuung steht daneben, weil sie fachlich
    # aussagekräftiger ist, sich aber schlechter als Rangfolge eignet.
    results.sort(key=lambda r: r["median"])

    payload = {
        "vocabulary_size": len(vocab),
        "games_evaluated": games_count,
        "words_not_in_vocabulary": missing,
        "results": results,
    }

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Geschrieben: {args.out}")
    print(f"  Spiele ausgewertet: {games_count}, Vokabular: {len(vocab)}")
    if missing:
        print(f"  Nicht im Vokabular: {', '.join(missing)}")
    print()
    print(f"  {'Wort':<16}{'Median':>8}{'Bester':>8}{'IQR':>8}{'<300':>8}")
    for r in results[:15]:
        print(
            f"  {r['word']:<16}{r['median']:>8}{r['best']:>8}"
            f"{r['iqr']:>8}{r['share_under_300']:>8.0%}"
        )


if __name__ == "__main__":
    main()
