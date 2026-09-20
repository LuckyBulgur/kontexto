import ArenaPageClient from "@/components/arena/ArenaPageClient";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/arena/",
  title: "Kontexto-Arena - Battle Royale, Blitz und Zeitbonus-Jagd",
  description:
    "Die drei Kontexto-Runden mit Uhr: Battle Royale mit Ausscheiden, Blitz-Duell auf 120 Sekunden und die Zeitbonus-Jagd. Kostenlos und ohne Anmeldung.",
});

export default function ArenaPage() {
  return (
    <main>
      <div id="spielbereich" className="scroll-mt-4">
        <ArenaPageClient />
      </div>
    </main>
  );
}
