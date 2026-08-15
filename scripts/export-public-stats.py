#!/usr/bin/env python3
"""Exportiert veröffentlichbare Kennzahlen aus der Analytics-Datenbank.

Hintergrund: Die AdSense-Prüfung bemängelt fehlenden eigenständigen Inhalt.
Echte, nur hier verfügbare Zahlen sind das stärkste Gegenmittel, weil sie
kein Wettbewerber reproduzieren kann. Dieses Skript erzeugt daraus einen
statischen Datenstand, den das Frontend zur Buildzeit einbindet.

Bewusst nur aggregierte Tabellen:

* ``analytics_counters`` und ``analytics_daily`` enthalten ausschließlich
  Tagessummen pro Metrik. Keine Rohereignisse, keine Fingerprints, keine
  HyperLogLog-Sketches werden gelesen.
* ``analytics_word_counts`` ist eine reine Wort-zu-Anzahl-Tabelle über alle
  Nutzenden hinweg und enthält keinerlei Zuordnung zu Personen oder Sitzungen.

Die Datenbank wird schreibgeschützt geöffnet (``mode=ro``), das Skript kann
den laufenden Betrieb also nicht stören.

Aufruf auf dem Server::

    python3 scripts/export-public-stats.py \\
        --db /opt/kontexto/data/duels.db \\
        --out frontend/content/data/public-stats.json

Die erzeugte Datei wird ins Repository übernommen. Ein erneuter Lauf
aktualisiert sie; ein fehlender Lauf lässt die Seite mit dem alten Stand
weiterlaufen, weshalb der Stichtag im Datensatz mitgeführt und auf der Seite
ausgewiesen wird.
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
from datetime import date, timedelta

# Kennzahlen, die veröffentlicht werden. Alles andere bleibt intern.
PUBLIC_COUNTERS = {
    "guesses": "Rateversuche",
    "solves": "gelöste Rätsel",
    "hints": "abgerufene Tipps",
    "reveals": "aufgelöste Rätsel",
    "duels_created": "erstellte Mehrspieler-Runden",
}

# Wörter, die in der Top-Liste nichts verloren haben: Sie sagen nichts über
# Spielverhalten aus, sondern nur über Tippfehler und Testeingaben.
MIN_WORD_COUNT = 25
TOP_WORDS = 100

# Absolutzahlen werden gerundet veröffentlicht. Exakte Werte wären eine
# Scheingenauigkeit und laden zu Vergleichen ein, die niemandem nützen.
def _round_public(n: int) -> int:
    if n < 1_000:
        return n - n % 10
    if n < 100_000:
        return n - n % 100
    return n - n % 1_000


def _sum_counter(conn: sqlite3.Connection, metric: str, since: str | None) -> int:
    sql = "SELECT COALESCE(SUM(value), 0) FROM analytics_counters WHERE metric = ?"
    params: list[object] = [metric]
    if since:
        sql += " AND date >= ?"
        params.append(since)
    return int(conn.execute(sql, params).fetchone()[0])


def _daily_series(conn: sqlite3.Connection, metric: str, days: int) -> list[dict]:
    """Tagesreihe einer Metrik.

    Quelle ist ``analytics_counters``: Dort liegen die serverseitig gezaehlten
    Aktionen (Rateversuche, Loesungen, Tipps). ``analytics_daily`` fuehrt die
    Reichweitenmetriken und kennt diese Schluessel nicht.
    """
    since = (date.today() - timedelta(days=days)).isoformat()
    rows = conn.execute(
        "SELECT date, SUM(value) FROM analytics_counters "
        "WHERE metric = ? AND date >= ? GROUP BY date ORDER BY date",
        (metric, since),
    ).fetchall()
    return [{"date": d, "value": _round_public(int(v))} for d, v in rows]


def _top_words(conn: sqlite3.Connection) -> list[dict]:
    try:
        rows = conn.execute(
            "SELECT word, count FROM analytics_word_counts "
            "WHERE count >= ? ORDER BY count DESC LIMIT ?",
            (MIN_WORD_COUNT, TOP_WORDS),
        ).fetchall()
    except sqlite3.OperationalError:
        return []
    return [{"word": w, "count": _round_public(int(c))} for w, c in rows]


def export(db_path: str, out_path: str) -> dict:
    if not os.path.exists(db_path):
        raise SystemExit(f"Datenbank nicht gefunden: {db_path}")

    uri = f"file:{db_path}?mode=ro"
    with sqlite3.connect(uri, uri=True) as conn:
        totals = {
            key: _round_public(_sum_counter(conn, key, since=None))
            for key in PUBLIC_COUNTERS
        }
        data = {
            "generated_on": date.today().isoformat(),
            "labels": PUBLIC_COUNTERS,
            "totals": totals,
            "guesses_per_solve": (
                round(totals["guesses"] / totals["solves"], 1)
                if totals.get("solves")
                else None
            ),
            "last_30_days": {
                "guesses": _daily_series(conn, "guesses", 30),
                "solves": _daily_series(conn, "solves", 30),
            },
            "top_words": _top_words(conn),
        }

    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return data


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--db", default="/opt/kontexto/data/duels.db",
                    help="Pfad zur SQLite-Datenbank (wird nur gelesen)")
    ap.add_argument("--out", default="frontend/content/data/public-stats.json",
                    help="Zieldatei für den JSON-Datenstand")
    args = ap.parse_args()

    data = export(args.db, args.out)
    print(f"Geschrieben: {args.out}")
    for key, label in PUBLIC_COUNTERS.items():
        print(f"  {label}: {data['totals'][key]:,}".replace(",", "."))
    print(f"  Top-Wörter: {len(data['top_words'])}")


if __name__ == "__main__":
    main()
