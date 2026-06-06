import { SITE_URL } from "./seo";
import { faqs } from "./faqs";

export function gameSchema(rating?: { ratingValue: number; ratingCount: number }) {
  return {
    "@context": "https://schema.org",
    "@type": ["WebApplication", "VideoGame"],
    name: "Kontexto",
    url: SITE_URL,
    description: "Tägliches deutsches Wort-Ratespiel basierend auf semantischer Ähnlichkeit (KI-Worteinbettungen).",
    applicationCategory: "GameApplication",
    gamePlatform: "Web Browser",
    operatingSystem: "Web",
    inLanguage: "de",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    author: { "@type": "Organization", name: "Kontexto", url: SITE_URL },
    ...(rating && rating.ratingCount > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: rating.ratingValue.toFixed(1), ratingCount: rating.ratingCount } }
      : {}),
  };
}

export function organizationSchema(sameAs: string[] = []) {
  return {
    "@context": "https://schema.org", "@type": "Organization",
    name: "Kontexto", url: SITE_URL, logo: `${SITE_URL}/icon-512.png`,
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function websiteSchema() {
  return { "@context": "https://schema.org", "@type": "WebSite", name: "Kontexto", url: SITE_URL, inLanguage: "de" };
}

export function breadcrumb(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem", position: i + 1, name: it.name, item: `${SITE_URL}${it.path}`,
    })),
  };
}

export function faqSchema(items = faqs) {
  return {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

export function blogPostingSchema(p: { title: string; description: string; slug: string; date: string }) {
  return {
    "@context": "https://schema.org", "@type": "BlogPosting",
    headline: p.title, description: p.description, datePublished: p.date,
    inLanguage: "de", url: `${SITE_URL}/blog/${p.slug}/`,
    author: { "@type": "Organization", name: "Kontexto" },
    publisher: { "@type": "Organization", name: "Kontexto", logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png` } },
  };
}

