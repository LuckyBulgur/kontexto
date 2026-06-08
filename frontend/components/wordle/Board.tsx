"use client";

import { useRef, useEffect } from "react";
import type { TileColor } from "@/lib/wordle-types";
import TileRow from "./TileRow";

interface BoardProps {
  guesses: string[];
  evaluations: TileColor[][];
  currentGuess: string;
  currentRow: number;
  shakeRow?: number | null;
  wonRow?: number | null;
}

export default function Board({ guesses, evaluations, currentGuess, currentRow, shakeRow, wonRow }: BoardProps) {
  const prevLengthRef = useRef(0);
  const isAdding = currentGuess.length > prevLengthRef.current;
  useEffect(() => { prevLengthRef.current = currentGuess.length; }, [currentGuess]);
  const rows = Array.from({ length: 6 }, (_, i) => {
    if (i < guesses.length) {
      // Submitted row
      return {
        letters: [...guesses[i]],
        colors: evaluations[i],
        shake: false,
        bounce: wonRow === i,
        pop: false,
      };
    }
    if (i === currentRow) {
      // Current input row
      return {
        letters: [...currentGuess],
        colors: undefined,
        shake: shakeRow === i,
        bounce: false,
        pop: isAdding,
      };
    }
    // Empty row
    return { letters: [], colors: undefined, shake: false, bounce: false, pop: false };
  });

  return (
    <div className="mx-auto flex w-full max-w-[21rem] flex-col items-center gap-1.5 py-4">
      {rows.map((row, i) => (
        <TileRow
          key={i}
          letters={row.letters}
          colors={row.colors}
          shake={row.shake}
          bounce={row.bounce}
          pop={row.pop}
        />
      ))}
    </div>
  );
}
