"use client";

import { Guess } from "@/lib/types";
import { DuelPlayer } from "@/lib/duel-types";
import { Button } from "@/components/ui/button";
import { Panel, ResultHero, ResultList, ResultRow } from "@/components/design";

interface DuelResultCardProps {
  gameNumber: number;
  guesses: Guess[];
  players: DuelPlayer[];
  currentNickname: string;
  /** When set, shows a prominent "Nächstes Spiel" button (rematch). */
  onNextGame?: () => void;
}

export default function DuelResultCard({
  gameNumber,
  guesses,
  players,
  currentNickname,
  onNextGame,
}: DuelResultCardProps) {
  const sorted = [...players].sort((a, b) => {
    if (a.solved && !b.solved) return -1;
    if (!a.solved && b.solved) return 1;
    return (a.guess_count || Infinity) - (b.guess_count || Infinity);
  });

  const solvedWord = guesses.find((g) => g.rank === 1)?.word ?? "";

  return (
    <Panel className="animate-result-in">
      <ResultHero
        eyebrow={`Duell, Spiel #${gameNumber}, das Wort war`}
        headline={solvedWord}
      />

      <ResultList>
        {sorted.map((p, i) => (
          <ResultRow
            key={p.nickname}
            place={i + 1}
            lead={i === 0 && p.solved}
            name={p.nickname}
            you={p.nickname === currentNickname}
            detail={
              p.solved
                ? `Gelöst, ${p.guess_count} Versuche${p.tip_count > 0 ? `, ${p.tip_count} Tipps` : ""}`
                : `${p.best_rank ? `bester Rang ${p.best_rank}` : "ohne Rang"}${p.tip_count > 0 ? `, ${p.tip_count} Tipps` : ""}`
            }
          />
        ))}
      </ResultList>

      {onNextGame && (
        <Button size="lg" onClick={onNextGame}>
          Nächstes Spiel
        </Button>
      )}
    </Panel>
  );
}
