"use client";

import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** Non-reactive read, for imperative code that fires once. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

/**
 * Whether the visitor asked for less motion (WCAG 2.3.3).
 *
 * `app/globals.css` already flattens every CSS animation and transition, and
 * Framer Motion is bound through `MotionConfig reducedMotion="user"`. What
 * neither covers is motion driven from JavaScript: a counter that ticks up, a
 * word that types itself out, a width animated frame by frame. Those have to
 * ask, and this is where they ask.
 *
 * Starts at `false` and corrects in an effect, because the static export has no
 * `window` and a value read during render would make server and client markup
 * disagree. The one frame of difference is invisible: the components that use
 * this render their end state on the first paint either way, and only start
 * moving afterwards.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(QUERY);
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
