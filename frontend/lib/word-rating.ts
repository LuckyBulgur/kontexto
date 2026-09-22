"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Post-round word rating: "was this word fair?"
 *
 * Every automatic gate this project built to judge a solution word failed the
 * same way. The simulated player struck out the words for camera, clock and
 * Christmas; the concreteness norms let in the words for ash tree and moth;
 * corpus frequency lost the words for body part and weekday just under its
 * floor. None of them can answer whether anybody knew the word, and neither can
 * the guess count: a word nobody knows and a word that is merely far away both
 * read as a long round.
 *
 * So the players are asked, in three taps at most:
 *
 *   1. the verdict, on the result card, after a solve and after a give-up alike
 *   2. the reason, only after "too hard", which is the step that carries the
 *      whole point: "did not know it" is a word that has to leave the pool,
 *      "could not get there" is a good hard round
 *   3. the tally, plus an optional free-text field
 *
 * Unlike the attribution survey next to it, this one asks on **every** finished
 * round, because every word needs its own rating and there are 2.710 of them.
 * That is exactly why it may never be a dialog: the survey asks once in a
 * lifetime and may interrupt, this one asks daily and has to be a quiet row.
 *
 * The state per round lives in memory; only the answered game numbers are
 * persisted, so a reload does not ask twice about the same word. Every
 * `localStorage` access is wrapped in try/catch: it throws in private mode, and
 * the question then simply asks again rather than breaking the game.
 */

export type RatingVerdict = "easy" | "right" | "hard";
export type RatingReason = "unknown_word" | "no_idea" | "bad_neighbours";

export interface RatingVerdictOption {
  id: RatingVerdict;
  label: string;
}

export interface RatingReasonOption {
  id: RatingReason;
  label: string;
}

/**
 * Three, and in this order, because the order is the scale: too little, right,
 * too much. Shuffling them the way the attribution survey shuffles its channels
 * would destroy that, and a scale read out of order is answered wrongly.
 */
export const RATING_VERDICTS: RatingVerdictOption[] = [
  { id: "easy", label: "Zu leicht" },
  { id: "right", label: "Genau richtig" },
  { id: "hard", label: "Zu schwer" },
];

/** Asked only after „Zu schwer". The first entry is the one that decides
 *  whether a word stays in the pool, so it stands first. */
export const RATING_REASONS: RatingReasonOption[] = [
  { id: "unknown_word", label: "Wort nicht gekannt" },
  { id: "no_idea", label: "Kam nicht drauf" },
  { id: "bad_neighbours", label: "Nähe ergab keinen Sinn" },
];

export const RATING_STORAGE_KEY = "kontexto_word_rating_v1";

/** How many answered game numbers are remembered. A player who has rated a
 *  thousand words does not need the first hundred kept; the server dedups
 *  anyway, this only spares the pointless request. */
export const RATED_HISTORY_MAX = 200;

/** Below this the server sends no tally, and the client says so instead of
 *  drawing a percentage out of four votes. Mirrors RATING_MIN_VOTES. */
export const MIN_VOTES_HINT = 20;

export type RatingStep = "verdict" | "reason" | "done";

export interface RatingSummary {
  game_number: number;
  total: number;
  enough: boolean;
  counts: Record<RatingVerdict, number>;
}

function storage(): Storage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

export function loadRatedGames(store: Storage | undefined): number[] {
  try {
    const raw = store?.getItem(RATING_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  } catch {
    return [];
  }
}

export function saveRatedGames(store: Storage | undefined, games: number[]): void {
  try {
    store?.setItem(RATING_STORAGE_KEY, JSON.stringify(games.slice(-RATED_HISTORY_MAX)));
  } catch {
    // Persistence is optional. Without it the question comes back after a
    // reload, and the server refuses the second vote, which is the right
    // outcome either way.
  }
}

export function rememberRated(games: number[], gameNumber: number): number[] {
  if (games.includes(gameNumber)) return games;
  return [...games, gameNumber].slice(-RATED_HISTORY_MAX);
}

export function hasRated(games: number[], gameNumber: number): boolean {
  return games.includes(gameNumber);
}

/**
 * The step to render next.
 *
 * `reason` only follows the "hard" verdict. The other two verdicts are complete
 * answers: a word that was too easy has nothing left to explain, and asking
 * anyway would spend a tap on nothing.
 */
export function nextStep(verdict: RatingVerdict | null): RatingStep {
  if (verdict === null) return "verdict";
  return verdict === "hard" ? "reason" : "done";
}

export interface WordRatingPrompt {
  /** Whether the question may be shown for this round at all. */
  visible: boolean;
  step: RatingStep;
  verdict: RatingVerdict | null;
  summary: RatingSummary | null;
  /** The optional free text was sent; the field disappears. */
  detailSent: boolean;
  chooseVerdict: (verdict: RatingVerdict) => void;
  chooseReason: (reason: RatingReason) => void;
  sendDetail: (detail: string) => void;
}

export interface WordRatingTransport {
  submit: (vote: {
    gameNumber: number;
    verdict: RatingVerdict;
    reason?: RatingReason;
    detail?: string;
  }) => Promise<void>;
  summary: (gameNumber: number) => Promise<RatingSummary | null>;
}

/**
 * Mount once per result card.
 *
 * `finished` gates everything, so the question only ever appears on a round that
 * is over. The start state hides it, so the static export never hydrates with a
 * question the stored state would have removed.
 *
 * The vote is sent on the first tap, not after the reason. A player who taps
 * "too hard" and then closes the tab has still said the useful half, and waiting
 * for a second tap would throw that away.
 */
export function useWordRating(
  finished: boolean,
  gameNumber: number,
  transport: WordRatingTransport,
): WordRatingPrompt {
  const [rated, setRated] = useState<number[]>([]);
  const [ready, setReady] = useState(false);
  const [verdict, setVerdict] = useState<RatingVerdict | null>(null);
  const [reasonDone, setReasonDone] = useState(false);
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [detailSent, setDetailSent] = useState(false);

  useEffect(() => {
    setRated(loadRatedGames(storage()));
    setReady(true);
  }, []);

  // A new round is a new question, even for the same person on the same day.
  useEffect(() => {
    setVerdict(null);
    setReasonDone(false);
    setSummary(null);
    setDetailSent(false);
  }, [gameNumber]);

  const chooseVerdict = useCallback(
    (choice: RatingVerdict) => {
      setVerdict(choice);
      setRated((current) => {
        const next = rememberRated(current, gameNumber);
        saveRatedGames(storage(), next);
        return next;
      });
      // The vote goes out on this tap and not after the reason: somebody who
      // taps "too hard" and then closes the tab has said the useful half, and
      // waiting for a second tap would throw it away.
      void transport
        .submit({ gameNumber, verdict: choice })
        .catch(() => undefined)
        .then(() => transport.summary(gameNumber))
        .then((result) => setSummary(result ?? null))
        .catch(() => setSummary(null));
    },
    [transport, gameNumber],
  );

  const chooseReason = useCallback(
    (reason: RatingReason) => {
      if (verdict === null) return;
      setReasonDone(true);
      // A second call for the same game, which the server dedups: the vote is
      // already counted, this one only carries the reason.
      void transport.submit({ gameNumber, verdict, reason }).catch(() => undefined);
    },
    [transport, gameNumber, verdict],
  );

  const sendDetail = useCallback(
    (detail: string) => {
      const trimmed = detail.trim();
      if (!trimmed || verdict === null) return;
      setDetailSent(true);
      void transport.submit({ gameNumber, verdict, detail: trimmed }).catch(() => undefined);
    },
    [transport, gameNumber, verdict],
  );

  // Answered in an earlier session, so the stored list knows it: ask nothing.
  // While this round is being answered the list already contains the number,
  // hence the second half of the condition.
  const answeredBefore = hasRated(rated, gameNumber) && verdict === null;

  return {
    visible: finished && ready && !answeredBefore,
    step: verdict === null ? "verdict" : verdict === "hard" && !reasonDone ? "reason" : "done",
    verdict,
    summary,
    detailSent,
    chooseVerdict,
    chooseReason,
    sendDetail,
  };
}
