"use client";
import { useEffect, useState } from "react";
import { Guess } from "@/lib/types";
import ShareButton from "./ShareButton";

interface WinDialogProps { gameNumber: number; guesses: Guess[]; tipCount: number; onClose: () => void; }

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-xl">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        <div className="text-4xl mb-4">&#127881;</div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Gel&ouml;st!</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-1">Kontexto #{gameNumber}</p>
        <p className="text-gray-600 dark:text-gray-300 mb-4">Versuche: {guesses.length} &middot; Tipps: {tipCount}</p>
        <div className="mb-4 flex justify-center">
          <ShareButton gameNumber={gameNumber} guesses={guesses} tipCount={tipCount} />
        </div>
        <p className="text-sm text-gray-400 dark:text-gray-500">N&auml;chstes R&auml;tsel in: {countdown}</p>
      </div>
    </div>
  );
}
