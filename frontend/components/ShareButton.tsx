"use client";
import { useState } from "react";
import { Guess, getRankColor } from "@/lib/types";

interface ShareButtonProps { gameNumber: number; guesses: Guess[]; tipCount: number; }

export default function ShareButton({ gameNumber, guesses, tipCount }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const colorMap = { green: "\u{1f7e9}", yellow: "\u{1f7e8}", red: "\u{1f7e5}" };
    const squares = guesses.map((g) => colorMap[getRankColor(g.rank)]).join("");
    const text = [`Kontexto #${gameNumber} \u{1f1e9}\u{1f1ea}`, squares, `Gel\u{00f6}st in ${guesses.length} Versuchen und ${tipCount} Tipps.`].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("Ergebnis kopieren:", text);
    }
  };

  return (
    <button onClick={handleShare} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors">
      {copied ? "Kopiert!" : "Ergebnis teilen"}
    </button>
  );
}
