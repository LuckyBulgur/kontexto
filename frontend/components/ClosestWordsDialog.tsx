"use client";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getClosestWords } from "@/lib/api";
import { ClosestWordEntry } from "@/lib/types";
import GuessBar from "./GuessBar";

interface ClosestWordsDialogProps {
  open: boolean;
  onClose: () => void;
  pastGame: number | null;
}

export default function ClosestWordsDialog({ open, onClose, pastGame }: ClosestWordsDialogProps) {
  const [words, setWords] = useState<ClosestWordEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    getClosestWords(pastGame)
      .then((res) => setWords(res.words))
      .catch(() => setError("Wörter konnten nicht geladen werden"))
      .finally(() => setLoading(false));
  }, [open, pastGame]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Ähnlichste Wörter</DialogTitle>
          <DialogDescription className="sr-only">Die 500 ähnlichsten Wörter zum Zielwort</DialogDescription>
        </DialogHeader>

        <div className="max-h-96 overflow-y-auto -mx-2 px-2">
          {loading && (
            <p className="text-sm text-muted-foreground text-center py-4">Laden...</p>
          )}
          {error && (
            <p className="text-sm text-destructive text-center py-4">{error}</p>
          )}
          {!loading && !error && words.map((entry) => (
            <GuessBar key={entry.rank} word={entry.word} rank={entry.rank} total={500} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
