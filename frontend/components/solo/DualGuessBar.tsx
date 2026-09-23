"use client";
import { getRankColor, getBarWidth } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DualGuessBarProps {
  word: string;
  /** One rank per target, in the order of the round's game numbers. */
  ranks: number[];
  isNew?: boolean;
}

const COLOR_CLASSES = {
  green: "bg-rank-near",
  yellow: "bg-rank-mid",
  red: "bg-rank-far",
};

/**
 * A Doppelziel row: one word, two bars. Two stacked GuessBars would read as two
 * separate guesses, which is exactly the wrong mental model here. The word is
 * written once and the bars sit next to each other so the two distances can be
 * compared at a glance.
 */
export default function DualGuessBar({ word, ranks, isNew }: DualGuessBarProps) {
  return (
    <div className={cn("mb-1 rounded-lg bg-black/5 dark:bg-white/10", isNew && "animate-slideIn ring-2 ring-white")}>
      <div className="px-3 pt-1.5 pb-1 text-small font-bold text-foreground dark:text-white">{word}</div>
      <div className="flex gap-1 px-1.5 pb-1.5">
        {ranks.map((rank, i) => (
          <div key={i} className="relative flex h-7 flex-1 items-center rounded-md bg-black/5 dark:bg-white/10">
            <div
              className={cn("absolute inset-y-0 left-0 rounded-md transition-[width] duration-500", COLOR_CLASSES[getRankColor(rank)])}
              style={{ width: `${getBarWidth(rank)}%` }}
            />
            <span className="relative z-10 ml-2 text-micro font-semibold text-rank-foreground">
              Ziel {i + 1}
            </span>
            <span className="relative z-10 ml-auto mr-2 font-display text-micro font-bold tabular-nums text-rank-foreground">
              {rank}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
