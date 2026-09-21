"use client";
import { Button } from "@/components/ui/button";
import ModesDialogButton from "@/components/ModesDialogButton";
import { Panel, ResultHero } from "@/components/design";
import {
  SoloModeMeta,
  SoloState,
  doppelBestRanks,
  soloGuessCount,
} from "@/lib/solo-modes";

interface SoloResultCardProps {
  mode: SoloModeMeta;
  state: SoloState;
  /** The target word, once the round is over. Null while it is still hidden. */
  solution: string | null;
  /** Null until the second Doppelziel target has been revealed too. */
  secondSolution?: string | null;
  onRestart: () => void;
  restarting?: boolean;
}

export default function SoloResultCard({
  mode,
  state,
  solution,
  secondSolution,
  onRestart,
  restarting,
}: SoloResultCardProps) {
  const won = state.status === "won";

  const words = [solution, secondSolution].filter(Boolean) as string[];

  return (
    <Panel className="animate-result-in">
      <ResultHero
        eyebrow={
          words.length === 0
            ? mode.name
            : words.length > 1
              ? `${mode.name}, die Wörter waren`
              : `${mode.name}, das Wort war`
        }
        headline={words.length > 0 ? words.join(" und ") : won ? headline(mode.id) : "Diesmal nicht"}
        lost={!won}
        support={summary(state)}
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="flex-1" onClick={onRestart} disabled={restarting}>
          {restarting ? "Lädt..." : "Neue Runde"}
        </Button>
        <ModesDialogButton className="flex-1">Andere Modi</ModesDialogButton>
      </div>
    </Panel>
  );
}

function headline(id: SoloModeMeta["id"]): string {
  switch (id) {
    case "leiter":
      return "Oben angekommen";
    case "limit":
      return "Im Budget geblieben";
    case "doppel":
      return "Beide gefunden";
    case "suddendeath":
      return "Sitzt, auf Anhieb";
  }
}

function summary(state: SoloState): string {
  const count = soloGuessCount(state);
  const attempts = count === 1 ? "einem Versuch" : `${count} Versuchen`;

  switch (state.mode) {
    case "leiter":
      return state.status === "won"
        ? `Du hast dich mit ${attempts} bis auf Rang 1 hochgearbeitet.`
        : `Nach ${attempts} waren die Leben aufgebraucht. Bester Rang: ${state.bestRank}.`;
    case "limit":
      return state.status === "won"
        ? `Gelöst mit ${attempts}.`
        : "Die Versuche sind aufgebraucht.";
    case "doppel": {
      const [a, b] = doppelBestRanks(state);
      return state.status === "won"
        ? `Beide Ziele mit ${attempts}.`
        : `Beste Ränge: ${fmt(a)} und ${fmt(b)}.`;
    }
    case "suddendeath":
      return state.status === "won"
        ? "Ein Versuch, ein Treffer."
        : `Dein Wort landete auf Rang ${state.attempt?.rank ?? 0}.`;
  }
}

function fmt(rank: number): string {
  return Number.isFinite(rank) ? String(rank) : "noch keiner";
}
