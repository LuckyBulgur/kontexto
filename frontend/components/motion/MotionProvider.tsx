"use client";

import { LazyMotion, domAnimation, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * App-wide Motion runtime.
 *
 * - `LazyMotion` + `domAnimation` keeps the animation runtime at ~6 KB by
 *   loading only the DOM feature set on demand. `strict` forbids the heavy
 *   `motion.*` components, so every animated component must use the lightweight
 *   `m.*` primitives — this prevents accidental bundle bloat.
 * - `MotionConfig reducedMotion="user"` honours the OS-level
 *   `prefers-reduced-motion` setting globally: transform/layout animations are
 *   disabled for users who opt out, while opacity/colour transitions remain.
 *   Individual components add `useReducedMotion()` where finer control (e.g. no
 *   autoplay) is required.
 */
export default function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
