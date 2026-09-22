"use client";
import { Guess, SortMode } from "@/lib/types";
import GuessBar from "./GuessBar";
import GuessSuggestions from "./GuessSuggestions";
import { cn } from "@/lib/utils";

export interface PodestError {
  word: string;
  message: string;
  /** Words the mistyped guess might have meant. Only set for an unknown word
   *  the server could not correct on its own. */
  suggestions?: string[];
}

interface GuessListProps {
  guesses: Guess[];
  total: number;
  latestWord?: string;
  pendingWord?: string;
  podestError?: PodestError;
  /** Submits a suggestion as the next guess. Without it no suggestions show. */
  onSuggestion?: (word: string) => void;
  sortMode: SortMode;
  /** Prints the name of whoever played each row above its bar. Off by default,
   *  because in every other mode the answer is "you". */
  showNames?: boolean;
}

export default function GuessList({ guesses, total, latestWord, pendingWord, podestError, onSuggestion, sortMode, showNames }: GuessListProps) {
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
            <p className="text-small text-foreground animate-pulse">Lädt...</p>
          ) : podestError ? (
            <>
              <p className="text-small text-foreground font-medium">{podestError.message}</p>
              {onSuggestion && (
                <GuessSuggestions suggestions={podestError.suggestions} onSuggestion={onSuggestion} />
              )}
            </>
          ) : latest ? (
            <>
              <GuessBar
                word={latest.word}
                rank={latest.rank}
                total={total}
                isNew
                size="lg"
                by={showNames ? latest.by : undefined}
              />
              {latest.correctedFrom && (
                <p className="mt-1 text-small text-muted-foreground">
                  „{latest.correctedFrom}“ wurde als „{latest.word}“ gewertet
                </p>
              )}
            </>
          ) : null}
        </div>
      )}
      {sorted.map((guess, i) => (
        <GuessBar
          key={`${guess.word}-${i}`}
          word={guess.word}
          rank={guess.rank}
          total={total}
          isNew={guess.word === latestWord}
          by={showNames ? guess.by : undefined}
        />
      ))}
    </div>
  );
}
