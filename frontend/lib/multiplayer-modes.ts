/**
 * The catalogue of multiplayer modes: what each one is called, how it is
 * described, where its private room is created and whether the random queue
 * serves it.
 *
 * One list, used by the mode page, the queue screen and the arena lobby, so a
 * new mode is named once rather than in three places that slowly disagree.
 */

import { ArenaModeId } from "./arena-types";
import { QueueModeId } from "./matchmaking-types";
import {
  BLITZ_SECONDS,
  ROYALE_MAX_PLAYERS,
  ROYALE_PHASE_SECONDS,
  TIMERUSH_BONUS_SECONDS,
  TIMERUSH_START_SECONDS,
} from "./arena-rules";

export interface MultiplayerModeMeta {
  id: QueueModeId;
  name: string;
  /** One sentence, the way it is pitched on the mode page. */
  tagline: string;
  /** The rules as the player reads them. */
  rules: string[];
  /** Where a private room with an invite link is created, if there is one. */
  createHref: string | null;
  /** Whether this mode is one of the three timed arenas. */
  arena: boolean;
}

export const MULTIPLAYER_MODES: Record<QueueModeId, MultiplayerModeMeta> = {
  duel: {
    id: "duel",
    name: "Duell",
    tagline: "Gleiches Wort, zwei Leute, wer findet es zuerst?",
    rules: [
      "Beide raten dasselbe geheime Wort.",
      "Du siehst den besten Rang des anderen live, aber nicht seine Wörter.",
      "Unbegrenzt viele Versuche.",
    ],
    createHref: "/duel/create/",
    arena: false,
  },
  koop: {
    id: "koop",
    name: "Koop",
    tagline: "Eine gemeinsame Liste, ein gemeinsamer Sieg.",
    rules: [
      "Alle raten zusammen auf einer geteilten Liste.",
      "Ein Wort, das jemand schon probiert hat, zählt nicht doppelt.",
      "Ihr gewinnt zusammen, sobald jemand Rang 1 trifft.",
    ],
    createHref: "/koop/create/",
    arena: false,
  },
  wordle_duel: {
    id: "wordle_duel",
    name: "Wördle-Duell",
    tagline: "Dasselbe Wördle, zwei Bretter, sechs Versuche.",
    rules: [
      "Beide lösen dasselbe Wördle.",
      "Du siehst die Farben des anderen, nicht seine Buchstaben.",
      "Wer zuerst löst, gewinnt.",
    ],
    createHref: "/wordle/duel/create/",
    arena: false,
  },
  royale: {
    id: "royale",
    name: "Battle Royale",
    tagline: `Bis zu ${ROYALE_MAX_PLAYERS} Leute, und alle paar Minuten fliegt einer raus.`,
    rules: [
      `Bis zu ${ROYALE_MAX_PLAYERS} Spieler raten dasselbe Wort.`,
      `Nach ${ROYALE_PHASE_SECONDS[0]} Sekunden scheidet aus, wer am weitesten weg ist.`,
      `Danach wird die Uhr kürzer: ${ROYALE_PHASE_SECONDS.slice(1).join(", ")} Sekunden.`,
      "Wer übrig bleibt oder Rang 1 trifft, gewinnt.",
    ],
    createHref: "/arena/create/?modus=royale",
    arena: true,
  },
  blitz: {
    id: "blitz",
    name: "Blitz-Duell",
    tagline: `${BLITZ_SECONDS} Sekunden für alle, der beste Rang gewinnt.`,
    rules: [
      `Eine gemeinsame Uhr über ${BLITZ_SECONDS} Sekunden.`,
      "Wer am Ende den besten Rang hat, gewinnt.",
      "Rang 1 beendet die Runde sofort.",
    ],
    createHref: "/arena/create/?modus=blitz",
    arena: true,
  },
  timerush: {
    id: "timerush",
    name: "Zeitbonus-Jagd",
    tagline: "Deine Uhr läuft, und nur ein besseres Wort dreht sie zurück.",
    rules: [
      `Jeder startet mit ${TIMERUSH_START_SECONDS} Sekunden auf der eigenen Uhr.`,
      `Jedes Wort, das näher dran ist als dein bisher bestes, bringt ${TIMERUSH_BONUS_SECONDS} Sekunden dazu.`,
      "Wessen Uhr abläuft, ist raus.",
      "Wer übrig bleibt oder Rang 1 trifft, gewinnt.",
    ],
    createHref: "/arena/create/?modus=timerush",
    arena: true,
  },
};

/** Display order on the mode page: the established ones first. */
export const MULTIPLAYER_MODE_ORDER: QueueModeId[] = [
  "duel",
  "koop",
  "wordle_duel",
  "royale",
  "blitz",
  "timerush",
];

export const ARENA_MODE_ORDER: ArenaModeId[] = ["royale", "blitz", "timerush"];

export function isArenaMode(mode: string): mode is ArenaModeId {
  return (ARENA_MODE_ORDER as string[]).includes(mode);
}

export function isQueueMode(mode: string): mode is QueueModeId {
  return mode in MULTIPLAYER_MODES;
}
