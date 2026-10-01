/**
 * What a chat badge says, and how it is drawn when Twitch has no picture.
 *
 * Twitch badges arrive as codes (`moderator/1`, `subscriber/12`) and the server
 * resolves their pictures from Helix (`backend/twitch_badges.py`). The titles
 * Twitch ships are English, so the common roles get a German name here; the
 * rest keep Twitch's own title. TikTok sends its badge pictures as signed,
 * expiring links, so its reader maps the roles onto codes of our own
 * (`tt-moderator`, `tt-fan/7`) and they are always drawn with an icon.
 *
 * Pure on purpose: the component only renders what `describeBadge` decides.
 */

import type { LiveBadge, LiveBadgeCatalog, LiveBadgePicture } from "./live-types";

/** The roles the page can draw without a picture, each with its own icon. */
export type BadgeIcon =
  | "streamer"
  | "moderator"
  | "vip"
  | "subscriber"
  | "founder"
  | "fan"
  | "supporter";

export interface BadgeView {
  /** `set/version`, stable for a React key. */
  code: string;
  /** What a screen reader and the tooltip say. */
  title: string;
  /** Twitch's own picture, when the server has one. */
  picture: LiveBadgePicture | null;
  /** The icon drawn when there is no picture; null means "not drawn at all". */
  icon: BadgeIcon | null;
}

/** German names for the Twitch roles a viewer recognises at a glance. */
const TWITCH_TITLES: Record<string, string> = {
  broadcaster: "Streamer",
  moderator: "Moderator",
  lead_moderator: "Moderator",
  vip: "VIP",
  subscriber: "Abonnent",
  founder: "Gründer",
  premium: "Prime Gaming",
  turbo: "Turbo",
  partner: "Verifiziert",
  staff: "Twitch-Team",
  admin: "Twitch-Admin",
  "sub-gifter": "Verschenkt Abos",
  "sub-gift-leader": "Verschenkt die meisten Abos",
  bits: "Bits-Spender",
  "bits-leader": "Spendet die meisten Bits",
};

const TWITCH_ICONS: Record<string, BadgeIcon> = {
  broadcaster: "streamer",
  moderator: "moderator",
  lead_moderator: "moderator",
  vip: "vip",
  subscriber: "subscriber",
  founder: "founder",
};

const TIKTOK: Record<string, { title: (version: string) => string; icon: BadgeIcon }> = {
  "tt-host": { title: () => "Streamer", icon: "streamer" },
  "tt-moderator": { title: () => "Moderator", icon: "moderator" },
  "tt-subscriber": { title: () => "Abonnent", icon: "subscriber" },
  "tt-fan": { title: (level) => `Fanclub, Stufe ${level}`, icon: "fan" },
  "tt-supporter": { title: () => "Hat schon ein Geschenk geschickt", icon: "supporter" },
};

/** How many badges stand in front of a name, as Twitch itself shows them. */
export const MAX_SHOWN_BADGES = 3;

export function badgeCode(badge: LiveBadge): string {
  return `${badge.set_id}/${badge.version}`;
}

/** One badge, resolved against the catalog. */
export function describeBadge(badge: LiveBadge, catalog: LiveBadgeCatalog): BadgeView {
  const code = badgeCode(badge);
  const tiktok = TIKTOK[badge.set_id];
  if (tiktok) {
    return { code, title: tiktok.title(badge.version), picture: null, icon: tiktok.icon };
  }
  const picture = catalog[code] ?? null;
  return {
    code,
    title: TWITCH_TITLES[badge.set_id] ?? picture?.title ?? badge.set_id,
    picture,
    icon: TWITCH_ICONS[badge.set_id] ?? null,
  };
}

/**
 * The badges to draw in front of a name: at most three, in the platform's
 * order, and only those that can be drawn (a picture or a known icon). An
 * unknown Twitch badge without a picture would otherwise be an empty square.
 */
export function visibleBadges(
  badges: readonly LiveBadge[] | undefined,
  catalog: LiveBadgeCatalog
): BadgeView[] {
  const views: BadgeView[] = [];
  for (const badge of badges ?? []) {
    const view = describeBadge(badge, catalog);
    if (view.picture || view.icon) views.push(view);
    if (views.length >= MAX_SHOWN_BADGES) break;
  }
  return views;
}
