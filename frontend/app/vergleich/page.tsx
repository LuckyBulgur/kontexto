import Link from "next/link";
import ArticleLayout from "@/components/content/ArticleLayout";
import Prose from "@/components/content/Prose";
import ComparisonTable from "@/components/content/ComparisonTable";
import Callout from "@/components/content/Callout";
import Reveal from "@/components/motion/Reveal";
import { RelatedLinks } from "@/components/seo/SeoPrimitives";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/vergleich/",
  title: "Kontexto vs. Wordle, Contexto & Semantle – der große Vergleich",
  description:
    "Worin unterscheiden sich Kontexto, Wordle (Wördle), Contexto und Semantle? Mechanik, Sprache, Versuche und Feedback im direkten Vergleich – plus: Welches Wortspiel passt zu dir?",
});

const toc = [
  { id: "tabelle", label: "Vergleich auf einen Blick" },
  { id: "kontexto-wordle", label: "Kontexto vs. Wordle" },
  { id: "kontexto-contexto", label: "Kontexto vs. Contexto" },
  { id: "kontexto-semantle", label: "Kontexto vs. Semantle" },
  { id: "welches", label: "Welches Spiel passt zu dir?" },
];

const dash = <span className="text-muted-foreground">–</span>;

export default function VergleichPage() {
  return (
    <ArticleLayout
      title="Kontexto, Wordle, Contexto & Semantle im Vergleich"
      lead="Alle vier sind tägliche Wortspiele – doch sie funktionieren grundverschieden. Hier siehst du die Unterschiede in Mechanik, Sprache und Feedback und erfährst, welches Spiel zu dir passt."
      breadcrumbName="Vergleich"
      path="/vergleich/"
      toc={toc}
    >
      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="tabelle">Vergleich auf einen Blick</h2>
          <p>
            Die wichtigsten Eigenschaften der vier Spiele nebeneinander. „Wördle“ ist dabei die
            deutsche Wordle-Variante hier auf Kontexto.
          </p>
        </Prose>
        <ComparisonTable
          columns={["Merkmal", "Kontexto", "Wördle", "Contexto", "Semantle"]}
          rows={[
            ["Prinzip", "Bedeutung erraten", "Buchstaben erraten", "Bedeutung erraten", "Bedeutung erraten"],
            ["Sprache", "Deutsch", "Deutsch", "Englisch u. a.", "Englisch"],
            ["Feedback", "Rang (1 = Ziel)", "Farben je Buchstabe", "Rang (1 = Ziel)", "Ähnlichkeit in %"],
            ["Versuche", "unbegrenzt", "6", "unbegrenzt", "unbegrenzt"],
            ["Wortlänge", "beliebig", "5 Buchstaben", "beliebig", "beliebig"],
            ["Neues Rätsel", "täglich", "täglich", "täglich", "täglich"],
            ["Kostenlos", "ja", "ja", "ja", "ja"],
          ]}
          caption="Vergleich von Kontexto, Wördle, Contexto und Semantle"
        />
        <Prose>
          <p>
            Kurz gesagt: <strong>Wordle</strong> ist ein Buchstabenrätsel, die anderen drei sind
            Bedeutungsrätsel. Unter den Bedeutungsspielen ist <strong>Kontexto</strong> das einzige
            mit konsequent deutschem Wortschatz.
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="kontexto-wordle">Kontexto vs. Wordle</h2>
          <p>
            Bei <Link href="/wordle/">Wördle</Link> errätst du ein fünfbuchstabiges Wort in sechs
            Versuchen. Nach jedem Versuch zeigen Farben, welche Buchstaben an der richtigen Stelle
            stehen. Es geht um Orthografie und Kombinatorik – die Bedeutung des Worts spielt keine
            Rolle.
          </p>
          <p>
            Kontexto dreht das um: Hier ist die Schreibweise egal, es zählt allein die{" "}
            <strong>Bedeutung</strong>. Du hast unbegrenzt viele Versuche, und jeder Tipp bekommt
            einen Rang, der zeigt, wie nah du der Bedeutung des Zielworts kommst. Wordle ist in
            wenigen Minuten gelöst; Kontexto ist eher ein Marathon des Assoziierens. Viele spielen
            beides täglich – du findest sie hier nebeneinander.
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="kontexto-contexto">Kontexto vs. Contexto</h2>
          <p>
            <Link href="/glossar/#contexto">Contexto</Link> (contexto.me) ist das Original, das das
            Prinzip „Bedeutung statt Buchstaben“ populär gemacht hat. Kontexto übernimmt diese Idee
            und überträgt sie konsequent auf die deutsche Sprache: deutsche{" "}
            <Link href="/glossar/#worteinbettung">Worteinbettungen</Link>, deutscher Wortschatz,
            deutsche Bedeutungen.
          </p>
          <p>
            Das ist mehr als eine Übersetzung. Bedeutungsnähe ist sprachspezifisch – „Schloss“
            (Gebäude und Türschloss) oder „Bank“ (Geldinstitut und Sitzgelegenheit) verhalten sich
            im Deutschen anders als ihre englischen Entsprechungen. Wer auf Deutsch spielt, rät
            deshalb in einem Vektorraum, der die deutsche Sprache abbildet – kein aus dem Englischen
            übersetztes Modell.
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="kontexto-semantle">Kontexto vs. Semantle</h2>
          <p>
            Semantle war einer der ersten bedeutungsbasierten Wort-Knobeleien und ist auf Englisch.
            Der größte Unterschied liegt im Feedback: Semantle zeigt einen Ähnlichkeitswert in
            Prozent, der schwer einzuordnen ist (was bedeutet schon „27,3 %“?). Kontexto übersetzt
            die Ähnlichkeit in einen <strong>Rang</strong> – „Rang 1“ ist das Ziel, „Rang 312“ ist
            greifbar besser als „Rang 4000“. Das macht den Fortschritt anschaulicher und den
            Einstieg leichter.
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="welches">Welches Spiel passt zu dir?</h2>
          <ul>
            <li><strong>Du magst kurze, knackige Rätsel:</strong> Wördle – in ein paar Minuten gelöst.</li>
            <li><strong>Du tüftelst gern und liebst Sprache:</strong> Kontexto – unbegrenztes, semantisches Knobeln auf Deutsch.</li>
            <li><strong>Du willst auf Englisch spielen:</strong> Contexto oder Semantle.</li>
            <li><strong>Du willst beides:</strong> Spiel hier täglich Kontexto und Wördle direkt nacheinander.</li>
          </ul>
        </Prose>
        <Callout variant="tip" title="Direkt loslegen">
          Starte mit <Link href="/">Kontexto</Link> oder <Link href="/wordle/">Wördle</Link>. Tipps
          fürs schnellere Lösen findest du in der <Link href="/strategie/">Strategie</Link>.
        </Callout>
      </Reveal>

      <RelatedLinks
        heading="Mehr entdecken"
        label="Verwandte Seiten"
        links={[
          { href: "/", label: "Kontexto spielen" },
          { href: "/wordle/", label: "Wördle spielen" },
          { href: "/blog/kontexto-vs-wordle/", label: "Artikel: Kontexto vs. Wordle" },
          { href: "/glossar/", label: "Glossar der Begriffe" },
        ]}
      />
    </ArticleLayout>
  );
}
