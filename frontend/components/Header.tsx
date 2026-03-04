"use client";
import ThemeToggle from "./ThemeToggle";

interface HeaderProps { gameNumber: number; theme: "light" | "dark"; onThemeToggle: () => void; }

export default function Header({ gameNumber, theme, onThemeToggle }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
      <h1 className="text-xl font-bold tracking-wider text-gray-900 dark:text-white">KONTEXTO</h1>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">#{gameNumber}</span>
        <ThemeToggle theme={theme} onToggle={onThemeToggle} />
      </div>
    </header>
  );
}
