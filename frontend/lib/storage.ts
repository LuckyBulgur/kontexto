import { GameState, StreakData } from "./types";

const STORAGE_KEY = "kontexto_state";
const STREAK_KEY = "kontexto_streak";
const THEME_KEY = "kontexto_theme";
const DIFFICULTY_KEY = "kontexto_difficulty";

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
