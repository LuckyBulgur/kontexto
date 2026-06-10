"use client";

import { KoopPlayer } from "@/lib/koop-types";
import { cn } from "@/lib/utils";

interface PlayerBarProps {
  players: KoopPlayer[];
  currentNickname: string;
}

export default function PlayerBar({ players, currentNickname }: PlayerBarProps) {
  return (
    <>
      {/* Desktop: sidebar */}
      <div className="hidden md:block w-56 shrink-0">
        <div className="rounded-xl border bg-card p-3 space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Team
          </h3>
          {players.map((p) => (
            <PlayerEntry
              key={p.nickname}
              player={p}
              isYou={p.nickname === currentNickname}
            />
          ))}
        </div>
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

function PlayerEntry({ player, isYou }: { player: KoopPlayer; isYou: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-1.5 px-2 rounded-lg text-sm",
        isYou && "bg-muted/50"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={cn(
            "w-2 h-2 rounded-full shrink-0",
            player.connected ? "bg-green-500" : "bg-gray-400"
          )}
        />
        <span className="font-medium truncate">
          {player.nickname}
          {isYou ? " (du)" : ""}
        </span>
      </div>
      <span className="text-xs text-muted-foreground shrink-0 ml-2">
        {player.contribution_count} Beiträge
      </span>
    </div>
  );
}

function PlayerChip({ player, isYou }: { player: KoopPlayer; isYou: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-sm shrink-0",
        isYou && "bg-muted/50"
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          player.connected ? "bg-green-500" : "bg-gray-400"
        )}
      />
      <span className="font-medium text-xs">
        {player.nickname}
        {isYou ? " (du)" : ""}
      </span>
      <span className="text-muted-foreground text-[10px]">
        {player.contribution_count}
      </span>
    </div>
  );
}
