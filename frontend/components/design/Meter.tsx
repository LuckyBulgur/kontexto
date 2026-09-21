import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The rank bar: the one thing on this site that is unmistakably Kontexto.
 *
 * It answers "how close am I" twice over, by length and by colour, so it still
 * works for a player who cannot separate the three hues. The fill colours come
 * from the `--rank-*` tokens rather than from raw Tailwind steps, for one
 * reason that is not tidiness: the word and the number sit ON the bar, half of
 * each row over the fill and half over the track, and the tokens are picked so
 * `--rank-foreground` clears 4.5:1 over both. That was not true of
 * `bg-green-500` with `text-foreground`.
 *
 * Green/amber/red is fixed, not a style choice: the shared result text uses the
 * matching emoji squares, so a different ramp would break every result already
 * posted elsewhere. Farbwelten therefore never override it.
 *
 * A new row RUNS OUT to its width instead of appearing at it. The bar is the
 * game's whole feedback loop, so the one place where motion carries meaning is
 * here: the travel is the answer arriving. Only a row marked `isNew` moves;
 * every row already in the list is drawn at its length, because re-animating
 * the whole list on each guess would be decoration, not information.
 *
 * The run is a CSS animation with only a `from`, not a JavaScript width. That
 * matters for two reasons beyond tidiness: the final length sits in the inline
 * style, so the bar is correct before any script runs and on a page that never
 * hydrates; and `prefers-reduced-motion` is handled by the global block in
 * `app/globals.css` rather than by a hook that has to guess on first render.
 * The first attempt did use a hook, and under reduced motion the bar stayed at
 * zero, which an e2e test caught.
 *
 * The length itself is a `scaleX` on a full-width element, not a `width`.
 * Animating width re-runs layout every frame and reads as sluggish; a scale
 * runs on the compositor. The text is a sibling, not a child, so nothing
 * stretches with it.
 */

export type MeterTone = "near" | "mid" | "far";

const FILL: Record<MeterTone, string> = {
  near: "bg-rank-near",
  mid: "bg-rank-mid",
  far: "bg-rank-far",
};

export interface MeterProps {
  /** The guessed word, or whatever names this row. */
  label: React.ReactNode;
  /** The rank, shown right-aligned. */
  value: React.ReactNode;
  /** Fill width in percent, 0 to 100. */
  fraction: number;
  tone: MeterTone;
  /** The row that just arrived. Runs out to its width once, then holds. */
  isNew?: boolean;
  /** Marks the row as the one the player just played. Separate from `isNew`,
   *  because a demo animates rows that nobody played. */
  highlight?: boolean;
  /** The winning row, or the row the whole card is about. */
  emphasis?: boolean;
  /** Accessible name for the whole row, when the visible label is not enough. */
  "aria-label"?: string;
  className?: string;
}

export function Meter({
  label,
  value,
  fraction,
  tone,
  isNew,
  highlight,
  emphasis,
  className,
  ...rest
}: MeterProps) {
  const width = Math.min(100, Math.max(0, fraction));

  return (
    <div
      className={cn(
        "relative flex items-center overflow-hidden rounded-lg bg-rank-track",
        emphasis ? "h-12" : "h-10",
        isNew && "animate-slideIn",
        highlight && "ring-2 ring-ring ring-offset-1 ring-offset-background",
        className,
      )}
      {...rest}
    >
      <div
        data-slot="meter-fill"
        className={cn(
          "absolute inset-y-0 left-0 w-full origin-left",
          // The winning row takes longer on purpose: it is the last thing that
          // happens in a round, and arriving slowly is how it reads as an
          // arrival rather than as another row.
          isNew && (emphasis ? "animate-meter-run-slow" : "animate-meter-run"),
          FILL[tone],
        )}
        style={{ transform: `scaleX(${width / 100})` }}
        aria-hidden="true"
      />
      <span
        className={cn(
          "relative z-10 ml-3 min-w-0 truncate font-semibold text-rank-foreground",
          emphasis ? "text-lead" : "text-small",
        )}
      >
        {label}
      </span>
      <span
        data-numeric
        className={cn(
          "relative z-10 mr-3 ml-auto shrink-0 font-display font-bold tabular-nums text-rank-foreground",
          emphasis ? "text-lead" : "text-small",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** Maps the game's colour name onto the meter tone. */
export function toneFromRankColor(color: "green" | "yellow" | "red"): MeterTone {
  if (color === "green") return "near";
  if (color === "yellow") return "mid";
  return "far";
}
