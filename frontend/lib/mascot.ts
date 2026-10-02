/**
 * Mascots that fly across the screen when their word is guessed.
 *
 * So far one: the peanut of the streamer peanutplay, for the word for peanut.
 * It plays in every Kontexto mode and for every chat word in a live room, all
 * year and independent of any seasonal skin. Decoration only: it depends on the
 * word alone, never on its rank, so it can never hint at the solution.
 *
 * This file is pure (no DOM) so it can be tested; the flight itself lives in
 * `lib/mascot-fly.ts` and is loaded on the first match only.
 */

export type MascotKind = "peanut";

export interface Mascot {
  kind: MascotKind;
  /** Served from `public/`. */
  src: string;
  /** Intrinsic size of the picture, for the `<img>` box. */
  width: number;
  height: number;
}

export const MASCOTS: Record<MascotKind, Mascot> = {
  peanut: { kind: "peanut", src: "/mascots/peanutplay.png", width: 170, height: 256 },
};

/**
 * The word as the server returns it. A plural or a written-out umlaut folds
 * onto its base form before it gets here, so the base form is all it takes.
 */
const WORDS: ReadonlyMap<string, MascotKind> = new Map([["erdnuss", "peanut"]]);

export function matchMascot(word: string): MascotKind | null {
  return WORDS.get(word.normalize("NFC").trim().toLocaleLowerCase("de-DE")) ?? null;
}

/** The same mascot again only after this long, so a chat that found the word is not a parade. */
export const MASCOT_COOLDOWN_MS = 15_000;

/** How long one flight takes. Keep in step with `mascot-fly` in app/globals.css. */
export const MASCOT_FLIGHT_MS = 3_200;

/** Decides whether a flight may start: one at a time, and a cooldown per mascot. */
export class MascotGate {
  private readonly lastStart = new Map<MascotKind, number>();
  private busyUntil = 0;

  admit(kind: MascotKind, now: number): boolean {
    if (now < this.busyUntil) return false;
    const last = this.lastStart.get(kind);
    if (last !== undefined && now - last < MASCOT_COOLDOWN_MS) return false;
    this.lastStart.set(kind, now);
    this.busyUntil = now + MASCOT_FLIGHT_MS;
    return true;
  }
}
