import Link from "next/link";
import { Swords, EyeOff, Link2, RefreshCw } from "lucide-react";
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
import { wordleDuelFaqs } from "@/lib/faqs";

export default function WordleDuelSeo() {
  return (
    <SeoSection>
      <h1 className="mb-3 text-2xl font-bold text-foreground">
        Wördle-Duell: Wordle gegen Freunde
      </h1>
      <p className="max-w-prose">
        Gleiches Wort, dieselben sechs Versuche, Live-Fortschritt. Im Wördle-Duell seht ihr beide,
        wie weit der andere ist, ohne die Lösung zu verraten.{" "}
        <Link
          href="/wordle/duel/create/"
          className="font-medium text-primary underline underline-offset-2 hover:no-underline"
        >
          Duell erstellen
        </Link>{" "}
        dauert zehn Sekunden, ohne Konto und ohne Installation.
      </p>

      <SeoHeading>Was das Wördle-Duell ausmacht</SeoHeading>
      <FeatureGrid>
        <FeatureCard icon={Swords} title="Gleiche Ausgangslage">
          Beide raten dasselbe Wort mit fünf Buchstaben und haben je sechs Versuche. Kein Vorteil
          für den, der zuerst da war.
        </FeatureCard>
        <FeatureCard icon={EyeOff} title="Farben ja, Buchstaben nein">
          Von den Versuchen des Gegenübers siehst du nur das Farbmuster aus grünen, gelben und
          grauen Feldern. Die Buchstaben bleiben verborgen.
        </FeatureCard>
        <FeatureCard icon={Link2} title="Einladung per Link">
          Ein Link mit sechsstelliger Kennung genügt. Verschicken, öffnen, Namen eingeben.
        </FeatureCard>
        <FeatureCard icon={RefreshCw} title="Direkt weiterspielen">
          Nach der Partie startet ihr mit einem Klick eine neue Runde, ohne den Link neu zu teilen.
        </FeatureCard>
      </FeatureGrid>

      <SeoHeading>In drei Schritten starten</SeoHeading>
      <StepList>
        <Step index={1} title="Duell erstellen">
          Wähle das heutige Wördle oder ein zufälliges Wort aus dem Pool. Beide spielen dasselbe.
        </Step>
        <Step index={2} title="Link teilen">
          Kopiere den Einladungslink und schick ihn deinem Gegenüber.
        </Step>
        <Step index={3} title="Losraten">
          Sobald beide drin sind, läuft die Partie. Der Fortschritt wird laufend übertragen.
        </Step>
      </StepList>

      <SeoHeading>Die Farbmuster des Gegners lesen</SeoHeading>
      <p className="max-w-prose">
        Der eigentliche taktische Unterschied zum Einzelspiel liegt darin, dass du eine zweite
        Informationsquelle hast: die Farbreihen des Gegenübers. Sie verraten dir nicht das Wort,
        aber sie verraten dir, wie viel Zeit du noch hast.
      </p>
      <ul className="mt-3 max-w-prose list-disc space-y-2 pl-5">
        <li>
          <strong className="text-foreground">Viele graue Felder auf beiden Seiten.</strong> Ihr
          steht beide am Anfang. Jetzt lohnt sich ein sauberer Ausschlusszug, der möglichst viele
          neue Buchstaben abfragt, statt eines frühen Rateversuchs.
        </li>
        <li>
          <strong className="text-foreground">Das Gegenüber hat drei oder vier grüne Felder.</strong>{" "}
          Die Zeit wird knapp. Ein weiterer Absicherungszug kostet dich womöglich die Partie, also
          rate auf den wahrscheinlichsten Kandidaten, auch wenn du ihn nicht abgesichert hast.
        </li>
        <li>
          <strong className="text-foreground">Das Gegenüber hat viele gelbe Felder.</strong> Es
          kennt die Buchstaben, aber nicht die Reihenfolge. Das kostet meist noch ein bis zwei
          Züge, du hast also Luft.
        </li>
      </ul>
      <p className="mt-3 max-w-prose">
        Umgekehrt gilt: Auch dein Muster ist sichtbar. Wer sehr früh viele grüne Felder zeigt,
        setzt das Gegenüber unter Druck und provoziert dessen riskanten Zug.
      </p>

      <SeoHeading>Was hier anders ist als beim Kontexto-Duell</SeoHeading>
      <p className="max-w-prose">
        Beide Duell-Modi laufen über denselben Mechanismus aus geteiltem Link und
        Live-Übertragung, das Spielgefühl ist aber gegensätzlich. Beim{" "}
        <Link
          href="/duel/"
          className="font-medium text-primary underline underline-offset-2 hover:no-underline"
        >
          Kontexto-Duell
        </Link>{" "}
        gibt es kein Versuchslimit, das Rennen kann sich über dreißig Züge ziehen, und vom
        Gegenüber siehst du eine einzelne Zahl.
      </p>
      <p className="mt-3 max-w-prose">
        Im Wördle-Duell sind sechs Versuche das harte Ende. Dadurch ist die Runde nach wenigen
        Minuten entschieden, und der Druck entsteht nicht aus der Distanz zum Ziel, sondern aus
        den verbleibenden Zeilen. Wie sich die beiden Grundprinzipien unterscheiden, steht in{" "}
        <Link
          href="/blog/kontexto-vs-wordle/"
          className="font-medium text-primary underline underline-offset-2 hover:no-underline"
        >
          Kontexto vs. Wordle
        </Link>
        , die Taktik für beide Mehrspielermodi in{" "}
        <Link
          href="/blog/duell-und-koop-taktik/"
          className="font-medium text-primary underline underline-offset-2 hover:no-underline"
        >
          Duell und Koop
        </Link>
        .
      </p>

      <SeoHeading>Häufige Fragen zum Wördle-Duell</SeoHeading>
      <SeoFaq items={wordleDuelFaqs} />

      <RelatedLinks
        heading="Weiterspielen"
        label="Weitere Spiele und Hintergründe"
        links={[
          { href: "/wordle/duel/create/", label: "Wördle-Duell erstellen" },
          { href: "/wordle/", label: "Zum täglichen Wördle" },
          { href: "/duel/", label: "Kontexto-Duell gegen Freunde" },
          { href: "/blog/woerdle-wortliste-deutsch/", label: "Wie die Wortlisten gebaut wurden" },
        ]}
      />
    </SeoSection>
  );
}
