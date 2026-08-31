import Link from "next/link";
import { Heart } from "lucide-react";
import ConsentSettingsLink from "@/components/ConsentSettingsLink";
import { AUTHOR_PROFILES } from "@/lib/author";

const socials = AUTHOR_PROFILES;

const links = [
  { href: "/", label: "Kontexto" },
  { href: "/wordle/", label: "Wördle" },
  // Zeigt auf die Inhaltsseite, nicht auf das Erstellen-Formular: Letzteres
  // traegt noindex, und ein Footer-Link auf jeder Seite ist der staerkste
  // interne Verweis, den die Site zu vergeben hat.
  { href: "/koop/", label: "Koop" },
  { href: "/duel/", label: "Duell" },
  { href: "/anleitung/", label: "Anleitung" },
  { href: "/strategie/", label: "Strategie" },
  { href: "/vergleich/", label: "Vergleich" },
  { href: "/glossar/", label: "Glossar" },
  { href: "/faq/", label: "FAQ" },
  { href: "/blog/", label: "Blog" },
  { href: "/zahlen/", label: "Zahlen" },
  { href: "/changelog/", label: "Änderungen" },
  { href: "/ueber/", label: "Über" },
  { href: "/redaktion/", label: "Redaktion" },
  { href: "/kontakt/", label: "Kontakt" },
  { href: "/impressum/", label: "Impressum" },
  { href: "/nutzungsbedingungen/", label: "Nutzungsbedingungen" },
  // Der Haftungsausschluss ist Abschnitt 6 der Nutzungsbedingungen. Eine eigene
  // Seite dafuer waere ein Duplikat; der Anker macht ihn unter dem Namen
  // auffindbar, unter dem Prueflisten ihn suchen.
  { href: "/nutzungsbedingungen/#haftungsausschluss", label: "Haftungsausschluss" },
  { href: "/cookies/", label: "Cookies" },
  { href: "/datenschutz/", label: "Datenschutz" },
];

export default function Footer() {
  return (
    <footer className="border-t border-border px-4 py-8 text-center text-xs text-muted-foreground">
      <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2" aria-label="Footer">
        {links.map((l) => (
          // prefetch={false} aus demselben Grund wie in SiteNav: 17 Links auf
          // jeder Seite, deren RSC-Payloads beim Scrollen an das Seitenende
          // vollstaendig geladen wuerden.
          <Link key={l.href} href={l.href} prefetch={false} className="hover:text-foreground">{l.label}</Link>
        ))}
        <ConsentSettingsLink className="hover:text-foreground cursor-pointer" />
      </nav>
      <div className="mt-4 flex items-center justify-center gap-4">
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
      <p className="mt-4">© Kontexto, das deutsche Wort-Ratespiel · entwickelt von Ugur Aydogan</p>
      <p className="mt-2 inline-flex items-center justify-center gap-1">
        Made with
        <Heart className="h-3 w-3 fill-red-500 text-red-500" aria-hidden="true" />
        <span className="sr-only">Liebe</span>
        in Hannover
      </p>
    </footer>
  );
}
