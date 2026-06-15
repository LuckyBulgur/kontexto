import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { posts } from "@/lib/blog";

export const dynamic = "force-static";

const BUILD_DATE = process.env.KONTEXTO_BUILD_DATE || new Date().toISOString().slice(0, 10);

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date(BUILD_DATE);
  const staticRoutes: { path: string; freq: MetadataRoute.Sitemap[number]["changeFrequency"]; prio: number }[] = [
    { path: "/", freq: "daily", prio: 1.0 },
    { path: "/wordle/", freq: "daily", prio: 0.9 },
    { path: "/duel/", freq: "weekly", prio: 0.6 },
    { path: "/koop/", freq: "weekly", prio: 0.6 },
    { path: "/wordle/duel/", freq: "weekly", prio: 0.6 },
    // /duel/create/, /koop/create/ and /wordle/duel/create/ are intentionally
    // omitted: thin functional lobby-creation forms marked noindex.
    { path: "/faq/", freq: "monthly", prio: 0.7 },
    { path: "/anleitung/", freq: "monthly", prio: 0.8 },
    { path: "/strategie/", freq: "monthly", prio: 0.8 },
    { path: "/vergleich/", freq: "monthly", prio: 0.7 },
    { path: "/glossar/", freq: "monthly", prio: 0.6 },
    { path: "/ueber/", freq: "monthly", prio: 0.5 },
    { path: "/blog/", freq: "weekly", prio: 0.6 },
    { path: "/impressum/", freq: "yearly", prio: 0.2 },
    { path: "/datenschutz/", freq: "yearly", prio: 0.2 },
  ];

  const staticOut = staticRoutes.map((r) => ({
    url: `${SITE_URL}${r.path}`, lastModified: now, changeFrequency: r.freq, priority: r.prio,
  }));

  const blogRoutes = posts.map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}/`,
    lastModified: new Date(p.updated ?? p.date),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticOut, ...blogRoutes];
}
