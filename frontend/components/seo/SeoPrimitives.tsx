import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared, JS-free presentational building blocks for the SEO/info content that
 * renders below the game on every page. All pieces are React Server Components
 * (no "use client", no hooks) so their full text lands in the static HTML export
 * and stays crawlable. Interactivity is CSS-only.
 */

/**
 * Wraps an info zone below the game. The top border + tinted band + generous top
 * padding give a deliberate visual break from the interactive game above, so the
 * content reads as an intentional "learn more" area rather than pasted-on text.
 */
export function SeoSection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mt-12 border-t border-border bg-muted/30", className)}>
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-10 text-sm leading-relaxed text-muted-foreground sm:pt-12">
        {children}
      </div>
    </section>
  );
}

/** Section heading (h2). The single page h1 lives in each Seo component's body. */
export function SeoHeading({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "mb-3 mt-10 text-lg font-semibold text-foreground first:mt-0",
        className,
      )}
    >
      {children}
    </h2>
  );
}

/** Responsive grid for FeatureCards. */
export function FeatureGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

/** Benefit card: decorative icon chip + title + short description. */
export function FeatureCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-foreground">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mb-1 text-sm font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

/** Ordered list of steps (semantic <ol> for assistive tech). */
export function StepList({ children }: { children: React.ReactNode }) {
  return <ol className="grid gap-4 sm:grid-cols-3">{children}</ol>;
}

/** A single numbered step card. */
export function Step({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="rounded-xl border bg-card p-5">
      <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {index}
      </div>
      <h3 className="mb-1 text-sm font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{children}</p>
    </li>
  );
}

/**
 * Color/rank legend. The colored dot is decorative (aria-hidden); the meaning is
 * carried by the text label so color-blind and screen-reader users get full info.
 */
export function ColorLegend() {
  const rows = [
    { dot: "bg-green-500", label: "Grün", range: "Rang 1–300", desc: "sehr nah am Zielwort" },
    { dot: "bg-yellow-500", label: "Gelb", range: "Rang 301–1500", desc: "auf dem richtigen Weg" },
    { dot: "bg-red-500", label: "Rot", range: "Rang 1501+", desc: "noch weit entfernt" },
  ] as const;
  return (
    <ul className="list-none space-y-3 rounded-xl border bg-card p-5">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-3">
          <span
            className={cn("inline-block h-3 w-3 shrink-0 rounded-full", r.dot)}
            aria-hidden="true"
          />
          <span className="text-sm">
            <span className="font-medium text-foreground">{r.label}</span>{" "}
            <span className="text-muted-foreground">({r.range})</span>{" "}
            <span className="text-muted-foreground">– {r.desc}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export type RelatedLink = { href: string; label: string };

/**
 * "Discover more" card: an intentional, card-styled internal-link list. Visually
 * distinct from the global Footer (which is a small centered pill row) so it does
 * not read as accidental duplication. Uses a unique aria-label per usage.
 */
export function RelatedLinks({
  heading,
  links,
  label,
}: {
  heading: string;
  links: RelatedLink[];
  label: string;
}) {
  return (
    <nav aria-label={label} className="rounded-xl border bg-card p-2">
      <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {heading}
      </p>
      <ul className="list-none">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="group flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <span>{l.label}</span>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
