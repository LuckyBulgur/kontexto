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
  /** What this round was, for the line above the word. */
  label?: string;
  /** Who "we" were. The stream chat is not a team, it is an audience. */
  groupNoun?: string;
  /** Replaces the player list. The stream chat has two player rows and
   *  hundreds of people, so listing the rows would name the wrong ones. */
  rows?: { name: string; detail: string }[];
}

export default function KoopResultCard({
  gameNumber,
  guesses,
  players,
  solvedBy,
  currentNickname,
  gaveUp = false,
  onNextGame,
  label = "Koop",
  groupNoun = "im Team",
  rows,
}: KoopResultCardProps) {
  const solvedWord = guesses.find((g) => g.rank === 1)?.word ?? "";
  const sorted = [...players].sort(
    (a, b) => b.contribution_count - a.contribution_count
  );
  const finder = !gaveUp && solvedBy
    ? `${solvedBy}${solvedBy === currentNickname ? " (du)" : ""} hat es gefunden, nach ${guesses.length} Versuchen ${groupNoun}.`
    : `${guesses.length} Versuche ${groupNoun}.`;

  return (
    <Panel className="animate-result-in">
      <ResultHero
        eyebrow={
          gameNumber === null
            ? `${label}, das Wort war`
            : `${label}, Spiel #${gameNumber}, das Wort war`
        }
        headline={solvedWord}
        lost={gaveUp}
        support={
          gaveUp ? `Aufgegeben nach ${guesses.length} Versuchen ${groupNoun}.` : finder
        }
      />

      {/* No places here on purpose: koop is one shared result, and ranking the
          team against itself would invent a competition the mode does not have. */}
      <ResultList>
        {(rows ??
          sorted.map((p) => ({
            name: p.nickname,
            detail: `${p.contribution_count} ${p.contribution_count === 1 ? "Beitrag" : "Beiträge"}`,
          }))).map((row) => (
          <ResultRow
            key={row.name}
            name={row.name}
            you={!rows && row.name === currentNickname}
            detail={row.detail}
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
