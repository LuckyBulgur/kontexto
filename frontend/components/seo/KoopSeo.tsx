import Link from "next/link";
import { Users, ListChecks, Compass, GraduationCap } from "lucide-react";
import {
  SeoSection,
  SeoHeading,
  FeatureGrid,
  FeatureCard,
  StepList,
  Step,
  RelatedLinks,
} from "@/components/seo/SeoPrimitives";
import SeoFaq from "@/components/seo/SeoFaq";
import { koopFaqs } from "@/lib/faqs";

export default function KoopSeo() {
  return (
    <SeoSection>
      <h1 className="mb-3 text-2xl font-bold text-foreground">
        Kontexto-Koop: gemeinsam spielen
      </h1>
      <p className="max-w-prose">
        Im Koop-Modus sucht ihr gemeinsam dasselbe geheime Wort und teilt euch eine einzige
        Rateliste. Jedes Wort, das jemand eintippt, erscheint sofort bei allen anderen mit seinem
        Rang.{" "}
        <Link
          href="/koop/create/"
          className="font-medium text-primary underline underline-offset-2 hover:no-underline"
        >
          Koop erstellen
        </Link>
        , Link teilen, loslegen. Ohne Konto, ohne Installation.
      </p>

      <SeoHeading>Was Koop vom Duell unterscheidet</SeoHeading>
      <FeatureGrid>
        <FeatureCard icon={ListChecks} title="Eine geteilte Rateliste">
          Alle sehen jeden Zug mit Rang, nach Nähe sortiert. Im Duell bleiben die Wörter des
          Gegenübers verborgen, hier sind sie das gemeinsame Arbeitsmaterial.
        </FeatureCard>
        <FeatureCard icon={Users} title="Beliebig viele Mitspielende">
          Jeder, der den Link öffnet und einen Namen eingibt, rät mit. Gleiche Namen werden
          automatisch unterscheidbar gemacht.
        </FeatureCard>
        <FeatureCard icon={Compass} title="Kein Sieger, ein Ergebnis">
          Ihr löst zusammen oder gebt zusammen auf. Der Aufgeben-Knopf löst für alle auf, weil eine
          geteilte Liste ohne geteiltes Ende keinen Sinn ergäbe.
        </FeatureCard>
        <FeatureCard icon={GraduationCap} title="Gut zum Beibringen">
          Man sieht die Ränge der anderen und kann fragen, warum jemand ein bestimmtes Wort gewählt
          hat. Am fremden Zug lernt man oft mehr als am eigenen.
        </FeatureCard>
      </FeatureGrid>

      <SeoHeading>In drei Schritten starten</SeoHeading>
      <StepList>
        <Step index={1} title="Koop erstellen">
          Wähle das heutige Rätsel oder ein zufälliges und entscheide, ob Tipps erlaubt sind.
        </Step>
        <Step index={2} title="Link teilen">
          Einen Link an alle schicken, die mitraten sollen. Es gibt keine Obergrenze.
        </Step>
        <Step index={3} title="Aufteilen und raten">
          Vor dem ersten Zug kurz absprechen, wer welchen Bereich übernimmt. Das ist der ganze
          Trick.
        </Step>
      </StepList>

      <SeoHeading>Der häufigste Fehler zu mehreren</SeoHeading>
      <p className="max-w-prose">
        Drei Leute, die gleichzeitig Synonyme für dasselbe Wort eintippen, erzeugen drei fast
        identische Ränge und keinerlei neue Information. Genau das passiert ohne Absprache fast
        immer, weil alle dieselbe naheliegende Assoziation haben.
      </p>
      <p className="mt-3 max-w-prose">
        Die einfachste Absprache, die funktioniert: Jeder nimmt einen Bereich. Einer probiert Natur
        und Konkretes, einer Gesellschaft und Abstraktes, einer Tätigkeiten und Eigenschaften. Nach
        drei Zügen wisst ihr zu dritt mehr über das Zielwort, als einer allein in zehn Zügen
        herausbekäme.
      </p>
      <p className="mt-3 max-w-prose">
        Lest außerdem die geteilte Liste, statt nur zu tippen. Sie ist nach Rang sortiert und damit
        die beste Karte, die ihr habt. Besonders aufschlussreich sind die Ausreißer: Wenn ein Wort
        deutlich besser abschneidet, als jemand erwartet hat, steckt darin die eigentliche
        Information, oft eine Nebenbedeutung, an die niemand gedacht hat. Ausführlich steht das in{" "}
        <Link
          href="/blog/duell-und-koop-taktik/"
          className="font-medium text-primary underline underline-offset-2 hover:no-underline"
        >
          Duell und Koop: die Mehrspielermodi
        </Link>
        .
      </p>

      <SeoHeading>Lieber gegeneinander?</SeoHeading>
      <p className="max-w-prose">
        Dann ist das{" "}
        <Link
          href="/duel/create/"
          className="font-medium text-primary underline underline-offset-2 hover:no-underline"
        >
          Duell
        </Link>{" "}
        die passende Variante: gleiches Wort, getrennte Listen, und vom Gegenüber siehst du nur
        Rang, Versuchszahl und Tipp-Zahl. Aus dem Denkspiel wird ein Rennen, und Information wird
        zur Ressource, die du hütest statt teilst. Wer erst einmal allein üben will, findet das
        tägliche Rätsel beim{" "}
        <Link href="/" className="font-medium text-primary underline underline-offset-2 hover:no-underline">
          Kontexto
        </Link>
        .
      </p>

      <SeoHeading>Häufige Fragen zum Koop-Modus</SeoHeading>
      <SeoFaq items={koopFaqs} />

      <RelatedLinks
        heading="Weiterspielen"
        label="Weitere Spiele und Hintergründe"
        links={[
          { href: "/koop/create/", label: "Neuen Koop erstellen" },
          { href: "/duel/create/", label: "Duell gegen Freunde" },
          { href: "/", label: "Tägliches Kontexto spielen" },
          { href: "/strategie/", label: "Strategie und Tipps" },
        ]}
      />
    </SeoSection>
  );
}
