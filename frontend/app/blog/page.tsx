import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ArticleLayout from "@/components/content/ArticleLayout";
import Reveal from "@/components/motion/Reveal";
import { buildMetadata } from "@/lib/seo";
import { postsByCategory, type BlogMeta, type BlogCategory } from "@/lib/blog";
import { AUTHOR_NAME, AUTHOR_PROFILE_PATH } from "@/lib/author";
import { readingTimeMinutes } from "@/lib/reading-time";

export const metadata = buildMetadata({
  path: "/blog/",
  title: "Blog: Tipps, Strategien und Wissen rund um Kontexto",
  description:
    "Der Kontexto-Blog: Strategien zum schnelleren Gewinnen, der Vergleich mit Wordle, wie die KI-Wortähnlichkeit (fastText) funktioniert und mehr rund ums deutsche Wort-Ratespiel.",
});

const categoryOrder: BlogCategory[] = ["Strategie", "Grundlagen", "Technik"];
const categoryIntro: Record<BlogCategory, string> = {
  Strategie: "Konkrete Techniken, mit denen du das Zielwort schneller findest.",
  Grundlagen: "Was Kontexto ist und wie das Spielprinzip funktioniert.",
  Technik: "Ein Blick hinter die Kulissen: KI-Worteinbettungen und Ähnlichkeit.",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

function PostCard({ post }: { post: BlogMeta }) {
  const date = post.updated ?? post.date;
  return (
    <li>
      <Link
        href={`/blog/${post.slug}/`}
        className="group flex h-full flex-col rounded-xl border bg-card p-5 transition-colors hover:bg-accent"
      >
        {/* The title leads. The meta line used to sit above it at the same
            weight, which made the category the first thing read on every card. */}
        <h3 className="text-h3 text-balance text-foreground">{post.title}</h3>
        <p className="mt-2 flex-1 text-small text-muted-foreground">{post.description}</p>
        <p className="mt-3 text-micro text-muted-foreground">
          {post.category}, {post.updated ? "aktualisiert " : "veröffentlicht "}{formatDate(date)}, {readingTimeMinutes(post.slug)} Min. Lesezeit
        </p>
        <span className="mt-2 inline-flex items-center gap-1 text-small font-medium text-primary">
          Weiterlesen
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
}

export default function BlogIndex() {
  const groups = postsByCategory();
  return (
    <ArticleLayout
      title="Blog"
      lead="Strategien, Hintergründe und Wissen rund um Kontexto, vom Einsteigertipp bis zur Funktionsweise der KI hinter dem Spiel."
      breadcrumbName="Blog"
      path="/blog/"
    >
      <p className="-mt-4 text-small leading-relaxed text-muted-foreground">
        Alle Beiträge stammen von{" "}
        <Link
          href={AUTHOR_PROFILE_PATH}
          className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
        >
          {AUTHOR_NAME}
        </Link>
        , dem Entwickler von Kontexto. Die redaktionellen Grundsätze, Datenquellen und
        Korrekturregeln stehen auf der Seite <Link href="/redaktion/" className="text-primary underline underline-offset-2">Redaktion</Link>.
      </p>
      <p className="-mt-2 text-small leading-relaxed text-muted-foreground">
        Für gemeinsame Runden gibt es außerdem das{" "}
        <Link href="/wordle/duel/" className="text-primary underline underline-offset-2 hover:no-underline">
          Wördle-Duell
        </Link>
        : dasselbe Wort, sechs Versuche und ein Live-Fortschritt zwischen Freunden.
      </p>
      {categoryOrder.map((cat) => (
        <Reveal as="section" key={cat} className="space-y-4">
          <div>
            <h2 className="text-h3 font-semibold text-foreground">{cat}</h2>
            <p className="mt-1 text-small text-muted-foreground">{categoryIntro[cat]}</p>
          </div>
          <ul className="grid list-none gap-4 p-0 sm:grid-cols-2">
            {groups[cat].map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </ul>
        </Reveal>
      ))}
    </ArticleLayout>
  );
}
