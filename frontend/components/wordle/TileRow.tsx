"use client";

import type { TileColor } from "@/lib/wordle-types";
import Tile from "./Tile";

interface TileRowProps {
  letters: string[];       // 0-5 letters
  colors?: TileColor[];    // undefined if not yet evaluated
  shake?: boolean;
  bounce?: boolean;
  flipDelay?: number;      // base delay for flip stagger (row-level offset)
  pop?: boolean;           // pop the last typed letter
}

export default function TileRow({ letters, colors, shake = false, bounce = false, flipDelay = 0, pop = false }: TileRowProps) {
  const tiles = Array.from({ length: 5 }, (_, i) => ({
    letter: letters[i] || "",
    color: colors?.[i],
  }));

  return (
    <div className={`grid w-full grid-cols-5 gap-1.5 ${shake ? "animate-wordle-shake" : ""}`}>
      {tiles.map((tile, i) => (
        <Tile
          key={i}
          letter={tile.letter}
          color={tile.color}
          flipDelay={flipDelay + i * 300}
          pop={pop && i === letters.length - 1 && !tile.color}
          bounce={bounce}
          bounceDelay={i * 100}
        />
      ))}
    </div>
  );
}
