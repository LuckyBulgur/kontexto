"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getLiveCounts } from "./matchmaking-api";
import { MatchmakingLive } from "./matchmaking-types";

/**
 * How often the picker asks how busy the modes are.
 *
 * Ten seconds, not the one and a half of the waiting screen
 * (`MatchSearchClient`): this figure is orientation before a decision, not a
 * progress indicator somebody is staring at. It is also answered from a short
 * server-side cache, so polling faster would not even return new numbers.
 */
const POLL_INTERVAL_MS = 10_000;

/**
 * The live load figures, or null while they are unknown.
 *
 * Null is the honest answer for both "not loaded yet" and "the request
 * failed". A side figure must never put an error on a page that works without
 * it, so nothing here throws and nothing here renders a message.
 */
export function useMatchmakingLive(enabled: boolean): MatchmakingLive | null {
  const [live, setLive] = useState<MatchmakingLive | null>(null);
  // The effect must not restart when a fetch resolves, so the in-flight guard
  // lives in a ref rather than in state.
  const cancelled = useRef(false);

  const load = useCallback(async () => {
    try {
      const next = await getLiveCounts();
      if (!cancelled.current) setLive(next);
    } catch {
      /* an unreachable figure stays unknown, the page keeps working */
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    cancelled.current = false;

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer !== null) return;
      void load();
      timer = setInterval(() => void load(), POLL_INTERVAL_MS);
    };

    const stop = () => {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    };

    // A backgrounded tab would otherwise poll for hours for a number nobody is
    // looking at. Coming back reloads at once, because the last value is as
    // old as the tab was hidden.
    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled.current = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, load]);

  return live;
}
