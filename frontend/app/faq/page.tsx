import ArticleLayout from "@/components/content/ArticleLayout";
import Prose from "@/components/content/Prose";
import SeoFaq from "@/components/seo/SeoFaq";
import { RelatedLinks } from "@/components/seo/SeoPrimitives";
import StructuredData from "@/components/StructuredData";
import { faqSchema } from "@/lib/structured-data";
import { buildMetadata } from "@/lib/seo";
import { faqGroups } from "@/lib/faqs";

export const metadata = buildMetadata({
  path: "/faq/",
  title: "FAQ: häufige Fragen zu Kontexto",
  description:
    "Antworten auf die häufigsten Fragen zu Kontexto: Wie die KI-Ähnlichkeit funktioniert, wann es ein neues Wort gibt, was die Farben bedeuten, ob es eine App gibt und mehr.",
});

/**
 * Einleitungen zu den sechs Themengruppen. Sie leben hier und nicht in
 * lib/faqs.ts, weil sie interne Links tragen und die FAQ-Antworten selbst
 * reiner Text bleiben sollen (SeoFaq rendert sie als Textknoten, damit sie ohne
 * JavaScript im HTML stehen).
 */
const INTROS: Record<string, React.ReactNode> = {
  spielprinzip: (
    <p>
      Die Regeln passen in zwei Sätze, die Feinheiten nicht. Hier steht, was ein Rang
      aussagt, wie lange ein Rätsel offen bleibt und was die drei Tipp-Stufen
      voneinander unterscheidet. Den Ablauf mit Bildern zeigt die{" "}
      <a href="/anleitung/">Spielanleitung</a>.
    </p>
  ),
  technik: (
    <p>
      Der Rang ist keine Meinung, sondern eine Rechnung. Diese drei Antworten
      erklären, woher die Zahl kommt, warum ein Gegenteil manchmal ganz vorne liegt
      und weshalb hier ein Rang steht statt eines Prozentwerts. Die Begriffe dazu
      stehen im <a href="/glossar/">Glossar</a>.
    </p>
  ),
  woerter: (
    <p>
      Die häufigsten Fragen drehen sich um Wörter: welche das Spiel kennt, welche als
      Lösung infrage kommen und mit welchen man am besten anfängt. Die Antworten
      stützen sich auf die Auswertung aller 2.400 Rätsel, ausführlich in{" "}
      <a href="/strategie/">Strategie und Tipps</a>.
    </p>
  ),
  geraete: (
    <p>
      Kontexto läuft im Browser, ohne Konto und ohne Installation. Das hat Folgen für
      den Spielstand, für den Wechsel zwischen Geräten und dafür, wie das gemeinsame
      Spielen organisiert ist.
    </p>
  ),
  abgrenzung: (
    <p>
      Wortspiele gibt es viele, und sie messen Verschiedenes. Diese Antworten grenzen
      Kontexto gegen die drei häufigsten Verwechslungen ab. Alle vier Spiele
      nebeneinander stehen im <a href="/vergleich/">großen Vergleich</a>.
    </p>
  ),
  daten: (
    <p>
      Kontexto ist kostenlos und finanziert sich über Werbung. Was dabei gespeichert
      wird und was nicht, steht hier in Kurzform und vollständig in der{" "}
      <a href="/datenschutz/">Datenschutzerklärung</a>.
    </p>
  ),
};

export default function FaqPage() {
  return (
    <ArticleLayout
      title="Häufige Fragen (FAQ)"
      lead="Alles, was du über Kontexto wissen musst, von der Spielmechanik über die Technik bis zu Datenschutz und Geräten."
      breadcrumbName="FAQ"
      path="/faq/"
      toc={faqGroups.map((g) => ({ id: g.id, label: g.title }))}
    >
      <StructuredData data={faqSchema()} />

      {faqGroups.map((g) => (
        <section key={g.id} className="space-y-4">
          <Prose>
            <h2 id={g.id}>{g.title}</h2>
            {INTROS[g.id]}
          </Prose>
          <SeoFaq items={g.items} />
        </section>
      ))}

      <Prose>
        <p>
          Deine Frage war nicht dabei? In der <a href="/anleitung/">Spielanleitung</a> und auf der{" "}
          <a href="/strategie/">Strategie-Seite</a> findest du weitere Details, das{" "}
          <a href="/glossar/">Glossar</a> erklärt die Begriffe hinter dem Spiel, und über die{" "}
          <a href="/kontakt/">Kontaktseite</a> erreichst du uns direkt.
        </p>
      </Prose>

      <RelatedLinks
        heading="Mehr entdecken"
        label="Verwandte Seiten"
        links={[
          { href: "/anleitung/", label: "Spielanleitung" },
          { href: "/strategie/", label: "Strategie & Tipps" },
          { href: "/vergleich/", label: "Kontexto vs. Wordle, Contexto & Semantle" },
          { href: "/ueber/", label: "Über Kontexto" },
        ]}
      />
    </ArticleLayout>
  );
}
