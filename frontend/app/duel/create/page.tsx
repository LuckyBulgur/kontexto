import DuelCreatePageClient from "@/components/duel/DuelCreatePageClient";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/duel/create/",
  title: "Kontexto-Duell erstellen",
  description: "Erstelle ein Kontexto-Duell, wähle das Spiel und lade Freunde per Link ein. Kostenlos und ohne Anmeldung.",
});

export default function DuelCreatePage() { return <DuelCreatePageClient />; }
