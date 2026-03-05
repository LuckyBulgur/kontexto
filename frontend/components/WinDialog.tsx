"use client";
import { useEffect, useState } from "react";
import { PartyPopper } from "lucide-react";
import { Guess } from "@/lib/types";
import ShareButton from "./ShareButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WinDialogProps {
  gameNumber: number;
  guesses: Guess[];
  tipCount: number;
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

export default function WinDialog({ gameNumber, guesses, tipCount, onClose }: WinDialogProps) {
  const [countdown, setCountdown] = useState(getTimeUntilMidnight());
  useEffect(() => {
    const interval = setInterval(() => setCountdown(getTimeUntilMidnight()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader className="text-center sm:text-center items-center">
          <PartyPopper size={40} className="mb-2 text-green-500" />
          <DialogTitle className="text-2xl">Gel&ouml;st!</DialogTitle>
          <DialogDescription className="sr-only">Spielergebnis und Countdown</DialogDescription>
        </DialogHeader>
        <p className="text-muted-foreground">Kontexto #{gameNumber}</p>
        <p className="text-muted-foreground">Versuche: {guesses.length} &middot; Tipps: {tipCount}</p>
        <div className="flex justify-center py-2">
          <ShareButton gameNumber={gameNumber} guesses={guesses} tipCount={tipCount} />
        </div>
        <p className="text-sm text-muted-foreground">N&auml;chstes R&auml;tsel in: {countdown}</p>
      </DialogContent>
    </Dialog>
  );
}
