"use client";

import { useEffect, useState, useCallback } from "react";
import confetti from "canvas-confetti";

function fireConfetti() {
  const duration = 3000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) return clearInterval(interval);

    const particleCount = 50 * (timeLeft / duration);
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
    });
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
    });
  }, 250);
}
import Header from "@/components/Header";
import GuessInput from "@/components/GuessInput";
import GuessList from "@/components/GuessList";
import SettingsModal from "@/components/SettingsModal";
import HowToPlayDialog from "@/components/HowToPlayDialog";
import FAQDialog, { faqs } from "@/components/FAQDialog";
import CreditsDialog from "@/components/CreditsDialog";
import GiveUpDialog from "@/components/GiveUpDialog";
import PastGamesDialog from "@/components/PastGamesDialog";
import GameResultCard from "@/components/GameResultCard";
import ClosestWordsDialog from "@/components/ClosestWordsDialog";
import { submitGuess, getTip, getGameInfo, revealAnswer } from "@/lib/api";
import { loadGameState, saveGameState, loadTheme, saveTheme, loadDifficulty, saveDifficulty, loadSortMode, saveSortMode, recordGamePlayed } from "@/lib/storage";
import { GameState, Guess, Difficulty, SortMode } from "@/lib/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function Home() {
  const [gameNumber, setGameNumber] = useState(0);
  const [total, setTotal] = useState(0);
  const [gameState, setGameState] = useState<GameState>({ gameNumber: 0, guesses: [], tips: 0, solved: false });
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [sortMode, setSortMode] = useState<SortMode>("rank");
  const [error, setError] = useState<string | null>(null);
  const [latestWord, setLatestWord] = useState<string | undefined>();
  const [pendingWord, setPendingWord] = useState<string | undefined>();
  const [podestError, setPodestError] = useState<{ word: string; message: string } | undefined>();
  const [showResult, setShowResult] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [showGiveUp, setShowGiveUp] = useState(false);
  const [showPastGames, setShowPastGames] = useState(false);
  const [showClosestWords, setShowClosestWords] = useState(false);
  const [pastGame, setPastGame] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initTheme = loadTheme();
    setTheme(initTheme);
    document.documentElement.classList.toggle("dark", initTheme === "dark");
    setDifficulty(loadDifficulty() as Difficulty);
    setSortMode(loadSortMode());

    getGameInfo()
      .then((info) => {
        setGameNumber(info.gameNumber);
        setTotal(info.total);
        const saved = loadGameState(info.gameNumber);
        setGameState(saved);
        if (saved.solved || saved.givenUp) setShowResult(true);
        if (saved.solved && !saved.givenUp) setTimeout(fireConfetti, 300);
        setLoading(false);
      })
      .catch(() => {
        setError("Verbindung zum Server fehlgeschlagen.");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (gameState.gameNumber > 0 && pastGame === null) saveGameState(gameState);
  }, [gameState, pastGame]);

  const handleThemeChange = useCallback((t: "light" | "dark") => {
    setTheme(t);
    saveTheme(t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, []);

  const handleDifficultyChange = useCallback((d: Difficulty) => {
    setDifficulty(d);
    saveDifficulty(d);
  }, []);

  const handleSortModeChange = useCallback((s: SortMode) => {
    setSortMode(s);
    saveSortMode(s);
  }, []);

  const addGuess = useCallback((guess: Guess) => {
    setGameState((prev) => ({
      ...prev,
      guesses: [...prev.guesses, guess],
      solved: prev.solved || guess.rank === 1,
    }));
    setLatestWord(guess.word);
    if (guess.rank === 1) {
      fireConfetti();
      if (pastGame === null) {
        recordGamePlayed(new Date().toISOString().slice(0, 10));
      }
      setTimeout(() => setShowResult(true), 500);
    }
  }, [pastGame]);

  const handleGuess = useCallback(async (word: string) => {
    setError(null);
    setPodestError(undefined);
    if (gameState.guesses.some((g) => g.word === word.toLowerCase())) {
      setPodestError({ word: word.toLowerCase(), message: "Wort bereits geraten!" });
      return;
    }
    setPendingWord(word.toLowerCase());
    try {
      const result = await submitGuess(word, pastGame);
      if (gameState.guesses.some((g) => g.word === result.word)) {
        setPodestError({ word: result.word, message: "Wort bereits geraten!" });
        return;
      }
      addGuess({ word: result.word, rank: result.rank, isTip: false });
      setTotal(result.total);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "unknown_word") {
        setPodestError({ word: word.toLowerCase(), message: "Dieses Wort kenne ich leider nicht" });
      } else if (e instanceof Error && e.message === "stopword") {
        setPodestError({ word: word.toLowerCase(), message: "Dieses Wort zählt nicht – es ist zu allgemein" });
      } else {
        setError("Fehler bei der Verbindung");
      }
    } finally {
      setPendingWord(undefined);
    }
  }, [gameState.guesses, addGuess, pastGame]);

  const handleTip = useCallback(async () => {
    setError(null);
    const bestRank = gameState.guesses.length > 0
      ? Math.min(...gameState.guesses.map((g) => g.rank))
      : 10000;
    const guessedRanks = gameState.guesses.map((g) => g.rank);
    try {
      const result = await getTip(difficulty, bestRank, pastGame, guessedRanks);
      if (gameState.guesses.some((g) => g.word === result.word)) return;
      setGameState((prev) => ({ ...prev, tips: prev.tips + 1 }));
      addGuess({ word: result.word, rank: result.rank, isTip: true });
      setTotal((prev) => prev || result.rank);
    } catch {
      setError("Tipp konnte nicht geladen werden");
    }
  }, [gameState.guesses, difficulty, addGuess, pastGame]);

  const handleGiveUp = useCallback(async () => {
    setShowGiveUp(false);
    try {
      const result = await revealAnswer(pastGame);
      setGameState((prev) => ({
        ...prev,
        guesses: [...prev.guesses, { word: result.word, rank: 1, isTip: false }],
        givenUp: true,
      }));
      setLatestWord(result.word);
      if (pastGame === null) {
        recordGamePlayed(new Date().toISOString().slice(0, 10));
      }
      setTimeout(() => setShowResult(true), 500);
    } catch {
      setError("Lösungswort konnte nicht geladen werden");
    }
  }, [pastGame]);

  const handleSelectPastGame = useCallback((selectedGame: number) => {
    setPastGame(selectedGame);
    setGameNumber(selectedGame);
    setGameState({ gameNumber: selectedGame, guesses: [], tips: 0, solved: false });
    setError(null);
    setLatestWord(undefined);
    setShowResult(false);
  }, []);

  const handleBackToToday = useCallback(() => {
    setPastGame(null);
    getGameInfo().then((info) => {
      setGameNumber(info.gameNumber);
      setTotal(info.total);
      const saved = loadGameState(info.gameNumber);
      setGameState(saved);
      setError(null);
      setLatestWord(undefined);
      setShowResult(saved.solved || !!saved.givenUp);
    });
  }, []);

  const gameOver = gameState.solved || !!gameState.givenUp;
  const isWin = gameState.solved && !gameState.givenUp;

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="text-muted-foreground text-lg">Laden...</div></div>;
  }

  return (
    <div className="max-w-lg mx-auto min-h-screen flex flex-col">
      <Header
        onTip={handleTip}
        onGiveUp={() => setShowGiveUp(true)}
        onHowToPlayOpen={() => setShowHowToPlay(true)}
        onFAQOpen={() => setShowFAQ(true)}
        onSettingsOpen={() => setShowSettings(true)}
        onCreditsOpen={() => setShowCredits(true)}
        onPastGamesOpen={() => setShowPastGames(true)}
        tipDisabled={gameOver}
        giveUpDisabled={gameOver}
        showCountdown={gameOver}
      />
      {pastGame !== null && (
        <button
          onClick={handleBackToToday}
          className="mx-4 mt-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
        >
          Du spielst Spiel #{pastGame} · Zurück zum heutigen Spiel
        </button>
      )}
      <main className="flex-1 px-4 py-4 flex flex-col gap-4">
        {gameOver && showResult ? (
          <GameResultCard
            gameNumber={gameNumber}
            guesses={gameState.guesses}
            tipCount={gameState.tips}
            isWin={isWin}
            onOpenPastGames={() => setShowPastGames(true)}
            onOpenClosestWords={() => setShowClosestWords(true)}
          />
        ) : (
          <>
            <div className="flex items-center gap-4 -mt-2 -mb-2 text-[12px] font-medium text-muted-foreground uppercase tracking-wide">
              <span>Spiel: <span className="text-[18px] font-bold">#{gameNumber}</span></span>
              <span>Versuche: <span className="text-[18px] font-bold">{gameState.guesses.length}</span></span>
              <span>Tipps: <span className="text-[18px] font-bold">{gameState.tips}</span></span>
            </div>
            <GuessInput onGuess={handleGuess} disabled={gameOver} error={error} placeholder={gameState.guesses.length === 0 ? "Gib dein erstes Wort ein!" : "Wort eingeben..."} />
            {gameState.guesses.length === 0 && !gameOver && !podestError && (
              <div className="rounded-xl border bg-card p-5 space-y-4 text-sm text-muted-foreground">
                <h3 className="text-base font-semibold text-foreground">Spielanleitung</h3>
                <p>
                  Finde das <strong className="text-foreground">geheime Wort</strong>! Gib ein beliebiges deutsches Wort ein und erfahre, wie nah es am Zielwort ist.
                </p>
                <div className="space-y-1">
                  <h4 className="font-medium text-foreground text-sm">Rang-System</h4>
                  <p>
                    Jedes Wort bekommt einen <strong className="text-foreground">Rang</strong> basierend auf seiner Bedeutungsähnlichkeit. Je niedriger der Rang, desto näher bist du dran.
                  </p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-medium text-foreground text-sm">Farben</h4>
                  <ul className="space-y-1 list-none">
                    <li><span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-2 align-middle" />Grün - sehr nah (Rang 1-300)</li>
                    <li><span className="inline-block w-3 h-3 rounded-full bg-yellow-500 mr-2 align-middle" />Gelb - auf dem richtigen Weg (Rang 301-1500)</li>
                    <li><span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-2 align-middle" />Rot - noch weit entfernt (Rang 1501+)</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <h4 className="font-medium text-foreground text-sm">Tipps</h4>
                  <p>Nutze das Menü, um dir einen Tipp geben zu lassen.</p>
                </div>
              </div>
            )}
            {gameState.guesses.length === 0 && !gameOver && !podestError && (
              <div className="rounded-xl border bg-card p-5 text-sm">
                <h3 className="text-base font-semibold text-foreground mb-2">Häufige Fragen</h3>
                <Accordion type="single" collapsible>
                  {faqs.map((faq, i) => (
                    <AccordionItem key={i} value={`faq-${i}`}>
                      <AccordionTrigger className="text-sm text-left">{faq.q}</AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground">{faq.a}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}
          </>
        )}
        <GuessList guesses={gameState.guesses} total={total} latestWord={latestWord} pendingWord={pendingWord} podestError={podestError} sortMode={sortMode} />
      </main>
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} theme={theme} onThemeChange={handleThemeChange} difficulty={difficulty} onDifficultyChange={handleDifficultyChange} sortMode={sortMode} onSortModeChange={handleSortModeChange} />
      <HowToPlayDialog open={showHowToPlay} onClose={() => setShowHowToPlay(false)} />
      <FAQDialog open={showFAQ} onClose={() => setShowFAQ(false)} />
      <CreditsDialog open={showCredits} onClose={() => setShowCredits(false)} />
      <GiveUpDialog open={showGiveUp} onClose={() => setShowGiveUp(false)} onConfirm={handleGiveUp} />
      <PastGamesDialog open={showPastGames} onClose={() => setShowPastGames(false)} onSelectGame={handleSelectPastGame} />
      <ClosestWordsDialog open={showClosestWords} onClose={() => setShowClosestWords(false)} pastGame={pastGame} />
    </div>
  );
}
