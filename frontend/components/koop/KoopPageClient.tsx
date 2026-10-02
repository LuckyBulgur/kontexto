"use client";

import { ReactNode, useEffect, useRef, useState, useCallback } from "react";
import { fireConfetti } from "@/lib/confetti";
import { onEventArrival, onEventGuess, onEventTeamWord, setEventLiveRoom } from "@/lib/events/hooks";
import Header from "@/components/Header";
import GuessInput from "@/components/GuessInput";
import GuessList, { type PodestError } from "@/components/GuessList";
import { UnknownWordError } from "@/lib/guess-error";
import { podestErrorRemaining } from "@/lib/podest";
import HowToPlayDialog from "@/components/HowToPlayDialog";
import SettingsModal from "@/components/SettingsModal";
import GiveUpDialog from "@/components/GiveUpDialog";
import PlayerBar from "@/components/koop/PlayerBar";
import JoinDialog from "@/components/koop/JoinDialog";
import KoopResultCard from "@/components/koop/KoopResultCard";
import { refusalText } from "@/lib/quips";
import { useQuips } from "@/lib/use-quips";
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
  revealKoop,
  koopNextGame,
} from "@/lib/koop-api";
import { KoopPlayer, KoopWsMessage, KoopState } from "@/lib/koop-types";
import { Guess, Difficulty, SortMode } from "@/lib/types";
import { loadDifficulty, loadSortMode, loadTheme, saveTheme, saveDifficulty, saveSortMode } from "@/lib/storage";
import { toast } from "sonner";
import RoomCategoryLabel from "@/components/categories/RoomCategoryLabel";
import RoomLanding from "@/components/RoomLanding";
import { BOARD_COLUMN, BOARD_GRID, SIDEBAR_COLUMN } from "@/lib/board-layout";
import { cn } from "@/lib/utils";
import { knocksForArrival, playKnock } from "@/lib/knock-sound";

function getKoopIdFromPath(basePath: string): string | null {
  if (typeof window === "undefined") return null;
  const segments = window.location.pathname.split("/").filter(Boolean);
  if (
    segments.length >= 2 &&
    segments[0] === basePath &&
    segments[1] !== "create"
  ) {
    return segments[1];
  }
  return null;
}

export interface KoopPageClientProps {
  /** Which route this board lives under. The stream-chat mode serves the same
   *  koop room at /live/<id>/, so the id is read from that segment instead. */
  basePath?: string;
  /** The word above the guess input, where the koop board says "Koop". */
  label?: string;
  /** Replaces the player list on both breakpoints. The stream chat puts its
   *  chat status and its viewer leaderboard there, because a live room has one
   *  player row and a player list of one is not worth the space. */
  sidebar?: ReactNode;
  /** On a phone, put the sidebar under the board instead of above it. The
   *  stream chat sets it: its sidebar is long (chats, three boards, the
   *  support feed), and a streamer on a phone needs the board first. */
  sidebarBelowOnMobile?: boolean;
  /** Keep the board exactly where the solo game puts it (`max-w-lg`, centred)
   *  and give the sidebar the right-hand gutter, so the sidebar never pushes
   *  the board off centre. The stream chat sets it: streamers crop their
   *  capture to the board, and every other mode has it in the middle. Where
   *  the gutter is too narrow the pair is centred instead, the sidebar still
   *  beside the board; only below `md` does it go under the board (or above
   *  it, see `sidebarBelowOnMobile`). The bands: `lib/board-layout.ts`. */
  centerBoard?: boolean;
  /** Whether to offer the invite link while the room is still alone. A stream
   *  chat needs no invite: the audience is already there. */
  showInvite?: boolean;
  /** What to show when the path carries no room id. */
  landing?: ReactNode;
  /** Where the "open a new one" links point. */
  createHref?: string;
  /** Whether this room can be handed to somebody as a link. False for the
   *  stream chat: there is a channel, not an invite, and a copied room URL
   *  would only take a viewer to a page that turns them away. */
  shareable?: boolean;
  /** Passed straight to the result card, so a mode can name what the round was
   *  and who took part without forking the card. */
  resultLabel?: string;
  resultGroupNoun?: string;
  resultRows?: { name: string; detail: string; label?: ReactNode }[];
  /** Prints who played each word above its bar. On for the stream chat, where a
   *  viewer seeing their own name next to a good rank is the whole reward. */
  showNames?: boolean;
  /** Draws a row's author (see GuessList.renderBy). */
  renderBy?: (guess: Guess) => ReactNode;
  /** The finder's block on the result card (see KoopResultCard.finder). Gets
   *  the winning row, so a mode can draw where the finder came from. */
  renderFinder?: (solvedBy: string, winning: Guess | undefined) => ReactNode;
  /** The sentences that name the room. A stream-chat round is not a koop and
   *  must not call itself one anywhere the host can read it. German needs whole
   *  sentences here rather than a noun to splice in, because the article
   *  changes with the gender of the word. */
  notFoundMessage?: string;
  tipsDisabledMessage?: string;
  giveUpDescription?: string;
  /** Let words from other players wake the seasonal word effects. The stream
   *  chat sets it, so a viewer typing "geist" sends a ghost across the stream;
   *  an invited koop keeps the rule that only your own word does. */
  arrivalEffects?: boolean;
}

export default function KoopPageClient({
  basePath = "koop",
  label = "Koop",
  sidebar,
  sidebarBelowOnMobile = false,
  centerBoard = false,
  showInvite = true,
  landing,
  createHref = "/koop/create/",
  shareable = true,
  resultLabel,
  resultGroupNoun,
  resultRows,
  showNames,
  renderBy,
  renderFinder,
  arrivalEffects = false,
  notFoundMessage = "Koop nicht gefunden",
  tipsDisabledMessage = "Tipps sind in diesem Koop deaktiviert",
  giveUpDescription = "Bist du sicher? Das Lösungswort wird dem ganzen Team angezeigt. Danach könnt ihr ein nächstes Spiel starten.",
}: KoopPageClientProps = {}) {
  const { enabled: quips } = useQuips();
  const [koopId, setKoopId] = useState<string | null>(null);
  const [koopState, setKoopState] = useState<KoopState | null>(null);
  const [playerToken, setPlayerToken] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [players, setPlayers] = useState<KoopPlayer[]>([]);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [latestWord, setLatestWord] = useState<string | undefined>();
  const [pendingWord, setPendingWord] = useState<string | undefined>();
  const [solvedBy, setSolvedBy] = useState<string | null>(null);
  const [podestError, setPodestErrorState] = useState<PodestError | undefined>();
  // When the refusal on the podest went up, and the one timer that takes it
  // down once a newer word is waiting (lib/podest.ts).
  const podestErrorAt = useRef<number | null>(null);
  const podestErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [showSettings, setShowSettings] = useState(false);
  const [showGiveUp, setShowGiveUp] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  // Which game this round was played on. It arrives with the reveal once the
  // round is over, never with the room state, because the number is the answer
  // while the team is still guessing (lib/types RoomRevealResult).
  const [roundGame, setRoundGame] = useState<number | null>(null);
  const revealedRound = useRef<number | null>(null);
  // Mirrors `gaveUp` for the guess-append path so confetti is suppressed for the
  // reveal word without waiting on the async state update.
  const gaveUpRef = useRef(false);

  const solved = guesses.some((g) => g.rank === 1) || !!koopState?.solved;
  const roundOver = solved || gaveUp;

  // The live room's host page is on stream: easter eggs keep to the edges there.
  useEffect(() => {
    if (!arrivalEffects) return;
    setEventLiveRoom(true);
    return () => setEventLiveRoom(false);
  }, [arrivalEffects]);

  // Extract koop ID from URL.
  useEffect(() => {
    const id = getKoopIdFromPath(basePath);
    if (!id) {
      setLoading(false);
      return;
    }
    setKoopId(id);

    const storedToken = localStorage.getItem(`kontexto_koop_${id}`);
    if (storedToken) {
      setPlayerToken(storedToken);
    }
  }, [basePath]);

  // Inject noindex for ephemeral koop-id pages so they don't bloat the search
  // index; the static /koop/ landing page stays indexable.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const seg = window.location.pathname.split("/").filter(Boolean);
    const hasId =
      seg[0] === basePath && seg[1] && seg[1] !== "create";
    if (!hasId) return;
    const m = document.createElement("meta");
    m.name = "robots";
    m.content = "noindex,follow";
    document.head.appendChild(m);
    return () => { document.head.removeChild(m); };
  }, [basePath]);

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
        const loaded = shared.map((g) => ({
          word: g.word,
          rank: g.rank,
          isTip: g.is_tip,
          by: g.nickname,
          source: g.source ?? null,
          badges: g.badges ?? [],
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
        setError(notFoundMessage);
        setLoading(false);
      });
  }, [koopId, playerToken]);

  const setPodestError = useCallback((next: PodestError | undefined) => {
    if (podestErrorTimer.current !== null) {
      clearTimeout(podestErrorTimer.current);
      podestErrorTimer.current = null;
    }
    podestErrorAt.current = next ? performance.now() : null;
    setPodestErrorState(next);
  }, []);

  // A newer word on the list takes the podest back from a refusal, once the
  // refusal has been up long enough to be read. Without this, one unknown word
  // from the host hid every word the others typed after it.
  const yieldPodestError = useCallback(() => {
    const shownAt = podestErrorAt.current;
    if (shownAt === null || podestErrorTimer.current !== null) return;
    const remaining = podestErrorRemaining(shownAt, performance.now());
    if (remaining === 0) {
      setPodestError(undefined);
      return;
    }
    podestErrorTimer.current = setTimeout(() => {
      podestErrorTimer.current = null;
      setPodestError(undefined);
    }, remaining);
  }, [setPodestError]);

  useEffect(
    () => () => {
      if (podestErrorTimer.current !== null) clearTimeout(podestErrorTimer.current);
    },
    []
  );

  // Append a word to the shared list, de-duplicating by word.
  const appendGuess = useCallback((
    word: string,
    rank: number,
    isTip: boolean,
    correctedFrom?: string,
    by?: string,
    origin?: Pick<Guess, "source" | "badges">,
  ) => {
    setGuesses((prev) => {
      if (prev.some((g) => g.word === word)) return prev;
      return [...prev, { word, rank, isTip, correctedFrom, by, ...origin }];
    });
    setLatestWord(word);
    yieldPodestError();
    // No win-confetti for a revealed (gave-up) word.
    if (rank === 1 && !gaveUpRef.current) fireConfetti();
  }, [yieldPodestError]);

  // Reset all local round state for a freshly advanced koop game (triggered by
  // the rematch button locally or via the next_round broadcast for the others).
  const resetForNextGame = useCallback((round: number) => {
    gaveUpRef.current = false;
    setGaveUp(false);
    setSolvedBy(null);
    setGuesses([]);
    setLatestWord(undefined);
    setPendingWord(undefined);
    setPodestError(undefined);
    setError(null);
    setRoundGame(null);
    setKoopState((prev) =>
      prev
        ? { ...prev, round, solved: false, solved_by: null, gave_up: false, best_rank: null }
        : prev
    );
    setPlayers((prev) => prev.map((p) => ({ ...p, contribution_count: 0 })));
  }, [setPodestError]);

  // Ask for the game number once the round is over, once per round. While it
  // runs the server refuses, which is the whole reason this endpoint exists.
  useEffect(() => {
    if (!roundOver || !koopId || !playerToken || !koopState) return;
    if (revealedRound.current === koopState.round) return;
    revealedRound.current = koopState.round;
    revealKoop(koopId, playerToken)
      .then((result) => setRoundGame(result.game_number))
      .catch(() => setRoundGame(null));
  }, [roundOver, koopId, playerToken, koopState]);

  // WebSocket: live shared-list and team updates.
  const handleWsMessage = useCallback(
    (msg: KoopWsMessage) => {
      if (msg.type === "state") {
        setPlayers(msg.players);
      } else if (msg.type === "guess_added") {
        if (knocksForArrival({ word: msg.word, by: msg.nickname, isTip: msg.is_tip }, nickname)) {
          playKnock();
        }
        if (!msg.is_tip && (!nickname || msg.nickname !== nickname)) {
          if (arrivalEffects) onEventArrival({ word: msg.word, rank: msg.rank });
          else onEventTeamWord(msg.word);
        }
        appendGuess(msg.word, msg.rank, msg.is_tip, undefined, msg.nickname, {
          source: msg.source ?? null,
          badges: msg.badges ?? [],
        });
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
      } else if (msg.type === "next_round") {
        resetForNextGame(msg.round);
        // The frame names the round, not its field; the room state does.
        if (koopId) {
          getKoopState(koopId)
            .then((fresh) => setKoopState((prev) => (prev ? { ...prev, category: fresh.category ?? null } : prev)))
            .catch(() => {});
        }
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
    [appendGuess, resetForNextGame, koopId, nickname]
  );

  const { connected: wsConnected } = useKoopWebSocket({
    koopId,
    token: playerToken,
    onMessage: handleWsMessage,
  });

  // Catch up on whatever landed between the first fetch and the socket.
  //
  // The board loads its list over REST and then listens; the broadcast loop
  // seeds its own high-water mark when it first sees the room. A guess written
  // in that gap is in neither, and the list is silently one row short until the
  // page is reloaded. For a koop of four that is a rare second; for a stream
  // chat, where guesses arrive constantly, it is the first word the chat typed.
  const caughtUp = useRef(false);
  useEffect(() => {
    if (!wsConnected || !koopId || caughtUp.current) return;
    caughtUp.current = true;
    getKoopGuesses(koopId)
      .then((list) => {
        setGuesses((prev) => {
          if (list.length <= prev.length) return prev;
          return list.map((g) => ({
            word: g.word,
            rank: g.rank,
            isTip: g.is_tip,
            by: g.nickname,
            source: g.source ?? null,
            badges: g.badges ?? [],
          }));
        });
      })
      .catch(() => {
        // A failed catch-up is not worth an error on screen: the socket is
        // connected, so the next guess arrives either way.
      });
  }, [wsConnected, koopId]);

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
        setPodestError({ word: word.toLowerCase(), message: refusalText("refusalDuplicate", quips, word.toLowerCase()) });
        return;
      }

      setPendingWord(word.toLowerCase());
      try {
        const result = await submitKoopGuess(koopId, word, playerToken);
        if (result.already_guessed || guesses.some((g) => g.word === result.word)) {
          setPodestError({ word: result.word, message: refusalText("refusalDuplicate", quips, result.word) });
          return;
        }
        appendGuess(result.word, result.rank, false, result.corrected_from ?? undefined);
        onEventGuess({ word: result.word, rank: result.rank });
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
        if (e instanceof UnknownWordError) {
          setPodestError({
            word: word.toLowerCase(),
            message: refusalText("refusalUnknown", quips, word.toLowerCase()),
            suggestions: e.suggestions,
          });
        } else if (e instanceof Error && e.message === "stopword") {
          setPodestError({ word: word.toLowerCase(), message: refusalText("refusalStopword", quips, word.toLowerCase()) });
        } else {
          setError("Fehler bei der Verbindung");
        }
      } finally {
        setPendingWord(undefined);
      }
    },
    [koopId, playerToken, guesses, nickname, appendGuess, setPodestError, quips]
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
        setError(tipsDisabledMessage);
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
      setRoundGame(result.game_number);
    } catch {
      setError("Lösungswort konnte nicht geladen werden");
    }
  }, [koopId, playerToken, appendGuess]);

  // Start the next game in the same koop room for everyone.
  const handleNextGame = useCallback(async () => {
    if (!koopId || !playerToken) return;
    try {
      const result = await koopNextGame(koopId, playerToken);
      resetForNextGame(result.round);
      setKoopState((prev) => (prev ? { ...prev, category: result.category ?? null } : prev));
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
    const url = `${window.location.origin}/${basePath}/${koopId}/`;
    const ok = await copyTextToClipboard(url);
    if (ok) toast.success("Link kopiert!");
    else prompt("Link kopieren:", url);
  }, [koopId, basePath]);

  if (loading) {
    return <KoopSkeleton />;
  }

  // Who found the word. The solve frame names them, but it can trail the
  // winning row by a poll tick, and a board that already shows the result must
  // not show it without the finder; the winning row carries the same name.
  const finderName = gaveUp
    ? null
    : solvedBy ?? guesses.find((g) => g.rank === 1 && !g.isTip)?.by ?? null;

  if (!koopId) {
    return (
      landing ?? (
        <RoomLanding
          title="Kein Koop offen"
          description="Ein Koop braucht einen Einladungslink. Erstell einen, dann bekommst du ihn."
          createHref={createHref}
          createLabel="Koop erstellen"
        />
      )
    );
  }

  if (error && !koopState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-destructive">{error}</p>
        <a href={createHref} className="text-primary underline">
          Neu starten
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
    <div className={cn("mx-auto min-h-screen flex flex-col", centerBoard ? "w-full" : "max-w-4xl")}>
      <div className={centerBoard ? cn("md:px-4", BOARD_GRID) : undefined}>
      <div className={centerBoard ? BOARD_COLUMN : undefined}>
      <Header
        onTip={handleTip}
        onGiveUp={() => setShowGiveUp(true)}
        onHowToPlayOpen={() => setShowHowToPlay(true)}
        onSettingsOpen={() => setShowSettings(true)}
        onPastGamesOpen={() => {}}
        tipDisabled={roundOver || !koopState?.tips_allowed}
        giveUpDisabled={roundOver}
        onCopyLink={shareable ? handleCopyLink : undefined}
        hideTip={!koopState?.tips_allowed}
        hidePastGames
        backHref="/"
      />
      </div>
      </div>

      <div
        className={cn(
          "flex-1 px-4 py-4 gap-4",
          centerBoard
            ? cn("grid grid-cols-1 items-start", BOARD_GRID)
            : "flex flex-col md:flex-row"
        )}
      >
        <div
          data-testid="koop-board"
          className={cn(
            "flex flex-col gap-4",
            centerBoard ? BOARD_COLUMN : "flex-1"
          )}
        >
          {/* Mobile sidebar */}
          {!sidebarBelowOnMobile && (
            <div className="md:hidden">
              {sidebar ?? <PlayerBar players={players} currentNickname={nickname ?? ""} />}
            </div>
          )}

          {showInvite && !roundOver && players.length < 2 && (
            <ShareInviteBar
              title="Warte auf Mitspieler …"
              description="Teile den Link, jeder der beitritt rät am selben Wort mit."
              onCopy={handleCopyLink}
            />
          )}

          {roundOver ? (
            <KoopResultCard
              quips={quips}
              gameNumber={roundGame}
              guesses={guesses}
              players={players}
              solvedBy={finderName}
              currentNickname={nickname ?? ""}
              gaveUp={gaveUp}
              onNextGame={handleNextGame}
              label={resultLabel}
              groupNoun={resultGroupNoun}
              rows={resultRows}
              finder={
                renderFinder && finderName
                  ? renderFinder(finderName, guesses.find((g) => g.rank === 1))
                  : undefined
              }
            />
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 -mt-2 -mb-2 text-micro font-medium text-muted-foreground">
                <span>{label}</span>
                <RoomCategoryLabel room={koopState} />
                <span>
                  Versuche:{" "}
                  <span className="text-lead font-bold">{guesses.length}</span>
                </span>
              </div>
              <GuessInput onGuess={handleGuess} disabled={roundOver} error={error} />
            </>
          )}

          <GuessList
            guesses={guesses}
            latestWord={latestWord}
            pendingWord={pendingWord}
            podestError={podestError}
            onSuggestion={handleGuess}
            sortMode={sortMode}
            showNames={showNames}
            renderBy={renderBy}
          />

          {sidebarBelowOnMobile && (
            <div className="md:hidden">
              {sidebar ?? <PlayerBar players={players} currentNickname={nickname ?? ""} />}
            </div>
          )}
        </div>

        {/* Desktop sidebar */}
        <div
          className={centerBoard ? SIDEBAR_COLUMN : "hidden md:block"}
        >
          {sidebar ?? <PlayerBar players={players} currentNickname={nickname ?? ""} />}
        </div>
      </div>

      <HowToPlayDialog open={showHowToPlay} onClose={() => setShowHowToPlay(false)} />
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
      <GiveUpDialog
        open={showGiveUp}
        onClose={() => setShowGiveUp(false)}
        onConfirm={handleGiveUp}
        description={giveUpDescription}
      />
    </div>
  );
}
