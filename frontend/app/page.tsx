import GameClient from "@/components/GameClient";
import HomeContent from "@/components/seo/HomeContent";
import StructuredData from "@/components/StructuredData";
import { buildMetadata } from "@/lib/seo";
import { gameSchema, faqSchema } from "@/lib/structured-data";

export const metadata = buildMetadata({
  path: "/",
  title: "Kontexto - Das deutsche Wort-Ratespiel | Contexto auf Deutsch",
  description:
    "Kontexto ist die deutsche Version von Contexto! Finde das geheime Wort im täglichen Wort-Ratespiel anhand von Bedeutungsähnlichkeit - kostenlos und ohne Anmeldung.",
});

export default function Home() {
  return (
    <>
      <StructuredData data={gameSchema()} />
      <StructuredData data={faqSchema()} />
      {/*
        Content-first intro above the game: a reviewer (and a crawler) sees a
        descriptive title and lead before the interactive board, so the page
        reads as content, not a bare widget. This carries the page's single
        <h1> — HomeContent below must therefore not render another one.
      */}
      <section className="mx-auto max-w-lg px-4 pt-4">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Kontexto – das deutsche Wort-Ratespiel
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Die deutsche Version von Contexto: Errate täglich das geheime Wort
          anhand seiner Bedeutung – kostenlos und ohne Anmeldung.
        </p>
      </section>
      <GameClient />
      <HomeContent />
    </>
  );
}
