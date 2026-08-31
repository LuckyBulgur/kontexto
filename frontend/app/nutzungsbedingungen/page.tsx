import Link from "next/link";
import TextPage from "@/components/seo/LegalLayout";
import { buildMetadata } from "@/lib/seo";
import { legal } from "@/lib/legal";

export const metadata = buildMetadata({
  path: "/nutzungsbedingungen/",
  title: "Nutzungsbedingungen",
  description:
    "Nutzungsbedingungen für Kontexto: was das Angebot umfasst, welche Regeln in den Mehrspieler-Modi gelten, wie es um Verfügbarkeit, Rechte an Inhalten und Haftung steht.",
});

/**
 * Nutzungsbedingungen als eigene Seite.
 *
 * Bewusst getrennt vom Impressum (Anbieterkennzeichnung nach § 5 DDG) und von
 * der Datenschutzerklaerung (Art. 13 DSGVO): Die drei beantworten
 * unterschiedliche Fragen, und "Terms" gehoert zu den Vertrauenssignalen, auf
 * die eine AdSense-Pruefung ausdruecklich achtet. Der Ton bleibt der des
 * uebrigen Angebots, also "du", und der Text sagt, was wirklich gilt, statt
 * eine Vorlage zu uebernehmen.
 */
export default function NutzungsbedingungenPage() {
  return (
    <TextPage
      title="Nutzungsbedingungen"
      breadcrumbName="Nutzungsbedingungen"
      path="/nutzungsbedingungen/"
    >
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">1. Geltungsbereich</h2>
        <p>
          Diese Bedingungen gelten für die Nutzung von kontexto.de mit allen Spielmodi und
          Inhaltsseiten. Anbieter ist {legal.name}, die vollständigen Angaben stehen im{" "}
          <Link href="/impressum/" className="underline underline-offset-2 hover:no-underline">
            Impressum
          </Link>
          . Mit dem Aufruf der Seite erkennst du diese Bedingungen an. Sie sind bewusst kurz
          gehalten, weil das Angebot kostenlos ist, kein Konto verlangt und keine Verträge über
          Waren oder Dienstleistungen zustande kommen.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">2. Was das Angebot umfasst</h2>
        <p>
          Kontexto stellt ein tägliches Wortratespiel, einen Unendlich-Modus, die Mehrspieler-Modi
          Duell und Koop sowie das Buchstabenspiel Wördle samt eigenem Duell bereit, dazu
          redaktionelle Inhalte wie Anleitung, Strategie, Glossar und Blog. Die Nutzung ist
          kostenlos und ohne Anmeldung möglich.
        </p>
        <p>
          Es besteht kein Anspruch auf Verfügbarkeit. Wartung, Störungen beim Hoster oder
          Weiterentwicklung können dazu führen, dass das Angebot vorübergehend nicht erreichbar
          ist. Einzelne Funktionen können geändert oder eingestellt werden; wesentliche Änderungen
          hält der{" "}
          <Link href="/changelog/" className="underline underline-offset-2 hover:no-underline">
            Changelog
          </Link>{" "}
          mit Datum fest.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">3. Regeln für die Nutzung</h2>
        <p>Beim Spielen und in den Mehrspieler-Modi gilt:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Wähle als Spitznamen nichts, was dich oder andere identifiziert, und nichts
            Beleidigendes, Diskriminierendes oder Werbliches. Der Spitzname ist für alle sichtbar,
            die den Link zur Runde haben.
          </li>
          <li>
            Nutze das Angebot nicht automatisiert, insbesondere nicht, um Ränge in großem Umfang
            abzufragen, die Lösungswörter auszulesen oder den Betrieb zu stören.
          </li>
          <li>
            Versuche nicht, Schutzmechanismen zu umgehen, fremde Runden zu manipulieren oder
            Sicherheitslücken auszunutzen. Wer eine findet, meldet sie bitte über die{" "}
            <Link href="/kontakt/" className="underline underline-offset-2 hover:no-underline">
              Kontaktseite
            </Link>
            .
          </li>
          <li>
            Mehrspieler-Runden sind über den geteilten Link erreichbar. Wer den Link weitergibt,
            entscheidet damit, wer mitspielen und die Spitznamen sehen kann.
          </li>
        </ul>
        <p>
          Bei erheblichen oder wiederholten Verstößen können einzelne Runden beendet und Zugriffe
          technisch eingeschränkt werden.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">4. Rechte an den Inhalten</h2>
        <p>
          Die Texte, das Design, der Quellcode und die Auswertungen auf dieser Seite sind
          urheberrechtlich geschützt. Einzelne Absätze dürfen mit Quellenangabe und Link zitiert
          werden. Eine vollständige oder weitgehende Übernahme, eine automatisierte Vervielfältigung
          oder eine Weiterverwendung als eigenes Angebot ist ohne vorherige Zustimmung nicht
          gestattet.
        </p>
        <p>
          Das zugrundeliegende Sprachmodell (fastText, Meta AI Research) steht unter der Lizenz
          seiner Urheber. Die Ranglisten, die Auswahl der Lösungswörter und alle veröffentlichten
          Kennzahlen sind eigene Arbeit; die Methodik dazu ist unter{" "}
          <Link href="/zahlen/" className="underline underline-offset-2 hover:no-underline">
            Kontexto in Zahlen
          </Link>{" "}
          offengelegt.
        </p>
        <p>
          Siehst du an einer Stelle ein Recht verletzt, etwa bei einem Lösungswort, einem Zitat oder
          einer Abbildung, dann schreib uns. Berechtigte Hinweise werden geprüft und betroffene
          Inhalte kurzfristig entfernt oder korrigiert.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">5. Werbung</h2>
        <p>
          Das Angebot finanziert sich über Werbung, die ausschließlich auf den beiden
          Einzelspieler-Seiten läuft. Inhaltsseiten, Rechtsseiten und die Mehrspieler-Räume bleiben
          werbefrei. Werbe- und Trackingcookies werden nur nach deiner Einwilligung gesetzt, die
          sich über den Link „Cookie-Einstellungen“ in der Fußzeile jederzeit widerrufen lässt.
          Einzelheiten stehen in der{" "}
          <Link href="/datenschutz/" className="underline underline-offset-2 hover:no-underline">
            Datenschutzerklärung
          </Link>
          . Für die Inhalte der ausgelieferten Anzeigen sind die jeweiligen Werbetreibenden
          verantwortlich.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">6. Haftung</h2>
        <p>
          Die Inhalte werden mit Sorgfalt erstellt, eine Gewähr für Richtigkeit und Vollständigkeit
          kann jedoch nicht übernommen werden. Für Schäden haften wir nur bei Vorsatz und grober
          Fahrlässigkeit sowie bei der Verletzung von Leben, Körper und Gesundheit; im Übrigen ist
          die Haftung ausgeschlossen, soweit gesetzlich zulässig.
        </p>
        <p>
          Für Inhalte verlinkter fremder Seiten sind deren Betreiber verantwortlich. Zum Zeitpunkt
          der Verlinkung waren keine Rechtsverstöße erkennbar; werden welche bekannt, wird der Link
          entfernt.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">7. Änderungen und anwendbares Recht</h2>
        <p>
          Diese Bedingungen können angepasst werden, wenn sich das Angebot ändert. Es gilt jeweils
          die auf dieser Seite veröffentlichte Fassung. Anwendbar ist deutsches Recht; zwingende
          Verbraucherschutzvorschriften des Staates, in dem du deinen gewöhnlichen Aufenthalt hast,
          bleiben davon unberührt. {legal.disputeResolution}
        </p>
        <p className="text-xs">Stand: August 2026</p>
      </section>
    </TextPage>
  );
}
