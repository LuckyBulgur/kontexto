import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Empties the matchmaking queue before the suite runs.
 *
 * A ticket lives `TICKET_TTL_SECONDS` (300s, backend/matchmaking.py) and the
 * whole suite shares one SQLite file, so tickets from an earlier run are still
 * queued when the next one starts. Any test that reasons about how many players
 * are waiting then reads a number it did not cause, and, worse, its own player
 * can complete a party that leftovers had already half-filled, which makes the
 * count drop instead of rise. Both were observed.
 *
 * Only this one table is cleared. Wiping the database would also throw away the
 * rooms and analytics rows other tests rely on, and would hide real state bugs
 * behind a clean slate.
 */
export default function globalSetup() {
  const db = resolve(process.env.KONTEXTO_DATA_DIR ?? "../data-e2e", "duels.db");
  if (!existsSync(db)) return;

  const conn = new DatabaseSync(db);
  try {
    const exists = conn
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get("matchmaking_queue");
    if (exists) {
      const { changes } = conn.prepare("DELETE FROM matchmaking_queue").run();
      if (changes) {
        // eslint-disable-next-line no-console
        console.log(`[e2e] ${changes} alte Matchmaking-Tickets entfernt`);
      }
    }
  } finally {
    conn.close();
  }
}
