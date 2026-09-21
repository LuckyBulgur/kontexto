import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A number with a name.
 *
 * The site counts a lot of things: guesses, tips, game number, streak, lives,
 * seconds left, players in a lobby. Each place used to invent its own markup,
 * typically `Label: value` at one size with an all-caps label. That reads as a
 * settings screen, not as a scoreboard.
 *
 * Here the value is the loud part: display face, tabular figures, so a counter
 * that changes in place never shifts the row. The label stays quiet and in
 * sentence case. All-caps labels are a template tell and are not used.
 */

export type StatSize = "sm" | "md" | "lg";

/**
 * Two orders, and the difference is not taste.
 *
 * `row`: label above value, left aligned. Used where several counters sit side
 * by side and the reader scans the labels to find the one they want.
 * `tile`: value above label, centred, on a quiet fill. Used in a grid, where
 * the numbers are the content and the labels only name them.
 *
 * Both existed before as two components with two looks and no stated reason.
 * They are one component now, and this is the reason.
 */
export type StatLayout = "row" | "tile";

const VALUE_SIZE: Record<StatSize, string> = {
  sm: "text-lead",
  md: "text-h2",
  lg: "text-display",
};

export interface StatProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** A short qualifier after the value, e.g. a unit. Stays at label weight. */
  unit?: React.ReactNode;
  size?: StatSize;
  /** Dims the whole pair for a counter that is currently irrelevant. */
  muted?: boolean;
  layout?: StatLayout;
  className?: string;
}

export function Stat({
  label,
  value,
  unit,
  size = "sm",
  muted,
  layout = "row",
  className,
}: StatProps) {
  const tile = layout === "tile";
  const name = (
    <span
      // German compounds are long and a tile is narrow: "Loesungsquote" has no
      // break opportunity of its own and was painting under the next tile.
      // `hyphens-auto` with a language gives it one, `break-words` is the
      // fallback for a word even hyphenation cannot place.
      lang={tile ? "de" : undefined}
      className={cn(
        "text-micro",
        tile ? "leading-tight hyphens-auto break-words" : "truncate",
        muted ? "text-muted-foreground/70" : "text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
  const figure = (
    <span
      className={cn(
        "flex items-baseline gap-1 font-display font-bold tabular-nums",
        tile ? "justify-center leading-none" : "",
        VALUE_SIZE[tile ? "md" : size],
        muted && "text-muted-foreground",
      )}
    >
      <span data-numeric>{value}</span>
      {unit ? (
        <span className="text-micro font-sans font-medium text-muted-foreground">{unit}</span>
      ) : null}
    </span>
  );

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col",
        tile ? "gap-1 rounded-xl bg-muted px-2 py-3 text-center" : "gap-0.5",
        className,
      )}
    >
      {tile ? figure : name}
      {tile ? name : figure}
    </div>
  );
}

export interface StatRowProps extends React.ComponentProps<"div"> {
  /** Spreads the stats across the full width instead of packing them left. */
  spread?: boolean;
}

/**
 * A row of Stats separated by hairlines. Hairlines and not middots: a middot
 * chain is template chrome, a rule is the same separation doing real work at a
 * smaller visual cost.
 */
export function StatRow({ spread, className, children, ...props }: StatRowProps) {
  return (
    <div
      className={cn(
        "flex items-stretch divide-x divide-border [&>*]:px-4 [&>*:first-child]:pl-0 [&>*:last-child]:pr-0",
        spread && "justify-between [&>*]:flex-1",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
