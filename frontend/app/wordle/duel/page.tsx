import WordleDuelPageClient from "@/components/wordle/duel/WordleDuelPageClient";
import WordleDuelSeo from "@/components/seo/WordleDuelSeo";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/wordle/duel/",
  title: "Wördle-Duell - Wordle gegen Freunde",
  description: "Wördle im Duell: gleiches Wort, 6 Versuche, Live-Fortschritt der Gegner. Erstelle ein Duell und teile den Link - kostenlos.",
});

export default function WordleDuelPage() {
  return (<><WordleDuelPageClient /><WordleDuelSeo /></>);
}
