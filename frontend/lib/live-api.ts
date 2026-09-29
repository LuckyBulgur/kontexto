import { RoomGameSource } from "./types";
import {
  CreateLiveResponse,
  LIVE_PLATFORMS,
  LiveOverlayState,
  LivePlatform,
  LiveRoom,
} from "./live-types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

/**
 * A refusal of the live endpoints. `message` is the error code, like every
 * other API error in this app, so `e.message === "channel_busy"` keeps
 * working; `platform` names the chat it is about, so a form with one field
 * per platform can point at the right one.
 */
export class LiveApiError extends Error {
  readonly platform: LivePlatform | null;

  constructor(code: string, platform: LivePlatform | null = null) {
    super(code);
    this.name = "LiveApiError";
    this.platform = platform;
  }
}

const KNOWN_CODES = new Set([
  "bad_channel",
  "channel_busy",
  "last_channel",
  "platform_bound",
  "platform_full",
  "platform_unavailable",
  "room_not_found",
]);

/** Turn a refusal into a LiveApiError, or pass a 2xx body through. */
async function readLive<T>(res: Response): Promise<T> {
  if (res.ok) return res.json() as Promise<T>;
  const body: unknown = await res.json().catch(() => null);
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const platform = isLivePlatform(record.platform) ? record.platform : null;
  const code = typeof record.error === "string" ? record.error : "";
  if (KNOWN_CODES.has(code)) throw new LiveApiError(code, platform);
  // A pydantic 422 has no code of ours; it is a channel the form let through.
  if (res.status === 422) throw new LiveApiError("bad_channel", platform);
  if (res.status === 404) throw new LiveApiError("room_not_found", platform);
  throw new LiveApiError(`API error: ${res.status}`, platform);
}

/**
 * Open a room and bind it to one or more stream chats, one per platform.
 *
 * `channel_busy` means somebody is already playing with one of those chats,
 * which is the one rule this mode has: one channel, one game. `bad_channel`
 * means a name could not be a login on its platform at all.
 * `platform_unavailable` means the server has no connection to the platform
 * right now, `platform_full` that it has reached its limit of chats on it. Each
 * refusal names its platform.
 *
 * No nickname: the host plays under their first channel name. They already
 * have a name on screen, and a second one would be a field that exists only to
 * be filled in.
 */
export async function createLive(
  channels: { platform: LivePlatform; channel: string }[],
  options: {
    gameSource: RoomGameSource;
    tipsAllowed: boolean;
    requirePrefix: boolean;
  }
): Promise<CreateLiveResponse> {
  const res = await fetch(`${API_BASE}/live`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      channels,
      game_source: options.gameSource,
      tips_allowed: options.tipsAllowed,
      require_prefix: options.requirePrefix,
    }),
  });
  return readLive<CreateLiveResponse>(res);
}

async function postLive(path: string, body: Record<string, unknown>): Promise<LiveRoom> {
  const res = await fetch(`${API_BASE}/live/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readLive<LiveRoom>(res);
}

/** Bind one more chat to a running room. Host token only. */
export function addLiveChannel(
  koopId: string,
  playerToken: string,
  platform: LivePlatform,
  channel: string
): Promise<LiveRoom> {
  return postLive(`${koopId}/channels`, { player_token: playerToken, platform, channel });
}

/** Unbind one chat; the last one is refused with `last_channel`. */
export function removeLiveChannel(
  koopId: string,
  playerToken: string,
  platform: LivePlatform
): Promise<LiveRoom> {
  return postLive(`${koopId}/channels/remove`, { player_token: playerToken, platform });
}

/** Pause or resume one chat. Its reader stays connected either way. */
export function setLiveChannelPaused(
  koopId: string,
  playerToken: string,
  platform: LivePlatform,
  paused: boolean
): Promise<LiveRoom> {
  return postLive(`${koopId}/channels/pause`, { player_token: playerToken, platform, paused });
}

function isLivePlatform(value: unknown): value is LivePlatform {
  return typeof value === "string" && (LIVE_PLATFORMS as readonly string[]).includes(value);
}

/**
 * The platforms the server can read right now. TikTok needs the operator's key,
 * so this is asked at runtime rather than baked into the static export.
 */
export async function fetchLivePlatforms(): Promise<LivePlatform[]> {
  const res = await fetch(`${API_BASE}/live/platforms`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const body: unknown = await res.json();
  if (!body || typeof body !== "object" || !("platforms" in body)) return [];
  const { platforms } = body as { platforms: unknown };
  return Array.isArray(platforms) ? platforms.filter(isLivePlatform) : [];
}

/** The chat status and the leaderboard. Host token only. */
export async function getLiveRoom(
  koopId: string,
  playerToken: string
): Promise<LiveRoom> {
  const res = await fetch(
    `${API_BASE}/live/${koopId}?token=${encodeURIComponent(playerToken)}`
  );
  if (res.status === 404) throw new Error("room_not_found");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

/** Unbind the chat. The round itself stays, so the word can still be revealed. */
export async function stopLive(
  koopId: string,
  playerToken: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/live/${koopId}/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player_token: playerToken }),
  });
  if (res.status === 404) throw new Error("room_not_found");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

/**
 * Confirm that the operator's notes up to `upToId` are on screen. Repeating it
 * is harmless, so a failed call is simply sent again after the next poll.
 */
export async function markHostMessagesSeen(
  koopId: string,
  playerToken: string,
  upToId: number
): Promise<void> {
  const res = await fetch(`${API_BASE}/live/${koopId}/messages/seen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player_token: playerToken, up_to_id: upToId }),
  });
  if (res.status === 404) throw new Error("room_not_found");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

/** What the OBS browser source polls. Its own token, never the host's. */
export async function getOverlayState(
  overlayToken: string
): Promise<LiveOverlayState> {
  const res = await fetch(
    `${API_BASE}/live/overlay/state?token=${encodeURIComponent(overlayToken)}`
  );
  if (res.status === 404) throw new Error("room_not_found");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
