"use client";

import * as React from "react";

import { Meter } from "@/components/design";
import { useReducedMotion } from "@/lib/use-reduced-motion";

/**
 * A round of Kontexto, played once above the instructions before the first guess.
 *
 * A player who has never seen Kontexto does not need the rank system explained
 * first, they need to watch it work once. Five guesses in four seconds say what
 * three paragraphs say underneath, and the rules stay on the page: the demo is
 * a hook, not a replacement for them.
 *
 * Two things make it the real game rather than a cartoon of it:
 *
 * - The list is sorted by rank, best on top, which is what the live list does
 *   by default (`sortMode: "rank"`). An earlier version showed guess order, so
 *   the hit sat at the bottom and the demo taught the wrong reading direction.
 * - The rows are laid out in their final sorted position from the start and
 *   revealed in the order they were guessed. Nothing reflows while it plays,
 *   and the hit still lands last, at the top, where it belongs.
 *
 * With reduced motion the whole round is simply there. That is still the full
 * statement; only the pacing is lost.
 */

/**
 * One plausible round, in the order the words were guessed.
 *
 * The ranks are spread across the whole scale rather than clustered near the
 * top. The live bar is linear over the vocabulary, so ranks 1, 38 and 402 all
 * render at 96 to 100 percent and four of five rows looked identical: correct,
 * and useless as a demonstration. These five make each step visible, and the
 * story is the one a player actually plays, circling in from nothing.
 */
const GUESSES = [
  { word: "Auto", rank: 8120 },
  { word: "Fenster", rank: 3640 },
  { word: "Haus", rank: 1180 },
  { word: "Pflanze", rank: 402 },
  { word: "Garten", rank: 1 },
] as const;

const TARGET = "Garten";

/** What the list looks like when it is over: best rank on top. */
const SORTED = [...GUESSES].sort((a, b) => a.rank - b.rank);

/** Matches the live game's thresholds (lib/types.ts, getRankColor). */
function tone(rank: number) {
  if (rank <= 300) return "near" as const;
  if (rank <= 1500) return "mid" as const;
  return "far" as const;
}

/** Matches getBarWidth against a stand-in vocabulary size. */
function fraction(rank: number) {
  if (rank === 1) return 100;
  return Math.max(5, 100 * (1 - rank / 10000));
}

export default function OpeningDemo() {
  const reduced = useReducedMotion();
  const [played, setPlayed] = React.useState(reduced ? GUESSES.length : 0);

  React.useEffect(() => {
    if (reduced) {
      setPlayed(GUESSES.length);
      return;
    }
    setPlayed(0);
    const timers = GUESSES.map((_, i) =>
      // The hit gets a longer beat before it, so the round has an ending.
      window.setTimeout(
        () => setPlayed(i + 1),
        400 + i * 620 + (i === GUESSES.length - 1 ? 260 : 0),
      ),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [reduced]);

  return (
    <div className="flex flex-col gap-1" aria-hidden="true">
      {SORTED.map((row) => {
        const turn = GUESSES.findIndex((g) => g.word === row.word);
        const shown = turn < played;
        return (
          <div
            key={row.word}
            className="transition-opacity duration-300"
            style={{ opacity: shown ? 1 : 0 }}
          >
            <Meter
              label={row.word}
              value={row.rank}
              fraction={fraction(row.rank)}
              tone={tone(row.rank)}
              isNew={shown && !reduced}
              emphasis={row.rank === 1}
            />
          </div>
        );
      })}
    </div>
  );
}

export { TARGET as OPENING_DEMO_TARGET };
