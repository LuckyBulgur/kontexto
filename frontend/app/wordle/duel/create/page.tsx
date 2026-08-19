import WordleDuelCreatePageClient from "@/components/wordle/duel/WordleDuelCreatePageClient";
import { buildMetadata } from "@/lib/seo";

// noindex: thin, purely functional lobby-creation form, kept out of the index
// so it doesn't drag down the average quality of indexed pages. The content-rich
// landing page /wordle/duel/ stays indexable. (Also removed from app/sitemap.ts.)
// Statisch im HTML, nicht per JS injiziert: Crawler ohne JS-Rendering (u. a.
// Mediapartners-Google) sahen sonst eine indexierbare Seite mit 48 Wörtern.
export const metadata = buildMetadata({
  path: "/wordle/duel/create/",
  title: "Wördle-Duell erstellen",
  description: "Erstelle ein Wördle-Duell, wähle das Spiel und lade Freunde per Link ein. Kostenlos und ohne Anmeldung.",
  noindex: true,
});

export default function WordleDuelCreatePage() { return <WordleDuelCreatePageClient />; }
