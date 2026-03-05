"use client";
import { Guess, getRankColor } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ShareButtonProps {
  gameNumber: number;
  guesses: Guess[];
  tipCount: number;
  givenUp?: boolean;
}

export default function ShareButton({ gameNumber, guesses, tipCount, givenUp }: ShareButtonProps) {
  const handleShare = async () => {
    const colorMap = { green: "\u{1f7e9}", yellow: "\u{1f7e8}", red: "\u{1f7e5}" };
    const displayGuesses = givenUp ? guesses.filter((g) => g.rank !== 1) : guesses;
    const squares = displayGuesses.map((g) => colorMap[getRankColor(g.rank)]).join("");
    const guessCount = givenUp ? guesses.length - 1 : guesses.length;
    const statusLine = givenUp
      ? `Aufgegeben nach ${guessCount} Versuchen und ${tipCount} Tipps.`
      : `Gelöst in ${guessCount} Versuchen und ${tipCount} Tipps.`;
    const text = [
      `Kontexto #${gameNumber} \u{1f1e9}\u{1f1ea}`,
      squares,
      statusLine,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Ergebnis kopiert!");
    } catch {
      prompt("Ergebnis kopieren:", text);
    }
  };

  return (
    <Button onClick={handleShare} size="lg">
      {givenUp ? "Trotzdem teilen" : "Ergebnis teilen"}
    </Button>
  );
}
