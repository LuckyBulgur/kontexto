import Link from "next/link";
import { SeoSection, RelatedLinks } from "@/components/seo/SeoPrimitives";

export default function WordleSeo() {
  return (
    <SeoSection>
      <h1 className="mb-3 text-2xl font-bold text-foreground">Wördle: Wordle auf Deutsch</h1>
      <p className="mb-4 max-w-prose">
        Wördle ist die deutsche Wordle-Variante von Kontexto: Errate jeden Tag ein
        fünfbuchstabiges deutsches Wort in sechs Versuchen. Nach jedem Versuch zeigen
        die Farben, welche Buchstaben stimmen: grün = richtige Position, gelb = im Wort,
        aber falsche Position, grau = nicht enthalten.
      </p>
      <p className="mb-6 max-w-prose">
        Spiele auch das semantische{" "}
        <Link href="/" className="font-medium text-primary underline underline-offset-2 hover:no-underline">
          Kontexto
        </Link>{" "}
        oder fordere Freunde im{" "}
        <Link
          href="/wordle/duel/create/"
          className="font-medium text-primary underline underline-offset-2 hover:no-underline"
        >
          Wördle-Duell
        </Link>{" "}
        heraus.
      </p>
      <RelatedLinks
        heading="Weiterspielen"
        label="Weitere Spiele"
        links={[
          { href: "/", label: "Kontexto: das semantische Wortspiel" },
          { href: "/wordle/duel/create/", label: "Wördle-Duell gegen Freunde" },
        ]}
      />
    </SeoSection>
  );
}
