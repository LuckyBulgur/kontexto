# Google Search Console & Bing Webmaster Tools Setup

## Overview

This document covers verifying `https://kontexto.de` in Google Search Console (GSC), submitting the sitemap, requesting indexing for key pages, and monitoring Coverage and Core Web Vitals. The same steps are summarised for Bing Webmaster Tools.

The static export regenerates `sitemap.xml` during every frontend build. There is
currently no automatic daily rebuild in this repository, so a new route or a
substantial content change becomes public only with the next deployment.

---

## Google Search Console

### 1. Add and Verify the Property

Navigate to [https://search.google.com/search-console/welcome](https://search.google.com/search-console/welcome) and choose **URL prefix** with `https://kontexto.de` as the property.

Two recommended verification methods:

#### Option A: DNS TXT record (preferred)

1. GSC will show a TXT record value such as `google-site-verification=<token>`.
2. Add a DNS TXT record for `kontexto.de` with that value via your DNS provider.
3. Allow up to 24 h for DNS propagation, then click **Verify** in GSC.

This method survives re-deploys and CMS changes because it lives at the DNS layer.

#### Option B: HTML file

1. GSC will offer a file named `google<token>.html` to download.
2. Place it in `frontend/public/` so Next.js copies it to `out/google<token>.html` at build time.
3. Verify the file is served at `https://kontexto.de/google<token>.html`, then click **Verify**.

After verification the property shows as **Owner** in GSC.

### 2. Submit the Sitemap

1. In the left sidebar select **Sitemaps**.
2. Enter `https://kontexto.de/sitemap.xml` and click **Submit**.
3. GSC will crawl and parse the sitemap. A new sitemap is generated with the
   next frontend build; it normally does not need to be submitted again.

### 3. Request Indexing for Key Pages

After the sitemap is submitted, use the **URL Inspection** tool to request priority indexing for the most important pages:

| URL | Priority |
|-----|----------|
| `https://kontexto.de/` | High, game homepage |
| `https://kontexto.de/wordle/` | High, Wördle game |
| `https://kontexto.de/faq/` | Medium, FAQ with structured data |
| `https://kontexto.de/anleitung/` | Medium, rules page |
| `https://kontexto.de/strategie/` | Medium, strategy guide |
| `https://kontexto.de/blog/` | Medium, blog index |
| `https://kontexto.de/ueber/` | Low |

For each URL: paste it into URL Inspection, click **Test Live URL**, then **Request Indexing**.

### 4. Monitor Coverage

In the **Pages** (formerly Coverage) report, watch for:

- **Valid**: pages indexed. Check that the main game routes and content pages appear here.
- **Excluded, Noindex**: the dynamic duel- and Koop-ID pages (`/duel/<id>/`, `/koop/<id>/`, `/wordle/duel/<id>/`) should appear here because the production server marks these ephemeral fallback URLs with `X-Robots-Tag: noindex, nofollow`.
- **Not found**: physical export artefacts such as `/404/`, `/_not-found/`, and `/404.html` should return 404 and must not become sitemap entries.
- **Errors**: fix any `404`, `Redirect error`, or `Submitted URL not found` entries promptly.

### 5.1 Interpret "No referring sitemap"

In URL Inspection, **No referring sitemap** means that Google has not found a
submitted sitemap containing the exact URL that was inspected. It is not by
itself a quality or indexing error. Google can also discover a URL through a
link, an old URL, a redirect variant, a query string, or another source. See
the official explanation in the [URL Inspection documentation](https://support.google.com/webmasters/answer/9012289?hl=de).

For Kontexto, use the URL Inspection tool with the exact canonical host
`https://kontexto.de/` and distinguish these cases:

- Public pages in `sitemap.xml` should have the matching self-canonical URL.
- `/duel/create/`, `/koop/create/`, `/wordle/duel/create/`, dynamic room URLs,
  `/admin/`, `/404.html`, `/404/`, `/_not-found/`, and physical `index.html`
  variants are deliberately not sitemap entries.
- For a public URL without a referring sitemap, compare **User-declared
  canonical** with **Google-selected canonical** and check whether the URL is
  an old host, a redirect, or a query variant.
- In **Settings > Crawl stats**, review the hostnames Google actually crawls.
  Remove or redirect forgotten proxy, staging, development, or preview hosts;
  do not add them to the public sitemap.

The exact sitemap URL is `https://kontexto.de/sitemap.xml`. The trailing-slash
variant `https://kontexto.de/sitemap.xml/` is not the sitemap.

### 5. Monitor Core Web Vitals

In the **Core Web Vitals** report, ensure all URLs stay in the **Good** range:

| Metric | Target |
|--------|--------|
| LCP (Largest Contentful Paint) | ≤ 2.5 s |
| INP (Interaction to Next Paint) | ≤ 200 ms |
| CLS (Cumulative Layout Shift) | ≤ 0.1 |

CLS for game pages is stabilised by the `min-h-screen` reservation on both the loading skeleton and the loaded game container in `GameClient.tsx`. If a metric degrades, run PageSpeed Insights against the affected URL for a detailed breakdown.

### 6. Sitemap freshness after a deployment

After a frontend deployment:

- `sitemap.xml` is regenerated with the build date as `lastmod` for the routes
  that are part of the export.
- The sitemap currently contains the public static routes and all blog posts;
  functional lobby forms and room IDs stay out of it.
- The sitemap normally needs to be submitted only once. After a deployment,
  Search Console fetches it again on its own schedule. Use URL Inspection for
  the small number of pages where a quicker crawl is important.

### 7. AdSense review handoff

Before requesting another AdSense review:

1. Deploy the current frontend with `NEXT_PUBLIC_ADSENSE_REVIEW_MODE=true`.
   This leaves Google's verification script in the document head but renders
   no manual `adsbygoogle` slots.
2. Verify that `ads.txt` is reachable at the domain root and that the Google
   consent message is published in AdSense for European users.
3. If the site entry itself appears stale, remove and re-add the site once in
   AdSense. Do not create a second publisher account.
4. Wait until the new HTML is visible in URL Inspection, then request one
   review. Repeatedly changing the site while a review is pending makes the
   result harder to interpret.

---

## Bing Webmaster Tools

1. Sign in at [https://www.bing.com/webmasters](https://www.bing.com/webmasters).
2. Add `https://kontexto.de` as a site. Bing supports the same verification methods as Google (DNS TXT or HTML file). If GSC DNS TXT verification was used, the same record usually also satisfies Bing.
3. In **Sitemaps**, submit `https://kontexto.de/sitemap.xml`.
4. Use the **URL Inspection** tool to request indexing for the key pages listed above.
5. Monitor the **Page Indexing** and **Core Web Vitals** (via Site Scan) dashboards for coverage gaps or performance regressions.

Bing typically crawls the sitemap less aggressively than Google; re-submitting the sitemap after major content additions (e.g., new blog posts) is recommended.
