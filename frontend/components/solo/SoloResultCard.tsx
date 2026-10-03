"use client";
import { Button } from "@/components/ui/button";
import ModesDialogButton from "@/components/ModesDialogButton";
import { Panel, ResultHero } from "@/components/design";
import SupportPrompt from "@/components/SupportPrompt";
import {
  SoloModeMeta,
  SoloState,
  doppelBestRanks,
  soloGuessCount,
} from "@/lib/solo-modes";
import { pickQuip, soloResultOccasion } from "@/lib/quips";

interface SoloResultCardProps {
  mode: SoloModeMeta;
  state: SoloState;
  /** The target word, once the round is over. Null while it is still hidden. */
  solution: string | null;
  /** Null until the second Doppelziel target has been revealed too. */
  secondSolution?: string | null;
  onRestart: () => void;
  restarting?: boolean;
  /** Kategorien only: back to the field choice. */
  onChangeSetup?: () => void;
  /** Ends the summary on a quip (`lib/quips.ts`). */
  quips?: boolean;
}

export default function SoloResultCard({
  mode,
  state,
  solution,
  secondSolution,
  onRestart,
  restarting,
  onChangeSetup,
  quips,
}: SoloResultCardProps) {
  const won = state.status === "won";

  const words = [solution, secondSolution].filter(Boolean) as string[];
  // A category round names its field once it is over, shown during it or not:
  // after the round it is no hint any more, and it says what the word was.
  const label = state.mode === "categories" && state.category ? state.category.name : mode.name;

  return (
    <Panel className="animate-result-in">
      <ResultHero
        eyebrow={
          words.length === 0
            ? label
            : words.length > 1
              ? `${label}, die Wörter waren`
              : `${label}, das Wort war`
        }
        headline={words.length > 0 ? words.join(" und ") : won ? headline(mode.id) : "Diesmal nicht"}
        lost={!won}
        support={
          quips
            ? `${summary(state)} ${pickQuip(soloResultOccasion(state.mode, won), `${solution ?? ""}:${soloGuessCount(state)}`)}`
            : summary(state)
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="flex-1" onClick={onRestart} disabled={restarting}>
          {restarting ? "Lädt..." : state.mode === "categories" ? "Nächste Runde" : "Neue Runde"}
        </Button>
        {onChangeSetup && (
          <Button variant="outline" className="flex-1" onClick={onChangeSetup} disabled={restarting}>
            {"Kategorien ändern"}
          </Button>
        )}
        <ModesDialogButton className="flex-1">Andere Modi</ModesDialogButton>
      </div>

      {won && <SupportPrompt source="result_kontexto" />}
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
    case "categories":
      return "Gefunden";
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
    case "categories": {
      const tips = state.tips === 0 ? "" : state.tips === 1 ? " und einem Tipp" : ` und ${state.tips} Tipps`;
      return state.status === "won"
        ? `Gelöst mit ${attempts}${tips}.`
        : `Aufgegeben nach ${attempts}.`;
    }
  }
}

function fmt(rank: number): string {
  return Number.isFinite(rank) ? String(rank) : "noch keiner";
}
