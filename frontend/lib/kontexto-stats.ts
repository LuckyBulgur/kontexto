// Local, privacy-safe Kontexto player statistics (localStorage only, no server).
// Mirrors the shape/spirit of lib/wordle-storage.ts. Streak / played-days live in
// the existing StreakData (lib/storage.ts) and are not duplicated here.

const KEY = "kontexto_stats";

/** Guess-count buckets, same labels as the server-side histogram. */
export const KONTEXTO_GUESS_BUCKETS = ["1", "2-3", "4-5", "6-10", "11-20", "21-50", "51-100", "100+"] as const;

export function guessBucket(n: number): string {
  if (n <= 1) return "1";
  if (n <= 3) return "2-3";
  if (n <= 5) return "4-5";
  if (n <= 10) return "6-10";
  if (n <= 20) return "11-20";
  if (n <= 50) return "21-50";
  if (n <= 100) return "51-100";
  return "100+";
}

export interface KontextoStats {
  played: number;
  solved: number;
  gaveUp: number;
  /** Sum of guess counts over solved games (for the average). */
  totalGuessesOnSolve: number;
  /** Fewest guesses in any solved game. */
  fewestGuesses: number | null;
  totalTips: number;
  /** Guess-count distribution over solved games, keyed by bucket label. */
  distribution: Record<string, number>;
}

function empty(): KontextoStats {
  return {
    played: 0, solved: 0, gaveUp: 0, totalGuessesOnSolve: 0,
    fewestGuesses: null, totalTips: 0, distribution: {},
  };
}

export function loadKontextoStats(): KontextoStats {
  if (typeof window === "undefined") return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...empty(), ...JSON.parse(raw) };
  } catch {
    // fall through to a clean object
  }
  return empty();
}

export function saveKontextoStats(stats: KontextoStats): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(stats));
}

export function updateKontextoStatsAfterGame(
  { won, guessCount, tips }: { won: boolean; guessCount: number; tips: number },
): KontextoStats {
  const stats = loadKontextoStats();
  stats.played += 1;
  stats.totalTips += tips;
  if (won) {
    stats.solved += 1;
    stats.totalGuessesOnSolve += guessCount;
    stats.fewestGuesses = stats.fewestGuesses == null
      ? guessCount
      : Math.min(stats.fewestGuesses, guessCount);
    const bucket = guessBucket(guessCount);
    stats.distribution[bucket] = (stats.distribution[bucket] ?? 0) + 1;
  } else {
    stats.gaveUp += 1;
  }
  saveKontextoStats(stats);
  return stats;
}
