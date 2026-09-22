import { RoomGameSource } from "./types";
import { CreateLiveResponse, LiveOverlayState, LiveRoom } from "./live-types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

/**
 * Open a room and bind it to a stream chat.
 *
 * `channel_busy` means somebody is already playing with that chat, which is the
 * one rule this mode has: one channel, one game. `bad_channel` means the name
 * could not be a Twitch login at all.
 *
 * No nickname: the host plays under their channel name. They already have a name
 * on screen, and a second one would be a field that exists only to be filled in.
 */
export async function createLive(
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
      platform: "twitch",
      channel,
      game_source: options.gameSource,
      tips_allowed: options.tipsAllowed,
      require_prefix: options.requirePrefix,
    }),
  });
  if (res.status === 409) throw new Error("channel_busy");
  if (res.status === 422) throw new Error("bad_channel");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
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
