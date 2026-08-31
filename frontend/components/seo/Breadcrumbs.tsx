import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  name: string;
  path: string;
}

/**
 * Sichtbare Brotkrümelnavigation.
 *
 * Das BreadcrumbList-JSON-LD gab es hier schon, die sichtbare Entsprechung
 * nicht. Beides gehoert zusammen: Googles strukturierte Daten sollen
 * beschreiben, was auf der Seite steht, und eine Brotkrümelleiste ohne
 * Gegenstueck im Sichtbaren beschreibt nichts. Fuer Lesende ist sie ausserdem
 * der schnellste Weg eine Ebene nach oben, gerade auf dem Telefon.
 *
 * Der letzte Eintrag ist kein Link und traegt aria-current="page".
 */
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Brotkrümelnavigation" className="mt-4 text-xs text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={c.path} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />}
              {last ? (
                <span aria-current="page" className="text-foreground">
                  {c.name}
                </span>
              ) : (
                <Link href={c.path} className="transition-colors hover:text-foreground">
                  {c.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
