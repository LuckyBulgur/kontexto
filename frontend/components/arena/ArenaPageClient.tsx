"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import Header from "@/components/Header";
import GuessInput from "@/components/GuessInput";
import GuessList, { type PodestError } from "@/components/GuessList";
import HowToPlayDialog from "@/components/HowToPlayDialog";
import SettingsModal from "@/components/SettingsModal";
import DuelSkeleton from "@/components/duel/DuelSkeleton";
import JoinDialog from "@/components/duel/JoinDialog";
import ArenaLobby from "@/components/arena/ArenaLobby";
import ArenaPlayerBar from "@/components/arena/ArenaPlayerBar";
import ArenaResultCard from "@/components/arena/ArenaResultCard";
import {
  arenaNextGame,
  getArenaHistory,
  getArenaPlayerInfo,
  getArenaState,
  joinArena,
  revealArena,
  startArena,
  submitArenaGuess,
} from "@/lib/arena-api";
import { ArenaState, ArenaWsMessage } from "@/lib/arena-types";
import { useArenaWebSocket } from "@/lib/use-arena-websocket";
import { copyTextToClipboard } from "@/lib/clipboard";

import { UnknownWordError } from "@/lib/guess-error";
import { MULTIPLAYER_MODES } from "@/lib/multiplayer-modes";
import { formatCountdown, useClockOffset, useCountdown } from "@/lib/use-server-countdown";
import { loadDifficulty, loadSortMode, loadTheme, saveDifficulty, saveSortMode, saveTheme } from "@/lib/storage";
import { Difficulty, Guess, SortMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import RoomLanding from "@/components/RoomLanding";

/** `/arena/<id>/` carries the room; `/arena/` and `/arena/create/` do not. */
function getArenaIdFromPath(): string | null {
  if (typeof window === "undefined") return null;
  const segments = window.location.pathname.split("/").filter(Boolean);
  if (segments.length >= 2 && segments[0] === "arena" && segments[1] !== "create") {
    return segments[1];
  }
  return null;
}

/** What the player is told when the server refuses a guess. */
const REFUSAL_MESSAGES: Record<string, string> = {
  time_up: "Deine Zeit ist abgelaufen",
  eliminated: "Du bist raus, schau der Runde zu",
  not_running: "Die Runde läuft gerade nicht",
  unknown_word: "Dieses Wort kenne ich leider nicht",
  stopword: "Dieses Wort zählt nicht, es ist zu allgemein",
};

export default function ArenaPageClient() {
  const [arenaId, setArenaId] = useState<string | null>(null);
  const [state, setState] = useState<ArenaState | null>(null);
  const [playerToken, setPlayerToken] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [total, setTotal] = useState(0);
  const [solution, setSolution] = useState<string | null>(null);
  // The game this round was played on. It comes with the reveal, not with the
  // room state: while the arena runs, the number is the answer for everyone
  // still guessing (lib/types RoomRevealResult).
  const [roundGame, setRoundGame] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [needsJoin, setNeedsJoin] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [nextLoading, setNextLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestWord, setLatestWord] = useState<string | undefined>();
  const [pendingWord, setPendingWord] = useState<string | undefined>();
  const [podestError, setPodestError] = useState<PodestError | undefined>();

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [sortMode, setSortMode] = useState<SortMode>("rank");
  const [showSettings, setShowSettings] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  const offsetMs = useClockOffset(state?.server_time);
  const revealedRound = useRef<number | null>(null);

  useEffect(() => {
    const initTheme = loadTheme();
    setTheme(initTheme);
    document.documentElement.classList.toggle("dark", initTheme === "dark");
    setDifficulty(loadDifficulty() as Difficulty);
    setSortMode(loadSortMode());
  }, []);

  useEffect(() => {
    const id = getArenaIdFromPath();
    if (!id) {
      setLoading(false);
      return;
    }
    setArenaId(id);
    const stored = localStorage.getItem(`kontexto_arena_${id}`);
    if (stored) setPlayerToken(stored);
  }, []);

  // A room id is ephemeral, so its page must not enter the index. The static
  // /arena/ landing page stays indexable.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!getArenaIdFromPath()) return;
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex,follow";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  const refresh = useCallback(async (id: string) => {
    const fresh = await getArenaState(id);
    setState(fresh);
    return fresh;
  }, []);

  useEffect(() => {
    if (!arenaId) return;
    let cancelled = false;

    (async () => {
      try {
        const fresh = await getArenaState(arenaId);
        if (cancelled) return;
        setState(fresh);

        if (!playerToken) {
          setNeedsJoin(true);
          setLoading(false);
          return;
        }
        const info = await getArenaPlayerInfo(playerToken).catch(() => null);
        if (cancelled) return;
        if (!info || info.arena_id !== arenaId) {
          // The stored token belongs to another room, or the room was cleaned
          // up and rebuilt. Asking again is better than a silent dead end.
          localStorage.removeItem(`kontexto_arena_${arenaId}`);
          setPlayerToken(null);
          setNeedsJoin(true);
          setLoading(false);
          return;
        }
        setNickname(info.nickname);
        const history = await getArenaHistory(arenaId, playerToken);
        if (cancelled) return;
        setGuesses(history.map((g) => ({ word: g.word, rank: g.rank, isTip: false })));
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Runde nicht gefunden");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [arenaId, playerToken]);

  const handleWsMessage = useCallback(
    (msg: ArenaWsMessage) => {
      if (msg.type === "state") {
        setState(msg);
        return;
      }
      if (msg.type === "player_eliminated") {
        toast(
          msg.nickname === nickname
            ? "Deine Zeit ist um"
            : `${msg.nickname} ist raus`
        );
      }
      if (msg.type === "next_round") {
        setGuesses([]);
        setSolution(null);
        setRoundGame(null);
        setLatestWord(undefined);
        revealedRound.current = null;
      }
      // Every other message is a state change, and the room state is the one
      // authority for the board. Re-reading it is cheaper than keeping a second,
      // slowly diverging copy in this component.
      if (arenaId) void refresh(arenaId);
    },
    [arenaId, nickname, refresh]
  );

  useArenaWebSocket({ arenaId, token: playerToken, onMessage: handleWsMessage });

  // Reveal the word once the round is over, once per round.
  useEffect(() => {
    if (!state || state.status !== "finished") return;
    if (!arenaId || !playerToken) return;
    if (revealedRound.current === state.round) return;
    revealedRound.current = state.round;

    // One request for both, even when this player solved it themselves: the
    // number is only served here, and the word that comes with it is the same.
    revealArena(arenaId, playerToken)
      .then((result) => {
        setSolution(result.word);
        setRoundGame(result.game_number);
      })
      .catch(() => {
        const hit = guesses.find((g) => g.rank === 1);
        setSolution(hit ? hit.word : null);
        setRoundGame(null);
      });
  }, [state, guesses, arenaId, playerToken]);

  const handleJoin = useCallback(
    async (name: string) => {
      if (!arenaId) return;
      setJoinLoading(true);
      setJoinError(null);
      try {
        const joined = await joinArena(arenaId, name);
        localStorage.setItem(`kontexto_arena_${arenaId}`, joined.player_token);
        setPlayerToken(joined.player_token);
        setNickname(name);
        setState(joined);
        setNeedsJoin(false);
      } catch (e: unknown) {
        setJoinError(
          e instanceof Error && e.message === "arena_closed"
            ? "Diese Runde nimmt niemanden mehr auf"
            : "Beitreten hat nicht geklappt"
        );
      } finally {
        setJoinLoading(false);
      }
    },
    [arenaId]
  );

  const handleStart = useCallback(async () => {
    if (!arenaId || !playerToken) return;
    setStarting(true);
    setError(null);
    try {
      setState(await startArena(arenaId, playerToken));
    } catch {
      setError("Die Runde kann noch nicht starten");
    } finally {
      setStarting(false);
    }
  }, [arenaId, playerToken]);

  const handleGuess = useCallback(
    async (raw: string) => {
      if (!arenaId || !playerToken) return;
      const word = raw.trim().toLowerCase();
      setError(null);
      setPodestError(undefined);

      if (guesses.some((g) => g.word === word)) {
        setPodestError({ word, message: "Wort bereits geraten" });
        return;
      }

      setPendingWord(word);
      try {
        const result = await submitArenaGuess(arenaId, word, playerToken);
        setTotal(result.total);
        setLatestWord(result.word);
        setGuesses((prev) =>
          prev.some((g) => g.word === result.word)
            ? prev
            : [...prev, {
                word: result.word,
                rank: result.rank,
                counted: result.counted,
                isTip: false,
                correctedFrom: result.corrected_from ?? undefined,
              }]
        );
        void refresh(arenaId);
      } catch (e: unknown) {
        const code = e instanceof Error ? e.message : "";
        const message = REFUSAL_MESSAGES[code];
        if (message) {
          setPodestError({
            word,
            message,
            suggestions: e instanceof UnknownWordError ? e.suggestions : undefined,
          });
          // A refusal that ends the player's round is also a state change.
          if (code === "time_up" || code === "eliminated" || code === "not_running") {
            void refresh(arenaId);
          }
        } else {
          setError("Fehler bei der Verbindung");
        }
      } finally {
        setPendingWord(undefined);
      }
    },
    [arenaId, playerToken, guesses, refresh]
  );

  const handleNextRound = useCallback(async () => {
    if (!arenaId || !playerToken) return;
    setNextLoading(true);
    try {
      await arenaNextGame(arenaId, playerToken);
      setGuesses([]);
      setSolution(null);
      setRoundGame(null);
      setLatestWord(undefined);
      revealedRound.current = null;
      await refresh(arenaId);
    } catch {
      setError("Keine weitere Runde möglich");
    } finally {
      setNextLoading(false);
    }
  }, [arenaId, playerToken, refresh]);

  const handleCopyLink = useCallback(async () => {
    const ok = await copyTextToClipboard(window.location.href);
    toast(ok ? "Link kopiert" : "Link konnte nicht kopiert werden");
  }, []);

  const me = state?.players.find((p) => p.nickname === nickname) ?? null;
  const sharedSeconds = useCountdown(
    state?.status === "running" ? state.deadline_at : null,
    offsetMs
  );
  const ownSeconds = useCountdown(
    state?.status === "running" && state.mode === "timerush" && me && !me.eliminated
      ? me.deadline_at
      : null,
    offsetMs
  );
  const seconds = state?.mode === "timerush" ? ownSeconds : sharedSeconds;

  if (loading) return <DuelSkeleton />;

  if (!arenaId) {
    return <ArenaLanding />;
  }

  if (needsJoin) {
    return <JoinDialog onJoin={handleJoin} loading={joinLoading} error={joinError} />;
  }

  if (!state) {
    return (
      <div className="max-w-lg mx-auto min-h-screen flex items-center justify-center px-4">
        <p className="text-small text-muted-foreground">{error ?? "Runde nicht gefunden"}</p>
      </div>
    );
  }

  const meta = MULTIPLAYER_MODES[state.mode];
  const running = state.status === "running";
  const outOfIt = !!me?.eliminated || !running;

  return (
    <div className="max-w-4xl mx-auto min-h-screen flex flex-col">
      <Header
        onTip={() => {}}
        onGiveUp={() => {}}
        onHowToPlayOpen={() => setShowHowToPlay(true)}
        onSettingsOpen={() => setShowSettings(true)}
        onPastGamesOpen={() => {}}
        onCopyLink={handleCopyLink}
        hideTip
        hideGiveUp
        hidePastGames
        subtitle={`Modus: ${meta.name}`}
        backOpensModes
      />

      <div className="flex flex-1 flex-col gap-4 px-4 py-4 md:flex-row">
        <div className="flex flex-1 flex-col gap-4">
          {state.status === "lobby" ? (
            <ArenaLobby
              state={state}
              currentNickname={nickname}
              onStart={handleStart}
              starting={starting}
              error={error}
              onCopyLink={handleCopyLink}
            />
          ) : state.status === "finished" ? (
            <ArenaResultCard
              state={state}
              currentNickname={nickname}
              gameNumber={roundGame}
              solution={solution}
              onNextRound={handleNextRound}
              nextLoading={nextLoading}
            />
          ) : (
            <>
              <div className="flex items-baseline justify-between rounded-xl border bg-card px-4 py-3">
                <span className="text-micro font-medium text-muted-foreground">
                  {state.mode === "royale" ? `Runde ${state.phase + 1}` : meta.name}
                </span>
                {seconds !== null && (
                  <span
                    className={cn(
                      "font-display text-h2 font-bold tabular-nums",
                      seconds <= 10 && "text-destructive"
                    )}
                    aria-live="polite"
                  >
                    {formatCountdown(seconds)}
                  </span>
                )}
              </div>

              {me?.eliminated ? (
                <p className="rounded-xl border bg-card px-4 py-3 text-small text-muted-foreground">
                  {"Du bist raus. Die Runde läuft noch, du kannst zusehen."}
                </p>
              ) : (
                <GuessInput
                  onGuess={handleGuess}
                  disabled={outOfIt}
                  error={error}
                  placeholder="Wort eingeben..."
                />
              )}
            </>
          )}

          {state.status !== "lobby" && (
            <GuessList
              guesses={guesses}
              total={total}
              latestWord={latestWord}
              pendingWord={pendingWord}
              podestError={podestError}
              onSuggestion={handleGuess}
              sortMode={sortMode}
            />
          )}
        </div>

        {state.status !== "lobby" && (
          <ArenaPlayerBar
            players={state.players}
            currentNickname={nickname ?? ""}
            mode={state.mode}
            offsetMs={offsetMs}
          />
        )}
      </div>

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        theme={theme}
        onThemeChange={(t) => {
          setTheme(t);
          saveTheme(t);
          document.documentElement.classList.toggle("dark", t === "dark");
        }}
        difficulty={difficulty}
        onDifficultyChange={(d) => {
          setDifficulty(d);
          saveDifficulty(d);
        }}
        sortMode={sortMode}
        onSortModeChange={(s) => {
          setSortMode(s);
          saveSortMode(s);
        }}
      />
      <HowToPlayDialog open={showHowToPlay} onClose={() => setShowHowToPlay(false)} />
    </div>
  );
}

/** `/arena/` without a room id: where to start one. Shared with duel and koop,
 *  so a lost link looks the same in every mode. */
function ArenaLanding() {
  return (
    <RoomLanding
      title="Keine Runde offen"
      description="Eine Arena-Runde braucht einen Link oder eine Suche nach Mitspielern."
      createHref="/arena/create/"
      createLabel="Runde erstellen"
    />
  );
}
