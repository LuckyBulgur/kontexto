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
  /** Epoch ms of the first action this game; used for time-to-solve stats. */
  startedAt?: number;
}

export interface PastGame {
  gameNumber: number;
  date: string;
}

/** Persisted state of an endless-mode ("Unendlich") session. */
export interface InfiniteSession {
  /** The game currently in progress (or the one just finished). */
  current: GameState;
  /** Game numbers already finished this session — used to avoid repeats. */
  played: number[];
  /** Games solved this session (shown on the result card). */
  solvedCount: number;
  /** Size of the game pool, as reported by the backend. */
  totalGames: number;
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

export interface DayRecord {
  date: string;
  value: number;
}

export interface MonthlyPoint {
  month: string;
  pageviews: number;
  visitor_days: number;
  guesses: number;
  solves: number;
  games: number;
  unique_visitors: number;
}

export interface GameDifficultyEntry {
  mode: string;
  game_number: number;
  word: string;
  guesses: number;
  solves: number;
  reveals: number;
  hints: number;
  finished: number;
  solve_rate: number | null;
  avg_guesses: number | null;
}

/** Currently-online visitors (live presence), polled separately for real-time updates. */
export interface LiveData {
  active_now: number;
  by_page: Record<string, number>;
  window_seconds: number;
  generated_at: string;
}

export interface StatsData {
  generated_at: string;
  /** Snapshot of currently-online visitors at the time the stats were generated. */
  live: LiveData;
  visitors: { today: number; week: number; month: number };
  visitors_timeline: TimelinePoint[];
  pageviews_by_page: Record<string, number>;
  pageviews_timeline: TimelinePoint[];
  counters_total: Record<string, number>;
  counters_today: Record<string, number>;
  guesses_timeline: TimelinePoint[];
  solves_timeline: TimelinePoint[];
  solve_rate_timeline: TimelinePoint[];
  games_by_mode: Record<string, number>;
  duels_created: Record<string, number>;
  engagement: {
    guesses_total: number;
    solves_total: number;
    reveals_total: number;
    hints_total: number;
    solve_rate: number | null;
    avg_guesses_per_solve: number | null;
  };
  hints_by_difficulty: Record<string, number>;
  /** Histograms keyed by metric (e.g. "dist_guesses_kontexto") -> bucket -> count. */
  distributions: Record<string, Record<string, number>>;
  game_difficulty: { hardest: GameDifficultyEntry[]; easiest: GameDifficultyEntry[] };
  top_words: { word: string; count: number }[];
  devices: Record<string, number>;
  browsers: Record<string, number>;
  os: Record<string, number>;
  referrers: Record<string, number>;
  peak_hours: Record<string, number>;
  /** [weekday 0=Mon..6=Sun][hour 0..23] human pageview counts (Europe/Berlin). */
  activity_heatmap: number[][];
  /** Today's pageviews per hour, index = hour 0..current hour (Europe/Berlin). */
  today_hourly: number[];
  visitor_loyalty: { new: number; returning: number };
  stickiness: number | null;
  /** Cumulative "since the beginning" figures. unique_visitors is an HLL estimate. */
  all_time: {
    unique_visitors: number;
    pageviews: number;
    visitor_days: number;
    data_since: string | null;
    unique_since: string | null;
  };
  records: {
    best_visitors_day: DayRecord | null;
    best_guesses_day: DayRecord | null;
  };
  /** Active visitors over rolling windows (day / 7 days / 30 days). */
  active_users: { dau: number; wau: number; mau: number };
  /** Per-calendar-month series (oldest first). unique_visitors is an HLL estimate. */
  monthly: MonthlyPoint[];
  /** Finished games per month split by mode (popularity trend). */
  mode_monthly: { month: string; kontexto: number; duel: number; wordle: number; infinite: number; koop: number }[];
  bots_filtered: number;
  note: string;
}

export interface InfiniteNextResponse {
  gameNumber: number;
  total: number;
  totalGames: number;
}

export interface CompletionPayload {
  mode: "kontexto" | "wordle" | "infinite";
  game_number: number;
  outcome: "solved" | "gaveup";
  guesses: number;
  tips: number;
  duration_seconds: number;
  best_rank: number;
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
