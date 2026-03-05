"use client";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getPastGames } from "@/lib/api";
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
          <DialogTitle className="text-xl">Vergangene Spiele</DialogTitle>
          <DialogDescription className="sr-only">Wähle ein vergangenes Spiel zum Spielen</DialogDescription>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto -mx-2">
          {loading && (
            <p className="text-sm text-muted-foreground text-center py-4">Laden...</p>
          )}
          {error && (
            <p className="text-sm text-destructive text-center py-4">{error}</p>
          )}
          {!loading && !error && games.map((game) => (
            <button
              key={game.gameNumber}
              onClick={() => { onSelectGame(game.gameNumber); onClose(); }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-accent text-left transition-colors"
            >
              <span className="font-medium">Spiel #{game.gameNumber}</span>
              <span className="text-sm text-muted-foreground">{formatDate(game.date)}</span>
            </button>
          ))}
          {!loading && !error && games.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Keine vergangenen Spiele verfügbar</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
