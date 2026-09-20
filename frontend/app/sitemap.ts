import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { posts } from "@/lib/blog";
import { CONTENT_REVISIONS } from "@/lib/content-revisions";

export const dynamic = "force-static";

const BUILD_DATE = process.env.KONTEXTO_BUILD_DATE || new Date().toISOString().slice(0, 10);

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: { path: string; freq: MetadataRoute.Sitemap[number]["changeFrequency"]; prio: number }[] = [
    { path: "/", freq: "daily", prio: 1.0 },
    { path: "/wordle/", freq: "daily", prio: 0.9 },
    { path: "/duel/", freq: "weekly", prio: 0.6 },
    { path: "/koop/", freq: "weekly", prio: 0.6 },
    { path: "/wordle/duel/", freq: "weekly", prio: 0.6 },
    { path: "/modi/", freq: "monthly", prio: 0.8 },
    { path: "/arena/", freq: "weekly", prio: 0.6 },
    { path: "/solo/leiter/", freq: "weekly", prio: 0.5 },
    { path: "/solo/limit/", freq: "weekly", prio: 0.5 },
    { path: "/solo/doppelziel/", freq: "weekly", prio: 0.5 },
    { path: "/solo/sudden-death/", freq: "weekly", prio: 0.5 },
    // /duel/create/, /koop/create/, /wordle/duel/create/, /arena/create/ and
    // /suche/ are intentionally omitted: thin functional forms marked noindex.
    { path: "/faq/", freq: "monthly", prio: 0.7 },
    { path: "/anleitung/", freq: "monthly", prio: 0.8 },
    { path: "/strategie/", freq: "monthly", prio: 0.8 },
    { path: "/vergleich/", freq: "monthly", prio: 0.7 },
    { path: "/glossar/", freq: "monthly", prio: 0.6 },
    { path: "/ueber/", freq: "monthly", prio: 0.5 },
    { path: "/redaktion/", freq: "monthly", prio: 0.5 },
    { path: "/blog/", freq: "weekly", prio: 0.6 },
    { path: "/zahlen/", freq: "monthly", prio: 0.7 },
    { path: "/changelog/", freq: "monthly", prio: 0.5 },
    { path: "/kontakt/", freq: "yearly", prio: 0.4 },
    { path: "/impressum/", freq: "yearly", prio: 0.2 },
    { path: "/nutzungsbedingungen/", freq: "yearly", prio: 0.3 },
    { path: "/cookies/", freq: "yearly", prio: 0.3 },
    { path: "/datenschutz/", freq: "yearly", prio: 0.2 },
  ];

  const staticOut = staticRoutes.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    // Editorial pages have their actual content revision here. For functional
    // routes without a separate revision date, keep the build date as a
    // conservative fallback instead of inventing a historical date.
    lastModified: new Date(CONTENT_REVISIONS[r.path] ?? BUILD_DATE),
    changeFrequency: r.freq,
    priority: r.prio,
  }));

  const blogRoutes = posts.map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}/`,
    lastModified: new Date(p.updated ?? p.date),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticOut, ...blogRoutes];
}
