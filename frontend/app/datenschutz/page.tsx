import Link from "next/link";
import TextPage from "@/components/seo/LegalLayout";
import { buildMetadata } from "@/lib/seo";
import { legal } from "@/lib/legal";

export const metadata = buildMetadata({
  path: "/datenschutz/",
  title: "Datenschutz",
  description:
    "Datenschutzerklärung für Kontexto, das deutsche Wort-Ratespiel: lokale Speicherung, anonyme Reichweitenmessung, Daten in den Mehrspieler-Modi, Cookies, Werbung durch Adcash nur mit Einwilligung und vorgesehene Google-AdSense-Werbung.",
});

export default function DatenschutzPage() {
  return (
    <TextPage title="Datenschutzerklärung" breadcrumbName="Datenschutz" path="/datenschutz/">
      <>
          <section className="space-y-2">
            <h2 className="text-body font-semibold text-foreground">1. Überblick</h2>
            <p>
              Der Schutz deiner Daten ist uns wichtig. Diese Datenschutzerklärung informiert dich darüber, welche Daten beim Besuch von Kontexto erhoben werden und wie sie verwendet werden.
            </p>
            <p>
              <strong className="text-foreground">Kurzfassung:</strong> Dein Spielstand wird ausschließlich lokal in deinem Browser gespeichert, und unsere Reichweitenmessung ist anonym und cookiefrei. Übergangsweise finanzieren wir das Spiel über Werbung von Adcash, später ist Google AdSense vorgesehen. Werbung wird <strong className="text-foreground">nur mit deiner Einwilligung</strong> geladen, die du im Einwilligungsbanner erteilst oder ablehnst. Ohne Einwilligung lädt Kontexto kein Werbeskript, und auf deinem Gerät wird nichts für Werbung gespeichert (siehe den Abschnitt „Werbung durch Adcash“).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-body font-semibold text-foreground">2. Verantwortlicher</h2>
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
            <h2 className="text-body font-semibold text-foreground">3. Lokale Datenspeicherung (localStorage)</h2>
            <p>
              Kontexto speichert folgende Daten ausschließlich lokal in deinem Browser (localStorage):
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Spielstand (Versuche, Tipps, gelöst/nicht gelöst)</li>
              <li>Design-Einstellung (Hell/Dunkel)</li>
              <li>Schwierigkeitsgrad</li>
              <li>Sortierungspräferenz</li>
              <li>Hinweis, dass die freiwillige Kurzumfrage („Woher kennst du Kontexto?“) bereits gestellt oder beantwortet wurde</li>
              <li>deine Entscheidung im Einwilligungsbanner zur Werbung (erlaubt oder abgelehnt, mit Zeitpunkt und Fassung des Banners)</li>
            </ul>
            <p>
              Diese Daten werden <strong className="text-foreground">nicht</strong> an unseren Server übertragen und verbleiben vollständig in deinem Browser. Du kannst sie jederzeit löschen, indem du die Browserdaten löschst.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-body font-semibold text-foreground">4. Server-Kommunikation</h2>
            <p>
              Wenn du ein Wort eingibst, wird dieses Wort an unseren Server gesendet, um den Rang zu berechnen. Dabei werden keine weiteren personenbezogenen Daten übermittelt. Es gibt keine Benutzerkonten, keine Sitzungs-Cookies und keine Authentifizierung.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-body font-semibold text-foreground">5. Mehrspieler-Modi (Duell, Koop, Wördle-Duell, Stream-Chat)</h2>
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
            <p>
              <strong className="text-foreground">Stream-Chat (Twitch und TikTok):</strong> Wer als Streamer eine Runde unter /live/ startet, gibt uns seinen öffentlichen Kanalnamen. Unser Server liest dann den öffentlichen Chat dieses Livestreams mit und wertet jede Nachricht aus, die aus einem einzigen Wort besteht. Für eine gezählte Nachricht speichern wir für die Dauer der Runde das Wort, den Anzeigenamen, unter dem die Nachricht im Chat stand, und die Kennung, die die Plattform diesem Konto gibt. Die Kennung brauchen wir, damit niemand öfter als alle zwei Sekunden rät und damit die Rangliste im Stream stimmt. Anzeigenamen und geratene Wörter erscheinen auf der Einblendung, die der Streamer in seinen Stream einbindet. Alles andere im Chat wird weder gespeichert noch ausgewertet. Die Daten werden mit der Runde gelöscht, nach derselben Regel wie oben. Dauerhaft behalten wir nur Zähler je Kanal (Runden, Versuche, Lösungen, Zahl der Mitratenden), ohne Namen und ohne Kennungen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO: Das berechtigte Interesse ist, dass ein Chat gemeinsam mitspielen kann, und es werden nur Angaben verarbeitet, die im Chat ohnehin öffentlich stehen.
            </p>
            <p>
              Den Chat von <strong className="text-foreground">Twitch</strong> liest unser Server direkt und anonym, ohne Anmeldung. <strong className="text-foreground">TikTok</strong> bietet dafür keinen offiziellen Weg. Den TikTok-Chat empfangen wir deshalb über den Dienst <strong className="text-foreground">Euler Stream</strong> (eulerstream.com): Unser Server nennt ihm nur den öffentlichen TikTok-Namen des Streamers, Euler Stream liest den Chat dieses Livestreams und reicht die Nachrichten an uns weiter. Daten von Besucherinnen und Besuchern von Kontexto übermitteln wir dabei nicht. Euler Stream nennt in seinen Rechtstexten weder einen Firmensitz noch ein Land der Verarbeitung; wir müssen deshalb davon ausgehen, dass die Verarbeitung außerhalb der EU stattfindet. Seine Angaben stehen in der{" "}
              <a href="https://www.eulerstream.com/privacy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">Datenschutzerklärung von Euler Stream</a>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-body font-semibold text-foreground">6. Server-Logdaten</h2>
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
            <h2 className="text-body font-semibold text-foreground">7. Anonyme Reichweitenmessung (Statistik)</h2>
            <p>
              Wir messen die Nutzung der Website, um sie zu verbessern. Diese Statistik wird vollständig auf unserem eigenen Server erstellt, es werden <strong className="text-foreground">keine Daten an Dritte</strong> übermittelt und <strong className="text-foreground">keine Cookies</strong> gesetzt.
            </p>
            <p>
              Zur Unterscheidung von Besuchen bilden wir einen <strong className="text-foreground">anonymen, nicht umkehrbaren Hash-Wert</strong> aus deiner IP-Adresse und deinem Browser-Typ, kombiniert mit einem geheimen, monatlich wechselnden Schlüssel. Die <strong className="text-foreground">IP-Adresse selbst wird dabei nicht gespeichert</strong> und lässt sich aus dem Hash nicht wiederherstellen. Eine Identifizierung einzelner Personen ist nicht möglich.
            </p>
            <p>
              Erfasst werden nur aggregierte Kennzahlen wie Seitenaufrufe, ungefähre Besucherzahlen, grobe Geräte-/Browser-Kategorie und Spiel-Statistiken (z. B. Anzahl der Rateversuche). Die zugrundeliegenden Einzeldaten werden nach spätestens 35 Tagen automatisch gelöscht; danach verbleiben ausschließlich anonyme Summenwerte. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer datenschutzfreundlichen Reichweitenmessung).
            </p>
            <p>
              <strong className="text-foreground">Geteilte Links:</strong> Wenn du dein Ergebnis teilst, enthält der kopierte Text einen Link auf das Spiel mit einer Kennung der Partie (etwa <span className="font-mono">?s=412</span>). Wer darüber hereinkommt, wird nur als Zahl je Seite gezählt; die Kennung wird sofort aus der Adresszeile entfernt und nicht gespeichert. Ebenfalls gezählt wird, wie oft der Teilen-Knopf gedrückt wurde, ohne Bezug zu deiner Person.
            </p>
            <p>
              <strong className="text-foreground">Lesedauer:</strong> Solange eine Seite sichtbar geöffnet ist, sendet der Browser alle 20 Sekunden ein kurzes Lebenszeichen. Daraus schätzen wir die Verweildauer je Seite und zeigen, wie viele Personen gerade online sind. Gespeichert wird nur der oben beschriebene anonyme Hash-Wert mit dem Zeitpunkt, und diese Einträge werden laufend gelöscht.
            </p>
            <p>
              <strong className="text-foreground">Freiwillige Kurzumfrage:</strong> Nach einem beendeten Spiel fragen wir dich einmalig in einem Dialogfenster, woher du Kontexto kennst. Die Antwort ist freiwillig, der Dialog lässt sich jederzeit überspringen. Gespeichert wird nur der gewählte Kanal als Zähler (etwa „TikTok“), ohne Bezug zu deiner Person.
            </p>
            <p>
              Das anschließende Textfeld ist ebenfalls freiwillig, auf 80 Zeichen begrenzt und wird <strong className="text-foreground">getrennt von jeder Besucherkennung</strong> gespeichert. Bitte gib dort keine personenbezogenen Daten an. Damit dieselbe Person nicht mehrfach gefragt wird, hält der Server denselben anonymen Hash-Wert wie oben für längstens 180 Tage vor; im Browser merkt sich ein lokaler Eintrag, dass die Frage bereits gestellt wurde. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse daran zu erfahren, worüber das Angebot gefunden wird).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-body font-semibold text-foreground">8. Cookies</h2>
            <p>
              Für den Betrieb des Spiels und die anonyme Reichweitenmessung (Abschnitt „Anonyme Reichweitenmessung“) setzt Kontexto <strong className="text-foreground">keine Cookies</strong>. Dein Spielstand wird ausschließlich im lokalen Speicher (localStorage) deines Browsers abgelegt; dies ist technisch erforderlich und bedarf keiner Einwilligung (§ 25 Abs. 2 Nr. 2 TDDDG).
            </p>
            <p>
              Deine Entscheidung im Einwilligungsbanner legen wir ebenfalls im lokalen Speicher ab, damit das Banner dich nicht bei jedem Aufruf erneut fragt. Auch das ist technisch erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Nach zwölf Monaten oder wenn sich der Inhalt des Banners ändert, fragen wir erneut.
            </p>
            <p>
              <strong className="text-foreground">Werbe-Cookies</strong> und vergleichbare Einträge auf deinem Gerät entstehen ausschließlich durch Werbung und <strong className="text-foreground">nur nach deiner ausdrücklichen Einwilligung</strong> über das Einwilligungsbanner, derzeit durch Adcash (siehe den Abschnitt „Werbung durch Adcash“). Ohne deine Einwilligung werden keine werbebezogenen Cookies gesetzt. Welche Einträge das im Einzelnen sind, steht auf der Seite{" "}
              <Link href="/cookies/" className="underline underline-offset-2 hover:no-underline">Cookies und lokaler Speicher</Link>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-body font-semibold text-foreground">9. Externe Dienste</h2>
            <p>
              Kontexto verwendet die Schriftart <strong className="text-foreground">Inter</strong>. Diese wird beim Erstellen der Website heruntergeladen und direkt von unserem Server ausgeliefert. Es findet <strong className="text-foreground">keine Verbindung zu Google-Servern</strong> statt.
            </p>
            <p>
              Für die <strong className="text-foreground">Reichweitenmessung</strong> werden keine externen Analyse-Tools oder Tracking-Dienste von Drittanbietern (z. B. Google Analytics) eingesetzt; sie erfolgt ausschließlich anonym auf unserem eigenen Server (siehe „Anonyme Reichweitenmessung“). Übergangsweise finanzieren wir das kostenlose Angebot über den Werbedienst <strong className="text-foreground">Adcash</strong>, der nur nach deiner Einwilligung geladen wird (Abschnitt „Werbung durch Adcash“). Später ist <strong className="text-foreground">Google AdSense</strong> als Werbedienst vorgesehen. Dessen Verifizierungscode ist bereits eingebunden, im aktuellen Prüfmodus werden jedoch keine AdSense-Anzeigen ausgeliefert (Abschnitt zu Google AdSense).
            </p>
          </section>

          <section id="werbung-adcash" className="space-y-2 scroll-mt-20">
            <h2 className="text-body font-semibold text-foreground">10. Werbung durch Adcash</h2>
            <p>
              Bis Google AdSense für Kontexto freigeschaltet ist, finanzieren wir das Spiel über Werbung
              von <strong className="text-foreground">Adcash OÜ</strong>, Ahtri 6, 10151 Tallinn, Estland
              (Registernummer 12141869, E-Mail für Datenschutzfragen:{" "}
              <a href="mailto:legal@adcash.com" className="underline underline-offset-2 hover:text-foreground">legal@adcash.com</a>), im Folgenden „Adcash“.
            </p>
            <p>
              <strong className="text-foreground">Wann Adcash geladen wird:</strong> nur, wenn du im
              Einwilligungsbanner „Akzeptieren“ gewählt hast, und nur auf den beiden
              Einzelspieler-Seiten, also der Kontexto-Startseite und der Wördle-Seite. Vorher, nach
              einer Ablehnung und auf allen anderen Seiten bindet Kontexto kein Adcash-Skript ein, und
              dein Browser nimmt keine Verbindung zu Adcash auf. Öffnest du eine andere Seite, nachdem
              Adcash geladen wurde, lädt Kontexto diese Seite neu, und zwar ohne Adcash.
            </p>
            <p>
              <strong className="text-foreground">Welche Werbung erscheint:</strong> ausschließlich
              Werbebanner in fest gekennzeichneten Flächen. Auf großen Bildschirmen steht je ein
              Banner links und rechts neben dem Spiel, auf kleineren eine schmale Leiste am unteren
              Rand. Pop-under-Fenster, Vollbildanzeigen und Videowerbung nutzt Kontexto nicht. Welche
              Anzeige in einer Fläche erscheint, entscheidet Adcash.
            </p>
            <p>
              <strong className="text-foreground">Welche Daten verarbeitet werden:</strong> deine
              IP-Adresse, Angaben zu Browser, Betriebssystem, Gerät, Bildschirmgröße und Sprache, die
              aufgerufene Seite und die Seite, von der du kamst, der Zeitpunkt sowie deine
              Interaktionen mit den Anzeigen, etwa Einblendungen und Klicks. Adcash legt dafür Einträge
              im lokalen Speicher deines Browsers unter kontexto.de ab, unter anderem um Einblendungen
              zu zählen und zu begrenzen, und kann Cookies unter eigenen Domains setzen und lesen.
              Beteiligt waren bei unserer Messung vom 23. September 2026 die Domains acscdn.com,
              adexchangerapid.com und usrpubtrk.com sowie Server, von denen Werbekunden ihre
              Werbemittel ausliefern.
            </p>
            <p>
              <strong className="text-foreground">Zwecke:</strong> Auswahl und Auslieferung der
              Anzeigen, Begrenzung, wie oft dieselbe Anzeige erscheint, Messung und Abrechnung der
              Einblendungen und Klicks sowie die Erkennung von Betrug. Nach eigenen Angaben gibt Adcash
              an Werbekunden nur zusammengefasste Statistiken ohne IP-Adressen weiter.
            </p>
            <p>
              <strong className="text-foreground">Seiten der Werbekunden:</strong> Öffnest du mit einem
              Klick auf ein Banner die Seite eines Werbekunden, gelten dort dessen eigene
              Datenschutzerklärung und dessen eigenes Einwilligungsbanner. Für die Verarbeitung auf
              diesen Seiten ist der jeweilige Werbekunde verantwortlich, nicht Kontexto.
            </p>
            <p>
              <strong className="text-foreground">Rechtsgrundlage:</strong> deine Einwilligung, für
              das Speichern und Auslesen auf deinem Gerät nach § 25 Abs. 1 TDDDG und für die
              Verarbeitung der Daten nach Art. 6 Abs. 1 lit. a DSGVO. Die Einwilligung ist freiwillig.
              Lehnst du ab, gibt es keine Werbung, und das Spiel funktioniert in vollem Umfang.
            </p>
            <p>
              <strong className="text-foreground">Verantwortlichkeit:</strong> Für das Einbinden des
              Skripts und die dadurch ausgelöste Übermittlung deiner Daten an Adcash sind wir und
              Adcash gemeinsam verantwortlich. Für die weitere Verarbeitung bei Adcash ist Adcash
              allein verantwortlich. Deine Rechte aus dem Abschnitt „Deine Rechte“ kannst du bei uns
              und bei Adcash geltend machen.
            </p>
            <p>
              <strong className="text-foreground">Kein Consent-Framework:</strong> Adcash nimmt nicht
              am IAB Transparency &amp; Consent Framework teil und liest kein Einwilligungssignal aus.
              Deshalb fragen wir mit einem eigenen Banner und laden das Skript ohne Einwilligung gar
              nicht erst, statt ihm eine Ablehnung zu übermitteln. Im Quelltext jeder Seite steht der
              Einbindungscode von Adcash zwar, damit Adcash die Website prüfen kann, aber als
              deaktivierter Text: Dein Browser lädt und startet ihn nicht.
            </p>
            <p>
              <strong className="text-foreground">Ort der Verarbeitung:</strong> Adcash hat seinen Sitz
              in Estland, also in der Europäischen Union.
            </p>
            <p>
              <strong className="text-foreground">Speicherdauer:</strong> Deine Entscheidung im Banner
              bleibt zwölf Monate lokal in deinem Browser gespeichert. Wie lange Adcash Daten und
              Cookies aufbewahrt, legt Adcash fest; die Angaben stehen in Abschnitt 5 der{" "}
              <a href="https://adcash.com/legal/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">Rechtstexte von Adcash</a>.
            </p>
            <p>
              <strong className="text-foreground">Widerruf:</strong> Du kannst deine Einwilligung
              jederzeit mit Wirkung für die Zukunft widerrufen, über den Link „Cookie-Einstellungen“ in
              der Fußzeile jeder Seite. Kontexto entfernt dann die Einträge, die Adcash im lokalen
              Speicher unter kontexto.de abgelegt hat, und lädt die Seite ohne Adcash neu. Cookies, die
              Adcash unter eigenen Domains gesetzt hat, kann eine Website nicht löschen; die entfernst
              du in den Einstellungen deines Browsers.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-body font-semibold text-foreground">11. Vorgesehene Werbung durch Google AdSense</h2>
            <p>
              Für die geplante Finanzierung dieses kostenlosen Angebots ist Google AdSense vorgesehen,
              ein Dienst der <strong className="text-foreground">Google Ireland Limited</strong>, Gordon House,
              Barrow Street, Dublin 4, Irland („Google“). Im aktuellen Prüfmodus ist der
              Verifizierungscode eingebunden, es werden jedoch keine Anzeigenslots ausgeliefert.
            </p>
            <p>
              <strong className="text-foreground">Drittanbieter-Cookies:</strong> Falls Anzeigen
              freigeschaltet und ausgeliefert werden, können Drittanbieter, einschließlich Google,
              Cookies in deinem Browser setzen und lesen oder Web Beacons und IP-Adressen verwenden,
              um Informationen zu erheben. Google kann Cookies verwenden, um Anzeigen auf Grundlage
              früherer Besuche auf dieser und anderen Websites auszuliefern und deren Auslieferung zu
              messen. Neben Google können weitere Anbieter und Werbenetzwerke beteiligt sein, die
              über die Einwilligungsverwaltung namentlich aufgeführt werden. Verarbeitet werden dabei
              unter anderem deine gekürzte IP-Adresse, Geräte- und Browserdaten sowie Interaktionen
              mit Anzeigen.
            </p>
            <p>
              <strong className="text-foreground">Einwilligung (Consent Management Platform):</strong> Vor
              einer künftigen Anzeigenauslieferung erhältst du über ein von Google bereitgestelltes,
              nach dem IAB Transparency &amp; Consent Framework (TCF, aktuell v2.3) zertifiziertes
              Einwilligungsbanner die Möglichkeit, der Verarbeitung zuzustimmen oder sie abzulehnen.
              Rechtsgrundlage ist deine Einwilligung gemäß <strong className="text-foreground">Art. 6 Abs. 1 lit. a DSGVO</strong>
              sowie § 25 Abs. 1 TDDDG.
            </p>
            <p>
              <strong className="text-foreground">Datenübermittlung in die USA:</strong> Im Rahmen einer
              AdSense-Auslieferung können Daten an Server von Google übermittelt werden, auch an
              Server in den USA. Google ist unter dem EU-US Data Privacy Framework zertifiziert. Ein
              Zugriff durch US-Behörden kann dabei nicht vollständig ausgeschlossen werden. Mit deiner
              Einwilligung willigst du auch in diese Übermittlung gemäß Art. 49 Abs. 1 lit. a DSGVO ein.
            </p>
            <p>
              <strong className="text-foreground">Widerruf und Deaktivierung:</strong> Du kannst deine Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen oder anpassen, indem du deine Auswahl im Einwilligungsbanner änderst. Dafür genügt der Link „Cookie-Einstellungen“ in der Fußzeile jeder Seite. Unabhängig davon kannst du personalisierte Werbung dauerhaft abschalten:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                in den{" "}
                <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">Google-Anzeigeneinstellungen</a>{" "}
                für die Anzeigen von Google,
              </li>
              <li>
                gesammelt für viele Anbieter über{" "}
                <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">www.aboutads.info/choices</a>{" "}
                und{" "}
                <a href="https://www.youronlinechoices.com/de/praferenzmanagement/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">youronlinechoices.com</a>{" "}
                (europäische Fassung),
              </li>
              <li>
                oder einzeln auf den Websites der jeweiligen Anbieter und Werbenetzwerke, die in der Einwilligungsverwaltung aufgeführt sind.
              </li>
            </ul>
            <p>
              Ohne Einwilligung werden keine werbebezogenen Cookies gesetzt und es werden keine personalisierten Anzeigen ausgeliefert. Das Spiel bleibt in vollem Umfang nutzbar.
            </p>
            <p>
              Weitere Informationen findest du in der{" "}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">Datenschutzerklärung von Google</a>{" "}sowie unter{" "}
              <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">„Wie Google Daten bei der Anzeigenschaltung verwendet“</a>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-body font-semibold text-foreground">12. Minderjährige</h2>
            <p>
              Kontexto richtet sich an ein allgemeines Publikum und ist kein Angebot, das sich gezielt an Kinder wendet. Zum Spielen ist keine Anmeldung nötig. Wir fragen weder nach Name, Alter, E-Mail-Adresse noch Anschrift und erheben wissentlich keine personenbezogenen Daten von Kindern unter 16 Jahren.
            </p>
            <p>
              Die einzige freie Eingabe, die für andere sichtbar wird, ist der Spitzname in den Mehrspieler-Modi. Wir weisen dort ausdrücklich darauf hin, keinen echten Namen zu verwenden. Werbung lädt Kontexto nur, wenn im Einwilligungsbanner „Akzeptieren“ gewählt wurde. Für die Inhalte der Anzeigen sind die Werbekunden und Adcash verantwortlich. Meldest du uns über die Kontaktseite eine unpassende Anzeige, geben wir sie an Adcash weiter und schließen sie für Kontexto aus, soweit Adcash das zulässt.
            </p>
            <p>
              Erziehungsberechtigte, die vermuten, dass ein Kind uns personenbezogene Daten übermittelt hat, erreichen uns über die{" "}
              <Link href="/kontakt/" className="underline underline-offset-2 hover:no-underline">Kontaktseite</Link>. Wir löschen solche Daten unverzüglich.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-body font-semibold text-foreground">13. Deine Rechte</h2>
            <p>
              Du hast gemäß DSGVO das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung deiner Daten, das Recht auf Datenübertragbarkeit, das Recht auf Widerruf erteilter Einwilligungen sowie das Recht auf Beschwerde bei einer Aufsichtsbehörde. Gegen Verarbeitungen, die auf einem berechtigten Interesse beruhen (Art. 6 Abs. 1 lit. f DSGVO), steht dir zudem das Widerspruchsrecht nach Art. 21 DSGVO zu.
            </p>
            <p>
              Über die kurzfristigen Server-Logs (Abschnitt „Server-Logdaten“) und die mit deiner Einwilligung durch Adcash (Abschnitt „Werbung durch Adcash“) oder künftig durch Google AdSense (Abschnitt „Vorgesehene Werbung durch Google AdSense“) verarbeiteten Daten hinaus speichert Kontexto selbst nur die Daten einer laufenden Mehrspieler-Runde (Abschnitt „Mehrspieler-Modi“), und auch diese nur bis zu ihrer automatischen Löschung. Ein Nutzerkonto, ein Profil oder eine dauerhafte Kennung entsteht dabei nicht. Für die durch Adcash verarbeiteten Daten ist Adcash (mit-)verantwortlich, für die im Rahmen von Google AdSense verarbeiteten Daten Google; die entsprechenden Betroffenenrechte kannst du auch direkt beim jeweiligen Anbieter geltend machen.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-body font-semibold text-foreground">14. Änderungen</h2>
            <p>
              Diese Datenschutzerklärung kann gelegentlich aktualisiert werden. Die aktuelle Version ist stets auf dieser Seite abrufbar.
            </p>
          </section>
      </>

      <p className="text-micro">Stand: September 2026</p>
    </TextPage>
  );
}
