"use client";
import { Guess, SortMode } from "@/lib/types";
import GuessBar from "./GuessBar";

interface GuessListProps {
  guesses: Guess[];
  total: number;
  latestWord?: string;
  sortMode: SortMode;
}

export default function GuessList({ guesses, total, latestWord, sortMode }: GuessListProps) {
  const sorted = sortMode === "rank"
    ? [...guesses].sort((a, b) => a.rank - b.rank)
    : [...guesses];
  if (sorted.length === 0) {
    return null;
  }
  return (
    <div className="space-y-0.5">
      {sorted.map((guess, i) => (
        <GuessBar key={`${guess.word}-${i}`} word={guess.word} rank={guess.rank} total={total} isNew={guess.word === latestWord} />
      ))}
    </div>
  );
}
