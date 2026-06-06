import Link from "next/link";
export default function WordleSeo() {
  return (
    <section className="mx-auto max-w-2xl px-4 pb-16 pt-8 text-sm leading-relaxed text-muted-foreground">
      <h1 className="mb-4 text-2xl font-bold text-foreground">Wördle – Wordle auf Deutsch</h1>
      <p className="mb-4">
        Wördle ist die deutsche Wordle-Variante von Kontexto: Errate jeden Tag
        ein fünfbuchstabiges deutsches Wort in sechs Versuchen. Nach jedem
        Versuch zeigen die Farben, welche Buchstaben stimmen: grün = richtige
        Position, gelb = im Wort, aber falsche Position, grau = nicht enthalten.
      </p>
      <p className="mb-4">
        Spiele auch das semantische <Link href="/" className="text-primary underline">Kontexto</Link>
        oder fordere Freunde im <Link href="/wordle/duel/create/" className="text-primary underline">Wördle-Duell</Link> heraus.
      </p>
    </section>
  );
}
