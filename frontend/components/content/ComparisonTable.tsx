import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Responsive, horizontally scrollable comparison table. Server-rendered for
 * crawlability.
 *
 * Der Scrollbereich ist fokussierbar und als benannte Region ausgezeichnet.
 * Ohne das erreicht eine Tastaturnutzerin den ueberstehenden Teil einer breiten
 * Tabelle nicht (axe-Regel "scrollable-region-focusable", WCAG 2.1.1). Die
 * erste Spalte ist ein echter Zeilenkopf (`th scope="row"`), nicht nur fett
 * gesetzt: Erst dadurch liest ein Screenreader "Merkmal Sprache, Kontexto
 * Deutsch" statt einer Folge zusammenhangloser Zellen.
 */
export default function ComparisonTable({
  columns,
  rows,
  caption,
}: {
  columns: string[];
  rows: ReactNode[][];
  caption?: string;
}) {
  return (
    <div
      className="my-6 overflow-x-auto rounded-lg border border-border"
      tabIndex={0}
      role="region"
      aria-label={caption}
    >
      <table className="w-full border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="bg-muted/50">
            {columns.map((c, i) => (
              <th
                key={i}
                scope="col"
                className="px-3 py-2.5 text-left font-semibold text-foreground"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-t border-border">
              {row.map((cell, ci) =>
                ci === 0 ? (
                  <th
                    key={ci}
                    scope="row"
                    className="px-3 py-2.5 text-left align-top font-medium text-foreground"
                  >
                    {cell}
                  </th>
                ) : (
                  <td key={ci} className={cn("px-3 py-2.5 align-top text-muted-foreground")}>
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
