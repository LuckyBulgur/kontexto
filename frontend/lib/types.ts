export interface GuessResult {
  word: string;
  rank: number;
  total: number;
}

export interface TipResult {
  word: string;
  rank: number;
}

export interface GameInfo {
  gameNumber: number;
  date: string;
  total: number;
}

export interface Guess {
  word: string;
  rank: number;
  isTip: boolean;
}

export interface RevealResult {
  word: string;
}

export interface GameState {
  gameNumber: number;
  guesses: Guess[];
  tips: number;
  solved: boolean;
  givenUp?: boolean;
}

export interface PastGame {
  gameNumber: number;
  date: string;
}

export interface PastGamesResponse {
  games: PastGame[];
  todayGame: number;
}

export type SortMode = "rank" | "chronological";
export type Difficulty = "easy" | "medium" | "hard";

export function getRankColor(rank: number): "green" | "yellow" | "red" {
  if (rank <= 300) return "green";
  if (rank <= 1500) return "yellow";
  return "red";
}

export function getBarWidth(rank: number, total: number): number {
  return Math.max(5, 100 * (1 - rank / total));
}
