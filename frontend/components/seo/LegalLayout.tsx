import Link from "next/link";
import StructuredData from "@/components/StructuredData";
import { breadcrumb } from "@/lib/structured-data";
import SiteNav from "@/components/seo/SiteNav";
import Breadcrumbs from "@/components/seo/Breadcrumbs";

const legalLinks = [
  { href: "/impressum/", label: "Impressum" },
  { href: "/datenschutz/", label: "Datenschutz" },
  { href: "/cookies/", label: "Cookies" },
  { href: "/nutzungsbedingungen/", label: "Nutzungsbedingungen" },
  { href: "/kontakt/", label: "Kontakt" },
];

export default function TextPage({ title, breadcrumbName, path, breadcrumbItems, children }: { title: string; breadcrumbName: string; path: string; breadcrumbItems?: { name: string; path: string }[]; children: React.ReactNode; }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <StructuredData data={breadcrumb(breadcrumbItems ?? [{ name: "Start", path: "/" }, { name: breadcrumbName, path }])} />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <SiteNav current={path} />
        <Breadcrumbs items={breadcrumbItems ?? [{ name: "Start", path: "/" }, { name: breadcrumbName, path }]} />
        <header className="mb-7 mt-5 max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl sm:leading-tight">{title}</h1>
        </header>
        <div className="max-w-3xl space-y-7 text-[0.95rem] leading-7 text-muted-foreground [&_h2]:scroll-mt-24 [&_h2]:pt-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:leading-snug [&_h2]:text-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_li]:leading-7 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_p]:leading-7 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">{children}</div>
        <nav aria-label="Weitere rechtliche Informationen" className="mt-10 max-w-3xl border-t border-border pt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">Weitere rechtliche Informationen</p>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {legalLinks.filter((link) => link.href !== path).map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-muted-foreground transition-colors hover:text-foreground">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </main>
    </div>
  );
}
