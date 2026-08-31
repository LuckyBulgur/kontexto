import Link from "next/link";

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
 * Die Liste bleibt kurz: Spielmodi und die tragenden Inhaltsseiten. Rechts- und
 * Lobby-Seiten stehen weiterhin nur in der Fusszeile, sie gehoeren nicht in
 * jeden Seitenkopf.
 */
const items = [
  { href: "/", label: "Spiel" },
  { href: "/wordle/", label: "Wördle" },
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
    <nav
      aria-label="Hauptnavigation"
      className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-b border-border pb-3 text-sm"
    >
      {items.map((i) => {
        const active = current === i.href;
        return (
          <Link
            key={i.href}
            href={i.href}
            // Kein Prefetch: Next holt sonst beim Sichtbarwerden der Leiste die
            // RSC-Payload jedes Ziels, gemessen rund 350 kB je Seitenaufruf fuer
            // zehn Links, von denen hoechstens einer geklickt wird. Bei einer
            // Leiste, die auf jeder Seite steht, ist das reine Last, vor allem
            // mobil.
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "font-medium text-foreground"
                : "text-muted-foreground transition-colors hover:text-foreground"
            }
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
