"use client";

import { useEffect, useState, useCallback } from "react";
import Header from "@/components/Header";
import GuessInput from "@/components/GuessInput";
import GuessList from "@/components/GuessList";
import HowToPlayDialog from "@/components/HowToPlayDialog";
import FAQDialog from "@/components/FAQDialog";
import SettingsModal from "@/components/SettingsModal";
import CreditsDialog from "@/components/CreditsDialog";
import PlayerBar from "@/components/duel/PlayerBar";
import JoinDialog from "@/components/duel/JoinDialog";
import DuelResultCard from "@/components/duel/DuelResultCard";
import { useDuelWebSocket } from "@/lib/use-duel-websocket";
import {
  getDuelState,
  joinDuel,
  submitDuelGuess,
  getDuelHistory,
  getDuelTip,
  getPlayerInfo,
} from "@/lib/duel-api";
import { DuelPlayer, DuelWsMessage, DuelState } from "@/lib/duel-types";
import { Guess, Difficulty, SortMode } from "@/lib/types";
import { loadDifficulty, loadSortMode, loadTheme, saveTheme, saveDifficulty, saveSortMode } from "@/lib/storage";
import { toast } from "sonner";

function getDuelIdFromPath(): string | null {
  if (typeof window === "undefined") return null;
  const segments = window.location.pathname.split("/").filter(Boolean);
  if (
    segments.length >= 2 &&
    segments[0] === "duel" &&
    segments[1] !== "create"
  ) {
    return segments[1];
  }
  return null;
}

export default function DuelPage() {
  const [duelId, setDuelId] = useState<string | null>(null);
  const [duelState, setDuelState] = useState<DuelState | null>(null);
  const [playerToken, setPlayerToken] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [players, setPlayers] = useState<DuelPlayer[]>([]);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [tipCount, setTipCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [latestWord, setLatestWord] = useState<string | undefined>();
  const [pendingWord, setPendingWord] = useState<string | undefined>();
  const [podestError, setPodestError] = useState<
    { word: string; message: string } | undefined
  >();
  const [error, setError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const [needsJoin, setNeedsJoin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [difficulty, setDifficulty] = useState<Difficulty>(() =>
    typeof window !== "undefined" ? (loadDifficulty() as Difficulty) : "easy"
  );
  const [sortMode, setSortMode] = useState<SortMode>(() =>
    typeof window !== "undefined" ? loadSortMode() : "rank"
  );
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof window !== "undefined" ? loadTheme() : "light"
  );
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCredits, setShowCredits] = useState(false);

  const solved = guesses.some((g) => g.rank === 1);

  // Extract duel ID from URL
  useEffect(() => {
    const id = getDuelIdFromPath();
    if (!id) {
      setLoading(false);
      return;
    }
    setDuelId(id);

    const storedToken = localStorage.getItem(`kontexto_duel_${id}`);
    if (storedToken) {
      setPlayerToken(storedToken);
    }
  }, []);

  // Load duel state and history
  useEffect(() => {
    if (!duelId) return;

    getDuelState(duelId)
      .then((state) => {
        setDuelState(state);
        setPlayers(state.players);

        if (playerToken) {
          Promise.all([
            getDuelHistory(duelId, playerToken),
            getPlayerInfo(playerToken),
          ])
            .then(([history, info]) => {
              setNickname(info.nickname);
              setGuesses(
                history.map((h) => ({
                  word: h.word,
                  rank: h.rank,
                  isTip: false,
                }))
              );
              setLoading(false);
            })
            .catch(() => {
              localStorage.removeItem(`kontexto_duel_${duelId}`);
              setPlayerToken(null);
              setNeedsJoin(true);
              setLoading(false);
            });
        } else {
          setNeedsJoin(true);
          setLoading(false);
        }
      })
      .catch(() => {
        setError("Duell nicht gefunden");
        setLoading(false);
      });
  }, [duelId, playerToken]);

  // WebSocket
  const handleWsMessage = useCallback((msg: DuelWsMessage) => {
    if (msg.type === "state") {
      setPlayers(msg.players);
    } else if (msg.type === "rank_update") {
      setPlayers((prev) =>
        prev.map((p) =>
          p.nickname === msg.nickname
            ? { ...p, best_rank: msg.best_rank, guess_count: msg.guess_count }
            : p
        )
      );
    } else if (msg.type === "player_solved") {
      setPlayers((prev) =>
        prev.map((p) =>
          p.nickname === msg.nickname
            ? { ...p, solved: true, guess_count: msg.guess_count }
            : p
        )
      );
    } else if (msg.type === "player_joined") {
      setPlayers((prev) => {
        if (prev.some((p) => p.nickname === msg.nickname)) return prev;
        return [
          ...prev,
          {
            nickname: msg.nickname,
            best_rank: null,
            guess_count: 0,
            solved: false,
            connected: true,
          },
        ];
      });
    } else if (msg.type === "player_disconnected") {
      setPlayers((prev) =>
        prev.map((p) =>
          p.nickname === msg.nickname ? { ...p, connected: false } : p
        )
      );
    } else if (msg.type === "player_reconnected") {
      setPlayers((prev) =>
        prev.map((p) =>
          p.nickname === msg.nickname ? { ...p, connected: true } : p
        )
      );
    }
  }, []);

  const { connected: wsConnected } = useDuelWebSocket({
    duelId,
    token: playerToken,
    onMessage: handleWsMessage,
  });

  // Join
  const handleJoin = useCallback(
    async (nick: string) => {
      if (!duelId) return;
      setJoinLoading(true);
      setJoinError(null);
      try {
        const result = await joinDuel(duelId, nick);
        localStorage.setItem(`kontexto_duel_${duelId}`, result.player_token);
        setPlayerToken(result.player_token);
        setNickname(nick);
        setPlayers(result.players);
        setNeedsJoin(false);
      } catch {
        setJoinError("Fehler beim Beitreten");
      } finally {
        setJoinLoading(false);
      }
    },
    [duelId]
  );

  // Guess
  const handleGuess = useCallback(
    async (word: string) => {
      if (!duelId || !playerToken) return;
      setError(null);
      setPodestError(undefined);

      if (guesses.some((g) => g.word === word.toLowerCase())) {
        setPodestError({
          word: word.toLowerCase(),
          message: "Wort bereits geraten!",
        });
        return;
      }

      setPendingWord(word.toLowerCase());
      try {
        const result = await submitDuelGuess(duelId, word, playerToken);
        if (guesses.some((g) => g.word === result.word)) {
          setPodestError({
            word: result.word,
            message: "Wort bereits geraten!",
          });
          return;
        }
        const newGuess = { word: result.word, rank: result.rank, isTip: false };
        setGuesses((prev) => [...prev, newGuess]);
        setTotal(result.total);
        setLatestWord(result.word);
        // Update own stats in players list
        if (nickname) {
          setPlayers((prev) =>
            prev.map((p) =>
              p.nickname === nickname
                ? {
                    ...p,
                    best_rank:
                      p.best_rank === null
                        ? result.rank
                        : Math.min(p.best_rank, result.rank),
                    guess_count: p.guess_count + 1,
                    solved: p.solved || result.rank === 1,
                  }
                : p
            )
          );
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.message === "unknown_word") {
          setPodestError({
            word: word.toLowerCase(),
            message: "Dieses Wort kenne ich leider nicht",
          });
        } else if (e instanceof Error && e.message === "stopword") {
          setPodestError({
            word: word.toLowerCase(),
            message: "Dieses Wort zählt nicht – es ist zu allgemein",
          });
        } else {
          setError("Fehler bei der Verbindung");
        }
      } finally {
        setPendingWord(undefined);
      }
    },
    [duelId, playerToken, guesses, nickname]
  );

  // Tip
  const handleTip = useCallback(async () => {
    if (!duelId || !duelState?.tips_allowed) return;
    setError(null);
    const bestRank =
      guesses.length > 0 ? Math.min(...guesses.map((g) => g.rank)) : 10000;
    const guessedRanks = guesses.map((g) => g.rank);
    try {
      const result = await getDuelTip(duelId, difficulty, bestRank, guessedRanks);
      if (guesses.some((g) => g.word === result.word)) return;
      setTipCount((prev) => prev + 1);
      setGuesses((prev) => [
        ...prev,
        { word: result.word, rank: result.rank, isTip: true },
      ]);
      setLatestWord(result.word);
      // Update own stats in players list for tip
      if (nickname) {
        setPlayers((prev) =>
          prev.map((p) =>
            p.nickname === nickname
              ? {
                  ...p,
                  best_rank:
                    p.best_rank === null
                      ? result.rank
                      : Math.min(p.best_rank, result.rank),
                  guess_count: p.guess_count + 1,
                  solved: p.solved || result.rank === 1,
                }
              : p
          )
        );
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "tips_disabled") {
        setError("Tipps sind in diesem Duell deaktiviert");
      } else {
        setError("Tipp konnte nicht geladen werden");
      }
    }
  }, [duelId, duelState, guesses, difficulty, nickname]);

  // Copy link
  const handleCopyLink = useCallback(() => {
    if (!duelId) return;
    const url = `${window.location.origin}/duel/${duelId}/`;
    navigator.clipboard.writeText(url);
    toast.success("Link kopiert!");
  }, [duelId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground text-lg">Laden...</div>
      </div>
    );
  }

  if (!duelId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Kein Duell ausgewählt.</p>
        <a href="/duel/create/" className="text-primary underline">
          Neues Duell erstellen
        </a>
      </div>
    );
  }

  if (error && !duelState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-destructive">{error}</p>
        <a href="/duel/create/" className="text-primary underline">
          Neues Duell erstellen
        </a>
      </div>
    );
  }

  if (needsJoin) {
    return (
      <JoinDialog onJoin={handleJoin} loading={joinLoading} error={joinError} />
    );
  }

  return (
    <div className="max-w-4xl mx-auto min-h-screen flex flex-col">
      <Header
        onTip={handleTip}
        onGiveUp={() => {}}
        onHowToPlayOpen={() => setShowHowToPlay(true)}
        onFAQOpen={() => setShowFAQ(true)}
        onSettingsOpen={() => setShowSettings(true)}
        onCreditsOpen={() => setShowCredits(true)}
        onPastGamesOpen={() => {}}
        tipDisabled={solved || !duelState?.tips_allowed}
        giveUpDisabled
        onCopyLink={handleCopyLink}
        hideTip={!duelState?.tips_allowed}
        hideGiveUp
        hidePastGames
        hideDuelCreate
      />

      <div className="flex flex-col md:flex-row flex-1 px-4 py-4 gap-4">
        <div className="flex-1 flex flex-col gap-4">
          {/* Mobile player bar */}
          <div className="md:hidden">
            <PlayerBar players={players} currentNickname={nickname ?? ""} />
          </div>

          {solved ? (
            <DuelResultCard
              gameNumber={duelState?.game_number ?? 0}
              guesses={guesses}
              tipCount={tipCount}
              players={players}
              currentNickname={nickname ?? ""}
            />
          ) : (
            <>
              <div className="flex items-baseline gap-4 -mt-2 -mb-2 text-[12px] font-medium text-muted-foreground uppercase tracking-wide">
                <span>Duell</span>
                <span>Spiel: <span className="text-[18px] font-bold">#{duelState?.game_number}</span></span>
                <span>
                  Versuche:{" "}
                  <span className="text-[18px] font-bold">{guesses.length}</span>
                </span>
                {duelState?.tips_allowed && (
                  <span>
                    Tipps:{" "}
                    <span className="text-[18px] font-bold">{tipCount}</span>
                  </span>
                )}
              </div>
              <GuessInput onGuess={handleGuess} disabled={solved} error={error} />
            </>
          )}

          <GuessList
            guesses={guesses}
            total={total}
            latestWord={latestWord}
            pendingWord={pendingWord}
            podestError={podestError}
            sortMode={sortMode}
          />
        </div>

        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <PlayerBar players={players} currentNickname={nickname ?? ""} />
        </div>
      </div>

      <HowToPlayDialog open={showHowToPlay} onClose={() => setShowHowToPlay(false)} />
      <FAQDialog open={showFAQ} onClose={() => setShowFAQ(false)} />
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        theme={theme}
        onThemeChange={(t) => { setTheme(t); saveTheme(t); document.documentElement.classList.toggle("dark", t === "dark"); }}
        difficulty={difficulty}
        onDifficultyChange={(d) => { setDifficulty(d); saveDifficulty(d); }}
        sortMode={sortMode}
        onSortModeChange={(s) => { setSortMode(s); saveSortMode(s); }}
      />
      <CreditsDialog open={showCredits} onClose={() => setShowCredits(false)} />
    </div>
  );
}
