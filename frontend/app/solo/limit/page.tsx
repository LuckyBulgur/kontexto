import SoloModeClient from "@/components/solo/SoloModeClient";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/solo/limit/",
  title: "Kontexto mit limitierten Versuchen - 20 Wörter, keine Tipps",
  description:
    "Zwanzig Versuche, keine Tipps: der harte Modus von Kontexto. Finde das geheime Wort, bevor das Budget aufgebraucht ist. Kostenlos und ohne Anmeldung.",
});

export default function LimitPage() {
  return (
    <main>
      <div id="spielbereich" className="scroll-mt-4">
        <SoloModeClient mode="limit" />
      </div>
    </main>
  );
}
