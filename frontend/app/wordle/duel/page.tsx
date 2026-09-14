import WordleDuelPageClient from "@/components/wordle/duel/WordleDuelPageClient";
import GameIntro from "@/components/seo/GameIntro";
import WordleDuelSeo from "@/components/seo/WordleDuelSeo";
import StructuredData from "@/components/StructuredData";
import { faqSchema } from "@/lib/structured-data";
import { buildMetadata } from "@/lib/seo";
import { wordleDuelFaqs } from "@/lib/faqs";

export const metadata = buildMetadata({
  path: "/wordle/duel/",
  title: "Wördle-Duell - Wordle gegen Freunde",
  description: "Wördle im Duell: gleiches Wort, 6 Versuche, Live-Fortschritt der Gegner. Erstelle ein Duell und teile den Link, kostenlos.",
});

export default function WordleDuelPage() {
  return (
    <>
      <StructuredData data={faqSchema(wordleDuelFaqs)} />
      <main>
        <GameIntro mode="wordle-duel" />
        <div id="spielbereich" className="scroll-mt-4">
          <WordleDuelPageClient />
        </div>
        <WordleDuelSeo />
      </main>
    </>
  );
}
