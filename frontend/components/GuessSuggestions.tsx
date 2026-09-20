"use client";

interface GuessSuggestionsProps {
  /** Words the mistyped guess might have meant, closest and most common first. */
  suggestions?: string[];
  onSuggestion: (word: string) => void;
}

/**
 * The words offered after a typo the server did not correct by itself.
 *
 * Picking one submits it as the next guess. The order comes from the server and
 * says nothing about the secret word, so this list gives nothing away.
 */
export default function GuessSuggestions({ suggestions, onSuggestion }: GuessSuggestionsProps) {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Meintest du</span>
      {suggestions.map((word) => (
        <button
          key={word}
          type="button"
          onClick={() => onSuggestion(word)}
          className="rounded-full border border-border bg-black/5 px-3 py-1 text-sm font-medium text-foreground hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-white/10 dark:hover:bg-white/20"
        >
          {word}
        </button>
      ))}
    </div>
  );
}
