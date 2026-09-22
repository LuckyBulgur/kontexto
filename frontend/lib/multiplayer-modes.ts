/**
 * The catalogue of multiplayer modes: what each one is called, how it is
 * described, where its private room is created and whether the random queue
 * serves it.
 *
 * One list, used by the mode page, the queue screen and the arena lobby, so a
 * new mode is named once rather than in three places that slowly disagree.
 */

import { ArenaModeId } from "./arena-types";
import { MultiplayerModeId, QueueModeId } from "./matchmaking-types";
import {
  BLITZ_SECONDS,
  ROYALE_MAX_PLAYERS,
  ROYALE_PHASE_SECONDS,
  TIMERUSH_BONUS_SECONDS,
  TIMERUSH_START_SECONDS,
} from "./arena-rules";

export interface MultiplayerModeMeta {
  id: MultiplayerModeId;
  /** Which of the two games this mode belongs to. Kontexto and Wordle have
   *  their own header, their own menu and their own way in, so a picker that
   *  mixed them would offer a round of a game the player is not in. */
  game: "kontexto" | "wordle";
  name: string;
  /** Three or four words for the picker. Long enough to choose by, short
   *  enough to read while the game is waiting. */
  hook: string;
  /** One sentence, the way it is pitched on the mode page. */
  tagline: string;
  /** The rules as the player reads them. */
  rules: string[];
  /** Where a private room with an invite link is created, if there is one. */
  createHref: string | null;
  /** Whether this mode is one of the three timed arenas. */
  arena: boolean;
  /** Whether the random queue serves this mode. False for the stream chat:
   *  the streamer opens the room and the audience is already in it, so there
   *  is no second party to wait for. */
  queueable: boolean;
  /** Where the random queue for this mode is asked for. Wordle has its own
   *  queue page, so the path is stored rather than assembled by each caller.
   *  Null for a mode the queue does not serve. */
  queueHref: string | null;
}

export const MULTIPLAYER_MODES: Record<MultiplayerModeId, MultiplayerModeMeta> = {
  duel: {
    id: "duel",
    game: "kontexto",
    name: "Duell",
    hook: "Wer findet es zuerst",
    tagline: "Gleiches Wort, zwei Leute, wer findet es zuerst?",
    rules: [
      "Beide raten dasselbe geheime Wort.",
      "Du siehst den besten Rang des anderen live, aber nicht seine Wörter.",
      "Unbegrenzt viele Versuche.",
    ],
    createHref: "/duel/create/",
    arena: false,
    queueable: true,
    queueHref: "/suche/?modus=duel",
  },
  koop: {
    id: "koop",
    game: "kontexto",
    name: "Koop",
    hook: "Gemeinsam eine Liste",
    tagline: "Eine gemeinsame Liste, ein gemeinsamer Sieg.",
    rules: [
      "Alle raten zusammen auf einer geteilten Liste.",
      "Ein Wort, das jemand schon probiert hat, zählt nicht doppelt.",
      "Ihr gewinnt zusammen, sobald jemand Rang 1 trifft.",
    ],
    createHref: "/koop/create/",
    arena: false,
    queueable: true,
    queueHref: "/suche/?modus=koop",
  },
  wordle_duel: {
    id: "wordle_duel",
    game: "wordle",
    name: "Wördle-Duell",
    hook: "Wördle, Kopf an Kopf",
    tagline: "Dasselbe Wördle, zwei Bretter, sechs Versuche.",
    rules: [
      "Beide lösen dasselbe Wördle.",
      "Du siehst die Farben des anderen, nicht seine Buchstaben.",
      "Wer zuerst löst, gewinnt.",
    ],
    createHref: "/wordle/duel/create/",
    arena: false,
    queueable: true,
    queueHref: "/wordle/suche/",
  },
  royale: {
    id: "royale",
    game: "kontexto",
    name: "Battle Royale",
    hook: "Der Letzte bleibt",
    tagline: `Bis zu ${ROYALE_MAX_PLAYERS} Leute, und alle paar Minuten fliegt einer raus.`,
    rules: [
      `Bis zu ${ROYALE_MAX_PLAYERS} Spieler raten dasselbe Wort.`,
      `Nach ${ROYALE_PHASE_SECONDS[0]} Sekunden scheidet aus, wer am weitesten weg ist.`,
      `Danach wird die Uhr kürzer: ${ROYALE_PHASE_SECONDS.slice(1).join(", ")} Sekunden.`,
      "Wer übrig bleibt oder Rang 1 trifft, gewinnt.",
    ],
    createHref: "/arena/create/?modus=royale",
    arena: true,
    queueable: true,
    queueHref: "/suche/?modus=royale",
  },
  blitz: {
    id: "blitz",
    game: "kontexto",
    name: "Blitz-Duell",
    hook: "120 Sekunden, bester Rang",
    tagline: `${BLITZ_SECONDS} Sekunden für alle, der beste Rang gewinnt.`,
    rules: [
      `Eine gemeinsame Uhr über ${BLITZ_SECONDS} Sekunden.`,
      "Wer am Ende den besten Rang hat, gewinnt.",
      "Rang 1 beendet die Runde sofort.",
    ],
    createHref: "/arena/create/?modus=blitz",
    arena: true,
    queueable: true,
    queueHref: "/suche/?modus=blitz",
  },
  timerush: {
    id: "timerush",
    game: "kontexto",
    name: "Zeitbonus-Jagd",
    hook: "Nur bessere Wörter kaufen Zeit",
    tagline: "Deine Uhr läuft, und nur ein besseres Wort dreht sie zurück.",
    rules: [
      `Jeder startet mit ${TIMERUSH_START_SECONDS} Sekunden auf der eigenen Uhr.`,
      `Jedes Wort, das näher dran ist als dein bisher bestes, bringt ${TIMERUSH_BONUS_SECONDS} Sekunden dazu.`,
      "Wessen Uhr abläuft, ist raus.",
      "Wer übrig bleibt oder Rang 1 trifft, gewinnt.",
    ],
    createHref: "/arena/create/?modus=timerush",
    arena: true,
    queueable: true,
    queueHref: "/suche/?modus=timerush",
  },
  live: {
    id: "live",
    game: "kontexto",
    name: "Stream-Chat",
    hook: "Dein Chat rät mit",
    tagline: "Dein Twitch-Chat rät mit, ohne Anmeldung und ohne Link.",
    rules: [
      "Du trägst deinen Kanal ein, wir lesen den Chat mit.",
      "Jede Nachricht aus einem einzigen Wort ist ein Versuch.",
      "Alle raten auf einer gemeinsamen Liste, wie im Koop.",
      "Für OBS gibt es eine eigene Einblendung.",
    ],
    createHref: "/live/",
    arena: false,
    queueable: false,
    queueHref: null,
  },
};

/** Display order on the mode page: the established ones first. */
export const MULTIPLAYER_MODE_ORDER: MultiplayerModeId[] = [
  "duel",
  "koop",
  "wordle_duel",
  "royale",
  "blitz",
  "timerush",
  "live",
];

/** The modes Kontexto offers, so its picker and its create form never lead
 *  into the other game. Derived from the full order, because a second
 *  hand-written list is a list that drifts. */
export const KONTEXTO_MULTIPLAYER_ORDER: MultiplayerModeId[] = MULTIPLAYER_MODE_ORDER.filter(
  (id) => MULTIPLAYER_MODES[id].game === "kontexto"
);

/** The Kontexto modes the random queue actually serves. The search page asks
 *  for this one: a mode without a queue would sit there waiting for a partner
 *  who is not coming. */
export const KONTEXTO_QUEUE_ORDER: QueueModeId[] = KONTEXTO_MULTIPLAYER_ORDER.filter(
  (id): id is QueueModeId => MULTIPLAYER_MODES[id].queueable
);

/** The same for Wordle, which today is the one duel. */
export const WORDLE_MULTIPLAYER_ORDER: QueueModeId[] = MULTIPLAYER_MODE_ORDER.filter(
  (id): id is QueueModeId =>
    MULTIPLAYER_MODES[id].game === "wordle" && MULTIPLAYER_MODES[id].queueable
);

export const ARENA_MODE_ORDER: ArenaModeId[] = ["royale", "blitz", "timerush"];

export function isArenaMode(mode: string): mode is ArenaModeId {
  return (ARENA_MODE_ORDER as string[]).includes(mode);
}

export function isQueueMode(mode: string): mode is QueueModeId {
  return mode in MULTIPLAYER_MODES && MULTIPLAYER_MODES[mode as MultiplayerModeId].queueable;
}

/** Whether the catalogue knows this mode at all, queue or no queue. */
export function isMultiplayerMode(mode: string): mode is MultiplayerModeId {
  return mode in MULTIPLAYER_MODES;
}
