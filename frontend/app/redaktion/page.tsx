import Link from "next/link";
import ArticleLayout from "@/components/content/ArticleLayout";
import Prose from "@/components/content/Prose";
import Reveal from "@/components/motion/Reveal";
import { RelatedLinks } from "@/components/seo/SeoPrimitives";
import { buildMetadata } from "@/lib/seo";
import { AUTHOR_NAME } from "@/lib/author";

export const metadata = buildMetadata({
  path: "/redaktion/",
  title: "Redaktionelle Grundsätze",
  description:
    "Wer die Texte auf kontexto.de schreibt, woher die veröffentlichten Zahlen stammen, wie Fehler korrigiert werden und warum Werbung und Inhalt hier strikt getrennt sind.",
});

/**
 * Redaktionelle Grundsaetze.
 *
 * Eine eigene Seite, weil "wer steht dahinter und wie entsteht das hier" eine
 * andere Frage ist als "was ist das Spiel" (/ueber/) oder "welche Daten werden
 * verarbeitet" (/datenschutz/). Sie beantwortet die Fragen, die ueber
 * Vertrauenswuerdigkeit entscheiden: Herkunft der Zahlen, Umgang mit Fehlern,
 * Unabhaengigkeit von Werbung.
 *
 * Jede Aussage hier ist im Repository nachpruefbar. Nichts davon ist eine
 * Absichtserklaerung.
 */
const toc = [
  { id: "wer", label: "Wer die Texte schreibt" },
  { id: "zahlen", label: "Woher die Zahlen stammen" },
  { id: "fehler", label: "Wie Fehler korrigiert werden" },
  { id: "werbung", label: "Trennung von Werbung und Inhalt" },
  { id: "nicht", label: "Was hier nicht passiert" },
];

export default function RedaktionPage() {
  return (
    <ArticleLayout
      title="Redaktionelle Grundsätze"
      lead="Wer die Texte schreibt, woher die Zahlen stammen, wie Fehler korrigiert werden und warum Werbung und Inhalt hier getrennt bleiben."
      breadcrumbName="Redaktion"
      path="/redaktion/"
      toc={toc}
    >
      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="wer">Wer die Texte schreibt</h2>
          <p>
            Alle Texte auf dieser Website stammen von {AUTHOR_NAME}, der Kontexto auch entwickelt.
            Es gibt keine Gastbeiträge, keine eingekauften Texte und keine anonymen Autoren. Jeder
            Blogbeitrag trägt seinen Namen, sein Veröffentlichungsdatum und, wenn er überarbeitet
            wurde, das Datum der Überarbeitung. Die Inhaltsseiten tragen ihr Datum der letzten
            inhaltlichen Überarbeitung im Seitenkopf.
          </p>
          <p>
            Verantwortlich im Sinne von § 18 Abs. 2 MStV ist dieselbe Person, mit ladungsfähiger
            Anschrift im <Link href="/impressum/">Impressum</Link>. Wer prüfen will, wer hier
            schreibt, findet die Profile bei GitHub und LinkedIn in der Fußzeile jeder Seite.
          </p>
          <p>
            Die Texte entstehen aus der Arbeit am Spiel selbst. Was hier über fastText, über die
            Entzerrung der Vektoren oder über die Auswahl der Lösungswörter steht, beschreibt den
            Code, der auf dieser Seite läuft, und nicht eine allgemeine Literaturlage. Wo ein
            Beitrag über den eigenen Bestand hinausgeht, steht die Quelle als Link im Text.
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="zahlen">Woher die Zahlen stammen</h2>
          <p>
            Auf dieser Website stehen an mehreren Stellen konkrete Zahlen: 868.000 Rateversuche,
            eine Lösungsquote von 71 Prozent, im Schnitt 85 Versuche je Lösung, ein
            Startwort-Benchmark über 2.400 Rätsel. Für diese Angaben gilt eine einfache Regel:
            <strong> Es wird nichts geschätzt und nichts gerundet, ohne die Rundung zu benennen.</strong>
          </p>
          <p>
            Die Spielzahlen werden serverseitig gezählt, nicht aus dem Browser gemeldet, und über
            ein offengelegtes Skript aus der Datenbank exportiert. Das Ergebnis liegt als Datei im
            Repository und wird beim Bauen der Website eingelesen. Methodik, Stichtag und die
            Gründe für die Rundung stehen vollständig unter{" "}
            <Link href="/zahlen/">Kontexto in Zahlen</Link>. Der Startwort-Benchmark ist auf
            dieselbe Art nachvollziehbar: Was gemessen wurde, mit welchen Kandidaten und mit
            welchem Kriterium, steht im{" "}
            <Link href="/blog/startwort-benchmark/">Beitrag zur Auswertung</Link>.
          </p>
          <p>
            Für die Zählung werden keine personenbezogenen Daten verwendet. Es gibt keine
            Nutzerprofile, keine Sitzungsaufzeichnung und keine wiedererkennbare Kennung. Wie das
            technisch gelöst ist, steht in der{" "}
            <Link href="/datenschutz/">Datenschutzerklärung</Link>.
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="fehler">Wie Fehler korrigiert werden</h2>
          <p>
            Fehler werden korrigiert und nicht stillschweigend überschrieben. Wer einen findet, sei
            es eine falsche Zahl, eine überholte Erklärung oder ein Lösungswort, das nicht hätte
            kommen dürfen, erreicht uns über die <Link href="/kontakt/">Kontaktseite</Link>.
          </p>
          <p>
            Änderungen am Spiel stehen mit Datum im <Link href="/changelog/">Changelog</Link>, auch
            die zurückgenommenen. Ein Archiv vergangener Lösungen und eine Sternebewertung gab es
            dort kurzzeitig, beide wurden wieder entfernt, und beides steht bis heute nachlesbar in
            der Liste. Ein Änderungsprotokoll, aus dem die Fehlschläge herausgeputzt sind, wäre
            keines.
          </p>
          <p>
            Ein erheblicher Teil dessen, was heute funktioniert, geht auf Hinweise von Spielenden
            zurück: dass keine Eigennamen mehr als Lösung erscheinen, dass anstößige Wörter
            gesperrt sind und dass alte Rechtschreibvarianten keine unfairen Rätsel mehr erzeugen.
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="werbung">Trennung von Werbung und Inhalt</h2>
          <p>
            Kontexto finanziert sich über Werbung. Damit das die Inhalte nicht berührt, gelten drei
            Festlegungen, die im Code verankert sind und nicht nur hier versprochen werden:
          </p>
          <ul>
            <li>
              Anzeigen laufen ausschließlich auf den beiden Einzelspieler-Seiten. Inhaltsseiten,
              Rechtsseiten und die Mehrspieler-Räume bleiben werbefrei.
            </li>
            <li>
              Jede Anzeigenfläche trägt sichtbar die Kennzeichnung „Anzeige“ und ist als eigener
              Bereich ausgezeichnet, auch für Screenreader.
            </li>
            <li>
              Werbe- und Trackingcookies werden erst nach ausdrücklicher Einwilligung gesetzt, die
              sich jederzeit über die Fußzeile widerrufen lässt.
            </li>
          </ul>
          <p>
            Es gibt keine bezahlten Beiträge, keine gesponserten Erwähnungen, keine Affiliate-Links
            und keine Produktempfehlungen gegen Vergütung. Kein Text auf dieser Website ist von
            Dritten beauftragt oder bezahlt. Wo andere Spiele genannt werden, etwa im{" "}
            <Link href="/vergleich/">Spielvergleich</Link>, geschieht das ohne geschäftliche
            Beziehung zu ihren Anbietern.
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="nicht">Was hier nicht passiert</h2>
          <p>
            Es gibt auf dieser Website keine automatisch erzeugten Massenseiten. Jede indexierte
            Seite ist einzeln geschrieben und hat einen eigenen Zweck. Es gibt keine
            Schlagwortseiten, keine Filterseiten und keine Seiten, die nur existieren, um eine
            Suchanfrage abzufangen.
          </p>
          <p>
            Es werden keine fremden Texte übernommen. Wo zitiert wird, steht die Quelle dabei.
            Nutzergenerierte Inhalte gibt es nicht: Das Einzige, was Spielende eingeben und andere
            sehen können, ist ein selbst gewählter Spitzname in einer Mehrspieler-Runde, und der
            wird zusammen mit der Runde automatisch gelöscht.
          </p>
          <p>
            Der Umfang eines Beitrags richtet sich nach dem Thema und nicht nach einer Wortzahl.
            Wenn eine Frage in vier Sätzen beantwortet ist, steht sie in der{" "}
            <Link href="/faq/">FAQ</Link> und nicht als aufgeblasener Beitrag im Blog.
          </p>
        </Prose>
      </Reveal>

      <RelatedLinks
        heading="Mehr entdecken"
        label="Verwandte Seiten"
        links={[
          { href: "/ueber/", label: "Über Kontexto" },
          { href: "/zahlen/", label: "Kontexto in Zahlen: Methodik" },
          { href: "/changelog/", label: "Änderungen am Spiel" },
          { href: "/kontakt/", label: "Kontakt und Fehlermeldung" },
          { href: "/nutzungsbedingungen/", label: "Nutzungsbedingungen" },
        ]}
      />
    </ArticleLayout>
  );
}
