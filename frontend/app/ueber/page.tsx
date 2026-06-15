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
  title: "Über Kontexto – das deutsche Contexto",
  description:
    "Was Kontexto ist, wie die KI-Worteinbettungen (fastText) die Bedeutungsähnlichkeit berechnen, welche Mission dahintersteht und wer das Projekt entwickelt – kostenlos und auf Deutsch.",
});

const toc = [
  { id: "was-ist", label: "Was ist Kontexto?" },
  { id: "technik", label: "Wie die KI-Ähnlichkeit funktioniert" },
  { id: "mission", label: "Unsere Mission" },
  { id: "wer", label: "Wer dahintersteht" },
  { id: "kontakt", label: "Datenschutz & Kontakt" },
];

export default function UeberPage() {
  return (
    <ArticleLayout
      title="Über Kontexto"
      lead="Kontexto ist die deutsche Version des weltweit beliebten Wortspiels Contexto – ein tägliches Ratespiel, bei dem nicht Buchstaben, sondern Bedeutung zählt."
      breadcrumbName="Über"
      path="/ueber/"
      toc={toc}
    >
      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="was-ist">Was ist Kontexto?</h2>
          <p>
            Jeden Tag erscheint um Mitternacht ein neues geheimes Wort – alle Spielerinnen und
            Spieler versuchen dasselbe Wort zu erraten. Das Besondere: Du hast unbegrenzt viele
            Versuche, wirst nicht unter Zeitdruck gesetzt und musst nirgendwo ein Konto anlegen.
            Kontexto ist vollständig kostenlos; dein Spielstand wird ausschließlich lokal in deinem
            Browser gespeichert.
          </p>
          <p>
            Im Unterschied zu buchstabenbasierten Spielen wie{" "}
            <Link href="/wordle/">Wördle</Link> dreht sich Kontexto um{" "}
            <strong>Bedeutung</strong>: Je ähnlicher ein eingetipptes Wort dem Zielwort im Kontext
            ist, desto kleiner ist sein Rang. Rang&nbsp;1 ist das Zielwort selbst – wer es eingibt,
            hat gewonnen. Wie sich Kontexto von verwandten Spielen abgrenzt, zeigt der{" "}
            <Link href="/vergleich/">große Spielvergleich</Link>.
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="technik">Wie die KI-Ähnlichkeit funktioniert</h2>
          <p>
            Grundlage der Ähnlichkeitsberechnung sind{" "}
            <Link href="/glossar/#fasttext">fastText-Worteinbettungen</Link> – ein von Facebook
            (Meta) AI Research entwickeltes Verfahren, das auf großen deutschen Textkorpora
            trainiert wurde. Jedes Wort wird dabei auf einen hochdimensionalen Vektor abgebildet.
            Je ähnlicher zwei Wörter in ihrem sprachlichen Kontext auftreten, desto näher liegen
            ihre Vektoren im <Link href="/glossar/#vektorraum">Vektorraum</Link> beieinander.
          </p>
        </Prose>
        <VectorSpaceDiagram />
        <Prose>
          <p>
            Die Reihenfolge der Ränge ergibt sich aus der{" "}
            <Link href="/glossar/#kosinus-aehnlichkeit">Kosinus-Ähnlichkeit</Link> zwischen dem
            Vektor deines Worts und dem des Zielworts. Es zählt also die Bedeutung im Kontext, nicht
            die Schreibweise: „Hund“ liegt nah bei „Katze“ oder „Haustier“, aber weit von „Hundert“
            – obwohl „Hundert“ die gleichen Anfangsbuchstaben hat. Eine ausführliche, verständliche
            Erklärung findest du im Artikel{" "}
            <Link href="/blog/worteinbettungen-erklaert/">Worteinbettungen einfach erklärt</Link>.
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="mission">Unsere Mission</h2>
          <p>
            Kontexto soll zeigen, wie reich und vernetzt die deutsche Sprache ist – spielerisch,
            täglich und für alle frei zugänglich. Jede Partie ist ein kleines Training für dein
            Sprachgefühl: Du erkundest Bedeutungsfelder, entdeckst überraschende Verbindungen
            zwischen Wörtern und verstehst nebenbei, wie moderne Sprach-KI „denkt“. Es gibt keine
            Anmeldung, keine Paywall und keine Pflicht-Cookies – nur ein Wort pro Tag.
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="wer">Wer dahintersteht</h2>
          <p>
            Kontexto ist ein unabhängiges, werbefinanziertes Projekt aus Deutschland. Entwickelt
            und gepflegt wird es von {AUTHOR_NAME} – ohne großen Verlag im Rücken, finanziert allein
            über Werbung, damit das Spiel für alle kostenlos bleibt. Er beschäftigt sich mit
            Worteinbettungen und natürlicher Sprachverarbeitung und schreibt im{" "}
            <Link href="/blog/">Blog</Link> über die Technik und Strategie hinter dem Spiel.
            Anregungen und Fehlermeldungen sind ausdrücklich willkommen; die Kontaktmöglichkeiten
            findest du im <Link href="/impressum/">Impressum</Link>.
          </p>
        </Prose>
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <Prose>
          <h2 id="kontakt">Datenschutz & Kontakt</h2>
          <p>
            Kontexto setzt Werbe- und Tracking-Cookies nur mit deiner Einwilligung. Die eingetippten
            Wörter werden zur Rangberechnung an den Server geschickt und nicht personenbezogen
            gespeichert. Alle Details stehen in der{" "}
            <Link href="/datenschutz/">Datenschutzerklärung</Link>; Anbieterangaben findest du im{" "}
            <Link href="/impressum/">Impressum</Link>.
          </p>
        </Prose>
      </Reveal>

      <RelatedLinks
        heading="Mehr erfahren"
        label="Verwandte Seiten"
        links={[
          { href: "/anleitung/", label: "Spielanleitung" },
          { href: "/glossar/", label: "Glossar der Begriffe" },
          { href: "/blog/", label: "Blog: Hintergründe & Strategien" },
          { href: "/faq/", label: "Häufige Fragen (FAQ)" },
        ]}
      />
    </ArticleLayout>
  );
}
