import Link from "next/link";
import {
  Brain,
  Infinity as InfinityIcon,
  CalendarDays,
  Gift,
  Cpu,
  SlidersHorizontal,
  ListFilter,
  BarChart3,
} from "lucide-react";
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
import { homeFaqs } from "@/lib/faqs";
import { posts } from "@/lib/blog";
import ComparisonTable from "@/components/content/ComparisonTable";

export default function HomeContent() {
  return (
    <SeoSection>
      {/*
        This heading is the homepage's single <h1> (seo:check enforces exactly
        one <h1> per page). The game board above stays widget-only; the
        crawlable, content-first copy lives here below it.
      */}
      <h1 className="mb-3 text-2xl font-bold text-foreground">
        Kontexto: das tägliche deutsche Wort-Ratespiel
      </h1>
      <p className="max-w-prose">
        Kontexto ist ein kostenloses, tägliches Wort-Ratespiel ohne Anmeldung.
        Errate das geheime Wort des Tages. Nach jedem Tipp zeigt dir Kontexto, wie
        nah du an der Bedeutung des Zielworts bist. Je kleiner die Zahl, desto näher
        bist du dran.
      </p>

      <SeoHeading>Warum Kontexto spielen?</SeoHeading>
      <FeatureGrid>
        <FeatureCard icon={Brain} title="Trainiert dein Sprachgefühl">
          Es zählt die Bedeutung im Kontext, nicht die Buchstaben, ein Workout für
          deinen deutschen Wortschatz.
        </FeatureCard>
        <FeatureCard icon={InfinityIcon} title="Unbegrenzt viele Versuche">
          Kein Druck: Du darfst so oft raten, wie du willst, bis du das Zielwort findest.
        </FeatureCard>
        <FeatureCard icon={CalendarDays} title="Jeden Tag ein neues Wort">
          Um Mitternacht startet ein neues Rätsel, alle raten dasselbe Wort des Tages.
        </FeatureCard>
        <FeatureCard icon={Gift} title="Kostenlos & ohne Konto">
          Komplett kostenlos und ohne Anmeldung, einfach die Seite öffnen und losraten.
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
        So könnte sich eine Partie Schritt für Schritt entwickeln, jeder Tipp rückt
        näher an die Bedeutung:
      </p>
      <ComparisonTable
        columns={["Dein Tipp", "Rang", "Bedeutung"]}
        rows={[
          ["Computer", "8420", <span key="c" className="text-red-600 dark:text-red-400">weit entfernt</span>],
          ["Meer", "312", <span key="m" className="text-yellow-700 dark:text-yellow-500">auf dem Weg</span>],
          ["Küste", "47", <span key="k" className="text-green-700 dark:text-green-400">sehr nah</span>],
          ["Strand", "1", <span key="s" className="font-semibold text-green-700 dark:text-green-400">Treffer!</span>],
        ]}
        caption="Beispielhafte Tipps für das Zielwort Strand"
      />
      <p className="max-w-prose">
        In der{" "}
        <Link href="/anleitung/" className="font-medium text-primary underline underline-offset-2 hover:no-underline">
          Spielanleitung
        </Link>{" "}
        siehst du diesen Ablauf als Animation Schritt für Schritt.
      </p>

      <SeoHeading>Wie lange dauert eine Partie?</SeoHeading>
      <p className="max-w-prose">
        Vier Züge wie im Beispiel oben sind der Idealfall, der Normalfall sieht anders
        aus. Über alle bisher gespielten Partien liegt der Schnitt bei rund 85
        Rateversuchen je Lösung, und 71 von 100 begonnenen Rätseln werden am Ende
        gelöst. Zeitlich sind das meist fünf bis dreißig Minuten, verteilt über den
        Tag, denn ein Rätsel bleibt bis Mitternacht offen.
      </p>
      <p className="mt-3 max-w-prose">
        Der größte Unterschied zwischen einer kurzen und einer langen Partie liegt
        nicht im Wortschatz, sondern im Umgang mit schlechten Rängen. Wer ein Feld
        nach drei erfolglosen Zügen verlässt, ist schneller fertig als jemand, der im
        selben Feld nach immer feineren Synonymen sucht. Ein Wort auf Rang 8.000 ist
        deshalb kein verlorener Zug: Es schließt eine ganze Richtung sicher aus.
        Bleibst du trotzdem stecken, hilft die Tipp-Funktion in drei Stufen weiter,
        und wer die Lösung sehen will, kann jederzeit auflösen.
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
        semantisch näher. Beide Spiele gibt es hier täglich neu, auf Deutsch.
      </p>

      {/*
        Belegt die eigene Arbeit an der Stelle, an der sie gelesen wird. Vorher
        stand all das nur im Blog, wo es weder ein Erstbesucher noch ein Pruefer
        findet. Jede Aussage hier ist auf einer eigenen Seite ausgefuehrt und
        dorthin verlinkt.
      */}
      <SeoHeading>Was an Kontexto selbst gebaut ist</SeoHeading>
      <p className="mb-4 max-w-prose">
        Kontexto ist kein Baukasten und kein übersetztes Fremdprodukt. Modell,
        Vokabular, Lösungsauswahl und alle Spielmodi sind für dieses Spiel entstanden
        und werden hier gepflegt. Jeder der folgenden Punkte ist an anderer Stelle
        ausführlich belegt.
      </p>
      <FeatureGrid>
        <FeatureCard icon={Cpu} title="Eigenes deutsches Sprachmodell">
          Ein deutsches fastText-Modell mit 300 Zahlen je Wort, trainiert auf Common
          Crawl und der deutschen Wikipedia. Kein übersetztes englisches Modell und
          keine fremde Schnittstelle.
        </FeatureCard>
        <FeatureCard icon={SlidersHorizontal} title="Entzerrte Vektoren">
          Vor der Berechnung werden der Mittelwert und die drei stärksten
          Hauptkomponenten entfernt. Ohne diesen Schritt wären häufige Wörter zu
          allem ähnlich und jeder Rang wertlos.
        </FeatureCard>
        <FeatureCard icon={ListFilter} title="Geprüfte Lösungswörter">
          Jede Tageslösung durchläuft automatische Filter und Sperrlisten, die von
          Hand gepflegt werden: kein Eigenname, kein anstößiger Ausdruck, keine
          ß/ss-Doppelform.
        </FeatureCard>
        <FeatureCard icon={BarChart3} title="Offengelegte Zahlen">
          868.000 Rateversuche, 10.200 gelöste Rätsel, im Schnitt 85 Versuche je
          Lösung. Die Auswertung liegt offen, samt Skript und Methodik.
        </FeatureCard>
      </FeatureGrid>
      <p className="mt-4 max-w-prose">
        Beim Raten wird nichts live berechnet. Für jedes der 2.400 vorbereiteten
        Rätsel liegt die vollständige Rangliste über rund 80.000 Wörter fertig vor,
        eine Eingabe ist deshalb ein Nachschlagen und keine Modellabfrage. Das hält
        die Antwort schnell und macht die Ränge über den ganzen Tag stabil: Zwei
        Personen, die dasselbe Wort eingeben, sehen garantiert denselben Rang. Wie
        diese Ranglisten entstehen, steht ausführlich in{" "}
        <Link href="/blog/wie-das-loesungswort-entsteht/" className="font-medium text-primary underline underline-offset-2 hover:no-underline">
          Wie das Lösungswort entsteht
        </Link>{" "}
        und in{" "}
        <Link href="/blog/all-but-the-top-vektoren-entzerren/" className="font-medium text-primary underline underline-offset-2 hover:no-underline">
          All-but-the-Top
        </Link>.
      </p>
      <p className="mt-4 max-w-prose">
        Neben dem Tagesrätsel gibt es vier weitere Arten zu spielen, alle hier
        entstanden: den{" "}
        <Link href="/koop/" className="font-medium text-primary underline underline-offset-2 hover:no-underline">
          Koop-Modus
        </Link>{" "}
        mit geteilter Rateliste, das{" "}
        <Link href="/duel/" className="font-medium text-primary underline underline-offset-2 hover:no-underline">
          Duell
        </Link>{" "}
        gegen Freunde, einen Unendlich-Modus für beliebig viele Partien am Stück und{" "}
        <Link href="/wordle/" className="font-medium text-primary underline underline-offset-2 hover:no-underline">
          Wördle
        </Link>{" "}
        samt eigenem Duell. Mehrspieler läuft über einen geteilten Link, ohne Konto
        und ohne Installation, die Stände werden live übertragen.
      </p>
      <p className="mt-4 max-w-prose">
        Aus den gespielten Partien entsteht Auswertung, die es sonst nirgends gibt.
        Für 46 Startwörter wurde über alle 2.400 Rätsel gemessen, wie oft sie
        überhaupt ein verwertbares Signal liefern. „gehen“ führt das Feld mit
        13,2&nbsp;Prozent an, „wasser“ landet entgegen der Erwartung auf Platz 39 von
        45. Die vollständige Tabelle steht im{" "}
        <Link href="/blog/startwort-benchmark/" className="font-medium text-primary underline underline-offset-2 hover:no-underline">
          Startwort-Benchmark
        </Link>, alle veröffentlichten Kennzahlen samt Methodik unter{" "}
        <Link href="/zahlen/" className="font-medium text-primary underline underline-offset-2 hover:no-underline">
          Kontexto in Zahlen
        </Link>.
      </p>

      {/*
        Die Startseite verlinkte bisher nur Rubriken, keinen einzigen Beitrag.
        Damit lag der gesamte Bestand von 22 Artikeln zwei Klicks tief, und ein
        Erstbesucher wie ein Crawler sah von der eigentlichen Substanz nichts.
        Die sechs juengsten Beitraege stehen jetzt mit ihrer eigenen
        Beschreibung direkt hier.
      */}
      <SeoHeading>Aus dem Blog</SeoHeading>
      <p className="mb-4 max-w-prose">
        Wie das Spiel rechnet, was die Auswertung von 868.000 Rateversuchen ergeben hat und
        welche Strategie messbar funktioniert, steht ausführlich im Blog. Die sechs jüngsten
        Beiträge:
      </p>
      <ul className="mb-4 space-y-3">
        {posts.slice(0, 6).map((post) => (
          <li key={post.slug} className="border-l-2 border-border pl-4">
            <Link
              href={`/blog/${post.slug}/`}
              className="font-medium text-primary underline underline-offset-2 hover:no-underline"
            >
              {post.title}
            </Link>
            <p className="mt-1 text-sm">{post.description}</p>
          </li>
        ))}
      </ul>
      <p className="max-w-prose">
        Alle {posts.length} Beiträge nach Grundlagen, Strategie und Technik sortiert:{" "}
        <Link href="/blog/" className="font-medium text-primary underline underline-offset-2 hover:no-underline">
          zur Blogübersicht
        </Link>.
      </p>

      <SeoHeading>Kurz gefragt</SeoHeading>
      <SeoFaq items={homeFaqs} />
      <p className="mt-4 max-w-prose">
        Ausführliche Antworten auf alle 23 Fragen, von der Wortauswahl über die
        Technik bis zu Datenschutz und Werbung, stehen auf der Seite{" "}
        <Link href="/faq/" className="font-medium text-primary underline underline-offset-2 hover:no-underline">
          Häufige Fragen
        </Link>.
      </p>

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
