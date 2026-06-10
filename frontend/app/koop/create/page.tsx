import KoopCreatePageClient from "@/components/koop/KoopCreatePageClient";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/koop/create/",
  title: "Kontexto-Koop erstellen",
  description: "Erstelle einen Kontexto-Koop, wähle das Spiel und lade Freunde per Link ein. Gemeinsam ein Wort finden – kostenlos und ohne Anmeldung.",
});

export default function KoopCreatePage() { return <KoopCreatePageClient />; }
