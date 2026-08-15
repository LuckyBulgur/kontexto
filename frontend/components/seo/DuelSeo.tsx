import Link from "next/link";
import { Swords, Link2, Timer, ShieldOff } from "lucide-react";
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
import { duelFaqs } from "@/lib/faqs";

export default function DuelSeo() {
  return (
    <SeoSection>
      <h1 className="mb-3 text-2xl font-bold text-foreground">
        Kontexto-Duell: gegen Freunde spielen
      </h1>
      <p className="max-w-prose">
        Im Duell tretet ihr beim selben geheimen Wort gegeneinander an. Jeder rät für sich, aber
        ihr seht den Fortschritt des anderen live. Wer zuerst auf Rang 1 landet, gewinnt.{" "}
        <Link
          href="/duel/create/"
          className="font-medium text-primary underline underline-offset-2 hover:no-underline"
        >
          Duell erstellen
        </Link>{" "}
        dauert zehn Sekunden, ohne Konto und ohne Installation.
      </p>

      <SeoHeading>Was das Duell ausmacht</SeoHeading>
      <FeatureGrid>
        <FeatureCard icon={Swords} title="Gleiches Wort, getrennte Listen">
          Ihr sucht dasselbe Zielwort, aber jeder mit eigener Rateliste. Vom Gegenüber siehst du
          den besten Rang, die Versuchszahl und die Zahl der benutzten Tipps, nicht die Wörter
          selbst.
        </FeatureCard>
        <FeatureCard icon={Link2} title="Einladung per Link">
          Beim Erstellen bekommst du einen Link mit sechsstelliger Kennung. Verschicken, öffnen,
          Namen eingeben, fertig.
        </FeatureCard>
        <FeatureCard icon={Timer} title="Live im Sekundentakt">
          Der Fortschritt wird jede Sekunde übertragen. Fällt die Verbindung aus, siehst du das am
          Verbindungszustand des anderen Spielers.
        </FeatureCard>
        <FeatureCard icon={ShieldOff} title="Tipps abschaltbar">
          Für ein sportliches Duell lohnt es sich, Tipps zu deaktivieren. Ein Tipp auf „leicht“
          halbiert den besten Rang und entscheidet knappe Rennen.
        </FeatureCard>
      </FeatureGrid>

      <SeoHeading>In drei Schritten starten</SeoHeading>
      <StepList>
        <Step index={1} title="Duell erstellen">
          Wähle das heutige Rätsel oder ein zufälliges aus dem Pool und entscheide, ob Tipps
          erlaubt sind.
        </Step>
        <Step index={2} title="Link teilen">
          Kopiere den Einladungslink und schick ihn deinem Gegenüber.
        </Step>
        <Step index={3} title="Losraten">
          Sobald beide drin sind, läuft die Partie. Nach dem Ende könnt ihr direkt ein neues Rätsel
          starten.
        </Step>
      </StepList>

      <SeoHeading>Taktik: es zählt die Rangdifferenz</SeoHeading>
      <p className="max-w-prose">
        Die entscheidende Größe im Duell ist nicht dein eigener Rang, sondern der Abstand zum
        Gegenüber. Danach richtet sich, ob du feiner suchen oder alles auf eine Karte setzen
        solltest.
      </p>
      <ul className="mt-3 max-w-prose list-disc space-y-2 pl-5">
        <li>
          <strong className="text-foreground">Du führst deutlich.</strong> Bleib bei dem, was
          funktioniert, und arbeite dein Bedeutungsfeld feiner ab. Ein Feldwechsel kostet mehrere
          Züge und verschenkt genau den Vorsprung, den du hast.
        </li>
        <li>
          <strong className="text-foreground">Du liegst deutlich zurück.</strong> Schrittweises
          Herantasten reicht nicht mehr. Wechsle in ein völlig anderes Feld oder in eine andere
          Wortart. Deine Chance ist ein Treffer, der dich in einem Zug nach vorn wirft.
        </li>
        <li>
          <strong className="text-foreground">Ihr liegt gleichauf.</strong> Jetzt schlägt
          Systematik die Eingebung. Variiere die Wortart, statt weitere Synonyme aus demselben Feld
          zu probieren.
        </li>
      </ul>
      <p className="mt-3 max-w-prose">
        Eine Beobachtung, die viele überrascht: Die Versuchszahl des Gegenübers ist informativer
        als dessen Rang. Wer nach 6 Versuchen auf Rang 300 steht, hat wahrscheinlich zufällig ein
        passables Feld getroffen. Wer nach 30 Versuchen dort steht, hat systematisch gesucht und
        sitzt fest. Mehr dazu in{" "}
        <Link
          href="/blog/duell-und-koop-taktik/"
          className="font-medium text-primary underline underline-offset-2 hover:no-underline"
        >
          Duell und Koop: die Mehrspielermodi
        </Link>
        .
      </p>

      <SeoHeading>Lieber miteinander als gegeneinander?</SeoHeading>
      <p className="max-w-prose">
        Dann ist der{" "}
        <Link
          href="/koop/create/"
          className="font-medium text-primary underline underline-offset-2 hover:no-underline"
        >
          Koop-Modus
        </Link>{" "}
        die passende Variante. Dort teilen sich alle eine einzige Rateliste, jeder Zug ist sofort
        für alle sichtbar, und es gibt keinen Sieger, sondern ein gemeinsames Ergebnis. Koop ist
        auch der bessere Weg, jemandem das Spiel beizubringen, weil man am fremden Zug mehr lernt
        als am eigenen.
      </p>

      <SeoHeading>Häufige Fragen zum Duell</SeoHeading>
      <SeoFaq items={duelFaqs} />

      <RelatedLinks
        heading="Weiterspielen"
        label="Weitere Spiele und Hintergründe"
        links={[
          { href: "/duel/create/", label: "Neues Duell erstellen" },
          { href: "/koop/create/", label: "Koop: gemeinsam spielen" },
          { href: "/", label: "Tägliches Kontexto spielen" },
          { href: "/blog/duell-und-koop-taktik/", label: "Taktik für beide Modi" },
        ]}
      />
    </SeoSection>
  );
}
