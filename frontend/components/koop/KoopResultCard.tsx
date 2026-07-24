"use client";

import { Guess } from "@/lib/types";
import { KoopPlayer } from "@/lib/koop-types";
import { Button } from "@/components/ui/button";

interface KoopResultCardProps {
  gameNumber: number;
  guesses: Guess[];
  players: KoopPlayer[];
  solvedBy: string | null;
  currentNickname: string;
  /** True when the team revealed the word via "Aufgeben" instead of solving. */
  gaveUp?: boolean;
  /** When set, shows a prominent "Nächstes Spiel" button. */
  onNextGame?: () => void;
}

export default function KoopResultCard({
  gameNumber,
  guesses,
  players,
  solvedBy,
  currentNickname,
  gaveUp = false,
  onNextGame,
}: KoopResultCardProps) {
  const solvedWord = guesses.find((g) => g.rank === 1)?.word ?? "";
  const sorted = [...players].sort(
    (a, b) => b.contribution_count - a.contribution_count
  );

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4 text-center">
      <h2 className="text-xl font-bold">
        {gaveUp ? "Aufgegeben" : "Gemeinsam gelöst!"}
      </h2>
      <p className="text-muted-foreground">
        Spiel #{gameNumber} · Das Wort war{" "}
        <strong className="text-foreground text-lg uppercase">{solvedWord}</strong>
      </p>
      <p className="text-sm text-muted-foreground">
        {!gaveUp && solvedBy ? (
          <>
            Gefunden von{" "}
            <strong className="text-foreground">
              {solvedBy}
              {solvedBy === currentNickname ? " (du)" : ""}
            </strong>{" "}
            · {guesses.length} Versuche im Team
          </>
        ) : (
          <>{guesses.length} Versuche im Team</>
        )}
      </p>

      <div className="space-y-2">
        {sorted.map((p) => (
          <div
            key={p.nickname}
            className="flex items-center justify-between py-2 px-3 rounded-lg border bg-muted/30"
          >
            <span className="font-medium">
              {p.nickname}
              {p.nickname === currentNickname ? " (du)" : ""}
            </span>
            <span className="text-sm text-muted-foreground">
              {p.contribution_count}{" "}
              {p.contribution_count === 1 ? "Beitrag" : "Beiträge"}
            </span>
          </div>
        ))}
      </div>

      {onNextGame && (
        <Button size="lg" className="w-full" onClick={onNextGame}>
          Nächstes Spiel
        </Button>
      )}
    </div>
  );
}
