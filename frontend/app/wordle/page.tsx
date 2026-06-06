import WordlePageClient from "@/components/wordle/WordlePageClient";
import WordleSeo from "@/components/seo/WordleSeo";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/wordle/",
  title: "Wördle - Wordle auf Deutsch",
  description: "Wördle: das tägliche deutsche Wordle. Errate das 5-Buchstaben-Wort in 6 Versuchen - kostenlos, ohne Anmeldung, täglich neu.",
});

export default function WordlePage() {
  return (<><WordlePageClient /><WordleSeo /></>);
}
