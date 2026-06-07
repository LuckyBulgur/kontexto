import Link from "next/link";
import ArticleLayout from "@/components/content/ArticleLayout";
import Prose from "@/components/content/Prose";
import ComparisonTable from "@/components/content/ComparisonTable";
import Callout from "@/components/content/Callout";
import GameDemo from "@/components/motion/GameDemo";
import Reveal from "@/components/motion/Reveal";
import { StepList, Step, ColorLegend, RelatedLinks } from "@/components/seo/SeoPrimitives";
import StructuredData from "@/components/StructuredData";
import { howToSchema } from "@/lib/structured-data";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/anleitung/",
  title: "Spielanleitung – So spielst du Kontexto",
  description:
    "Die komplette Kontexto-Anleitung: Wort eingeben, Rang verstehen, Farben deuten und mit System das geheime Wort des Tages finden – mit Beispielen und Animation.",
});

const toc = [
  { id: "so-spielst-du", label: "So spielst du Kontexto" },
  { id: "farben", label: "Was die Farben bedeuten" },
  { id: "beispiel", label: "Ein Beispiel-Durchlauf" },
  { id: "einstieg", label: "Tipps für den Einstieg" },
  { id: "taeglich", label: "Jeden Tag ein neues Wort" },
];

const howToSteps = [
  { name: "Wort eingeben", text: "Tippe ein beliebiges deutsches Wort ein und bestätige mit Enter. Du hast unbegrenzt viele Versuche." },
  { name: "Rang ablesen", text: "Jedes Wort erhält einen Rang. Rang 1 ist das Zielwort; je kleiner die Zahl, desto näher liegt dein Wort an der Bedeutung." },
  { name: "Farben deuten", text: "Grün bedeutet sehr nah (Rang 1–300), Gelb auf dem Weg (301–1500), Rot weit entfernt (ab 1501)." },
  { name: "Der Bedeutung folgen", text: "Nutze gute Treffer als Wegweiser: Teste Synonyme und verwandte Begriffe, bis du das Zielwort auf Rang 1 findest." },
];

export default function AnleitungPage() {
  return (
    <ArticleLayout
      title="Spielanleitung"
      lead="Kontexto ist in einer Minute erklärt: Du errätst das geheime Wort des Tages, indem du Wörter eingibst und ihrer Bedeutung folgst. Hier siehst du Schritt für Schritt – inklusive Animation –, wie das funktioniert."
      breadcrumbName="Anleitung"
      path="/anleitung/"
      toc={toc}
    >
      <StructuredData
        data={howToSchema({
          name: "Kontexto spielen",
          description: "So findest du das geheime Wort des Tages bei Kontexto.",
          path: "/anleitung/",
          steps: howToSteps,
        })}
      />

      <GameDemo />

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="so-spielst-du">So spielst du Kontexto</h2>
          <p>
            Anders als bei <Link href="/wordle/">Wördle</Link> rätst du bei Kontexto nicht
            Buchstaben, sondern <strong>Bedeutung</strong>. Du gibst Wörter ein und das Spiel
            sagt dir, wie nah jedes Wort dem geheimen Zielwort kommt. In vier Schritten:
          </p>
        </Prose>
        <StepList>
          {howToSteps.map((s, i) => (
            <Step key={s.name} index={i + 1} title={s.name}>
              {s.text}
            </Step>
          ))}
        </StepList>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="farben">Was die Farben bedeuten</h2>
          <p>
            Die Farbe einer Zeile zeigt dir auf einen Blick, wie nah dein Tipp liegt. Sie
            ergänzt den Rang, ersetzt ihn aber nicht – der genaue Rang ist immer die präzisere
            Information.
          </p>
        </Prose>
        <ColorLegend />
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="beispiel">Ein Beispiel-Durchlauf</h2>
          <p>
            Angenommen, das Zielwort ist <strong>Strand</strong>. Eine typische Partie könnte
            sich so entwickeln – jeder Tipp bringt dich der Bedeutung näher:
          </p>
        </Prose>
        <ComparisonTable
          columns={["Dein Tipp", "Rang", "Bedeutung"]}
          rows={[
            ["Computer", "8420", <span key="c" className="text-red-600 dark:text-red-400">weit entfernt</span>],
            ["Meer", "312", <span key="m" className="text-yellow-600 dark:text-yellow-500">auf dem Weg</span>],
            ["Küste", "47", <span key="k" className="text-green-600 dark:text-green-400">sehr nah</span>],
            ["Sand", "12", <span key="sa" className="text-green-600 dark:text-green-400">ganz nah</span>],
            ["Strand", "1", <span key="s" className="font-semibold text-green-600 dark:text-green-400">Treffer!</span>],
          ]}
          caption="Beispielhafte Tipps für das Zielwort Strand"
        />
        <Prose>
          <p>
            Du siehst: „Computer“ liegt thematisch weit weg, „Meer“ bringt dich ins richtige
            Feld, und über „Küste“ und „Sand“ kreist du das Zielwort ein. Genau dieses
            Vorgehen zeigt auch die Animation oben.
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="einstieg">Tipps für den Einstieg</h2>
          <p>
            Drei Dinge helfen Anfängerinnen und Anfängern sofort weiter:
          </p>
          <ul>
            <li><strong>Breit starten:</strong> Beginne mit Alltagswörtern wie „Zeit“, „Mensch“ oder „Wasser“ – sie zeigen schnell die Richtung.</li>
            <li><strong>Der Spur folgen:</strong> Hast du einen grünen oder gelben Treffer, probiere verwandte Begriffe aus demselben Themenfeld.</li>
            <li><strong>Wortart wechseln:</strong> Steckst du fest, teste statt eines Nomens das passende Verb oder Adjektiv.</li>
          </ul>
        </Prose>
        <Callout variant="tip" title="Mehr herausholen">
          Eine ausführliche Anleitung mit fortgeschrittenen Techniken findest du auf der Seite{" "}
          <Link href="/strategie/">Strategie &amp; Tipps</Link>. Die Begriffe hinter dem Spiel
          erklärt das <Link href="/glossar/">Glossar</Link>.
        </Callout>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="taeglich">Jeden Tag ein neues Wort</h2>
          <p>
            Um Mitternacht startet ein neues Rätsel. Alle Spielenden raten am selben Tag dasselbe
            Wort – ideal, um sich mit Freundinnen und Freunden zu messen. Du brauchst kein Konto
            und keine Installation: Kontexto läuft direkt im Browser, auf dem Handy genauso wie am
            Computer. Dein Spielstand bleibt lokal in deinem Browser gespeichert.
          </p>
        </Prose>
      </Reveal>

      <RelatedLinks
        heading="Weiter geht's"
        label="Verwandte Seiten"
        links={[
          { href: "/strategie/", label: "Strategie & Tipps – schneller gewinnen" },
          { href: "/vergleich/", label: "Kontexto vs. Wordle, Contexto & Semantle" },
          { href: "/faq/", label: "Häufige Fragen (FAQ)" },
          { href: "/blog/", label: "Alle Artikel im Blog" },
        ]}
      />
    </ArticleLayout>
  );
}
