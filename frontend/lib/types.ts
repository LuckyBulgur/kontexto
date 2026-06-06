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

export interface StreakData {
  datesPlayed: string[];
  currentStreak: number;
  longestStreak: number;
}

export interface ClosestWordEntry {
  word: string;
  rank: number;
}

export interface ClosestWordsResponse {
  words: ClosestWordEntry[];
  gameNumber: number;
}

export interface TimelinePoint {
  date: string;
  value: number;
}

export interface StatsData {
  generated_at: string;
  visitors: { today: number; week: number; month: number };
  visitors_timeline: TimelinePoint[];
  pageviews_by_page: Record<string, number>;
  counters_total: Record<string, number>;
  counters_today: Record<string, number>;
  guesses_timeline: TimelinePoint[];
  games_by_mode: Record<string, number>;
  engagement: {
    guesses_total: number;
    solves_total: number;
    reveals_total: number;
    hints_total: number;
    solve_rate: number | null;
    avg_guesses_per_solve: number | null;
  };
  top_words: { word: string; count: number }[];
  devices: Record<string, number>;
  browsers: Record<string, number>;
  referrers: Record<string, number>;
  peak_hours: Record<string, number>;
  bots_filtered: number;
  note: string;
}

export function getRankColor(rank: number): "green" | "yellow" | "red" {
  if (rank <= 300) return "green";
  if (rank <= 1500) return "yellow";
  return "red";
}

export function getBarWidth(rank: number, total: number): number {
  if (rank === 1) return 100;
  return Math.max(5, 100 * (1 - rank / total));
}
