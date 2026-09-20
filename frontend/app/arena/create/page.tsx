import ArenaCreatePageClient from "@/components/arena/ArenaCreatePageClient";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/arena/create/",
  title: "Arena-Runde erstellen",
  description: "Erstelle eine Kontexto-Arena und lade Freunde per Link ein.",
  noindex: true,
});

export default function ArenaCreatePage() {
  return (
    <main>
      <ArenaCreatePageClient />
    </main>
  );
}
