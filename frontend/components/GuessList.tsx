"use client";
import { Guess } from "@/lib/types";
import GuessBar from "./GuessBar";

interface GuessListProps { guesses: Guess[]; total: number; latestWord?: string; }

export default function GuessList({ guesses, total, latestWord }: GuessListProps) {
  const sorted = [...guesses].sort((a, b) => a.rank - b.rank);
  if (sorted.length === 0) {
    return <div className="text-center text-gray-400 dark:text-gray-500 py-8">Gib dein erstes Wort ein!</div>;
  }
  return (
    <div className="space-y-0.5">
      {sorted.map((guess, i) => (
        <GuessBar key={`${guess.word}-${i}`} word={guess.word} rank={guess.rank} total={total} isNew={guess.word === latestWord} />
      ))}
    </div>
  );
}
