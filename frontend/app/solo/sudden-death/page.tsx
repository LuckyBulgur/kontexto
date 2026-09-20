import SoloModeClient from "@/components/solo/SoloModeClient";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/solo/sudden-death/",
  title: "Kontexto Sudden Death - ein Versuch, ein Wort",
  description:
    "Du siehst die fünf nächsten Nachbarn des geheimen Worts und hast genau einen Versuch. Die kurze Kontexto-Runde für zwischendurch, kostenlos und ohne Anmeldung.",
});

export default function SuddenDeathPage() {
  return (
    <main>
      <div id="spielbereich" className="scroll-mt-4">
        <SoloModeClient mode="suddendeath" />
      </div>
    </main>
  );
}
