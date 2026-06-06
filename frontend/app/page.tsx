import GameClient from "@/components/GameClient";
import HomeContent from "@/components/seo/HomeContent";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/",
  title: "Kontexto - Das deutsche Wort-Ratespiel | Contexto auf Deutsch",
  description:
    "Kontexto ist die deutsche Version von Contexto! Finde das geheime Wort im täglichen Wort-Ratespiel anhand von Bedeutungsähnlichkeit - kostenlos und ohne Anmeldung.",
});

export default function Home() {
  return (
    <>
      <GameClient />
      <HomeContent />
    </>
  );
}
