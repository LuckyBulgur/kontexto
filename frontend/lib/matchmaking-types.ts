/** Every mode the random queue serves. */
export type QueueModeId =
  | "duel"
  | "koop"
  | "wordle_duel"
  | "royale"
  | "blitz"
  | "timerush";

export interface MatchmakingTicket {
  ticket: string;
  mode: QueueModeId;
  /** The name the server assigned; a rejected or missing one is replaced. */
  nickname: string;
}

export interface MatchmakingStatus {
  mode: QueueModeId;
  nickname: string;
  matched: boolean;
  room_id: string | null;
  player_token: string | null;
  /** Players currently queued for this mode. */
  waiting: number;
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
