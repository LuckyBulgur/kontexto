"use client";

import { toast } from "sonner";
import { fireCandyBurst, fireCandyRain, showSpookFlash } from "@/lib/confetti";
import { prefersReducedMotion } from "@/lib/use-reduced-motion";
import {
  SECRETS,
  UNLUCKY_RANK,
  isComplete,
  isSpookyWordleWord,
  loadProgress,
  matchSpookyWord,
  recordSecret,
  saveProgress,
  secretById,
  secretForEffect,
  type EffectKind,
  type SecretId,
} from "@/lib/events/spooktober";
import { addActor, getStage, setStage, type ActorKind } from "./stage-store";

/**
 * The Spooktober game master: decides what a knock, a guess or a scroll sets
 * off, records what was found and tells the player about it.
 *
 * Loaded lazily (through `lib/events/hooks.ts`) and only while the skin is on,
 * so none of this reaches a visitor outside October. Everything it plays is
 * decorative; what it means is always said in a toast as well, which is the
 * channel for screen readers and for anyone with reduced motion, who get the
 * finds without the creatures.
 */

/** Same creature again only after this long, so a list of guesses is not a parade. */
const ACTOR_COOLDOWN_MS = 60_000;
/** More than this on stage at once reads as noise. */
const MAX_ACTORS = 3;
/** A knock sooner than this after the last burst does nothing. */
const KNOCK_THROTTLE_MS = 400;
/** The knock that empties the pumpkin. It is October. */
const KNOCKS_UNTIL_EMPTY = 13;
const EMPTY_FOR_MS = 60_000;
/** One knock in five, after the first, is a trick. */
const TRICK_CHANCE = 0.2;
/** How long the flashlight stays on before the lights come back by themselves. */
export const FLASHLIGHT_MS = 30_000;
/** How long a word keeps the full moon up. */
const MOON_WORD_MS = 30_000;
/** Class on `<html>` for a full moon a word called up, apart from the clock's own. */
const MOON_WORD_CLASS = "spook-moon-word";
/**
 * Now and then an ordinary guess wakes something anyway, so the page stays
 * surprising after the words are known. Rare on purpose: one in 25.
 */
const SURPRISE_CHANCE = 1 / 25;
const SURPRISE_CAST: readonly ActorKind[] = ["ghost", "bats", "spider", "owl", "cat"];

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

let loaded = false;

/** Reads the stored progress into the stage once per page load. */
export function hydrateProgress(): void {
  if (loaded) return;
  loaded = true;
  setStage({ progress: loadProgress(storage()) });
}

function commitProgress(progress: ReturnType<typeof getStage>["progress"]): void {
  saveProgress(storage(), progress);
  setStage({ progress });
}

// ---------------------------------------------------------------------------
// Actors
// ---------------------------------------------------------------------------

const lastPlayed = new Map<ActorKind, number>();

/**
 * Puts a creature on stage unless it was just there, the stage is full or the
 * player asked for less motion. `force` skips the cooldown, for the pumpkin's
 * tricks and the finale, which the player set off on purpose.
 */
function play(kind: ActorKind, x = window.innerWidth / 2, y = window.innerHeight / 3, force = false): void {
  if (prefersReducedMotion()) return;
  const now = Date.now();
  const last = lastPlayed.get(kind) ?? 0;
  if (!force && now - last < ACTOR_COOLDOWN_MS) return;
  if (getStage().actors.length >= MAX_ACTORS) return;
  lastPlayed.set(kind, now);
  addActor(kind, x, y);
}

function playEffect(effect: EffectKind, x?: number, y?: number): void {
  switch (effect) {
    case "ghost":
    case "bats":
    case "spider":
    case "witch":
    case "cat":
      play(effect, x, y);
      return;
    case "bones":
      play("hand", x ?? window.innerWidth * (0.25 + Math.random() * 0.5));
      return;
    case "candy":
      if (!prefersReducedMotion()) void fireCandyRain();
      return;
    case "flashlight":
      startFlashlight();
      return;
    case "wolf":
      play("wolf", x, y);
      raiseMoon();
      return;
    case "owl":
    case "fog":
    case "bubbles":
      play(effect, x, y);
      return;
    case "moon":
      raiseMoon();
      return;
  }
}

let moonTimer: number | undefined;

/** A full moon for half a minute. A colour change, so it also shows under reduced motion. */
function raiseMoon(): void {
  window.clearTimeout(moonTimer);
  document.documentElement.classList.add(MOON_WORD_CLASS);
  moonTimer = window.setTimeout(() => document.documentElement.classList.remove(MOON_WORD_CLASS), MOON_WORD_MS);
}

// ---------------------------------------------------------------------------
// Secrets
// ---------------------------------------------------------------------------

/** Records a find and tells the player. Returns whether it was new. */
export function discover(id: SecretId): boolean {
  hydrateProgress();
  const before = getStage().progress;
  const { progress, isNew } = recordSecret(before, id);
  if (!isNew) return false;
  commitProgress(progress);

  const secret = secretById(id);
  const count = progress.secrets.length;
  toast.success(`Geheimnis entdeckt: ${secret.name}`, {
    description: `${secret.found} ${count} von ${SECRETS.length}.`,
  });

  if (isComplete(progress)) finale();
  return true;
}

/** All thirteen: every creature once, one after the other, and a word of thanks. */
function finale(): void {
  window.setTimeout(() => {
    toast("Alle 13 Geheimnisse gefunden", {
      description: "Der ganze Spuk kommt noch einmal heraus und verbeugt sich.",
      duration: 10_000,
    });
    if (prefersReducedMotion()) return;
    const cast: ActorKind[] = ["ghost", "witch", "bats", "cat", "spider", "hand"];
    cast.forEach((kind, i) => {
      window.setTimeout(() => {
        // The stage holds three at a time; the parade waits for its turn.
        play(kind, window.innerWidth * (0.2 + 0.12 * i), window.innerHeight * 0.4, true);
      }, i * 2000);
    });
    void fireCandyRain();
  }, 1200);
}

// ---------------------------------------------------------------------------
// What the player does
// ---------------------------------------------------------------------------

export type KnockResult = "treat" | "trick" | "empty" | "throttled";

let knocks = 0;
let lastKnock = 0;
let emptyToastShown = false;

/** A knock on the pumpkin in the header. `x`, `y`: its centre in viewport px. */
export function knockPumpkin(x: number, y: number): KnockResult {
  hydrateProgress();
  const now = Date.now();
  const { pumpkinEmptyUntil } = getStage();
  if (now < pumpkinEmptyUntil) {
    if (!emptyToastShown) {
      emptyToastShown = true;
      toast("Der Kürbis ist leer", { description: "Gib ihm eine Minute, dann ist er wieder voll." });
    }
    return "empty";
  }
  if (now - lastKnock < KNOCK_THROTTLE_MS) return "throttled";
  lastKnock = now;
  knocks += 1;
  discover("pumpkin");

  if (knocks >= KNOCKS_UNTIL_EMPTY) {
    knocks = 0;
    emptyToastShown = true;
    setStage({ pumpkinEmptyUntil: now + EMPTY_FOR_MS });
    window.setTimeout(() => {
      emptyToastShown = false;
      setStage({ pumpkinEmptyUntil: 0 });
    }, EMPTY_FOR_MS);
    toast("Der Kürbis ist leer", { description: "Dreizehn Griffe, mehr passt nicht hinein. Gleich ist er wieder voll." });
    return "empty";
  }

  if (knocks > 1 && Math.random() < TRICK_CHANCE) {
    discover("trick");
    const tricks: ActorKind[] = ["spider", "bats", "smoke"];
    const trick = tricks[Math.floor(Math.random() * tricks.length)];
    play(trick, x, y, true);
    showSpookFlash("Saures!");
    return "trick";
  }

  void fireCandyBurst(x, y);
  return "treat";
}

let bottomReached = false;

/** The player scrolled to the very end of a page: a hand waves from below, once per page load. */
export function reachBottom(): void {
  if (bottomReached) return;
  bottomReached = true;
  play("hand", window.innerWidth * (0.3 + Math.random() * 0.4), window.innerHeight, true);
  discover("bottom");
}

export interface GuessInput {
  word: string;
  rank: number;
  /** The guess solved the round; the win owns that moment. */
  won: boolean;
}

/** An accepted guess of the player's own in any Kontexto mode. */
export function handleGuess({ word, rank, won }: GuessInput): void {
  const effect = matchSpookyWord(word);
  if (effect) {
    if (!won) playEffect(effect);
    const secret = secretForEffect(effect);
    if (secret) discover(secret);
  }
  if (rank === UNLUCKY_RANK && !won) {
    play("cat", 0, 0, true);
    discover("cat13");
    return;
  }
  if (!effect && !won && Math.random() < SURPRISE_CHANCE) {
    play(SURPRISE_CAST[Math.floor(Math.random() * SURPRISE_CAST.length)]);
  }
}

let eyesShown = false;

/**
 * The player has sat still for a while: two eyes blink once out of a dark
 * corner. Once per page load; the runtime keeps it to once per session.
 */
export function peekEyes(): void {
  if (eyesShown) return;
  eyesShown = true;
  const left = Math.random() < 0.5;
  play("eyes", left ? 24 : window.innerWidth - 104, window.innerHeight * (0.45 + Math.random() * 0.3), true);
}

/** An accepted Wordle row of the player's own. */
export function handleWordleRow({ word, won }: { word: string; won: boolean }): void {
  if (!isSpookyWordleWord(word)) return;
  if (!won) play("ghost");
  discover("wordle");
}

/** A round given up: the pumpkin answers with the other half of the saying. */
export function handleGiveUp(): void {
  showSpookFlash("Saures!");
}

export function reportLostPage(): void {
  discover("lost");
}

// ---------------------------------------------------------------------------
// Flashlight
// ---------------------------------------------------------------------------

let flashlightTimer: number | undefined;

export function startFlashlight(): void {
  window.clearTimeout(flashlightTimer);
  setStage({ flashlight: true });
  flashlightTimer = window.setTimeout(stopFlashlight, FLASHLIGHT_MS);
  discover("flashlight");
}

export function stopFlashlight(): void {
  window.clearTimeout(flashlightTimer);
  setStage({ flashlight: false });
}

// ---------------------------------------------------------------------------
// Time of day
// ---------------------------------------------------------------------------

/** Midnight to one in the player's own clock. */
export function isWitchingHour(date: Date = new Date()): boolean {
  return date.getHours() === 0;
}

/** 31 October in Berlin, the day itself. */
export function isHalloweenDay(date: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", month: "2-digit", day: "2-digit" }).format(date);
  return parts === "10-31";
}

/** Once per browser session, not once per page: a ghost on every click would be a nuisance. */
const WITCHING_HOUR_SEEN_KEY = "kontexto_spooktober_witching_hour";

export function enterWitchingHour(): void {
  const isNew = discover("midnight");
  let session: Storage | null = null;
  try {
    session = window.sessionStorage;
  } catch {
    session = null;
  }
  if (session?.getItem(WITCHING_HOUR_SEEN_KEY)) return;
  try {
    session?.setItem(WITCHING_HOUR_SEEN_KEY, "1");
  } catch {
    // Storage full or blocked: the ghost may come back on the next page.
  }
  if (!isNew) toast("Es ist Geisterstunde", { description: "Bis ein Uhr spukt es hier ein bisschen mehr." });
  play("ghost");
}
