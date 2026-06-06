"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import Board from "./Board";
import Keyboard from "./Keyboard";
import type { TileColor, GameStatus } from "@/lib/wordle-types";
import { getWordleGame, submitWordleGuess } from "@/lib/wordle-api";
import {
  loadWordleState, saveWordleState,
  loadWordleRandomState, saveWordleRandomState, loadHardMode,
  updateStatsAfterGame,
  type WordleGameState,
} from "@/lib/wordle-storage";

const WIN_MESSAGES = ["Genial!", "Gro\u00DFartig!", "Stark!", "Gut!", "Knapp!", "Gerade so!"];

interface WordleGameProps {
  mode?: "daily" | "random";
  gameNumber?: number | null;
  onStatsOpen?: () => void;
  onGameEnd?: (won: boolean, guessCount: number) => void;
}

export default function WordleGame({ mode = "daily", gameNumber: forcedGameNumber = null, onStatsOpen, onGameEnd }: WordleGameProps) {
  const [gameNumber, setGameNumber] = useState<number | null>(null);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [evaluations, setEvaluations] = useState<TileColor[][]>([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [gameStatus, setGameStatus] = useState<GameStatus>("playing");
  const [letterStates, setLetterStates] = useState<Map<string, "green" | "yellow" | "gray">>(new Map());
  const [shakeRow, setShakeRow] = useState<number | null>(null);
  const [wonRow, setWonRow] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const hardMode = loadHardMode();

  const loadState = mode === "random" ? loadWordleRandomState : loadWordleState;
  const saveState = mode === "random" ? saveWordleRandomState : saveWordleState;

  // Load game on mount
  useEffect(() => {
    const init = (game_number: number) => {
      setGameNumber(game_number);
      const saved = loadState(game_number);
      if (saved) {
        setGuesses(saved.guesses);
        setEvaluations(saved.evaluations);
        setGameStatus(saved.status);
        // Rebuild letter states (green > yellow > gray priority)
        const states = new Map<string, "green" | "yellow" | "gray">();
        for (let g = 0; g < saved.guesses.length; g++) {
          for (let i = 0; i < 5; i++) {
            const letter = saved.guesses[g][i];
            const color = saved.evaluations[g][i];
            const mapped: "green" | "yellow" | "gray" = color === "GREEN" ? "green" : color === "YELLOW" ? "yellow" : "gray";
            const current = states.get(letter);
            if (mapped === "green") {
              states.set(letter, "green");
            } else if (mapped === "yellow" && current !== "green") {
              states.set(letter, "yellow");
            } else if (mapped === "gray" && !current) {
              states.set(letter, "gray");
            }
          }
        }
        setLetterStates(states);
      }
    };

    if (mode === "random") {
      if (forcedGameNumber !== null) init(forcedGameNumber);
    } else {
      getWordleGame().then(({ game_number }) => init(game_number));
    }
  }, []);

  const updateLetterStates = useCallback((guess: string, evaluation: TileColor[]) => {
    setLetterStates((prev) => {
      const next = new Map(prev);
      for (let i = 0; i < 5; i++) {
        const letter = guess[i];
        const color = evaluation[i] === "GREEN" ? "green" : evaluation[i] === "YELLOW" ? "yellow" : "gray";
        const current = next.get(letter);
        if (color === "green") {
          next.set(letter, "green");
        } else if (color === "yellow" && current !== "green") {
          next.set(letter, "yellow");
        } else if (color === "gray" && !current) {
          next.set(letter, "gray");
        }
      }
      return next;
    });
  }, []);

  const shake = useCallback(() => {
    setShakeRow(guesses.length);
    setTimeout(() => setShakeRow(null), 600);
  }, [guesses.length]);

  const submitGuess = useCallback(async () => {
    if (gameNumber === null || submitting || gameStatus !== "playing") return;

    const word = currentGuess.toLowerCase();
    if (word.length < 5) {
      toast("Nicht genug Buchstaben");
      shake();
      return;
    }

    setSubmitting(true);
    try {
      const previous = guesses.map((g, i) => ({ word: g, result: evaluations[i] }));
      const resp = await submitWordleGuess(word, gameNumber, hardMode, previous);

      if (!resp.valid) {
        if (resp.error === "not_in_word_list") {
          toast("Nicht im W\u00F6rterbuch");
        } else if (resp.error === "hard_mode_violation") {
          toast(resp.message || "Hard Mode Versto\u00DF");
        }
        shake();
        return;
      }

      const newGuesses = [...guesses, word];
      const newEvaluations = [...evaluations, resp.result!];
      const won = resp.result!.every((c) => c === "GREEN");
      const lost = !won && newGuesses.length >= 6;
      const newStatus: GameStatus = won ? "won" : lost ? "lost" : "playing";

      setGuesses(newGuesses);
      setEvaluations(newEvaluations);
      setCurrentGuess("");
      setGameStatus(newStatus);
      updateLetterStates(word, resp.result!);

      // Save state
      const state: WordleGameState = {
        gameNumber,
        guesses: newGuesses,
        evaluations: newEvaluations,
        status: newStatus,
      };
      saveState(state);

      if (won) {
        // Delay win effects until flip animation completes (~1.8s)
        setTimeout(() => {
          setWonRow(newGuesses.length - 1);
          toast(WIN_MESSAGES[newGuesses.length - 1] || "Gewonnen!");
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
          if (mode === "daily") {
            updateStatsAfterGame(gameNumber, true, newGuesses.length);
            onGameEnd?.(true, newGuesses.length);
          }
        }, 1800);
      } else if (lost) {
        setTimeout(async () => {
          // Show the solution word on loss
          const { revealWordleAnswer } = await import("@/lib/wordle-api");
          try {
            const { word } = await revealWordleAnswer(gameNumber);
            toast(word.toUpperCase(), { duration: 5000 });
          } catch {}
          if (mode === "daily") {
            updateStatsAfterGame(gameNumber, false, 6);
            onGameEnd?.(false, 6);
          }
        }, 1800);
      }
    } finally {
      setSubmitting(false);
    }
  }, [gameNumber, currentGuess, guesses, evaluations, submitting, gameStatus, hardMode, shake, updateLetterStates, onGameEnd, mode, saveState]);

  const handleKey = useCallback((key: string) => {
    if (gameStatus !== "playing") return;

    if (key === "ENTER") {
      submitGuess();
      return;
    }
    if (key === "BACKSPACE") {
      setCurrentGuess((prev) => prev.slice(0, -1));
      return;
    }
    if (/^[A-Za-z]$/.test(key) && currentGuess.length < 5) {
      setCurrentGuess((prev) => prev + key.toLowerCase());
    }
  }, [gameStatus, currentGuess, submitGuess]);

  // Physical keyboard listener
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

  if (gameNumber === null) {
    return <div className="flex justify-center py-20 text-zinc-500">Laden...</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center max-w-lg mx-auto gap-6" style={{ height: "calc(100vh - 57px)" }}>
      <div style={{ marginTop: "-8vh" }}>
        <Board
          guesses={guesses}
          evaluations={evaluations}
          currentGuess={currentGuess}
          currentRow={guesses.length}
          shakeRow={shakeRow}
          wonRow={wonRow}
        />
      </div>
      <Keyboard letterStates={letterStates} onKey={handleKey} />
    </div>
  );
}
