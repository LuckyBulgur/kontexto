"use client";
import { getRankColor, getBarWidth } from "@/lib/types";
import { cn } from "@/lib/utils";

interface GuessBarProps {
  word: string;
  rank: number;
  total: number;
  isNew?: boolean;
}

const COLOR_CLASSES = {
  green: "bg-green-500 dark:bg-green-700",
  yellow: "bg-amber-500 dark:bg-amber-700",
  red: "bg-red-500 dark:bg-red-700",
};

export default function GuessBar({ word, rank, total, isNew }: GuessBarProps) {
  const color = getRankColor(rank);
  const width = getBarWidth(rank, total);
  return (
    <div className={cn("relative flex items-center h-10 rounded-lg overflow-hidden mb-1 transition-all", isNew && "animate-slideIn")}>
      <div
        className={cn("absolute inset-y-0 left-0 rounded-lg transition-all duration-500", COLOR_CLASSES[color])}
        style={{ width: `${width}%` }}
      />
      <span className="relative z-10 ml-3 font-medium text-white text-sm">{word}</span>
      <span className="relative z-10 ml-auto mr-3 font-mono text-white text-sm font-bold">{rank}</span>
    </div>
  );
}
