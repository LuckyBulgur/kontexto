import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Kontexto - Deutsches Wort-Ratespiel",
  description: "Finde das geheime Wort! Ein tägliches Wort-Ratespiel basierend auf semantischer Ähnlichkeit.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background text-foreground`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
