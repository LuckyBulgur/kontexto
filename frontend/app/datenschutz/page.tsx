import Link from "next/link";
import TextPage from "@/components/seo/LegalLayout";
import { buildMetadata } from "@/lib/seo";
import { legal } from "@/lib/legal";

export const metadata = buildMetadata({
  path: "/datenschutz/",
  title: "Datenschutz",
  description:
    "Datenschutzerklärung für Kontexto, das deutsche Wort-Ratespiel: lokale Speicherung, anonyme Reichweitenmessung, Daten in den Mehrspieler-Modi, Cookies und Werbung über Google AdSense (mit Einwilligung).",
});

export default function DatenschutzPage() {
  return (
    <TextPage title="Datenschutzerklärung" breadcrumbName="Datenschutz" path="/datenschutz/">
      <>
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">1. Überblick</h2>
            <p>
              Der Schutz deiner Daten ist uns wichtig. Diese Datenschutzerklärung informiert dich darüber, welche Daten beim Besuch von Kontexto erhoben werden und wie sie verwendet werden.
            </p>
            <p>
              <strong className="text-foreground">Kurzfassung:</strong> Dein Spielstand wird ausschließlich lokal in deinem Browser gespeichert, und unsere Reichweitenmessung ist anonym und cookiefrei. Zur Finanzierung schalten wir Google-AdSense-Werbung. Werbebezogene Cookies und eine Datenübermittlung an Google erfolgen jedoch <strong className="text-foreground">nur mit deiner Einwilligung</strong> über das Consent-Banner (siehe den Abschnitt zu Google AdSense).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">2. Verantwortlicher</h2>
            <p>
              Verantwortlich für die Verarbeitung personenbezogener Daten auf dieser Website im Sinne von Art. 4 Nr. 7 DSGVO ist:
            </p>
            <p className="not-italic">
              {legal.name}
              <br />
              {legal.careOf}
              <br />
              {legal.street}
              <br />
              {legal.city}
              <br />
              {legal.country}
            </p>
            <p>
              E-Mail: <a href={`mailto:${legal.email}`} className="underline underline-offset-2 hover:no-underline">{legal.email}</a>. Die vollständigen Anbieterangaben stehen im{" "}
              <Link href="/impressum/" className="underline underline-offset-2 hover:no-underline">Impressum</Link>, weitere Kontaktwege auf der{" "}
              <Link href="/kontakt/" className="underline underline-offset-2 hover:no-underline">Kontaktseite</Link>.
            </p>
            <p>
              Eine Pflicht zur Benennung eines Datenschutzbeauftragten besteht nicht, da die Voraussetzungen des Art. 37 DSGVO und des § 38 BDSG hier nicht erfüllt sind.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">3. Lokale Datenspeicherung (localStorage)</h2>
            <p>
              Kontexto speichert folgende Daten ausschließlich lokal in deinem Browser (localStorage):
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Spielstand (Versuche, Tipps, gelöst/nicht gelöst)</li>
              <li>Design-Einstellung (Hell/Dunkel)</li>
              <li>Schwierigkeitsgrad</li>
              <li>Sortierungspräferenz</li>
            </ul>
            <p>
              Diese Daten werden <strong className="text-foreground">nicht</strong> an unseren Server übertragen und verbleiben vollständig in deinem Browser. Du kannst sie jederzeit löschen, indem du die Browserdaten löschst.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">4. Server-Kommunikation</h2>
            <p>
              Wenn du ein Wort eingibst, wird dieses Wort an unseren Server gesendet, um den Rang zu berechnen. Dabei werden keine weiteren personenbezogenen Daten übermittelt. Es gibt keine Benutzerkonten, keine Sitzungs-Cookies und keine Authentifizierung.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">5. Mehrspieler-Modi (Duell, Koop, Wördle-Duell)</h2>
            <p>
              Die Einzelspieler-Modi kommen ohne serverseitige Speicherung aus. In den Mehrspieler-Modi geht das nicht, weil die Mitspielenden deinen Fortschritt sehen sollen. Wenn du eine Runde erstellst oder ihr beitrittst, speichern wir für die Dauer dieser Runde auf unserem Server:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>den von dir frei gewählten Spitznamen</li>
              <li>deinen Spielstand in dieser Runde (bester Rang, Anzahl der Versuche, Anzahl der Tipps, gelöst oder nicht)</li>
              <li>im Koop-Modus zusätzlich die geratenen Wörter, weil dort alle dieselbe Rateliste teilen</li>
              <li>eine zufällig erzeugte Kennung, mit der dein Browser sich derselben Runde wieder zuordnen kann</li>
            </ul>
            <p>
              <strong className="text-foreground">Wähle den Spitznamen so, dass er dich nicht identifiziert.</strong> Er ist für alle sichtbar, die den Link zur Runde haben. Ein echter Name, eine E-Mail-Adresse oder eine Telefonnummer gehören dort nicht hinein.
            </p>
            <p>
              Die Daten einer Runde werden automatisch und vollständig gelöscht, sobald die Runde eine Stunde lang ohne Teilnehmende und ohne Aktivität war. Ein Archiv abgeschlossener Runden gibt es nicht, und die Daten werden nicht ausgewertet, nicht mit anderen Quellen zusammengeführt und nicht an Dritte weitergegeben. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, weil die Verarbeitung genau die Funktion erbringt, die du mit dem Betreten der Runde angefordert hast.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">6. Server-Logdaten</h2>
            <p>
              Beim Zugriff auf die Website werden durch den Webserver automatisch Logdaten erhoben, die dein Browser übermittelt. Dazu gehören:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>IP-Adresse</li>
              <li>Datum und Uhrzeit des Zugriffs</li>
              <li>Angeforderte Seite/Ressource</li>
              <li>HTTP-Statuscode</li>
              <li>Browser-Typ und -Version</li>
            </ul>
            <p>
              Diese Daten werden für den technischen Betrieb der Website benötigt und nicht mit anderen Datenquellen zusammengeführt. Die Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am sicheren Betrieb).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">7. Anonyme Reichweitenmessung (Statistik)</h2>
            <p>
              Wir messen die Nutzung der Website, um sie zu verbessern. Diese Statistik wird vollständig auf unserem eigenen Server erstellt, es werden <strong className="text-foreground">keine Daten an Dritte</strong> übermittelt und <strong className="text-foreground">keine Cookies</strong> gesetzt.
            </p>
            <p>
              Zur Unterscheidung von Besuchen bilden wir einen <strong className="text-foreground">anonymen, nicht umkehrbaren Hash-Wert</strong> aus deiner IP-Adresse und deinem Browser-Typ, kombiniert mit einem geheimen, monatlich wechselnden Schlüssel. Die <strong className="text-foreground">IP-Adresse selbst wird dabei nicht gespeichert</strong> und lässt sich aus dem Hash nicht wiederherstellen. Eine Identifizierung einzelner Personen ist nicht möglich.
            </p>
            <p>
              Erfasst werden nur aggregierte Kennzahlen wie Seitenaufrufe, ungefähre Besucherzahlen, grobe Geräte-/Browser-Kategorie und Spiel-Statistiken (z. B. Anzahl der Rateversuche). Die zugrundeliegenden Einzeldaten werden nach spätestens 35 Tagen automatisch gelöscht; danach verbleiben ausschließlich anonyme Summenwerte. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer datenschutzfreundlichen Reichweitenmessung).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">8. Cookies</h2>
            <p>
              Für den Betrieb des Spiels und die anonyme Reichweitenmessung (Abschnitt „Anonyme Reichweitenmessung“) setzt Kontexto <strong className="text-foreground">keine Cookies</strong>. Dein Spielstand wird ausschließlich im lokalen Speicher (localStorage) deines Browsers abgelegt; dies ist technisch erforderlich und bedarf keiner Einwilligung (§ 25 Abs. 2 Nr. 2 TDDDG).
            </p>
            <p>
              <strong className="text-foreground">Werbe-Cookies</strong> werden ausschließlich durch Google AdSense (siehe den Abschnitt zu Google AdSense) und <strong className="text-foreground">nur nach deiner ausdrücklichen Einwilligung</strong> über das Einwilligungsbanner gesetzt. Ohne deine Einwilligung werden keine werbebezogenen Cookies gesetzt.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">9. Externe Dienste</h2>
            <p>
              Kontexto verwendet die Schriftart <strong className="text-foreground">Inter</strong>. Diese wird beim Erstellen der Website heruntergeladen und direkt von unserem Server ausgeliefert. Es findet <strong className="text-foreground">keine Verbindung zu Google-Servern</strong> statt.
            </p>
            <p>
              Für die <strong className="text-foreground">Reichweitenmessung</strong> werden keine externen Analyse-Tools oder Tracking-Dienste von Drittanbietern (z. B. Google Analytics) eingesetzt; sie erfolgt ausschließlich anonym auf unserem eigenen Server (siehe „Anonyme Reichweitenmessung“). Zur Finanzierung des kostenlosen Angebots binden wir jedoch <strong className="text-foreground">Google AdSense</strong> als Werbedienst ein. Einzelheiten dazu stehen im Abschnitt zu Google AdSense.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">10. Werbung durch Google AdSense</h2>
            <p>
              Zur Finanzierung dieses kostenlosen Angebots nutzen wir Google AdSense, einen Dienst der <strong className="text-foreground">Google Ireland Limited</strong>, Gordon House, Barrow Street, Dublin 4, Irland („Google“). Google AdSense verwendet Cookies und vergleichbare Technologien (z. B. Web Beacons), um Anzeigen auszuspielen und deren Auslieferung zu messen. Dabei können Informationen wie deine (gekürzte) IP-Adresse, Geräte- und Browserdaten sowie Interaktionen mit Anzeigen verarbeitet werden.
            </p>
            <p>
              <strong className="text-foreground">Einwilligung (Consent Management Platform):</strong> Bevor werbebezogene Cookies gesetzt oder personalisierte Anzeigen ausgeliefert werden, erhältst du über ein von Google bereitgestelltes, nach dem IAB Transparency &amp; Consent Framework (TCF, aktuell v2.3) zertifiziertes Einwilligungsbanner die Möglichkeit, der Verarbeitung zuzustimmen oder sie abzulehnen. Rechtsgrundlage ist deine Einwilligung gemäß <strong className="text-foreground">Art. 6 Abs. 1 lit. a DSGVO</strong> sowie § 25 Abs. 1 TDDDG.
            </p>
            <p>
              <strong className="text-foreground">Datenübermittlung in die USA:</strong> Im Rahmen von Google AdSense können Daten an Server von Google übermittelt werden, auch an Server in den USA. Google ist unter dem EU-US Data Privacy Framework zertifiziert. Ein Zugriff durch US-Behörden kann dabei nicht vollständig ausgeschlossen werden. Mit deiner Einwilligung willigst du auch in diese Übermittlung gemäß Art. 49 Abs. 1 lit. a DSGVO ein.
            </p>
            <p>
              <strong className="text-foreground">Widerruf:</strong> Du kannst deine Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen oder anpassen, indem du deine Auswahl im Einwilligungsbanner änderst. Personalisierte Werbung kannst du zusätzlich in den{" "}
              <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">Google-Anzeigeneinstellungen</a>{" "}deaktivieren.
            </p>
            <p>
              Weitere Informationen findest du in der{" "}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">Datenschutzerklärung von Google</a>{" "}sowie unter{" "}
              <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">„Wie Google Daten bei der Anzeigenschaltung verwendet“</a>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">11. Minderjährige</h2>
            <p>
              Kontexto richtet sich an ein allgemeines Publikum und ist kein Angebot, das sich gezielt an Kinder wendet. Zum Spielen ist keine Anmeldung nötig. Wir fragen weder nach Name, Alter, E-Mail-Adresse noch Anschrift und erheben wissentlich keine personenbezogenen Daten von Kindern unter 16 Jahren.
            </p>
            <p>
              Die einzige freie Eingabe, die für andere sichtbar wird, ist der Spitzname in den Mehrspieler-Modi. Wir weisen dort ausdrücklich darauf hin, keinen echten Namen zu verwenden. Werbung wird ohne erteilte Einwilligung nicht personalisiert ausgeliefert.
            </p>
            <p>
              Erziehungsberechtigte, die vermuten, dass ein Kind uns personenbezogene Daten übermittelt hat, erreichen uns über die{" "}
              <Link href="/kontakt/" className="underline underline-offset-2 hover:no-underline">Kontaktseite</Link>. Wir löschen solche Daten unverzüglich.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">12. Deine Rechte</h2>
            <p>
              Du hast gemäß DSGVO das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung deiner Daten, das Recht auf Datenübertragbarkeit, das Recht auf Widerruf erteilter Einwilligungen sowie das Recht auf Beschwerde bei einer Aufsichtsbehörde. Gegen Verarbeitungen, die auf einem berechtigten Interesse beruhen (Art. 6 Abs. 1 lit. f DSGVO), steht dir zudem das Widerspruchsrecht nach Art. 21 DSGVO zu.
            </p>
            <p>
              Über die kurzfristigen Server-Logs (Abschnitt „Server-Logdaten“) und die mit deiner Einwilligung über Google AdSense (Abschnitt „Werbung durch Google AdSense“) verarbeiteten Daten hinaus speichert Kontexto selbst nur die Daten einer laufenden Mehrspieler-Runde (Abschnitt „Mehrspieler-Modi“), und auch diese nur bis zu ihrer automatischen Löschung. Ein Nutzerkonto, ein Profil oder eine dauerhafte Kennung entsteht dabei nicht. Für die im Rahmen von Google AdSense verarbeiteten Daten ist Google (mit-)verantwortlich; die entsprechenden Betroffenenrechte kannst du auch direkt bei Google geltend machen.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">13. Änderungen</h2>
            <p>
              Diese Datenschutzerklärung kann gelegentlich aktualisiert werden. Die aktuelle Version ist stets auf dieser Seite abrufbar.
            </p>
          </section>
      </>

      <p className="text-xs">Stand: August 2026</p>
    </TextPage>
  );
}
