"use client";

import { DuelPlayer } from "@/lib/duel-types";
import { getRankColor } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/design";

interface PlayerBarProps {
  players: DuelPlayer[];
  currentNickname: string;
}

export default function PlayerBar({
  players,
  currentNickname,
}: PlayerBarProps) {
  return (
    <>
      {/* Desktop: sidebar */}
      <div className="hidden md:block w-56 shrink-0">
        <Panel padding="sm" className="gap-2 p-3">
          <h3 className="text-micro font-semibold text-muted-foreground">
            Spieler
          </h3>
          {players.map((p) => (
            <PlayerEntry
              key={p.nickname}
              player={p}
              isYou={p.nickname === currentNickname}
            />
          ))}
        </Panel>
      </div>

      {/* Mobile: horizontal bar */}
      <div className="md:hidden overflow-x-auto">
        <div className="flex gap-2 px-1 py-1 min-w-0">
          {players.map((p) => (
            <PlayerChip
              key={p.nickname}
              player={p}
              isYou={p.nickname === currentNickname}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function PlayerEntry({
  player,
  isYou,
}: {
  player: DuelPlayer;
  isYou: boolean;
}) {
  const color = player.best_rank ? getRankColor(player.best_rank) : null;
  const colorClass =
    color === "green"
      ? "text-rank-near-ink"
      : color === "yellow"
        ? "text-rank-mid-ink"
        : color === "red"
          ? "text-rank-far-ink"
          : "text-muted-foreground";

  return (
    <div
      className={cn(
        "flex items-center justify-between py-1.5 px-2 rounded-lg text-small",
        isYou && "bg-muted/50"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={cn(
            "w-2 h-2 rounded-full shrink-0",
            player.connected ? "bg-primary" : "bg-muted-foreground/45"
          )}
        />
        <span className="font-medium truncate">
          {player.nickname}
          {isYou ? " (du)" : ""}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {player.solved ? (
          <span className="text-small font-bold text-success-ink">Gelöst!</span>
        ) : player.best_rank ? (
          <span className={cn("font-display font-bold tabular-nums", colorClass)}>
            #{player.best_rank}
          </span>
        ) : (
          <span className="text-muted-foreground text-micro">ohne Rang</span>
        )}
        <span className="text-micro text-muted-foreground">
          {player.guess_count}x
          {player.tip_count > 0 && `, ${player.tip_count}T`}
        </span>
      </div>
    </div>
  );
}

function PlayerChip({
  player,
  isYou,
}: {
  player: DuelPlayer;
  isYou: boolean;
}) {
  const color = player.best_rank ? getRankColor(player.best_rank) : null;
  const colorClass =
    color === "green"
      ? "text-rank-near-ink"
      : color === "yellow"
        ? "text-rank-mid-ink"
        : color === "red"
          ? "text-rank-far-ink"
          : "text-muted-foreground";

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-small shrink-0",
        isYou && "bg-muted/50"
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          player.connected ? "bg-primary" : "bg-muted-foreground/45"
        )}
      />
      <span className="font-medium text-micro">
        {player.nickname}
        {isYou ? " (du)" : ""}
      </span>
      {player.solved ? (
        <span className="text-micro font-bold text-success-ink">Gelöst</span>
      ) : player.best_rank ? (
        <span className={cn("font-display text-micro font-bold tabular-nums", colorClass)}>
          #{player.best_rank}
        </span>
      ) : null}
      {player.tip_count > 0 && (
        <span className="text-muted-foreground text-micro">{player.tip_count}T</span>
      )}
    </div>
  );
}
