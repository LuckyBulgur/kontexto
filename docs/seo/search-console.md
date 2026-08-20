# Google Search Console & Bing Webmaster Tools Setup

## Overview

This document covers verifying `https://kontexto.de` in Google Search Console (GSC), submitting the sitemap, requesting indexing for key pages, and monitoring Coverage and Core Web Vitals. The same steps are summarised for Bing Webmaster Tools.

The daily rebuild automatically regenerates `sitemap.xml` with fresh `lastmod` timestamps, so no manual sitemap updates are needed.

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
3. GSC will crawl and parse the sitemap. The daily rebuild keeps it current, so no re-submission is needed after the first time.

### 3. Request Indexing for Key Pages

After the sitemap is submitted, use the **URL Inspection** tool to request priority indexing for the most important pages:

| URL | Priority |
|-----|----------|
| `https://kontexto.de/` | High, game homepage |
| `https://kontexto.de/wordle/` | High, Wördle game |
| `https://kontexto.de/faq/` | Medium, FAQ with structured data |
| `https://kontexto.de/anleitung/` | Medium, rules page |
| `https://kontexto.de/strategie/` | Medium, strategy guide |
| `https://kontexto.de/archiv/` | Medium, archive index |
| `https://kontexto.de/blog/` | Medium, blog index |
| `https://kontexto.de/ueber/` | Low |

For each URL: paste it into URL Inspection, click **Test Live URL**, then **Request Indexing**.

### 4. Monitor Coverage

In the **Pages** (formerly Coverage) report, watch for:

- **Valid**: pages indexed. Check that the main game routes and content pages appear here.
- **Excluded, Noindex**: the dynamic duel-ID pages (`/duel/<id>/`, `/wordle/duel/<id>/`) should appear here because client-side `noindex` meta tags are injected for those ephemeral URLs.
- **Errors**: fix any `404`, `Redirect error`, or `Submitted URL not found` entries promptly.

### 5. Monitor Core Web Vitals

In the **Core Web Vitals** report, ensure all URLs stay in the **Good** range:

| Metric | Target |
|--------|--------|
| LCP (Largest Contentful Paint) | ≤ 2.5 s |
| INP (Interaction to Next Paint) | ≤ 200 ms |
| CLS (Cumulative Layout Shift) | ≤ 0.1 |

CLS for game pages is stabilised by the `min-h-screen` reservation on both the loading skeleton and the loaded game container in `GameClient.tsx`. If a metric degrades, run PageSpeed Insights against the affected URL for a detailed breakdown.

### 6. Daily Rebuild and Sitemap Freshness

The `scripts/daily-rebuild.sh` cron job rebuilds the static export every day. This means:

- `sitemap.xml` is regenerated with the current date as `lastmod` for daily-changing routes (`/`, `/wordle/`, `/archiv/`).
- Archive entries for the new day's puzzle are added automatically.
- No manual sitemap re-submission is needed, GSC re-fetches the sitemap on its own schedule.

---

## Bing Webmaster Tools

1. Sign in at [https://www.bing.com/webmasters](https://www.bing.com/webmasters).
2. Add `https://kontexto.de` as a site. Bing supports the same verification methods as Google (DNS TXT or HTML file). If GSC DNS TXT verification was used, the same record usually also satisfies Bing.
3. In **Sitemaps**, submit `https://kontexto.de/sitemap.xml`.
4. Use the **URL Inspection** tool to request indexing for the key pages listed above.
5. Monitor the **Page Indexing** and **Core Web Vitals** (via Site Scan) dashboards for coverage gaps or performance regressions.

Bing typically crawls the sitemap less aggressively than Google; re-submitting the sitemap after major content additions (e.g., new blog posts) is recommended.
