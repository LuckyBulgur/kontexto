/**
 * The shapes the live chat endpoints return.
 *
 * A live room is a koop room with a second input channel, so everything about
 * the round itself, the guess list, the ranks, the reveal, comes from the koop
 * types. What is here is the chat binding, the chat's leaderboards, its paid
 * support and the pictures of its badges.
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

/** One chat badge as the platform names it (`moderator`, `1`). TikTok roles
 *  carry codes of our own under a `tt-` prefix. */
export interface LiveBadge {
  set_id: string;
  version: string;
}

/** Twitch's own picture for one badge code, resolved by the server. */
export interface LiveBadgePicture {
  title: string;
  image: string;
  image_2x: string;
}

/** Pictures keyed `set/version`. A code without one is drawn with an icon. */
export type LiveBadgeCatalog = Record<string, LiveBadgePicture>;

export interface LiveViewer {
  /** The chat this viewer plays in. One name on two platforms is two people. */
  platform: LivePlatform;
  nickname: string;
  /** Accepted guesses over the whole session, not just this round. */
  hits: number;
  /** Guesses in the near band (the green colour, rank up to 300). */
  near_hits: number;
  /** Rounds this viewer finished. */
  solves: number;
  best_rank: number | null;
  badges: LiveBadge[];
}

/** The three leaderboards, all counted over the whole stream. */
export type LiveBoardId = "busy" | "sharp" | "finders";

export type LiveViewerBoards = Record<LiveBoardId, LiveViewer[]>;

/** What a chat can do with real money. Celebrated, never played. */
export type LiveEventKind =
  | "cheer"
  | "sub"
  | "resub"
  | "gift_sub"
  | "gift_bomb"
  | "upgrade"
  | "tiktok_gift"
  | "tiktok_sub"
  | "tiktok_chest";

export interface LiveEvent {
  id: number;
  platform: LivePlatform;
  kind: LiveEventKind;
  /** The display name after the nickname rule, or "Anonym". */
  actor: string;
  badges: LiveBadge[];
  /** Bits, gifted subscriptions or diamonds, by kind; 1 for an own sub. */
  amount: number;
  /** Twitch sub plan: "prime", "1000", "2000", "3000". */
  tier: string | null;
  months: number | null;
  gift_name: string | null;
  gift_count: number | null;
  gift_image: string | null;
  /** ISO 8601, UTC. */
  created_at: string | null;
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
  /** The "busy" board once more, for code that predates the three boards. */
  top: LiveViewer[];
  boards: LiveViewerBoards;
  /** Unseen operator notes, oldest first. */
  messages: LiveHostMessage[];
  /** Paid support newer than the poll's `events_after`, oldest first. */
  events: LiveEvent[];
  badge_catalog: LiveBadgeCatalog;
}

export interface CreateLiveResponse extends LiveRoom {
  player_token: string;
}
