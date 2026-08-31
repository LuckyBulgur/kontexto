import WordlePageClient from "@/components/wordle/WordlePageClient";
import WordleSeo from "@/components/seo/WordleSeo";
import StructuredData from "@/components/StructuredData";
import { faqSchema } from "@/lib/structured-data";
import { buildMetadata } from "@/lib/seo";
import { wordleFaqs } from "@/lib/faqs";

export const metadata = buildMetadata({
  path: "/wordle/",
  title: "Wördle: Wordle auf Deutsch",
  description:
    "Wördle: das tägliche deutsche Wordle. Errate das Wort mit fünf Buchstaben in sechs Versuchen, kostenlos, ohne Anmeldung, täglich neu. Mit Startwort-Tipps und Wortlisten-Hintergrund.",
});

export default function WordlePage() {
  return (
    <>
      <StructuredData data={faqSchema(wordleFaqs)} />
      <main>
        <WordlePageClient />
      </main>
      <WordleSeo />
    </>
  );
}
