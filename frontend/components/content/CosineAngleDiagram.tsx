/**
 * Der Winkel zwischen zwei Wortvektoren, an drei Beispielen. Zeigt, warum die
 * Laenge eines Vektors nichts zur Aehnlichkeit beitraegt: Nur die Richtung
 * zaehlt.
 *
 * Die Koordinaten sind erfunden, aber plausibel gewaehlt, und genau diese
 * Zahlen stehen im Fliesstext zum Nachrechnen. Fuer Screenreader ueber title
 * und desc beschrieben.
 */
const O = [50, 190] as const;
const SCALE = 15;

const VECTORS: [string, number, number, string][] = [
  ["Hund", 8, 6, "stroke-foreground"],
  ["Katze", 7, 7, "stroke-emerald-600"],
  ["Tisch", 1, 9, "stroke-rose-600"],
];

export default function CosineAngleDiagram() {
  return (
    <figure className="my-6">
      <svg
        viewBox="0 0 300 210"
        role="img"
        aria-labelledby="cad-title cad-desc"
        className="w-full rounded-lg border border-border bg-muted/20"
      >
        <title id="cad-title">Der Winkel zwischen Wortvektoren</title>
        <desc id="cad-desc">
          Drei Pfeile gehen vom selben Ursprung aus. Die Pfeile für „Hund“ mit den Koordinaten 8
          und 6 und für „Katze“ mit 7 und 7 zeigen fast in dieselbe Richtung, der Winkel
          zwischen ihnen ist klein und die Kosinus-Ähnlichkeit beträgt etwa 0,99. Der Pfeil für
          „Tisch“ mit 1 und 9 zeigt deutlich steiler nach oben, der Winkel ist groß und die
          Ähnlichkeit beträgt nur etwa 0,68.
        </desc>

        <line x1={O[0]} y1={O[1]} x2={O[0]} y2={16} className="stroke-border" strokeWidth={1} />
        <line x1={O[0]} y1={O[1]} x2={284} y2={O[1]} className="stroke-border" strokeWidth={1} />
        <text x={O[0] - 6} y={14} textAnchor="end" className="fill-muted-foreground text-[9px]">
          Achse 2
        </text>
        <text x={284} y={204} textAnchor="end" className="fill-muted-foreground text-[9px]">
          Achse 1
        </text>

        {VECTORS.map(([label, x, y, cls]) => {
          const ex = O[0] + x * SCALE;
          const ey = O[1] - y * SCALE;
          return (
            <g key={label}>
              <line x1={O[0]} y1={O[1]} x2={ex} y2={ey} className={cls} strokeWidth={2} />
              <circle cx={ex} cy={ey} r={3} className={cls.replace("stroke-", "fill-")} />
              <text x={ex + 6} y={ey - 4} className="fill-foreground text-[10px] font-medium">
                {label} ({x}, {y})
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 text-center text-xs text-muted-foreground">
        Nur die Richtung zählt, nicht die Länge. „Hund“ und „Katze“ zeigen fast gleich, der
        Kosinus liegt bei etwa 0,99. „Tisch“ weicht deutlich ab, obwohl sein Punkt auf dem Blatt
        nicht weit entfernt liegt: etwa 0,68.
      </figcaption>
    </figure>
  );
}
