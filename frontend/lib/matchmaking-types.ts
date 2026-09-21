/** Every mode the random queue serves. */
export type QueueModeId =
  | "duel"
  | "koop"
  | "wordle_duel"
  | "royale"
  | "blitz"
  | "timerush";

/** When a round of a mode starts, as the server states it. */
export interface PartyRule {
  /** Below this many players nothing starts. */
  min_players: number;
  /** At this many it starts at once, without waiting out the grace period. */
  max_players: number;
  /** How long a party smaller than max_players waits for more before starting. */
  grace_seconds: number;
}

export interface MatchmakingTicket extends PartyRule {
  ticket: string;
  mode: QueueModeId;
  /** The name the server assigned; a rejected or missing one is replaced. */
  nickname: string;
}

export interface MatchmakingStatus extends PartyRule {
  mode: QueueModeId;
  nickname: string;
  matched: boolean;
  room_id: string | null;
  player_token: string | null;
  /** Players currently queued for this mode. */
  waiting: number;
}

/** How busy one mode is right now. */
export interface ModeLoad {
  /** Players queued for this mode and not yet matched. */
  waiting: number;
  /** Players in a live room of this mode, rooms from invite links included. */
  playing: number;
}

/**
 * The load figures the picker shows before a ticket exists.
 *
 * Every queue mode is a key, so a mode nobody is playing reads as a zero and
 * the caller never has to decide what a missing one means.
 */
export interface MatchmakingLive {
  modes: Record<QueueModeId, ModeLoad>;
  waiting_total: number;
  playing_total: number;
}

/** Where a matched room of this mode lives. */
export function roomPath(mode: QueueModeId, roomId: string): string {
  switch (mode) {
    case "duel":
      return `/duel/${roomId}/`;
    case "koop":
      return `/koop/${roomId}/`;
    case "wordle_duel":
      return `/wordle/duel/${roomId}/`;
    default:
      return `/arena/${roomId}/`;
  }
}
