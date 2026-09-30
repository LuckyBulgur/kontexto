"use client";
import { Guess, getRankColor } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { reportShare } from "@/lib/analytics";
import { SITE_URL } from "@/lib/seo";
import { SPOOKTOBER_2026, isSkinOn } from "@/lib/event-theme";

interface ShareButtonProps {
  gameNumber: number;
  guesses: Guess[];
  tipCount: number;
  givenUp?: boolean;
  /** Endless mode: the game number is intentionally hidden, so it is omitted
   * from the shared text as well. */
  infinite?: boolean;
}

export default function ShareButton({ gameNumber, guesses, tipCount, givenUp, infinite }: ShareButtonProps) {
  const handleShare = async () => {
    const colorMap = { green: "\u{1f7e9}", yellow: "\u{1f7e8}", red: "\u{1f7e5}" };
    const displayGuesses = givenUp ? guesses.filter((g) => g.rank !== 1) : guesses;
    const squares = displayGuesses.map((g) => colorMap[getRankColor(g.rank)]).join("");
    const guessCount = givenUp ? guesses.length - 1 : guesses.length;
    const statusLine = givenUp
      ? `Aufgegeben nach ${guessCount} Versuchen und ${tipCount} Tipps.`
      : `Gelöst in ${guessCount} Versuchen und ${tipCount} Tipps.`;
    // In October the heading carries a pumpkin after the flag. The squares
    // stay exactly as they are all year: they are the result's alphabet.
    const season = isSkinOn(SPOOKTOBER_2026) ? "\u{1f383}" : "";
    const heading = infinite
      ? `Kontexto Unendlich-Modus \u{1f1e9}\u{1f1ea}${season}`
      : `Kontexto #${gameNumber} \u{1f1e9}\u{1f1ea}${season}`;
    // The link is the point of sharing: without it the result travels and the
    // game does not. The marker also makes those arrivals countable, which no
    // referrer header can do for a link pasted into a messenger.
    const link = `${SITE_URL}/?s=${infinite ? "u" : gameNumber}`;
    const text = [
      heading,
      squares,
      statusLine,
      link,
    ].join("\n");
    void reportShare(infinite ? "infinite" : "kontexto");
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
