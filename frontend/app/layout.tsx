import type { Metadata } from "next";
import { Figtree, Bricolage_Grotesque, Creepster } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@/components/Analytics";
import RetiredAdStorage from "@/components/RetiredAdStorage";
import UpdateWatcher from "@/components/UpdateWatcher";
import StructuredData from "@/components/StructuredData";
import { organizationSchema, websiteSchema } from "@/lib/structured-data";
import { AUTHOR_NAME, AUTHOR_PROFILE_PATH, AUTHOR_SAME_AS } from "@/lib/author";
import { SITE_SAME_AS } from "@/lib/social";
import Footer from "@/components/Footer";
import FeedbackFab from "@/components/FeedbackFab";
import SupportHost from "@/components/SupportHost";
import SupporterRails from "@/components/SupporterRails";
import MotionProvider from "@/components/motion/MotionProvider";
import EventRuntime from "@/components/event/EventRuntime";
import { EVENT_THEME_SCRIPT } from "@/lib/event-theme";
import { PALETTE_SCRIPT } from "@/lib/palette";
import { SITE_URL } from "@/lib/seo";
import "./globals.css";

// Two families, two jobs. Figtree carries every running text, control and
// guess row; Bricolage Grotesque carries headings and numeric heroes. Both need
// latin-ext, because the whole product is German and loses its diacritics
// without it. Variables (not className) so `font-sans` and `font-display` in
// Tailwind resolve to them, see the @theme block in app/globals.css.
const figtree = Figtree({
  subsets: ["latin", "latin-ext"],
  variable: "--font-figtree",
  display: "swap",
});
const bricolage = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  variable: "--font-bricolage",
  display: "swap",
});
// The Spooktober display face, for event chrome only (the flashes, the candy
// bag's title, the haunted 404). `preload: false`: the file is fetched only by
// a page that renders it, so no visitor outside the event pays for it. Its
// "latin" subset covers the umlauts, sharp s and the German quotes (checked
// against the font's cmap on 2026-10-01).
const creepster = Creepster({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-spook",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Kontexto - Das tägliche deutsche Wort-Ratespiel",
    template: "%s | Kontexto",
  },
  description:
    "Errate jeden Tag das geheime Wort. Kontexto misst, wie nah dein Tipp der Bedeutung des Zielworts kommt, und zeigt dir dafür einen Rang. Unbegrenzt viele Versuche, kostenlos und ohne Anmeldung.",
  applicationName: "Kontexto",
  authors: [{ name: AUTHOR_NAME, url: `${SITE_URL}${AUTHOR_PROFILE_PATH}` }],
  creator: AUTHOR_NAME,
  alternates: { languages: { "de-DE": "/", "x-default": "/" } },
  openGraph: { type: "website", locale: "de_DE", siteName: "Kontexto", url: "https://kontexto.de" },
  twitter: { card: "summary_large_image" },
  robots: {
    index: true, follow: true,
    googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1 },
  },
  other: { "theme-color": "#f8f9fc" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="de"
      className={`${figtree.variable} ${bricolage.variable} ${creepster.variable}`}
      suppressHydrationWarning
    >
      <head>
        <StructuredData data={organizationSchema([...SITE_SAME_AS, ...AUTHOR_SAME_AS])} />
        <StructuredData data={websiteSchema()} />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#f8f9fc" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#16181f" media="(prefers-color-scheme: dark)" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("kontexto_theme");if(t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme:dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})()`,
          }}
        />
        <script dangerouslySetInnerHTML={{ __html: PALETTE_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: EVENT_THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <MotionProvider>
          {children}
          <EventRuntime />
        </MotionProvider>
        <Footer />
        <SupporterRails />
        <SupportHost />
        <FeedbackFab />
        <Toaster />
        <UpdateWatcher />
        <Analytics />
        <RetiredAdStorage />
      </body>
    </html>
  );
}
