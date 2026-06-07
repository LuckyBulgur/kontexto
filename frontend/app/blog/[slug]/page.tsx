import type { ComponentType } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import StructuredData from "@/components/StructuredData";
import { breadcrumb, blogPostingSchema } from "@/lib/structured-data";
import { buildMetadata } from "@/lib/seo";
import { posts, getPost } from "@/lib/blog";

// Explicit static loader map — avoids template-literal dynamic imports which
// are fragile under static export. Every module is statically known at
// build time, enabling reliable tree-shaking and chunk splitting.
const loaders: Record<string, () => Promise<{ default: ComponentType }>> = {
  "kontexto-tipps-schneller-gewinnen": () =>
    import("@/content/blog/kontexto-tipps-schneller-gewinnen.mdx"),
  "haeufige-fehler-bei-kontexto": () =>
    import("@/content/blog/haeufige-fehler-bei-kontexto.mdx"),
  "semantische-wortfelder-strategie": () =>
    import("@/content/blog/semantische-wortfelder-strategie.mdx"),
  "warum-schlechter-rang": () => import("@/content/blog/warum-schlechter-rang.mdx"),
  "worteinbettungen-erklaert": () =>
    import("@/content/blog/worteinbettungen-erklaert.mdx"),
  "kosinus-aehnlichkeit-einfach-erklaert": () =>
    import("@/content/blog/kosinus-aehnlichkeit-einfach-erklaert.mdx"),
  "kontexto-vs-wordle": () => import("@/content/blog/kontexto-vs-wordle.mdx"),
  "wie-funktioniert-fasttext": () =>
    import("@/content/blog/wie-funktioniert-fasttext.mdx"),
  "beste-startwoerter": () => import("@/content/blog/beste-startwoerter.mdx"),
  "was-ist-contexto-auf-deutsch": () =>
    import("@/content/blog/was-ist-contexto-auf-deutsch.mdx"),
};

export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }));
}

export const dynamicParams = false;

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("de-DE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = getPost(slug);
  if (!p) return {};
  return buildMetadata({
    path: `/blog/${p.slug}/`,
    title: p.title,
    description: p.description,
    type: "article",
  });
}

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const meta = getPost(slug);
  if (!meta) notFound();

  const load = loaders[slug];
  if (!load) notFound();
  const { default: Article } = await load();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <StructuredData
        data={breadcrumb([
          { name: "Start", path: "/" },
          { name: "Blog", path: "/blog/" },
          { name: meta.title, path: `/blog/${meta.slug}/` },
        ])}
      />
      <StructuredData data={blogPostingSchema(meta)} />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link
          href="/blog/"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          &larr; Alle Artikel
        </Link>
        <p className="mt-6 text-xs uppercase tracking-wide text-muted-foreground">
          {meta.category} · {fmt(meta.date)}
          {meta.updated && meta.updated !== meta.date
            ? ` · aktualisiert am ${fmt(meta.updated)}`
            : ""}
        </p>
        <article className="mt-2 text-base leading-7 text-muted-foreground [&_h1]:mt-2">
          <Article />
        </article>

        <footer className="mt-12 border-t border-border pt-6 text-sm">
          <p className="font-semibold text-foreground">Weiterlesen</p>
          <nav className="mt-2 flex flex-wrap gap-x-4 gap-y-2" aria-label="Weitere Inhalte">
            <Link href="/strategie/" className="text-primary underline">Strategie &amp; Tipps</Link>
            <Link href="/glossar/" className="text-primary underline">Glossar</Link>
            <Link href="/vergleich/" className="text-primary underline">Spiele im Vergleich</Link>
            <Link href="/blog/" className="text-primary underline">Alle Artikel</Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
