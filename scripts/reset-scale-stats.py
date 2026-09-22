"""Drop the statistics the scale change made untrue, and keep the rest.

Why
---
On 2026-09-22 two things moved under the analytics at once. The displayed rank
stopped counting 80.000 word forms and started counting 15.517 core words, so
every figure that measures how hard a round was now mixes two scales. And the
solution pool was rebuilt, so game number N no longer names the word it named
when those figures were recorded; the old numbers ran to 9.537 and the new pool
stops at 2.785.

What goes
---------
* the Kontexto completion histograms, ``dist_guesses_kontexto``,
  ``dist_tips_kontexto``, ``dist_time_kontexto`` and ``dist_giveup_rank``:
  a round that needed 60 guesses on the old scale and one that needed 60 on the
  new one are not the same round, and averaging them says nothing
* ``analytics_game_stats``: keyed by game number, and the numbers now point at
  different words
* ``analytics_completion_seen``: the ledger that stops one player reporting the
  same game twice. Keyed by game number as well, so it would suppress honest
  reports about words nobody has played yet

What stays
----------
* every lifetime counter: guesses, solves, hints, reveals, attention, starts,
  rounds, rooms created, shares, the survey. They count what happened, and that
  happened
* the visitor sketches, which are people and not rounds
* **everything about Wordle**. That game did not change and its histograms are
  about the same thing. This is the reason the reset names metrics one by one
  instead of dropping anything that looks like a distribution

    python scripts/reset-scale-stats.py /app/data/duels.db --dry-run
    python scripts/reset-scale-stats.py /app/data/duels.db
"""

from __future__ import annotations

import argparse
import sqlite3

#: Kontexto only. The Wordle histograms measure an unchanged game.
STALE_METRICS = (
    "dist_guesses_kontexto",
    "dist_tips_kontexto",
    "dist_time_kontexto",
    "dist_giveup_rank",
)
#: Tables keyed by game number, which no longer names the same word.
STALE_TABLES = ("analytics_game_stats", "analytics_completion_seen")


def main() -> int:
    parser = argparse.ArgumentParser(description="reset the stats the new scale invalidated")
    parser.add_argument("database")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    db = sqlite3.connect(args.database)
    placeholders = ",".join("?" * len(STALE_METRICS))

    rows, total = db.execute(
        f"SELECT COUNT(*), COALESCE(SUM(value), 0) FROM analytics_counters "
        f"WHERE metric IN ({placeholders})",
        STALE_METRICS,
    ).fetchone()
    print(f"analytics_counters: {rows} rows, {total} recorded rounds")
    for metric in STALE_METRICS:
        value = db.execute(
            "SELECT COALESCE(SUM(value), 0) FROM analytics_counters WHERE metric = ?",
            (metric,),
        ).fetchone()[0]
        print(f"  {metric:24s} {value}")

    counts = {}
    for table in STALE_TABLES:
        counts[table] = db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        print(f"{table}: {counts[table]} rows")

    kept = db.execute(
        f"SELECT metric, SUM(value) FROM analytics_counters "
        f"WHERE metric NOT IN ({placeholders}) GROUP BY metric ORDER BY 2 DESC LIMIT 8",
        STALE_METRICS,
    ).fetchall()
    print("\nkept, for comparison:")
    for metric, value in kept:
        print(f"  {metric:24s} {value}")

    if args.dry_run:
        print("\nDry run: nothing deleted.")
        return 0

    db.execute(
        f"DELETE FROM analytics_counters WHERE metric IN ({placeholders})", STALE_METRICS
    )
    for table in STALE_TABLES:
        db.execute(f"DELETE FROM {table}")
    db.commit()
    db.execute("VACUUM")
    print("\nDone. The histograms start again from the round after this one.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
