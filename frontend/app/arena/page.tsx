import ArenaPageClient from "@/components/arena/ArenaPageClient";
import ArenaSeo from "@/components/seo/ArenaSeo";
import StructuredData from "@/components/StructuredData";
import { buildMetadata } from "@/lib/seo";
import { faqSchema } from "@/lib/structured-data";
import { arenaFaqs } from "@/lib/faqs";

export const metadata = buildMetadata({
  path: "/arena/",
  title: "Kontexto-Arena - Battle Royale, Blitz-Duell und Zeitbonus-Jagd",
  description:
    "Die drei Kontexto-Modi mit Uhr: Battle Royale mit Ausscheiden, Blitz-Duell über 120 Sekunden und die Zeitbonus-Jagd, bei der nur bessere Wörter Zeit bringen. Kostenlos und ohne Anmeldung.",
});

export default function ArenaPage() {
  return (
    <>
      <StructuredData data={faqSchema(arenaFaqs)} />
      <main>
        <div id="spielbereich" className="scroll-mt-4">
          <ArenaPageClient />
        </div>
        <ArenaSeo />
      </main>
    </>
  );
}
