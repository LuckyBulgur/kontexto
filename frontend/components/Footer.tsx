import Link from "next/link";
import { Heart } from "lucide-react";
import { AUTHOR_PROFILES } from "@/lib/author";
import { SITE_PROFILES } from "@/lib/social";
import SupportFooterLink from "@/components/SupportFooterLink";
import { Wordmark } from "@/components/design";

const socials = [...SITE_PROFILES, ...AUTHOR_PROFILES];

type FooterLink = { href: string; label: string };

const playLinks = [
  { href: "/", label: "Kontexto" },
  { href: "/wordle/", label: "Wördle" },
  // Zeigt auf die Inhaltsseite, nicht auf das Erstellen-Formular: Letzteres
  // traegt noindex und bleibt aus der dauerhaften Navigation heraus.
  { href: "/koop/", label: "Koop" },
  { href: "/duel/", label: "Duell" },
  // The in-game mode picker is a dialog. This page is the durable, linkable
  // version of it, so the footer is where it belongs.
  { href: "/modi/", label: "Alle Modi" },
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

const projectLinks: FooterLink[] = [
  { href: "/ueber/", label: "Über" },
  { href: "/redaktion/", label: "Redaktion" },
  { href: "/mitmachen/", label: "Clip einreichen" },
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
  withSupport = false,
}: {
  title: string;
  links: FooterLink[];
  withSupport?: boolean;
}) {
  return (
    <div>
      <h2 className="text-micro font-semibold text-foreground">{title}</h2>
      <ul className="mt-3 space-y-2 text-small">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} prefetch={false} className="transition-colors hover:text-foreground">
              {link.label}
            </Link>
          </li>
        ))}
        {withSupport && (
          <li>
            <SupportFooterLink className="transition-colors hover:text-foreground" />
          </li>
        )}
      </ul>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="border-t border-border text-muted-foreground">
      {/* pb-24 below lg: the support and feedback buttons float in the two bottom
          corners, and the last row of the footer has to scroll out from under them. */}
      <div className="mx-auto max-w-6xl px-4 pt-8 pb-24 sm:px-6 sm:pt-10 lg:pb-10">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-[1.25fr_repeat(3,1fr)] lg:gap-10">
          <div className="col-span-2 lg:col-span-1">
            <Wordmark size="md" />
            <p className="mt-3 max-w-xs text-small leading-6">
              Das tägliche deutsche Wort-Ratespiel, direkt im Browser.
            </p>
          </div>
          <FooterGroup title="Spielen" links={playLinks} />
          <FooterGroup title="Lesen" links={readingLinks} />
          <div className="col-span-2 grid grid-cols-2 gap-x-6 gap-y-8 lg:col-span-1 lg:grid-cols-1 lg:gap-8">
            <FooterGroup title="Projekt" links={projectLinks} withSupport />
            <FooterGroup title="Rechtliches" links={legalLinks} />
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4 border-t border-border pt-5 text-micro sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p>© Kontexto, das deutsche Wort-Ratespiel, entwickelt von Ugur Aydogan</p>
            <p className="mt-1 inline-flex items-center gap-1">
              Made with
              <Heart className="h-3 w-3 fill-destructive text-destructive" aria-hidden="true" />
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
