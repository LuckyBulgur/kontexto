import TextPage from "@/components/seo/LegalLayout";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/ueber/",
  title: "Über Kontexto – das deutsche Contexto",
  description: "Was Kontexto ist, wie die KI-Worteinbettungen (fastText) funktionieren und wer dahintersteht. Kostenlos, ohne Anmeldung, auf Deutsch.",
});

export default function UeberPage() {
  return (
    <TextPage title="Über Kontexto" breadcrumbName="Über" path="/ueber/">
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Was ist Kontexto?</h2>
        <p>
          Kontexto ist die deutsche Version des weltweit beliebten Wortspiels Contexto. Jeden Tag
          erscheint um Mitternacht ein neues geheimes Wort – alle Spielerinnen und Spieler versuchen
          dasselbe Wort zu erraten. Das Besondere: Du hast unbegrenzt viele Versuche, wirst nicht
          unter Zeitdruck gesetzt, und musst nirgendwo ein Konto anlegen. Kontexto ist vollständig
          kostenlos und ohne Cookies – der Spielstand wird ausschließlich lokal in deinem Browser
          gespeichert, nichts wird an Dritte weitergegeben.
        </p>
        <p>
          Im Unterschied zu buchstabenbasierten Spielen wie <a className="text-primary underline" href="/wordle/">Wördle</a>{" "}
          dreht sich Kontexto um <strong className="text-foreground">Bedeutung</strong>: Je ähnlicher
          ein eingetipptes Wort dem Zielwort im Kontext ist, desto kleiner ist sein Rang. Rang&nbsp;1
          ist das Zielwort selbst – wer es eingibt, hat gewonnen.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Wie die KI-Ähnlichkeit funktioniert</h2>
        <p>
          Die Grundlage der Ähnlichkeitsberechnung sind <strong className="text-foreground">fastText-Worteinbettungen</strong>,
          ein von Facebook Research entwickeltes Verfahren, das auf großen deutschen Textkorpora
          trainiert wurde. Jedes Wort wird dabei auf einen hochdimensionalen Vektor abgebildet –
          je ähnlicher zwei Wörter in ihrem sprachlichen Kontext auftreten, desto näher liegen
          ihre Vektoren im Vektorraum beieinander.
        </p>
        <p>
          Die Reihenfolge der Ränge ergibt sich aus der <strong className="text-foreground">Kosinus-Ähnlichkeit</strong>
          {" "}zwischen dem Vektor deines Worts und dem Vektor des Zielworts. Das bedeutet: Nicht
          Buchstaben zählen, sondern Bedeutung im Kontext. „Hund" liegt deshalb semantisch nah
          bei „Katze" oder „Haustier", aber weit entfernt von „Hundert" – obwohl „Hundert" die
          gleichen Anfangsbuchstaben enthält. Umgekehrt kann ein Wort wie „Canidae" (die
          zoologische Familie der Hunde) überraschend nah liegen, selbst wenn es optisch wenig
          mit „Hund" gemein hat.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Datenschutz</h2>
        <p>
          Kontexto setzt keine Cookies und verwendet keine Tracking-Dienste von Drittanbietern.
          Die einzigen Daten, die beim Spielen den Browser verlassen, sind die eingetippten Wörter
          selbst – sie werden zur Rangberechnung an den Server geschickt und danach nicht
          personenbezogen gespeichert. Alle weiteren Details findest du in der{" "}
          <a className="text-primary underline" href="/datenschutz/">Datenschutzerklärung</a>.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Kontakt</h2>
        <p>
          Angaben zum Anbieter sowie Kontaktdaten findest du im{" "}
          <a className="text-primary underline" href="/impressum/">Impressum</a>.
        </p>
      </section>
    </TextPage>
  );
}
