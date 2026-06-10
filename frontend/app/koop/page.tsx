import KoopPageClient from "@/components/koop/KoopPageClient";
import KoopSeo from "@/components/seo/KoopSeo";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/koop/",
  title: "Kontexto-Koop - gemeinsam mit Freunden spielen",
  description: "Spiele Kontexto im Koop-Modus: gemeinsam dasselbe geheime Wort finden, geteilte Rateliste, Live-Fortschritt. Kostenlos und ohne Anmeldung.",
});

export default function KoopPage() {
  return (<><KoopPageClient /><KoopSeo /></>);
}
