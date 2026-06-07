import ArticleLayout from "@/components/content/ArticleLayout";
import Prose from "@/components/content/Prose";
import SeoFaq from "@/components/seo/SeoFaq";
import { RelatedLinks } from "@/components/seo/SeoPrimitives";
import StructuredData from "@/components/StructuredData";
import { faqSchema } from "@/lib/structured-data";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/faq/",
  title: "FAQ – Häufige Fragen zu Kontexto",
  description:
    "Antworten auf die häufigsten Fragen zu Kontexto: Wie die KI-Ähnlichkeit funktioniert, wann es ein neues Wort gibt, was die Farben bedeuten, ob es eine App gibt und mehr.",
});

export default function FaqPage() {
  return (
    <ArticleLayout
      title="Häufige Fragen (FAQ)"
      lead="Alles, was du über Kontexto wissen musst – von der Spielmechanik über die Technik bis zu Datenschutz und Geräten."
      breadcrumbName="FAQ"
      path="/faq/"
    >
      <StructuredData data={faqSchema()} />

      <SeoFaq />

      <Prose>
        <p>
          Deine Frage war nicht dabei? In der <a href="/anleitung/">Spielanleitung</a> und auf der{" "}
          <a href="/strategie/">Strategie-Seite</a> findest du weitere Details, und das{" "}
          <a href="/glossar/">Glossar</a> erklärt die Begriffe hinter dem Spiel.
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
