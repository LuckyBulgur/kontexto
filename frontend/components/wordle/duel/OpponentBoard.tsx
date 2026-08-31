"use client";

import type { TileColor } from "@/lib/wordle-types";

const SMALL_COLOR_MAP: Record<TileColor, string> = {
  GREEN: "bg-green-600",
  YELLOW: "bg-yellow-500",
  GRAY: "bg-zinc-500 dark:bg-zinc-600",
};

interface OpponentBoardProps {
  guesses: TileColor[][]; // Array of color arrays (no letters!)
  nickname: string;
  solved: boolean;
}

export default function OpponentBoard({ guesses, nickname, solved }: OpponentBoardProps) {
  const rows = Array.from({ length: 6 }, (_, i) => guesses[i] || null);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-xs font-semibold text-zinc-500 mb-1">{nickname}</div>
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-0.5">
          {Array.from({ length: 5 }, (_, ci) => (
            <div
              key={ci}
              className={`w-5 h-5 sm:w-6 sm:h-6 rounded-sm ${
                row ? `${SMALL_COLOR_MAP[row[ci]]} animate-wordle-fade-in` : "bg-zinc-200 dark:bg-zinc-700"
              }`}
            />
          ))}
        </div>
      ))}
      {solved && <div className="text-xs text-green-700 font-semibold mt-1">Gelöst!</div>}
    </div>
  );
}
