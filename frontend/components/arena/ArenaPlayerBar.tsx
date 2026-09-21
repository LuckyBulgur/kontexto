"use client";

import { ArenaModeId, ArenaPlayer } from "@/lib/arena-types";
import { getRankColor } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatCountdown, useCountdown } from "@/lib/use-server-countdown";
import { Panel } from "@/components/design";

interface ArenaPlayerBarProps {
  players: ArenaPlayer[];
  currentNickname: string;
  mode: ArenaModeId;
  offsetMs: number;
}

/**
 * Who is still in, and how they stand. Sorted by best rank so the elimination
 * order is readable: in Battle Royale the bottom entry is the one who goes next,
 * and that has to be visible without counting.
 */
export default function ArenaPlayerBar({
  players,
  currentNickname,
  mode,
  offsetMs,
}: ArenaPlayerBarProps) {
  const sorted = [...players].sort(compareStanding);

  const list = (
    <div className="space-y-1.5">
      {sorted.map((player) => (
        <PlayerEntry
          key={player.nickname}
          player={player}
          isYou={player.nickname === currentNickname}
          mode={mode}
          offsetMs={offsetMs}
        />
      ))}
    </div>
  );

  return (
    <>
      <div className="hidden md:block w-60 shrink-0">
        <Panel padding="sm" className="gap-2 p-3">
          <h3 className="text-micro font-semibold text-muted-foreground">
            Spieler
          </h3>
          {list}
        </Panel>
      </div>
      <Panel padding="sm" className="p-3 md:hidden">{list}</Panel>
    </>
  );
}

/** Still in beats out; then better rank; then fewer guesses. */
function compareStanding(a: ArenaPlayer, b: ArenaPlayer): number {
  if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
  const rankA = a.best_rank ?? Number.POSITIVE_INFINITY;
  const rankB = b.best_rank ?? Number.POSITIVE_INFINITY;
  if (rankA !== rankB) return rankA - rankB;
  return a.guess_count - b.guess_count;
}

function PlayerEntry({
  player,
  isYou,
  mode,
  offsetMs,
}: {
  player: ArenaPlayer;
  isYou: boolean;
  mode: ArenaModeId;
  offsetMs: number;
}) {
  // Only Zeitbonus-Jagd gives each player their own clock, and only while they
  // are still in the round.
  const ownClock = mode === "timerush" && !player.eliminated ? player.deadline_at : null;
  const seconds = useCountdown(ownClock, offsetMs);

  return (
    <div
      className={cn(
        "rounded-lg border px-2.5 py-2",
        player.eliminated ? "opacity-50" : "bg-background",
        isYou && !player.eliminated && "border-primary"
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-small font-medium">
          {player.nickname}
          {isYou && <span className="ml-1 text-micro text-muted-foreground">(du)</span>}
        </span>
        {!player.connected && !player.eliminated && (
          <span className="shrink-0 text-micro text-muted-foreground">
            offline
          </span>
        )}
      </div>
      <div className="mt-0.5 flex items-baseline justify-between gap-2 text-micro">
        <span className="text-muted-foreground">
          {player.eliminated
            ? player.place
              ? `Platz ${player.place}`
              : "raus"
            : `${player.guess_count} Versuche`}
        </span>
        <span className="flex items-baseline gap-2">
          {seconds !== null && (
            <span className={cn("tabular-nums", seconds <= 10 && "text-destructive")}>
              {formatCountdown(seconds)}
            </span>
          )}
          <span className={cn("font-display font-bold tabular-nums", rankClass(player.best_rank))}>
            {player.best_rank ?? "-"}
          </span>
        </span>
      </div>
    </div>
  );
}

function rankClass(rank: number | null): string {
  if (rank === null) return "text-muted-foreground";
  switch (getRankColor(rank)) {
    case "green":
      return "text-rank-near-ink";
    case "yellow":
      return "text-rank-mid-ink";
    default:
      return "text-rank-far-ink";
  }
}
