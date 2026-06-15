import Link from "next/link";
import { Brain, Infinity as InfinityIcon, CalendarDays, Gift } from "lucide-react";
import {
  SeoSection,
  SeoHeading,
  FeatureGrid,
  FeatureCard,
  StepList,
  Step,
  ColorLegend,
  RelatedLinks,
} from "@/components/seo/SeoPrimitives";
import SeoFaq from "@/components/seo/SeoFaq";
import ComparisonTable from "@/components/content/ComparisonTable";

export default function HomeContent() {
  return (
    <SeoSection>
      {/*
        The page's single <h1> and intro lead live above the game board (see
        app/page.tsx) so the homepage reads content-first. This section opens at
        <h2> on purpose — do not reintroduce an <h1> here (seo:check enforces
        exactly one <h1> per page).
      */}
      <h2 className="mb-3 text-2xl font-bold text-foreground">
        Kontexto – die deutsche Version von Contexto
      </h2>
      <p className="max-w-prose">
        Kontexto ist ein kostenloses, tägliches Wort-Ratespiel ohne Anmeldung.
        Errate das geheime Wort des Tages – nach jedem Tipp zeigt dir Kontexto, wie
        nah du an der Bedeutung des Zielworts bist. Je kleiner die Zahl, desto näher
        bist du dran.
      </p>

      <SeoHeading>Warum Kontexto spielen?</SeoHeading>
      <FeatureGrid>
        <FeatureCard icon={Brain} title="Trainiert dein Sprachgefühl">
          Es zählt die Bedeutung im Kontext, nicht die Buchstaben – ein Workout für
          deinen deutschen Wortschatz.
        </FeatureCard>
        <FeatureCard icon={InfinityIcon} title="Unbegrenzt viele Versuche">
          Kein Druck: Du darfst so oft raten, wie du willst, bis du das Zielwort findest.
        </FeatureCard>
        <FeatureCard icon={CalendarDays} title="Jeden Tag ein neues Wort">
          Um Mitternacht startet ein neues Rätsel – alle raten dasselbe Wort des Tages.
        </FeatureCard>
        <FeatureCard icon={Gift} title="Kostenlos & ohne Konto">
          Komplett kostenlos und ohne Anmeldung – einfach die Seite öffnen und losraten.
        </FeatureCard>
      </FeatureGrid>

      <SeoHeading>So funktioniert&apos;s</SeoHeading>
      <StepList>
        <Step index={1} title="Wort eingeben">
          Tippe ein beliebiges deutsches Wort ein und bestätige.
        </Step>
        <Step index={2} title="Rang ablesen">
          Jedes Wort bekommt einen Rang. Rang&nbsp;1 ist das gesuchte Wort. Die
          Reihenfolge entsteht aus KI-Worteinbettungen (fastText), trainiert auf großen
          deutschen Textkorpora.
        </Step>
        <Step index={3} title="Der Bedeutung folgen">
          Es zählt die Bedeutung, nicht die Buchstaben: „Hund“ liegt nah bei „Katze“,
          aber weit weg von „Hundert“. Folge der Bedeutung Richtung Rang&nbsp;1.
        </Step>
      </StepList>

      <SeoHeading>Was bedeuten die Farben?</SeoHeading>
      <ColorLegend />

      <SeoHeading>Ein Beispiel</SeoHeading>
      <p className="mb-2 max-w-prose">
        Gesucht ist das Wort <strong className="font-medium text-foreground">Strand</strong>.
        So könnte sich eine Partie Schritt für Schritt entwickeln – jeder Tipp rückt
        näher an die Bedeutung:
      </p>
      <ComparisonTable
        columns={["Dein Tipp", "Rang", "Bedeutung"]}
        rows={[
          ["Computer", "8420", <span key="c" className="text-red-600 dark:text-red-400">weit entfernt</span>],
          ["Meer", "312", <span key="m" className="text-yellow-600 dark:text-yellow-500">auf dem Weg</span>],
          ["Küste", "47", <span key="k" className="text-green-600 dark:text-green-400">sehr nah</span>],
          ["Strand", "1", <span key="s" className="font-semibold text-green-600 dark:text-green-400">Treffer!</span>],
        ]}
        caption="Beispielhafte Tipps für das Zielwort Strand"
      />
      <p className="max-w-prose">
        Auf der{" "}
        <Link href="/anleitung/" className="font-medium text-primary underline underline-offset-2 hover:no-underline">
          Spielanleitung
        </Link>{" "}
        siehst du diesen Ablauf als Animation Schritt für Schritt.
      </p>

      <SeoHeading>Kontexto vs. Wördle</SeoHeading>
      <p className="max-w-prose">
        Bei{" "}
        <Link
          href="/wordle/"
          className="font-medium text-primary underline underline-offset-2 hover:no-underline"
        >
          Wördle
        </Link>{" "}
        errätst du ein Wort Buchstabe für Buchstabe. Bei Kontexto geht es um Bedeutung:
        Es gibt unbegrenzt viele Versuche, und jeder Tipp bringt dich der Lösung
        semantisch näher. Beide Spiele gibt es hier täglich neu – auf Deutsch.
      </p>

      <SeoHeading>Häufige Fragen</SeoHeading>
      <SeoFaq />

      <div className="mt-10">
        <RelatedLinks
          heading="Mehr entdecken"
          label="Mehr über Kontexto"
          links={[
            { href: "/anleitung/", label: "Spielanleitung" },
            { href: "/strategie/", label: "Strategie & Tipps" },
            { href: "/vergleich/", label: "Kontexto, Wordle, Contexto & Semantle im Vergleich" },
            { href: "/glossar/", label: "Glossar der Begriffe" },
            { href: "/faq/", label: "Häufige Fragen (FAQ)" },
            { href: "/ueber/", label: "Über Kontexto" },
            { href: "/blog/", label: "Blog" },
          ]}
        />
      </div>
    </SeoSection>
  );
}
