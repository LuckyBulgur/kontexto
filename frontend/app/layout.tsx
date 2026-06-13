import type { Metadata } from "next";
import { Inter, Anton } from "next/font/google";
import Script from "next/script";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@/components/Analytics";
import { SideRailAds } from "@/components/SideRailAds";
import StructuredData from "@/components/StructuredData";
import { organizationSchema, websiteSchema } from "@/lib/structured-data";
import Footer from "@/components/Footer";
import MotionProvider from "@/components/motion/MotionProvider";
import EventBackdrop from "@/components/event/EventBackdrop";
import EventBanner from "@/components/event/EventBanner";
import { EVENT_THEME_SCRIPT } from "@/lib/event-theme";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
// Charakter-Display-Font, ausschließlich für die WM-2026-Event-Chrome
// (Badge, Banner, „TOR!"). Der SEO-Body-Font (Inter) bleibt unangetastet.
const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-event", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://kontexto.de"),
  title: {
    default: "Kontexto - Das deutsche Wort-Ratespiel | Contexto auf Deutsch",
    template: "%s | Kontexto",
  },
  description:
    "Kontexto ist die deutsche Version von Contexto! Finde das geheime Wort im täglichen Wort-Ratespiel. Errate das Zielwort anhand von Bedeutungsähnlichkeit - kostenlos und ohne Anmeldung.",
  applicationName: "Kontexto",
  authors: [{ name: "Kontexto" }],
  creator: "Kontexto",
  alternates: { languages: { "de-DE": "/", "x-default": "/" } },
  openGraph: { type: "website", locale: "de_DE", siteName: "Kontexto", url: "https://kontexto.de" },
  twitter: { card: "summary_large_image" },
  robots: {
    index: true, follow: true,
    googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1 },
  },
  other: { "theme-color": "#ffffff", "google-adsense-account": "ca-pub-3545758989514084" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={anton.variable} suppressHydrationWarning>
      <head>
        <StructuredData data={organizationSchema()} />
        <StructuredData data={websiteSchema()} />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#1a1a1a" media="(prefers-color-scheme: dark)" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("kontexto_theme");if(t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme:dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})()`,
          }}
        />
        <script dangerouslySetInnerHTML={{ __html: EVENT_THEME_SCRIPT }} />
      </head>
      <body className={`${inter.className} min-h-screen bg-background text-foreground`}>
        <MotionProvider>
          <EventBackdrop />
          {children}
          <EventBanner />
        </MotionProvider>
        <Footer />
        <Toaster />
        <Analytics />
        <SideRailAds />
      </body>
      <Script
        id="google-adsense"
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3545758989514084"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
    </html>
  );
}
