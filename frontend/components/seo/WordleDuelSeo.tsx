import Link from "next/link";
export default function WordleDuelSeo() {
  return (
    <section className="mx-auto max-w-2xl px-4 pb-16 pt-8 text-sm leading-relaxed text-muted-foreground">
      <h1 className="mb-4 text-2xl font-bold text-foreground">Wördle-Duell – Wordle gegen Freunde</h1>
      <p className="mb-4">
        Spiele Wördle im Duell: gleiches Wort, sechs Versuche, Live-Fortschritt
        eurer Gegner. <Link href="/wordle/duel/create/" className="text-primary underline">Duell erstellen</Link> und
        Link teilen. Zurück zum <Link href="/wordle/" className="text-primary underline">Wördle</Link>.
      </p>
    </section>
  );
}
