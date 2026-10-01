/**
 * Paid support in a live room: what it is worth on screen, and what it says.
 *
 * Paid support is celebrated and never played. Nothing here reaches the round:
 * no tip, no cooldown, no rank. What it decides is how loud the host page is
 * about an event, and that is measured in one unit across both platforms so a
 * TikTok lion and a Twitch cheer of the same price get the same banner.
 *
 * One unit is roughly what a viewer pays for 100 Bits. A Twitch sub costs about
 * five of those (Tier 1 and Prime), Tier 2 ten and Tier 3 twenty-five; a TikTok
 * diamond is worth about one coin, and 100 coins cost roughly what 100 Bits do.
 * The figures are deliberately round: they order events, they do not price them.
 */

import type { LiveEvent, LiveEventKind } from "./live-types";

/** How loud an event is. `feed` is a row in the list, `banner` drops in over
 *  the board, `big` adds confetti. */
export type Celebration = "feed" | "banner" | "big";

/** From this many units an event gets a banner. A single TikTok rose (one
 *  diamond) or a cheer of 50 Bits stays a row in the feed. */
export const BANNER_UNITS = 1;

/** From this many units an event gets confetti as well. */
export const BIG_UNITS = 25;

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
  }
}

export function celebrationOf(event: Pick<LiveEvent, "kind" | "amount" | "tier">): Celebration {
  const units = eventUnits(event);
  if (units >= BIG_UNITS) return "big";
  if (units >= BANNER_UNITS) return "banner";
  return "feed";
}

const numberFormat = new Intl.NumberFormat("de-DE");

function tierNote(tier: string | null): string {
  if (tier === "2000") return " (Stufe 2)";
  if (tier === "3000") return " (Stufe 3)";
  return "";
}

/**
 * The sentence for an event, without the actor, so the page can set the name
 * in its own type. "hat 500 Bits gespendet", "verschenkt 10 Abos".
 */
export function eventAction(event: LiveEvent): string {
  const kind: LiveEventKind = event.kind;
  switch (kind) {
    case "cheer":
      return event.amount === 1
        ? "hat 1 Bit gespendet"
        : `hat ${numberFormat.format(event.amount)} Bits gespendet`;
    case "sub":
      return event.tier === "prime"
        ? "hat mit Prime abonniert"
        : `hat abonniert${tierNote(event.tier)}`;
    case "resub":
      return event.months && event.months > 1
        ? `abonniert seit ${numberFormat.format(event.months)} Monaten${tierNote(event.tier)}`
        : `hat abonniert${tierNote(event.tier)}`;
    case "gift_sub":
      return `verschenkt ein Abo${tierNote(event.tier)}`;
    case "gift_bomb":
      return event.amount === 1
        ? `verschenkt ein Abo${tierNote(event.tier)}`
        : `verschenkt ${numberFormat.format(event.amount)} Abos${tierNote(event.tier)}`;
    case "upgrade":
      return "verlängert das Abo";
    case "tiktok_gift": {
      const name = event.gift_name ?? "Geschenk";
      const times = event.gift_count ?? 1;
      return times > 1
        ? `schickt ${numberFormat.format(times)}-mal ${name}`
        : `schickt ${name}`;
    }
    case "tiktok_sub":
      return event.months && event.months > 1
        ? `abonniert seit ${numberFormat.format(event.months)} Monaten`
        : "hat abonniert";
    case "tiktok_chest":
      return `verteilt eine Schatztruhe mit ${numberFormat.format(event.amount)} Diamanten`;
  }
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

/** Merge new events into the feed, newest first, without duplicates. */
export function mergeFeed(feed: readonly LiveEvent[], incoming: readonly LiveEvent[]): LiveEvent[] {
  const byId = new Map<number, LiveEvent>();
  for (const event of [...incoming, ...feed]) byId.set(event.id, event);
  return [...byId.values()].sort((a, b) => b.id - a.id).slice(0, FEED_LENGTH);
}
