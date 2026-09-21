"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import GuessInput from "@/components/GuessInput";
import GuessList, { type PodestError } from "@/components/GuessList";
import GuessSuggestions from "@/components/GuessSuggestions";
import GameSkeleton from "@/components/GameSkeleton";
import SettingsModal from "@/components/SettingsModal";
import HowToPlayDialog from "@/components/HowToPlayDialog";
import { AdUnit } from "@/components/AdUnit";
import DualGuessBar from "@/components/solo/DualGuessBar";
import SoloResultCard from "@/components/solo/SoloResultCard";
import SoloRulesCard from "@/components/solo/SoloRulesCard";
import SoloStatus from "@/components/solo/SoloStatus";
import { AD_SLOTS } from "@/lib/adsense";
import { fireConfetti } from "@/lib/confetti";
import { UnknownWordError } from "@/lib/guess-error";
import { reportCompletion } from "@/lib/analytics";
import {
  getDualNext,
  getInfiniteGame,
  getSuddenDeath,
  getWordAtRank,
  revealAnswer,
  submitDualGuess,
  submitGuess,
} from "@/lib/api";
import {
  LEITER_START_RANK,
  SOLO_MODES,
  SoloModeId,
  SoloState,
  createDoppelState,
  createLeiterState,
  createLimitState,
  createSuddenDeathState,
  DoppelGuess,
  doppelApplyGuess,
  leiterApplyGuess,
  limitApplyGuess,
  soloBestRank,
  soloGuessCount,
  suddenDeathApplyGuess,
} from "@/lib/solo-modes";
import {
  clearSoloState,
  loadDifficulty,
  loadSoloState,
  loadSortMode,
  loadTheme,
  saveDifficulty,
  saveSoloState,
  saveSortMode,
  saveTheme,
} from "@/lib/storage";
import { Difficulty, SortMode } from "@/lib/types";
import { Panel } from "@/components/design";

interface SoloModeClientProps {
  mode: SoloModeId;
}

/**
 * The shell shared by all four solo modes.
 *
 * The daily game lives in GameClient and carries the daily/archive/endless
 * triple; threading four more rule sets through it would make both harder to
 * change. The rules themselves are pure functions in lib/solo-modes.ts, so this
 * component only loads a round, feeds guesses into the engine and renders.
 */
export default function SoloModeClient({ mode }: SoloModeClientProps) {
  const meta = SOLO_MODES[mode];

  const [state, setState] = useState<SoloState | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestWord, setLatestWord] = useState<string | undefined>();
  const [pendingWord, setPendingWord] = useState<string | undefined>();
  const [podestError, setPodestError] = useState<PodestError | undefined>();
  const [solution, setSolution] = useState<string | null>(null);
  const [secondSolution, setSecondSolution] = useState<string | null>(null);

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [sortMode, setSortMode] = useState<SortMode>("rank");
  const [showSettings, setShowSettings] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  // Guards the once-per-round completion beacon against firing again for a round
  // that was already finished when the page was reopened.
  const reportedRef = useRef<string | null>(null);

  const startRound = useCallback(async (): Promise<SoloState> => {
    switch (mode) {
      case "leiter": {
        const next = await getInfiniteGame([]);
        setTotal(next.total);
        // The opening rank is clamped to the vocabulary. 5000 is the right
        // distance against the production vocabulary of 80.000 words, but a
        // smaller one (the e2e dataset, a future trimmed build) has no such
        // rank, and the round would fail to start for a reason the player
        // cannot act on.
        const startRank = Math.min(LEITER_START_RANK, Math.max(2, next.total - 1));
        const start = await getWordAtRank(startRank, next.gameNumber);
        return createLeiterState(next.gameNumber, start.word, start.rank);
      }
      case "limit": {
        const next = await getInfiniteGame([]);
        setTotal(next.total);
        return createLimitState(next.gameNumber);
      }
      case "doppel": {
        const next = await getDualNext([]);
        setTotal(next.total);
        return createDoppelState(next.gameNumbers);
      }
      case "suddendeath": {
        const round = await getSuddenDeath([]);
        setTotal(round.total);
        return createSuddenDeathState(round.gameNumber, round.hints);
      }
    }
  }, [mode]);

  useEffect(() => {
    const initTheme = loadTheme();
    setTheme(initTheme);
    document.documentElement.classList.toggle("dark", initTheme === "dark");
    setDifficulty(loadDifficulty() as Difficulty);
    setSortMode(loadSortMode());
  }, []);

  useEffect(() => {
    let cancelled = false;

    const resumed = loadSoloState(mode);
    if (resumed) {
      // A finished round is restored as finished, and its beacon is marked as
      // already sent so reopening the page cannot inflate the statistics.
      if (resumed.status !== "running") reportedRef.current = roundKey(resumed);
      setState(resumed);
      setLoading(false);
      return;
    }

    startRound()
      .then((fresh) => {
        if (cancelled) return;
        setState(fresh);
        saveSoloState(fresh);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Verbindung zum Server fehlgeschlagen.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, startRound]);

  useEffect(() => {
    if (state) saveSoloState(state);
  }, [state]);

  const revealSolutions = useCallback(async (finished: SoloState) => {
    try {
      if (finished.mode === "doppel") {
        const [a, b] = finished.gameNumbers;
        const [first, second] = await Promise.all([
          revealAnswer(a, true, "doppel"),
          revealAnswer(b, true, "doppel"),
        ]);
        setSolution(first.word);
        setSecondSolution(second.word);
        return;
      }
      // A won round already knows the answer: it is the guess that hit rank 1.
      // Only a lost round has to ask the server, which is also the only case
      // that should count as a reveal.
      if (finished.status === "won") {
        const hit =
          finished.mode === "suddendeath"
            ? finished.attempt
            : finished.guesses.find((g) => g.rank === 1);
        if (hit) {
          setSolution(hit.word);
          return;
        }
      }
      const revealed = await revealAnswer(primaryGame(finished), true, finished.mode);
      setSolution(revealed.word);
    } catch {
      // The round is over either way; a missing word is a smaller problem than
      // an error banner over the result.
      setSolution(null);
    }
  }, []);

  // Reveal what the round was about, and report it once. Both only happen after
  // the engine has declared the round over, never while it is still running.
  useEffect(() => {
    if (!state || state.status === "running") return;
    const key = roundKey(state);
    if (reportedRef.current === key) return;
    reportedRef.current = key;

    if (state.status === "won") fireConfetti();

    const durationSeconds = state.startedAt
      ? Math.max(0, Math.round((Date.now() - state.startedAt) / 1000))
      : 0;
    reportCompletion({
      mode,
      game_number: primaryGame(state),
      outcome: state.status === "won" ? "solved" : "gaveup",
      guesses: Math.max(1, soloGuessCount(state)),
      tips: 0,
      duration_seconds: durationSeconds,
      best_rank: soloBestRank(state),
    });

    void revealSolutions(state);
    // revealSolutions and mode are stable for the lifetime of a round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, mode]);

  const handleGuess = useCallback(
    async (raw: string) => {
      if (!state || state.status !== "running") return;
      setError(null);
      setPodestError(undefined);

      const word = raw.trim().toLowerCase();
      if (alreadyGuessed(state, word)) {
        setPodestError({ word, message: "Wort bereits geraten" });
        return;
      }

      setPendingWord(word);
      try {
        if (state.mode === "doppel") {
          const result = await submitDualGuess(word, state.gameNumbers, state.guesses.length === 0);
          if (alreadyGuessed(state, result.word)) {
            setPodestError({ word: result.word, message: "Wort bereits geraten" });
            return;
          }
          setTotal(result.total);
          setLatestWord(result.word);
          setState(doppelApplyGuess(state, {
            word: result.word,
            ranks: result.ranks.map((r) => r.rank),
            correctedFrom: result.corrected_from ?? undefined,
          }));
          return;
        }

        const result = await submitGuess(
          word,
          primaryGame(state),
          true,
          soloGuessCount(state) === 0,
          state.mode
        );
        if (alreadyGuessed(state, result.word)) {
          setPodestError({ word: result.word, message: "Wort bereits geraten" });
          return;
        }
        setTotal(result.total);
        setLatestWord(result.word);

        if (state.mode === "leiter") {
          const { state: next, struck } = leiterApplyGuess(state, result);
          if (struck && next.status === "running") {
            setPodestError({
              word: result.word,
              message: `Nicht näher dran als Rang ${state.bestRank}. Fehlversuch.`,
            });
          }
          setState(next);
        } else if (state.mode === "limit") {
          setState(limitApplyGuess(state, result));
        } else {
          setState(suddenDeathApplyGuess(state, result));
        }
      } catch (e: unknown) {
        if (e instanceof UnknownWordError) {
          setPodestError({
            word,
            message: "Dieses Wort kenne ich leider nicht",
            suggestions: e.suggestions,
          });
        } else if (e instanceof Error && e.message === "stopword") {
          setPodestError({ word, message: "Dieses Wort zählt nicht, es ist zu allgemein" });
        } else {
          setError("Fehler bei der Verbindung");
        }
      } finally {
        setPendingWord(undefined);
      }
    },
    [state]
  );

  const handleRestart = useCallback(async () => {
    setRestarting(true);
    setError(null);
    setSolution(null);
    setSecondSolution(null);
    setLatestWord(undefined);
    setPodestError(undefined);
    clearSoloState(mode);
    try {
      const fresh = await startRound();
      reportedRef.current = null;
      setState(fresh);
      saveSoloState(fresh);
    } catch {
      setError("Neue Runde konnte nicht geladen werden");
    } finally {
      setRestarting(false);
    }
  }, [mode, startRound]);

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

  if (loading || !state) {
    return <GameSkeleton />;
  }

  const over = state.status !== "running";

  return (
    <div className="max-w-lg mx-auto min-h-screen flex flex-col">
      <Header
        onTip={() => {}}
        onGiveUp={() => {}}
        onHowToPlayOpen={() => setShowHowToPlay(true)}
        onSettingsOpen={() => setShowSettings(true)}
        onPastGamesOpen={() => {}}
        hideTip
        hideGiveUp
        hidePastGames
        subtitle={`Modus: ${meta.name}`}
        backOpensModes
      />

      <div className="flex-1 px-4 py-4 flex flex-col gap-4">
        {over ? (
          <>
            <SoloResultCard
              mode={meta}
              state={state}
              solution={solution}
              secondSolution={secondSolution}
              onRestart={handleRestart}
              restarting={restarting}
            />
            <AdUnit slot={AD_SLOTS.kontextoResult} className="mt-2" />
          </>
        ) : (
          <>
            <SoloStatus state={state} />
            <GuessInput
              onGuess={handleGuess}
              disabled={over}
              error={error}
              placeholder={inputPlaceholder(state)}
            />
            {state.mode === "suddendeath" && (
              <Panel padding="sm" className="gap-2">
                <h2 className="text-small font-semibold">{"Die nächsten Nachbarn"}</h2>
                <ol className="space-y-1">
                  {state.hints.map((hint) => (
                    <li key={hint.word} className="flex items-baseline justify-between text-small">
                      <span className="font-medium">{hint.word}</span>
                      <span className="tabular-nums text-muted-foreground">Rang {hint.rank}</span>
                    </li>
                  ))}
                </ol>
              </Panel>
            )}
            {soloGuessCount(state) === 0 && <SoloRulesCard mode={meta} />}
          </>
        )}

        {state.mode === "doppel" ? (
          <DoppelBoard
            guesses={state.guesses}
            total={total}
            latestWord={latestWord}
            pendingWord={pendingWord}
            podestError={podestError}
            onSuggestion={handleGuess}
            sortMode={sortMode}
          />
        ) : state.mode === "suddendeath" ? (
          state.attempt ? (
            <GuessList
              guesses={[{ ...state.attempt, isTip: false }]}
              total={total}
              latestWord={latestWord}
              pendingWord={pendingWord}
              podestError={podestError}
              onSuggestion={handleGuess}
              sortMode={sortMode}
            />
          ) : (
            <GuessList
              guesses={[]}
              total={total}
              pendingWord={pendingWord}
              podestError={podestError}
              onSuggestion={handleGuess}
              sortMode={sortMode}
            />
          )
        ) : (
          <GuessList
            guesses={state.guesses}
            total={total}
            latestWord={latestWord}
            pendingWord={pendingWord}
            podestError={podestError}
            onSuggestion={handleGuess}
            sortMode={sortMode}
          />
        )}
      </div>

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        theme={theme}
        onThemeChange={handleThemeChange}
        difficulty={difficulty}
        onDifficultyChange={handleDifficultyChange}
        sortMode={sortMode}
        onSortModeChange={handleSortModeChange}
      />
      <HowToPlayDialog open={showHowToPlay} onClose={() => setShowHowToPlay(false)} />
    </div>
  );
}

function DoppelBoard({
  guesses,
  total,
  latestWord,
  pendingWord,
  podestError,
  onSuggestion,
  sortMode,
}: {
  guesses: DoppelGuess[];
  total: number;
  latestWord?: string;
  pendingWord?: string;
  podestError?: PodestError;
  onSuggestion: (word: string) => void;
  sortMode: SortMode;
}) {
  // Sorted by the better of the two ranks: with two targets there is no single
  // distance, and the nearer one is what the player is chasing.
  const sorted =
    sortMode === "rank"
      ? [...guesses].sort((a, b) => Math.min(...a.ranks) - Math.min(...b.ranks))
      : [...guesses];
  const latest = latestWord ? guesses.find((g) => g.word === latestWord) : undefined;

  return (
    <div className="space-y-0.5">
      {(pendingWord || podestError || latest?.correctedFrom) && (
        <div className="mt-[9px] mb-[25px]">
          {pendingWord ? (
            <p className="text-small text-foreground animate-pulse">{"Lädt..."}</p>
          ) : podestError ? (
            <>
              <p className="text-small text-foreground font-medium">{podestError.message}</p>
              <GuessSuggestions suggestions={podestError.suggestions} onSuggestion={onSuggestion} />
            </>
          ) : (
            <p className="text-small text-muted-foreground">
              {`„${latest?.correctedFrom}“ wurde als „${latest?.word}“ gewertet`}
            </p>
          )}
        </div>
      )}
      {sorted.map((guess, i) => (
        <DualGuessBar
          key={`${guess.word}-${i}`}
          word={guess.word}
          ranks={guess.ranks}
          total={total}
          isNew={guess.word === latestWord}
        />
      ))}
    </div>
  );
}

/** A stable identity for one round, so the completion beacon fires once. */
function roundKey(state: SoloState): string {
  return state.mode === "doppel"
    ? `doppel:${state.gameNumbers.join("-")}`
    : `${state.mode}:${state.gameNumber}`;
}

/** The game a round reports against. Doppelziel reports its first target. */
function primaryGame(state: SoloState): number {
  return state.mode === "doppel" ? state.gameNumbers[0] : state.gameNumber;
}

function alreadyGuessed(state: SoloState, word: string): boolean {
  if (state.mode === "suddendeath") return state.attempt?.word === word;
  return state.guesses.some((g) => g.word === word);
}

function inputPlaceholder(state: SoloState): string {
  switch (state.mode) {
    case "leiter":
      return `Besser als Rang ${state.bestRank}`;
    case "suddendeath":
      return "Dein einziger Versuch";
    default:
      return state.guesses.length === 0 ? "Gib dein erstes Wort ein!" : "Wort eingeben...";
  }
}
