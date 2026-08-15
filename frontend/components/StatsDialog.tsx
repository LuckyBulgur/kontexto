"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarHeatmap, DistributionBars, StatTile } from "@/components/stats/PlayerStatViews";
import { KONTEXTO_GUESS_BUCKETS, loadKontextoStats } from "@/lib/kontexto-stats";
import { loadStreakData } from "@/lib/storage";
import { formatDecimal, formatPercent } from "@/lib/format";

interface StatsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function StatsDialog({ open, onClose }: StatsDialogProps) {
  const stats = loadKontextoStats();
  const streak = loadStreakData();
  const solveRate = stats.played > 0 ? stats.solved / stats.played : null;
  const avgGuesses = stats.solved > 0 ? stats.totalGuessesOnSolve / stats.solved : null;
  const distRows = KONTEXTO_GUESS_BUCKETS.map((b) => ({ label: b, value: stats.distribution[b] ?? 0 }));
  const hasDistribution = distRows.some((r) => r.value > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Deine Statistik</DialogTitle>
          <DialogDescription>Dein persönlicher Spielverlauf, nur auf diesem Gerät gespeichert.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-2">
          <StatTile label="Gespielt" value={stats.played} />
          <StatTile label="Lösungsquote" value={formatPercent(solveRate)} />
          <StatTile label="Aktuelle Serie" value={streak.currentStreak} />
          <StatTile label="Längste Serie" value={streak.longestStreak} />
          <StatTile label="Gelöst" value={stats.solved} />
          <StatTile label="Aufgegeben" value={stats.gaveUp} />
          <StatTile label="Ø Versuche" value={formatDecimal(avgGuesses)} />
          <StatTile label="Beste Lösung" value={stats.fewestGuesses ?? "k. A."} />
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Versuche bis zur Lösung</h4>
          {hasDistribution ? (
            <DistributionBars rows={distRows} />
          ) : (
            <p className="text-sm text-muted-foreground">Löse dein erstes Rätsel, um die Verteilung zu sehen.</p>
          )}
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Gespielte Tage</h4>
          {streak.datesPlayed.length > 0 ? (
            <CalendarHeatmap dates={streak.datesPlayed} />
          ) : (
            <p className="text-sm text-muted-foreground">Noch keine gespielten Tage.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
