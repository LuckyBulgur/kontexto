export interface KoopPlayer {
  nickname: string;
  contribution_count: number;
  connected: boolean;
}

export interface KoopState {
  koop_id: string;
  game_number: number;
  tips_allowed: boolean;
  solved: boolean;
  solved_by: string | null;
  gave_up: boolean;
  best_rank: number | null;
  total: number;
  players: KoopPlayer[];
}

export interface NextGameResult {
  game_number: number;
  total: number;
}

export interface CreateKoopResponse {
  koop_id: string;
  player_token: string;
}

export interface JoinKoopResponse extends KoopState {
  player_token: string;
  nickname: string;
}

export interface KoopGuessResult {
  word: string;
  rank: number;
  total: number;
  already_guessed: boolean;
}

export interface KoopGuessEntry {
  nickname: string;
  word: string;
  rank: number;
  is_tip: boolean;
  guessed_at: string;
}

export type KoopWsMessage =
  | { type: "state"; players: KoopPlayer[]; best_rank: number | null; solved: boolean }
  | { type: "guess_added"; nickname: string; word: string; rank: number; is_tip: boolean }
  | { type: "koop_solved"; nickname: string | null; word: string | null }
  | { type: "koop_gave_up"; word: string | null }
  | { type: "next_game"; game_number: number }
  | { type: "player_joined"; nickname: string }
  | { type: "player_disconnected"; nickname: string }
  | { type: "player_reconnected"; nickname: string };
