"use client";
import { Guess, SortMode } from "@/lib/types";
import GuessBar from "./GuessBar";

interface GuessListProps { guesses: Guess[]; total: number; sortMode: SortMode; latestWord?: string; }

export default function GuessList({ guesses, total, sortMode, latestWord }: GuessListProps) {
  const sorted = sortMode === "rank" ? [...guesses].sort((a, b) => a.rank - b.rank) : guesses;
  if (sorted.length === 0) {
    return <div className="text-center text-gray-400 dark:text-gray-500 py-8">Gib dein erstes Wort ein!</div>;
  }
  return (
    <div className="space-y-0.5 max-h-[60vh] overflow-y-auto pr-1">
      {sorted.map((guess, i) => (
        <GuessBar key={`${guess.word}-${i}`} word={guess.word} rank={guess.rank} total={total} isNew={guess.word === latestWord} />
      ))}
    </div>
  );
}
