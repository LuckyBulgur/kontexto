/**
 * Der Weg vom Sprachmodell zur fertigen Rangtabelle, als Ablauf in fuenf
 * Schritten. Alles davon passiert offline beim Bauen der Spieldaten; zur
 * Laufzeit bleibt ein Tabellenzugriff.
 *
 * Fuer Screenreader ueber title und desc beschrieben, damit die Grafik nicht
 * die einzige Quelle der Information ist.
 */
const STEPS: [string, string][] = [
  ["fastText", "cc.de.300, rund 2 Mio. Zeichenketten"],
  ["Filtern", "80.000 echte deutsche Wörter"],
  ["Entzerren", "Mittelwert und 3 Hauptkomponenten entfernt"],
  ["Sortieren", "Kosinus-Ähnlichkeit zum Zielwort"],
  ["Rangtabelle", "eine Datei je Rätsel"],
];

export default function PipelineDiagram() {
  const h = 46;
  const gap = 14;

  return (
    <figure className="my-6">
      <svg
        viewBox={`0 0 400 ${STEPS.length * (h + gap) + 6}`}
        role="img"
        aria-labelledby="pd-title pd-desc"
        className="w-full rounded-lg border border-border bg-muted/20"
      >
        <title id="pd-title">Vom Sprachmodell zur Rangtabelle</title>
        <desc id="pd-desc">
          Fünf aufeinanderfolgende Schritte: Aus dem deutschen fastText-Modell mit rund zwei
          Millionen Zeichenketten werden 80.000 echte Wörter gefiltert. Deren Vektoren werden
          entzerrt, indem Mittelwert und die drei stärksten Hauptkomponenten entfernt werden.
          Danach wird für jedes Rätsel die Kosinus-Ähnlichkeit aller Wörter zum Zielwort
          berechnet und sortiert. Das Ergebnis ist eine Rangtabelle je Rätsel. Alle Schritte
          laufen offline vor dem Spiel.
        </desc>

        {STEPS.map(([title, sub], i) => {
          const y = 4 + i * (h + gap);
          return (
            <g key={title}>
              <rect
                x={40}
                y={y}
                width={320}
                height={h}
                rx={8}
                className="fill-card stroke-border"
                strokeWidth={1}
              />
              <text x={56} y={y + 20} className="fill-foreground text-[12px] font-semibold">
                {i + 1}. {title}
              </text>
              <text x={56} y={y + 36} className="fill-muted-foreground text-[10px]">
                {sub}
              </text>
              {i < STEPS.length - 1 && (
                <path
                  d={`M200,${y + h} L200,${y + h + gap - 3}`}
                  className="stroke-muted-foreground"
                  strokeWidth={1.5}
                  markerEnd="url(#pd-arrow)"
                />
              )}
            </g>
          );
        })}

        <defs>
          <marker id="pd-arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" className="fill-muted-foreground" />
          </marker>
        </defs>
      </svg>
      <figcaption className="mt-2 text-center text-xs text-muted-foreground">
        Alle fünf Schritte laufen offline, bevor jemand spielt. Zur Laufzeit bleibt ein
        Nachschlagen in der fertigen Tabelle, deshalb ist die Antwort sofort da und der Rang
        über den ganzen Tag stabil.
      </figcaption>
    </figure>
  );
}
