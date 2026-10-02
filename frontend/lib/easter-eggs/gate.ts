import type { EggSource } from "./types";

/**
 * Decides whether an easter egg may start.
 *
 * The cooldown counts per word and per nothing else, the player's decision:
 * whoever types one new word after the other sees every one of them, while a
 * stream chat that spams the same word sees it once in a while. A typed word
 * fires on submit and again when the server returns it; the cooldown also
 * swallows that second call.
 *
 * Pure apart from the clock it is handed, so it is testable.
 */

/** The same word again only after this long, for a word of your own or a teammate's. */
export const OWN_COOLDOWN_MS = 8_000;
/** The same word again only after this long in a live room, where a chat repeats words all the time. */
export const LIVE_COOLDOWN_MS = 30_000;

/** Old entries are dropped once the map holds this many, so a long stream does not grow it forever. */
const MAX_TRACKED = 500;

export class EggGate {
  private readonly lastStart = new Map<string, number>();

  admit(key: string, source: EggSource, now: number): boolean {
    const cooldown = source === "live" ? LIVE_COOLDOWN_MS : OWN_COOLDOWN_MS;
    const last = this.lastStart.get(key);
    if (last !== undefined && now - last < cooldown) return false;
    this.lastStart.delete(key);
    this.lastStart.set(key, now);
    if (this.lastStart.size > MAX_TRACKED) {
      const oldest = this.lastStart.keys().next().value;
      if (oldest !== undefined) this.lastStart.delete(oldest);
    }
    return true;
  }
}
