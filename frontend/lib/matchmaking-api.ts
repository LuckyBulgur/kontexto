import {
  MatchmakingLive,
  MatchmakingStatus,
  MatchmakingTicket,
  QueueModeId,
} from "./matchmaking-types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

/**
 * Join the queue for a mode. The nickname is a wish, not an instruction: the
 * server replaces one it will not show to strangers, and the response says
 * which name the player actually carries.
 */
export async function enqueueForMatch(
  mode: QueueModeId,
  nickname?: string
): Promise<MatchmakingTicket> {
  const res = await fetch(`${API_BASE}/matchmaking/enqueue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, nickname: nickname?.trim() || null }),
  });
  if (res.status === 400) throw new Error("invalid_mode");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getMatchStatus(ticket: string): Promise<MatchmakingStatus> {
  const res = await fetch(`${API_BASE}/matchmaking/status?ticket=${encodeURIComponent(ticket)}`);
  if (res.status === 404) throw new Error("ticket_not_found");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function cancelMatch(ticket: string): Promise<void> {
  await fetch(`${API_BASE}/matchmaking/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticket }),
  });
}

/**
 * How busy every mode is right now. No ticket needed: this is what the picker
 * asks before the player commits to a queue.
 */
export async function getLiveCounts(): Promise<MatchmakingLive> {
  const res = await fetch(`${API_BASE}/matchmaking/live`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
