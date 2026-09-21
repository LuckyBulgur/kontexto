"use client";

import { Button } from "@/components/ui/button";
import { ArenaState } from "@/lib/arena-types";
import { MULTIPLAYER_MODES } from "@/lib/multiplayer-modes";
import ModesDialogButton from "@/components/ModesDialogButton";
import { Panel, ResultHero, ResultList, ResultRow } from "@/components/design";

interface ArenaResultCardProps {
  state: ArenaState;
  currentNickname: string | null;
  /** The game this round was played on, once the reveal has answered. Null
   *  before that, and after a reveal that failed. */
  gameNumber: number | null;
  /** The target word, once the round is over. */
  solution: string | null;
  onNextRound: () => void;
  nextLoading: boolean;
}

export default function ArenaResultCard({
  state,
  currentNickname,
  gameNumber,
  solution,
  onNextRound,
  nextLoading,
}: ArenaResultCardProps) {
  const meta = MULTIPLAYER_MODES[state.mode];
  const youWon = state.winner !== null && state.winner === currentNickname;
  const standings = [...state.players].sort(byPlace);

  return (
    <Panel className="animate-result-in">
      <ResultHero
        eyebrow={
          gameNumber === null ? meta.name : `${meta.name}, Spiel #${gameNumber}`
        }
        headline={youWon ? "Gewonnen!" : state.winner ? `${state.winner} gewinnt` : "Niemand gewinnt"}
        lost={!youWon && !state.winner}
        support={solution ? `Das Wort war ${solution}.` : undefined}
      />

      <ResultList>
        {standings.map((player, index) => (
          <ResultRow
            key={player.nickname}
            place={player.place ?? index + 1}
            lead={player.nickname === state.winner}
            name={player.nickname}
            you={player.nickname === currentNickname}
            detail={`Rang ${player.best_rank ?? "-"}, ${player.guess_count} Versuche`}
          />
        ))}
      </ResultList>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="flex-1" onClick={onNextRound} disabled={nextLoading}>
          {nextLoading ? "Lädt..." : "Neue Runde"}
        </Button>
        <ModesDialogButton className="flex-1">Andere Modi</ModesDialogButton>
      </div>
    </Panel>
  );
}

/** A place is only filled for players the round actually ranked. */
function byPlace(a: { place: number | null }, b: { place: number | null }): number {
  return (a.place ?? Number.POSITIVE_INFINITY) - (b.place ?? Number.POSITIVE_INFINITY);
}
