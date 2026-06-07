/**
 * Schematic 2-D illustration of word embeddings: the target word sits in the
 * centre, semantically related words cluster nearby, unrelated words sit far
 * away. Decorative but described for assistive tech via <title>/<desc>.
 */
export default function VectorSpaceDiagram() {
  // [x, y, label, near?]
  const points: [number, number, string, boolean][] = [
    [200, 130, "Strand", true],
    [150, 95, "Küste", true],
    [255, 110, "Sand", true],
    [170, 175, "Meer", true],
    [60, 55, "Computer", false],
    [330, 215, "Steuer", false],
  ];
  const [cx, cy] = [points[0][0], points[0][1]];

  return (
    <figure className="my-6">
      <svg
        viewBox="0 0 400 260"
        role="img"
        aria-labelledby="vsd-title vsd-desc"
        className="w-full rounded-lg border border-border bg-muted/20"
      >
        <title id="vsd-title">Wörter im Vektorraum</title>
        <desc id="vsd-desc">
          Das Zielwort „Strand" liegt im Zentrum. Bedeutungsverwandte Wörter wie
          „Küste", „Sand" und „Meer" liegen nah dabei, während unverwandte Wörter
          wie „Computer" und „Steuer" weit entfernt sind.
        </desc>

        {/* connection lines from target to nearby words */}
        {points.slice(1).map(([x, y, label, near]) => (
          <line
            key={`l-${label}`}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            className={near ? "stroke-emerald-500/50" : "stroke-rose-500/30"}
            strokeWidth={1}
            strokeDasharray={near ? undefined : "3 3"}
          />
        ))}

        {points.map(([x, y, label, near], i) => {
          const isTarget = i === 0;
          return (
            <g key={label}>
              <circle
                cx={x}
                cy={y}
                r={isTarget ? 7 : 4.5}
                className={
                  isTarget
                    ? "fill-emerald-500"
                    : near
                      ? "fill-emerald-500/70"
                      : "fill-rose-500/70"
                }
              />
              <text
                x={x}
                y={y - (isTarget ? 12 : 9)}
                textAnchor="middle"
                className={`fill-foreground ${isTarget ? "text-[13px] font-semibold" : "text-[11px]"}`}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 text-center text-xs text-muted-foreground">
        Vereinfachte Darstellung: In Wirklichkeit hat der Vektorraum hunderte Dimensionen.
      </figcaption>
    </figure>
  );
}
