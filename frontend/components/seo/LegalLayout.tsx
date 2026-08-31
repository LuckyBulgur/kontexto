import Link from "next/link";
import StructuredData from "@/components/StructuredData";
import { breadcrumb } from "@/lib/structured-data";
import SiteNav from "@/components/seo/SiteNav";
import Breadcrumbs from "@/components/seo/Breadcrumbs";

export default function TextPage({ title, breadcrumbName, path, breadcrumbItems, children }: { title: string; breadcrumbName: string; path: string; breadcrumbItems?: { name: string; path: string }[]; children: React.ReactNode; }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <StructuredData data={breadcrumb(breadcrumbItems ?? [{ name: "Start", path: "/" }, { name: breadcrumbName, path }])} />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">&larr; Zurück zum Spiel</Link>
        <SiteNav current={path} />
        <Breadcrumbs items={breadcrumbItems ?? [{ name: "Start", path: "/" }, { name: breadcrumbName, path }]} />
        <h1 className="mb-6 mt-6 text-2xl font-bold">{title}</h1>
        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">{children}</div>
      </main>
    </div>
  );
}
