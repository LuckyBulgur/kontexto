import ModesSeo from "@/components/seo/ModesSeo";
import StructuredData from "@/components/StructuredData";
import { buildMetadata } from "@/lib/seo";
import { faqSchema } from "@/lib/structured-data";
import { modesFaqs } from "@/lib/faqs";

export const metadata = buildMetadata({
  path: "/modi/",
  title: "Alle Kontexto-Spielmodi - Duell, Koop, Battle Royale und mehr",
  description:
    "Jeder Kontexto-Modus auf einen Blick: Duell, Koop, Wördle-Duell, Battle Royale, Blitz-Duell, Zeitbonus-Jagd und vier Solo-Modi. Mit Einladungslink oder gegen zufällige Mitspieler.",
});

export default function ModesPage() {
  return (
    <>
      <StructuredData data={faqSchema(modesFaqs)} />
      <main>
        <ModesSeo />
      </main>
    </>
  );
}
