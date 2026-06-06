import Link from "next/link";
import TextPage from "@/components/seo/LegalLayout";
import { buildMetadata } from "@/lib/seo";
import { posts } from "@/lib/blog";

export const metadata = buildMetadata({
  path: "/blog/",
  title: "Blog – Tipps, Strategien & Wissen rund um Kontexto",
  description:
    "Der Kontexto-Blog: Strategien, der Vergleich mit Wordle, wie die KI-Wortähnlichkeit funktioniert und mehr rund ums deutsche Wort-Ratespiel.",
});

export default function BlogIndex() {
  return (
    <TextPage title="Blog" breadcrumbName="Blog" path="/blog/">
      <ul className="space-y-6">
        {posts.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/blog/${p.slug}/`}
              className="text-base font-semibold text-foreground hover:underline"
            >
              {p.title}
            </Link>
            <p className="mt-1">{p.description}</p>
          </li>
        ))}
      </ul>
    </TextPage>
  );
}
