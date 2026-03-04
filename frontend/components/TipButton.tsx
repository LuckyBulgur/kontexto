"use client";
import { Difficulty } from "@/lib/types";

interface TipButtonProps { onTip: () => void; disabled?: boolean; difficulty: Difficulty; onDifficultyChange: (d: Difficulty) => void; tipCount: number; }

export default function TipButton({ onTip, disabled, difficulty, onDifficultyChange, tipCount }: TipButtonProps) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={onTip} disabled={disabled}
        className="flex items-center gap-1 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-medium text-sm transition-colors">
        <span>Tipp</span>
        {tipCount > 0 && <span className="bg-amber-700 rounded-full px-1.5 text-xs">{tipCount}</span>}
      </button>
      <select value={difficulty} onChange={(e) => onDifficultyChange(e.target.value as Difficulty)}
        className="px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm">
        <option value="easy">Einfach</option>
        <option value="medium">Mittel</option>
        <option value="hard">Schwer</option>
      </select>
    </div>
  );
}
