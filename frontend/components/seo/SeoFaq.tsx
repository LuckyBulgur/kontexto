import { ChevronDown } from "lucide-react";
import { faqs } from "@/lib/faqs";

/**
 * FAQ list built from native <details>/<summary>. Stays a Server Component, so all
 * answer text is always present in the static HTML export (collapsed content is in
 * the DOM, not display:none) and remains fully crawlable — unlike a client-side
 * accordion. Keyboard- and screen-reader-accessible with zero ARIA.
 */
export default function SeoFaq() {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border bg-card">
      {faqs.map((f) => (
        <details key={f.q} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-foreground transition-colors hover:bg-accent [&::-webkit-details-marker]:hidden">
            <span>{f.q}</span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="px-5 pb-4 pt-0 text-sm text-muted-foreground">{f.a}</div>
        </details>
      ))}
    </div>
  );
}
