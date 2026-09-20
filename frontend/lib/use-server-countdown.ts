"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Seconds left until a server-issued deadline, corrected for the device clock.
 *
 * A countdown rendered from `Date.parse(deadline) - Date.now()` is only as
 * correct as the phone it runs on. A device two minutes fast would show a round
 * that ended before it started, and the player would blame the game. The arena
 * state therefore carries the server's own clock, and the offset measured from
 * it is applied to every deadline.
 *
 * The client never decides that time is up: the server refuses a late guess on
 * its own clock. This hook only draws the number.
 */
export function useClockOffset(serverTime: string | null | undefined): number {
  const [offsetMs, setOffsetMs] = useState(0);
  const measured = useRef(false);

  useEffect(() => {
    if (!serverTime || measured.current) return;
    const parsed = Date.parse(serverTime);
    if (Number.isNaN(parsed)) return;
    measured.current = true;
    setOffsetMs(parsed - Date.now());
  }, [serverTime]);

  return offsetMs;
}

/** Whole seconds left, never negative. Null when there is no deadline. */
export function useCountdown(
  deadline: string | null | undefined,
  offsetMs: number
): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [deadline]);

  if (!deadline) return null;
  const target = Date.parse(deadline);
  if (Number.isNaN(target)) return null;
  return Math.max(0, Math.ceil((target - (now + offsetMs)) / 1000));
}

/** `2:05` above a minute, `47` below it. */
export function formatCountdown(seconds: number): string {
  if (seconds < 60) return String(seconds);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
