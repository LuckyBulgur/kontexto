import KoopPageClient from "@/components/koop/KoopPageClient";
import KoopSeo from "@/components/seo/KoopSeo";
import StructuredData from "@/components/StructuredData";
import { faqSchema } from "@/lib/structured-data";
import { buildMetadata } from "@/lib/seo";
import { koopFaqs } from "@/lib/faqs";

export const metadata = buildMetadata({
  path: "/koop/",
  title: "Kontexto-Koop - gemeinsam mit Freunden spielen",
  description: "Spiele Kontexto im Koop-Modus: gemeinsam dasselbe geheime Wort finden, geteilte Rateliste, Live-Fortschritt. Kostenlos und ohne Anmeldung.",
});

export default function KoopPage() {
  return (
    <>
      <StructuredData data={faqSchema(koopFaqs)} />
      <main>
        <KoopPageClient />
      </main>
      <KoopSeo />
    </>
  );
}
