import type { ReactNode } from "react";
import Link from "next/link";
import StructuredData from "@/components/StructuredData";
import { breadcrumb } from "@/lib/structured-data";
import TableOfContents, { type TocItem } from "./TableOfContents";

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
  children,
}: {
  title: string;
  lead?: ReactNode;
  breadcrumbName: string;
  path: string;
  toc?: TocItem[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <StructuredData
        data={breadcrumb([
          { name: "Start", path: "/" },
          { name: breadcrumbName, path },
        ])}
      />
      <article className="mx-auto max-w-3xl px-4 py-10">
        <Link
          href="/"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          &larr; Zurück zum Spiel
        </Link>
        <header className="mt-6 mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {title}
          </h1>
          {lead && (
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{lead}</p>
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
      </article>
    </div>
  );
}
