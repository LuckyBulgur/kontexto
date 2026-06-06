export type TileColor = "GREEN" | "YELLOW" | "GRAY";

export type GameStatus = "playing" | "won" | "lost";

export interface WordleGuessResponse {
  valid: boolean;
  result?: TileColor[];
  error?: string;
  message?: string;
}

export interface WordleGameResponse {
  game_number: number;
}

export interface WordleRevealResponse {
  word: string;
}

export interface WordleDuelPlayer {
  nickname: string;
  guesses_used: number;
  solved: boolean;
  connected: boolean;
  results?: TileColor[][];
}

export interface WordleDuelState {
  game_number: number;
  players: WordleDuelPlayer[];
}

export interface WordleDuelGuessEntry {
  word: string;
  result: TileColor[];
  guessed_at: string;
}

export interface OpponentGuess {
  result: TileColor[];
  nickname: string;
  guessed_at: string;
}

export interface WordleStats {
  played: number;
  won: number;
  currentStreak: number;
  maxStreak: number;
  distribution: number[];
  lastPlayed: number;
  /** ISO "YYYY-MM-DD" of each day played; added for the calendar heatmap. */
  datesPlayed?: string[];
}

export type WordleDuelWsMessage =
  | { type: "state"; players: WordleDuelPlayer[] }
  | { type: "player_joined"; nickname: string }
  | { type: "guess_made"; nickname: string; guess_number: number; result: TileColor[] }
  | { type: "player_solved"; nickname: string; guesses_used: number }
  | { type: "player_failed"; nickname: string }
  | { type: "player_disconnected"; nickname: string }
  | { type: "player_reconnected"; nickname: string };
