"use client";

import { useEffect, useState, useCallback } from "react";
import Header from "@/components/Header";
import GuessInput from "@/components/GuessInput";
import GuessList from "@/components/GuessList";
import SettingsModal from "@/components/SettingsModal";
import WinDialog from "@/components/WinDialog";
import { submitGuess, getTip, getGameInfo } from "@/lib/api";
import { loadGameState, saveGameState, loadTheme, saveTheme, loadDifficulty, saveDifficulty } from "@/lib/storage";
import { GameState, Guess, Difficulty } from "@/lib/types";

export default function Home() {
  const [gameNumber, setGameNumber] = useState(0);
  const [total, setTotal] = useState(0);
  const [gameState, setGameState] = useState<GameState>({ gameNumber: 0, guesses: [], tips: 0, solved: false });
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [error, setError] = useState<string | null>(null);
  const [latestWord, setLatestWord] = useState<string | undefined>();
  const [showWin, setShowWin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initTheme = loadTheme();
    setTheme(initTheme);
    document.documentElement.classList.toggle("dark", initTheme === "dark");
    setDifficulty(loadDifficulty() as Difficulty);

    getGameInfo()
      .then((info) => {
        setGameNumber(info.gameNumber);
        setTotal(info.total);
        const saved = loadGameState(info.gameNumber);
        setGameState(saved);
        if (saved.solved) setShowWin(true);
        setLoading(false);
      })
      .catch(() => {
        setError("Verbindung zum Server fehlgeschlagen.");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (gameState.gameNumber > 0) saveGameState(gameState);
  }, [gameState]);

  const handleThemeChange = useCallback((t: "light" | "dark") => {
    setTheme(t);
    saveTheme(t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, []);

  const handleDifficultyChange = useCallback((d: Difficulty) => {
    setDifficulty(d);
    saveDifficulty(d);
  }, []);

  const addGuess = useCallback((guess: Guess) => {
    setGameState((prev) => ({
      ...prev,
      guesses: [...prev.guesses, guess],
      solved: prev.solved || guess.rank === 1,
    }));
    setLatestWord(guess.word);
    if (guess.rank === 1) setTimeout(() => setShowWin(true), 500);
  }, []);

  const handleGuess = useCallback(async (word: string) => {
    setError(null);
    if (gameState.guesses.some((g) => g.word === word.toLowerCase())) {
      setError("Wort bereits geraten!");
      return;
    }
    try {
      const result = await submitGuess(word);
      addGuess({ word: result.word, rank: result.rank, isTip: false });
      setTotal(result.total);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "unknown_word") {
        setError("Wort nicht im W\u00f6rterbuch");
      } else {
        setError("Fehler bei der Verbindung");
      }
    }
  }, [gameState.guesses, addGuess]);

  const handleTip = useCallback(async () => {
    setError(null);
    const bestRank = gameState.guesses.length > 0
      ? Math.min(...gameState.guesses.map((g) => g.rank))
      : 10000;
    try {
      const result = await getTip(difficulty, bestRank);
      if (gameState.guesses.some((g) => g.word === result.word)) return;
      setGameState((prev) => ({ ...prev, tips: prev.tips + 1 }));
      addGuess({ word: result.word, rank: result.rank, isTip: true });
      setTotal((prev) => prev || result.rank);
    } catch {
      setError("Tipp konnte nicht geladen werden");
    }
  }, [gameState.guesses, difficulty, addGuess]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="text-muted-foreground text-lg">Laden...</div></div>;
  }

  return (
    <div className="max-w-lg mx-auto min-h-screen flex flex-col">
      <Header onTip={handleTip} tipDisabled={gameState.solved} onSettingsOpen={() => setShowSettings(true)} />
      <main className="flex-1 px-4 py-4 flex flex-col gap-4">
        <div className="flex items-center gap-4 pt-2 pb-2 text-[12px] font-medium text-muted-foreground uppercase tracking-wide">
          <span>Spiel: <span className="text-[18px] font-bold">#{gameNumber}</span></span>
          <span>Versuche: <span className="text-[18px] font-bold">{gameState.guesses.length}</span></span>
          <span>Tipps: <span className="text-[18px] font-bold">{gameState.tips}</span></span>
        </div>
        <GuessInput onGuess={handleGuess} disabled={gameState.solved} error={error} />
        <GuessList guesses={gameState.guesses} total={total} latestWord={latestWord} />
      </main>
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} theme={theme} onThemeChange={handleThemeChange} difficulty={difficulty} onDifficultyChange={handleDifficultyChange} />
      {showWin && <WinDialog gameNumber={gameNumber} guesses={gameState.guesses} tipCount={gameState.tips} onClose={() => setShowWin(false)} />}
    </div>
  );
}
