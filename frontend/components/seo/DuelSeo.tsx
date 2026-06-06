import Link from "next/link";
export default function DuelSeo() {
  return (
    <section className="mx-auto max-w-2xl px-4 pb-16 pt-8 text-sm leading-relaxed text-muted-foreground">
      <h1 className="mb-4 text-2xl font-bold text-foreground">Kontexto-Duell – gegen Freunde spielen</h1>
      <p className="mb-4">
        Im Duell-Modus tretet ihr beim selben geheimen Wort gegeneinander an.
        Erstelle ein <Link href="/duel/create/" className="text-primary underline">neues Duell</Link>,
        teile den Link und seht in Echtzeit, wer das Zielwort zuerst findet.
        Zurück zum täglichen <Link href="/" className="text-primary underline">Kontexto</Link>.
      </p>
    </section>
  );
}
