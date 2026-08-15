import Link from "next/link";
import { buildMetadata } from "@/lib/seo";

export const metadata = { ...buildMetadata({ path: "/", title: "Seite nicht gefunden", description: "Diese Seite existiert nicht." }), robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-bold">404: Seite nicht gefunden</h1>
      <p className="text-muted-foreground">Diese Seite gibt es nicht (mehr).</p>
      <nav className="flex flex-wrap justify-center gap-4">
        <Link href="/" className="text-primary underline">Zum Spiel</Link>
        <Link href="/faq/" className="text-primary underline">FAQ</Link>
      </nav>
    </div>
  );
}
