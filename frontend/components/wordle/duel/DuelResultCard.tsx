"use client";

import type { WordleDuelPlayer } from "@/lib/wordle-types";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DuelResultCardProps {
  players: WordleDuelPlayer[];
  currentNickname: string | null;
  /** When set, shows a prominent "Nächstes Spiel" button (rematch). */
  onNextGame?: () => void;
}

export default function DuelResultCard({ players, currentNickname, onNextGame }: DuelResultCardProps) {
  const sorted = [...players].sort((a, b) => {
    if (a.solved && !b.solved) return -1;
    if (!a.solved && b.solved) return 1;
    return a.guesses_used - b.guesses_used;
  });

  return (
    <div className="max-w-sm mx-auto rounded-xl border bg-card p-6 my-4">
      <h3 className="text-lg font-bold text-center mb-4">Duell Ergebnis</h3>
      <div className="space-y-3">
        {sorted.map((p, i) => (
          <div
            key={p.nickname}
            className={`flex items-center justify-between p-3 rounded ${
              i === 0 && p.solved ? "bg-green-50 dark:bg-green-900/20" : "bg-muted"
            }`}
          >
            <div className="flex items-center gap-2">
              {i === 0 && p.solved && <Trophy className="w-4 h-4 text-yellow-500" />}
              <span className="font-medium">
                {p.nickname}
                {p.nickname === currentNickname && " (du)"}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              {p.solved ? `${p.guesses_used}/6` : "X/6"}
            </div>
          </div>
        ))}
      </div>

      {onNextGame && (
        <Button size="lg" className="w-full mt-4" onClick={onNextGame}>
          Nächstes Spiel
        </Button>
      )}
    </div>
  );
}
