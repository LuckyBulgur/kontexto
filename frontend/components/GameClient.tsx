"use client";

import { useEffect, useState, useCallback, useRef } from "react";
async function fireConfetti() {
  const confetti = (await import("canvas-confetti")).default;
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
import DanielTribute from "@/components/DanielTribute";
import GuessInput from "@/components/GuessInput";
import GuessList from "@/components/GuessList";
import GameSkeleton from "@/components/GameSkeleton";
import SettingsModal from "@/components/SettingsModal";
import HowToPlayDialog from "@/components/HowToPlayDialog";
import FAQDialog from "@/components/FAQDialog";
import CreditsDialog from "@/components/CreditsDialog";
import GiveUpDialog from "@/components/GiveUpDialog";
import PastGamesDialog from "@/components/PastGamesDialog";
import GameResultCard from "@/components/GameResultCard";
import ClosestWordsDialog from "@/components/ClosestWordsDialog";
import StatsDialog from "@/components/StatsDialog";
import { AdUnit } from "@/components/AdUnit";
import { faqs } from "@/lib/faqs";
import { submitGuess, getTip, getGameInfo, revealAnswer, getInfiniteGame } from "@/lib/api";
import { loadGameState, saveGameState, loadTheme, saveTheme, loadDifficulty, saveDifficulty, loadSortMode, saveSortMode, recordGamePlayed, loadInfiniteSession, saveInfiniteSession } from "@/lib/storage";
import { updateKontextoStatsAfterGame } from "@/lib/kontexto-stats";
import { reportCompletion } from "@/lib/analytics";
import { AD_SLOTS } from "@/lib/adsense";
import { GameState, Guess, Difficulty, SortMode } from "@/lib/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function GameClient() {
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
  const [showStats, setShowStats] = useState(false);
  // Endless ("Unendlich") mode. Mutually exclusive with pastGame; when active the
  // game number comes from a random pool draw and guesses use the date-gate-free
  // infinite path. Session state lives under its own localStorage key.
  const [infinite, setInfinite] = useState(false);
  const [infinitePlayed, setInfinitePlayed] = useState<number[]>([]);
  const [infiniteSolved, setInfiniteSolved] = useState(0);
  const [infiniteTotalGames, setInfiniteTotalGames] = useState(0);
  const [noMoreGames, setNoMoreGames] = useState(false);
  // Guards the once-per-game stats/completion recording against re-running for a
  // game that was already finished in a previous session (loaded as over).
  const completedRef = useRef<number | null>(null);
  const infiniteCompletedRef = useRef<number | null>(null);

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
        // Treat an already-finished saved game as recorded so the completion
        // effect only fires on a fresh, in-session transition.
        completedRef.current = (saved.solved || saved.givenUp) ? saved.gameNumber : null;
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
    if (gameState.gameNumber > 0 && pastGame === null && !infinite) saveGameState(gameState);
  }, [gameState, pastGame, infinite]);

  // Persist the endless-mode session (current game + played pool + solved count)
  // on every change so a refresh resumes exactly where the player left off.
  useEffect(() => {
    if (!infinite || gameState.gameNumber <= 0) return;
    saveInfiniteSession({
      current: gameState,
      played: infinitePlayed,
      solvedCount: infiniteSolved,
      totalGames: infiniteTotalGames,
    });
  }, [infinite, gameState, infinitePlayed, infiniteSolved, infiniteTotalGames]);

  // Endless mode: report each completed game to the aggregate distribution
  // beacon (mode "infinite") and bump the session solve counter. Deliberately
  // does NOT touch the daily streak or local kontexto stats.
  useEffect(() => {
    if (!infinite || gameState.gameNumber <= 0) return;
    const over = gameState.solved || !!gameState.givenUp;
    if (!over || infiniteCompletedRef.current === gameState.gameNumber) return;
    infiniteCompletedRef.current = gameState.gameNumber;

    const won = gameState.solved && !gameState.givenUp;
    const userGuesses = gameState.guesses.filter((g) => !g.isTip);
    const allRanks = gameState.guesses.map((g) => g.rank);
    const bestRank = won
      ? 1
      : userGuesses.length
        ? Math.min(...userGuesses.map((g) => g.rank))
        : allRanks.length
          ? Math.min(...allRanks)
          : 10000;
    const durationSeconds = gameState.startedAt
      ? Math.max(0, Math.round((Date.now() - gameState.startedAt) / 1000))
      : 0;

    if (won) setInfiniteSolved((n) => n + 1);
    reportCompletion({
      mode: "infinite",
      game_number: gameState.gameNumber,
      outcome: won ? "solved" : "gaveup",
      guesses: gameState.guesses.length,
      tips: gameState.tips,
      duration_seconds: durationSeconds,
      best_rank: bestRank,
    });
  }, [gameState, infinite]);

  // Record local player stats + send the (anonymous, aggregate) completion beacon
  // exactly once, when today's game transitions to finished in this session.
  useEffect(() => {
    if (pastGame !== null || infinite || gameState.gameNumber <= 0) return;
    const over = gameState.solved || !!gameState.givenUp;
    if (!over || completedRef.current === gameState.gameNumber) return;
    completedRef.current = gameState.gameNumber;

    const won = gameState.solved && !gameState.givenUp;
    const guessCount = gameState.guesses.length;
    const userGuesses = gameState.guesses.filter((g) => !g.isTip);
    const allRanks = gameState.guesses.map((g) => g.rank);
    const bestRank = won
      ? 1
      : userGuesses.length
        ? Math.min(...userGuesses.map((g) => g.rank))
        : allRanks.length
          ? Math.min(...allRanks)
          : 10000;
    const durationSeconds = gameState.startedAt
      ? Math.max(0, Math.round((Date.now() - gameState.startedAt) / 1000))
      : 0;

    updateKontextoStatsAfterGame({ won, guessCount, tips: gameState.tips });
    reportCompletion({
      mode: "kontexto",
      game_number: gameState.gameNumber,
      outcome: won ? "solved" : "gaveup",
      guesses: guessCount,
      tips: gameState.tips,
      duration_seconds: durationSeconds,
      best_rank: bestRank,
    });
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
      startedAt: prev.startedAt ?? Date.now(),
    }));
    setLatestWord(guess.word);
    if (guess.rank === 1) {
      fireConfetti();
      if (pastGame === null && !infinite) {
        recordGamePlayed(new Date().toISOString().slice(0, 10));
      }
      setTimeout(() => setShowResult(true), 500);
    }
  }, [pastGame, infinite]);

  // The game number + flag to send to the API for the active mode.
  const apiGame = infinite ? gameNumber : pastGame;

  const handleGuess = useCallback(async (word: string) => {
    setError(null);
    setPodestError(undefined);
    if (gameState.guesses.some((g) => g.word === word.toLowerCase())) {
      setPodestError({ word: word.toLowerCase(), message: "Wort bereits geraten!" });
      return;
    }
    setPendingWord(word.toLowerCase());
    try {
      const result = await submitGuess(word, apiGame, infinite);
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
  }, [gameState.guesses, addGuess, apiGame, infinite]);

  const handleTip = useCallback(async () => {
    setError(null);
    const bestRank = gameState.guesses.length > 0
      ? Math.min(...gameState.guesses.map((g) => g.rank))
      : 10000;
    const guessedRanks = gameState.guesses.map((g) => g.rank);
    try {
      const result = await getTip(difficulty, bestRank, apiGame, guessedRanks, infinite);
      if (gameState.guesses.some((g) => g.word === result.word)) return;
      setGameState((prev) => ({ ...prev, tips: prev.tips + 1 }));
      addGuess({ word: result.word, rank: result.rank, isTip: true });
      setTotal((prev) => prev || result.rank);
    } catch {
      setError("Tipp konnte nicht geladen werden");
    }
  }, [gameState.guesses, difficulty, addGuess, apiGame, infinite]);

  const handleGiveUp = useCallback(async () => {
    setShowGiveUp(false);
    try {
      const result = await revealAnswer(apiGame, infinite);
      setGameState((prev) => ({
        ...prev,
        guesses: [...prev.guesses, { word: result.word, rank: 1, isTip: false }],
        givenUp: true,
      }));
      setLatestWord(result.word);
      if (pastGame === null && !infinite) {
        recordGamePlayed(new Date().toISOString().slice(0, 10));
      }
      setTimeout(() => setShowResult(true), 500);
    } catch {
      setError("Lösungswort konnte nicht geladen werden");
    }
  }, [apiGame, pastGame, infinite]);

  // Load the next random game for the endless session. `played` is the set of
  // games finished so far (sent so the backend avoids repeats), `solvedCount`
  // carries the running solve tally through to the persisted session.
  const loadNextInfinite = useCallback(async (played: number[], current: number | null, solvedCount: number) => {
    setNoMoreGames(false);
    setError(null);
    try {
      const next = await getInfiniteGame(played, current);
      const fresh: GameState = { gameNumber: next.gameNumber, guesses: [], tips: 0, solved: false };
      infiniteCompletedRef.current = null;
      setGameNumber(next.gameNumber);
      setTotal(next.total);
      setInfiniteTotalGames(next.totalGames);
      setGameState(fresh);
      setLatestWord(undefined);
      setPodestError(undefined);
      setShowResult(false);
      saveInfiniteSession({ current: fresh, played, solvedCount, totalGames: next.totalGames });
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "no_games") {
        setNoMoreGames(true);
        setShowResult(true);
      } else {
        setError("Nächstes Spiel konnte nicht geladen werden");
      }
    }
  }, []);

  const handleStartInfinite = useCallback(() => {
    setPastGame(null);
    setInfinite(true);
    setError(null);
    setLatestWord(undefined);
    setPodestError(undefined);
    setNoMoreGames(false);

    const session = loadInfiniteSession();
    if (session) {
      const over = session.current.solved || !!session.current.givenUp;
      setInfinitePlayed(session.played);
      setInfiniteSolved(session.solvedCount);
      setInfiniteTotalGames(session.totalGames);
      setGameNumber(session.current.gameNumber);
      setGameState(session.current);
      infiniteCompletedRef.current = over ? session.current.gameNumber : null;
      setShowResult(over);
    } else {
      setInfinitePlayed([]);
      setInfiniteSolved(0);
      loadNextInfinite([], null, 0);
    }
  }, [loadNextInfinite]);

  const handleNextInfinite = useCallback(() => {
    const finished = gameState.gameNumber;
    const nextPlayed = infinitePlayed.includes(finished) ? infinitePlayed : [...infinitePlayed, finished];
    setInfinitePlayed(nextPlayed);
    loadNextInfinite(nextPlayed, finished, infiniteSolved);
  }, [gameState.gameNumber, infinitePlayed, infiniteSolved, loadNextInfinite]);

  const handleSelectPastGame = useCallback((selectedGame: number) => {
    setInfinite(false);
    setNoMoreGames(false);
    setPastGame(selectedGame);
    setGameNumber(selectedGame);
    setGameState({ gameNumber: selectedGame, guesses: [], tips: 0, solved: false });
    setError(null);
    setLatestWord(undefined);
    setShowResult(false);
    completedRef.current = null;
  }, []);

  const handleBackToToday = useCallback(() => {
    setPastGame(null);
    setInfinite(false);
    setNoMoreGames(false);
    getGameInfo().then((info) => {
      setGameNumber(info.gameNumber);
      setTotal(info.total);
      const saved = loadGameState(info.gameNumber);
      setGameState(saved);
      completedRef.current = (saved.solved || saved.givenUp) ? saved.gameNumber : null;
      setError(null);
      setLatestWord(undefined);
      setShowResult(saved.solved || !!saved.givenUp);
    });
  }, []);

  const gameOver = gameState.solved || !!gameState.givenUp;
  const isWin = gameState.solved && !gameState.givenUp;

  // Both the loading skeleton and the game container share min-h-screen so
  // the "Laden…" → game swap doesn't cause a Cumulative Layout Shift (CLS).
  if (loading) {
    return <GameSkeleton />;
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
        onInfiniteStart={handleStartInfinite}
        onStatsOpen={() => setShowStats(true)}
        tipDisabled={gameOver}
        giveUpDisabled={gameOver}
        showCountdown={gameOver && !infinite}
      />
      {pastGame !== null && (
        <button
          onClick={handleBackToToday}
          className="mx-4 mt-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
        >
          Du spielst Spiel #{pastGame} · Zurück zum heutigen Spiel
        </button>
      )}
      {infinite && (
        <button
          onClick={handleBackToToday}
          className="mx-4 mt-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
        >
          Unendlich-Modus · {infiniteSolved} gelöst · Zurück zum heutigen Spiel
        </button>
      )}
      <main className="flex-1 px-4 py-4 flex flex-col gap-4">
        {gameOver && showResult ? (
          <>
            <GameResultCard
              gameNumber={gameNumber}
              guesses={gameState.guesses}
              tipCount={gameState.tips}
              isWin={isWin}
              onOpenPastGames={() => setShowPastGames(true)}
              onOpenClosestWords={() => setShowClosestWords(true)}
              infinite={infinite}
              onNextInfinite={handleNextInfinite}
              infiniteSolvedCount={infiniteSolved}
              noMoreGames={noMoreGames}
            />
            <AdUnit slot={AD_SLOTS.kontextoResult} className="mt-2" />
          </>
        ) : (
          <>
            <div className="flex items-center gap-4 -mt-2 -mb-2 text-[12px] font-medium text-muted-foreground uppercase tracking-wide">
              {infinite ? (
                <span>Modus: <span className="text-[18px] font-bold">Unendlich</span></span>
              ) : (
                <span>Spiel: <span className="text-[18px] font-bold">#{gameNumber}</span></span>
              )}
              <span>Versuche: <span className="text-[18px] font-bold">{gameState.guesses.length}</span></span>
              <span>Tipps: <span className="text-[18px] font-bold">{gameState.tips}</span></span>
              <DanielTribute className="ml-auto" />
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
      <ClosestWordsDialog open={showClosestWords} onClose={() => setShowClosestWords(false)} game={infinite ? gameNumber : pastGame} infinite={infinite} />
      <StatsDialog open={showStats} onClose={() => setShowStats(false)} />
    </div>
  );
}
