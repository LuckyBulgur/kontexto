"use client";
import { showsCategory } from "@/lib/categories";
import {
  LEITER_MAX_STRIKES,
  LIMIT_MAX_GUESSES,
  SoloState,
  leiterStrikesLeft,
  limitGuessesLeft,
  soloGuessCount,
} from "@/lib/solo-modes";
import { cn } from "@/lib/utils";

/**
 * The one line above the input that says where the player stands. Each mode has
 * a different scarce resource: lives in Leiter, guesses in Limitierte Versuche,
 * two targets in Doppelziel, a single attempt in Sudden Death. Showing the wrong
 * counter is worse than showing none, so every mode names its own. Kategorien
 * has no scarce resource; its line carries the round's field, when it is shown,
 * which is the one thing that mode adds to the board.
 */
export default function SoloStatus({ state }: { state: SoloState }) {
  // One line, not a StatRow. Stacking the label over the value and ruling the
  // counters apart turns a status into a small table, and this sits directly
  // above the input, where the eye should pass through it. Same decision, and
  // the same tokens, as the status line on the daily game.
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 -mt-2 -mb-2 text-micro font-medium text-muted-foreground">
      {renderFor(state)}
    </div>
  );
}

/** Under this many left, the counter is the warning. */
function Counter({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <span>
      {label}:{" "}
      <span className={cn("text-lead font-bold", warn ? "text-destructive" : "text-foreground")}>
        {value}
      </span>
    </span>
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
    case "categories":
      return (
        <>
          {showsCategory(state.setup) && state.category && (
            <Counter label="Kategorie" value={state.category.name} />
          )}
          <Counter label="Versuche" value={String(soloGuessCount(state))} />
          {state.tips > 0 && <Counter label="Tipps" value={String(state.tips)} />}
        </>
      );
  }
}
