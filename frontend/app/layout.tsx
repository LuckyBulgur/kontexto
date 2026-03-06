import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { faqs } from "@/lib/faqs";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://kontexto.de"),
  title: "Kontexto - Das deutsche Wort-Ratespiel | Contexto auf Deutsch",
  description:
    "Kontexto ist die deutsche Version von Contexto! Finde das geheime Wort im täglichen Wort-Ratespiel. Errate das Zielwort anhand von Bedeutungsähnlichkeit - kostenlos und ohne Anmeldung.",
  keywords: [
    "Kontexto",
    "Contexto",
    "Contexto deutsch",
    "Contexto auf deutsch",
    "Contexto german",
    "Wort-Ratespiel",
    "Wortspiel",
    "deutsches Wortspiel",
    "semantische Ähnlichkeit",
    "tägliches Rätsel",
    "Worträtsel",
    "Sprachspiel",
    "Wörter raten",
    "Wort des Tages",
    "Wortspiel online",
    "kostenloses Wortspiel",
  ],
  authors: [{ name: "Kontexto" }],
  creator: "Kontexto",
  alternates: {
    canonical: "/",
    languages: { "de-DE": "/" },
  },
  openGraph: {
    title: "Kontexto - Das deutsche Wort-Ratespiel | Contexto auf Deutsch",
    description:
      "Kontexto ist die deutsche Version von Contexto! Finde das geheime Wort im täglichen Wort-Ratespiel basierend auf Bedeutungsähnlichkeit.",
    type: "website",
    locale: "de_DE",
    url: "https://kontexto.de",
    siteName: "Kontexto",
    images: [
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "Kontexto Logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Kontexto - Das deutsche Wort-Ratespiel | Contexto auf Deutsch",
    description:
      "Kontexto ist die deutsche Version von Contexto! Finde das geheime Wort im täglichen Wort-Ratespiel.",
    images: ["/icon-512.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  other: {
    "theme-color": "#ffffff",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Kontexto",
              url: "https://kontexto.de",
              description:
                "Finde das geheime Wort! Ein tägliches Wort-Ratespiel basierend auf semantischer Ähnlichkeit.",
              applicationCategory: "GameApplication",
              operatingSystem: "Web",
              inLanguage: "de",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "EUR",
              },
              author: {
                "@type": "Organization",
                name: "Kontexto",
              },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faqs.map((faq) => ({
                "@type": "Question",
                name: faq.q,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: faq.a,
                },
              })),
            }),
          }}
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#1a1a1a" media="(prefers-color-scheme: dark)" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("kontexto_theme");if(t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme:dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})()`,
          }}
        />
      </head>
      <body className={`${inter.className} min-h-screen bg-background text-foreground`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
