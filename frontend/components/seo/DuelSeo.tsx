import Link from "next/link";
import { SeoSection, RelatedLinks } from "@/components/seo/SeoPrimitives";

export default function DuelSeo() {
  return (
    <SeoSection>
      <h1 className="mb-3 text-2xl font-bold text-foreground">Kontexto-Duell – gegen Freunde spielen</h1>
      <p className="mb-6 max-w-prose">
        Im Duell-Modus tretet ihr beim selben geheimen Wort gegeneinander an. Erstelle
        ein{" "}
        <Link
          href="/duel/create/"
          className="font-medium text-primary underline underline-offset-2 hover:no-underline"
        >
          neues Duell
        </Link>
        , teile den Link und seht in Echtzeit, wer das Zielwort zuerst findet. Zurück zum
        täglichen{" "}
        <Link href="/" className="font-medium text-primary underline underline-offset-2 hover:no-underline">
          Kontexto
        </Link>
        .
      </p>
      <RelatedLinks
        heading="Weiterspielen"
        label="Weitere Spiele"
        links={[
          { href: "/duel/create/", label: "Neues Duell erstellen" },
          { href: "/", label: "Tägliches Kontexto spielen" },
        ]}
      />
    </SeoSection>
  );
}
