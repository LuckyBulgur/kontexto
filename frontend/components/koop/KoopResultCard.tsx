"use client";

import { Guess } from "@/lib/types";
import { KoopPlayer } from "@/lib/koop-types";
import { Button } from "@/components/ui/button";
import { Panel, ResultHero, ResultList, ResultRow } from "@/components/design";

interface KoopResultCardProps {
  /** Null until the reveal answers: the number only leaves the server once the
   *  round is over (see lib/types RoomRevealResult). */
  gameNumber: number | null;
  guesses: Guess[];
  players: KoopPlayer[];
  solvedBy: string | null;
  currentNickname: string;
  /** True when the team revealed the word via "Aufgeben" instead of solving. */
  gaveUp?: boolean;
  /** When set, shows a prominent "Nächstes Spiel" button. */
  onNextGame?: () => void;
}

export default function KoopResultCard({
  gameNumber,
  guesses,
  players,
  solvedBy,
  currentNickname,
  gaveUp = false,
  onNextGame,
}: KoopResultCardProps) {
  const solvedWord = guesses.find((g) => g.rank === 1)?.word ?? "";
  const sorted = [...players].sort(
    (a, b) => b.contribution_count - a.contribution_count
  );
  const finder = !gaveUp && solvedBy
    ? `${solvedBy}${solvedBy === currentNickname ? " (du)" : ""} hat es gefunden, nach ${guesses.length} Versuchen im Team.`
    : `${guesses.length} Versuche im Team.`;

  return (
    <Panel className="animate-result-in">
      <ResultHero
        eyebrow={
          gameNumber === null
            ? "Koop, das Wort war"
            : `Koop, Spiel #${gameNumber}, das Wort war`
        }
        headline={solvedWord}
        lost={gaveUp}
        support={gaveUp ? `Aufgegeben nach ${guesses.length} Versuchen im Team.` : finder}
      />

      {/* No places here on purpose: koop is one shared result, and ranking the
          team against itself would invent a competition the mode does not have. */}
      <ResultList>
        {sorted.map((p) => (
          <ResultRow
            key={p.nickname}
            name={p.nickname}
            you={p.nickname === currentNickname}
            detail={`${p.contribution_count} ${p.contribution_count === 1 ? "Beitrag" : "Beiträge"}`}
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
