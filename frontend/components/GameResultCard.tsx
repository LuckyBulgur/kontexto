"use client";
import { Guess, getRankColor } from "@/lib/types";
import { loadStreakData } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import ShareButton from "./ShareButton";

interface GameResultCardProps {
  gameNumber: number;
  guesses: Guess[];
  tipCount: number;
  isWin: boolean;
  onOpenPastGames: () => void;
  onOpenClosestWords: () => void;
}

function getEmojiBreakdown(guesses: Guess[]) {
  const colorMap = { green: "\u{1f7e9}", yellow: "\u{1f7e8}", red: "\u{1f7e5}" };
  const counts = { green: 0, yellow: 0, red: 0 };
  for (const g of guesses) {
    counts[getRankColor(g.rank)]++;
  }
  const rows: { emoji: string; count: number }[] = [];
  if (counts.green > 0) rows.push({ emoji: colorMap.green, count: counts.green });
  if (counts.yellow > 0) rows.push({ emoji: colorMap.yellow, count: counts.yellow });
  if (counts.red > 0) rows.push({ emoji: colorMap.red, count: counts.red });
  return rows;
}

export default function GameResultCard({ gameNumber, guesses, tipCount, isWin, onOpenPastGames, onOpenClosestWords }: GameResultCardProps) {
  const streak = loadStreakData();

  const givenUp = !isWin;
  const solvedWord = guesses.find((g) => g.rank === 1)?.word ?? "";
  const displayGuesses = givenUp ? guesses.filter((g) => g.rank !== 1) : guesses;
  const guessCount = givenUp ? guesses.length - 1 : guesses.length;
  const breakdown = getEmojiBreakdown(displayGuesses);

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4 text-center">
      <h2 className="text-xl font-bold">
        {isWin ? "Herzlichen Glückwunsch!" : "Viel Glück beim nächsten Mal!"}
      </h2>

      <div className="text-muted-foreground space-y-0.5">
        <p>
          {isWin
            ? `Du hast das Wort #${gameNumber} gelöst`
            : `Du hast das Wort #${gameNumber} aufgegeben`}
        </p>
        <p>in {guessCount} Versuchen und {tipCount} Tipps.</p>
      </div>

      <p className="text-muted-foreground">
        Das Wort war <strong className="text-foreground text-lg uppercase">{solvedWord}</strong>.
      </p>

      <div className="flex flex-col items-center gap-1">
        {breakdown.map((row) => (
          <div key={row.emoji} className="flex items-center gap-2 text-base">
            <span>{row.emoji.repeat(Math.min(row.count, 10))}</span>
            <span className="text-muted-foreground text-sm">{row.count}</span>
          </div>
        ))}
      </div>

      <div className="flex justify-center">
        <ShareButton gameNumber={gameNumber} guesses={guesses} tipCount={tipCount} givenUp={givenUp} />
      </div>

      {(streak.currentStreak > 0 || streak.longestStreak > 0) && (
        <div className="rounded-lg border bg-muted/50 p-3 space-y-0.5 text-sm text-muted-foreground">
          <p>Aktuelle Serie: <span className="font-semibold text-foreground">{streak.currentStreak}</span> Tag(e)</p>
          <p>Längste Serie: <span className="font-semibold text-foreground">{streak.longestStreak}</span> Tag(e) 🔥</p>
        </div>
      )}

      <div className="flex justify-center gap-3">
        <Button variant="outline" onClick={onOpenPastGames}>
          Vorherige Spiele
        </Button>
        <Button variant="outline" onClick={onOpenClosestWords}>
          Ähnlichste Wörter
        </Button>
      </div>
    </div>
  );
}
