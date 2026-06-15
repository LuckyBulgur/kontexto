import DuelCreatePageClient from "@/components/duel/DuelCreatePageClient";
import { buildMetadata } from "@/lib/seo";

// noindex: thin, purely functional lobby-creation form — kept out of the index
// so it doesn't drag down the average quality of indexed pages. The content-rich
// landing page /duel/ stays indexable. (Also removed from app/sitemap.ts.)
export const metadata = buildMetadata({
  path: "/duel/create/",
  title: "Kontexto-Duell erstellen",
  description: "Erstelle ein Kontexto-Duell, wähle das Spiel und lade Freunde per Link ein. Kostenlos und ohne Anmeldung.",
  noindex: true,
});

export default function DuelCreatePage() { return <DuelCreatePageClient />; }
