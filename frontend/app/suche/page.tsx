import MatchSearchClient from "@/components/matchmaking/MatchSearchClient";
import { KONTEXTO_MULTIPLAYER_ORDER } from "@/lib/multiplayer-modes";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/suche/",
  title: "Mitspieler suchen",
  description: "Finde zufällige Mitspieler für Duell, Koop und die drei Arena-Modi. Kein Einladungslink nötig.",
  noindex: true,
});

export default function MatchSearchPage() {
  return (
    <main>
      <MatchSearchClient
        modes={KONTEXTO_MULTIPLAYER_ORDER}
        game="kontexto"
        title="Gegen Fremde spielen"
        description="Kein Link, keine Verabredung. Modus wählen, kurz warten, losspielen."
        backHref="/modi/"
      />
    </main>
  );
}
