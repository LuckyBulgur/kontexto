"use client";

import { Guess } from "@/lib/types";
import { DuelPlayer } from "@/lib/duel-types";

interface DuelResultCardProps {
  gameNumber: number;
  guesses: Guess[];
  tipCount: number;
  players: DuelPlayer[];
  currentNickname: string;
}

export default function DuelResultCard({
  gameNumber,
  guesses,
  tipCount,
  players,
  currentNickname,
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
                </span>
              ) : (
                <span>
                  Nicht gelöst · Bester Rang: #{p.best_rank ?? "—"}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
