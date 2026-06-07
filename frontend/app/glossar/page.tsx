import ArticleLayout from "@/components/content/ArticleLayout";
import Prose from "@/components/content/Prose";
import { RelatedLinks } from "@/components/seo/SeoPrimitives";
import StructuredData from "@/components/StructuredData";
import { definedTermSetSchema } from "@/lib/structured-data";
import { buildMetadata } from "@/lib/seo";
import { glossary } from "@/lib/glossary";

export const metadata = buildMetadata({
  path: "/glossar/",
  title: "Glossar – die Begriffe hinter Kontexto",
  description:
    "Worteinbettung, fastText, Kosinus-Ähnlichkeit, Vektorraum, Rang, Korpus & Co.: verständliche Definitionen der wichtigsten Begriffe rund um Kontexto und KI-Sprachmodelle.",
});

const toc = glossary.map((t) => ({ id: t.slug, label: t.term }));

export default function GlossarPage() {
  return (
    <ArticleLayout
      title="Glossar"
      lead="Die wichtigsten Begriffe rund um Kontexto und die Sprach-KI dahinter – kurz und verständlich erklärt."
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
        <p>
          Diese Begriffe begegnen dir in der <a href="/anleitung/">Spielanleitung</a>, in der{" "}
          <a href="/strategie/">Strategie</a> und in vielen <a href="/blog/">Blog-Artikeln</a>.
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
