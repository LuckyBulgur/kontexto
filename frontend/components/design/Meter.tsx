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
 * posted elsewhere.
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
  /** The row that just arrived. Plays one entrance and holds a focus ring. */
  isNew?: boolean;
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
  emphasis,
  className,
  ...rest
}: MeterProps) {
  return (
    <div
      className={cn(
        "relative flex items-center overflow-hidden rounded-lg bg-rank-track",
        emphasis ? "h-12" : "h-10",
        isNew && "animate-slideIn ring-2 ring-ring ring-offset-1 ring-offset-background",
        className,
      )}
      {...rest}
    >
      <div
        className={cn("absolute inset-y-0 left-0 transition-[width] duration-500 ease-out", FILL[tone])}
        style={{ width: `${Math.min(100, Math.max(0, fraction))}%` }}
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
