import SoloModeClient from "@/components/solo/SoloModeClient";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/solo/kategorien/",
  title: "Kontexto nach Kategorien - Tiere, Essen, Musik und mehr",
  description:
    "Wähle die Kategorien, aus denen das geheime Wort kommt: Tiere, Essen und Trinken, Musik oder alle. Auf Wunsch steht die Kategorie über dem Spielfeld. Kostenlos und ohne Anmeldung.",
});

export default function KategorienPage() {
  return (
    <main>
      <div id="spielbereich" className="scroll-mt-4">
        <SoloModeClient mode="categories" />
      </div>
    </main>
  );
}
