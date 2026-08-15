import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Datenschutz - Kontexto",
  description:
    "Datenschutzerklärung für Kontexto, das deutsche Wort-Ratespiel: lokale Speicherung, anonyme Reichweitenmessung, Cookies und Werbung über Google AdSense (mit Einwilligung).",
  alternates: {
    canonical: "/datenschutz/",
  },
};

export default function DatenschutzPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">&larr; Zurück zum Spiel</Link>

        <h1 className="text-2xl font-bold mt-6 mb-6">Datenschutzerklärung</h1>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">1. Überblick</h2>
            <p>
              Der Schutz deiner Daten ist uns wichtig. Diese Datenschutzerklärung informiert dich darüber, welche Daten beim Besuch von Kontexto erhoben werden und wie sie verwendet werden.
            </p>
            <p>
              <strong className="text-foreground">Kurzfassung:</strong> Dein Spielstand wird ausschließlich lokal in deinem Browser gespeichert, und unsere Reichweitenmessung ist anonym und cookiefrei. Zur Finanzierung schalten wir Google-AdSense-Werbung. Werbebezogene Cookies und eine Datenübermittlung an Google erfolgen jedoch <strong className="text-foreground">nur mit deiner Einwilligung</strong> über das Consent-Banner (siehe Punkt 8).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">2. Lokale Datenspeicherung (localStorage)</h2>
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
            <h2 className="text-base font-semibold text-foreground">3. Server-Kommunikation</h2>
            <p>
              Wenn du ein Wort eingibst, wird dieses Wort an unseren Server gesendet, um den Rang zu berechnen. Dabei werden keine weiteren personenbezogenen Daten übermittelt. Es gibt keine Benutzerkonten, keine Sitzungs-Cookies und keine Authentifizierung.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">4. Server-Logdaten</h2>
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
            <h2 className="text-base font-semibold text-foreground">5. Anonyme Reichweitenmessung (Statistik)</h2>
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
            <h2 className="text-base font-semibold text-foreground">6. Cookies</h2>
            <p>
              Für den Betrieb des Spiels und die anonyme Reichweitenmessung (Punkt 5) setzt Kontexto <strong className="text-foreground">keine Cookies</strong>. Dein Spielstand wird ausschließlich im lokalen Speicher (localStorage) deines Browsers abgelegt; dies ist technisch erforderlich und bedarf keiner Einwilligung (§ 25 Abs. 2 Nr. 2 TDDDG).
            </p>
            <p>
              <strong className="text-foreground">Werbe-Cookies</strong> werden ausschließlich durch Google AdSense (siehe Punkt 8) und <strong className="text-foreground">nur nach deiner ausdrücklichen Einwilligung</strong> über das Einwilligungsbanner gesetzt. Ohne deine Einwilligung werden keine werbebezogenen Cookies gesetzt.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">7. Externe Dienste</h2>
            <p>
              Kontexto verwendet die Schriftart <strong className="text-foreground">Inter</strong>. Diese wird beim Erstellen der Website heruntergeladen und direkt von unserem Server ausgeliefert. Es findet <strong className="text-foreground">keine Verbindung zu Google-Servern</strong> statt.
            </p>
            <p>
              Für die <strong className="text-foreground">Reichweitenmessung</strong> werden keine externen Analyse-Tools oder Tracking-Dienste von Drittanbietern (z. B. Google Analytics) eingesetzt; sie erfolgt ausschließlich anonym auf unserem eigenen Server (siehe Punkt 5). Zur Finanzierung des kostenlosen Angebots binden wir jedoch <strong className="text-foreground">Google AdSense</strong> als Werbedienst ein. Einzelheiten dazu stehen in Punkt 8.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">8. Werbung durch Google AdSense</h2>
            <p>
              Zur Finanzierung dieses kostenlosen Angebots nutzen wir Google AdSense, einen Dienst der <strong className="text-foreground">Google Ireland Limited</strong>, Gordon House, Barrow Street, Dublin 4, Irland („Google“). Google AdSense verwendet Cookies und vergleichbare Technologien (z. B. Web Beacons), um Anzeigen auszuspielen und deren Auslieferung zu messen. Dabei können Informationen wie deine (gekürzte) IP-Adresse, Geräte- und Browserdaten sowie Interaktionen mit Anzeigen verarbeitet werden.
            </p>
            <p>
              <strong className="text-foreground">Einwilligung (Consent Management Platform):</strong> Bevor werbebezogene Cookies gesetzt oder personalisierte Anzeigen ausgeliefert werden, erhältst du über ein von Google bereitgestelltes, nach dem IAB Transparency &amp; Consent Framework (TCF v2.2) zertifiziertes Einwilligungsbanner die Möglichkeit, der Verarbeitung zuzustimmen oder sie abzulehnen. Rechtsgrundlage ist deine Einwilligung gemäß <strong className="text-foreground">Art. 6 Abs. 1 lit. a DSGVO</strong> sowie § 25 Abs. 1 TDDDG.
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
            <h2 className="text-base font-semibold text-foreground">9. Deine Rechte</h2>
            <p>
              Du hast gemäß DSGVO das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung deiner Daten, das Recht auf Datenübertragbarkeit, das Recht auf Widerruf erteilter Einwilligungen sowie das Recht auf Beschwerde bei einer Aufsichtsbehörde.
            </p>
            <p>
              Über die kurzfristigen Server-Logs (Punkt 4) und die mit deiner Einwilligung über Google AdSense (Punkt 8) verarbeiteten Daten hinaus speichert Kontexto selbst keine personenbezogenen Daten. Für die im Rahmen von Google AdSense verarbeiteten Daten ist Google (mit-)verantwortlich; die entsprechenden Betroffenenrechte kannst du auch direkt bei Google geltend machen.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">10. Änderungen</h2>
            <p>
              Diese Datenschutzerklärung kann gelegentlich aktualisiert werden. Die aktuelle Version ist stets auf dieser Seite abrufbar.
            </p>
          </section>
        </div>

        <p className="text-xs text-muted-foreground mt-8">Stand: Juni 2026</p>
      </div>
    </div>
  );
}
