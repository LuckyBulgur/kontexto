import Link from "next/link";
import ArticleLayout from "@/components/content/ArticleLayout";
import Prose from "@/components/content/Prose";
import VectorSpaceDiagram from "@/components/content/VectorSpaceDiagram";
import Reveal from "@/components/motion/Reveal";
import { RelatedLinks } from "@/components/seo/SeoPrimitives";
import { buildMetadata } from "@/lib/seo";
import { AUTHOR_NAME } from "@/lib/author";

export const metadata = buildMetadata({
  path: "/ueber/",
  title: "Über Kontexto: das deutsche Contexto",
  description:
    "Was Kontexto ist, wie fastText-Worteinbettungen die Bedeutungsähnlichkeit berechnen, welche Entscheidungen hinter dem Spiel stehen und wer es entwickelt. Kostenlos und auf Deutsch.",
});

const toc = [
  { id: "was-ist", label: "Was ist Kontexto?" },
  { id: "technik", label: "Wie die Ähnlichkeit entsteht" },
  { id: "entscheidungen", label: "Drei Entscheidungen" },
  { id: "grenzen", label: "Wo das Spiel an Grenzen stößt" },
  { id: "mission", label: "Warum es das Spiel gibt" },
  { id: "wer", label: "Wer dahintersteht" },
  { id: "kontakt", label: "Datenschutz und Kontakt" },
];

export default function UeberPage() {
  return (
    <ArticleLayout
      title="Über Kontexto"
      lead="Kontexto ist die deutsche Version des Wortspiels Contexto: ein tägliches Ratespiel, bei dem nicht Buchstaben zählen, sondern Bedeutung."
      breadcrumbName="Über"
      path="/ueber/"
      toc={toc}
    >
      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="was-ist">Was ist Kontexto?</h2>
          <p>
            Jeden Tag erscheint um Mitternacht ein neues geheimes Wort, und alle Spielenden suchen
            dasselbe. Du hast unbegrenzt viele Versuche, stehst unter keinem Zeitdruck und musst
            nirgendwo ein Konto anlegen. Das Spiel ist vollständig kostenlos, dein Spielstand wird
            ausschließlich lokal in deinem Browser gespeichert.
          </p>
          <p>
            Im Unterschied zu buchstabenbasierten Spielen wie <Link href="/wordle/">Wördle</Link>
            {" "}dreht sich Kontexto um <strong>Bedeutung</strong>: Je ähnlicher ein eingetipptes Wort
            dem Zielwort im sprachlichen Kontext ist, desto kleiner ist sein Rang. Rang&nbsp;1 ist
            das Zielwort selbst, wer es eingibt, hat gewonnen. Wie sich Kontexto von verwandten
            Spielen abgrenzt, zeigt der <Link href="/vergleich/">große Spielvergleich</Link>.
          </p>
          <p>
            Neben dem täglichen Einzelspiel gibt es einen Unendlich-Modus für zusätzliche Partien,
            ein Duell gegen Freunde und einen Koop-Modus mit geteilter Rateliste. Alle
            Mehrspieler-Modi laufen über einen geteilten Link, ohne Anmeldung.
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="technik">Wie die Ähnlichkeit entsteht</h2>
          <p>
            Grundlage sind <Link href="/glossar/#fasttext">fastText-Worteinbettungen</Link>, ein von
            Meta AI Research entwickeltes Verfahren, dessen deutsches Modell auf Common Crawl und
            der deutschen Wikipedia trainiert wurde. Jedes Wort wird dabei auf einen Vektor aus 300
            Zahlen abgebildet. Je ähnlicher zwei Wörter in ihrem sprachlichen Kontext auftreten,
            desto näher liegen ihre Vektoren im{" "}
            <Link href="/glossar/#vektorraum">Vektorraum</Link> beieinander.
          </p>
        </Prose>
        <VectorSpaceDiagram />
        <Prose>
          <p>
            Die Reihenfolge der Ränge ergibt sich aus der{" "}
            <Link href="/glossar/#kosinus-aehnlichkeit">Kosinus-Ähnlichkeit</Link> zwischen dem
            Vektor deines Worts und dem des Zielworts. Es zählt also die Bedeutung im Kontext, nicht
            die Schreibweise: „Hund“ liegt nah bei „Katze“ oder „Haustier“, aber weit von
            „Hundert“, obwohl „Hundert“ dieselben Anfangsbuchstaben hat.
          </p>
          <p>
            Ein Zwischenschritt ist dabei entscheidend und in kaum einem vergleichbaren Spiel
            dokumentiert: Rohe Wortvektoren tragen einen gemeinsamen Drift, der vor allem
            Worthäufigkeit kodiert. Ohne Korrektur lägen häufige Allerweltswörter bei jedem
            beliebigen Zielwort weit vorne, und der Rang würde messen, wie gebräuchlich dein Wort
            ist statt wie passend. Kontexto entfernt diesen Anteil vorab, siehe{" "}
            <Link href="/blog/all-but-the-top-vektoren-entzerren/">
              All-but-the-Top: warum wir die Wortvektoren entzerren
            </Link>
            .
          </p>
          <p>
            Zur Laufzeit rechnet das Spiel nichts. Alle Ränge sind vorberechnet, ein Rateversuch ist
            ein Tabellenzugriff. Der vollständige Weg vom Sprachmodell zum fertigen Rätsel steht in{" "}
            <Link href="/blog/wie-das-loesungswort-entsteht/">Wie das Lösungswort entsteht</Link>.
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="entscheidungen">Drei Entscheidungen, die das Spiel prägen</h2>
          <p>
            <strong>Unbegrenzte Versuche.</strong> Bei einem Buchstabenspiel wäre ein Limit eine
            faire Härte, weil jeder Zug den Suchraum berechenbar verkleinert. Bei einem
            Bedeutungsspiel misst eine einzelne Eingabe nur eine Entfernung, aus der keine Richtung
            folgt. Ein Limit würde deshalb überwiegend messen, wie nah der eigene Assoziationsraum
            zufällig am Zielwort liegt.
          </p>
          <p>
            <strong>Ein Wort pro Tag für alle.</strong> Das macht aus einem Einzelspiel ein
            gemeinsames. Der Preis dafür ist, dass es kein durchsuchbares Archiv vergangener
            Lösungen gibt.
          </p>
          <p>
            <strong>Kein Konto.</strong> Für ein Spiel, das fünf Minuten dauert, wäre jede
            Registrierung teurer als das Spiel selbst. Dafür hängen Streak und Statistik an dem
            Browser, in dem du spielst. Alle drei Punkte samt ihrer Nachteile stehen ausführlich in{" "}
            <Link href="/blog/spieldesign-unbegrenzte-versuche/">
              Warum Kontexto unbegrenzte Versuche hat
            </Link>
            .
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="grenzen">Wo das Spiel an Grenzen stößt</h2>
          <p>
            Das Modell bildet ab, wie über Dinge geschrieben wird, nicht wie sie sind. Daraus folgen
            drei Eigenheiten, die regelmäßig überraschen und die wir offen benennen, statt sie zu
            kaschieren.
          </p>
          <p>
            Gegenteile liegen nah beieinander, weil „heiß“ und „kalt“ in identischen Sätzen stehen.
            Mehrdeutige Wörter wie „Bank“ bekommen einen einzigen Kompromissvektor, der zu keiner
            ihrer Bedeutungen richtig gehört. Und weil fastText Wörter zusätzlich in Zeichenfolgen
            zerlegt, kann Buchstabenähnlichkeit einen kleinen Effekt haben, wo inhaltlich keiner
            besteht. Was das beim Spielen bedeutet, erklärt{" "}
            <Link href="/blog/warum-schlechter-rang/">
              Warum hat mein Wort einen schlechten Rang?
            </Link>
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="mission">Warum es das Spiel gibt</h2>
          <p>
            Kontexto soll zeigen, wie dicht die deutsche Sprache vernetzt ist, spielerisch, täglich
            und für alle frei zugänglich. Jede Partie ist ein kleines Training für das eigene
            Sprachgefühl: Du erkundest Bedeutungsfelder, entdeckst überraschende Verbindungen
            zwischen Wörtern und verstehst nebenbei, woran ein Sprachmodell Bedeutung festmacht.
          </p>
          <p>
            Dass das deutsche Original nicht bloß eine Übersetzung sein durfte, hat einen sachlichen
            Grund: Bedeutungsnähe ist sprachspezifisch. Ein englisches Modell weiß, was neben
            „vacation“ steht, nicht was neben „Urlaub“ steht. Dazu kommen deutsche Eigenheiten wie
            die unbegrenzte Wortzusammensetzung und die Großschreibung, die bei der Auswahl der
            Lösungswörter erhebliche Folgen hat.
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="wer">Wer dahintersteht</h2>
          <p>
            Kontexto ist ein unabhängiges, werbefinanziertes Projekt aus Deutschland. Entwickelt und
            gepflegt wird es von {AUTHOR_NAME}, ohne Verlag im Rücken und finanziert allein über
            Werbung, damit das Spiel für alle kostenlos bleibt. Er beschäftigt sich mit
            Worteinbettungen und natürlicher Sprachverarbeitung und schreibt im{" "}
            <Link href="/blog/">Blog</Link> über die Technik und Strategie hinter dem Spiel.
          </p>
          <p>
            Ein erheblicher Teil dessen, was heute funktioniert, geht auf Rückmeldungen zurück. Dass
            keine Eigennamen mehr als Lösung erscheinen, dass anstößige Wörter gesperrt sind und dass
            alte Rechtschreibvarianten keine unfairen Rätsel mehr erzeugen: alle drei Änderungen
            entstanden, weil jemand geschrieben hat. Nachzulesen im{" "}
            <Link href="/changelog/">Changelog</Link>.
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="kontakt">Datenschutz und Kontakt</h2>
          <p>
            Kontexto setzt Werbe- und Trackingcookies nur mit deiner Einwilligung. Die eingetippten
            Wörter werden zur Rangberechnung an den Server geschickt und nicht personenbezogen
            gespeichert. Es gibt keine Nutzerkonten und keine wiedererkennbaren Profile. Alle Details
            stehen in der <Link href="/datenschutz/">Datenschutzerklärung</Link>.
          </p>
          <p>
            Anregungen, Fehlermeldungen und Hinweise auf ungeeignete Lösungswörter sind ausdrücklich
            willkommen. Die Wege dorthin stehen auf der <Link href="/kontakt/">Kontaktseite</Link>,
            die Anbieterangaben im <Link href="/impressum/">Impressum</Link>.
          </p>
        </Prose>
      </Reveal>

      <RelatedLinks
        heading="Mehr erfahren"
        label="Verwandte Seiten"
        links={[
          { href: "/anleitung/", label: "Spielanleitung" },
          { href: "/glossar/", label: "Glossar der Begriffe" },
          { href: "/blog/", label: "Blog: Hintergründe und Strategien" },
          { href: "/changelog/", label: "Änderungen am Spiel" },
        ]}
      />
    </ArticleLayout>
  );
}
