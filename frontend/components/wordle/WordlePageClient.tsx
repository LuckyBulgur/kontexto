"use client";

import { useState, useCallback, useEffect } from "react";
import WordleGame from "@/components/wordle/WordleGame";
import StatsModal from "@/components/wordle/StatsModal";
import HelpModal from "@/components/wordle/HelpModal";
import SettingsModal from "@/components/wordle/SettingsModal";
import WordleHeader from "@/components/wordle/WordleHeader";
import { loadHardMode, saveHardMode, loadWordleState } from "@/lib/wordle-storage";
import { loadTheme, saveTheme } from "@/lib/storage";
import { getWordleGame } from "@/lib/wordle-api";
import type { TileColor } from "@/lib/wordle-types";

export default function WordlePageClient() {
  const [showStats, setShowStats] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [hardMode, setHardMode] = useState(loadHardMode());
  const [roundMode, setRoundMode] = useState<"daily" | "random">("daily");
  const [randomSeed, setRandomSeed] = useState<number | null>(null);
  const [roundKey, setRoundKey] = useState(0);

  const startRandomRound = useCallback(() => {
    setRoundMode("random");
    setRandomSeed(Math.floor(Math.random() * 5000) + 1);
    setRoundKey((k) => k + 1);
  }, []);

  const backToDaily = useCallback(() => {
    setRoundMode("daily");
    setRandomSeed(null);
    setRoundKey((k) => k + 1);
  }, []);

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
    <div className="max-w-lg mx-auto min-h-screen flex flex-col">
      <WordleHeader
        onHelp={() => setShowHelp(true)}
        onRandom={startRandomRound}
        onStats={() => setShowStats(true)}
        onSettings={() => setShowSettings(true)}
        subtitle={
          roundMode === "random" ? (
            <span className="flex items-center justify-center gap-2">
              Zufallsspiel #{randomSeed}
              <button
                onClick={backToDaily}
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                Zum Tagesspiel
              </button>
            </span>
          ) : undefined
        }
      />

      <WordleGame
        key={roundKey}
        mode={roundMode}
        gameNumber={randomSeed}
        onGameEnd={handleGameEnd}
      />

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
