import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Kontexto - Deutsches Wort-Ratespiel",
  description: "Finde das geheime Wort! Ein tägliches Wort-Ratespiel basierend auf semantischer Ähnlichkeit.",
  openGraph: {
    title: "Kontexto - Deutsches Wort-Ratespiel",
    description: "Finde das geheime Wort! Ein tägliches Wort-Ratespiel basierend auf semantischer Ähnlichkeit.",
    type: "website",
    locale: "de_DE",
    siteName: "Kontexto",
  },
  twitter: {
    card: "summary",
    title: "Kontexto - Deutsches Wort-Ratespiel",
    description: "Finde das geheime Wort! Ein tägliches Wort-Ratespiel basierend auf semantischer Ähnlichkeit.",
  },
  other: {
    "theme-color": "#ffffff",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
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
