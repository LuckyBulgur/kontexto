"use client";
import { Guess, getRankColor } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ShareButtonProps {
  gameNumber: number;
  guesses: Guess[];
  tipCount: number;
}

export default function ShareButton({ gameNumber, guesses, tipCount }: ShareButtonProps) {
  const handleShare = async () => {
    const colorMap = { green: "\u{1f7e9}", yellow: "\u{1f7e8}", red: "\u{1f7e5}" };
    const squares = guesses.map((g) => colorMap[getRankColor(g.rank)]).join("");
    const text = [
      `Kontexto #${gameNumber} \u{1f1e9}\u{1f1ea}`,
      squares,
      `Gelöst in ${guesses.length} Versuchen und ${tipCount} Tipps.`,
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
      Ergebnis teilen
    </Button>
  );
}
