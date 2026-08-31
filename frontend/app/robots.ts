import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          // Next legt neben jede Seite ihre RSC-Payload als Klartext ab
          // (index.txt, __next._full.txt, __next._tree.txt, ...). Die Dateien
          // sind oeffentlich abrufbar und enthalten den vollstaendigen
          // Seitentext, aber weder Titel noch Canonical. Wer eine davon
          // crawlt, indexiert ein titelloses Duplikat der Seite. Verlinkt sind
          // sie nirgends, gesperrt gehoeren sie trotzdem: Duplikate zaehlen in
          // der Suche wie im AdSense-Review gegen die Site. ads.txt, llms.txt
          // und robots.txt treffen die Muster nicht.
          // Kein $-Anker: Der Client-Router haengt ?_rsc=... an, und Googles
          // robots-Syntax laesst $ nur am tatsaechlichen URL-Ende gelten.
          "/*index.txt",
          "/*__next",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
