"use client";

import type { ReactNode } from "react";
import { Guess } from "@/lib/types";
import { KoopPlayer } from "@/lib/koop-types";
import { Button } from "@/components/ui/button";
import { Panel, ResultHero, ResultList, ResultRow } from "@/components/design";
import { pickQuip } from "@/lib/quips";

/** One line of the result list. `label` replaces the plain name where a mode
 *  draws more than a name (the stream chat: logo and badges). */
export interface ResultRowData {
  name: string;
  detail: string;
  label?: ReactNode;
}

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
  /** Seconds until the next round starts by itself, or null when it does not.
   *  Drawn under the button together with a way to hold this round. */
  autoNextSeconds?: number | null;
  onStopAutoNext?: () => void;
  /** What this round was, for the line above the word. */
  label?: string;
  /** Who "we" were. The stream chat is not a team, it is an audience. */
  groupNoun?: string;
  /** Replaces the player list. The stream chat has two player rows and
   *  hundreds of people, so listing the rows would name the wrong ones. */
  rows?: ResultRowData[];
  /** Replaces the one line that names the finder with a block of its own. The
   *  stream chat sets it: the finder is one person out of hundreds and has to
   *  be readable from across the room, on the stream. */
  finder?: ReactNode;
  /** Ends the summary on a quip (`lib/quips.ts`), about the reader only. */
  quips?: boolean;
}

export default function KoopResultCard({
  gameNumber,
  guesses,
  players,
  solvedBy,
  currentNickname,
  gaveUp = false,
  onNextGame,
  autoNextSeconds = null,
  onStopAutoNext,
  label = "Koop",
  groupNoun = "im Team",
  rows,
  finder: finderBlock,
  quips = false,
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
        support={(() => {
          const base = gaveUp
            ? `Aufgegeben nach ${guesses.length} Versuchen ${groupNoun}.`
            : finderBlock && solvedBy
              ? `Nach ${guesses.length} Versuchen ${groupNoun}.`
              : finder;
          if (!quips) return base;
          const line = pickQuip(gaveUp ? "teamGaveUp" : "teamSolved", `${solvedWord}:${guesses.length}`);
          return `${base} ${line}`;
        })()}
      />

      {!gaveUp && solvedBy && finderBlock}

      {/* No places here on purpose: koop is one shared result, and ranking the
          team against itself would invent a competition the mode does not have. */}
      <ResultList>
        {(rows ??
          sorted.map((p): ResultRowData => ({
            name: p.nickname,
            detail: `${p.contribution_count} ${p.contribution_count === 1 ? "Beitrag" : "Beiträge"}`,
          }))).map((row) => (
          <ResultRow
            key={row.name}
            name={row.label ?? row.name}
            you={!rows && row.name === currentNickname}
            detail={row.detail}
          />
        ))}
      </ResultList>

      {onNextGame && (
        <div className="flex flex-col gap-2">
          <Button size="lg" onClick={onNextGame}>
            Nächstes Spiel
          </Button>
          {autoNextSeconds !== null && (
            <div
              data-testid="auto-next"
              className="flex items-center justify-between gap-3 text-small text-muted-foreground"
            >
              {/* Not a live region: a screen reader would read every second.
                  The button names what happens, the number is for the eye. */}
              <span>
                {"Nächste Runde in "}
                <span className="font-semibold tabular-nums text-foreground">{autoNextSeconds}</span>
                {autoNextSeconds === 1 ? " Sekunde" : " Sekunden"}
              </span>
              {onStopAutoNext && (
                <Button variant="outline" size="sm" onClick={onStopAutoNext}>
                  {"Anhalten"}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
