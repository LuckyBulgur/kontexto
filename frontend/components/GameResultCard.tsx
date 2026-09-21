"use client";
import type { ReactNode } from "react";
import { Guess, getRankColor } from "@/lib/types";
import { loadStreakData } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Panel, ResultHero } from "@/components/design";
import ShareButton from "./ShareButton";

interface GameResultCardProps {
  gameNumber: number;
  guesses: Guess[];
  tipCount: number;
  isWin: boolean;
  onOpenPastGames: () => void;
  onOpenClosestWords: () => void;
  /** Attribution survey, rendered below the share button. The page decides
   * whether it may ask at all (`useSourceSurvey`), the card only places it. */
  survey?: ReactNode;
  /** Endless-mode props. When `infinite` is set the card swaps the daily-streak
   * block + "Vorherige Spiele" button for a session counter and a prominent
   * "Nächstes Spiel" action. */
  infinite?: boolean;
  onNextInfinite?: () => void;
  infiniteSolvedCount?: number;
  noMoreGames?: boolean;
}

/**
 * The card has four zones and one hero, in this order: the word, the tally, the
 * action, the aftermath. It used to be seven stacked blocks of the same size,
 * five of them in muted ink, so nothing told the eye where to start.
 */
function getBreakdown(guesses: Guess[]) {
  const counts = { green: 0, yellow: 0, red: 0 };
  for (const g of guesses) {
    counts[getRankColor(g.rank)]++;
  }
  return [
    // The emoji squares are the share text's alphabet and stay as they are; a
    // different set would break every result already posted elsewhere.
    { key: "green", emoji: "\u{1f7e9}", label: "nah", count: counts.green },
    { key: "yellow", emoji: "\u{1f7e8}", label: "mittel", count: counts.yellow },
    { key: "red", emoji: "\u{1f7e5}", label: "weit", count: counts.red },
  ].filter((row) => row.count > 0);
}

/** German counts: one Versuch, two Versuchen. The dative plural is what the
 *  sentence needs, so both forms are passed in rather than guessed. */
function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export default function GameResultCard({ gameNumber, guesses, tipCount, isWin, onOpenPastGames, onOpenClosestWords, survey, infinite, onNextInfinite, infiniteSolvedCount, noMoreGames }: GameResultCardProps) {
  const streak = loadStreakData();

  const givenUp = !isWin;
  const solvedWord = guesses.find((g) => g.rank === 1)?.word ?? "";
  const displayGuesses = givenUp ? guesses.filter((g) => g.rank !== 1) : guesses;
  const guessCount = givenUp ? guesses.length - 1 : guesses.length;
  const breakdown = getBreakdown(displayGuesses);
  const hasStreak = streak.currentStreak > 0 || streak.longestStreak > 0;

  return (
    <Panel className="animate-result-in gap-6">
      <ResultHero
        eyebrow={infinite ? "Das Wort war" : `Spiel #${gameNumber}, das Wort war`}
        headline={solvedWord}
        lost={givenUp}
        support={`${isWin ? "Gelöst in" : "Aufgegeben nach"} ${plural(guessCount, "Versuch", "Versuchen")}${
          tipCount > 0 ? ` und ${plural(tipCount, "Tipp", "Tipps")}` : " ohne Tipp"
        }.${isWin ? " Stark!" : ""}`}
      />

      {breakdown.length > 0 && (
        // A tally, not three stacked stats: with one tone present a stat column
        // sits alone on the left and reads as a broken layout.
        <div className="flex flex-wrap items-baseline justify-center gap-x-6 gap-y-2">
          {breakdown.map((row) => (
            <span key={row.key} className="flex items-baseline gap-1.5 text-small text-muted-foreground">
              <span aria-hidden="true">{row.emoji}</span>
              <span data-numeric className="font-display text-lead font-bold text-foreground">
                {row.count}
              </span>
              {row.label}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <ShareButton gameNumber={gameNumber} guesses={guesses} tipCount={tipCount} givenUp={givenUp} infinite={infinite} />
        {infinite ? (
          noMoreGames ? (
            <p className="text-center text-small text-muted-foreground">
              Du hast alle verfügbaren Spiele gespielt. Schau später für neue Rätsel vorbei.
            </p>
          ) : (
            <Button size="lg" variant="outline" onClick={onNextInfinite}>
              Nächstes Spiel
            </Button>
          )
        ) : null}
      </div>

      {survey}

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <p className="text-micro text-muted-foreground">
          {infinite ? (
            <>
              Im Unendlich-Modus gelöst:{" "}
              <span data-numeric className="font-semibold text-foreground">{infiniteSolvedCount ?? 0}</span>
            </>
          ) : hasStreak ? (
            <>
              Aktuelle Serie <span data-numeric className="font-semibold text-foreground">{streak.currentStreak}</span>{" "}
              {streak.currentStreak === 1 ? "Tag" : "Tage"}, längste{" "}
              <span data-numeric className="font-semibold text-foreground">{streak.longestStreak}</span>{" "}
              {streak.longestStreak === 1 ? "Tag" : "Tage"}
            </>
          ) : (
            "Komm morgen wieder, dann startet deine Serie."
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {!infinite && (
            <Button variant="ghost" size="sm" onClick={onOpenPastGames}>
              Vorherige Spiele
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onOpenClosestWords}>
            Ähnlichste Wörter
          </Button>
        </div>
      </div>
    </Panel>
  );
}
