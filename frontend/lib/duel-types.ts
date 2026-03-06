export interface DuelPlayer {
  nickname: string;
  best_rank: number | null;
  guess_count: number;
  solved: boolean;
  connected: boolean;
}

export interface DuelState {
  duel_id: string;
  game_number: number;
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

export type DuelWsMessage =
  | { type: "player_joined"; nickname: string }
  | { type: "rank_update"; nickname: string; best_rank: number; guess_count: number }
  | { type: "player_solved"; nickname: string; guess_count: number }
  | { type: "player_disconnected"; nickname: string }
  | { type: "player_reconnected"; nickname: string }
  | { type: "state"; players: DuelPlayer[] };
