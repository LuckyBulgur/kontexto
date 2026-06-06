import TextPage from "@/components/seo/LegalLayout";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/anleitung/",
  title: "Spielanleitung – So spielst du Kontexto",
  description: "Die komplette Kontexto-Anleitung: Wörter eingeben, Rang verstehen, Farben deuten und das geheime Wort des Tages finden. Mit Beispielen.",
});

export default function AnleitungPage() {
  return (
    <TextPage title="Spielanleitung" breadcrumbName="Anleitung" path="/anleitung/">
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">1. Ein Wort eingeben</h2>
        <p>Tippe ein beliebiges deutsches Wort ein und drücke Enter. Du hast unbegrenzt viele Versuche.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">2. Den Rang lesen</h2>
        <p>Jedes Wort bekommt einen Rang. Rang 1 ist das gesuchte Zielwort. Je kleiner die Zahl, desto näher liegt dein Wort an der Bedeutung des Zielworts.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">3. Die Farben deuten</h2>
        <p>Grün (Rang 1–300) bedeutet sehr nah, Gelb (301–1500) bedeutet auf dem richtigen Weg, Rot (ab 1501) bedeutet weit entfernt.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">4. Strategisch raten</h2>
        <p>Nutze nahe Wörter als Hinweis: Liegt „Meer" weit vorne, probiere verwandte Begriffe wie „Ozean", „Küste" oder „Welle". So tastest du dich an das Themenfeld des Zielworts heran.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Jeden Tag ein neues Wort</h2>
        <p>Um Mitternacht startet ein neues Rätsel. Alle Spielenden raten dasselbe Wort. Vergangene Rätsel findest du im <a className="text-primary underline" href="/archiv/">Archiv</a>.</p>
      </section>
    </TextPage>
  );
}
