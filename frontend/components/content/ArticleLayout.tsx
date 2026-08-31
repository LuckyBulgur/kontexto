import type { ReactNode } from "react";
import Link from "next/link";
import StructuredData from "@/components/StructuredData";
import { breadcrumb } from "@/lib/structured-data";
import TableOfContents, { type TocItem } from "./TableOfContents";
import SiteNav from "@/components/seo/SiteNav";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import { CONTENT_REVISIONS, revisionLabel } from "@/lib/content-revisions";

/**
 * Wide, well-typeset layout for marketing/content pages (Anleitung, Strategie,
 * Vergleich, Glossar, …). Renders a self-referencing BreadcrumbList, a lead
 * paragraph, an optional table of contents and a prose container with
 * consistent typography. All content is server-rendered for full crawlability.
 *
 * `LegalLayout` remains for the narrow legal pages (Impressum/Datenschutz).
 */
export default function ArticleLayout({
  title,
  lead,
  breadcrumbName,
  path,
  toc,
  breadcrumbItems,
  children,
}: {
  title: string;
  lead?: ReactNode;
  breadcrumbName: string;
  path: string;
  toc?: TocItem[];
  /** Ueberschreibt die zweistufige Voreinstellung Start > Seite. */
  breadcrumbItems?: { name: string; path: string }[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <StructuredData
        data={breadcrumb(breadcrumbItems ?? [{ name: "Start", path: "/" }, { name: breadcrumbName, path }])}
      />
      {/* main-Landmark: ohne ihn hat die Seite keinen Einstiegspunkt zum
          Ueberspringen der Navigation (axe: landmark-one-main, region). */}
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link
          href="/"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          &larr; Zurück zum Spiel
        </Link>
        <SiteNav current={path} />
        <Breadcrumbs items={breadcrumbItems ?? [{ name: "Start", path: "/" }, { name: breadcrumbName, path }]} />
        <header className="mt-4 mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {title}
          </h1>
          {lead && (
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{lead}</p>
          )}
          {/*
            Ein sichtbares Ueberarbeitungsdatum unterscheidet eine gepflegte
            Ratgeberseite von einer abgelegten. Als <time> ausgezeichnet, damit
            es nicht nur Text ist.
          */}
          {CONTENT_REVISIONS[path] && (
            <p className="mt-3 text-xs text-muted-foreground">
              Zuletzt überarbeitet am{" "}
              <time dateTime={CONTENT_REVISIONS[path]}>{revisionLabel(path)}</time>
            </p>
          )}
        </header>

        {toc && <TableOfContents items={toc} />}

        {/*
          No element-level typography here on purpose: the structured blocks
          (Step cards, ColorLegend, ComparisonTable, …) bring their own styles
          and must not be clobbered by descendant selectors. Wrap runs of plain
          text in <Prose> instead. This container only provides vertical rhythm.
        */}
        <div className="space-y-8">{children}</div>
      </main>
    </div>
  );
}
