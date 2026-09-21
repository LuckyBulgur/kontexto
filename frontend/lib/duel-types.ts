export interface DuelPlayer {
  nickname: string;
  best_rank: number | null;
  guess_count: number;
  tip_count: number;
  solved: boolean;
  connected: boolean;
}

export interface DuelState {
  duel_id: string;
  /** The round counter, which is what a board reset keys on. The game number
   *  stays on the server while the round is open (see RoomRevealResult). */
  round: number;
  tips_allowed: boolean;
  players: DuelPlayer[];
}

export interface CreateDuelResponse {
  duel_id: string;
  player_token: string;
}

export interface JoinDuelResponse extends DuelState {
  player_token: string;
}

export interface DuelGuessHistoryEntry {
  word: string;
  rank: number;
  guessed_at: string;
}

export interface NextGameResult {
  round: number;
  total: number;
}

export type DuelWsMessage =
  | { type: "player_joined"; nickname: string }
  | { type: "rank_update"; nickname: string; best_rank: number; guess_count: number; tip_count: number }
  | { type: "player_solved"; nickname: string; guess_count: number; tip_count: number }
  | { type: "next_round"; round: number }
  | { type: "player_disconnected"; nickname: string }
  | { type: "player_reconnected"; nickname: string }
  | { type: "state"; players: DuelPlayer[] };
