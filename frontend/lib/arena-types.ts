/** The three timed multiplayer modes. */
export type ArenaModeId = "royale" | "blitz" | "timerush";

export type ArenaStatus = "lobby" | "running" | "finished";

export interface ArenaPlayer {
  nickname: string;
  best_rank: number | null;
  guess_count: number;
  solved: boolean;
  connected: boolean;
  /** The personal clock; only Zeitbonus-Jagd fills it. Absolute UTC. */
  deadline_at: string | null;
  eliminated: boolean;
  place: number | null;
}

export interface ArenaState {
  arena_id: string;
  mode: ArenaModeId;
  game_number: number;
  status: ArenaStatus;
  /** Battle Royale: how many elimination phases have passed. */
  phase: number;
  /** The shared clock as an absolute UTC timestamp, or null when there is none. */
  deadline_at: string | null;
  winner: string | null;
  round: number;
  players: ArenaPlayer[];
}

export interface CreateArenaResponse {
  arena_id: string;
  player_token: string;
  mode: ArenaModeId;
}

export interface JoinArenaResponse extends ArenaState {
  player_token: string;
}

export interface ArenaGuessResult {
  word: string;
  rank: number;
  total: number;
  /** The deadline this player now runs against, straight from the server. */
  deadline_at: string | null;
  finished: boolean;
}

export type ArenaWsMessage =
  | ({ type: "state" } & ArenaState)
  | { type: "arena_started"; phase: number; deadline_at: string | null }
  | { type: "phase_started"; phase: number; deadline_at: string }
  | { type: "player_joined"; nickname: string }
  | {
      type: "rank_update";
      nickname: string;
      best_rank: number | null;
      guess_count: number;
      deadline_at: string | null;
    }
  | { type: "player_solved"; nickname: string; guess_count: number }
  | { type: "player_eliminated"; nickname: string; place: number | null }
  | { type: "arena_finished"; winner: string | null }
  | { type: "next_game"; game_number: number }
  | { type: "player_disconnected"; nickname: string }
  | { type: "player_reconnected"; nickname: string };
