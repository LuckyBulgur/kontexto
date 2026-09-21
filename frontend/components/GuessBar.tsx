"use client";
import { getRankColor, getBarWidth } from "@/lib/types";
import { Meter, toneFromRankColor } from "@/components/design";

interface GuessBarProps {
  word: string;
  rank: number;
  total: number;
  isNew?: boolean;
  size?: "default" | "lg";
}

/**
 * One row of the guess list. The game-specific part is only the arithmetic;
 * the bar itself is the shared `Meter`, so arena, duel, koop and the solo modes
 * draw the same object with the same contrast guarantees.
 */
export default function GuessBar({ word, rank, total, isNew, size = "default" }: GuessBarProps) {
  return (
    <Meter
      label={word}
      value={rank}
      fraction={getBarWidth(rank, total)}
      tone={toneFromRankColor(getRankColor(rank))}
      isNew={isNew}
      emphasis={size === "lg"}
      className="mb-1"
    />
  );
}
