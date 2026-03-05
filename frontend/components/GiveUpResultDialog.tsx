"use client";
import { useEffect, useState } from "react";
import { HeartCrack } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface GiveUpResultDialogProps {
  gameNumber: number;
  word: string;
  guessCount: number;
  onClose: () => void;
}

function getTimeUntilMidnight(): string {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diff = midnight.getTime() - now.getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function GiveUpResultDialog({ gameNumber, word, guessCount, onClose }: GiveUpResultDialogProps) {
  const [countdown, setCountdown] = useState(getTimeUntilMidnight());
  useEffect(() => {
    const interval = setInterval(() => setCountdown(getTimeUntilMidnight()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader className="text-center sm:text-center items-center">
          <HeartCrack size={40} className="mb-2 text-red-500" />
          <DialogTitle className="text-2xl">Aufgegeben</DialogTitle>
          <DialogDescription className="sr-only">Spielergebnis nach Aufgabe</DialogDescription>
        </DialogHeader>
        <p className="text-muted-foreground">Kontexto #{gameNumber}</p>
        <p className="text-muted-foreground">
          Das Wort war: <strong className="text-foreground">{word}</strong>
        </p>
        <p className="text-muted-foreground text-sm">Versuche: {guessCount}</p>
        <p className="text-sm text-muted-foreground pt-2">Viel Gl&uuml;ck beim n&auml;chsten Mal!</p>
        <p className="text-sm text-muted-foreground">N&auml;chstes R&auml;tsel in: {countdown}</p>
      </DialogContent>
    </Dialog>
  );
}
