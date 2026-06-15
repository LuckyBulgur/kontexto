import KoopCreatePageClient from "@/components/koop/KoopCreatePageClient";
import { buildMetadata } from "@/lib/seo";

// noindex: thin, purely functional lobby-creation form — kept out of the index
// so it doesn't drag down the average quality of indexed pages. The content-rich
// landing page /koop/ stays indexable. (Also removed from app/sitemap.ts.)
export const metadata = buildMetadata({
  path: "/koop/create/",
  title: "Kontexto-Koop erstellen",
  description: "Erstelle einen Kontexto-Koop, wähle das Spiel und lade Freunde per Link ein. Gemeinsam ein Wort finden – kostenlos und ohne Anmeldung.",
  noindex: true,
});

export default function KoopCreatePage() { return <KoopCreatePageClient />; }
