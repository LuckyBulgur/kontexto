import DuelPageClient from "@/components/duel/DuelPageClient";
import DuelSeo from "@/components/seo/DuelSeo";
import StructuredData from "@/components/StructuredData";
import { faqSchema } from "@/lib/structured-data";
import { buildMetadata } from "@/lib/seo";
import { duelFaqs } from "@/lib/faqs";

export const metadata = buildMetadata({
  path: "/duel/",
  title: "Kontexto-Duell - gegen Freunde spielen",
  description: "Spiele Kontexto im Duell gegen Freunde: gleiches geheimes Wort, Live-Fortschritt, wer findet es zuerst? Kostenlos und ohne Anmeldung.",
});

export default function DuelPage() {
  return (
    <>
      <StructuredData data={faqSchema(duelFaqs)} />
      <main>
        <DuelPageClient />
      </main>
      <DuelSeo />
    </>
  );
}
