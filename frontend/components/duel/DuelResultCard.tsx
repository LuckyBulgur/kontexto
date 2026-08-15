"use client";

import { Guess } from "@/lib/types";
import { DuelPlayer } from "@/lib/duel-types";
import { Button } from "@/components/ui/button";

interface DuelResultCardProps {
  gameNumber: number;
  guesses: Guess[];
  players: DuelPlayer[];
  currentNickname: string;
  /** When set, shows a prominent "Nächstes Spiel" button (rematch). */
  onNextGame?: () => void;
}

export default function DuelResultCard({
  gameNumber,
  guesses,
  players,
  currentNickname,
  onNextGame,
}: DuelResultCardProps) {
  const sorted = [...players].sort((a, b) => {
    if (a.solved && !b.solved) return -1;
    if (!a.solved && b.solved) return 1;
    return (a.guess_count || Infinity) - (b.guess_count || Infinity);
  });

  const solvedWord = guesses.find((g) => g.rank === 1)?.word ?? "";

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4 text-center">
      <h2 className="text-xl font-bold">Duell-Ergebnis</h2>
      <p className="text-muted-foreground">
        Spiel #{gameNumber} · Das Wort war{" "}
        <strong className="text-foreground text-lg uppercase">
          {solvedWord}
        </strong>
      </p>

      <div className="space-y-2">
        {sorted.map((p, i) => (
          <div
            key={p.nickname}
            className="flex items-center justify-between py-2 px-3 rounded-lg border bg-muted/30"
          >
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-muted-foreground">
                #{i + 1}
              </span>
              <span className="font-medium">
                {p.nickname}
                {p.nickname === currentNickname ? " (du)" : ""}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              {p.solved ? (
                <span>
                  <span className="text-green-500 font-bold">Gelöst</span> ·{" "}
                  {p.guess_count} Versuche
                  {p.tip_count > 0 && ` (${p.tip_count} Tipps)`}
                </span>
              ) : (
                <span>
                  Nicht gelöst ·{" "}
                  {p.best_rank ? `Bester Rang: #${p.best_rank}` : "ohne Rang"}
                  {p.tip_count > 0 && ` · ${p.tip_count} Tipps`}
                </span>
              )}
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
