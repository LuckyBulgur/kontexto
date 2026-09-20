import SoloModeClient from "@/components/solo/SoloModeClient";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/solo/leiter/",
  title: "Kontexto Leiter - jedes Wort muss näher dran sein",
  description:
    "Im Leiter-Modus muss jedes Wort näher am geheimen Wort liegen als das vorige. Drei Fehlversuche, dann ist die Runde vorbei. Kostenlos und ohne Anmeldung.",
});

export default function LeiterPage() {
  return (
    <main>
      <div id="spielbereich" className="scroll-mt-4">
        <SoloModeClient mode="leiter" />
      </div>
    </main>
  );
}
