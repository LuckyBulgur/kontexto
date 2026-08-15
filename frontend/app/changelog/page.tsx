import Link from "next/link";
import ArticleLayout from "@/components/content/ArticleLayout";
import Prose from "@/components/content/Prose";
import { RelatedLinks } from "@/components/seo/SeoPrimitives";
import { buildMetadata } from "@/lib/seo";
import { changelog, type ChangeKind } from "@/lib/changelog";

export const metadata = buildMetadata({
  path: "/changelog/",
  title: "Änderungen am Spiel",
  description:
    "Was sich bei Kontexto geändert hat: neue Spielmodi, korrigierte Lösungswörter, zurückgenommene Funktionen. Kuratierte Historie mit Datum und Begründung.",
});

const KIND_STYLES: Record<ChangeKind, string> = {
  Neu: "bg-green-500/10 text-green-600 dark:text-green-400 ring-green-500/20",
  Verbessert: "bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/20",
  Behoben: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" });

export default function ChangelogPage() {
  return (
    <ArticleLayout
      title="Änderungen am Spiel"
      lead="Eine kuratierte Historie: nur das, was beim Spielen spürbar ist, mit Datum und Begründung. Auch die Funktionen, die wieder entfernt wurden."
      breadcrumbName="Änderungen"
      path="/changelog/"
    >
      <Prose>
        <p>
          Kontexto ist ein laufendes Projekt und kein fertiges Produkt. Manche Entscheidungen haben
          sich erst im Betrieb als falsch erwiesen, etwa die Auswahl der Lösungswörter oder das kurz
          eingeführte Rätselarchiv. Beides steht unten mit dem Grund, warum es geändert
          beziehungsweise zurückgenommen wurde.
        </p>
        <p>
          Rein technische Arbeit, Abhängigkeits-Updates und Umbauten ohne sichtbare Wirkung stehen
          hier bewusst nicht. Wenn dir etwas auffällt, das hier fehlen sollte, schreib uns über die{" "}
          <Link href="/kontakt/">Kontaktseite</Link>.
        </p>
      </Prose>

      <ol className="space-y-6 border-l border-border pl-6">
        {changelog.map((e, i) => (
          <li key={`${e.date}-${i}`} className="relative">
            <span
              aria-hidden="true"
              className="absolute -left-[1.8125rem] top-2 h-2 w-2 rounded-full bg-border ring-4 ring-background"
            />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${KIND_STYLES[e.kind]}`}
              >
                {e.kind}
              </span>
              <time dateTime={e.date} className="text-xs text-muted-foreground">
                {fmt(e.date)}
              </time>
            </div>
            <h2 className="mt-2 text-lg font-semibold text-foreground">{e.title}</h2>
            <p className="mt-1 text-base leading-7 text-muted-foreground">{e.body}</p>
            {e.href && (
              <p className="mt-2 text-sm">
                <Link href={e.href} className="text-primary underline underline-offset-2">
                  {e.hrefLabel ?? "Mehr dazu"}
                </Link>
              </p>
            )}
          </li>
        ))}
      </ol>

      <Prose>
        <h2>Wie Änderungen zustande kommen</h2>
        <p>
          Die meisten Einträge oben gehen auf Rückmeldungen zurück. Der Neustart der Lösungswörter
          kam durch anhaltende Kritik daran zustande, dass zu oft Namen die Lösung waren. Die
          Sperrliste für anstößige Wörter entstand an dem Tag, an dem ein derber Ausdruck als
          Tageslösung erschien. Die ß/ss-Regel entstand, weil jemand die alte Schreibweise eines
          Wortes tippte, Rang 2 sah und trotzdem nicht gewann.
        </p>
        <p>
          Keiner dieser Fälle war vorhersehbar, und keiner wäre ohne Hinweis aufgefallen. Wenn dir
          ein Lösungswort unterkommt, das nicht hätte erscheinen dürfen, ist eine kurze Nachricht mit
          Rätselnummer und Wort die wirksamste Hilfe, die es gibt.
        </p>
      </Prose>

      <RelatedLinks
        heading="Mehr erfahren"
        label="Verwandte Seiten"
        links={[
          { href: "/kontakt/", label: "Kontakt" },
          { href: "/ueber/", label: "Über Kontexto" },
          { href: "/blog/", label: "Blog: Hintergründe und Strategien" },
          { href: "/faq/", label: "Häufige Fragen" },
        ]}
      />
    </ArticleLayout>
  );
}
