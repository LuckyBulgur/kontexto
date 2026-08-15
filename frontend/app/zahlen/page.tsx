import Link from "next/link";
import ArticleLayout from "@/components/content/ArticleLayout";
import Prose from "@/components/content/Prose";
import { RelatedLinks } from "@/components/seo/SeoPrimitives";
import { buildMetadata } from "@/lib/seo";
import stats from "@/content/data/public-stats.json";
import benchmark from "@/content/data/startword-benchmark.json";

export const metadata = buildMetadata({
  path: "/zahlen/",
  title: "Kontexto in Zahlen",
  description:
    "Gemessene Daten statt Behauptungen: 868.000 Rateversuche, die 100 meistgeratenen Wörter und ein Startwort-Benchmark über alle 2.400 Rätsel, mit offengelegter Methodik.",
});

const toc = [
  { id: "bilanz", label: "Gesamtbilanz" },
  { id: "startwoerter", label: "Startwort-Benchmark" },
  { id: "woerter", label: "Die 100 meistgeratenen Wörter" },
  { id: "methodik", label: "Methodik und Datenschutz" },
];

const nf = new Intl.NumberFormat("de-DE");
const pf = (v: number) =>
  new Intl.NumberFormat("de-DE", { style: "percent", minimumFractionDigits: 1 }).format(v);
const df = (iso: string) =>
  new Date(iso).toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" });

const T = stats.totals as Record<string, number>;
const LABELS = stats.labels as Record<string, string>;
const solveRate = T.solves / (T.solves + T.reveals);

export default function ZahlenPage() {
  return (
    <ArticleLayout
      title="Kontexto in Zahlen"
      lead={`Alle veröffentlichten Kennzahlen an einer Stelle, direkt aus den Spieldaten erzeugt. Stand: ${df(stats.generated_on)}.`}
      breadcrumbName="Zahlen"
      path="/zahlen/"
      toc={toc}
    >
      <section className="space-y-4">
        <Prose>
          <h2 id="bilanz">Gesamtbilanz</h2>
          <p>
            Serverseitig gezählte Aktionen seit dem Neustart der Rätselreihe am 8. Juni 2026.
            Absolutzahlen sind gerundet veröffentlicht, weil eine Scheingenauigkeit auf die Einheit
            genau niemandem nützt.
          </p>
        </Prose>

        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Object.entries(T).map(([key, value]) => (
            <div key={key} className="rounded-lg border border-border bg-muted/30 p-4">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {LABELS[key] ?? key}
              </dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                {nf.format(value)}
              </dd>
            </div>
          ))}
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Rateversuche je Lösung
            </dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums text-foreground">
              {nf.format(stats.guesses_per_solve ?? 0)}
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Lösungsquote</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums text-foreground">
              {new Intl.NumberFormat("de-DE", { style: "percent" }).format(solveRate)}
            </dd>
          </div>
        </dl>

        <Prose>
          <p>
            Was diese Verhältnisse über das Spiel aussagen, steht in{" "}
            <Link href="/blog/wie-viele-versuche-sind-normal/">
              Wie viele Versuche sind normal?
            </Link>
          </p>
        </Prose>
      </section>

      <section className="space-y-4">
        <Prose>
          <h2 id="startwoerter">Startwort-Benchmark</h2>
          <p>
            Für jedes der {nf.format(benchmark.games_evaluated)} vorberechneten Rätsel liegt eine
            vollständige Rangliste über alle {nf.format(benchmark.vocabulary_size)} Vokabelwörter
            vor. Damit lässt sich exakt ausrechnen, welchen Rang ein Kandidatenwort in jedem
            einzelnen Rätsel bekommen hätte.
          </p>
          <p>
            Sortiert ist nach <strong>Anteil unter Rang 1500</strong>, also danach, wie oft ein Wort
            überhaupt ein verwertbares Signal liefert. Das ist die einzige der vier Kennzahlen, die
            zwischen guten und schlechten Startwörtern trennt. Die Einordnung steht in{" "}
            <Link href="/blog/startwort-benchmark/">Startwort-Benchmark</Link>.
          </p>
        </Prose>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <caption className="caption-bottom pt-3 text-xs text-muted-foreground">
              {benchmark.results.length} Kandidaten über {nf.format(benchmark.games_evaluated)}{" "}
              Rätsel. Median: mittlerer Rang. IQR: Streuung (Interquartilsabstand).
            </caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="py-2 pr-3 font-semibold">Wort</th>
                <th scope="col" className="py-2 px-3 text-right font-semibold">unter 1500</th>
                <th scope="col" className="py-2 px-3 text-right font-semibold">unter 300</th>
                <th scope="col" className="py-2 px-3 text-right font-semibold">Median</th>
                <th scope="col" className="py-2 px-3 text-right font-semibold">Bester</th>
                <th scope="col" className="py-2 pl-3 text-right font-semibold">IQR</th>
              </tr>
            </thead>
            <tbody>
              {[...benchmark.results]
                .sort((a, b) => b.share_under_1500 - a.share_under_1500)
                .map((r) => (
                  <tr key={r.word} className="border-b border-border/60">
                    <td className="py-1.5 pr-3 font-medium text-foreground">{r.word}</td>
                    <td className="py-1.5 px-3 text-right tabular-nums">{pf(r.share_under_1500)}</td>
                    <td className="py-1.5 px-3 text-right tabular-nums text-muted-foreground">
                      {pf(r.share_under_300)}
                    </td>
                    <td className="py-1.5 px-3 text-right tabular-nums text-muted-foreground">
                      {nf.format(r.median)}
                    </td>
                    <td className="py-1.5 px-3 text-right tabular-nums text-muted-foreground">
                      {nf.format(r.best)}
                    </td>
                    <td className="py-1.5 pl-3 text-right tabular-nums text-muted-foreground">
                      {nf.format(r.iqr)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {benchmark.words_not_in_vocabulary.length > 0 && (
          <Prose>
            <p>
              Nicht im Vokabular und deshalb nicht messbar:{" "}
              {benchmark.words_not_in_vocabulary.join(", ")}. Warum solche Wörter fehlen, erklärt{" "}
              <Link href="/blog/woerter-die-kontexto-nicht-kennt/">
                Wörter, die Kontexto nicht kennt
              </Link>
              .
            </p>
          </Prose>
        )}
      </section>

      <section className="space-y-4">
        <Prose>
          <h2 id="woerter">Die 100 meistgeratenen Wörter</h2>
          <p>
            Eine reine Wort-zu-Anzahl-Tabelle über alle Partien hinweg. Sie zeigt, was Menschen
            tatsächlich eintippen, und das ist etwas anderes als das, was sich messbar lohnt.
          </p>
        </Prose>

        <ol className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3 lg:grid-cols-4">
          {stats.top_words.map((w, i) => (
            <li key={w.word} className="flex items-baseline justify-between gap-2 border-b border-border/40 py-1">
              <span className="text-foreground">
                <span className="mr-2 text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
                {w.word}
              </span>
              <span className="tabular-nums text-xs text-muted-foreground">{nf.format(w.count)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-4">
        <Prose>
          <h2 id="methodik">Methodik und Datenschutz</h2>
          <p>
            Beide Datensätze werden von Skripten erzeugt, die im Projektarchiv liegen:{" "}
            <code>scripts/export-public-stats.py</code> und{" "}
            <code>scripts/export-startword-benchmark.py</code>. Sie öffnen die Datenbank
            schreibgeschützt und lesen ausschließlich bereits aggregierte Tabellen.
          </p>
          <p>
            Was <strong>nicht</strong> in diese Zahlen einfließt: keine Rohereignisse, keine
            Besucher-Fingerabdrücke, keine Sitzungen, keine Zuordnung von Wörtern zu Personen oder
            Partien. Die Aktionszähler sind Tagessummen, die Wortliste ist eine Zuordnung von Wort
            zu Anzahl ohne jeden weiteren Bezug. Deshalb gibt es hier auch keine Verteilung der
            Versuchszahlen und keinen Median: Dafür müssten einzelne Spielverläufe gespeichert
            werden, und das findet nicht statt.
          </p>
          <p>
            Wörter mit weniger als 25 Eingaben sind aus der Liste ausgeschlossen, weil sie eher
            Tippfehler abbilden als Spielverhalten. Alle Absolutzahlen sind gerundet. Die
            vollständigen Angaben zur Datenverarbeitung stehen in der{" "}
            <Link href="/datenschutz/">Datenschutzerklärung</Link>.
          </p>
          <p>
            Der Datenstand wird nicht automatisch aktualisiert, sondern bei jedem Neuaufbau der
            Spieldaten neu erzeugt und ins Projekt übernommen. Das Datum oben ist deshalb
            verbindlich und nicht die Uhrzeit deines Besuchs.
          </p>
        </Prose>
      </section>

      <RelatedLinks
        heading="Mehr erfahren"
        label="Verwandte Seiten"
        links={[
          { href: "/blog/startwort-benchmark/", label: "Startwort-Benchmark: die Auswertung" },
          { href: "/blog/wie-viele-versuche-sind-normal/", label: "Wie viele Versuche sind normal?" },
          { href: "/strategie/", label: "Strategie und Tipps" },
          { href: "/changelog/", label: "Änderungen am Spiel" },
        ]}
      />
    </ArticleLayout>
  );
}
