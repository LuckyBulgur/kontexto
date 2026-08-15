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
    "Bewährte Kontexto-Strategien: die besten Startwörter, Themenfelder eingrenzen, Synonyme und Wortarten nutzen, Sackgassen erkennen und mit weniger Versuchen das Zielwort finden.",
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
      lead="Kontexto belohnt systematisches Denken, nicht schnelles Raten. Mit den folgenden Strategien kreist du das Zielwort mit deutlich weniger Versuchen ein, vom ersten Zug bis zum Treffer auf Rang 1."
      breadcrumbName="Strategie"
      path="/strategie/"
      toc={toc}
    >
      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="schnellstart">Schnellstart: drei Grundregeln</h2>
          <p>
            Wenn du nur drei Dinge mitnimmst, dann diese: Sie bringen dich in fast jedem Rätsel
            schnell voran.
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
            Der erste Zug entscheidet, wie schnell du das Themenfeld eingrenzt. Gute Startwörter
            sind <strong>häufig, thematisch breit und semantisch zentral</strong>. Sie haben in
            deutschen Texten viele Berührungspunkte und liefern deshalb auch dann ein Signal, wenn
            das Zielwort aus einem ganz anderen Bereich kommt. Spezialbegriffe sind dagegen
            schlechte Startwörter: Sie helfen nur, wenn das Zielwort zufällig genau in ihrem engen
            Umfeld liegt.
          </p>
        </Prose>
        <ComparisonTable
          columns={["Wort", "Signal unter Rang 1500", "Begründung"]}
          rows={[
            ["gehen", <span key="1" className="text-green-600 dark:text-green-400">13,2 %</span>, "Bestes Startwort im Test. Verben passen in Sätze zu fast jedem Thema."],
            ["arbeit", <span key="2" className="text-green-600 dark:text-green-400">11,9 %</span>, "Bestes Substantiv im Test. Verbindet Tätigkeit, Technik, Wirtschaft und Alltag."],
            ["sehen", <span key="3" className="text-green-600 dark:text-green-400">11,0 %</span>, "Zweites Verb aus einer anderen Handlungsrichtung."],
            ["zeit", <span key="4" className="text-green-600 dark:text-green-400">10,3 %</span>, "Öffnet die abstrakt-zeitliche Richtung."],
            ["mensch", <span key="5" className="text-yellow-600 dark:text-yellow-500">5,6 %</span>, "Wirkt breit, ist gemessen aber nur Mittelfeld."],
            ["wasser", <span key="6" className="text-red-600 dark:text-red-400">2,6 %</span>, "Fühlt sich breit an, meint aber fast immer buchstäblich Flüssigkeit."],
            ["thermodynamik", <span key="7" className="text-red-600 dark:text-red-400">2,2 %</span>, "Sehr enger Kontext, nützt nur bei Physik-Wörtern."],
          ]}
          caption="Gemessen über alle 2.400 Rätsel: Anteil der Partien, in denen das Wort einen Rang unter 1500 erreicht"
        />
        <Callout variant="tip" title="Eine Routine aufbauen">
          Leg dir vier feste Startwörter zurecht und spiele sie jeden Tag zuerst, das spart Denkzeit.
          Gemessen am besten schneiden „gehen“, „arbeit“, „sehen“ und „zeit“ ab. Die vollständige
          Auswertung über alle 2.400 Rätsel steht im{" "}
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
            Die Worteinbettungen unterscheiden nicht zwischen Nomen, Verben und Adjektiven,
            entscheidend ist der Kontext, nicht die grammatische Form. Liegt ein Nomen nah am
            Zielwort, können das zugehörige Verb oder Adjektiv noch näher liegen. Findest du mit
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
            Wenn mehrere verwandte Wörter allesamt rote Ränge (ab 1501) liefern, ist das ein
            klares Signal: Das ganze Themenfeld führt nicht zum Ziel. Verharre nicht dort. Jeder
            weitere Versuch in einer Sackgasse kostet Zeit ohne Erkenntnisgewinn. Kehre zu einem
            breiten Startwort aus einem anderen Bereich zurück und beginne die Eingrenzung neu.
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
            <Link href="/blog/haeufige-fehler-bei-kontexto/">7 häufige Fehler bei Kontexto</Link>.
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
            Danach weißt du nicht nur, welche Achse zählt, sondern auch welche nicht. Der Sprung von
            Rang 380 auf Rang 95 kommt fast immer vom Achsenwechsel und nicht vom besseren Synonym.
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
            ausgeht. Wenn du weißt, welche, kannst du steuern, wie viel Information du bekommst.
          </p>
          <ul>
            <li>
              <strong>Leicht</strong> halbiert deinen besten Rang. Richtig, wenn du bei Rang 3.000
              oder schlechter feststeckst und überhaupt erst einen Halt im Bedeutungsraum brauchst.
            </li>
            <li>
              <strong>Mittel</strong> liefert das Wort unmittelbar vor deinem besten. Das klingt nach
              wenig und ist der wertvollste Modus zwischen Rang 100 und 500, weil dir der direkte
              Nachbar die Richtung innerhalb des Feldes verrät.
            </li>
            <li>
              <strong>Schwer</strong> zieht eine Zufallszahl zwischen 2 und deinem besten Rang. Ein
              Los, für alle, denen ein berechenbarer Tipp den Reiz nimmt.
            </li>
          </ul>
          <p>
            Unter Rang 20 lohnt sich kein Tipp mehr. Lies stattdessen deine besten fünf Treffer noch
            einmal durch und frage dich, welches einzelne Konzept sie gemeinsam umkreisen. Die
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
            Kandidaten ab und vertraue darauf, dass du das Wort mit jedem grünen Treffer enger
            einkreist. Wer methodisch vorgeht, schlägt Zufallsrater regelmäßig mit deutlich weniger
            Versuchen.
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
