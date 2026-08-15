import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Typography container for runs of authored prose (headings, paragraphs, lists,
 * inline links). Deliberately scoped: only wrap plain text with this, never
 * structured card components (Step, ColorLegend, ComparisonTable, …), whose own
 * styles would otherwise be overridden by these descendant selectors.
 *
 * `h2`/`h3` get `scroll-mt` so in-page anchor links land below the fixed
 * spacing rather than flush against the top.
 */
export default function Prose({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-4 text-base leading-7 text-muted-foreground",
        "[&_h2]:scroll-mt-24 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground",
        "[&_h3]:scroll-mt-24 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground",
        "[&_p]:leading-7",
        "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
        "[&_strong]:font-semibold [&_strong]:text-foreground",
        "[&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
        "[&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
