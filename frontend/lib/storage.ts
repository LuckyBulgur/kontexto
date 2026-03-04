import { GameState } from "./types";

const STORAGE_KEY = "kontexto_state";
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
