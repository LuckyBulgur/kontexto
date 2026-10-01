"use client";
import type { ReactNode } from "react";
import { getRankColor, getBarWidth } from "@/lib/types";
import { Meter, toneFromRankColor } from "@/components/design";

interface GuessBarProps {
  word: string;
  rank: number;
  isNew?: boolean;
  size?: "default" | "lg";
  /** Who played this word, where the mode shows that. A string is set in
   *  brackets; a node (the stream chat's name with logo and badges) as is. */
  by?: ReactNode;
}

/**
 * One row of the guess list. The game-specific part is only the arithmetic;
 * the bar itself is the shared `Meter`, so arena, duel, koop and the solo modes
 * draw the same object with the same contrast guarantees.
 *
 * Every rank is its own number, so a row never needs a qualifier. Until
 * 2026-09-22 a guess outside the counted list was shown the number of the word
 * ahead of it, which put two different words on one rank and made this row
 * write the number with a preceding "about". The scale carries every guessable
 * word now, so the mark is gone with the collision it described.
 */
export default function GuessBar({
  word,
  rank,
  isNew,
  size = "default",
  by,
}: GuessBarProps) {
  return (
    <Meter
      label={word}
      value={rank}
      meta={by}
      fraction={getBarWidth(rank)}
      tone={toneFromRankColor(getRankColor(rank))}
      isNew={isNew}
      highlight={isNew}
      emphasis={size === "lg"}
      className="mb-1"
    />
  );
}
