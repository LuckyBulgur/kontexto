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
  "kontexto-vs-wordle": () =>
    import("@/content/blog/kontexto-vs-wordle.mdx"),
  "wie-funktioniert-fasttext": () =>
    import("@/content/blog/wie-funktioniert-fasttext.mdx"),
  "beste-startwoerter": () =>
    import("@/content/blog/beste-startwoerter.mdx"),
  "was-ist-contexto-auf-deutsch": () =>
    import("@/content/blog/was-ist-contexto-auf-deutsch.mdx"),
};

export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }));
}

export const dynamicParams = false;

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
      <article className="mx-auto max-w-2xl px-4 py-8 text-sm leading-relaxed text-muted-foreground">
        <Link href="/blog/" className="text-sm hover:text-foreground">
          &larr; Alle Artikel
        </Link>
        <Article />
      </article>
    </div>
  );
}
