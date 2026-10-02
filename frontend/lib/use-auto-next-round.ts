"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { autoNextSecondsLeft } from "@/lib/live-auto-next";

/** How often the countdown is redrawn. Under a second, so the number never
 *  skips one, and cheap: it is one state update on a finished round. */
const TICK_MS = 250;

interface AutoNextRoundOptions {
  /** Delay after the round ends, or null when the room does not move on by itself. */
  delayMs: number | null;
  /** The round on screen, null while the room is still loading. */
  round: number | null;
  roundOver: boolean;
  onAdvance: () => void;
}

/**
 * Starts the next round `delayMs` after the current one ended.
 *
 * Fires at most once per round: a refused advance (no game left, a lost
 * connection) leaves the result on screen with its button instead of retrying
 * four times a second. `stop` holds the current round, and only that one.
 *
 * The deadline is wall-clock time, not a count of ticks, because a browser
 * slows the timers of a tab in the background; the round still moves on as
 * soon as the tab runs again, and at once when it becomes visible.
 */
export function useAutoNextRound({
  delayMs,
  round,
  roundOver,
  onAdvance,
}: AutoNextRoundOptions): { secondsLeft: number | null; stop: () => void } {
  const [stoppedRound, setStoppedRound] = useState<number | null>(null);
  const [deadline, setDeadline] = useState<{ round: number; at: number } | null>(null);
  const [now, setNow] = useState(0);
  const advance = useRef(onAdvance);

  useEffect(() => {
    advance.current = onAdvance;
  }, [onAdvance]);

  const armed = delayMs !== null && roundOver && round !== null && stoppedRound !== round;

  useEffect(() => {
    if (!armed || delayMs === null || round === null) {
      setDeadline(null);
      return;
    }
    const at = Date.now() + delayMs;
    let fired = false;
    setDeadline({ round, at });
    setNow(Date.now());

    const tick = () => {
      if (fired) return;
      const current = Date.now();
      setNow(current);
      if (current < at) return;
      fired = true;
      setStoppedRound(round);
      advance.current();
    };
    const timer = setInterval(tick, TICK_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [armed, delayMs, round]);

  const stop = useCallback(() => {
    if (round !== null) setStoppedRound(round);
  }, [round]);

  const secondsLeft =
    armed && deadline !== null && deadline.round === round
      ? autoNextSecondsLeft(deadline.at, now)
      : null;

  return { secondsLeft, stop };
}
