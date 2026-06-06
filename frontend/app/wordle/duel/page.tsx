"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import Board from "@/components/wordle/Board";
import Keyboard from "@/components/wordle/Keyboard";
import OpponentBoard from "@/components/wordle/duel/OpponentBoard";
import DuelHeader from "@/components/wordle/duel/DuelHeader";
import DuelResultCard from "@/components/wordle/duel/DuelResultCard";
import { useWordleDuelWs } from "@/lib/use-wordle-duel-ws";
import {
  getWordleDuelState, submitWordleDuelGuess, getWordleDuelHistory, joinWordleDuel,
} from "@/lib/wordle-api";
import { loadDuelToken, saveDuelToken, loadDuelNickname, saveDuelNickname } from "@/lib/wordle-storage";
import type { TileColor, WordleDuelPlayer, WordleDuelWsMessage, GameStatus } from "@/lib/wordle-types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy } from "lucide-react";
import Link from "next/link";

export default function WordleDuelPage() {
  // Extract duel_id from URL path: /wordle/duel/{id}/
  const [duelId, setDuelId] = useState<string | null>(null);
  const [playerToken, setPlayerToken] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [players, setPlayers] = useState<WordleDuelPlayer[]>([]);
  const [gameNumber, setGameNumber] = useState<number | null>(null);

  // Own game state
  const [guesses, setGuesses] = useState<string[]>([]);
  const [evaluations, setEvaluations] = useState<TileColor[][]>([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [gameStatus, setGameStatus] = useState<GameStatus>("playing");
  const [letterStates, setLetterStates] = useState<Map<string, "green" | "yellow" | "gray">>(new Map());
  const [shakeRow, setShakeRow] = useState<number | null>(null);
  const [wonRow, setWonRow] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Opponent guesses (colors only)
  const [opponentGuesses, setOpponentGuesses] = useState<Map<string, TileColor[][]>>(new Map());

  // Join dialog
  const [showJoin, setShowJoin] = useState(false);
  const [joinNickname, setJoinNickname] = useState("");

  // Extract duel_id from pathname
  useEffect(() => {
    const parts = window.location.pathname.split("/").filter(Boolean);
    // /wordle/duel/{id}
    const duelIdx = parts.indexOf("duel");
    if (duelIdx >= 0 && parts[duelIdx + 1]) {
      const id = parts[duelIdx + 1];
      setDuelId(id);
      const token = loadDuelToken(id);
      if (token) {
        setPlayerToken(token);
        const nick = loadDuelNickname(id);
        if (nick) setNickname(nick);
      } else {
        setShowJoin(true);
      }
    }
  }, []);

  // Load initial state
  useEffect(() => {
    if (!duelId || !playerToken) return;

    const load = async () => {
      const state = await getWordleDuelState(duelId);
      setPlayers(state.players);
      setGameNumber(state.game_number);

      // Seed opponent boards with their already-played rows (colours only).
      // Merge instead of replace: a guess_made may have arrived over the WS
      // during the await above — never shrink what we already have.
      const myNick = loadDuelNickname(duelId);
      setOpponentGuesses((prev) => {
        const next = new Map(prev);
        for (const p of state.players) {
          if (p.nickname === myNick || !p.results || p.results.length === 0) continue;
          const existing = next.get(p.nickname);
          if (!existing || p.results.length > existing.length) {
            next.set(p.nickname, p.results);
          }
        }
        return next;
      });

      const history = await getWordleDuelHistory(duelId, playerToken);
      const gs: string[] = [];
      const evs: TileColor[][] = [];
      for (const g of history.guesses) {
        gs.push(g.word);
        evs.push(g.result);
      }
      setGuesses(gs);
      setEvaluations(evs);

      const won = evs.length > 0 && evs[evs.length - 1].every((c) => c === "GREEN");
      const lost = !won && gs.length >= 6;
      setGameStatus(won ? "won" : lost ? "lost" : "playing");

      // Rebuild letter states
      const states = new Map<string, "green" | "yellow" | "gray">();
      for (let g = 0; g < gs.length; g++) {
        for (let i = 0; i < 5; i++) {
          const letter = gs[g][i];
          const color = evs[g][i] === "GREEN" ? "green" : evs[g][i] === "YELLOW" ? "yellow" : "gray";
          const current = states.get(letter);
          if (color === "green") states.set(letter, "green");
          else if (color === "yellow" && current !== "green") states.set(letter, "yellow");
          else if (color === "gray" && !current) states.set(letter, "gray");
        }
      }
      setLetterStates(states);
    };
    load();
  }, [duelId, playerToken]);

  // WebSocket handler
  const handleWsMessage = useCallback((msg: WordleDuelWsMessage) => {
    if (msg.type === "state") {
      setPlayers(msg.players);
      const myNick = duelId ? loadDuelNickname(duelId) : null;
      setOpponentGuesses((prev) => {
        const next = new Map(prev);
        for (const p of msg.players) {
          if (p.nickname === myNick || !p.results || p.results.length === 0) continue;
          const existing = next.get(p.nickname);
          if (!existing || p.results.length > existing.length) {
            next.set(p.nickname, p.results);
          }
        }
        return next;
      });
    } else if (msg.type === "player_joined") {
      toast(`${msg.nickname} ist beigetreten`);
      setPlayers((prev) =>
        prev.some((p) => p.nickname === msg.nickname)
          ? prev
          : [...prev, { nickname: msg.nickname, guesses_used: 0, solved: false, connected: true }]
      );
    } else if (msg.type === "guess_made") {
      setOpponentGuesses((prev) => {
        const existing = prev.get(msg.nickname) || [];
        // Idempotent by guess number — ignore duplicates (e.g. a row already
        // seeded via a `state` message after a reconnect).
        if (msg.guess_number <= existing.length) return prev;
        const next = new Map(prev);
        const updated = existing.slice();
        updated[msg.guess_number - 1] = msg.result;
        next.set(msg.nickname, updated);
        return next;
      });
      setPlayers((prev) =>
        prev.map((p) => p.nickname === msg.nickname ? { ...p, guesses_used: msg.guess_number } : p)
      );
    } else if (msg.type === "player_solved") {
      toast(`${msg.nickname} hat gelöst in ${msg.guesses_used} Versuchen!`);
      setPlayers((prev) =>
        prev.map((p) => p.nickname === msg.nickname ? { ...p, solved: true, guesses_used: msg.guesses_used } : p)
      );
    } else if (msg.type === "player_failed") {
      toast(`${msg.nickname} hat nicht gelöst`);
    } else if (msg.type === "player_disconnected") {
      setPlayers((prev) =>
        prev.map((p) => p.nickname === msg.nickname ? { ...p, connected: false } : p)
      );
    } else if (msg.type === "player_reconnected") {
      setPlayers((prev) =>
        prev.map((p) => p.nickname === msg.nickname ? { ...p, connected: true } : p)
      );
    }
  }, [duelId]);

  useWordleDuelWs({ duelId, token: playerToken, onMessage: handleWsMessage });

  // Join handler
  const handleJoin = async () => {
    if (!duelId || !joinNickname.trim()) return;
    try {
      const resp = await joinWordleDuel(duelId, joinNickname.trim());
      saveDuelToken(duelId, resp.player_token);
      saveDuelNickname(duelId, resp.nickname);
      setPlayerToken(resp.player_token);
      setNickname(resp.nickname);
      setPlayers(resp.players);
      setGameNumber(resp.game_number);
      setShowJoin(false);
    } catch {
      toast("Fehler beim Beitreten");
    }
  };

  // Guess submission
  const submitGuess = useCallback(async () => {
    if (!duelId || !playerToken || submitting || gameStatus !== "playing") return;
    const word = currentGuess.toLowerCase();
    if (word.length < 5) {
      toast("Nicht genug Buchstaben");
      setShakeRow(guesses.length);
      setTimeout(() => setShakeRow(null), 600);
      return;
    }

    setSubmitting(true);
    try {
      const resp = await submitWordleDuelGuess(duelId, word, playerToken);
      if (!resp.valid) {
        toast(resp.error === "not_in_word_list" ? "Nicht im Wörterbuch" : "Fehler");
        setShakeRow(guesses.length);
        setTimeout(() => setShakeRow(null), 600);
        return;
      }

      const newGuesses = [...guesses, word];
      const newEvals = [...evaluations, resp.result!];
      const won = resp.result!.every((c) => c === "GREEN");
      const lost = !won && newGuesses.length >= 6;

      setGuesses(newGuesses);
      setEvaluations(newEvals);
      setCurrentGuess("");
      setGameStatus(won ? "won" : lost ? "lost" : "playing");

      // Update letter states
      setLetterStates((prev) => {
        const next = new Map(prev);
        for (let i = 0; i < 5; i++) {
          const letter = word[i];
          const color = resp.result![i] === "GREEN" ? "green" as const : resp.result![i] === "YELLOW" ? "yellow" as const : "gray" as const;
          const current = next.get(letter);
          if (color === "green") next.set(letter, "green");
          else if (color === "yellow" && current !== "green") next.set(letter, "yellow");
          else if (color === "gray" && !current) next.set(letter, "gray");
        }
        return next;
      });

      // Update own player in list
      setPlayers((prev) =>
        prev.map((p) => p.nickname === nickname ? { ...p, guesses_used: newGuesses.length, solved: won } : p)
      );

      if (won) {
        setTimeout(() => {
          setWonRow(newGuesses.length - 1);
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        }, 1800);
      }
    } finally {
      setSubmitting(false);
    }
  }, [duelId, playerToken, currentGuess, guesses, evaluations, submitting, gameStatus, nickname]);

  const handleKey = useCallback((key: string) => {
    if (gameStatus !== "playing") return;
    if (key === "ENTER") { submitGuess(); return; }
    if (key === "BACKSPACE") { setCurrentGuess((prev) => prev.slice(0, -1)); return; }
    if (/^[A-Za-z]$/.test(key) && currentGuess.length < 5) {
      setCurrentGuess((prev) => prev + key.toLowerCase());
    }
  }, [gameStatus, currentGuess, submitGuess]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Enter") handleKey("ENTER");
      else if (e.key === "Backspace") handleKey("BACKSPACE");
      else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleKey]);

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/wordle/duel/${duelId}/`);
    toast("Link kopiert!");
  };

  const allFinished = players.length > 1 && players.every((p) => p.solved || p.guesses_used >= 6);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <Link href="/wordle" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← Wördle
        </Link>
        <span className="text-lg font-bold tracking-wider">DUELL</span>
        <button onClick={copyLink} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
          <Copy className="w-5 h-5" />
        </button>
      </header>

      {players.length > 0 && <DuelHeader players={players} currentNickname={nickname} />}

      <div className="flex flex-col lg:flex-row items-start justify-center gap-6 px-4">
        {/* Opponent boards */}
        <div className="flex gap-4 flex-wrap justify-center lg:order-2">
          {players
            .filter((p) => p.nickname !== nickname)
            .map((p) => (
              <OpponentBoard
                key={p.nickname}
                nickname={p.nickname}
                guesses={opponentGuesses.get(p.nickname) || []}
                solved={p.solved}
              />
            ))}
        </div>

        {/* Own board */}
        <div className="lg:order-1">
          <Board
            guesses={guesses}
            evaluations={evaluations}
            currentGuess={currentGuess}
            currentRow={guesses.length}
            shakeRow={shakeRow}
            wonRow={wonRow}
          />
        </div>
      </div>

      <Keyboard letterStates={letterStates} onKey={handleKey} />

      {allFinished && <DuelResultCard players={players} currentNickname={nickname} />}

      {/* Join Dialog */}
      <Dialog open={showJoin} onOpenChange={setShowJoin}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Wördle Duell beitreten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Dein Nickname</Label>
              <Input
                value={joinNickname}
                onChange={(e) => setJoinNickname(e.target.value)}
                placeholder="z.B. Anna"
                maxLength={20}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
            </div>
            <Button onClick={handleJoin} disabled={!joinNickname.trim()} className="w-full">
              Beitreten
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
