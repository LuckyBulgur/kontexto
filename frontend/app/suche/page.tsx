import MatchSearchClient from "@/components/matchmaking/MatchSearchClient";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/suche/",
  title: "Mitspieler suchen",
  description: "Finde zufällige Mitspieler für Duell, Koop, Wördle-Duell und die Arena-Modi. Kein Einladungslink nötig.",
  noindex: true,
});

export default function MatchSearchPage() {
  return (
    <main>
      <MatchSearchClient />
    </main>
  );
}
