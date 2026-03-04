"use client";
import { Difficulty } from "@/lib/types";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  theme: "light" | "dark";
  onThemeToggle: () => void;
  difficulty: Difficulty;
  onDifficultyChange: (d: Difficulty) => void;
}

const difficultyOptions: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Einfach" },
  { value: "medium", label: "Mittel" },
  { value: "hard", label: "Schwer" },
];

export default function SettingsModal({ open, onClose, theme, onThemeToggle, difficulty, onDifficultyChange }: SettingsModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5">Einstellungen</h2>

        <div className="mb-5">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Design</p>
          <div className="flex gap-2">
            <button
              onClick={() => { if (theme === "dark") onThemeToggle(); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                theme === "light"
                  ? "bg-emerald-500 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              Hell
            </button>
            <button
              onClick={() => { if (theme === "light") onThemeToggle(); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                theme === "dark"
                  ? "bg-emerald-500 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              Dunkel
            </button>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Schwierigkeitsgrad (Tipps)</p>
          <div className="flex gap-2">
            {difficultyOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onDifficultyChange(opt.value)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  difficulty === opt.value
                    ? "bg-emerald-500 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
