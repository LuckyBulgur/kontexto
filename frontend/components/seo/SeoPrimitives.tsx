import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { Panel } from "@/components/design";
import { cn } from "@/lib/utils";

/**
 * Shared, JS-free presentational building blocks for the SEO/info content that
 * renders around the game on every page. All pieces are React Server Components
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
  label = "Über dieses Spiel",
}: {
  children: React.ReactNode;
  className?: string;
  /** Zugänglicher Name der Region. Ohne ihn liegt der Inhalt in keiner Landmark. */
  label?: string;
}) {
  return (
    <section
      aria-label={label}
      className={cn("mt-12 border-t border-border bg-muted/30", className)}
    >
      <div className="mx-auto max-w-[68ch] px-4 pb-16 pt-10 text-body leading-relaxed text-muted-foreground sm:pt-12">
        {children}
      </div>
    </section>
  );
}

/** Section heading (h2). Page-specific SEO components provide the page h1. */
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
        "mt-12 mb-3 text-h2 text-foreground first:mt-0",
        className,
      )}
    >
      {children}
    </h2>
  );
}

/** Responsive grid for FeatureCards. */
export function FeatureGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))]">
      {children}
    </div>
  );
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
    <Panel padding="sm" className="gap-3">
      <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <h3 className="text-h3 text-foreground">{title}</h3>
        <p className="text-small text-muted-foreground">{children}</p>
      </div>
    </Panel>
  );
}

/** Ordered list of steps (semantic <ol> for assistive tech). */
export function StepList({ children }: { children: React.ReactNode }) {
  // auto-fit, not a fixed three: /anleitung/ has four steps, and a hard
  // three-column grid left the fourth one stranded alone on its own row.
  return (
    <ol className="grid list-none gap-4 [grid-template-columns:repeat(auto-fit,minmax(13rem,1fr))]">
      {children}
    </ol>
  );
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
    <Panel asChild padding="sm" className="gap-3">
      <li>
        <span
          data-numeric
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary font-display text-small font-bold text-primary-foreground"
          aria-hidden="true"
        >
          {index}
        </span>
        <div className="flex flex-col gap-1">
          <h3 className="text-h3 text-foreground">{title}</h3>
          <p className="text-small text-muted-foreground">{children}</p>
        </div>
      </li>
    </Panel>
  );
}

/**
 * Color/rank legend. The colored dot is decorative (aria-hidden); the meaning is
 * carried by the text label so color-blind and screen-reader users get full info.
 */
export function ColorLegend() {
  const rows = [
    { dot: "bg-rank-near", label: "Grün", range: "Rang 1–100", desc: "sehr nah am Zielwort" },
    { dot: "bg-rank-mid", label: "Gelb", range: "Rang 101–600", desc: "auf dem richtigen Weg" },
    { dot: "bg-rank-far", label: "Rot", range: "Rang 601+", desc: "noch weit entfernt" },
  ] as const;
  return (
    <Panel asChild>
      <ul className="list-none gap-3">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-3">
          <span
            className={cn("inline-block h-3 w-3 shrink-0 rounded-full", r.dot)}
            aria-hidden="true"
          />
          <span className="text-small">
            <span className="font-semibold text-foreground">{r.label}</span>{" "}
            <span className="text-muted-foreground">{r.range}, {r.desc}</span>
          </span>
        </li>
      ))}
      </ul>
    </Panel>
  );
}

export type RelatedLink = { href: string; label: string };

/**
 * "Discover more" card: an intentional, card-styled internal-link list. Visually
 * distinct from the grouped global Footer so it does not read as accidental
 * duplication. Uses a unique aria-label per usage.
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
    <Panel asChild padding="none" className="gap-0 p-2">
      <nav aria-label={label}>
        <p className="px-3 pb-1 pt-2 text-micro font-semibold text-muted-foreground">
          {heading}
        </p>
      <ul className="list-none">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="group flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-small font-medium text-foreground transition-colors hover:bg-accent"
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
    </Panel>
  );
}
