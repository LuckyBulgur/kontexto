/**
 * The seams the game clients call on every guess, for decoration only.
 *
 * Three things listen. The easter eggs (`lib/easter-eggs/`) play all year in
 * every mode, for some two thousand words, and their code and catalogue are
 * imported on the first word. The mascots (`lib/mascot.ts`) play all year, for
 * their word only, and their flight code is imported on the first match. The seasonal
 * event plays only while the Halloween skin is showing, and the code behind it
 * (`components/event/halloween/controller.ts`) is imported on first use, so
 * outside October a client pays one map lookup and one class check per guess
 * and nothing else. Callers never await these: an effect is decoration and
 * must never hold up or break a guess.
 */
import { SPOOKTOBER_2026, isSkinOn } from "@/lib/event-theme";
import { matchMascot } from "@/lib/mascot";
import { unlockEggAudio } from "@/lib/easter-eggs/audio-context";
import type { EggSource } from "@/lib/easter-eggs/types";

type Controller = typeof import("@/components/event/halloween/controller");
type MascotFly = typeof import("@/lib/mascot-fly");
type EggPlayer = typeof import("@/lib/easter-eggs/play");

let eggPromise: Promise<EggPlayer> | null = null;
/** Set by the live room's host page, so a word typed there shows as on stream. */
let liveRoom = false;

/**
 * The live room's host page is open: everything shows on stream. Chat words
 * arrive without a gesture of the host's, so the first click or key press on
 * that page unlocks the audio for them.
 */
export function setEventLiveRoom(on: boolean): void {
  liveRoom = on;
  if (typeof window === "undefined") return;
  if (on) {
    window.addEventListener("pointerdown", unlockEggAudio, { once: true, capture: true });
    window.addEventListener("keydown", unlockEggAudio, { once: true, capture: true });
  } else {
    window.removeEventListener("pointerdown", unlockEggAudio, { capture: true });
    window.removeEventListener("keydown", unlockEggAudio, { capture: true });
  }
}

function playEggFor(word: string, source: EggSource): void {
  if (typeof window === "undefined" || !word.trim()) return;
  const effective: EggSource = liveRoom ? "live" : source;
  if (!eggPromise) {
    eggPromise = import("@/lib/easter-eggs/play").catch((error: unknown) => {
      eggPromise = null;
      throw error;
    });
  }
  eggPromise
    .then((m) => m.playEasterEgg(word, effective))
    .catch(() => {
      // Decoration only: a missing chunk costs the egg, never the game.
    });
}

let mascotPromise: Promise<MascotFly> | null = null;

function playMascotFor(word: string): void {
  if (typeof window === "undefined") return;
  const kind = matchMascot(word);
  if (!kind) return;
  if (!mascotPromise) {
    mascotPromise = import("@/lib/mascot-fly").catch((error: unknown) => {
      mascotPromise = null;
      throw error;
    });
  }
  mascotPromise
    .then((m) => m.flyMascot(kind))
    .catch(() => {
      // Decoration only: a missing chunk costs the flight, never the game.
    });
}

let controllerPromise: Promise<Controller> | null = null;

function loadController(): Promise<Controller> {
  if (!controllerPromise) {
    controllerPromise = import("@/components/event/halloween/controller").catch((error: unknown) => {
      // A failed chunk load (flaky network, a deploy in between) may succeed
      // on the next call, so the rejection is not cached.
      controllerPromise = null;
      throw error;
    });
  }
  return controllerPromise;
}

function withController(run: (controller: Controller) => void): void {
  if (typeof window === "undefined" || !isSkinOn(SPOOKTOBER_2026)) return;
  loadController()
    .then(run)
    .catch(() => {
      // Decoration only: a missing chunk costs the effect, never the game.
    });
}

/**
 * An accepted guess of the player's own, in any Kontexto mode. Never call it
 * for a tip or for another player's guess.
 */
export function onEventGuess(guess: { word: string; rank: number }): void {
  playEggFor(guess.word, "own");
  playMascotFor(guess.word);
  withController((c) => c.handleGuess({ word: guess.word, rank: guess.rank, won: guess.rank === 1 }));
}

/**
 * A word another player put on the board, so far only the stream chat of a
 * live room. Plays the word effect alone, throttled per kind, and never counts
 * as a find. Never call it for a tip.
 */
export function onEventArrival(guess: { word: string; rank: number }): void {
  playEggFor(guess.word, "live");
  playMascotFor(guess.word);
  withController((c) => c.handleArrival({ word: guess.word, rank: guess.rank }));
}

/**
 * What the player typed, on submit and before the server answers, in every
 * mode. Only the easter eggs listen: they fire for words the game refuses as
 * well (`mlg`, `miau`), and the submit is the user gesture audio needs.
 */
export function onEventTyped(input: string): void {
  unlockEggAudio();
  playEggFor(input, "own");
}

/** A teammate's word on a shared koop board (not a live room, see onEventArrival). */
export function onEventTeamWord(word: string): void {
  playEggFor(word, "team");
}

/** An accepted Wordle row of the player's own. */
export function onEventWordleRow(row: { word: string; won: boolean }): void {
  withController((c) => c.handleWordleRow(row));
}

export function onEventGiveUp(): void {
  withController((c) => c.handleGiveUp());
}

/** Knock on the header pumpkin. Resolves with what happened, or null when the skin is off. */
export async function knockPumpkin(x: number, y: number): Promise<"treat" | "trick" | "empty" | "throttled" | null> {
  if (typeof window === "undefined" || !isSkinOn(SPOOKTOBER_2026)) return null;
  try {
    const c = await loadController();
    return c.knockPumpkin(x, y);
  } catch {
    return null;
  }
}

export function reportLostPage(): void {
  withController((c) => c.reportLostPage());
}
