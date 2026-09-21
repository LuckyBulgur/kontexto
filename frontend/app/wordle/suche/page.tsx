import MatchSearchClient from "@/components/matchmaking/MatchSearchClient";
import { WORDLE_MULTIPLAYER_ORDER } from "@/lib/multiplayer-modes";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/wordle/suche/",
  title: "Wördle-Gegner suchen",
  description: "Finde einen zufälligen Gegner für ein Wördle-Duell. Kein Einladungslink nötig.",
  noindex: true,
});

export default function WordleMatchSearchPage() {
  return (
    <main>
      <MatchSearchClient
        modes={WORDLE_MULTIPLAYER_ORDER}
        game="wordle"
        title="Gegen Fremde spielen"
        description="Kein Link, keine Verabredung. Kurz warten, dann steht der Gegner."
        backHref="/wordle/"
      />
    </main>
  );
}
