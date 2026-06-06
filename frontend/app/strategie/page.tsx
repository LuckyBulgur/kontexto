import TextPage from "@/components/seo/LegalLayout";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/strategie/",
  title: "Strategie & Tipps – Kontexto schneller lösen",
  description: "Bewährte Kontexto-Strategien: gute Startwörter, Themenfelder eingrenzen, Synonyme nutzen und mit weniger Versuchen das Zielwort finden.",
});

export default function StrategiePage() {
  return (
    <TextPage title="Strategie & Tipps" breadcrumbName="Strategie" path="/strategie/">
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Mit breiten Startwörtern beginnen</h2>
        <p>
          Der erste Zug entscheidet, wie schnell du das Themenfeld des Zielworts eingrenzt.
          Alltagsbegriffe mit vielen semantischen Verbindungen – etwa „Zeit", „Mensch", „Wasser",
          „Haus" oder „Arbeit" – liefern als Startwörter die meisten Informationen. Sie decken
          unterschiedliche Bedeutungsfelder ab und geben dir schon in der ersten Runde einen klaren
          Hinweis, in welche Richtung du weitersuchen solltest. Spezialisierte Fachbegriffe oder
          sehr seltene Wörter sind dagegen schlechte Startwörter, weil sie nur ein enges Umfeld
          beschreiben und bei einem ungünstigen Thema kaum nützliche Einblicke geben.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Themenfeld eingrenzen</h2>
        <p>
          Sobald du ein Wort mit einem guten Rang (grün oder gelb) gefunden hast, wechselst du
          zur Nachbarschaftsstrategie: Teste Synonyme, Ober- und Unterbegriffe sowie assoziierte
          Konzepte rund um deinen bisherigen Spitzentreffer. Liegt „Küste" auf Rang 80, lohnen
          sich Begriffe wie „Strand", „Hafen", „Welle" oder „Meer". Die Kosinus-Ähnlichkeit der
          fastText-Einbettungen folgt dem sprachlichen Kontext – Wörter, die in ähnlichen Sätzen
          auftauchen, liegen im Vektorraum nah beieinander. Arbeite dich deshalb mit jedem neuen
          Treffer systematisch tiefer in das Themenfeld vor.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Wortarten variieren</h2>
        <p>
          Die Worteinbettungen unterscheiden nicht zwischen Nomen, Verben und Adjektiven –
          entscheidend ist der Kontext, nicht die grammatische Form. Liegt ein Nomen nah am
          Zielwort, können das zugehörige Verb oder Adjektiv noch näher liegen. Findest du
          keinen besseren Treffer mit ähnlichen Nomen, wechsle zur Verbform oder zum
          verwandten Adjektiv: Aus „Reise" wird „reisen" oder „reisend", aus „Dunkel" wird
          „dunkel" oder „Finsternis". Diese Variationen liegen im Vektorraum oft überraschend
          nah beieinander.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Sackgassen erkennen und verlassen</h2>
        <p>
          Wenn mehrere ähnliche Wörter allesamt rote Ränge (ab 1501) liefern, ist das ein Signal,
          das komplette Themenfeld aufzugeben. Verharre nicht in einem Bedeutungsbereich, der
          offensichtlich nicht zum Zielwort führt – jeder zusätzliche Versuch in einer Sackgasse
          kostet Zeit ohne Informationsgewinn. Kehre zurück zu einem breiteren Startwort aus einem
          anderen Bedeutungsfeld und beginne die Eingrenzung von vorne.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Geduld und Systematik statt Raten</h2>
        <p>
          Kontexto hat kein Limit für Versuche. Das bedeutet: Zufälliges Raten bringt wenig,
          systematisches Erkunden des semantischen Raums bringt dich ans Ziel. Behandle jede
          Runde wie eine Karte, auf der du neue Gebiete erschließt: Notiere dir deine besten
          Treffer, leite daraus gezielt die nächsten Kandidaten ab, und vertraue darauf, dass
          du das Wort mit jedem grünen oder gelben Treffer ein Stück näher einkreist. Wer
          methodisch vorgeht, schlägt Zufallsrater regelmäßig mit deutlich weniger Versuchen.
        </p>
      </section>
    </TextPage>
  );
}
