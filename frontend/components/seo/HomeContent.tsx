import Link from "next/link";
import { faqs } from "@/lib/faqs";

export default function HomeContent() {
  return (
    <section className="mx-auto max-w-2xl px-4 pb-16 pt-8 text-sm leading-relaxed text-muted-foreground">
      <h1 className="mb-4 text-2xl font-bold text-foreground">
        Kontexto – das deutsche Wort-Ratespiel
      </h1>
      <p className="mb-4">
        Kontexto ist die deutsche Version von Contexto: ein kostenloses,
        tägliches Wort-Ratespiel ohne Anmeldung. Errate das geheime Wort des
        Tages – nach jedem Tipp zeigt dir Kontexto, wie nah du an der Bedeutung
        des Zielworts bist. Je kleiner die Zahl, desto näher bist du dran.
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold text-foreground">Wie funktioniert Kontexto?</h2>
      <p className="mb-4">
        Du gibst ein Wort ein und erhältst einen Rang. Rang&nbsp;1 ist das
        gesuchte Wort. Die Reihenfolge entsteht aus KI-Worteinbettungen
        (fastText), die auf großen deutschen Textkorpora trainiert wurden – es
        zählt also die <strong>Bedeutung</strong> im Kontext, nicht die
        Buchstaben. „Hund" liegt deshalb nah bei „Katze", aber weit weg von
        „Hundert".
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold text-foreground">Was bedeuten die Farben?</h2>
      <ul className="mb-4 list-disc space-y-1 pl-5">
        <li><span className="font-medium text-foreground">Grün</span> (Rang 1–300): sehr nah am Zielwort.</li>
        <li><span className="font-medium text-foreground">Gelb</span> (Rang 301–1500): auf dem richtigen Weg.</li>
        <li><span className="font-medium text-foreground">Rot</span> (Rang 1501+): noch weit entfernt.</li>
      </ul>

      <h2 className="mb-2 mt-8 text-lg font-semibold text-foreground">Kontexto vs. Wordle</h2>
      <p className="mb-4">
        Bei <Link href="/wordle/" className="text-primary underline">Wördle</Link> errätst du ein Wort
        Buchstabe für Buchstabe. Bei Kontexto geht es um Bedeutung: Es gibt
        unbegrenzt viele Versuche, und jeder Tipp bringt dich der Lösung
        semantisch näher. Beide Spiele gibt es hier täglich neu – auf Deutsch.
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold text-foreground">Häufige Fragen</h2>
      <dl className="space-y-4">
        {faqs.map((f) => (
          <div key={f.q}>
            <dt className="font-medium text-foreground">{f.q}</dt>
            <dd className="mt-1">{f.a}</dd>
          </div>
        ))}
      </dl>

      <nav className="mt-10 flex flex-wrap gap-x-4 gap-y-2" aria-label="Weitere Seiten">
        <Link href="/anleitung/" className="text-primary underline">Spielanleitung</Link>
        <Link href="/strategie/" className="text-primary underline">Strategie &amp; Tipps</Link>
        <Link href="/archiv/" className="text-primary underline">Rätsel-Archiv</Link>
        <Link href="/faq/" className="text-primary underline">FAQ</Link>
        <Link href="/ueber/" className="text-primary underline">Über Kontexto</Link>
      </nav>
    </section>
  );
}
