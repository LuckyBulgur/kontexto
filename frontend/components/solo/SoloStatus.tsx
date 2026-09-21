"use client";
import {
  LEITER_MAX_STRIKES,
  LIMIT_MAX_GUESSES,
  SoloState,
  leiterStrikesLeft,
  limitGuessesLeft,
} from "@/lib/solo-modes";
import { Stat, StatRow } from "@/components/design";

/**
 * The one line above the input that says where the player stands. Each mode has
 * a different scarce resource: lives in Leiter, guesses in Limitierte Versuche,
 * two targets in Doppelziel, a single attempt in Sudden Death. Showing the wrong
 * counter is worse than showing none, so every mode names its own.
 */
export default function SoloStatus({ state }: { state: SoloState }) {
  return <StatRow className="-mt-1">{renderFor(state)}</StatRow>;
}

/** Under this many left, the counter is the warning. */
function Counter({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <Stat
      label={label}
      value={<span className={warn ? "text-destructive" : undefined}>{value}</span>}
    />
  );
}

function renderFor(state: SoloState) {
  switch (state.mode) {
    case "leiter": {
      const left = leiterStrikesLeft(state);
      return (
        <>
          <Counter label="Zu schlagen" value={String(state.bestRank)} />
          <Counter label="Leben" value={`${left} von ${LEITER_MAX_STRIKES}`} warn={left <= 1} />
        </>
      );
    }
    case "limit": {
      const left = limitGuessesLeft(state);
      return <Counter label="Versuche übrig" value={`${left} von ${LIMIT_MAX_GUESSES}`} warn={left <= 3} />;
    }
    case "doppel":
      return (
        <>
          <Counter label="Gefunden" value={`${state.solved.filter(Boolean).length} von 2`} />
          <Counter label="Versuche" value={String(state.guesses.length)} />
        </>
      );
    case "suddendeath":
      return <Counter label="Versuche" value={state.attempt ? "0 von 1" : "1 von 1"} />;
  }
}
