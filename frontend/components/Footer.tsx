import Link from "next/link";

const links = [
  { href: "/", label: "Kontexto" },
  { href: "/wordle/", label: "Wördle" },
  { href: "/archiv/", label: "Archiv" },
  { href: "/anleitung/", label: "Anleitung" },
  { href: "/strategie/", label: "Strategie" },
  { href: "/faq/", label: "FAQ" },
  { href: "/blog/", label: "Blog" },
  { href: "/ueber/", label: "Über" },
  { href: "/impressum/", label: "Impressum" },
  { href: "/datenschutz/", label: "Datenschutz" },
];

export default function Footer() {
  return (
    <footer className="border-t border-border px-4 py-8 text-center text-xs text-muted-foreground">
      <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2" aria-label="Footer">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="hover:text-foreground">{l.label}</Link>
        ))}
      </nav>
      <p className="mt-4">© Kontexto – das deutsche Wort-Ratespiel</p>
    </footer>
  );
}
