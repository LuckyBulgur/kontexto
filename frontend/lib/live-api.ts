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
 * Open a room and bind it to a stream chat.
 *
 * `channel_busy` means somebody is already playing with that chat, which is the
 * one rule this mode has: one channel, one game. `bad_channel` means the name
 * could not be a login on that platform at all. `platform_unavailable` means the
 * server has no connection to the platform right now, `platform_full` that it
 * has reached its limit of rooms on it.
 *
 * No nickname: the host plays under their channel name. They already have a name
 * on screen, and a second one would be a field that exists only to be filled in.
 */
export async function createLive(
  platform: LivePlatform,
  channel: string,
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
      platform,
      channel,
      game_source: options.gameSource,
      tips_allowed: options.tipsAllowed,
      require_prefix: options.requirePrefix,
    }),
  });
  if (res.status === 409) throw new Error("channel_busy");
  if (res.status === 422) throw new Error("bad_channel");
  if (res.status === 503) {
    const body: unknown = await res.json().catch(() => null);
    const code =
      body && typeof body === "object" && "error" in body ? String(body.error) : "";
    throw new Error(code === "platform_full" ? "platform_full" : "platform_unavailable");
  }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
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
