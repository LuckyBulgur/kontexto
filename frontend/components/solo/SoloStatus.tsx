"use client";
import {
  LEITER_MAX_STRIKES,
  LIMIT_MAX_GUESSES,
  SoloState,
  leiterStrikesLeft,
  limitGuessesLeft,
} from "@/lib/solo-modes";
import { cn } from "@/lib/utils";

/**
 * The one line above the input that says where the player stands. Each mode has
 * a different scarce resource: lives in Leiter, guesses in Limitierte Versuche,
 * two targets in Doppelziel, a single attempt in Sudden Death. Showing the wrong
 * counter is worse than showing none, so every mode names its own.
 */
export default function SoloStatus({ state }: { state: SoloState }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 -mt-2 -mb-2 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
      {renderFor(state)}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <span>
      {label}:{" "}
      <span className={cn("text-[18px] font-bold", warn ? "text-destructive" : "text-foreground")}>{value}</span>
    </span>
  );
}

function renderFor(state: SoloState) {
  switch (state.mode) {
    case "leiter": {
      const left = leiterStrikesLeft(state);
      return (
        <>
          <Stat label="Zu schlagen" value={String(state.bestRank)} />
          <Stat label="Leben" value={`${left} von ${LEITER_MAX_STRIKES}`} warn={left <= 1} />
        </>
      );
    }
    case "limit": {
      const left = limitGuessesLeft(state);
      return (
        <>
          <Stat label="Versuche übrig" value={`${left} von ${LIMIT_MAX_GUESSES}`} warn={left <= 3} />
        </>
      );
    }
    case "doppel":
      return (
        <>
          <Stat label="Gefunden" value={`${state.solved.filter(Boolean).length} von 2`} />
          <Stat label="Versuche" value={String(state.guesses.length)} />
        </>
      );
    case "suddendeath":
      return <Stat label="Versuche" value={state.attempt ? "0 von 1" : "1 von 1"} />;
  }
}
