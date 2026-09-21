"use client";

import { useEffect, useState } from "react";
import type { TileColor } from "@/lib/wordle-types";

// Wordle keeps its own colour grammar: a tile answers "is this letter in the
// word", not "how close is this guess". Separate tokens from the rank ramp, so
// tuning one never silently moves the other. Both modes come from the tokens,
// which also retires the two hard-coded NYT hexes that used to sit here.
const COLOR_MAP: Record<TileColor, string> = {
  GREEN: "bg-tile-correct border-tile-correct text-tile-foreground",
  YELLOW: "bg-tile-present border-tile-present text-tile-foreground",
  GRAY: "bg-tile-absent border-tile-absent text-tile-foreground",
};

interface TileProps {
  letter: string;
  color?: TileColor;
  /** Delay in ms before flip animation starts */
  flipDelay?: number;
  /** Whether to play the pop animation on letter entry */
  pop?: boolean;
  /** Whether to play the bounce animation on win */
  bounce?: boolean;
  bounceDelay?: number;
}

export default function Tile({ letter, color, flipDelay = 0, pop = false, bounce = false, bounceDelay = 0 }: TileProps) {
  // If color is already set on mount, show immediately (e.g. loaded from saved state)
  const [mountedWithColor] = useState(() => !!color);
  const [flipped, setFlipped] = useState(mountedWithColor);
  const [showColor, setShowColor] = useState(mountedWithColor);

  useEffect(() => {
    if (!color || mountedWithColor) return;
    const flipTimer = setTimeout(() => setFlipped(true), flipDelay);
    const colorTimer = setTimeout(() => setShowColor(true), flipDelay + 250);
    return () => {
      clearTimeout(flipTimer);
      clearTimeout(colorTimer);
    };
  }, [color, flipDelay, mountedWithColor]);

  const baseClasses = "aspect-square w-full border-2 flex items-center justify-center text-h2 font-bold uppercase select-none";

  const stateClasses = showColor && color
    ? COLOR_MAP[color]
    : letter
      ? "border-muted-foreground/60 text-foreground"
      : "border-border";

  const animationClasses = [
    pop && !color ? "animate-wordle-pop" : "",
    flipped ? "animate-wordle-flip" : "",
    bounce ? "animate-wordle-bounce" : "",
  ].filter(Boolean).join(" ");

  const bounceStyle = bounce ? { animationDelay: `${bounceDelay}ms` } : undefined;

  return (
    <div
      className={`${baseClasses} ${stateClasses} ${animationClasses} transition-colors`}
      style={bounceStyle}
    >
      {letter}
    </div>
  );
}
