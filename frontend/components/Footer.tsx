import Link from "next/link";
import { Heart } from "lucide-react";
import ConsentSettingsLink from "@/components/ConsentSettingsLink";
import { AUTHOR_PROFILES } from "@/lib/author";

const socials = AUTHOR_PROFILES;

const playLinks = [
  { href: "/", label: "Kontexto" },
  { href: "/wordle/", label: "Wördle" },
  // Zeigt auf die Inhaltsseite, nicht auf das Erstellen-Formular: Letzteres
  // traegt noindex und bleibt aus der dauerhaften Navigation heraus.
  { href: "/koop/", label: "Koop" },
  { href: "/duel/", label: "Duell" },
];

const readingLinks = [
  { href: "/anleitung/", label: "Anleitung" },
  { href: "/strategie/", label: "Strategie" },
  { href: "/vergleich/", label: "Vergleich" },
  { href: "/glossar/", label: "Glossar" },
  { href: "/faq/", label: "FAQ" },
  { href: "/blog/", label: "Blog" },
  { href: "/zahlen/", label: "Zahlen" },
  { href: "/changelog/", label: "Änderungen" },
];

const projectLinks = [
  { href: "/ueber/", label: "Über" },
  { href: "/redaktion/", label: "Redaktion" },
  { href: "/kontakt/", label: "Kontakt" },
];

const legalLinks = [
  { href: "/impressum/", label: "Impressum" },
  { href: "/nutzungsbedingungen/", label: "Nutzungsbedingungen" },
  // Der Haftungsausschluss ist Abschnitt 6 der Nutzungsbedingungen. Eine eigene
  // Seite dafuer waere ein Duplikat; der Anker macht ihn unter dem Namen
  // auffindbar, unter dem Prueflisten ihn suchen.
  { href: "/nutzungsbedingungen/#haftungsausschluss", label: "Haftungsausschluss" },
  { href: "/cookies/", label: "Cookies" },
  { href: "/datenschutz/", label: "Datenschutz" },
];

function FooterGroup({
  title,
  links,
  showConsentSettings = false,
}: {
  title: string;
  links: { href: string; label: string }[];
  showConsentSettings?: boolean;
}) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} prefetch={false} className="transition-colors hover:text-foreground">
              {link.label}
            </Link>
          </li>
        ))}
        {showConsentSettings && (
          <li>
            <ConsentSettingsLink className="cursor-pointer transition-colors hover:text-foreground" />
          </li>
        )}
      </ul>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-border text-muted-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-[1.25fr_repeat(3,1fr)] lg:gap-10">
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" className="text-sm font-bold tracking-[0.16em] text-foreground">
              KONTEXTO
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-6">
              Das tägliche deutsche Wort-Ratespiel, direkt im Browser.
            </p>
          </div>
          <FooterGroup title="Spielen" links={playLinks} />
          <FooterGroup title="Lesen" links={readingLinks} />
          <div className="col-span-2 grid grid-cols-2 gap-x-6 gap-y-8 lg:col-span-1 lg:grid-cols-1 lg:gap-8">
            <FooterGroup title="Projekt" links={projectLinks} />
            <FooterGroup title="Rechtliches" links={legalLinks} showConsentSettings />
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4 border-t border-border pt-5 text-xs sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p>© Kontexto, das deutsche Wort-Ratespiel · entwickelt von Ugur Aydogan</p>
            <p className="mt-1 inline-flex items-center gap-1">
              Made with
              <Heart className="h-3 w-3 fill-red-500 text-red-500" aria-hidden="true" />
              <span className="sr-only">Liebe</span>
              in Hannover
            </p>
          </div>
          <div className="flex items-center gap-4 sm:justify-end">
            {socials.map((s) => (
              <a
                key={s.href}
                href={s.href}
                target="_blank"
                rel="me noopener noreferrer"
                aria-label={s.label}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true" focusable="false">
                  <path d={s.path} />
                </svg>
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
