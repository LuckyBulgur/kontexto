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
  title: "Strategie & Tipps – Kontexto schneller lösen",
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
  { id: "geduld", label: "Geduld schlägt Zufall" },
];

export default function StrategiePage() {
  return (
    <ArticleLayout
      title="Strategie & Tipps"
      lead="Kontexto belohnt systematisches Denken, nicht schnelles Raten. Mit den folgenden Strategien kreist du das Zielwort mit deutlich weniger Versuchen ein – vom ersten Zug bis zum Treffer auf Rang 1."
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
            <li><strong>Breit beginnen:</strong> Starte mit häufigen Alltagswörtern, die viele Themen berühren – sie verraten dir früh die Richtung.</li>
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
          columns={["Wort", "Eignung", "Begründung"]}
          rows={[
            ["Zeit", <span key="1" className="text-green-600 dark:text-green-400">sehr gut</span>, "Verbindet Geschichte, Physik, Alltag und Philosophie."],
            ["Wasser", <span key="2" className="text-green-600 dark:text-green-400">sehr gut</span>, "Zentral für Natur, Chemie, Küche und Geografie."],
            ["Mensch", <span key="3" className="text-green-600 dark:text-green-400">sehr gut</span>, "Taucht in fast jedem thematischen Feld auf."],
            ["Thermodynamik", <span key="4" className="text-red-600 dark:text-red-400">schlecht</span>, "Sehr enger Kontext – nützt nur bei Physik-Wörtern."],
            ["Quastenflosser", <span key="5" className="text-red-600 dark:text-red-400">schlecht</span>, "Selten und speziell; kaum Verbindungen zu anderen Wörtern."],
          ]}
          caption="Geeignete und ungeeignete Startwörter für Kontexto"
        />
        <Callout variant="tip" title="Eine Routine aufbauen">
          Leg dir drei bis vier feste Startwörter aus verschiedenen Bereichen zurecht (z. B.
          „Mensch“, „Natur“, „Technik“, „Gefühl“). So deckst du in den ersten Zügen verlässlich
          das halbe Bedeutungsspektrum ab. Mehr dazu im Artikel{" "}
          <Link href="/blog/beste-startwoerter/">Die besten Startwörter für Kontexto</Link>.
        </Callout>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="eingrenzen">Themenfeld systematisch eingrenzen</h2>
          <p>
            Sobald ein Wort einen guten Rang liefert (grün oder gelb), wechselst du zur
            Nachbarschaftsstrategie: Teste Synonyme, Ober- und Unterbegriffe sowie assoziierte
            Konzepte rund um deinen bisherigen Spitzentreffer. Liegt „Küste“ auf Rang 80, lohnen
            sich Begriffe wie „Strand“, „Hafen“, „Welle“ oder „Meer“.
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
            Die Worteinbettungen unterscheiden nicht zwischen Nomen, Verben und Adjektiven –
            entscheidend ist der Kontext, nicht die grammatische Form. Liegt ein Nomen nah am
            Zielwort, können das zugehörige Verb oder Adjektiv noch näher liegen. Findest du mit
            ähnlichen Nomen keinen besseren Treffer, wechsle die Wortart: aus „Reise“ wird
            „reisen“, aus „Dunkelheit“ wird „dunkel“ oder „finster“.
          </p>
          <p>
            Auch Synonyme erschließen neue Bereiche des Bedeutungsraums: Statt „Freude“ probiere
            „Glück“, „Lachen“ oder „fröhlich“. Jedes davon liegt etwas anders und kann dich einen
            Schritt weiterbringen.
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="sackgassen">Sackgassen erkennen und verlassen</h2>
          <p>
            Wenn mehrere verwandte Wörter allesamt rote Ränge (ab 1501) liefern, ist das ein
            klares Signal: Das ganze Themenfeld führt nicht zum Ziel. Verharre nicht dort – jeder
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
            <li><strong>Nur Nomen testen:</strong> Das Zielwort kann ein Verb oder Adjektiv sein – variiere die Wortart.</li>
            <li><strong>Auf Buchstaben achten:</strong> Schreibweise ist egal. „Hund“ und „Hundert“ haben nichts miteinander zu tun.</li>
            <li><strong>Zu früh aufgeben:</strong> Es gibt kein Versuchslimit. Ein roter Rang ist kein Misserfolg, sondern Information.</li>
            <li><strong>Eigennamen raten:</strong> Personen- und Markennamen fehlen meist im Wortschatz des Modells.</li>
          </ul>
          <p>
            Eine ausführliche Fehleranalyse mit Beispielen liest du im Artikel{" "}
            <Link href="/blog/haeufige-fehler-bei-kontexto/">7 häufige Fehler bei Kontexto</Link>.
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="geduld">Geduld schlägt Zufall</h2>
          <p>
            Kontexto hat absichtlich kein Versuchslimit. Zufälliges Raten bringt wenig –
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
          { href: "/anleitung/", label: "Spielanleitung – die Grundlagen" },
          { href: "/blog/kontexto-tipps-schneller-gewinnen/", label: "12 Strategien für Kontexto-Profis" },
          { href: "/glossar/", label: "Glossar: fastText, Vektorraum & Co." },
          { href: "/faq/", label: "Häufige Fragen (FAQ)" },
        ]}
      />
    </ArticleLayout>
  );
}
