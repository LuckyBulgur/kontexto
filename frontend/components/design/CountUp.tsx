"use client";

import * as React from "react";

import { useReducedMotion } from "@/lib/use-reduced-motion";

/**
 * A number that arrives instead of standing there.
 *
 * Only for a tally being presented for the first time: the guesses in a result,
 * the streak, the breakdown. A counter that changes during play must never use
 * this, because a player reading "14" while the real value is already 15 is
 * being lied to for the sake of a flourish.
 *
 * The end value is what the DOM contains from the first paint, so a screen
 * reader, a crawler and anyone with reduced motion see the real number with no
 * intermediate states. Only the visible text ticks.
 */
export function CountUp({
  value,
  durationMs = 700,
  delayMs = 0,
  className,
}: {
  value: number;
  durationMs?: number;
  delayMs?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = React.useState(value);

  React.useEffect(() => {
    if (reduced || value <= 0) {
      setShown(value);
      return;
    }
    let frame = 0;
    let start = 0;
    setShown(0);
    const timer = window.setTimeout(() => {
      const step = (now: number) => {
        if (!start) start = now;
        const t = Math.min(1, (now - start) / durationMs);
        // ease-out: fast first, settles on the number rather than slamming into it
        const eased = 1 - (1 - t) ** 3;
        setShown(Math.round(value * eased));
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [value, durationMs, delayMs, reduced]);

  return (
    <span data-numeric className={className}>
      {shown}
    </span>
  );
}
