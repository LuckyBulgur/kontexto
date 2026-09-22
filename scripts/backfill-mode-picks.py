"""Give the popular-mode badge the history it already had under another name.

Why this is honest and not a fudge
----------------------------------
``record_mode_pick`` counts where a player commits to a mode, and the picker
badges the leader of a tab once a tab has at least ``POPULAR_MIN_PICKS`` behind
it. The counter shipped on 2026-09-22 and therefore starts at zero, so the
badge stays away for days even though the site has the traffic: 1,9 million
guesses, 25.000 solves, and nothing at all under ``mode_picks``.

For the solo tab the count already exists under another name. ``record_start``
writes ``starts`` and then calls ``record_mode_pick("solo", mode)`` with the
same event, and ``starts`` is deduped per fingerprint, mode and game exactly as
a pick is. Same event, same deduplication, different metric name: copying it
across states nothing new about the past.

For the other two tabs there is no equivalent. A created room was never
counted, and guesses are not picks, since one duel produces hundreds of them.
Those tabs stay empty until they have earned a badge, which is the point of the
floor.

Idempotent: a date and mode that already carries a ``mode_picks`` row is left
alone, so a second run changes nothing and a partial run can be repeated.

    python scripts/backfill-mode-picks.py /app/data/duels.db --dry-run
    python scripts/backfill-mode-picks.py /app/data/duels.db
"""

from __future__ import annotations

import argparse
import pathlib
import sqlite3
import sys

# Runs both from a checkout and piped into the container, where there is no
# __file__ and the backend already sits on the path.
if "__file__" in globals():
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "backend"))
sys.path.append("/app/backend")

SOURCE_METRIC = "starts"
TARGET_METRIC = "mode_picks"
GROUP = "solo"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("database")
    parser.add_argument("--days", type=int, default=30,
                        help="how far back to copy, matching POPULAR_WINDOW_DAYS")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    from analytics import SOLO_PICK_MODES

    db = sqlite3.connect(args.database)
    rows = db.execute(
        "SELECT date, dimension, value FROM analytics_counters "
        f"WHERE metric = ? AND date >= date('now', '-{int(args.days)} day') "
        "ORDER BY date",
        (SOURCE_METRIC,),
    ).fetchall()

    existing = {
        (date, dimension)
        for date, dimension in db.execute(
            "SELECT date, dimension FROM analytics_counters WHERE metric = ?",
            (TARGET_METRIC,),
        ).fetchall()
    }

    planned: list[tuple[str, str, int]] = []
    for date, mode, value in rows:
        if mode not in SOLO_PICK_MODES:
            continue
        dimension = f"{GROUP}:{mode}"
        if (date, dimension) in existing:
            continue
        planned.append((date, dimension, int(value or 0)))

    total = sum(value for _, _, value in planned)
    print(f"{len(planned)} rows, {total} picks to copy from {SOURCE_METRIC}")
    for date, dimension, value in planned[:10]:
        print(f"  {date}  {dimension:22s} {value}")
    if len(planned) > 10:
        print(f"  ... and {len(planned) - 10} more")

    if args.dry_run:
        print("Dry run: nothing written.")
        return 0

    db.executemany(
        "INSERT INTO analytics_counters (date, metric, dimension, value) "
        "VALUES (?, ?, ?, ?) "
        "ON CONFLICT(date, metric, dimension) DO UPDATE SET value = value + excluded.value",
        [(date, TARGET_METRIC, dimension, value) for date, dimension, value in planned],
    )
    db.commit()

    after = db.execute(
        "SELECT dimension, SUM(value) FROM analytics_counters "
        f"WHERE metric = ? AND date >= date('now', '-{int(args.days)} day') "
        "GROUP BY dimension ORDER BY 2 DESC",
        (TARGET_METRIC,),
    ).fetchall()
    print("\nthe solo tab now reads:")
    for dimension, value in after:
        print(f"  {dimension:22s} {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
