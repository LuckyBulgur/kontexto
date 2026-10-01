"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import GuessInput from "@/components/GuessInput";
import GuessList, { type PodestError } from "@/components/GuessList";
import GuessSuggestions from "@/components/GuessSuggestions";
import GameSkeleton from "@/components/GameSkeleton";
import SettingsModal from "@/components/SettingsModal";
import HowToPlayDialog from "@/components/HowToPlayDialog";
import GiveUpDialog from "@/components/GiveUpDialog";
import { AdUnit } from "@/components/AdUnit";
import CategorySetupPanel from "@/components/solo/CategorySetupPanel";
import DualGuessBar from "@/components/solo/DualGuessBar";
import SoloResultCard from "@/components/solo/SoloResultCard";
import SoloRulesCard from "@/components/solo/SoloRulesCard";
import SoloStatus from "@/components/solo/SoloStatus";
import { AD_SLOTS } from "@/lib/adsense";
import { fireConfetti } from "@/lib/confetti";
import { onEventGiveUp, onEventGuess } from "@/lib/events/hooks";
import { UnknownWordError } from "@/lib/guess-error";
import { refusalText } from "@/lib/quips";
import { useQuips } from "@/lib/use-quips";
import { reportCompletion } from "@/lib/analytics";
import {
  getDualNext,
  getInfiniteGame,
  getSuddenDeath,
  getTip,
  getWordAtRank,
  revealAnswer,
  submitDualGuess,
  submitGuess,
} from "@/lib/api";
import { CategorySetup, DEFAULT_CATEGORY_SETUP, saveCategorySetup } from "@/lib/categories";
import {
  LEITER_START_RANK,
  SOLO_MODES,
  SoloModeId,
  SoloState,
  categoryApplyGuess,
  categoryApplyTip,
  categoryGiveUp,
  categoryPlayedAfter,
  createCategoryRoundState,
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
 * The shell shared by all five solo modes.
 *
 * The daily game lives in GameClient and carries the daily/archive/endless
 * triple; threading four more rule sets through it would make both harder to
 * change. The rules themselves are pure functions in lib/solo-modes.ts, so this
 * component only loads a round, feeds guesses into the engine and renders.
 *
 * Kategorien is the one mode with a step before the round: the player picks the
 * fields first, and every next round keeps that choice until it is changed. It
 * is also the one solo mode with tips and a give-up, because its rules are the
 * normal game's, only the draw is narrowed.
 */
export default function SoloModeClient({ mode }: SoloModeClientProps) {
  const meta = SOLO_MODES[mode];

  const [state, setState] = useState<SoloState | null>(null);
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { enabled: quips } = useQuips();
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
  const [showGiveUp, setShowGiveUp] = useState(false);

  // Kategorien only: the setup step is open, and the choice and history it
  // returns to. The history survives a change of fields, so a game played under
  // the old choice is not dealt again under the new one.
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupDraft, setSetupDraft] = useState<CategorySetup | undefined>();
  const playedRef = useRef<number[]>([]);

  // Guards the once-per-round completion beacon against firing again for a round
  // that was already finished when the page was reopened.
  const reportedRef = useRef<string | null>(null);

  // The input clears on submit, so a second word can leave while the first is
  // still on its way. Every answer is applied to the newest round state, not to
  // the one its closure saw, or two quick guesses overwrite each other; commit()
  // advances the ref at once so the next answer in the same tick builds on it.
  const stateRef = useRef<SoloState | null>(null);
  const inFlightRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const commit = useCallback((next: SoloState | null) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const startRound = useCallback(async (
    setup: CategorySetup = DEFAULT_CATEGORY_SETUP,
    played: number[] = []
  ): Promise<SoloState> => {
    switch (mode) {
      case "categories": {
        const next = await getInfiniteGame(played, null, setup.categories);
        return createCategoryRoundState(next.gameNumber, next.category ?? null, setup, played);
      }
      case "leiter": {
        const next = await getInfiniteGame([]);
        // The opening rank is clamped to the scale. 5000 is the right distance
        // against the production scale of some 56.000 counted words, but a
        // smaller one (the e2e dataset, a future trimmed build) has no such
        // rank, and the round would fail to start for a reason the player
        // cannot act on. The server answers with the first everyday word at or
        // beyond it, so the rank the round starts on is the one it returns.
        const startRank = Math.min(LEITER_START_RANK, Math.max(2, next.total - 1));
        const start = await getWordAtRank(startRank, next.gameNumber);
        return createLeiterState(next.gameNumber, start.word, start.rank);
      }
      case "limit": {
        const next = await getInfiniteGame([]);
        return createLimitState(next.gameNumber);
      }
      case "doppel": {
        const next = await getDualNext([]);
        return createDoppelState(next.gameNumbers);
      }
      case "suddendeath": {
        const round = await getSuddenDeath([]);
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
      commit(resumed);
      setLoading(false);
      return;
    }

    // Kategorien asks before it deals: no round until the fields are chosen.
    if (mode === "categories") {
      setSetupOpen(true);
      setLoading(false);
      return;
    }

    startRound()
      .then((fresh) => {
        if (cancelled) return;
        commit(fresh);
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
  }, [mode, startRound, commit]);

  useEffect(() => {
    if (state) saveSoloState(state);
  }, [state]);

  const revealSolutions = useCallback(async (finished: SoloState) => {
    // A round given up already fetched its answer; asking again would count a
    // second reveal for one round.
    if (finished.mode === "categories" && finished.revealed) {
      setSolution(finished.revealed);
      return;
    }
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

    if (state.status === "won") {
      fireConfetti();
    }

    const durationSeconds = state.startedAt
      ? Math.max(0, Math.round((Date.now() - state.startedAt) / 1000))
      : 0;
    reportCompletion({
      mode,
      game_number: primaryGame(state),
      outcome: state.status === "won" ? "solved" : "gaveup",
      guesses: Math.max(1, soloGuessCount(state)),
      tips: state.mode === "categories" ? state.tips : 0,
      duration_seconds: durationSeconds,
      best_rank: soloBestRank(state),
    });

    void revealSolutions(state);
    // revealSolutions and mode are stable for the lifetime of a round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, mode]);

  const handleGuess = useCallback(
    async (raw: string) => {
      const sent = stateRef.current;
      if (!sent || sent.status !== "running") return;
      setError(null);
      setPodestError(undefined);

      const word = raw.trim().toLowerCase();
      if (inFlightRef.current.has(word) || alreadyGuessed(sent, word)) {
        setPodestError({ word, message: refusalText("refusalDuplicate", quips, word) });
        return;
      }
      // Sudden Death has one attempt: a second word before the first is answered
      // would be a second attempt.
      if (sent.mode === "suddendeath" && inFlightRef.current.size > 0) return;

      // The answer belongs to the round it was sent in. A round that ended or was
      // replaced meanwhile drops it.
      const current = (): SoloState | null => {
        const now = stateRef.current;
        if (!now || now.status !== "running" || now.mode !== sent.mode) return null;
        return primaryGame(now) === primaryGame(sent) ? now : null;
      };

      inFlightRef.current.add(word);
      setPendingWord(word);
      try {
        if (sent.mode === "doppel") {
          const result = await submitDualGuess(word, sent.gameNumbers, sent.guesses.length === 0);
          const now = current();
          if (!now || now.mode !== "doppel") return;
          if (alreadyGuessed(now, result.word)) {
            setPodestError({ word: result.word, message: refusalText("refusalDuplicate", quips, result.word) });
            return;
          }
          setLatestWord(result.word);
          onEventGuess({ word: result.word, rank: Math.min(...result.ranks.map((r) => r.rank)) });
          commit(doppelApplyGuess(now, {
            word: result.word,
            ranks: result.ranks.map((r) => r.rank),
            correctedFrom: result.corrected_from ?? undefined,
          }));
          return;
        }

        const result = await submitGuess(
          word,
          primaryGame(sent),
          true,
          soloGuessCount(sent) === 0,
          sent.mode
        );
        const now = current();
        if (!now) return;
        if (alreadyGuessed(now, result.word)) {
          setPodestError({ word: result.word, message: refusalText("refusalDuplicate", quips, result.word) });
          return;
        }
        setLatestWord(result.word);
        onEventGuess({ word: result.word, rank: result.rank });

        if (now.mode === "leiter") {
          const { state: next, struck } = leiterApplyGuess(now, result);
          if (struck && next.status === "running") {
            setPodestError({
              word: result.word,
              message: `Nicht näher dran als Rang ${now.bestRank}. Fehlversuch.`,
            });
          }
          commit(next);
        } else if (now.mode === "limit") {
          commit(limitApplyGuess(now, result));
        } else if (now.mode === "categories") {
          commit(categoryApplyGuess(now, result));
        } else if (now.mode === "suddendeath") {
          commit(suddenDeathApplyGuess(now, result));
        }
      } catch (e: unknown) {
        if (e instanceof UnknownWordError) {
          setPodestError({
            word,
            message: refusalText("refusalUnknown", quips, word),
            suggestions: e.suggestions,
          });
        } else if (e instanceof Error && e.message === "stopword") {
          setPodestError({ word, message: refusalText("refusalStopword", quips, word) });
        } else {
          setError("Fehler bei der Verbindung");
        }
      } finally {
        inFlightRef.current.delete(word);
        setPendingWord(undefined);
      }
    },
    [quips, commit]
  );

  const beginRound = useCallback(async (setup?: CategorySetup, played: number[] = []) => {
    setRestarting(true);
    setError(null);
    setSolution(null);
    setSecondSolution(null);
    setLatestWord(undefined);
    setPodestError(undefined);
    clearSoloState(mode);
    try {
      const fresh = await startRound(setup, played);
      reportedRef.current = null;
      commit(fresh);
      saveSoloState(fresh);
      setSetupOpen(false);
    } catch {
      setError("Neue Runde konnte nicht geladen werden");
    } finally {
      setRestarting(false);
    }
  }, [mode, startRound, commit]);

  const handleRestart = useCallback(() => {
    if (state?.mode === "categories") {
      void beginRound(state.setup, categoryPlayedAfter(state));
      return;
    }
    void beginRound();
  }, [beginRound, state]);

  const handleSetupStart = useCallback((setup: CategorySetup) => {
    saveCategorySetup(setup);
    void beginRound(setup, playedRef.current);
  }, [beginRound]);

  const handleChangeSetup = useCallback(() => {
    if (state?.mode !== "categories") return;
    playedRef.current = categoryPlayedAfter(state);
    setSetupDraft(state.setup);
    clearSoloState(mode);
    commit(null);
    setError(null);
    setSetupOpen(true);
  }, [mode, state, commit]);

  const handleTip = useCallback(async () => {
    if (state?.mode !== "categories" || state.status !== "running") return;
    setError(null);
    const ranks = state.guesses.map((g) => g.rank);
    const bestRank = ranks.length > 0 ? Math.min(...ranks) : 10000;
    try {
      const tip = await getTip(difficulty, bestRank, state.gameNumber, ranks, true, "categories");
      const now = stateRef.current;
      if (now?.mode !== "categories" || now.status !== "running" || now.gameNumber !== state.gameNumber) return;
      setLatestWord(tip.word);
      commit(categoryApplyTip(now, tip));
    } catch {
      setError("Tipp konnte nicht geladen werden");
    }
  }, [difficulty, state, commit]);

  const handleGiveUp = useCallback(async () => {
    setShowGiveUp(false);
    if (state?.mode !== "categories" || state.status !== "running") return;
    try {
      const revealed = await revealAnswer(state.gameNumber, true, "categories");
      const now = stateRef.current;
      if (now?.mode !== "categories" || now.status !== "running" || now.gameNumber !== state.gameNumber) return;
      onEventGiveUp();
      commit(categoryGiveUp(now, revealed.word));
    } catch {
      setError("Lösungswort konnte nicht geladen werden");
    }
  }, [state, commit]);

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

  const dialogs = (
    <>
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        theme={theme}
        onThemeChange={handleThemeChange}
        difficulty={difficulty}
        onDifficultyChange={handleDifficultyChange}
        sortMode={sortMode}
        onSortModeChange={handleSortModeChange}
        showQuips
      />
      <HowToPlayDialog open={showHowToPlay} onClose={() => setShowHowToPlay(false)} />
    </>
  );

  if (loading) {
    return <GameSkeleton />;
  }

  if (setupOpen || !state) {
    if (mode !== "categories") return <GameSkeleton />;
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
          <CategorySetupPanel
            mode={meta}
            initial={setupDraft}
            onStart={handleSetupStart}
            starting={restarting}
            error={error}
          />
          <SoloRulesCard mode={meta} />
        </div>
        {dialogs}
      </div>
    );
  }

  const over = state.status !== "running";
  const playsNormally = state.mode === "categories";

  return (
    <div className="max-w-lg mx-auto min-h-screen flex flex-col">
      <Header
        onTip={handleTip}
        onGiveUp={() => setShowGiveUp(true)}
        onHowToPlayOpen={() => setShowHowToPlay(true)}
        onSettingsOpen={() => setShowSettings(true)}
        onPastGamesOpen={() => {}}
        hideTip={!playsNormally}
        hideGiveUp={!playsNormally}
        tipDisabled={over}
        giveUpDisabled={over}
        hidePastGames
        subtitle={`Modus: ${meta.name}`}
        backOpensModes
      />

      <div className="flex-1 px-4 py-4 flex flex-col gap-4">
        {over ? (
          <>
            <SoloResultCard
              quips={quips}
              mode={meta}
              state={state}
              solution={solution}
              secondSolution={secondSolution}
              onRestart={handleRestart}
              restarting={restarting}
              onChangeSetup={state.mode === "categories" ? handleChangeSetup : undefined}
            />
            {error && (
              <p role="alert" className="text-small text-destructive">
                {error}
              </p>
            )}
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
              latestWord={latestWord}
              pendingWord={pendingWord}
              podestError={podestError}
              onSuggestion={handleGuess}
              sortMode={sortMode}
            />
          ) : (
            <GuessList
              guesses={[]}
              pendingWord={pendingWord}
              podestError={podestError}
              onSuggestion={handleGuess}
              sortMode={sortMode}
            />
          )
        ) : (
          <GuessList
            guesses={state.guesses}
            latestWord={latestWord}
            pendingWord={pendingWord}
            podestError={podestError}
            onSuggestion={handleGuess}
            sortMode={sortMode}
          />
        )}
      </div>

      {dialogs}
      {playsNormally && (
        <GiveUpDialog
          open={showGiveUp}
          onClose={() => setShowGiveUp(false)}
          onConfirm={handleGiveUp}
          description="Bist du sicher? Das Lösungswort wird angezeigt, danach geht es mit der nächsten Runde weiter."
        />
      )}
    </div>
  );
}

function DoppelBoard({
  guesses,
  latestWord,
  pendingWord,
  podestError,
  onSuggestion,
  sortMode,
}: {
  guesses: DoppelGuess[];
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
