"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { fireConfetti } from "@/lib/confetti";
import Header from "@/components/Header";
import GuessInput from "@/components/GuessInput";
import GuessList from "@/components/GuessList";
import HowToPlayDialog from "@/components/HowToPlayDialog";
import FAQDialog from "@/components/FAQDialog";
import SettingsModal from "@/components/SettingsModal";
import CreditsDialog from "@/components/CreditsDialog";
import GiveUpDialog from "@/components/GiveUpDialog";
import PlayerBar from "@/components/koop/PlayerBar";
import JoinDialog from "@/components/koop/JoinDialog";
import KoopResultCard from "@/components/koop/KoopResultCard";
import KoopSkeleton from "@/components/koop/KoopSkeleton";
import ShareInviteBar from "@/components/ShareInviteBar";
import { copyTextToClipboard } from "@/lib/clipboard";
import { useKoopWebSocket } from "@/lib/use-koop-websocket";
import {
  getKoopState,
  getKoopGuesses,
  joinKoop,
  submitKoopGuess,
  getKoopTip,
  getKoopPlayerInfo,
  giveUpKoop,
  koopNextGame,
} from "@/lib/koop-api";
import { KoopPlayer, KoopWsMessage, KoopState } from "@/lib/koop-types";
import { Guess, Difficulty, SortMode } from "@/lib/types";
import { loadDifficulty, loadSortMode, loadTheme, saveTheme, saveDifficulty, saveSortMode } from "@/lib/storage";
import { toast } from "sonner";

function getKoopIdFromPath(): string | null {
  if (typeof window === "undefined") return null;
  const segments = window.location.pathname.split("/").filter(Boolean);
  if (
    segments.length >= 2 &&
    segments[0] === "koop" &&
    segments[1] !== "create"
  ) {
    return segments[1];
  }
  return null;
}

export default function KoopPageClient() {
  const [koopId, setKoopId] = useState<string | null>(null);
  const [koopState, setKoopState] = useState<KoopState | null>(null);
  const [playerToken, setPlayerToken] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [players, setPlayers] = useState<KoopPlayer[]>([]);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [total, setTotal] = useState(0);
  const [latestWord, setLatestWord] = useState<string | undefined>();
  const [pendingWord, setPendingWord] = useState<string | undefined>();
  const [solvedBy, setSolvedBy] = useState<string | null>(null);
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
  const [showGiveUp, setShowGiveUp] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  // Mirrors `gaveUp` for the guess-append path so confetti is suppressed for the
  // reveal word without waiting on the async state update.
  const gaveUpRef = useRef(false);

  const solved = guesses.some((g) => g.rank === 1) || !!koopState?.solved;
  const roundOver = solved || gaveUp;

  // Extract koop ID from URL.
  useEffect(() => {
    const id = getKoopIdFromPath();
    if (!id) {
      setLoading(false);
      return;
    }
    setKoopId(id);

    const storedToken = localStorage.getItem(`kontexto_koop_${id}`);
    if (storedToken) {
      setPlayerToken(storedToken);
    }
  }, []);

  // Inject noindex for ephemeral koop-id pages so they don't bloat the search
  // index; the static /koop/ landing page stays indexable.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const seg = window.location.pathname.split("/").filter(Boolean);
    const hasId = seg[0] === "koop" && seg[1] && seg[1] !== "create";
    if (!hasId) return;
    const m = document.createElement("meta");
    m.name = "robots";
    m.content = "noindex,follow";
    document.head.appendChild(m);
    return () => { document.head.removeChild(m); };
  }, []);

  // Load koop state + the shared guess list.
  useEffect(() => {
    if (!koopId) return;

    Promise.all([getKoopState(koopId), getKoopGuesses(koopId)])
      .then(([state, shared]) => {
        setKoopState(state);
        setPlayers(state.players);
        setSolvedBy(state.solved_by);
        setGaveUp(state.gave_up);
        gaveUpRef.current = state.gave_up;
        setTotal(state.total);
        const loaded = shared.map((g) => ({
          word: g.word,
          rank: g.rank,
          isTip: g.is_tip,
        }));
        setGuesses(loaded);

        if (playerToken) {
          getKoopPlayerInfo(playerToken)
            .then((info) => {
              setNickname(info.nickname);
              if (state.solved && !state.gave_up) setTimeout(fireConfetti, 300);
              setLoading(false);
            })
            .catch(() => {
              localStorage.removeItem(`kontexto_koop_${koopId}`);
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
        setError("Koop nicht gefunden");
        setLoading(false);
      });
  }, [koopId, playerToken]);

  // Append a word to the shared list, de-duplicating by word.
  const appendGuess = useCallback((word: string, rank: number, isTip: boolean) => {
    setGuesses((prev) => {
      if (prev.some((g) => g.word === word)) return prev;
      return [...prev, { word, rank, isTip }];
    });
    setLatestWord(word);
    // No win-confetti for a revealed (gave-up) word.
    if (rank === 1 && !gaveUpRef.current) fireConfetti();
  }, []);

  // Reset all local round state for a freshly advanced koop game (triggered by
  // "Nächstes Spiel" locally or via the next_game broadcast for other players).
  const resetForNextGame = useCallback((gameNumber: number) => {
    gaveUpRef.current = false;
    setGaveUp(false);
    setSolvedBy(null);
    setGuesses([]);
    setLatestWord(undefined);
    setPendingWord(undefined);
    setPodestError(undefined);
    setError(null);
    setKoopState((prev) =>
      prev
        ? { ...prev, game_number: gameNumber, solved: false, solved_by: null, gave_up: false, best_rank: null }
        : prev
    );
    setPlayers((prev) => prev.map((p) => ({ ...p, contribution_count: 0 })));
  }, []);

  // WebSocket: live shared-list and team updates.
  const handleWsMessage = useCallback(
    (msg: KoopWsMessage) => {
      if (msg.type === "state") {
        setPlayers(msg.players);
      } else if (msg.type === "guess_added") {
        appendGuess(msg.word, msg.rank, msg.is_tip);
        // Reflect the contribution in the player list.
        setPlayers((prev) =>
          prev.map((p) =>
            p.nickname === msg.nickname
              ? { ...p, contribution_count: p.contribution_count + 1 }
              : p
          )
        );
      } else if (msg.type === "koop_solved") {
        setSolvedBy(msg.nickname);
        setKoopState((prev) => (prev ? { ...prev, solved: true, solved_by: msg.nickname } : prev));
        if (msg.word) appendGuess(msg.word, 1, false);
      } else if (msg.type === "koop_gave_up") {
        gaveUpRef.current = true;
        setGaveUp(true);
        setKoopState((prev) => (prev ? { ...prev, gave_up: true } : prev));
        if (msg.word) appendGuess(msg.word, 1, false);
      } else if (msg.type === "next_game") {
        resetForNextGame(msg.game_number);
      } else if (msg.type === "player_joined") {
        setPlayers((prev) => {
          if (prev.some((p) => p.nickname === msg.nickname)) return prev;
          return [
            ...prev,
            { nickname: msg.nickname, contribution_count: 0, connected: true },
          ];
        });
      } else if (msg.type === "player_disconnected") {
        setPlayers((prev) =>
          prev.map((p) => (p.nickname === msg.nickname ? { ...p, connected: false } : p))
        );
      } else if (msg.type === "player_reconnected") {
        setPlayers((prev) =>
          prev.map((p) => (p.nickname === msg.nickname ? { ...p, connected: true } : p))
        );
      }
    },
    [appendGuess, resetForNextGame]
  );

  useKoopWebSocket({
    koopId,
    token: playerToken,
    onMessage: handleWsMessage,
  });

  // Join.
  const handleJoin = useCallback(
    async (nick: string) => {
      if (!koopId) return;
      setJoinLoading(true);
      setJoinError(null);
      try {
        const result = await joinKoop(koopId, nick);
        localStorage.setItem(`kontexto_koop_${koopId}`, result.player_token);
        setPlayerToken(result.player_token);
        setNickname(result.nickname);
        setPlayers(result.players);
        setNeedsJoin(false);
      } catch {
        setJoinError("Fehler beim Beitreten");
      } finally {
        setJoinLoading(false);
      }
    },
    [koopId]
  );

  // Guess.
  const handleGuess = useCallback(
    async (word: string) => {
      if (!koopId || !playerToken) return;
      setError(null);
      setPodestError(undefined);

      if (guesses.some((g) => g.word === word.toLowerCase())) {
        setPodestError({ word: word.toLowerCase(), message: "Wort bereits geraten" });
        return;
      }

      setPendingWord(word.toLowerCase());
      try {
        const result = await submitKoopGuess(koopId, word, playerToken);
        if (result.already_guessed || guesses.some((g) => g.word === result.word)) {
          setPodestError({ word: result.word, message: "Wort bereits geraten" });
          return;
        }
        setTotal(result.total);
        appendGuess(result.word, result.rank, false);
        if (nickname) {
          setPlayers((prev) =>
            prev.map((p) =>
              p.nickname === nickname
                ? { ...p, contribution_count: p.contribution_count + 1 }
                : p
            )
          );
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.message === "unknown_word") {
          setPodestError({ word: word.toLowerCase(), message: "Dieses Wort kenne ich leider nicht" });
        } else if (e instanceof Error && e.message === "stopword") {
          setPodestError({ word: word.toLowerCase(), message: "Dieses Wort zählt nicht, es ist zu allgemein" });
        } else {
          setError("Fehler bei der Verbindung");
        }
      } finally {
        setPendingWord(undefined);
      }
    },
    [koopId, playerToken, guesses, nickname, appendGuess]
  );

  // Tip, shared with the whole team. best_rank/guessed_ranks are derived
  // server-side from the shared list.
  const handleTip = useCallback(async () => {
    if (!koopId || !playerToken || !koopState?.tips_allowed) return;
    setError(null);
    try {
      const result = await getKoopTip(koopId, difficulty, playerToken);
      if (guesses.some((g) => g.word === result.word)) return;
      appendGuess(result.word, result.rank, true);
      if (nickname) {
        setPlayers((prev) =>
          prev.map((p) =>
            p.nickname === nickname
              ? { ...p, contribution_count: p.contribution_count + 1 }
              : p
          )
        );
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "tips_disabled") {
        setError("Tipps sind in diesem Koop deaktiviert");
      } else {
        setError("Tipp konnte nicht geladen werden");
      }
    }
  }, [koopId, playerToken, koopState, guesses, difficulty, nickname, appendGuess]);

  // Give up, reveals the word for the whole team.
  const handleGiveUp = useCallback(async () => {
    setShowGiveUp(false);
    if (!koopId || !playerToken) return;
    setError(null);
    try {
      const result = await giveUpKoop(koopId, playerToken);
      gaveUpRef.current = true;
      setGaveUp(true);
      setKoopState((prev) => (prev ? { ...prev, gave_up: true } : prev));
      appendGuess(result.word, 1, false);
    } catch {
      setError("Lösungswort konnte nicht geladen werden");
    }
  }, [koopId, playerToken, appendGuess]);

  // Start the next game in the same koop room for everyone.
  const handleNextGame = useCallback(async () => {
    if (!koopId || !playerToken) return;
    try {
      const result = await koopNextGame(koopId, playerToken);
      resetForNextGame(result.game_number);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "no_games") {
        toast.error("Keine weiteren Spiele verfügbar");
      } else {
        setError("Nächstes Spiel konnte nicht geladen werden");
      }
    }
  }, [koopId, playerToken, resetForNextGame]);

  // Copy link.
  const handleCopyLink = useCallback(async () => {
    if (!koopId) return;
    const url = `${window.location.origin}/koop/${koopId}/`;
    const ok = await copyTextToClipboard(url);
    if (ok) toast.success("Link kopiert!");
    else prompt("Link kopieren:", url);
  }, [koopId]);

  if (loading) {
    return <KoopSkeleton />;
  }

  if (!koopId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Kein Koop ausgewählt.</p>
        <a href="/koop/create/" className="text-primary underline">
          Neuen Koop erstellen
        </a>
      </div>
    );
  }

  if (error && !koopState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-destructive">{error}</p>
        <a href="/koop/create/" className="text-primary underline">
          Neuen Koop erstellen
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
        onGiveUp={() => setShowGiveUp(true)}
        onHowToPlayOpen={() => setShowHowToPlay(true)}
        onFAQOpen={() => setShowFAQ(true)}
        onSettingsOpen={() => setShowSettings(true)}
        onCreditsOpen={() => setShowCredits(true)}
        onPastGamesOpen={() => {}}
        tipDisabled={roundOver || !koopState?.tips_allowed}
        giveUpDisabled={roundOver}
        onCopyLink={handleCopyLink}
        hideTip={!koopState?.tips_allowed}
        hidePastGames
        hideDuelCreate
        hideKoopCreate
        backHref="/"
      />

      <div className="flex flex-col md:flex-row flex-1 px-4 py-4 gap-4">
        <div className="flex-1 flex flex-col gap-4">
          {/* Mobile player bar */}
          <div className="md:hidden">
            <PlayerBar players={players} currentNickname={nickname ?? ""} />
          </div>

          {!roundOver && players.length < 2 && (
            <ShareInviteBar
              title="Warte auf Mitspieler …"
              description="Teile den Link, jeder der beitritt rät am selben Wort mit."
              onCopy={handleCopyLink}
            />
          )}

          {roundOver ? (
            <KoopResultCard
              gameNumber={koopState?.game_number ?? 0}
              guesses={guesses}
              players={players}
              solvedBy={solvedBy}
              currentNickname={nickname ?? ""}
              gaveUp={gaveUp}
              onNextGame={handleNextGame}
            />
          ) : (
            <>
              <div className="flex items-baseline gap-4 -mt-2 -mb-2 text-[12px] font-medium text-muted-foreground uppercase tracking-wide">
                <span>Koop</span>
                <span>Spiel: <span className="text-[18px] font-bold">#{koopState?.game_number}</span></span>
                <span>
                  Versuche:{" "}
                  <span className="text-[18px] font-bold">{guesses.length}</span>
                </span>
              </div>
              <GuessInput onGuess={handleGuess} disabled={roundOver} error={error} />
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
      <GiveUpDialog
        open={showGiveUp}
        onClose={() => setShowGiveUp(false)}
        onConfirm={handleGiveUp}
        description="Bist du sicher? Das Lösungswort wird dem ganzen Team angezeigt. Danach könnt ihr ein nächstes Spiel starten."
      />
    </div>
  );
}
