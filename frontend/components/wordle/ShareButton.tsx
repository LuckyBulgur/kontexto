"use client";

import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TileColor } from "@/lib/wordle-types";
import { reportShare } from "@/lib/analytics";
import { SITE_URL } from "@/lib/seo";

const EMOJI_MAP: Record<TileColor, string> = {
  GREEN: "\u{1F7E9}",
  YELLOW: "\u{1F7E8}",
  GRAY: "\u{2B1B}",
};

interface ShareButtonProps {
  gameNumber: number;
  guesses: string[];
  evaluations: TileColor[][];
  won: boolean;
  hardMode: boolean;
}

export default function ShareButton({ gameNumber, guesses, evaluations, won, hardMode }: ShareButtonProps) {
  const handleShare = () => {
    const score = won ? `${guesses.length}/6` : "X/6";
    const hm = hardMode ? "*" : "";
    const grid = evaluations
      .map((row) => row.map((c) => EMOJI_MAP[c]).join(""))
      .join("\n");

    // Same reason as on the Kontexto card: a shared result without a link is a
    // dead end, and the marker makes the arrivals countable.
    const link = `${SITE_URL}/wordle/?s=${gameNumber}`;
    const text = `W\u00F6rdle ${gameNumber} ${score}${hm}\n\n${grid}\n${link}`;
    void reportShare("wordle");
    navigator.clipboard.writeText(text).then(() => toast("Kopiert!"));
  };

  return (
    <Button onClick={handleShare} className="w-full gap-2">
      <Copy className="w-4 h-4" /> Teilen
    </Button>
  );
}
