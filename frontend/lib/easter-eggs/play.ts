"use client";

import { SPOOKTOBER_2026, isSkinOn } from "@/lib/event-theme";
import { matchSpookyWord } from "@/lib/events/spooktober";
import { prefersReducedMotion } from "@/lib/use-reduced-motion";
import { EggGate } from "./gate";
import { matchEgg } from "./match";
import { playSound, speak } from "./sound";
import { MOTION_MS, OVERLAY_MS, TEXT_MS, addOverlay, addSprite, addText, closeLayerAfter, openLayer } from "./stage";
import type { EggSource, EggStep } from "./types";

/**
 * Plays the easter egg of a word, if it has one.
 *
 * Loaded on the first word only (`lib/events/hooks.ts`), so a client that never
 * types a scene word pays nothing for the scenes. The word alone decides, never its rank, so an egg
 * can never hint at the solution. Under reduced motion nothing moves and the
 * sound still plays; the sound is always on, the player's decision.
 *
 * While the Halloween skin shows, a word the Spooktober controller handles
 * plays the spooky effect only, so the ghost is not doubled.
 */

/** QA switch for screenshot runs (`e2e/fixtures.ts`). Not a player setting. */
export const EGGS_FORCE_KEY = "kontexto_eggs_force";

const gate = new EggGate();

function forcedOff(): boolean {
  try {
    return window.localStorage.getItem(EGGS_FORCE_KEY) === "off";
  } catch {
    return false;
  }
}

function stepEnd(step: EggStep): number {
  const at = step.at ?? 0;
  switch (step.kind) {
    case "sprite":
      return at + MOTION_MS[step.motion];
    case "overlay":
      return at + OVERLAY_MS[step.overlay];
    case "text":
      return at + TEXT_MS;
    default:
      return at;
  }
}

async function fireConfettiStep(style: "burst" | "fireworks"): Promise<void> {
  const { fireEggConfetti } = await import("@/lib/confetti");
  await fireEggConfetti(style);
}

export function playEasterEgg(word: string, source: EggSource): void {
  if (typeof window === "undefined" || forcedOff()) return;
  const egg = matchEgg(word);
  if (!egg) return;
  if (isSkinOn(SPOOKTOBER_2026) && matchSpookyWord(egg.key)) return;
  if (!gate.admit(egg.key, source, Date.now())) return;

  const live = source === "live";
  const still = prefersReducedMotion();
  const layer = still ? null : openLayer(live);
  if (layer) {
    layer.dataset.egg = egg.key;
    closeLayerAfter(layer, Math.max(...egg.steps.map(stepEnd)));
  }

  for (const step of egg.steps) {
    const run = () => {
      switch (step.kind) {
        case "sound":
          playSound(step.sound, step.volume, step.rate);
          return;
        case "speech":
          speak(step.text, step.lang, step.pitch, step.rate);
          return;
        case "sprite":
          if (layer?.isConnected) addSprite(layer, step.icon, step.motion, step.count, live);
          return;
        case "overlay":
          if (layer?.isConnected) addOverlay(layer, step.overlay, live);
          return;
        case "text":
          if (layer?.isConnected) addText(layer, step.text, live);
          return;
        case "confetti":
          if (!still) fireConfettiStep(step.style).catch(() => undefined);
          return;
      }
    };
    const at = step.at ?? 0;
    if (at <= 0) run();
    else window.setTimeout(run, at);
  }
}
