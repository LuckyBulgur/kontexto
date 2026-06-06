import type { TileColor, WordleStats, GameStatus } from "./wordle-types";

const KEYS = {
  state: "wordle_state",
  randomState: "wordle_random_state",
  stats: "wordle_stats",
  hardMode: "wordle_hard_mode",
  duelToken: (duelId: string) => `wordle_duel_${duelId}`,
  duelNickname: (duelId: string) => `wordle_duel_nick_${duelId}`,
};

export interface WordleGameState {
  gameNumber: number;
  guesses: string[];
  evaluations: TileColor[][];
  status: GameStatus;
}

export function loadWordleState(currentGameNumber: number): WordleGameState | null {
  try {
    const raw = localStorage.getItem(KEYS.state);
    if (!raw) return null;
    const state: WordleGameState = JSON.parse(raw);
    if (state.gameNumber !== currentGameNumber) return null;
    return state;
  } catch {
    return null;
  }
}

export function saveWordleState(state: WordleGameState): void {
  localStorage.setItem(KEYS.state, JSON.stringify(state));
}

export function loadWordleRandomState(currentGameNumber: number): WordleGameState | null {
  try {
    const raw = localStorage.getItem(KEYS.randomState);
    if (!raw) return null;
    const state: WordleGameState = JSON.parse(raw);
    if (state.gameNumber !== currentGameNumber) return null;
    return state;
  } catch {
    return null;
  }
}

export function saveWordleRandomState(state: WordleGameState): void {
  localStorage.setItem(KEYS.randomState, JSON.stringify(state));
}

export function loadWordleStats(): WordleStats {
  try {
    const raw = localStorage.getItem(KEYS.stats);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { played: 0, won: 0, currentStreak: 0, maxStreak: 0, distribution: [0, 0, 0, 0, 0, 0], lastPlayed: -1 };
}

export function saveWordleStats(stats: WordleStats): void {
  localStorage.setItem(KEYS.stats, JSON.stringify(stats));
}

export function updateStatsAfterGame(gameNumber: number, won: boolean, guessCount: number): WordleStats {
  const stats = loadWordleStats();
  stats.played++;
  if (won) {
    stats.won++;
    stats.distribution[guessCount - 1]++;
    if (stats.lastPlayed === gameNumber - 1 || stats.lastPlayed === -1) {
      stats.currentStreak++;
    } else {
      stats.currentStreak = 1;
    }
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
  } else {
    stats.currentStreak = 0;
  }
  stats.lastPlayed = gameNumber;
  saveWordleStats(stats);
  return stats;
}

export function loadHardMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEYS.hardMode) === "true";
}

export function saveHardMode(enabled: boolean): void {
  localStorage.setItem(KEYS.hardMode, enabled ? "true" : "false");
}

export function loadDuelToken(duelId: string): string | null {
  return localStorage.getItem(KEYS.duelToken(duelId));
}

export function saveDuelToken(duelId: string, token: string): void {
  localStorage.setItem(KEYS.duelToken(duelId), token);
}

export function loadDuelNickname(duelId: string): string | null {
  return localStorage.getItem(KEYS.duelNickname(duelId));
}

export function saveDuelNickname(duelId: string, nickname: string): void {
  localStorage.setItem(KEYS.duelNickname(duelId), nickname);
}
