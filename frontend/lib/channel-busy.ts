import type { LivePlatform } from "./live-types";

/**
 * The create form's wait after a `channel_busy` refusal: it asks the server
 * whether the channel is free again and starts the round by itself once it is,
 * so a streamer who typed `stop` in their chat does not have to come back and
 * press anything.
 */

/** How often the form asks. The streamer sees the round start within this. */
export const CHANNEL_POLL_MS = 3000;

/**
 * How long the form keeps asking on its own. Long enough to cover the five
 * minutes after which a closed host page frees the channel anyway, short
 * enough that a forgotten tab does not poll for the rest of the day.
 */
export const CHANNEL_WAIT_MS = 15 * 60 * 1000;

export interface BusyChannel {
  platform: LivePlatform;
  channel: string;
}

/**
 * Which chat a `channel_busy` refusal is about. The server names the platform;
 * with one chat chosen it can only be that one. The channel is the form's own
 * normalised value, which is exactly what the server compared.
 */
export function busyChannelOf(
  refusedPlatform: LivePlatform | null,
  ready: readonly BusyChannel[] | null
): BusyChannel | null {
  if (!ready || ready.length === 0) return null;
  if (refusedPlatform === null) return ready.length === 1 ? ready[0] : null;
  return ready.find((entry) => entry.platform === refusedPlatform) ?? null;
}

/** Whether the wait that began at `startedAt` has run out at `now`. */
export function waitExpired(startedAt: number, now: number): boolean {
  return now - startedAt >= CHANNEL_WAIT_MS;
}
