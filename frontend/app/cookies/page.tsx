import Link from "next/link";
import ArticleLayout from "@/components/content/ArticleLayout";
import Prose from "@/components/content/Prose";
import ComparisonTable from "@/components/content/ComparisonTable";
import Reveal from "@/components/motion/Reveal";
import { RelatedLinks } from "@/components/seo/SeoPrimitives";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/cookies/",
  title: "Cookies und lokaler Speicher",
  description:
    "Vollständige Aufstellung: welche Daten Kontexto im Browser ablegt, wofür, wie lange, und welche Cookies überhaupt gesetzt werden. Mit Anleitung zum Löschen.",
});

/**
 * Cookies und lokaler Speicher.
 *
 * Bewusst keine Wiederholung der Datenschutzerklaerung: Die erklaert die
 * Rechtsgrundlagen, diese Seite zaehlt konkret auf, was im Browser landet, mit
 * Schluessel, Zweck und Lebensdauer. Genau diese Aufstellung fehlt in der
 * Datenschutzerklaerung, und genau danach sucht, wer wissen will, was eine
 * Seite auf seinem Geraet ablegt.
 *
 * Die Tabelleninhalte stammen aus den tatsaechlich verwendeten Schluesseln in
 * lib/storage.ts, lib/wordle-storage.ts und den Feature-Discovery-Hooks. Wer
 * einen Schluessel hinzufuegt, ergaenzt ihn hier.
 */
export default function CookiesPage() {
  return (
    <ArticleLayout
      title="Cookies und lokaler Speicher"
      lead="Was Kontexto auf deinem Gerät ablegt, wofür, wie lange, und wie du es wieder löschst. Vollständig und nach Zweck sortiert."
      breadcrumbName="Cookies"
      path="/cookies/"
      toc={[
        { id: "kurz", label: "Die Kurzfassung" },
        { id: "spiel", label: "Was das Spiel speichert" },
        { id: "kofi", label: "Cookies von Ko-fi" },
        { id: "keine", label: "Was nicht gespeichert wird" },
        { id: "loeschen", label: "Alles löschen" },
      ]}
    >
      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="kurz">Die Kurzfassung</h2>
          <p>
            Für das Spiel selbst setzt Kontexto <strong>keine Cookies</strong>. Alles, was das Spiel
            sich merkt, liegt im lokalen Speicher deines Browsers, verlässt dein Gerät nicht und
            gehört zu keinem Konto. Werbung gibt es keine, und damit auch keine Werbe-Cookies.
            Cookies eines anderen Anbieters entstehen nur, wenn du selbst das Fenster „Kontexto
            unterstützen“ öffnest, und dann setzt sie Ko-fi.
          </p>
          <p>
            Der Unterschied ist nicht nur juristisch: Ein Cookie wird bei jeder Anfrage an den Server
            mitgeschickt, ein Eintrag im lokalen Speicher nicht. Deshalb bekommt unser Server
            deinen Spielstand nie zu sehen.
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="spiel">Was das Spiel im Browser speichert</h2>
          <p>
            Alle folgenden Einträge liegen im <code>localStorage</code>. Sie sind an den Browser
            gebunden, in dem du spielst, und bleiben dort, bis du sie löschst. Es gibt keine
            Ablauffrist, weil es nichts abzulaufen gibt: Kein Eintrag enthält eine Kennung, die dich
            wiedererkennbar macht.
          </p>
        </Prose>
        <ComparisonTable
          columns={["Schlüssel", "Zweck", "Inhalt"]}
          rows={[
            ["kontexto_state", "Laufende Kontexto-Partie", "Rätselnummer, geratene Wörter mit Rang, Zahl der Tipps, gelöst oder nicht"],
            ["kontexto_stats", "Deine Statistik", "Zahl der gespielten und gelösten Rätsel, Verteilung der Versuche"],
            ["kontexto_streak", "Serie", "Zahl der Tage in Folge mit gelöstem Rätsel"],
            ["kontexto_theme", "Darstellung", "hell oder dunkel"],
            ["kontexto_difficulty", "Tipp-Stufe", "leicht, mittel oder schwer"],
            ["kontexto_sort", "Sortierung der Rateliste", "nach Rang oder nach Eingabereihenfolge"],
            ["kontexto_infinite", "Unendlich-Modus", "welche Rätsel du dort schon gespielt hast"],
            ["wordle_state", "Laufende Wördle-Partie", "Rätselnummer, eingegebene Wörter, Farben je Buchstabe"],
            ["wordle_stats", "Wördle-Statistik", "gespielte und gelöste Rätsel, Verteilung der Versuche"],
            ["wordle_hard_mode", "Wördle-Einstellung", "schwerer Modus an oder aus"],
            ["kontexto_duel_*", "Mehrspieler-Zuordnung", "zufällige Kennung, mit der dein Browser sich einer laufenden Runde wieder zuordnet"],
            ["*_discovered", "Hinweise auf neue Funktionen", "ob du einen Hinweis schon gesehen hast"],
          ]}
          caption="Einträge im lokalen Speicher, ihr Zweck und ihr Inhalt"
        />
        <Prose>
          <p>
            Die Folge dieser Bauweise steht auch in der <Link href="/faq/">FAQ</Link>: Der Spielstand
            wandert nicht mit. Wer vom Telefon an den Rechner wechselt, beginnt das laufende Rätsel
            dort neu. Das ist der Preis dafür, dass es kein Konto gibt.
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="kofi">Cookies von Ko-fi</h2>
          <p>
            Kontexto zeigt keine Werbung und bindet kein Werbenetzwerk ein. Wer das Spiel
            unterstützen möchte, kann das freiwillig über Ko-fi tun.
          </p>
          <p>
            Der Knopf „Unterstützen“ öffnet ein Fenster, in dem die Seite von Ko-fi
            eingebettet ist. Solange du das Fenster nicht öffnest, lädt Kontexto nichts von Ko-fi
            und auf deinem Gerät landet nichts von dort. Erst mit dem Öffnen ruft dein Browser die
            Seite von Ko-fi ab, und Ko-fi kann dabei eigene Cookies setzen, etwa um die Zahlung
            abzuwickeln oder sich vor Missbrauch zu schützen. Diese Cookies gehören zu ko-fi.com,
            nicht zu kontexto.de, und wir können sie weder lesen noch steuern.
          </p>
          <p>
            Wer das nicht möchte, öffnet das Fenster einfach nicht: Das Spiel funktioniert ohne
            Einschränkung weiter. Was Ko-fi speichert, steht in der Datenschutzerklärung von Ko-fi,
            der Verweis darauf und die Rechtsgrundlage in unserer{" "}
            <Link href="/datenschutz/">Datenschutzerklärung</Link>.
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="keine">Was nicht gespeichert wird</h2>
          <ul>
            <li>Keine Sitzungs-Cookies, keine Anmelde-Cookies, keine Nutzerkonten.</li>
            <li>
              Keine Analyse-Cookies. Die Reichweitenmessung läuft cookiefrei auf unserem eigenen
              Server über einen nicht umkehrbaren Hashwert, aus dem sich keine Person
              wiederherstellen lässt.
            </li>
            <li>Keine Werbe-Cookies und keine Cookies von Schriftarten. Die Schrift wird von unserem Server ausgeliefert.</li>
            <li>Keine geräteübergreifende Wiedererkennung, weil es nichts gibt, woran sie ansetzen könnte.</li>
          </ul>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="loeschen">Alles löschen</h2>
          <p>
            Der lokale Speicher lässt sich in jedem Browser über die Website-Einstellungen leeren,
            meist unter „Cookies und Websitedaten“ für kontexto.de. Damit sind Spielstand,
            Statistik und Serie weg, und zwar endgültig: Es gibt keine Serverkopie, aus der sich das
            wiederherstellen ließe.
          </p>
          <p>
            Cookies, die Ko-fi gesetzt hat, löschst du über die Website-Einstellungen für
            ko-fi.com, nicht für kontexto.de.
          </p>
        </Prose>
      </Reveal>

      <RelatedLinks
        heading="Mehr entdecken"
        label="Verwandte Seiten"
        links={[
          { href: "/datenschutz/", label: "Datenschutzerklärung" },
          { href: "/nutzungsbedingungen/", label: "Nutzungsbedingungen" },
          { href: "/redaktion/", label: "Redaktionelle Grundsätze" },
          { href: "/faq/", label: "Häufige Fragen" },
        ]}
      />
    </ArticleLayout>
  );
}
