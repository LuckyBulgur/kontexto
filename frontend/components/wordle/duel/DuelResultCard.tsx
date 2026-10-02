"use client";

import type { WordleDuelPlayer } from "@/lib/wordle-types";
import { Button } from "@/components/ui/button";
import { Panel, ResultHero, ResultList, ResultRow } from "@/components/design";
import { pickQuip, roomResultOccasion } from "@/lib/quips";

interface DuelResultCardProps {
  players: WordleDuelPlayer[];
  currentNickname: string | null;
  /** The word, when nobody in the duel found it. Null while it is still on its
   *  way, and whenever the winner's own board already spells it out. */
  solution?: string | null;
  /** When set, shows a prominent "Nächstes Spiel" button (rematch). */
  onNextGame?: () => void;
  /** Ends the summary on a quip (`lib/quips.ts`), about the reader only. */
  quips?: boolean;
}

export default function DuelResultCard({ players, currentNickname, solution, onNextGame, quips = false }: DuelResultCardProps) {
  const sorted = [...players].sort((a, b) => {
    if (a.solved && !b.solved) return -1;
    if (!a.solved && b.solved) return 1;
    return a.guesses_used - b.guesses_used;
  });
  const winner = sorted[0]?.solved ? sorted[0] : null;
  const youWon = winner != null && winner.nickname === currentNickname;
  const yourPlace = sorted.findIndex((p) => p.nickname === currentNickname) + 1;
  const you = sorted[yourPlace - 1];
  const quip =
    quips && you ? pickQuip(roomResultOccasion(you.solved, yourPlace), `${solution ?? ""}:${you.guesses_used}`) : null;

  return (
    <Panel className="animate-result-in mx-auto my-4 max-w-sm">
      <ResultHero
        eyebrow="Wördle-Duell"
        headline={youWon ? "Gewonnen!" : winner ? `${winner.nickname} gewinnt` : "Niemand gewinnt"}
        lost={!winner}
        support={[
          winner
            ? `Mit ${winner.guesses_used} von 6 Versuchen.`
            : solution
              ? `Niemand hat es gefunden. Das Wort war ${solution}.`
              : "Kein Wort gefunden.",
          quip,
        ]
          .filter(Boolean)
          .join(" ")}
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
