import { SITE_URL, DEFAULT_OG_IMAGE } from "./seo";
import { faqs } from "./faqs";
import { AUTHOR_NAME, AUTHOR_PROFILE_PATH } from "./author";

// Named person (E-E-A-T) — same source as the visible by-line on blog articles.
const EDITORIAL_AUTHOR = {
  "@type": "Person",
  name: AUTHOR_NAME,
  url: `${SITE_URL}${AUTHOR_PROFILE_PATH}`,
};
const PUBLISHER = {
  "@type": "Organization",
  name: "Kontexto",
  logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png` },
};

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

export function blogPostingSchema(p: {
  title: string;
  description: string;
  slug: string;
  date: string;
  updated?: string;
}) {
  const url = `${SITE_URL}/blog/${p.slug}/`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: p.title,
    description: p.description,
    datePublished: p.date,
    dateModified: p.updated ?? p.date,
    inLanguage: "de",
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    image: `${SITE_URL}${DEFAULT_OG_IMAGE}`,
    author: EDITORIAL_AUTHOR,
    publisher: PUBLISHER,
  };
}

/** DefinedTermSet for the glossary — semantic clarity / AEO (no rich snippet). */
export function definedTermSetSchema(
  name: string,
  path: string,
  terms: { term: string; slug: string; definition: string }[],
) {
  const url = `${SITE_URL}${path}`;
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name,
    url,
    inLanguage: "de",
    hasDefinedTerm: terms.map((t) => ({
      "@type": "DefinedTerm",
      name: t.term,
      description: t.definition,
      url: `${url}#${t.slug}`,
      inDefinedTermSet: url,
    })),
  };
}

/**
 * HowTo for the Anleitung page. Note: Google removed the HowTo rich result for
 * most sites in 2023 — this is kept for semantic/AEO value only.
 */
export function howToSchema(p: {
  name: string;
  description: string;
  path: string;
  steps: { name: string; text: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: p.name,
    description: p.description,
    inLanguage: "de",
    url: `${SITE_URL}${p.path}`,
    step: p.steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}

