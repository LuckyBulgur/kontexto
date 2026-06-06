import type { Metadata } from "next";

export const SITE_URL = "https://kontexto.de";
export const DEFAULT_OG_IMAGE = "/opengraph-image";

export interface SeoInput {
  path: string;                 // must start and end with "/", e.g. "/faq/"
  title: string;                // page title WITHOUT the brand suffix
  description: string;
  type?: "website" | "article";
  noindex?: boolean;
}

export function buildMetadata({ path, title, description, type = "website", noindex }: SeoInput): Metadata {
  const url = path === "/" ? SITE_URL + "/" : `${SITE_URL}${path}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, type, url, siteName: "Kontexto", locale: "de_DE" },
    twitter: { card: "summary_large_image", title, description },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
