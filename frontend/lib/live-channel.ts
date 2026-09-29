/**
 * The channel-name rule, on the client side.
 *
 * The server has the authoritative copy (`backend/live_chat.normalise_channel`)
 * and refuses anything this misses. This one exists so a typo is answered while
 * the field still has focus, and so the form can show the name it will actually
 * use: people paste a full URL far more often than they type a bare login.
 */

import type { LivePlatform } from "./live-types";

/**
 * Login rules per platform. Twitch: 4 to 25 characters, letters, digits and
 * underscore. TikTok: 2 to 24 characters, letters, digits, underscore and dot,
 * never ending in a dot.
 */
const LOGIN: Record<LivePlatform, RegExp> = {
  twitch: /^[a-z0-9_]{4,25}$/,
  tiktok: /^[a-z0-9_.]{1,23}[a-z0-9_]$/,
};

/** Where each platform puts the channel in a pasted URL. */
const URL_MARKER: Record<LivePlatform, string> = {
  twitch: "twitch.tv/",
  tiktok: "tiktok.com/",
};

export function normaliseChannel(raw: string, platform: LivePlatform): string | null {
  let name = raw.trim().toLowerCase();
  const marker = name.indexOf(URL_MARKER[platform]);
  if (marker >= 0) name = name.slice(marker + URL_MARKER[platform].length);
  if (name.startsWith("@")) name = name.slice(1);
  name = name.split("?")[0].split("/")[0].trim();
  return LOGIN[platform].test(name) ? name : null;
}

/** How the channel is written where a viewer would recognise it. */
export function channelAddress(channel: string, platform: LivePlatform): string {
  return platform === "tiktok" ? `tiktok.com/@${channel}` : `twitch.tv/${channel}`;
}

/** The channel name as the platform shows it next to a stream. */
export function channelLabel(channel: string, platform: LivePlatform): string {
  return platform === "tiktok" ? `@${channel}` : channel;
}

/**
 * Whether names carry a platform mark. True once two different platforms are
 * in play, counted over the chats the room reads and the rows on screen: a
 * room that drops back to one chat keeps its marks while mixed rows are still
 * visible, instead of making the same list read differently a second later.
 * With one platform nothing is marked, and the view looks as it always did.
 */
export function showsPlatformMarks(
  platforms: Iterable<LivePlatform | null | undefined>
): boolean {
  const seen = new Set<LivePlatform>();
  for (const platform of platforms) {
    if (platform) seen.add(platform);
    if (seen.size > 1) return true;
  }
  return false;
}

/**
 * The chats a create form may send: every selected platform with a name that
 * normalises. Null while one of them is still missing or invalid, so the form
 * never opens a room with fewer chats than the streamer ticked.
 */
export function readyChannels(
  selected: readonly LivePlatform[],
  inputs: Partial<Record<LivePlatform, string>>
): { platform: LivePlatform; channel: string }[] | null {
  if (selected.length === 0) return null;
  const channels: { platform: LivePlatform; channel: string }[] = [];
  for (const platform of selected) {
    const channel = normaliseChannel(inputs[platform] ?? "", platform);
    if (!channel) return null;
    channels.push({ platform, channel });
  }
  return channels;
}
