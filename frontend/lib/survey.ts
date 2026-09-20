"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Attribution survey: „Woher kennst du Kontexto?"
 *
 * One question, one tap, asked in the only moment where it does not interrupt
 * anything: on the result card of a finished game. Referrer data cannot see word
 * of mouth, messenger links or a mention in a video, and that is exactly where
 * most of the traffic comes from.
 *
 * Everything here is pure except the hook at the bottom. The persistence helpers
 * take the `Storage` as a parameter so they can be tested without a DOM, and
 * every access is wrapped in try/catch: in private mode `localStorage` throws,
 * and the survey then stays hidden instead of breaking the game or asking on
 * every single game.
 */

export type SurveySource =
  | "search" | "friends" | "tiktok" | "instagram" | "youtube" | "twitch"
  | "reddit" | "other_game" | "random" | "other";

export interface SurveyOption {
  id: SurveySource;
  label: string;
  /** Placeholder of the optional follow-up field, asked after the tap. */
  detailPrompt: string;
}

/**
 * The catalogue. Ten entries still fit on one mobile screen without scrolling,
 * which is the ceiling for a question that has to be answered in a single tap.
 */
export const SURVEY_OPTIONS: SurveyOption[] = [
  { id: "search", label: "Google/Suche", detailPrompt: "Wonach hast du gesucht?" },
  { id: "friends", label: "Freunde", detailPrompt: "Wo hast du davon gehört?" },
  { id: "tiktok", label: "TikTok", detailPrompt: "Welcher Creator?" },
  { id: "instagram", label: "Instagram", detailPrompt: "Welcher Account?" },
  { id: "youtube", label: "YouTube", detailPrompt: "Welcher Kanal?" },
  { id: "twitch", label: "Twitch", detailPrompt: "Welcher Streamer?" },
  { id: "reddit", label: "Reddit", detailPrompt: "Welches Subreddit?" },
  { id: "other_game", label: "Ein anderes Spiel", detailPrompt: "Welches Spiel?" },
  { id: "random", label: "Zufall", detailPrompt: "Wo denn?" },
  { id: "other", label: "Anderes", detailPrompt: "Woher denn?" },
];

/** Catch-all answers stay at the end; shuffling them into the middle would make
 * them compete with the concrete ones and cost precision. */
const PINNED_LAST: SurveySource[] = ["random", "other"];

export const SURVEY_STORAGE_KEY = "kontexto_survey_source_v1";

/**
 * How long the dialog waits after the game ends. Long enough for the result card
 * and the confetti to land, short enough that nobody has left the page.
 */
export const DIALOG_DELAY_MS = 900;
/** After this many result cards the quiet inline fallback stops asking. */
export const MAX_INLINE_VIEWS = 3;

export interface SurveyState {
  status: "open" | "answered" | "dismissed";
  /** The one modal ask has happened; it never comes back. */
  dialogShown: boolean;
  inlineViews: number;
  firstSeenAt: number | null;
  lastSeenAt: number | null;
}

export const DEFAULT_SURVEY_STATE: SurveyState = {
  status: "open",
  dialogShown: false,
  inlineViews: 0,
  firstSeenAt: null,
  lastSeenAt: null,
};

function isSurveyState(value: unknown): value is SurveyState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    (v.status === "open" || v.status === "answered" || v.status === "dismissed") &&
    typeof v.inlineViews === "number" &&
    typeof v.dialogShown === "boolean"
  );
}

export function loadSurveyState(storage: Storage | undefined): SurveyState {
  try {
    const raw = storage?.getItem(SURVEY_STORAGE_KEY);
    if (!raw) return DEFAULT_SURVEY_STATE;
    const parsed: unknown = JSON.parse(raw);
    if (!isSurveyState(parsed)) return DEFAULT_SURVEY_STATE;
    return {
      ...DEFAULT_SURVEY_STATE,
      ...parsed,
      firstSeenAt: typeof parsed.firstSeenAt === "number" ? parsed.firstSeenAt : null,
      lastSeenAt: typeof parsed.lastSeenAt === "number" ? parsed.lastSeenAt : null,
    };
  } catch {
    return DEFAULT_SURVEY_STATE;
  }
}

export function saveSurveyState(storage: Storage | undefined, state: SurveyState): void {
  try {
    storage?.setItem(SURVEY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Persistence is optional; the survey is hidden for this session either way.
  }
}

/**
 * Fisher-Yates over the concrete options, catch-alls appended unchanged.
 *
 * Respondents systematically pick what stands first, so a fixed order would not
 * measure the channels, it would measure this list.
 */
export function shuffleOptions(
  options: SurveyOption[] = SURVEY_OPTIONS,
  random: () => number = Math.random,
): SurveyOption[] {
  const shuffled = options.filter((o) => !PINNED_LAST.includes(o.id));
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const pinned = PINNED_LAST
    .map((id) => options.find((o) => o.id === id))
    .filter((o): o is SurveyOption => o !== undefined);
  return [...shuffled, ...pinned];
}

/** The modal: once per visitor, and only as the very first ask. */
export function shouldShowDialog(state: SurveyState): boolean {
  return state.status === "open" && !state.dialogShown;
}

/**
 * The quiet fallback in the result card, for visitors who skipped the modal.
 * It never precedes the modal and never argues: three appearances at most.
 */
export function shouldShowInline(state: SurveyState): boolean {
  return state.status === "open" && state.dialogShown && state.inlineViews < MAX_INLINE_VIEWS;
}

export function markInlineView(state: SurveyState, now: number): SurveyState {
  return {
    ...state,
    inlineViews: state.inlineViews + 1,
    firstSeenAt: state.firstSeenAt ?? now,
    lastSeenAt: now,
  };
}

/** The modal was skipped. That ends the modal (it is marked shown when it
 * opens) but not the survey: the quiet inline fallback may still ask on a later
 * result card. A dismissal (`markDismissed`) ends everything instead. */
export function markDialogSkipped(state: SurveyState, now: number): SurveyState {
  return { ...state, lastSeenAt: now };
}

export function markDialogShown(state: SurveyState, now: number): SurveyState {
  return { ...state, dialogShown: true, firstSeenAt: state.firstSeenAt ?? now, lastSeenAt: now };
}

export function markAnswered(state: SurveyState, now: number): SurveyState {
  return { ...state, status: "answered", lastSeenAt: now };
}

export function markDismissed(state: SurveyState, now: number): SurveyState {
  return { ...state, status: "dismissed", lastSeenAt: now };
}

function storage(): Storage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

export interface SurveyPrompt {
  /** Render the one-time modal. */
  showDialog: boolean;
  /** Render the quiet fallback inside the result card. */
  showInline: boolean;
  /** An answer was sent; stop asking forever. */
  onAnswered: () => void;
  /** The modal was skipped: no answer, but the inline fallback may still ask. */
  onDialogSkipped: () => void;
  /** The answered modal was closed. */
  onDialogClosed: () => void;
  /** „Nicht jetzt" on the inline question. */
  onSkipped: () => void;
}

/**
 * Decides which surface (if any) may ask right now. Mount it once per page, not
 * once per surface, otherwise the view counter runs twice.
 *
 * `finished` gates everything: the question only ever appears on a game that is
 * over. Start state is "ask nothing", so the static export never hydrates with a
 * question that the stored state would have hidden. The modal is marked as shown
 * the moment it opens, so a reload during the dialog does not produce a second
 * one.
 */
export function useSourceSurvey(finished: boolean): SurveyPrompt {
  // Only the setter is read: the stored state is the source of truth, this keeps
  // the in-memory copy in sync for the follow-up writes.
  const [, setState] = useState<SurveyState | null>(null);
  const [dialogPending, setDialogPending] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [showInline, setShowInline] = useState(false);
  // The decision runs once per mount. A ref, not the state value: the effect
  // must not re-run when its own write lands, or the delay timer below would be
  // cancelled before it ever fires.
  const decided = useRef(false);

  useEffect(() => {
    if (!finished || decided.current) return;
    decided.current = true;
    const loaded = loadSurveyState(storage());
    const now = Date.now();

    if (shouldShowDialog(loaded)) {
      const next = markDialogShown(loaded, now);
      saveSurveyState(storage(), next);
      setState(next);
      setDialogPending(true);
      return;
    }
    if (shouldShowInline(loaded)) {
      const next = markInlineView(loaded, now);
      saveSurveyState(storage(), next);
      setState(next);
      setShowInline(true);
      return;
    }
    setState(loaded);
  }, [finished]);

  // Let the win land first: the result card and the confetti come before the
  // question, otherwise the modal reads as an interruption of the good moment.
  useEffect(() => {
    if (!dialogPending) return;
    const timer = window.setTimeout(() => setShowDialog(true), DIALOG_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [dialogPending]);

  const update = useCallback((fn: (s: SurveyState, now: number) => SurveyState) => {
    setState((current) => {
      const next = fn(current ?? DEFAULT_SURVEY_STATE, Date.now());
      saveSurveyState(storage(), next);
      return next;
    });
  }, []);

  const onAnswered = useCallback(() => {
    update(markAnswered);
  }, [update]);

  const onDialogSkipped = useCallback(() => {
    setShowDialog(false);
    update(markDialogSkipped);
  }, [update]);

  const onDialogClosed = useCallback(() => {
    setShowDialog(false);
  }, []);

  const onSkipped = useCallback(() => {
    setShowInline(false);
    update(markDismissed);
  }, [update]);

  return { showDialog, showInline, onAnswered, onDialogSkipped, onDialogClosed, onSkipped };
}
