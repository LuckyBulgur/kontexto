import GameClient from "@/components/GameClient";
import HomeContent from "@/components/seo/HomeContent";
import StructuredData from "@/components/StructuredData";
import { buildMetadata } from "@/lib/seo";
import { gameSchema, faqSchema } from "@/lib/structured-data";
import { homeFaqs } from "@/lib/faqs";

export const metadata = buildMetadata({
  path: "/",
  title: "Kontexto - Das tägliche deutsche Wort-Ratespiel",
  description:
    "Errate jeden Tag das geheime Wort. Nach jedem Tipp zeigt Kontexto per Rang, wie nah du an der Bedeutung des Zielworts bist. Unbegrenzt viele Versuche, kostenlos und ohne Anmeldung.",
});

export default function Home() {
  return (
    <>
      <StructuredData data={gameSchema()} />
      <StructuredData data={faqSchema(homeFaqs)} />
      <GameClient />
      <HomeContent />
    </>
  );
}
