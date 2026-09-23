/**
 * The shapes the live chat endpoints return.
 *
 * A live room is a koop room with a second input channel, so everything about
 * the round itself, the guess list, the ranks, the reveal, comes from the koop
 * types. What is here is only the chat binding and the overlay's own read.
 */

/** Which platform a room reads. YouTube is the one still missing. */
export type LivePlatform = "twitch" | "tiktok";

export const LIVE_PLATFORMS: readonly LivePlatform[] = ["twitch", "tiktok"];

export const PLATFORM_NAMES: Record<LivePlatform, string> = {
  twitch: "Twitch",
  tiktok: "TikTok",
};

/** What the reader is doing right now, as the host's status line shows it. */
export type ChatState = "connecting" | "live" | "error";

export interface LiveViewer {
  nickname: string;
  /** Accepted guesses over the whole session, not just this round. */
  hits: number;
  best_rank: number | null;
}

export interface LiveRoom {
  koop_id: string;
  platform: LivePlatform;
  channel: string;
  require_prefix: boolean;
  chat_state: ChatState;
  chat_error: string | null;
  /** Belongs in the OBS browser source, nowhere else. */
  overlay_token: string;
  top: LiveViewer[];
}

export interface CreateLiveResponse extends LiveRoom {
  player_token: string;
}

export interface LiveOverlayGuess {
  nickname: string;
  word: string;
  rank: number;
  is_tip: boolean;
}

/**
 * Everything the overlay shows. No game number and no target word: this view is
 * pointed at an audience, and the number is the answer.
 */
export interface LiveOverlayState {
  round: number;
  best_rank: number | null;
  total: number;
  solved: boolean;
  solved_by: string | null;
  gave_up: boolean;
  chat_state: ChatState;
  channel: string | null;
  /** Newest first. */
  recent: LiveOverlayGuess[];
  top: LiveViewer[];
}
