import GameClient from "@/components/GameClient";
import HomeContent from "@/components/seo/HomeContent";
import StructuredData from "@/components/StructuredData";
import { buildMetadata } from "@/lib/seo";
import { gameSchema, faqSchema } from "@/lib/structured-data";
import { getRatingAggregate } from "@/lib/rating-build";

export const metadata = buildMetadata({
  path: "/",
  title: "Kontexto - Das deutsche Wort-Ratespiel | Contexto auf Deutsch",
  description:
    "Kontexto ist die deutsche Version von Contexto! Finde das geheime Wort im täglichen Wort-Ratespiel anhand von Bedeutungsähnlichkeit - kostenlos und ohne Anmeldung.",
});

export default async function Home() {
  const rating = await getRatingAggregate();
  return (
    <>
      <StructuredData data={gameSchema(rating)} />
      <StructuredData data={faqSchema()} />
      <GameClient />
      <HomeContent />
    </>
  );
}
