import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Responsive, horizontally scrollable comparison table. First column is treated
 * as a row header. Server-rendered for crawlability.
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
    <div className="my-6 overflow-x-auto rounded-lg border border-border">
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
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={cn(
                    "px-3 py-2.5 align-top",
                    ci === 0 ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
