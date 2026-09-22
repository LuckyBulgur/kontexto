"use client";
import { getRankColor, getBarWidth } from "@/lib/types";
import { Meter, toneFromRankColor } from "@/components/design";

interface GuessBarProps {
  word: string;
  rank: number;
  total: number;
  isNew?: boolean;
  size?: "default" | "lg";
  /** Who played this word, where the mode shows that. */
  by?: string;
  /** False when the word holds no place on the counted scale. Undefined counts
   *  as true, which is what an older server and every demo row send. */
  counted?: boolean;
}

/**
 * One row of the guess list. The game-specific part is only the arithmetic;
 * the bar itself is the shared `Meter`, so arena, duel, koop and the solo modes
 * draw the same object with the same contrast guarantees.
 *
 * A rank the scale does not actually hold is written with a preceding "about".
 * 64.483 of the 80.000 guessable words are not core words and share the number
 * of the core word they stand behind, so without the mark two rows read as a
 * tie that is not one: on the day the solution was the verb "melden", the rows
 * for "kontaktieren" and "meldet" both said 3. The first one is rank 3, the
 * second stands between 2 and 3 and is not counted at all.
 */
export default function GuessBar({
  word,
  rank,
  total,
  isNew,
  size = "default",
  by,
  counted,
}: GuessBarProps) {
  const approximate = counted === false;
  return (
    <Meter
      label={word}
      value={
        approximate ? (
          <span title="Dieses Wort zählt nicht zur Rangliste, es steht kurz hinter diesem Rang.">
            <span aria-hidden="true">{"≈"}</span>
            <span className="sr-only">{"ungefähr "}</span>
            {rank}
          </span>
        ) : (
          rank
        )
      }
      meta={by}
      fraction={getBarWidth(rank, total)}
      tone={toneFromRankColor(getRankColor(rank))}
      isNew={isNew}
      highlight={isNew}
      emphasis={size === "lg"}
      className="mb-1"
    />
  );
}
