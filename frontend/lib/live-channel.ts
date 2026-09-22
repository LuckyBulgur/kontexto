/**
 * The channel-name rule, on the client side.
 *
 * The server has the authoritative copy (`backend/live_chat.normalise_channel`)
 * and refuses anything this misses. This one exists so a typo is answered while
 * the field still has focus, and so the form can show the name it will actually
 * use: people paste a full URL far more often than they type a bare login.
 */

/** Twitch login rules: 4 to 25 characters, letters, digits and underscore. */
const TWITCH_LOGIN = /^[a-z0-9_]{4,25}$/;

export function normaliseChannel(raw: string): string | null {
  let name = raw.trim().toLowerCase();
  if (name.startsWith("@")) name = name.slice(1);
  const marker = name.indexOf("twitch.tv/");
  if (marker >= 0) name = name.slice(marker + "twitch.tv/".length);
  name = name.split("?")[0].split("/")[0].trim();
  return TWITCH_LOGIN.test(name) ? name : null;
}
