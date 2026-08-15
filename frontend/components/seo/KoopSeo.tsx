import Link from "next/link";
import { SeoSection, RelatedLinks } from "@/components/seo/SeoPrimitives";

export default function KoopSeo() {
  return (
    <SeoSection>
      <h1 className="mb-3 text-2xl font-bold text-foreground">Kontexto-Koop: gemeinsam spielen</h1>
      <p className="mb-6 max-w-prose">
        Im Koop-Modus sucht ihr gemeinsam dasselbe geheime Wort. Erstelle einen{" "}
        <Link
          href="/koop/create/"
          className="font-medium text-primary underline underline-offset-2 hover:no-underline"
        >
          neuen Koop
        </Link>
        , teile den Link und ihr ratet zusammen an einer geteilten Liste: Jeder Tipp ist
        sofort für alle sichtbar, und ihr gewinnt als Team, sobald jemand das Zielwort
        findet. Zurück zum täglichen{" "}
        <Link href="/" className="font-medium text-primary underline underline-offset-2 hover:no-underline">
          Kontexto
        </Link>
        .
      </p>
      <RelatedLinks
        heading="Weiterspielen"
        label="Weitere Spiele"
        links={[
          { href: "/koop/create/", label: "Neuen Koop erstellen" },
          { href: "/duel/create/", label: "Duell gegen Freunde" },
          { href: "/", label: "Tägliches Kontexto spielen" },
        ]}
      />
    </SeoSection>
  );
}
