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
  className?: string;
}

export function Stat({
  label,
  value,
  unit,
  size = "sm",
  muted,
  className,
}: StatProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      <span
        className={cn(
          "truncate text-micro",
          muted ? "text-muted-foreground/70" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "flex items-baseline gap-1 font-display font-bold tabular-nums",
          VALUE_SIZE[size],
          muted && "text-muted-foreground",
        )}
      >
        <span data-numeric>{value}</span>
        {unit ? (
          <span className="text-micro font-sans font-medium text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </span>
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
