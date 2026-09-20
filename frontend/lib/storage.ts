import { GameState, InfiniteSession, StreakData } from "./types";
import { SoloModeId, SoloState } from "./solo-modes";

const STORAGE_KEY = "kontexto_state";
const STREAK_KEY = "kontexto_streak";
const THEME_KEY = "kontexto_theme";
const DIFFICULTY_KEY = "kontexto_difficulty";
const INFINITE_KEY = "kontexto_infinite";

export function loadGameState(gameNumber: number): GameState {
  if (typeof window === "undefined") return createEmpty(gameNumber);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmpty(gameNumber);
    const state: GameState = JSON.parse(raw);
    if (state.gameNumber !== gameNumber) return createEmpty(gameNumber);
    return state;
  } catch {
    return createEmpty(gameNumber);
  }
}

export function saveGameState(state: GameState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createEmpty(gameNumber: number): GameState {
  return { gameNumber, guesses: [], tips: 0, solved: false };
}

export function loadInfiniteSession(): InfiniteSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(INFINITE_KEY);
    if (!raw) return null;
    const session: InfiniteSession = JSON.parse(raw);
    // Defensive: only accept a structurally valid session.
    if (!session.current || typeof session.current.gameNumber !== "number") return null;
    if (!Array.isArray(session.played)) return null;
    return session;
  } catch {
    return null;
  }
}

export function saveInfiniteSession(session: InfiniteSession): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(INFINITE_KEY, JSON.stringify(session));
}

export function clearInfiniteSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(INFINITE_KEY);
}

/**
 * Solo mode sessions. Each mode gets its own key, so a Leiter round in progress
 * survives a detour into Sudden Death, and a broken payload from an older
 * version drops that one mode rather than all of them.
 */
const SOLO_KEYS: Record<SoloModeId, string> = {
  leiter: "kontexto_leiter",
  limit: "kontexto_limit",
  doppel: "kontexto_doppel",
  suddendeath: "kontexto_suddendeath",
};

export function loadSoloState<T extends SoloState>(mode: SoloModeId): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SOLO_KEYS[mode]);
    if (!raw) return null;
    const state = JSON.parse(raw) as T;
    // Defensive: a payload written by an older version, or by another mode, is
    // discarded instead of rendered into a half-broken board.
    if (!state || state.mode !== mode) return null;
    return state;
  } catch {
    return null;
  }
}

export function saveSoloState(state: SoloState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SOLO_KEYS[state.mode], JSON.stringify(state));
  } catch {
    /* a full or blocked storage must never break the running game */
  }
}

export function clearSoloState(mode: SoloModeId): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SOLO_KEYS[mode]);
}

export function loadTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function saveTheme(theme: "light" | "dark"): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_KEY, theme);
}

export function loadDifficulty(): string {
  if (typeof window === "undefined") return "easy";
  return localStorage.getItem(DIFFICULTY_KEY) || "easy";
}

export function saveDifficulty(difficulty: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DIFFICULTY_KEY, difficulty);
}

const SORT_KEY = "kontexto_sort";

export function loadSortMode(): "rank" | "chronological" {
  if (typeof window === "undefined") return "rank";
  const saved = localStorage.getItem(SORT_KEY);
  if (saved === "rank" || saved === "chronological") return saved;
  return "rank";
}

export function saveSortMode(mode: "rank" | "chronological"): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SORT_KEY, mode);
}

export function loadStreakData(): StreakData {
  if (typeof window === "undefined") return { datesPlayed: [], currentStreak: 0, longestStreak: 0 };
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return { datesPlayed: [], currentStreak: 0, longestStreak: 0 };
    return JSON.parse(raw);
  } catch {
    return { datesPlayed: [], currentStreak: 0, longestStreak: 0 };
  }
}

export function saveStreakData(data: StreakData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STREAK_KEY, JSON.stringify(data));
}

export function recordGamePlayed(todayIso: string): StreakData {
  const data = loadStreakData();
  if (data.datesPlayed.includes(todayIso)) return data;

  data.datesPlayed.push(todayIso);
  data.datesPlayed.sort();

  // Compute current streak by walking backwards from todayIso
  let streak = 1;
  let current = new Date(todayIso + "T00:00:00");
  for (let i = data.datesPlayed.length - 2; i >= 0; i--) {
    const prev = new Date(data.datesPlayed[i] + "T00:00:00");
    const diff = (current.getTime() - prev.getTime()) / 86400000;
    if (diff === 1) {
      streak++;
      current = prev;
    } else {
      break;
    }
  }

  data.currentStreak = streak;
  if (streak > data.longestStreak) data.longestStreak = streak;

  saveStreakData(data);
  return data;
}
