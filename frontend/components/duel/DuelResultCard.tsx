"use client";

import { Guess } from "@/lib/types";
import { DuelPlayer } from "@/lib/duel-types";
import { Button } from "@/components/ui/button";
import { Panel, ResultHero, ResultList, ResultRow } from "@/components/design";
import { pickQuip, roomResultOccasion } from "@/lib/quips";

interface DuelResultCardProps {
  /** Null until the reveal answers, and after a reveal that failed: the round
   *  is worth showing without its number, so the card reads either way. */
  gameNumber: number | null;
  guesses: Guess[];
  players: DuelPlayer[];
  currentNickname: string;
  /** When set, shows a prominent "Nächstes Spiel" button (rematch). */
  onNextGame?: () => void;
  /** Ends the summary on a quip (`lib/quips.ts`), about the reader only. */
  quips?: boolean;
}

export default function DuelResultCard({
  gameNumber,
  guesses,
  players,
  currentNickname,
  onNextGame,
  quips = false,
}: DuelResultCardProps) {
  const sorted = [...players].sort((a, b) => {
    if (a.solved && !b.solved) return -1;
    if (!a.solved && b.solved) return 1;
    return (a.guess_count || Infinity) - (b.guess_count || Infinity);
  });

  const solvedWord = guesses.find((g) => g.rank === 1)?.word ?? "";
  const yourPlace = sorted.findIndex((p) => p.nickname === currentNickname) + 1;
  const you = sorted[yourPlace - 1];
  const quip =
    quips && you ? pickQuip(roomResultOccasion(you.solved, yourPlace), `${solvedWord}:${you.guess_count}`) : undefined;

  return (
    <Panel className="animate-result-in">
      <ResultHero
        eyebrow={
          gameNumber === null
            ? "Duell, das Wort war"
            : `Duell, Spiel #${gameNumber}, das Wort war`
        }
        headline={solvedWord}
        support={quip}
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
