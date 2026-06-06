"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { loadWordleStats } from "@/lib/wordle-storage";
import type { TileColor } from "@/lib/wordle-types";
import { CalendarHeatmap, DistributionBars, StatTile } from "@/components/stats/PlayerStatViews";
import { formatDecimal } from "@/lib/format";
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
  const wins = stats.distribution.reduce((a, b) => a + b, 0);
  const avgWin = wins > 0 ? stats.distribution.reduce((acc, c, i) => acc + (i + 1) * c, 0) / wins : null;
  const distRows = stats.distribution.map((count, i) => ({ label: String(i + 1), value: count }));
  const highlight = won && guesses.length >= 1 && guesses.length <= 6 ? String(guesses.length) : undefined;
  const datesPlayed = stats.datesPlayed ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Statistiken</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-2">
          <StatTile label="Gespielt" value={stats.played} />
          <StatTile label="Gewinn-%" value={winPct} />
          <StatTile label="Aktuelle Serie" value={stats.currentStreak} />
          <StatTile label="Max Serie" value={stats.maxStreak} />
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h4 className="text-sm font-semibold">Verteilung</h4>
            <span className="text-xs text-muted-foreground">Ø {formatDecimal(avgWin)} Versuche</span>
          </div>
          <DistributionBars rows={distRows} highlightLabel={highlight} />
        </div>

        {datesPlayed.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Gespielte Tage</h4>
            <CalendarHeatmap dates={datesPlayed} />
          </div>
        )}

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
