import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The standings under a multiplayer result.
 *
 * Duel, koop and the three arenas each grew their own version of the same row,
 * with the place, the name and the numbers at three different weights per file.
 * One row type, so a player who has seen one scoreboard can read the next.
 */

export interface ResultRowProps {
  /** Finishing place. Omit where the list is not a ranking (koop). */
  place?: number | null;
  name: React.ReactNode;
  /** True for the row belonging to the person reading. */
  you?: boolean;
  /** The right-hand side: a rank, a count, a short state. */
  detail: React.ReactNode;
  /** Lifts the winning row without colouring it. */
  lead?: boolean;
}

export function ResultRow({ place, name, you, detail, lead }: ResultRowProps) {
  return (
    <li
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg px-3 py-2.5",
        lead ? "bg-accent text-accent-foreground" : "bg-muted",
      )}
    >
      <span className="flex min-w-0 items-baseline gap-2">
        {place != null && (
          <span
            data-numeric
            className="font-display text-small font-bold text-muted-foreground"
          >
            {place}.
          </span>
        )}
        <span className="truncate text-small font-semibold">{name}</span>
        {you && <span className="shrink-0 text-micro text-muted-foreground">du</span>}
      </span>
      <span className="shrink-0 text-micro text-muted-foreground">{detail}</span>
    </li>
  );
}

export function ResultList({ className, ...props }: React.ComponentProps<"ol">) {
  return <ol className={cn("flex flex-col gap-1.5", className)} {...props} />;
}
