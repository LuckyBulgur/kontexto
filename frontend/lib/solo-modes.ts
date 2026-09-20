/**
 * Rule engines for the four solo modes.
 *
 * Everything here is pure: a state plus a guess goes in, the next state comes
 * out. The rules carry no stakes against other players, so they live on the
 * client, but they still belong in one tested place rather than spread across
 * four components. Doppelziel and Sudden Death additionally need their own
 * endpoints, because the client must never learn the target word.
 */

import { Guess } from "./types";

export type SoloModeId = "leiter" | "limit" | "doppel" | "suddendeath";

export type SoloStatus = "running" | "won" | "lost";

export interface SoloModeMeta {
  id: SoloModeId;
  /** Route segment under /solo/. */
  slug: string;
  name: string;
  /** One sentence for the mode catalogue and the page description. */
  tagline: string;
  /** The rules as the player reads them, in order. */
  rules: string[];
}

/** Leiter opens on a deliberately distant word. Close enough to be a real hint,
 *  far enough that the first improvement is easy and the last one is not. */
export const LEITER_START_RANK = 5000;
export const LEITER_MAX_STRIKES = 3;
/** Limitierte Versuche: no tips, so the budget has to be generous enough that a
 *  good player finishes and tight enough that a careless one does not. */
export const LIMIT_MAX_GUESSES = 20;

export const SOLO_MODES: Record<SoloModeId, SoloModeMeta> = {
  leiter: {
    id: "leiter",
    slug: "leiter",
    name: "Leiter",
    tagline: "Jedes Wort muss näher dran sein als das vorige.",
    rules: [
      `Du startest mit einem vorgegebenen Wort auf Rang ${LEITER_START_RANK}.`,
      "Jedes Wort, das du eingibst, muss einen besseren Rang haben als dein bisher bestes.",
      `Ein Wort, das nicht näher kommt, ist ein Fehlversuch. Nach ${LEITER_MAX_STRIKES} Fehlversuchen ist die Runde vorbei.`,
      "Tipps gibt es nicht.",
    ],
  },
  limit: {
    id: "limit",
    slug: "limit",
    name: "Limitierte Versuche",
    tagline: `${LIMIT_MAX_GUESSES} Versuche, keine Tipps.`,
    rules: [
      `Du hast ${LIMIT_MAX_GUESSES} Versuche für das geheime Wort.`,
      "Tipps sind gesperrt.",
      "Jeder Versuch zählt, auch ein Wort, das weit daneben liegt.",
    ],
  },
  doppel: {
    id: "doppel",
    slug: "doppelziel",
    name: "Doppelziel",
    tagline: "Zwei geheime Wörter gleichzeitig, jeder Versuch zählt für beide.",
    rules: [
      "Es gibt zwei geheime Wörter, die nichts miteinander zu tun haben.",
      "Jedes Wort, das du eingibst, bekommt zwei Ränge, einen je Ziel.",
      "Gewonnen hast du erst, wenn du beide gefunden hast.",
      "Unbegrenzt viele Versuche.",
    ],
  },
  suddendeath: {
    id: "suddendeath",
    slug: "sudden-death",
    name: "Sudden Death",
    tagline: "Du siehst die fünf nächsten Nachbarn. Ein Versuch.",
    rules: [
      "Du bekommst die Wörter auf Rang 2 bis 6 zu sehen.",
      "Du hast genau einen Versuch auf Rang 1.",
      "Danach wird aufgelöst, richtig oder falsch.",
    ],
  },
};

export const SOLO_MODE_ORDER: SoloModeId[] = ["leiter", "limit", "doppel", "suddendeath"];

/** Resolve a route segment back to its mode, or null for an unknown one. */
export function soloModeBySlug(slug: string): SoloModeMeta | null {
  return SOLO_MODE_ORDER.map((id) => SOLO_MODES[id]).find((m) => m.slug === slug) ?? null;
}

// --- Leiter -----------------------------------------------------------------

export interface LeiterState {
  mode: "leiter";
  gameNumber: number;
  /** The given opening word, already part of `guesses`. */
  startWord: string;
  startRank: number;
  guesses: Guess[];
  /** The rank the next guess has to beat. */
  bestRank: number;
  strikes: number;
  status: SoloStatus;
  startedAt?: number;
}

export function createLeiterState(
  gameNumber: number,
  startWord: string,
  startRank: number
): LeiterState {
  return {
    mode: "leiter",
    gameNumber,
    startWord,
    startRank,
    guesses: [{ word: startWord, rank: startRank, isTip: true }],
    bestRank: startRank,
    strikes: 0,
    status: "running",
  };
}

export interface LeiterOutcome {
  state: LeiterState;
  /** True when this guess did not beat the standing best rank. */
  struck: boolean;
}

export function leiterApplyGuess(
  state: LeiterState,
  guess: { word: string; rank: number }
): LeiterOutcome {
  if (state.status !== "running") return { state, struck: false };

  const improved = guess.rank < state.bestRank;
  const strikes = improved ? state.strikes : state.strikes + 1;
  const bestRank = improved ? guess.rank : state.bestRank;
  const guesses = [...state.guesses, { word: guess.word, rank: guess.rank, isTip: false }];

  let status: SoloStatus = "running";
  if (guess.rank === 1) status = "won";
  else if (strikes >= LEITER_MAX_STRIKES) status = "lost";

  return {
    state: {
      ...state,
      guesses,
      bestRank,
      strikes,
      status,
      startedAt: state.startedAt ?? Date.now(),
    },
    struck: !improved,
  };
}

export function leiterStrikesLeft(state: LeiterState): number {
  return Math.max(0, LEITER_MAX_STRIKES - state.strikes);
}

// --- Limitierte Versuche ----------------------------------------------------

export interface LimitState {
  mode: "limit";
  gameNumber: number;
  guesses: Guess[];
  status: SoloStatus;
  startedAt?: number;
}

export function createLimitState(gameNumber: number): LimitState {
  return { mode: "limit", gameNumber, guesses: [], status: "running" };
}

export function limitApplyGuess(
  state: LimitState,
  guess: { word: string; rank: number }
): LimitState {
  if (state.status !== "running") return state;

  const guesses = [...state.guesses, { word: guess.word, rank: guess.rank, isTip: false }];
  let status: SoloStatus = "running";
  if (guess.rank === 1) status = "won";
  else if (guesses.length >= LIMIT_MAX_GUESSES) status = "lost";

  return { ...state, guesses, status, startedAt: state.startedAt ?? Date.now() };
}

export function limitGuessesLeft(state: LimitState): number {
  return Math.max(0, LIMIT_MAX_GUESSES - state.guesses.length);
}

// --- Doppelziel -------------------------------------------------------------

export interface DoppelGuess {
  word: string;
  /** One rank per target, in the order of `gameNumbers`. */
  ranks: number[];
}

export interface DoppelState {
  mode: "doppel";
  gameNumbers: number[];
  guesses: DoppelGuess[];
  /** Per target: found or not. */
  solved: boolean[];
  status: SoloStatus;
  startedAt?: number;
}

export function createDoppelState(gameNumbers: number[]): DoppelState {
  return {
    mode: "doppel",
    gameNumbers,
    guesses: [],
    solved: gameNumbers.map(() => false),
    status: "running",
  };
}

export function doppelApplyGuess(state: DoppelState, guess: DoppelGuess): DoppelState {
  if (state.status !== "running") return state;

  const solved = state.solved.map((was, i) => was || guess.ranks[i] === 1);
  return {
    ...state,
    guesses: [...state.guesses, guess],
    solved,
    status: solved.every(Boolean) ? "won" : "running",
    startedAt: state.startedAt ?? Date.now(),
  };
}

/** The best rank reached per target, for the result card. */
export function doppelBestRanks(state: DoppelState): number[] {
  return state.gameNumbers.map((_, i) =>
    state.guesses.length ? Math.min(...state.guesses.map((g) => g.ranks[i])) : Infinity
  );
}

// --- Sudden Death -----------------------------------------------------------

export interface SuddenDeathState {
  mode: "suddendeath";
  gameNumber: number;
  /** The runners-up, ranks 2 to 6. */
  hints: { word: string; rank: number }[];
  /** The single attempt, once it has been made. */
  attempt: { word: string; rank: number } | null;
  /** Filled after the round, so the card can name the answer. */
  solution: string | null;
  status: SoloStatus;
  startedAt?: number;
}

export function createSuddenDeathState(
  gameNumber: number,
  hints: { word: string; rank: number }[]
): SuddenDeathState {
  return {
    mode: "suddendeath",
    gameNumber,
    hints,
    attempt: null,
    solution: null,
    status: "running",
  };
}

export function suddenDeathApplyGuess(
  state: SuddenDeathState,
  guess: { word: string; rank: number }
): SuddenDeathState {
  if (state.status !== "running") return state;
  return {
    ...state,
    attempt: guess,
    status: guess.rank === 1 ? "won" : "lost",
    solution: guess.rank === 1 ? guess.word : state.solution,
    startedAt: state.startedAt ?? Date.now(),
  };
}

export type SoloState = LeiterState | LimitState | DoppelState | SuddenDeathState;

/** Best rank reached, for the completion beacon. */
export function soloBestRank(state: SoloState): number {
  switch (state.mode) {
    case "doppel": {
      const best = doppelBestRanks(state).filter((r) => Number.isFinite(r));
      return best.length ? Math.min(...best) : 10000;
    }
    case "suddendeath":
      return state.attempt ? state.attempt.rank : 10000;
    default: {
      const own = state.guesses.filter((g) => !g.isTip);
      return own.length ? Math.min(...own.map((g) => g.rank)) : 10000;
    }
  }
}

/** Number of guesses the player actually made, excluding a given start word. */
export function soloGuessCount(state: SoloState): number {
  switch (state.mode) {
    case "doppel":
      return state.guesses.length;
    case "suddendeath":
      return state.attempt ? 1 : 0;
    default:
      return state.guesses.filter((g) => !g.isTip).length;
  }
}
