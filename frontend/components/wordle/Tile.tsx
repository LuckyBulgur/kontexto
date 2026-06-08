"use client";

import { useEffect, useState } from "react";
import type { TileColor } from "@/lib/wordle-types";

const COLOR_MAP: Record<TileColor, string> = {
  GREEN: "bg-green-600 border-green-600 text-white dark:bg-[#538d4e] dark:border-[#538d4e]",
  YELLOW: "bg-yellow-500 border-yellow-500 text-white dark:bg-[#b59f3b] dark:border-[#b59f3b]",
  GRAY: "bg-zinc-500 border-zinc-500 text-white dark:bg-zinc-600 dark:border-zinc-600",
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

  const baseClasses = "aspect-square w-full border-2 flex items-center justify-center text-2xl font-bold uppercase select-none";

  const stateClasses = showColor && color
    ? COLOR_MAP[color]
    : letter
      ? "border-zinc-400 dark:border-zinc-500 text-zinc-800 dark:text-zinc-100"
      : "border-zinc-300 dark:border-zinc-700";

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
