import { List } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TocItem {
  id: string;
  label: string;
}

/** Anchor navigation for long content pages. Server-rendered, fully crawlable. */
export default function TableOfContents({
  items,
  className,
}: {
  items: TocItem[];
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <nav
      aria-label="Inhalt dieser Seite"
      className={cn("rounded-xl border border-border bg-muted/30 p-4 text-small", className)}
    >
      <p className="mb-2 flex items-center gap-2 font-semibold text-foreground">
        <List className="size-4 text-muted-foreground" aria-hidden="true" />
        Auf dieser Seite
      </p>
      <ol className="space-y-1">
        {items.map((it) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              className="block rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {it.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
