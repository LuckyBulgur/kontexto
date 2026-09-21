import Link from "next/link";
import ArticleLayout from "@/components/content/ArticleLayout";
import Prose from "@/components/content/Prose";
import ComparisonTable from "@/components/content/ComparisonTable";
import Callout from "@/components/content/Callout";
import Reveal from "@/components/motion/Reveal";
import { RelatedLinks } from "@/components/seo/SeoPrimitives";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/strategie/",
  title: "Strategie und Tipps: Kontexto schneller lösen",
  description:
    "Praktische Kontexto-Strategien: Startwörter vergleichen, Themenfelder eingrenzen, Synonyme und Wortarten nutzen und Sackgassen rechtzeitig verlassen.",
});

const toc = [
  { id: "schnellstart", label: "Schnellstart: drei Grundregeln" },
  { id: "startwoerter", label: "Die besten Startwörter" },
  { id: "eingrenzen", label: "Themenfeld systematisch eingrenzen" },
  { id: "wortarten", label: "Synonyme und Wortarten variieren" },
  { id: "sackgassen", label: "Sackgassen erkennen und verlassen" },
  { id: "fehler", label: "Häufige Fehler vermeiden" },
  { id: "richtungen", label: "Richtungen messen statt Synonyme" },
  { id: "tipp", label: "Den Tipp gezielt einsetzen" },
  { id: "geduld", label: "Geduld schlägt Zufall" },
];

export default function StrategiePage() {
  return (
    <ArticleLayout
      title="Strategie & Tipps"
      lead="Kontexto belohnt systematisches Denken, nicht schnelles Raten. Die folgenden Strategien helfen dir, vom ersten Zug an Informationen zu sammeln und das Zielwort gezielter einzugrenzen."
      breadcrumbName="Strategie"
      path="/strategie/"
      toc={toc}
    >
      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="schnellstart">Schnellstart: drei Grundregeln</h2>
          <p>
            Wenn du nur drei Dinge mitnimmst, dann diese: Sie geben dir in vielen Rätseln einen
            klaren Startpunkt.
          </p>
          <ol>
            <li><strong>Breit beginnen:</strong> Starte mit häufigen Alltagswörtern, die viele Themen berühren. Sie verraten dir früh die Richtung.</li>
            <li><strong>Der Spur folgen:</strong> Jeder gute Treffer ist ein Wegweiser. Arbeite dich von grünen und gelben Rängen aus weiter vor.</li>
            <li><strong>Beweglich bleiben:</strong> Wechsle Themenfeld oder Wortart, sobald eine Spur nicht mehr besser wird.</li>
          </ol>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="startwoerter">Die besten Startwörter</h2>
          <p>
            Der erste Zug entscheidet, welche Information du überhaupt sammelst. Gute Startwörter
            sind <strong>häufig, thematisch breit und semantisch zentral</strong>. Sie haben in
            deutschen Texten viele Berührungspunkte und können deshalb auch dann eine Richtung
            anzeigen, wenn das Zielwort aus einem ganz anderen Bereich kommt. Spezialbegriffe sind
            dagegen als Eröffnung oft unpraktisch: Sie helfen vor allem dann, wenn das Zielwort in
            ihrem engen Umfeld liegt. Unser Benchmark misst dabei einzelne Wörter, nicht den Erfolg
            einer kompletten Vierer-Eröffnung.
          </p>
        </Prose>
        <ComparisonTable
          columns={["Wort", "Signal unter Rang 1500", "Begründung"]}
          rows={[
            ["gehen", <span key="1" className="text-rank-near-ink">13,2 %</span>, "Stärkstes Einzelwort im Test; es deckt viele Handlungskontexte ab."],
            ["machen", <span key="2" className="text-rank-near-ink">12,8 %</span>, "Ebenfalls ein starkes Verb im getesteten Kandidatenfeld."],
            ["arbeit", <span key="3" className="text-rank-near-ink">11,9 %</span>, "Stärkstes Substantiv im Test; verbindet mehrere Alltagsbereiche."],
            ["sehen", <span key="4" className="text-rank-near-ink">11,0 %</span>, "Verb aus einer anderen Handlungsrichtung."],
            ["bauen", <span key="5" className="text-rank-near-ink">11,0 %</span>, "Weiteres starkes Verb mit eigenem Kontext."],
            ["zeit", <span key="6" className="text-rank-near-ink">10,3 %</span>, "Öffnet die abstrakt-zeitliche Richtung."],
            ["mensch", <span key="7" className="text-rank-mid-ink">5,6 %</span>, "Wirkt breit, ist gemessen aber nur Mittelfeld."],
            ["wasser", <span key="8" className="text-rank-far-ink">2,6 %</span>, "Fühlt sich breit an, liefert im Test aber selten ein frühes Signal."],
            ["thermodynamik", <span key="9" className="text-rank-far-ink">2,2 %</span>, "Sehr enger Kontext, nützt vor allem bei Physik-Wörtern."],
          ]}
          caption="Gemessen über alle 2.400 Rätsel: Anteil der Rätsel, in denen das Wort einen Rang unter 1500 erreicht"
        />
        <Callout variant="tip" title="Eine Routine aufbauen">
          Leg dir vier feste Startwörter zurecht und spiele sie jeden Tag zuerst, das spart Denkzeit.
          Eine praktische, breit gemischte Routine ist „gehen“, „arbeit“, „sehen“ und „zeit“. Diese
          Kombination ist nicht separat vermessen; die Einzelwerte zeigen nur, wie oft jedes Wort
          für sich ein Signal unter Rang 1500 liefert. Die vollständige Auswertung über alle 2.400
          Rätsel steht im{" "}
          <Link href="/blog/startwort-benchmark/">Startwort-Benchmark</Link>, die Einordnung in{" "}
          <Link href="/blog/beste-startwoerter/">Die besten Startwörter für Kontexto</Link>.
        </Callout>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="eingrenzen">Themenfeld systematisch eingrenzen</h2>
          <p>
            Sobald ein Wort einen guten Rang liefert (grün oder gelb), wechselst du zur
            Nachbarschaftsstrategie: Taste die verschiedenen Richtungen ab, die von deinem
            bisherigen Spitzentreffer wegführen. Liegt „Küste“ auf Rang 80, lohnen sich Sonden aus
            unterschiedlichen Ecken des Feldes wie „Strand“, „Hafen“, „Welle“ und „Ebbe“, je eine
            pro Richtung statt vier Synonyme derselben Idee.
          </p>
          <p>
            Die <Link href="/glossar/#kosinus-aehnlichkeit">Kosinus-Ähnlichkeit</Link> der
            <Link href="/glossar/#worteinbettung"> Worteinbettungen</Link> folgt dem sprachlichen
            Kontext: Wörter, die in ähnlichen Sätzen vorkommen, liegen im{" "}
            <Link href="/glossar/#vektorraum">Vektorraum</Link> nah beieinander. Arbeite dich mit
            jedem neuen Treffer ein Stück tiefer in das Themenfeld vor, statt wild zu springen.
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="wortarten">Synonyme und Wortarten variieren</h2>
          <p>
            Die Rangberechnung verwendet keine eigene Regel, die Nomen, Verben und Adjektive
            getrennt behandelt; entscheidend ist der gelernte Kontext. Liegt ein Nomen nah am
            Zielwort, können das zugehörige Verb oder Adjektiv deshalb noch näher liegen. Findest du mit
            ähnlichen Nomen keinen besseren Treffer, wechsle die Wortart: aus „Reise“ wird
            „reisen“, aus „Dunkelheit“ wird „dunkel“ oder „finster“.
          </p>
          <p>
            Wichtig ist dabei der Unterschied zwischen Wortartwechsel und bloßem Synonym. „Freude“ gegen
            „Glück“ auszutauschen misst fast dieselbe Stelle noch einmal. „Freude“ gegen „lachen“
            oder „fröhlich“ einzutauschen wechselt das Satzmuster und damit die gemessene Richtung.
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="sackgassen">Sackgassen erkennen und verlassen</h2>
          <p>
            Wenn mehrere verwandte Wörter allesamt rote Ränge (ab 1501) liefern, ist das ein Anlass,
            das Feld nicht weiter zu verfeinern. Die einzelnen Werte beweisen nicht, dass jedes Wort
            dieses Feldes ausgeschlossen ist. Kehre zu einem breiten Startwort aus einem anderen
            Bereich zurück und beginne die Eingrenzung neu.
          </p>
        </Prose>
        <Callout variant="warning" title="Typische Falle">
          Nicht am ersten halbwegs guten Themenfeld festbeißen. Ein gelber Rang heißt „wärmer“,
          aber nicht „richtige Richtung garantiert“. Prüfe ruhig zwei oder drei Felder parallel.
        </Callout>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="fehler">Häufige Fehler vermeiden</h2>
          <ul>
            <li><strong>Nur Nomen testen:</strong> Das Zielwort kann ein Verb oder Adjektiv sein. Variiere die Wortart.</li>
            <li><strong>Auf Buchstaben achten:</strong> Schreibweise ist egal. „Hund“ und „Hundert“ haben nichts miteinander zu tun.</li>
            <li><strong>Zu früh aufgeben:</strong> Es gibt kein Versuchslimit. Ein roter Rang ist kein Misserfolg, sondern Information.</li>
            <li><strong>Auf Eigennamen setzen:</strong> Häufige Namen sind zwar ratbar, aber nie die Lösung; seltene fehlen im Wortschatz.</li>
          </ul>
          <p>
            Eine ausführliche Fehleranalyse mit Beispielen liest du im Artikel{" "}
            <Link href="/blog/haeufige-fehler-bei-kontexto/">10 häufige Fehler bei Kontexto</Link>.
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="richtungen">Richtungen messen statt Synonyme sammeln</h2>
          <p>
            Der teuerste Reflex im ganzen Spiel: Ein Wort liegt gut, also probiert man seine
            Synonyme. Liegt „Wasser“ auf Rang 380, kommen „Flüssigkeit“, „nass“, „feucht“. Alle drei
            liegen in derselben Ecke des Vektorraums wie „Wasser“, weil sie in denselben Sätzen
            vorkommen. Ihre Ränge werden ähnlich ausfallen, und du hast drei Züge ausgegeben, um
            dieselbe Stelle ein drittes Mal zu vermessen.
          </p>
          <p>
            Nützlicher ist die Frage, welche <strong>Achsen</strong> von deinem besten Wort
            wegführen. Bei „Wasser“ sind das mindestens fünf, und sie führen weit auseinander:
            Gewässer, Wetter, Lebewesen im Wasser, Nutzung durch Menschen und Eigenschaft. Nimm aus
            jeder Achse genau ein Wort, etwa „Fluss“, „Regen“, „Fisch“, „trinken“, „nass“, und spiele
            diese fünf Züge, bevor du irgendetwas anderes tust.
          </p>
          <p>
            Danach hast du eine bessere Grundlage dafür, welche Achse weiter geprüft werden sollte.
            Ein Sprung von Rang 380 auf Rang 95 kann vom Achsenwechsel kommen und nicht nur vom
            besseren Synonym.
            Eine komplette Partie nach diesem Verfahren steht in{" "}
            <Link href="/blog/wenn-du-feststeckst/">Wenn du feststeckst</Link>.
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="tipp">Den Tipp gezielt einsetzen</h2>
          <p>
            Der Tipp ist keine Zufallshilfe, sondern eine Rechnung, die von deinem bisher besten Rang
            ausgeht. Wenn du weißt, welche Formel dahintersteckt, kannst du besser einschätzen, wie
            viel Information du bekommst.
          </p>
          <ul>
            <li>
              <strong>Leicht</strong> halbiert deinen besten Rang. Als praktische Heuristik kann das
              helfen, wenn du bei Rang 3.000 oder schlechter feststeckst und überhaupt erst einen
              Halt im Bedeutungsraum brauchst.
            </li>
            <li>
              <strong>Mittel</strong> liefert das Wort unmittelbar vor deinem besten. Das klingt nach
              wenig, kann aber zwischen Rang 100 und 500 als Kontrollfrage nützlich sein, weil dir
              der direkte Nachbar eine Richtung innerhalb des Feldes vorschlagen kann.
            </li>
            <li>
              <strong>Schwer</strong> zieht eine Zufallszahl zwischen 2 und knapp unter deinem besten
              Rang. Ein Los, für alle, denen ein berechenbarer Tipp den Reiz nimmt.
            </li>
          </ul>
          <p>
            Unter Rang 20 würde ich zunächst deine besten fünf Treffer noch einmal durchlesen und
            fragen, welches einzelne Konzept sie gemeinsam umkreisen. Ein Tipp kann trotzdem sinnvoll
            sein, wenn du festhängst. Die
            genauen Formeln stehen in{" "}
            <Link href="/blog/tipp-funktion-richtig-nutzen/">Die Tipp-Funktion</Link>.
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="geduld">Geduld schlägt Zufall</h2>
          <p>
            Kontexto hat absichtlich kein Versuchslimit. Zufälliges Raten bringt wenig,
            systematisches Erkunden des Bedeutungsraums bringt dich ans Ziel. Behandle jede Runde
            wie eine Landkarte: Notiere dir die besten Treffer, leite daraus gezielt die nächsten
            Kandidaten ab und prüfe mit jedem neuen Rang, ob deine Richtung trägt. Wer methodisch
            vorgeht, kann Zufallsraten vermeiden und seine Suche besser steuern.
          </p>
        </Prose>
      </Reveal>

      <RelatedLinks
        heading="Mehr zum Spiel"
        label="Verwandte Seiten"
        links={[
          { href: "/anleitung/", label: "Spielanleitung: die Grundlagen" },
          { href: "/blog/kontexto-tipps-schneller-gewinnen/", label: "12 Strategien für Kontexto-Profis" },
          { href: "/glossar/", label: "Glossar: fastText, Vektorraum und mehr" },
          { href: "/faq/", label: "Häufige Fragen (FAQ)" },
        ]}
      />
    </ArticleLayout>
  );
}
