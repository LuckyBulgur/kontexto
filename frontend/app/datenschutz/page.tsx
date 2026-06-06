import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Datenschutz - Kontexto",
  description:
    "Datenschutzerklärung für Kontexto, das deutsche Wort-Ratespiel. Keine Cookies, keine Drittanbieter – nur anonyme, selbst gehostete Reichweitenmessung.",
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
              <strong className="text-foreground">Kurzfassung:</strong> Kontexto speichert keine personenbezogenen Daten über die üblichen Server-Logdaten hinaus. Dein Spielstand wird ausschließlich lokal in deinem Browser gespeichert.
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
              Wir messen die Nutzung der Website, um sie zu verbessern. Diese Statistik wird vollständig auf unserem eigenen Server erstellt – es werden <strong className="text-foreground">keine Daten an Dritte</strong> übermittelt und <strong className="text-foreground">keine Cookies</strong> gesetzt.
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
              Kontexto verwendet <strong className="text-foreground">keine Cookies</strong>. Weder eigene noch Cookies von Drittanbietern.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">7. Externe Dienste</h2>
            <p>
              Kontexto verwendet die Schriftart <strong className="text-foreground">Inter</strong>. Diese wird beim Erstellen der Website heruntergeladen und direkt von unserem Server ausgeliefert. Es findet <strong className="text-foreground">keine Verbindung zu Google-Servern</strong> statt.
            </p>
            <p>
              Es werden <strong className="text-foreground">keine externen Analyse-Tools oder Tracking-Dienste von Drittanbietern</strong> (z. B. Google Analytics) eingesetzt. Die Reichweitenmessung erfolgt ausschließlich anonym auf unserem eigenen Server (siehe Punkt 5).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">8. Deine Rechte</h2>
            <p>
              Du hast gemäß DSGVO das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung deiner Daten sowie das Recht auf Beschwerde bei einer Aufsichtsbehörde.
            </p>
            <p>
              Da Kontexto keine personenbezogenen Daten speichert (außer kurzfristige Server-Logs), liegen in der Regel keine Daten vor, die dir zugeordnet werden können.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">9. Änderungen</h2>
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
