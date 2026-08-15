import ArticleLayout from "@/components/content/ArticleLayout";
import Prose from "@/components/content/Prose";
import { RelatedLinks } from "@/components/seo/SeoPrimitives";
import StructuredData from "@/components/StructuredData";
import { definedTermSetSchema } from "@/lib/structured-data";
import { buildMetadata } from "@/lib/seo";
import { glossary } from "@/lib/glossary";

export const metadata = buildMetadata({
  path: "/glossar/",
  title: "Glossar: die Begriffe hinter Kontexto",
  description:
    "Worteinbettung, fastText, Kosinus-Ähnlichkeit, Vektorraum, Rang, Bloom-Filter, Zipf-Häufigkeit: verständliche Definitionen der Begriffe hinter Kontexto und der Sprach-KI.",
});

const toc = glossary.map((t) => ({ id: t.slug, label: t.term }));

export default function GlossarPage() {
  return (
    <ArticleLayout
      title="Glossar"
      lead="Die Begriffe rund um Kontexto und die Sprach-KI dahinter, kurz und ohne Formeln erklärt. Alphabetisch sortiert, jeder Eintrag ist einzeln verlinkbar."
      breadcrumbName="Glossar"
      path="/glossar/"
      toc={toc}
    >
      <StructuredData data={definedTermSetSchema("Kontexto-Glossar", "/glossar/", glossary)} />

      <dl className="space-y-6">
        {glossary.map((t) => (
          <div key={t.slug} id={t.slug} className="scroll-mt-24 border-t border-border pt-5">
            <dt className="text-lg font-semibold text-foreground">{t.term}</dt>
            <dd className="mt-1.5 leading-7 text-muted-foreground">{t.definition}</dd>
          </div>
        ))}
      </dl>

      <Prose>
        <h2>Wie die Begriffe zusammenhängen</h2>
        <p>
          Die Einträge oben stehen alphabetisch, weil man so am schnellsten nachschlägt. Beim ersten
          Lesen ist die inhaltliche Reihenfolge hilfreicher, denn die Begriffe bauen aufeinander auf.
        </p>
        <p>
          Am Anfang steht der <a href="/glossar/#korpus">Korpus</a>, also eine riesige Sammlung
          deutscher Texte. Daraus lernt <a href="/glossar/#fasttext">fastText</a> für jedes Wort eine{" "}
          <a href="/glossar/#worteinbettung">Worteinbettung</a>, einen Vektor aus 300 Zahlen. Alle
          diese Vektoren zusammen bilden den <a href="/glossar/#vektorraum">Vektorraum</a>, in dem
          Nähe Bedeutungsähnlichkeit heißt.
        </p>
        <p>
          Weil rohe Vektoren einen Häufigkeitsdrift tragen, läuft danach die Entzerrung nach dem
          Verfahren <a href="/glossar/#all-but-the-top">All-but-the-Top</a>, die den Mittelwert und
          die stärksten <a href="/glossar/#hauptkomponente">Hauptkomponenten</a> entfernt. Erst
          danach misst die <a href="/glossar/#kosinus-aehnlichkeit">Kosinus-Ähnlichkeit</a> das, was
          sie messen soll, und aus ihr entsteht der <a href="/glossar/#rang">Rang</a>, den du im
          Spiel siehst.
        </p>
        <p>
          Auf der Auswahlseite gibt es zwei getrennte Mengen: das{" "}
          <a href="/glossar/#vokabular">Vokabular</a> mit allen ratbaren Wörtern und den deutlich
          kleineren Pool möglicher <a href="/glossar/#zielwort">Lösungswörter</a>, der nur Inhaltswörter
          in <a href="/glossar/#lemma">Grundform</a> zulässt, also{" "}
          <a href="/glossar/#gattungsname">Gattungsnamen</a>, Verben und Adjektive oberhalb einer{" "}
          <a href="/glossar/#zipf-haeufigkeit">Zipf-Häufigkeit</a> von 4,0 zulässt.
        </p>
        <p>
          Diese Begriffe begegnen dir in der <a href="/anleitung/">Spielanleitung</a>, in der{" "}
          <a href="/strategie/">Strategie</a> und in vielen <a href="/blog/">Blog-Artikeln</a>. Wenn
          dir ein Begriff fehlt, schreib uns über die <a href="/kontakt/">Kontaktseite</a>.
        </p>
      </Prose>

      <RelatedLinks
        heading="Mehr erfahren"
        label="Verwandte Seiten"
        links={[
          { href: "/ueber/", label: "Über Kontexto & die Technik" },
          { href: "/blog/worteinbettungen-erklaert/", label: "Worteinbettungen einfach erklärt" },
          { href: "/blog/kosinus-aehnlichkeit-einfach-erklaert/", label: "Kosinus-Ähnlichkeit erklärt" },
          { href: "/strategie/", label: "Strategie & Tipps" },
        ]}
      />
    </ArticleLayout>
  );
}
