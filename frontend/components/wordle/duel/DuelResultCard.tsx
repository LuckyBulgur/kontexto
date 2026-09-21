"use client";

import type { WordleDuelPlayer } from "@/lib/wordle-types";
import { Button } from "@/components/ui/button";
import { Panel, ResultHero, ResultList, ResultRow } from "@/components/design";

interface DuelResultCardProps {
  players: WordleDuelPlayer[];
  currentNickname: string | null;
  /** When set, shows a prominent "Nächstes Spiel" button (rematch). */
  onNextGame?: () => void;
}

export default function DuelResultCard({ players, currentNickname, onNextGame }: DuelResultCardProps) {
  const sorted = [...players].sort((a, b) => {
    if (a.solved && !b.solved) return -1;
    if (!a.solved && b.solved) return 1;
    return a.guesses_used - b.guesses_used;
  });
  const winner = sorted[0]?.solved ? sorted[0] : null;
  const youWon = winner != null && winner.nickname === currentNickname;

  return (
    <Panel className="animate-result-in mx-auto my-4 max-w-sm">
      <ResultHero
        eyebrow="Wördle-Duell"
        headline={youWon ? "Gewonnen!" : winner ? `${winner.nickname} gewinnt` : "Niemand gewinnt"}
        lost={!winner}
        support={winner ? `Mit ${winner.guesses_used} von 6 Versuchen.` : "Kein Wort gefunden."}
      />

      <ResultList>
        {sorted.map((p, i) => (
          <ResultRow
            key={p.nickname}
            place={i + 1}
            lead={i === 0 && p.solved}
            name={p.nickname}
            you={p.nickname === currentNickname}
            detail={p.solved ? `${p.guesses_used} von 6` : "nicht gelöst"}
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
