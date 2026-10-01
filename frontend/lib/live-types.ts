import type { CategoryInfo } from "./categories";

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
  /** The chat this viewer plays in. One name on two platforms is two people. */
  platform: LivePlatform;
  nickname: string;
  /** Accepted guesses over the whole session, not just this round. */
  hits: number;
  best_rank: number | null;
}

/** A note from the operator, waiting to be shown on the host page only. */
export interface LiveHostMessage {
  id: number;
  text: string;
  /** ISO 8601, UTC. */
  sent_at: string;
}

/** One chat a room reads, as the host sees it. */
export interface LiveChannel {
  platform: LivePlatform;
  channel: string;
  chat_state: ChatState;
  chat_error: string | null;
  /** Set by the host: the reader stays connected, the lines stop counting. */
  paused: boolean;
}

export interface LiveRoom {
  koop_id: string;
  /** Every chat the room reads, oldest first, never empty. */
  channels: LiveChannel[];
  require_prefix: boolean;
  /** Belongs in the OBS browser source, nowhere else. */
  overlay_token: string;
  top: LiveViewer[];
  /** Unseen operator notes, oldest first. Never part of the overlay state. */
  messages: LiveHostMessage[];
}

export interface CreateLiveResponse extends LiveRoom {
  player_token: string;
}

export interface LiveOverlayGuess {
  nickname: string;
  word: string;
  rank: number;
  is_tip: boolean;
  /** The chat the word came from; null for the host at the keyboard. */
  platform: LivePlatform | null;
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
  /** Which chats play. Deliberately without state or pause, like the view. */
  channels: { platform: LivePlatform; channel: string }[];
  /** Newest first. */
  recent: LiveOverlayGuess[];
  top: LiveViewer[];
  /** The round's field, when the host chose to put it on air. */
  category?: CategoryInfo | null;
}
