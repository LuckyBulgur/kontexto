"use client";

import type { WordleDuelPlayer } from "@/lib/wordle-types";

interface DuelHeaderProps {
  players: WordleDuelPlayer[];
  currentNickname: string | null;
}

export default function DuelHeader({ players, currentNickname }: DuelHeaderProps) {
  return (
    <div className="flex gap-3 justify-center py-2 flex-wrap">
      {players.map((p) => (
        <div
          key={p.nickname}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-small ${
            p.solved
              ? "bg-success/12"
              : "bg-muted"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${p.connected ? "bg-primary" : "bg-muted-foreground/45"}`} />
          <span className="font-medium">
            {p.nickname}
            {p.nickname === currentNickname && " (du)"}
          </span>
          <span className="text-muted-foreground">{p.guesses_used}x</span>
          {p.solved && <span className="text-success-ink">&#10003;</span>}
        </div>
      ))}
    </div>
  );
}
