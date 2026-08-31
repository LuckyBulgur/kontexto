import stats from "@/content/data/public-stats.json";

/**
 * Rateversuche je Wochentag und Loesungen je 1.000 Versuche, aus den 31
 * Tagesreihen in content/data/public-stats.json gerechnet. Nichts von Hand
 * gesetzt: Wer die Datei aktualisiert, aendert die Grafik mit.
 */
const DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

type Point = { date: string; value: number };

const guesses = new Map((stats.last_30_days.guesses as Point[]).map((p) => [p.date, p.value]));
const solves = new Map((stats.last_30_days.solves as Point[]).map((p) => [p.date, p.value]));

const byDay = DAYS.map((label, i) => {
  const dates = [...guesses.keys()].filter((d) => (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7 === i);
  const g = dates.reduce((n, d) => n + (guesses.get(d) ?? 0), 0);
  const s = dates.reduce((n, d) => n + (solves.get(d) ?? 0), 0);
  return { label, avg: g / Math.max(1, dates.length), rate: g ? (s / g) * 1000 : 0 };
});

const W = 400;
const H = 220;
const PAD = { l: 40, r: 34, t: 18, b: 34 };
const maxAvg = Math.max(...byDay.map((d) => d.avg));
const maxRate = Math.max(...byDay.map((d) => d.rate));
const bandW = (W - PAD.l - PAD.r) / DAYS.length;

const yBar = (v: number) => H - PAD.b - (v / maxAvg) * (H - PAD.t - PAD.b);
const yLine = (v: number) => H - PAD.b - (v / (maxRate * 1.15)) * (H - PAD.t - PAD.b);

export default function WeekdayChart() {
  const linePath = byDay
    .map((d, i) => `${i === 0 ? "M" : "L"}${PAD.l + bandW * (i + 0.5)},${yLine(d.rate).toFixed(1)}`)
    .join(" ");

  return (
    <figure className="my-6">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby="wdc-title wdc-desc"
        className="w-full rounded-lg border border-border bg-muted/20"
      >
        <title id="wdc-title">Rateversuche und Lösungsquote je Wochentag</title>
        <desc id="wdc-desc">
          Balken zeigen die durchschnittlichen Rateversuche je Wochentag, eine Linie darüber die
          Lösungen je 1.000 Versuche. Von Montag bis Freitag liegen die Balken hoch, bei rund
          11.600 bis 15.080 Versuchen, am Samstag und Sonntag fallen sie auf rund 9.080 und 8.550.
          Die Linie verläuft gegenläufig: Sie erreicht am Sonntag mit 15,4 Lösungen je 1.000
          Versuchen ihren Höchstwert und am Freitag mit 10,5 ihren tiefsten.
        </desc>

        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} className="stroke-border" strokeWidth={1} />

        {byDay.map((d, i) => (
          <g key={d.label}>
            <rect
              x={PAD.l + bandW * i + bandW * 0.18}
              y={yBar(d.avg)}
              width={bandW * 0.64}
              height={H - PAD.b - yBar(d.avg)}
              className="fill-muted-foreground/25"
            />
            <text
              x={PAD.l + bandW * (i + 0.5)}
              y={H - PAD.b + 13}
              textAnchor="middle"
              className="fill-muted-foreground text-[9px]"
            >
              {d.label}
            </text>
          </g>
        ))}

        <path d={linePath} className="stroke-foreground" strokeWidth={2} fill="none" />
        {byDay.map((d, i) => (
          <circle
            key={`p-${d.label}`}
            cx={PAD.l + bandW * (i + 0.5)}
            cy={yLine(d.rate)}
            r={3}
            className="fill-foreground"
          />
        ))}

        <text x={PAD.l} y={PAD.t - 5} className="fill-muted-foreground text-[8px]">
          Balken: Rateversuche je Tag
        </text>
        <text x={W - PAD.r} y={PAD.t - 5} textAnchor="end" className="fill-muted-foreground text-[8px]">
          Linie: Lösungen je 1.000
        </text>
      </svg>
      <figcaption className="mt-2 text-center text-xs text-muted-foreground">
        Gegenläufig: Am Wochenende wird deutlich weniger gespielt und deutlich effizienter gelöst.
        Gerechnet aus 31 Tagesreihen, jede Zahl serverseitig gezählt.
      </figcaption>
    </figure>
  );
}
