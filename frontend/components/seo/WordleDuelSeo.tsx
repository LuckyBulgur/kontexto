import Link from "next/link";
import { SeoSection, RelatedLinks } from "@/components/seo/SeoPrimitives";

export default function WordleDuelSeo() {
  return (
    <SeoSection>
      <h1 className="mb-3 text-2xl font-bold text-foreground">Wördle-Duell: Wordle gegen Freunde</h1>
      <p className="mb-6 max-w-prose">
        Spiele Wördle im Duell: gleiches Wort, sechs Versuche, Live-Fortschritt eurer
        Gegner.{" "}
        <Link
          href="/wordle/duel/create/"
          className="font-medium text-primary underline underline-offset-2 hover:no-underline"
        >
          Duell erstellen
        </Link>{" "}
        und Link teilen. Zurück zum{" "}
        <Link
          href="/wordle/"
          className="font-medium text-primary underline underline-offset-2 hover:no-underline"
        >
          Wördle
        </Link>
        .
      </p>
      <RelatedLinks
        heading="Weiterspielen"
        label="Weitere Spiele"
        links={[
          { href: "/wordle/duel/create/", label: "Wördle-Duell erstellen" },
          { href: "/wordle/", label: "Zum täglichen Wördle" },
        ]}
      />
    </SeoSection>
  );
}
