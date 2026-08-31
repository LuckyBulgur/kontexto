import stats from "@/content/data/public-stats.json";
import benchmark from "@/content/data/startword-benchmark.json";

/**
 * Streudiagramm: Beliebtheit eines Wortes gegen seine gemessene Eignung als
 * Startwort. Die Punkte stammen aus den beiden offengelegten Datensaetzen im
 * Repository, nichts ist von Hand gesetzt.
 *
 * Die Aussage der Grafik ist die Abwesenheit eines Musters: Es gibt keine
 * Diagonale, die Punkte streuen. Genau das ist der Befund des Beitrags.
 */
type BenchRow = { word: string; share_under_1500: number };

const bench = new Map(
  (benchmark.results as BenchRow[]).map((r) => [r.word, r.share_under_1500 * 100]),
);
const words = stats.top_words as { word: string; count: number }[];

const points = words
  .map((w, i) => ({ word: w.word, rank: i + 1, count: w.count, quality: bench.get(w.word) }))
  .filter((p): p is { word: string; rank: number; count: number; quality: number } =>
    typeof p.quality === "number",
  );

const W = 400;
const H = 250;
const PAD = { l: 44, r: 12, t: 16, b: 38 };
const maxCount = Math.max(...points.map((p) => p.count));
const maxQ = Math.ceil(Math.max(...points.map((p) => p.quality)));

const x = (c: number) => PAD.l + (c / maxCount) * (W - PAD.l - PAD.r);
const y = (q: number) => H - PAD.b - (q / maxQ) * (H - PAD.t - PAD.b);

/** Nur diese Punkte werden beschriftet, sonst wird es unlesbar. */
const LABELLED = new Set(["haus", "tier", "wasser", "arbeit", "zeit", "gehen", "pflanze"]);

export default function PopularityQualityChart() {
  return (
    <figure className="my-6">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby="pqc-title pqc-desc"
        className="w-full rounded-lg border border-border bg-muted/20"
      >
        <title id="pqc-title">Beliebtheit gegen gemessene Eignung als Startwort</title>
        <desc id="pqc-desc">
          Ein Streudiagramm mit {points.length} Wörtern. Auf der waagerechten Achse steht, wie oft
          ein Wort eingegeben wurde, auf der senkrechten, in wie viel Prozent der Rätsel es einen
          Rang unter 1500 liefert. Die Punkte zeigen kein Muster: Häufig eingegebene Wörter wie
          „tier“ und „wasser“ liegen unten, also bei geringer Eignung, während das gemessen beste
          Wort „gehen“ weit links liegt, also selten eingegeben wird. Die Rangkorrelation beträgt
          minus 0,009.
        </desc>

        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} className="stroke-border" strokeWidth={1} />
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} className="stroke-border" strokeWidth={1} />

        {[0, 4, 8, 12].map((q) => (
          <g key={q}>
            <line x1={PAD.l} y1={y(q)} x2={W - PAD.r} y2={y(q)} className="stroke-border/40" strokeWidth={0.5} />
            <text x={PAD.l - 6} y={y(q) + 3} textAnchor="end" className="fill-muted-foreground text-[8px]">
              {q} %
            </text>
          </g>
        ))}

        {points.map((p) => (
          <g key={p.word}>
            <circle
              cx={x(p.count)}
              cy={y(p.quality)}
              r={3}
              className={LABELLED.has(p.word) ? "fill-foreground" : "fill-muted-foreground/50"}
            />
            {LABELLED.has(p.word) && (
              <text
                x={x(p.count) + 6}
                y={y(p.quality) + 3}
                className="fill-foreground text-[8px] font-medium"
              >
                {p.word}
              </text>
            )}
          </g>
        ))}

        <text x={PAD.l} y={PAD.t - 4} className="fill-muted-foreground text-[8px]">
          Anteil Rätsel mit Rang unter 1500
        </text>
        <text x={W - PAD.r} y={H - 8} textAnchor="end" className="fill-muted-foreground text-[8px]">
          Eingaben insgesamt
        </text>
      </svg>
      <figcaption className="mt-2 text-center text-xs text-muted-foreground">
        {points.length} Wörter, die in beiden Datensätzen vorkommen. Gäbe es einen Zusammenhang,
        lägen die Punkte auf einer Diagonalen. Sie tun es nicht: Die Rangkorrelation zwischen
        Beliebtheit und gemessener Eignung liegt bei minus 0,009.
      </figcaption>
    </figure>
  );
}
