export interface GuessResult {
  word: string;
  rank: number;
  total: number;
  /** Set when the guess was a typo with exactly one plausible reading: what was
   *  typed, so the player can see which word was actually scored. */
  corrected_from?: string | null;
}

export interface TipResult {
  word: string;
  rank: number;
}

export interface GameInfo {
  gameNumber: number;
  date: string;
  total: number;
  /** Lowest game number that follows the current pool rules. */
  firstCuratedGame: number;
}

export interface Guess {
  word: string;
  rank: number;
  isTip: boolean;
  /** What the player typed when this guess was a corrected typo. */
  correctedFrom?: string;
  /** Who played this word, where that is worth showing. Solo modes leave it
   *  unset; the stream chat sets it on every row, because the whole point of
   *  that mode is that a viewer sees their own name on the board. */
  by?: string;
}

export interface RevealResult {
  word: string;
}

/** What a room hands back once the caller's own round is over.
 *
 *  The game number is not a caption, it is the answer: /api/reveal serves the
 *  word for any number to anybody. So a room ships it only here, together with
 *  the word it no longer protects. */
export interface RoomRevealResult {
  word: string;
  game_number: number;
  round: number;
}

/** Which puzzle a new room opens on. The kind is the client's choice, the
 *  number is the server's, for the reason above. */
export type RoomGameSource = "today" | "random";

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
  /** Game numbers already finished this session, used to avoid repeats. */
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

export interface SurveyDetailEntry {
  source: string;
  detail: string;
  date: string;
}

export interface SurveyStats {
  /** All-time answers per source id. */
  sources: Record<string, number>;
  /** The same split per calendar month, oldest first. */
  sources_monthly: { month: string; sources: Record<string, number> }[];
  /** Newest optional free texts; never linked to a visitor. */
  recent_details: SurveyDetailEntry[];
  total: number;
}

/** One rated solution word, as the dashboard reads it. */
export interface WordRatingEntry {
  game_number: number;
  /** The played solution, or null when the payload carried no word list. */
  word: string | null;
  votes: number;
  verdicts: Record<"easy" | "right" | "hard", number>;
  reasons: Record<"unknown_word" | "no_idea" | "bad_neighbours", number>;
  share_hard: number;
  share_easy: number;
  share_right: number;
  /** The share that said they did not know the word at all. This is the figure
   *  that decides whether a word leaves the pool; a high share_hard on its own
   *  only says the round was long, which the guess count already says. */
  share_unknown: number;
  played_guesses?: number;
  played_solves?: number;
  played_reveals?: number;
  played_hints?: number;
}

export interface WordRatingDetailEntry {
  game_number: number;
  word: string | null;
  verdict: string;
  reason: string | null;
  detail: string;
  date: string;
}

export interface WordRatingStats {
  /** Votes a word needs before it appears in a ranking here. */
  min_votes: number;
  /** The higher threshold the player-facing tally uses. */
  player_min_votes: number;
  pool_size: number;
  games_with_any_vote: number;
  games_rated: number;
  votes_total: number;
  verdicts: Record<"easy" | "right" | "hard", number>;
  reasons: Record<"unknown_word" | "no_idea" | "bad_neighbours", number>;
  removal_candidates: WordRatingEntry[];
  too_easy: WordRatingEntry[];
  rated: WordRatingEntry[];
  details: WordRatingDetailEntry[];
}

/** Started versus finished games (modes that report a start). */
export interface FunnelStats {
  starts_by_mode: Record<string, number>;
  starts_total: number;
  finished_total: number;
  completion_rate: number | null;
  abandoned_total: number;
}

/** Share presses against arrivals through a shared link. */
export interface SharingStats {
  shares_by_mode: Record<string, number>;
  shares_total: number;
  arrivals_by_page: Record<string, number>;
  arrivals_total: number;
  arrivals_per_share: number | null;
}

/** Attention time per page, summed from heartbeats of visible tabs. */
export interface AttentionStats {
  seconds_by_page: Record<string, number>;
  seconds_total: number;
  sample_seconds: number;
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
  /** Self-reported attribution ("Woher kennst du Kontexto?"). */
  survey: SurveyStats;
  word_ratings: WordRatingStats;
  funnel: FunnelStats;
  sharing: SharingStats;
  attention: AttentionStats;
  /** Finished games per month split by mode (popularity trend). The backend
   *  fills one key per known mode, so the shape grows with analytics.GAME_MODES
   *  instead of needing a type change for every new mode. */
  mode_monthly: ({ month: string } & Record<string, number | string>)[];
  bots_filtered: number;
  note: string;
}

export interface InfiniteNextResponse {
  gameNumber: number;
  total: number;
  totalGames: number;
}

/** One exact rank of a game, the opening move of the Leiter mode. */
export interface WordAtRankResult {
  word: string;
  rank: number;
  gameNumber: number;
}

export interface DualNextResponse {
  gameNumbers: number[];
  total: number;
  totalGames: number;
}

export interface DualGuessResult {
  word: string;
  ranks: { gameNumber: number; rank: number }[];
  total: number;
  /** Set when the guess was a typo with exactly one plausible reading: what was
   *  typed, so the player can see which word was actually scored. */
  corrected_from?: string | null;
}

export interface SuddenDeathRound {
  gameNumber: number;
  total: number;
  hints: ClosestWordEntry[];
}

export interface CompletionPayload {
  mode: "kontexto" | "wordle" | "infinite" | "leiter" | "limit" | "doppel" | "suddendeath";
  game_number: number;
  outcome: "solved" | "gaveup";
  guesses: number;
  tips: number;
  duration_seconds: number;
  best_rank: number;
}

/**
 * Die Farbbänder, gemessen am Kernwortschatz.
 *
 * Bis 2026-09-21 wurde gegen 80.000 Wortformen gezählt und Grün lag bei Rang
 * 300, also im obersten 0,4 Prozent. Gezählt wird jetzt im Kernwortschatz mit
 * rund 14.000 Wörtern; dieselbe Grenze wäre dort Rang 52 und Grün praktisch
 * unerreichbar. 100 und 600 sind daher nicht umgerechnet, sondern bewusst
 * großzügiger als vorher: 0,7 und 4,3 Prozent statt 0,4 und 1,9.
 */
export function getRankColor(rank: number): "green" | "yellow" | "red" {
  if (rank <= 100) return "green";
  if (rank <= 600) return "yellow";
  return "red";
}

export function getBarWidth(rank: number, total: number): number {
  if (rank === 1) return 100;
  return Math.max(5, 100 * (1 - rank / total));
}
