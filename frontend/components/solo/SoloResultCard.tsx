"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="rounded-xl border bg-card p-6 space-y-4 text-center">
      <h2 className="text-xl font-bold">{won ? headline(mode.id) : "Diesmal nicht"}</h2>

      <p className="text-sm text-muted-foreground">{summary(state)}</p>

      {(solution || secondSolution) && (
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {state.mode === "doppel" ? "Die gesuchten Wörter" : "Das gesuchte Wort"}
          </p>
          <p className="text-lg font-bold">
            {[solution, secondSolution].filter(Boolean).join(" und ")}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button onClick={onRestart} disabled={restarting}>
          {restarting ? "Lädt..." : "Neue Runde"}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/modi/">Andere Modi</Link>
        </Button>
      </div>
    </div>
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
