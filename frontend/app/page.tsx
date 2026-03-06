import GameClient from "@/components/GameClient";
import { faqs } from "@/lib/faqs";

export default function Home() {
  return (
    <>
      <GameClient />
      <section className="max-w-lg mx-auto px-4 py-8 border-t border-border">
        <div className="space-y-6 text-sm text-muted-foreground">
          <div>
            <h2 className="text-lg font-bold text-foreground mb-2">
              Kontexto - Das deutsche Wort-Ratespiel
            </h2>
            <p>
              Kontexto ist die deutsche Version des beliebten Wortspiels Contexto.
              Jeden Tag gibt es ein neues geheimes Wort zu erraten. Anders als bei
              klassischen Wortspielen basiert Kontexto nicht auf Buchstaben, sondern
              auf <strong className="text-foreground">Bedeutungsähnlichkeit</strong>.
              Gib ein beliebiges deutsches Wort ein und erfahre anhand des Rangs,
              wie nah du am Zielwort bist.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-foreground mb-2">
              So funktioniert Kontexto
            </h2>
            <p className="mb-2">
              Kontexto nutzt KI-basierte Worteinbettungen (fastText), die auf
              großen deutschen Textkorpora trainiert wurden. Jedes Wort bekommt
              einen Rang von 1 bis 10.000 basierend auf seiner semantischen Nähe
              zum Zielwort. Rang 1 bedeutet: Du hast das Wort gefunden!
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Grün (Rang 1-300): Sehr nah am Zielwort</li>
              <li>Gelb (Rang 301-1500): Auf dem richtigen Weg</li>
              <li>Rot (Rang 1501+): Noch weit entfernt</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold text-foreground mb-2">
              Häufig gestellte Fragen
            </h2>
            <dl className="space-y-4">
              {faqs.map((faq, i) => (
                <div key={i}>
                  <dt className="font-medium text-foreground">{faq.q}</dt>
                  <dd className="mt-1">{faq.a}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <h2 className="text-lg font-bold text-foreground mb-2">
              Kontexto vs. Contexto
            </h2>
            <p>
              Während Contexto (contexto.me) auf Englisch und anderen Sprachen
              verfügbar ist, ist Kontexto speziell für die deutsche Sprache
              entwickelt. Die Worteinbettungen wurden auf deutschen Texten
              trainiert, sodass die Bedeutungsähnlichkeit präzise für deutsche
              Wörter funktioniert. Kontexto ist kostenlos, ohne Anmeldung spielbar
              und respektiert deine Privatsphäre.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
