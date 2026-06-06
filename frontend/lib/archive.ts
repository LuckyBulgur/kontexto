const BUILD_API_BASE =
  process.env.KONTEXTO_BUILD_API_BASE || "http://127.0.0.1:8000/api";

export interface ArchiveEntry {
  gameNumber: number;
  date: string;
  word: string;
}

/** Module-level memo: holds the in-flight or completed promise for the current build process.
 *  Prevents re-fetching all reveal endpoints for every page / metadata / sitemap call. */
let cache: Promise<ArchiveEntry[]> | null = null;

async function fetchArchiveEntries(): Promise<ArchiveEntry[]> {
  let gamesRes: Response;
  try {
    gamesRes = await fetch(`${BUILD_API_BASE}/games`);
  } catch (err: unknown) {
    const msg = `archive build: /games fetch threw: ${String(err)}`;
    if (process.env.KONTEXTO_REQUIRE_ARCHIVE === "1") {
      throw new Error(msg);
    }
    console.warn(`[archive] ${msg} — returning empty archive (set KONTEXTO_REQUIRE_ARCHIVE=1 to fail-fast)`);
    return [];
  }

  if (!gamesRes.ok) {
    const msg = `archive build: /games -> HTTP ${gamesRes.status}`;
    if (process.env.KONTEXTO_REQUIRE_ARCHIVE === "1") {
      throw new Error(msg);
    }
    console.warn(`[archive] ${msg} — returning empty archive (set KONTEXTO_REQUIRE_ARCHIVE=1 to fail-fast)`);
    return [];
  }

  let games: { gameNumber: number; date: string }[];
  try {
    const data = (await gamesRes.json()) as { games: { gameNumber: number; date: string }[] };
    games = data.games;
  } catch (err: unknown) {
    const msg = `archive build: /games JSON parse failed: ${String(err)}`;
    if (process.env.KONTEXTO_REQUIRE_ARCHIVE === "1") {
      throw new Error(msg);
    }
    console.warn(`[archive] ${msg} — returning empty archive`);
    return [];
  }

  const out: ArchiveEntry[] = [];
  for (const g of games) {
    let revealRes: Response;
    try {
      revealRes = await fetch(`${BUILD_API_BASE}/reveal?game=${g.gameNumber}`);
    } catch (err: unknown) {
      const msg = `archive build: /reveal?game=${g.gameNumber} fetch threw: ${String(err)}`;
      if (process.env.KONTEXTO_REQUIRE_ARCHIVE === "1") {
        throw new Error(msg);
      }
      console.warn(`[archive] ${msg} — returning empty archive`);
      return [];
    }

    if (!revealRes.ok) {
      const msg = `archive build: /reveal?game=${g.gameNumber} -> HTTP ${revealRes.status}`;
      if (process.env.KONTEXTO_REQUIRE_ARCHIVE === "1") {
        throw new Error(msg);
      }
      console.warn(`[archive] ${msg} — returning empty archive`);
      return [];
    }

    const { word } = (await revealRes.json()) as { word: string };
    out.push({ gameNumber: g.gameNumber, date: g.date, word });
  }

  return out;
}

/**
 * Returns all past game entries (gameNumber, date, word).
 *
 * Memoised per build process: the first call initiates all fetches; subsequent
 * calls return the same Promise, so 98 /reveal requests happen exactly once.
 *
 * Resilience policy:
 *  - KONTEXTO_REQUIRE_ARCHIVE=1  → throws on ANY fetch failure (fail-fast for prod deploy).
 *  - Otherwise                   → warns and returns [] (dev/CI builds without a backend).
 */
export function getArchiveEntries(): Promise<ArchiveEntry[]> {
  if (!cache) {
    cache = fetchArchiveEntries();
  }
  return cache;
}
