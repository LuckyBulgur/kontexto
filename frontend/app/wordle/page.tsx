"use client";

import { useState, useCallback, useEffect } from "react";
import WordleGame from "@/components/wordle/WordleGame";
import StatsModal from "@/components/wordle/StatsModal";
import HelpModal from "@/components/wordle/HelpModal";
import SettingsModal from "@/components/wordle/SettingsModal";
import { loadHardMode, saveHardMode, loadWordleState } from "@/lib/wordle-storage";
import { loadTheme, saveTheme } from "@/lib/storage";
import { getWordleGame } from "@/lib/wordle-api";
import { BarChart3, CircleHelp, Settings, Swords } from "lucide-react";
import type { TileColor } from "@/lib/wordle-types";
import Link from "next/link";

export default function WordlePage() {
  const [showStats, setShowStats] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [hardMode, setHardMode] = useState(loadHardMode());

  useEffect(() => {
    const t = loadTheme();
    setTheme(t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, []);

  const handleThemeChange = useCallback((t: "light" | "dark") => {
    setTheme(t);
    saveTheme(t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, []);
  const [gameData, setGameData] = useState<{
    gameNumber: number;
    guesses: string[];
    evaluations: TileColor[][];
    won: boolean;
  } | null>(null);

  const handleGameEnd = useCallback((won: boolean, guessCount: number) => {
    // Reload state from storage to get final state
    getWordleGame().then(({ game_number }) => {
      const saved = loadWordleState(game_number);
      if (saved) {
        setGameData({
          gameNumber: game_number,
          guesses: saved.guesses,
          evaluations: saved.evaluations,
          won,
        });
        setTimeout(() => setShowStats(true), 2500);
      }
    });
  }, []);

  const handleHardModeChange = useCallback((enabled: boolean) => {
    setHardMode(enabled);
    saveHardMode(enabled);
  }, []);

  // Can only toggle hard mode before any guesses
  const canToggleHardMode = !gameData || gameData.guesses.length === 0;

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHelp(true)} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
            <CircleHelp className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-1 text-lg font-bold tracking-wider">
          <Link href="/" className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">KONTEXTO</Link>
          <span className="text-zinc-300 dark:text-zinc-600">|</span>
          <span>W&#214;RDLE</span>
        </div>
        <div className="flex items-center gap-1">
          <Link href="/wordle/duel/create" className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
            <Swords className="w-5 h-5" />
          </Link>
          <button onClick={() => setShowStats(true)} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
            <BarChart3 className="w-5 h-5" />
          </button>
          <button onClick={() => setShowSettings(true)} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <WordleGame onGameEnd={handleGameEnd} />

      <StatsModal
        open={showStats}
        onOpenChange={setShowStats}
        gameNumber={gameData?.gameNumber ?? 0}
        guesses={gameData?.guesses ?? []}
        evaluations={gameData?.evaluations ?? []}
        won={gameData?.won ?? false}
        hardMode={hardMode}
      />
      <HelpModal open={showHelp} onOpenChange={setShowHelp} />
      <SettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
        theme={theme}
        onThemeChange={handleThemeChange}
        hardMode={hardMode}
        onHardModeChange={handleHardModeChange}
        canToggleHardMode={canToggleHardMode}
      />
    </div>
  );
}
