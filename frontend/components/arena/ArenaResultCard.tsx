"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArenaState } from "@/lib/arena-types";
import { MULTIPLAYER_MODES } from "@/lib/multiplayer-modes";

interface ArenaResultCardProps {
  state: ArenaState;
  currentNickname: string | null;
  /** The target word, once the round is over. */
  solution: string | null;
  onNextRound: () => void;
  nextLoading: boolean;
}

export default function ArenaResultCard({
  state,
  currentNickname,
  solution,
  onNextRound,
  nextLoading,
}: ArenaResultCardProps) {
  const meta = MULTIPLAYER_MODES[state.mode];
  const youWon = state.winner !== null && state.winner === currentNickname;
  const standings = [...state.players].sort(byPlace);

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4 text-center">
      <h2 className="text-xl font-bold">
        {youWon ? "Gewonnen" : state.winner ? `${state.winner} gewinnt` : "Niemand gewinnt"}
      </h2>
      <p className="text-sm text-muted-foreground">
        {meta.name} · Spiel #{state.game_number}
        {solution && (
          <>
            {" "}
            · Das Wort war <strong className="text-foreground">{solution}</strong>
          </>
        )}
      </p>

      <ol className="space-y-1 text-left">
        {standings.map((player, index) => (
          <li
            key={player.nickname}
            className="flex items-baseline justify-between rounded-lg border px-3 py-2 text-sm"
          >
            <span>
              <span className="mr-2 font-mono text-muted-foreground">
                {player.place ?? index + 1}.
              </span>
              {player.nickname}
              {player.nickname === currentNickname && (
                <span className="ml-1 text-xs text-muted-foreground">(du)</span>
              )}
            </span>
            <span className="font-mono">
              {player.best_rank ?? "-"}
              <span className="ml-2 text-xs text-muted-foreground">
                {player.guess_count} Versuche
              </span>
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button onClick={onNextRound} disabled={nextLoading}>
          {nextLoading ? "Lädt..." : "Neue Runde"}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/modi/">Andere Modi</Link>
        </Button>
      </div>
    </div>
  );
}

/** A place is only filled for players the round actually ranked. */
function byPlace(a: { place: number | null }, b: { place: number | null }): number {
  return (a.place ?? Number.POSITIVE_INFINITY) - (b.place ?? Number.POSITIVE_INFINITY);
}
