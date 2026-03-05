"use client";
import { Guess, SortMode } from "@/lib/types";
import GuessBar from "./GuessBar";
import { cn } from "@/lib/utils";

interface GuessListProps {
  guesses: Guess[];
  total: number;
  latestWord?: string;
  pendingWord?: string;
  podestError?: { word: string; message: string };
  sortMode: SortMode;
}

export default function GuessList({ guesses, total, latestWord, pendingWord, podestError, sortMode }: GuessListProps) {
  const sorted = sortMode === "rank"
    ? [...guesses].sort((a, b) => a.rank - b.rank)
    : [...guesses];
  const latest = latestWord ? guesses.find((g) => g.word === latestWord) : undefined;
  const showPodest = !!pendingWord || !!podestError || !!latest;
  return (
    <div className="space-y-0.5">
      {showPodest && (
        <div className="mt-[9px] mb-[25px]">
          {pendingWord ? (
            <p className="text-sm text-foreground animate-pulse">Lädt...</p>
          ) : podestError ? (
            <p className="text-sm text-foreground font-medium">{podestError.message}</p>
          ) : latest ? (
            <GuessBar word={latest.word} rank={latest.rank} total={total} isNew size="lg" />
          ) : null}
        </div>
      )}
      {sorted.map((guess, i) => (
        <GuessBar key={`${guess.word}-${i}`} word={guess.word} rank={guess.rank} total={total} isNew={guess.word === latestWord} />
      ))}
    </div>
  );
}
