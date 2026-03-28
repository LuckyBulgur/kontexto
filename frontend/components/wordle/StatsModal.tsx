"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { loadWordleStats } from "@/lib/wordle-storage";
import type { TileColor } from "@/lib/wordle-types";
import ShareButton from "./ShareButton";

interface StatsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameNumber: number;
  guesses: string[];
  evaluations: TileColor[][];
  won: boolean;
  hardMode: boolean;
}

export default function StatsModal({ open, onOpenChange, gameNumber, guesses, evaluations, won, hardMode }: StatsModalProps) {
  const stats = loadWordleStats();
  const winPct = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;
  const maxDist = Math.max(...stats.distribution, 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Statistiken</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-4 text-center py-2">
          <div>
            <div className="text-2xl font-bold">{stats.played}</div>
            <div className="text-xs text-zinc-500">Gespielt</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{winPct}</div>
            <div className="text-xs text-zinc-500">Gewinn-%</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{stats.currentStreak}</div>
            <div className="text-xs text-zinc-500">Aktuelle Serie</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{stats.maxStreak}</div>
            <div className="text-xs text-zinc-500">Max Serie</div>
          </div>
        </div>

        <div className="py-2">
          <h4 className="text-sm font-semibold mb-2">Verteilung</h4>
          {stats.distribution.map((count, i) => (
            <div key={i} className="flex items-center gap-2 mb-1">
              <span className="text-sm w-3 text-right">{i + 1}</span>
              <div
                className={`h-5 flex items-center justify-end px-1.5 text-xs text-white font-bold rounded-sm ${
                  won && guesses.length === i + 1 ? "bg-green-600" : "bg-zinc-500"
                }`}
                style={{ width: `${Math.max((count / maxDist) * 100, 8)}%` }}
              >
                {count}
              </div>
            </div>
          ))}
        </div>

        {guesses.length > 0 && (
          <ShareButton
            gameNumber={gameNumber}
            guesses={guesses}
            evaluations={evaluations}
            won={won}
            hardMode={hardMode}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
