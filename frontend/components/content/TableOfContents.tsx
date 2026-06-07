import { List } from "lucide-react";

export interface TocItem {
  id: string;
  label: string;
}

/** Anchor navigation for long content pages. Server-rendered, fully crawlable. */
export default function TableOfContents({ items }: { items: TocItem[] }) {
  if (items.length === 0) return null;
  return (
    <nav
      aria-label="Inhalt dieser Seite"
      className="mb-10 rounded-lg border border-border bg-muted/30 p-4 text-sm"
    >
      <p className="mb-2 flex items-center gap-2 font-semibold text-foreground">
        <List className="size-4 text-muted-foreground" aria-hidden="true" />
        Auf dieser Seite
      </p>
      <ol className="space-y-1.5">
        {items.map((it) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              className="text-muted-foreground transition-colors hover:text-primary hover:underline"
            >
              {it.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
