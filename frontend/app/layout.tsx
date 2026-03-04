import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Kontexto - Deutsches Wort-Ratespiel",
  description: "Finde das geheime Wort! Ein t\u00e4gliches Wort-Ratespiel basierend auf semantischer \u00c4hnlichkeit.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className={`${inter.className} bg-gray-50 dark:bg-gray-900 min-h-screen transition-colors`}>{children}</body>
    </html>
  );
}
