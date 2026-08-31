/**
 * Zeigt, warum die Rangskala ungleichmaessig ist: Die Kosinus-Aehnlichkeiten
 * aller Vokabelwoerter zum Zielwort draengen sich in einem schmalen Band,
 * vorne liegen wenige Woerter mit echtem Abstand, hinten Zehntausende ohne.
 *
 * Schematisch, nicht aus Messdaten gezeichnet: Die Aussage ist die Form der
 * Verteilung, nicht ihr exakter Verlauf. Genau das sagt auch die Bildunterschrift.
 * Fuer Screenreader beschrieben ueber title und desc.
 */
export default function RankBandDiagram() {
  // Rang -> Ähnlichkeit, stark fallend und dann fast flach.
  const points = Array.from({ length: 61 }, (_, i) => {
    const rank = i / 60; // 0 .. 1
    const sim = Math.exp(-6 * rank) * 0.55 + 0.04;
    return [40 + rank * 340, 200 - sim * 300] as const;
  });
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  const bands: [number, number, string, string][] = [
    [40, 62, "1-300", "fill-green-600/15"],
    [102, 74, "301-1500", "fill-yellow-600/15"],
    [176, 204, "ab 1501", "fill-rose-600/10"],
  ];

  return (
    <figure className="my-6">
      <svg
        viewBox="0 0 400 240"
        role="img"
        aria-labelledby="rbd-title rbd-desc"
        className="w-full rounded-lg border border-border bg-muted/20"
      >
        <title id="rbd-title">Verteilung der Ähnlichkeit über die Rangliste</title>
        <desc id="rbd-desc">
          Eine Kurve fällt von links steil ab und verläuft danach fast waagerecht. Links, im
          grünen Bereich der Ränge 1 bis 300, liegen wenige Wörter mit deutlich
          unterschiedlicher Ähnlichkeit. Rechts, ab Rang 1501, drängen sich Zehntausende Wörter
          in einem sehr schmalen Ähnlichkeitsband, ihre Ränge unterscheiden sich kaum noch.
        </desc>

        {bands.map(([x, w, label, cls]) => (
          <g key={label}>
            <rect x={x} y={20} width={w} height={180} className={cls} />
            <text
              x={x + w / 2}
              y={216}
              textAnchor="middle"
              className="fill-muted-foreground text-[9px]"
            >
              {label}
            </text>
          </g>
        ))}

        <line x1={40} y1={200} x2={380} y2={200} className="stroke-border" strokeWidth={1} />
        <line x1={40} y1={20} x2={40} y2={200} className="stroke-border" strokeWidth={1} />

        <path d={path} className="stroke-foreground" strokeWidth={2} fill="none" />

        <text x={40} y={14} className="fill-muted-foreground text-[9px]">
          Ähnlichkeit
        </text>
        <text x={380} y={234} textAnchor="end" className="fill-muted-foreground text-[9px]">
          Rang, 1 bis 80.000
        </text>
      </svg>
      <figcaption className="mt-2 text-center text-xs text-muted-foreground">
        Schematischer Verlauf: Vorne entsprechen wenige Ränge einem großen
        Bedeutungsunterschied, hinten entsprechen Tausende Ränge fast keinem. Deshalb ist ein
        Sprung von Rang 300 auf 90 wertvoll und einer von 9.000 auf 6.000 fast bedeutungslos.
      </figcaption>
    </figure>
  );
}
