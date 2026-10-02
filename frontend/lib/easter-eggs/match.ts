import { EGG_CATALOG } from "./catalog.generated";
import { SCENE_WORDS } from "./scenes";
import type { EggMotion, EggSpec, EggStep } from "./types";

/**
 * Finds the easter egg of a word, or null.
 *
 * The word comes either as the player typed it (the input path, before the
 * server answers) or as the server returned it (base form, lower case). Both
 * are read the same way: NFC, lower case, outer punctuation off, and the
 * written-out umlauts folded back (`kaefer` -> `käfer`), with `ss` read as the
 * sharp s as a second try (`strauss` -> `strauß`), like the spooky words.
 * Hand-made scenes win over the generated catalogue.
 *
 * Pure: no DOM, no clock.
 */

const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

export function eggSpellings(input: string): string[] {
  const base = input.normalize("NFC").trim().toLocaleLowerCase("de-DE").replace(EDGE_PUNCTUATION, "");
  if (!base) return [];
  const umlauts = base.replace(/ae/g, "ä").replace(/oe/g, "ö").replace(/ue/g, "ü");
  return [...new Set([base, umlauts, umlauts.replace(/ss/g, "ß")])];
}

function catalogSteps([icon, motion, sound]: readonly [string, EggMotion, string | null]): EggStep[] {
  const steps: EggStep[] = [{ kind: "sprite", icon, motion }];
  if (sound) steps.push({ kind: "sound", sound });
  return steps;
}

export function matchEgg(input: string): EggSpec | null {
  for (const key of eggSpellings(input)) {
    const scene = SCENE_WORDS.get(key);
    if (scene) return { key, steps: scene };
    const entry = EGG_CATALOG.get(key);
    if (entry) return { key, steps: catalogSteps(entry) };
  }
  return null;
}
