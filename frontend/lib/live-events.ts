/**
 * Paid support in a live room: what it is worth on screen, and what it says.
 *
 * Paid support is celebrated and never played. Nothing here reaches the round:
 * no tip, no cooldown, no rank. What it decides is how loud the host page is
 * about an event, and that is measured in one unit across both platforms so a
 * TikTok lion and a Twitch cheer of the same price get the same celebration.
 *
 * One unit is roughly what a viewer pays for 100 Bits. A Twitch sub costs about
 * five of those (Tier 1 and Prime), Tier 2 ten and Tier 3 twenty-five; a TikTok
 * diamond is worth about one coin, and 100 coins cost roughly what 100 Bits do.
 * The figures are deliberately round: they order events, they do not price them.
 */

import type { LiveBadge, LiveEvent, LiveEventKind, LivePlatform } from "./live-types";

/**
 * Whether an event cost nothing. A follow is thanked for with a quiet toast of
 * its own: no confetti, no place in the support feed, and it never pushes a
 * paid toast off the screen.
 */
export function isFreeEvent(event: Pick<LiveEvent, "kind">): boolean {
  return event.kind === "tiktok_follow";
}

/**
 * How loud an event is. Every event is celebrated, because every one cost
 * somebody money: each is a toast at the top centre with confetti, and the
 * level decides how big the toast is, how long it stays and how much confetti
 * comes with it. `small` is a burst out of the toast, `banner` a strong one,
 * `big` adds cannons from both lower corners, `epic` a firework over the whole
 * screen. Nothing ever stands over the middle of the board.
 */
export type Celebration = "small" | "banner" | "big" | "epic";

/** From this many units the toast gets the strong burst. A single TikTok rose
 *  (one diamond) or a cheer of 50 Bits stays small. */
export const BANNER_UNITS = 1;

/** From this many units the corner cannons join in. */
export const BIG_UNITS = 25;

/** From this many units the whole screen gets a firework. */
export const EPIC_UNITS = 100;

const SUB_UNITS: Record<string, number> = { prime: 5, "1000": 5, "2000": 10, "3000": 25 };

function subUnits(tier: string | null): number {
  return SUB_UNITS[tier ?? "1000"] ?? 5;
}

/** What an event is worth, in units of roughly 100 Bits. */
export function eventUnits(event: Pick<LiveEvent, "kind" | "amount" | "tier">): number {
  switch (event.kind) {
    case "cheer":
      return event.amount / 100;
    case "sub":
    case "resub":
    case "upgrade":
    case "gift_sub":
      return subUnits(event.tier);
    case "gift_bomb":
      return event.amount * subUnits(event.tier);
    case "tiktok_gift":
    case "tiktok_chest":
      return event.amount / 100;
    case "tiktok_sub":
      return 5;
    case "tiktok_follow":
      return 0;
  }
}

export function celebrationOf(event: Pick<LiveEvent, "kind" | "amount" | "tier">): Celebration {
  const units = eventUnits(event);
  if (units >= EPIC_UNITS) return "epic";
  if (units >= BIG_UNITS) return "big";
  if (units >= BANNER_UNITS) return "banner";
  return "small";
}

/** The confetti particle a category throws. */
export type CelebrationShape = "gem" | "star" | "diamond" | "coin";

/** The icon a category carries, when the platform sends no picture of its own. */
export type CelebrationIcon = "gem" | "star" | "gift" | "coins" | "follow";

export interface CelebrationStyle {
  /** Confetti colours. The first one also colours the icon. */
  colors: readonly string[];
  shape: CelebrationShape;
  icon: CelebrationIcon;
  /** Whether the event also rains from the top edge: many gifts at once. */
  rain: boolean;
}

/**
 * Twitch's own Bits tiers: the gem a cheer shows in the chat changes colour at
 * 100, 1.000, 5.000 and 10.000 Bits, so the confetti says how much it was in
 * the colour viewers already know.
 */
const BITS_TIERS: readonly (readonly [number, string])[] = [
  [10000, "#f43021"],
  [5000, "#0099fe"],
  [1000, "#1db2a5"],
  [100, "#9c3ee8"],
  [0, "#979797"],
];

export function bitsColor(bits: number): string {
  return (BITS_TIERS.find(([min]) => bits >= min) ?? BITS_TIERS[BITS_TIERS.length - 1])[1];
}

const TWITCH_COLORS = ["#9146ff", "#b98cff", "#ffffff"] as const;
const TWITCH_TIER3_COLORS = [...TWITCH_COLORS, "#f5b700"] as const;
const TIKTOK_COLORS = ["#fe2c55", "#25f4ee", "#ffffff"] as const;
const CHEST_COLORS = ["#e09a00", "#f5b700", "#ffd54a"] as const;

/**
 * How a category looks: one look per kind of support, each bound to what the
 * platform itself shows for it (Bits gems in their tier colour, Twitch purple
 * stars for subscriptions, TikTok's diamonds, gold for a treasure chest). A
 * colour here always means a platform or a tier, never decoration.
 */
export function celebrationStyle(event: Pick<LiveEvent, "kind" | "amount" | "tier">): CelebrationStyle {
  const twitch = event.tier === "3000" ? TWITCH_TIER3_COLORS : TWITCH_COLORS;
  switch (event.kind) {
    case "cheer": {
      const color = bitsColor(event.amount);
      return { colors: [color, color, "#ffffff"], shape: "gem", icon: "gem", rain: false };
    }
    case "sub":
    case "resub":
    case "upgrade":
      return { colors: twitch, shape: "star", icon: "star", rain: false };
    case "gift_sub":
      return { colors: twitch, shape: "star", icon: "gift", rain: false };
    case "gift_bomb":
      return { colors: twitch, shape: "star", icon: "gift", rain: event.amount > 1 };
    case "tiktok_gift":
      return { colors: TIKTOK_COLORS, shape: "diamond", icon: "gift", rain: false };
    case "tiktok_sub":
      return { colors: TIKTOK_COLORS, shape: "star", icon: "star", rain: false };
    case "tiktok_chest":
      return { colors: CHEST_COLORS, shape: "coin", icon: "coins", rain: true };
    case "tiktok_follow":
      return { colors: TIKTOK_COLORS, shape: "star", icon: "follow", rain: false };
  }
}

/** How long a toast stays, by level: the bigger the support, the longer. */
export const TOAST_MS: Record<Celebration, number> = {
  small: 2500,
  banner: 3500,
  big: 4500,
  epic: 6000,
};

/**
 * Paid toasts held in the queue. One toast stands at a time, so the queue is
 * what a burst turns into; a page that slept through an hour should still not
 * play the hour back.
 */
export const MAX_WAITING_TOASTS = 12;

/** A toast's weight: a paid level, or a follow below all of them. */
export type ToastLevel = Celebration | "follow";

/**
 * The queue after a paid toast joins it: when it is full, a follow gives way
 * first, then the oldest small one, so neither a wave of follows nor a streak
 * of roses can push a sub bomb out; only when every waiting toast is large does
 * the oldest of them go.
 */
export function admitToast<T extends { level: ToastLevel }>(
  waiting: readonly T[],
  incoming: T,
  max: number = MAX_WAITING_TOASTS
): T[] {
  const next = [...waiting];
  while (next.length >= max) {
    const follow = next.findIndex((toast) => toast.level === "follow");
    const small = next.findIndex((toast) => toast.level === "small");
    next.splice(follow >= 0 ? follow : small >= 0 ? small : 0, 1);
  }
  next.push(incoming);
  return next;
}

/** The pause between one toast leaving and the next dropping in. */
export const TOAST_GAP_MS = 300;

/** From this many toasts behind the current one, each stands shorter. */
export const HURRY_BACKLOG = 3;

/** The shortest a toast stands, even in a hurry: long enough to read a name. */
export const HURRIED_TOAST_MS = 1800;

/**
 * How long a toast stands, given how many wait behind it. A short queue plays
 * every toast in full; a long one shortens each to 60% (never under
 * HURRIED_TOAST_MS), so a sub bomb's twenty gifts do not hold the stream's top
 * edge for a minute and a gift that arrives after them is still thanked soon.
 */
export function queuedToastMs(fullMs: number, behind: number): number {
  if (behind < HURRY_BACKLOG) return fullMs;
  return Math.max(Math.min(fullMs, HURRIED_TOAST_MS), Math.round(fullMs * 0.6));
}

// ---------------------------------------------------------------------------
// Follows: one after the other, never a wall
// ---------------------------------------------------------------------------

/** How long a follow stands. Shorter than any paid toast. */
export const FOLLOW_TOAST_MS = 3000;

/**
 * Up to this many waiting follows are thanked one by one. A longer queue would
 * keep the top of the stream busy for minutes, so it is folded into one toast
 * that names the first and counts the rest.
 */
export const FOLLOW_SINGLE_BACKLOG = 3;

/** Follows held while the tab is hidden or the queue is busy. */
export const MAX_FOLLOWS_WAITING = 500;

export interface FollowToast {
  /** The id of the newest event in it, unique among toasts. */
  id: number;
  actor: string;
  platform: LivePlatform;
  badges: LiveBadge[];
  /** Further followers folded into this toast. */
  others: number;
}

/**
 * The next follow toast from the queue, oldest first, and what stays queued.
 * A short queue goes one by one; a long one becomes a single toast.
 */
export function takeFollowToast(
  waiting: readonly LiveEvent[]
): { toast: FollowToast; rest: LiveEvent[] } | null {
  if (waiting.length === 0) return null;
  const [first] = waiting;
  const folded = waiting.length > FOLLOW_SINGLE_BACKLOG;
  const taken = folded ? waiting.length : 1;
  return {
    toast: {
      id: waiting[taken - 1].id,
      actor: first.actor,
      platform: first.platform,
      badges: first.badges,
      others: taken - 1,
    },
    rest: waiting.slice(taken),
  };
}

/** The sentence after the name: "folgt jetzt", "und 8 weitere folgen jetzt". */
export function followAction(others: number): string {
  if (others <= 0) return "folgt jetzt";
  return others === 1
    ? "und 1 weitere Person folgen jetzt"
    : `und ${numberFormat.format(others)} weitere folgen jetzt`;
}

/** How many particles a rain of gifts throws: more gifts, more stars, capped. */
export function rainParticles(event: Pick<LiveEvent, "kind" | "amount">): number {
  const base = event.kind === "gift_bomb" ? event.amount * 6 : event.amount / 4;
  return Math.round(Math.min(160, base + 30));
}

const numberFormat = new Intl.NumberFormat("de-DE");

function tierNote(tier: string | null): string {
  if (tier === "2000") return " (Stufe 2)";
  if (tier === "3000") return " (Stufe 3)";
  return "";
}

/**
 * The sentence for an event, without the actor, split around the one number
 * in it so a toast can count that number up: "hat " 500 " Bits gespendet".
 * `value` is null when the sentence carries no number of its own.
 */
export interface EventActionParts {
  before: string;
  value: number | null;
  after: string;
}

function plain(text: string): EventActionParts {
  return { before: text, value: null, after: "" };
}

export function eventActionParts(event: LiveEvent): EventActionParts {
  const kind: LiveEventKind = event.kind;
  switch (kind) {
    case "cheer":
      return event.amount === 1
        ? plain("hat 1 Bit gespendet")
        : { before: "hat ", value: event.amount, after: " Bits gespendet" };
    case "sub":
      return plain(
        event.tier === "prime" ? "hat mit Prime abonniert" : `hat abonniert${tierNote(event.tier)}`
      );
    case "resub":
      return event.months && event.months > 1
        ? { before: "abonniert seit ", value: event.months, after: ` Monaten${tierNote(event.tier)}` }
        : plain(`hat abonniert${tierNote(event.tier)}`);
    case "gift_sub":
      return plain(`verschenkt ein Abo${tierNote(event.tier)}`);
    case "gift_bomb":
      return event.amount === 1
        ? plain(`verschenkt ein Abo${tierNote(event.tier)}`)
        : { before: "verschenkt ", value: event.amount, after: ` Abos${tierNote(event.tier)}` };
    case "upgrade":
      return plain("verlängert das Abo");
    case "tiktok_gift": {
      const name = event.gift_name ?? "Geschenk";
      const times = event.gift_count ?? 1;
      return times > 1
        ? { before: "schickt ", value: times, after: `-mal ${name}` }
        : plain(`schickt ${name}`);
    }
    case "tiktok_sub":
      return event.months && event.months > 1
        ? { before: "abonniert seit ", value: event.months, after: " Monaten" }
        : plain("hat abonniert");
    case "tiktok_chest":
      return { before: "verteilt eine Schatztruhe mit ", value: event.amount, after: " Diamanten" };
    case "tiktok_follow":
      return plain("folgt jetzt");
  }
}

/**
 * The sentence for an event, without the actor, so the page can set the name
 * in its own type. "hat 500 Bits gespendet", "verschenkt 10 Abos".
 */
export function eventAction(event: LiveEvent): string {
  const { before, value, after } = eventActionParts(event);
  return value === null ? before : `${before}${numberFormat.format(value)}${after}`;
}

/** A second, quieter line where the amount is not already in the sentence. */
export function eventDetail(event: LiveEvent): string | null {
  if (event.kind === "tiktok_gift") {
    return event.amount === 1
      ? "1 Diamant"
      : `${numberFormat.format(event.amount)} Diamanten`;
  }
  return null;
}

/** The whole sentence, for a screen reader and for a test. */
export function eventSentence(event: LiveEvent): string {
  return `${event.actor} ${eventAction(event)}`;
}

/** The events of a poll the page has not seen yet, oldest first. */
export function freshEvents(events: readonly LiveEvent[], newestSeen: number): LiveEvent[] {
  return events.filter((event) => event.id > newestSeen).sort((a, b) => a.id - b.id);
}

/** The feed keeps this many rows, newest first. */
export const FEED_LENGTH = 20;

/**
 * Merge new events into the feed, newest first, without duplicates. The feed
 * is paid support only: a wave of follows would wash every gift out of it.
 */
export function mergeFeed(feed: readonly LiveEvent[], incoming: readonly LiveEvent[]): LiveEvent[] {
  const byId = new Map<number, LiveEvent>();
  for (const event of [...incoming, ...feed]) {
    if (!isFreeEvent(event)) byId.set(event.id, event);
  }
  return [...byId.values()].sort((a, b) => b.id - a.id).slice(0, FEED_LENGTH);
}
