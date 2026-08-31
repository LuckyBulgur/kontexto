import Link from "next/link";
import { Keyboard, CalendarDays, Users, Gift } from "lucide-react";
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
import ComparisonTable from "@/components/content/ComparisonTable";
import { wordleFaqs } from "@/lib/faqs";

export default function WordleSeo() {
  return (
    <SeoSection>
      {/*
        Einzige <h1> dieser Seite (seo:check erzwingt genau eine). Das Spielbrett
        oben bleibt reines Widget, der crawlbare Text steht hier darunter.
      */}
      <h1 className="mb-3 text-2xl font-bold text-foreground">Wördle: Wordle auf Deutsch</h1>
      <p className="max-w-prose">
        Wördle ist die deutsche Wordle-Variante von Kontexto: Errate jeden Tag ein Wort mit fünf
        Buchstaben in höchstens sechs Versuchen. Kostenlos, ohne Anmeldung, direkt im Browser. Alle
        Spielenden raten am selben Tag dasselbe Wort.
      </p>

      <SeoHeading>Warum Wördle spielen?</SeoHeading>
      <FeatureGrid>
        <FeatureCard icon={Keyboard} title="Klare Regeln, kurze Runde">
          Sechs Versuche, drei Farben, kein Zufall. Eine Partie dauert selten länger als fünf
          Minuten und endet mit einem eindeutigen Ergebnis.
        </FeatureCard>
        <FeatureCard icon={CalendarDays} title="Jeden Tag ein neues Wort">
          Um Mitternacht startet das nächste Rätsel. Welches Wort wann an der Reihe ist, steht seit
          dem Aufbau der Spieldaten fest und ist reine Rechnung, kein Zufall zur Laufzeit.
        </FeatureCard>
        <FeatureCard icon={Users} title="Auch gegen Freunde">
          Im Wördle-Duell raten beide dasselbe Wort mit denselben sechs Versuchen, mit
          Live-Fortschritt über einen geteilten Link.
        </FeatureCard>
        <FeatureCard icon={Gift} title="Kostenlos und ohne Konto">
          Keine Registrierung, keine Bezahlschranke. Der Spielstand liegt lokal in deinem Browser.
        </FeatureCard>
      </FeatureGrid>

      <SeoHeading>So funktioniert&apos;s</SeoHeading>
      <StepList>
        <Step index={1} title="Wort eingeben">
          Tippe ein deutsches Wort mit fünf Buchstaben und bestätige mit Enter.
        </Step>
        <Step index={2} title="Farben lesen">
          Grün heißt richtiger Buchstabe an richtiger Stelle, Gelb richtiger Buchstabe an falscher
          Stelle, Grau kommt nicht vor.
        </Step>
        <Step index={3} title="Ausschließen">
          Jeder Zug verkleinert die Menge der möglichen Wörter. Nutze die grauen Buchstaben genauso
          wie die grünen.
        </Step>
      </StepList>

      <SeoHeading>Warum es keine Umlaute gibt</SeoHeading>
      <p className="max-w-prose">
        Wördle nutzt das Alphabet von a bis z, also genau 26 Buchstaben. Wörter mit ä, ö, ü oder ß
        kommen deshalb weder als Lösung noch als Tipp vor. Das kostet schöne Wörter wie „Käse“ oder
        „Möbel“, und es ist trotzdem die beste der drei möglichen Entscheidungen.
      </p>
      <p className="mt-3 max-w-prose">
        Umlaute auf die Tastatur zu nehmen macht das Layout auf dem Smartphone unhandlich und
        verlangt eine Sonderregel: Zählt ein eingegebenes „a“ als Teiltreffer für ein „ä“ in der
        Lösung? Sagt man ja, verrät man zu viel. Sagt man nein, fühlt es sich unfair an. Umlaute
        aufzulösen wäre noch schlechter, denn aus dem vierbuchstabigen „Käse“ würde ein
        fünfbuchstabiges „kaese“, und die Wortlängen im Spiel hätten nichts mehr mit den
        Wortlängen zu tun, die man kennt. Der Verzicht ist die einzige Variante ohne Sonderregel:
        Was auf der Tastatur steht, gilt.
      </p>

      <SeoHeading>Zwei Wortlisten mit gegensätzlichen Zielen</SeoHeading>
      <p className="max-w-prose">
        Wördle führt getrennte Listen für erlaubte Tipps und mögliche Lösungen, weil die
        Anforderungen an beide sich widersprechen.
      </p>
      <ComparisonTable
        columns={["Merkmal", "Ratewörter", "Lösungswörter"]}
        rows={[
          ["Ziel", "möglichst großzügig", "möglichst streng"],
          ["Gebeugte Formen", "erlaubt", "nie"],
          ["Seltene Wörter", "erlaubt", "nein"],
          ["Eigennamen und Marken", "wenn im Wortschatz", "nie"],
          ["Fremdwörter", "wenn eingedeutscht", "nein"],
        ]}
        caption="Ratewörter und Lösungswörter bei Wördle im Vergleich"
      />
      <p className="mt-4 max-w-prose">
        Nichts ist ärgerlicher, als ein völlig normales deutsches Wort einzutippen und „ungültig“ zu
        lesen. Deshalb enthält die Rateliste jedes Fünfbuchstabenwort aus dem Wortschatz, inklusive
        Plural und konjugierter Verben. Eine Lösung, die niemand kennt, ist dagegen kein Rätsel,
        sondern Pech. Lösungswörter laufen deshalb durch dieselbe Prüfung wie bei{" "}
        <Link href="/" className="font-medium text-primary underline underline-offset-2 hover:no-underline">
          Kontexto
        </Link>
        : keine Eigennamen, keine Fremdwörter, keine gebeugten Formen, keine Fragmente.
      </p>
      <p className="mt-3 max-w-prose">
        Für dich folgt daraus eine verwertbare Information: Weil Lösungen immer Grundformen sind,
        kannst du Pluralformen und konjugierte Verben aus deiner Kandidatenliste streichen, sobald
        es eng wird. Wie die Listen im Einzelnen gebaut werden, steht in{" "}
        <Link
          href="/blog/woerdle-wortliste-deutsch/"
          className="font-medium text-primary underline underline-offset-2 hover:no-underline"
        >
          Wie die deutsche Wördle-Wortliste gebaut wurde
        </Link>
        .
      </p>

      <SeoHeading>Startwörter, die etwas bringen</SeoHeading>
      <p className="max-w-prose">
        Ein gutes Startwort fragt möglichst viele häufige Buchstaben gleichzeitig ab und wiederholt
        keinen davon. Ein doppelter Buchstabe verschenkt eine Position, die du zum Ausschließen
        gebraucht hättest.
      </p>
      <ul className="mt-3 max-w-prose list-disc space-y-1 pl-5">
        <li>
          <strong className="text-foreground">reise</strong>, deckt drei Vokale und zwei sehr
          häufige Konsonanten ab.
        </li>
        <li>
          <strong className="text-foreground">laden</strong>, kombiniert die häufigsten Konsonanten
          des Deutschen mit zwei Vokalen.
        </li>
        <li>
          <strong className="text-foreground">staub</strong>, prüft den seltener getesteten Vokal u
          mit.
        </li>
        <li>
          <strong className="text-foreground">monat</strong>, gute Mischung aus o, a und drei
          häufigen Konsonanten.
        </li>
      </ul>
      <p className="mt-3 max-w-prose">
        Denk beim Kandidatensuchen nie in Umlauten. Fällt dir „Bäume“ ein, ist es kein möglicher
        Zug, weder als Tipp noch als Lösung. Das schließt eine ganze Klasse von Wörtern aus und
        verkleinert deinen Suchraum spürbar.
      </p>

      <SeoHeading>Wördle und Kontexto: zwei verschiedene Denkarten</SeoHeading>
      <p className="max-w-prose">
        Beide Spiele stehen auf derselben Seite und funktionieren gegensätzlich. Bei Wördle
        schneidet jeder Zug Möglichkeiten weg, der Suchraum ist von Anfang an bekannt und
        verkleinert sich berechenbar. Deshalb funktioniert dort Ausschlusslogik.
      </p>
      <p className="mt-3 max-w-prose">
        Bei{" "}
        <Link href="/" className="font-medium text-primary underline underline-offset-2 hover:no-underline">
          Kontexto
        </Link>{" "}
        bekommst du stattdessen eine Rangzahl, die dir sagt, wie weit du von der Bedeutung des
        Zielworts entfernt bist, aber nicht, in welche Richtung du gehen musst. Dort zählt
        assoziatives Denken, und es gibt kein Versuchslimit. Wer von einem Spiel ins andere
        wechselt, muss die jeweils andere Gewohnheit bewusst ablegen. Der ausführliche Vergleich
        steht in{" "}
        <Link
          href="/blog/kontexto-vs-wordle/"
          className="font-medium text-primary underline underline-offset-2 hover:no-underline"
        >
          Kontexto vs. Wordle
        </Link>
        .
      </p>

      <SeoHeading>Häufige Fragen zu Wördle</SeoHeading>
      <SeoFaq items={wordleFaqs} />

      <RelatedLinks
        heading="Weiterspielen"
        label="Weitere Spiele und Hintergründe"
        links={[
          { href: "/", label: "Kontexto: das semantische Wortspiel" },
          { href: "/wordle/duel/create/", label: "Wördle-Duell gegen Freunde" },
          { href: "/blog/woerdle-wortliste-deutsch/", label: "Wie die Wortlisten gebaut wurden" },
          { href: "/vergleich/", label: "Alle Wortspiele im Vergleich" },
        ]}
      />
    </SeoSection>
  );
}
