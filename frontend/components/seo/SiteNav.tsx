import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Seitenweite Hauptnavigation fuer alle Inhalts- und Blogseiten.
 *
 * Bewusst eine Server Component ohne State: Der Spiel-Header
 * (components/Header.tsx) ist ein Client Component mit Kebab-Menue und
 * existiert auf Inhaltsseiten gar nicht. Im statischen Export stand dort bisher
 * nur "Zurueck zum Spiel" plus Fusszeile, jede Inhaltsseite war also nur ueber
 * den Footer erreichbar. Googles Nutzungskriterien pruefen ausdruecklich, ob
 * eine Website navigierbar ist, und "minderwertige Inhalte" deckt genau diesen
 * Fall mit ab.
 *
 * Die Liste bleibt bei den tragenden Spiel- und Inhaltsseiten. Rechtliche
 * Seiten stehen weiterhin im Footer, damit der Kopf nicht zur Linkliste wird.
 */
const items = [
  { href: "/", label: "Spiel" },
  { href: "/wordle/", label: "Wördle" },
  { href: "/modi/", label: "Modi" },
  { href: "/anleitung/", label: "Anleitung" },
  { href: "/strategie/", label: "Strategie" },
  { href: "/vergleich/", label: "Vergleich" },
  { href: "/glossar/", label: "Glossar" },
  { href: "/faq/", label: "FAQ" },
  { href: "/blog/", label: "Blog" },
  { href: "/zahlen/", label: "Zahlen" },
  { href: "/ueber/", label: "Über" },
] as const;

export default function SiteNav({ current }: { current?: string }) {
  return (
    <div className="mt-3 border-b border-border pb-3 sm:mt-4">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/"
          className="shrink-0 text-sm font-bold tracking-[0.16em] text-foreground"
        >
          KONTEXTO
        </Link>
        <Link
          href="/"
          prefetch={false}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-foreground"
        >
          Zum Spiel
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      <nav aria-label="Hauptnavigation" className="mt-3 flex flex-wrap gap-1 text-sm">
        {items.map((i) => {
          const active = current === i.href;
          return (
            <Link
              key={i.href}
              href={i.href}
              // Kein Prefetch: Next holt sonst beim Sichtbarwerden der Leiste die
              // RSC-Payload jedes Ziels, obwohl hoechstens einer der Links geklickt
              // wird. Bei einer Leiste auf jeder Inhaltsseite ist das mobile Last.
              prefetch={false}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "rounded-md bg-foreground px-2.5 py-1.5 font-medium text-background"
                  : "rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              }
            >
              {i.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
