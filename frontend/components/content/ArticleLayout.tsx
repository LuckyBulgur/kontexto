import type { ReactNode } from "react";
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
 * Legal pages use the same shell through `LegalLayout`, with a more compact
 * legal-text treatment.
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
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <SiteNav current={path} />
        <Breadcrumbs items={breadcrumbItems ?? [{ name: "Start", path: "/" }, { name: breadcrumbName, path }]} />
        <header className="mb-6 mt-5 max-w-4xl sm:mb-7">
          <h1 className="text-h1 font-bold tracking-tight text-foreground sm:text-display sm:leading-tight">
            {title}
          </h1>
          {lead && (
            <p className="mt-4 text-lead leading-relaxed text-muted-foreground">{lead}</p>
          )}
          {/*
            Ein sichtbares Ueberarbeitungsdatum unterscheidet eine gepflegte
            Ratgeberseite von einer abgelegten. Als <time> ausgezeichnet, damit
            es nicht nur Text ist.
          */}
          {CONTENT_REVISIONS[path] && (
            <p className="mt-3 text-micro text-muted-foreground">
              Zuletzt überarbeitet am{" "}
              <time dateTime={CONTENT_REVISIONS[path]}>{revisionLabel(path)}</time>
            </p>
          )}
        </header>

        <div
          className={
            toc
              ? "grid items-start gap-8 lg:grid-cols-[minmax(0,48rem)_14rem] lg:gap-12"
              : "max-w-4xl"
          }
        >
          {/*
            No element-level typography here on purpose: the structured blocks
            (Step cards, ColorLegend, ComparisonTable, …) bring their own styles
            and must not be clobbered by descendant selectors. Wrap runs of plain
            text in <Prose> instead. This container only provides vertical rhythm.
          */}
          <div className="min-w-0 space-y-6">{children}</div>
          {toc && (
            <aside className="order-first lg:order-none lg:sticky lg:top-6">
              <TableOfContents
                items={toc}
                className="lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto"
              />
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
