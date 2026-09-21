"use client";

import * as React from "react";

import { useReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

/**
 * The solved word, arriving letter by letter.
 *
 * The whole round is one question, and this is the answer. Building it up is
 * the one place where a flourish says something: the word appears the way it
 * was found, one piece at a time.
 *
 * Three things keep it from being decoration:
 *
 * - The full word is in the DOM from the first paint. The letters that have not
 *   arrived yet are transparent, not absent, so the line never reflows, a
 *   screen reader reads the whole word at once, and a crawler sees it too.
 * - It plays once. `key` changes with the word, so a re-render for an unrelated
 *   reason does not replay it.
 * - With reduced motion every letter is visible immediately.
 */
export function RevealWord({
  word,
  /** Between letters. Capped so a long compound noun does not crawl. */
  stepMs = 55,
  delayMs = 0,
  className,
}: {
  word: string;
  stepMs?: number;
  delayMs?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const letters = React.useMemo(() => Array.from(word), [word]);
  const [shown, setShown] = React.useState(letters.length);

  React.useEffect(() => {
    if (reduced) {
      setShown(letters.length);
      return;
    }
    setShown(0);
    // A 14-letter compound would otherwise take almost a second on its own.
    const step = Math.min(stepMs, 700 / Math.max(1, letters.length));
    let i = 0;
    const start = window.setTimeout(() => {
      const tick = window.setInterval(() => {
        i += 1;
        setShown(i);
        if (i >= letters.length) window.clearInterval(tick);
      }, step);
      cleanup = () => window.clearInterval(tick);
    }, delayMs);
    let cleanup = () => {};
    return () => {
      window.clearTimeout(start);
      cleanup();
    };
  }, [letters, stepMs, delayMs, reduced]);

  return (
    <span className={cn("inline-block", className)} lang="de">
      {letters.map((letter, i) => (
        <span
          key={`${letter}-${i}`}
          aria-hidden="true"
          className={cn(
            "transition-opacity duration-200",
            i < shown ? "opacity-100" : "opacity-0",
          )}
        >
          {letter}
        </span>
      ))}
      {/* The word as one string for assistive tech, since the visible letters
          are split into spans and marked aria-hidden. */}
      <span className="sr-only">{word}</span>
    </span>
  );
}
