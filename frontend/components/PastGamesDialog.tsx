"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getPastGames } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { PastGame } from "@/lib/types";

interface PastGamesDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectGame: (gameNumber: number) => void;
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function PastGamesDialog({ open, onClose, onSelectGame }: PastGamesDialogProps) {
  const [games, setGames] = useState<PastGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    getPastGames()
      .then((res) => setGames(res.games))
      .catch(() => setError("Spiele konnten nicht geladen werden"))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-h3">Vergangene Spiele</DialogTitle>
          <DialogDescription className="sr-only">Wähle ein vergangenes Spiel zum Spielen</DialogDescription>
        </DialogHeader>

        <div className="scrollbar-thin -mx-2 flex max-h-80 flex-col gap-1.5 overflow-y-auto px-2 pb-1">
          {loading && (
            <div className="space-y-1" aria-busy="true" aria-label="Spiele werden geladen">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ))}
            </div>
          )}
          {error && (
            <p className="text-small text-destructive text-center py-4">{error}</p>
          )}
          {!loading && !error && games.map((game) => (
            <Button
              // Keyed by date, not by game number: the pool wraps, so the same
              // puzzle comes round again on a later date and the number is not
              // unique in this list. One row per day, so the date is.
              key={game.date}
              variant="secondary"
              onClick={() => { onSelectGame(game.gameNumber); onClose(); }}
              className="h-auto w-full justify-between px-3 py-2.5 text-left font-normal"
            >
              <span data-numeric className="font-display font-bold">Spiel #{game.gameNumber}</span>
              <span className="text-small text-muted-foreground">{formatDate(game.date)}</span>
            </Button>
          ))}
          {!loading && !error && games.length === 0 && (
            <p className="text-small text-muted-foreground text-center py-4">Keine vergangenen Spiele verfügbar</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
