"use client";

import type { TileColor } from "@/lib/wordle-types";

const SMALL_COLOR_MAP: Record<TileColor, string> = {
  GREEN: "bg-tile-correct",
  YELLOW: "bg-tile-present",
  GRAY: "bg-tile-absent",
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
      <div className="mb-1 text-micro font-semibold text-muted-foreground">{nickname}</div>
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-0.5">
          {Array.from({ length: 5 }, (_, ci) => (
            <div
              key={ci}
              className={`w-5 h-5 sm:w-6 sm:h-6 rounded-sm ${
                row ? `${SMALL_COLOR_MAP[row[ci]]} animate-wordle-fade-in` : "bg-muted"
              }`}
            />
          ))}
        </div>
      ))}
      {solved && <div className="mt-1 text-micro font-semibold text-success-ink">Gelöst!</div>}
    </div>
  );
}
