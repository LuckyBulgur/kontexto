import SoloModeClient from "@/components/solo/SoloModeClient";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/solo/doppelziel/",
  title: "Kontexto Doppelziel - zwei geheime Wörter gleichzeitig",
  description:
    "Zwei geheime Wörter auf einmal: jedes geratene Wort bekommt zwei Ränge. Gewonnen hast du erst, wenn du beide gefunden hast. Kostenlos und ohne Anmeldung.",
});

export default function DoppelzielPage() {
  return (
    <main>
      <div id="spielbereich" className="scroll-mt-4">
        <SoloModeClient mode="doppel" />
      </div>
    </main>
  );
}
